import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createInputs } from './four-pickups-input-helpers.mjs';

// Isolated storage and real drag/WASD inputs. The imported terrain scene is
// diagnostic only; it never replaces or mutates the scene being played.
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5180/';
const baselineOnly = process.argv.includes('--baseline');
const out = fileURLToPath(new URL('./', import.meta.url));
const report = { url, startedAt: new Date().toISOString(), checks: [], routes: [], views: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling'] });
const snap = page => page.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const { aim, aimPoint, walk } = createInputs(snap, report);
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS: ' + name); };

async function setup(pose) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await context.addInitScript(pose => {
    if (pose) localStorage.setItem('old-web-outpost:save:v1', JSON.stringify({ version: 1, pose }));
    window.__mountainShaderAudit = { sources: [], errors: [] };
    const proto = WebGL2RenderingContext.prototype, originalSource = proto.shaderSource, originalCompile = proto.compileShader;
    proto.shaderSource = function(shader, source) { window.__mountainShaderAudit.sources.push(source); return originalSource.call(this, shader, source); };
    proto.compileShader = function(shader) { originalCompile.call(this, shader); if (!this.getShaderParameter(shader, this.COMPILE_STATUS)) window.__mountainShaderAudit.errors.push(this.getShaderInfoLog(shader)); };
  }, pose);
  const page = await context.newPage();
  // Retain renderer arguments inside this isolated QA page. This only observes
  // the original render call and never writes to scene/camera/material state.
  await page.route('**/src/main.ts*', async route => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace(/(\brenderer\s*=\s*new THREE\.WebGLRenderer\([^;]+;)/, '$1\nconst __qaRender = renderer.render; renderer.render = function(scene, camera) { window.__mountainScene = scene; window.__mountainCamera = camera; return __qaRender.call(this, scene, camera); };');
    await route.fulfill({ response, body });
  });
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  await page.locator('#enter-drag').click();
  return { page, context };
}

async function terrain(page) {
  return page.evaluate(async () => {
    const source = await (await fetch('/src/map-environment.ts')).text();
    const threePath = source.match(/from ["']([^"']*three[^"']+)["']/)?.[1];
    if (!threePath) throw new Error('Unable to locate current Vite Three module');
    const THREE = await import(threePath), scene = window.__mountainScene;
    if (!scene) throw new Error('Original game scene was not observed');
    const peaks = scene.getObjectByName('Peripheral_mountains');
    const g = peaks.geometry, m = peaks.material;
    const invariants = {
      count: peaks.count, matrix: Array.from(peaks.instanceMatrix.array),
      geometry: { type: g.type, parameters: g.parameters, position: Array.from(g.attributes.position.array), normal: Array.from(g.attributes.normal.array), uv: Array.from(g.attributes.uv.array), index: Array.from(g.index.array) },
      // Only terrain generated before GLB loading; excludes animated pickups.
      otherTerrain: scene.children.filter(o => o !== peaks && ['Ground_West_bank', 'Ground_East_bank', 'River_water_nonwalkable', 'Expanded_boundary_fence'].includes(o.name)).map(o => ({ name: o.name, type: o.type, position: o.position.toArray(), rotation: o.rotation.toArray(), scale: o.scale.toArray(), count: o.count ?? null, matrix: o.instanceMatrix ? Array.from(o.instanceMatrix.array) : null })),
    };
    return { invariants, camera: { fov: window.__mountainCamera.fov, aspect: window.__mountainCamera.aspect, near: window.__mountainCamera.near, far: window.__mountainCamera.far }, material: { type: m.type, color: m.color.getHexString(), flatShading: m.flatShading, transparent: m.transparent, depthTest: m.depthTest, depthWrite: m.depthWrite, userData: m.userData, map: m.map ? { width: m.map.image?.width, height: m.map.image?.height } : null }, userData: peaks.userData, attributes: Object.keys(g.attributes) };
  });
}

async function sampleSurface(page, fixed) {
  return page.evaluate(async fixed => {
    const source = await (await fetch('/src/map-environment.ts')).text();
    const THREE = await import(source.match(/from ["']([^"']*three[^"']+)["']/)[1]);
    const scene = window.__mountainScene, camera = window.__mountainCamera, peaks = scene.getObjectByName('Peripheral_mountains');
    const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <uv_vertex>', fragmentShader: '#include <common>\n#include <map_fragment>' };
    peaks.material.onBeforeCompile(shader, null);
    const atlas = shader.uniforms.mountainFaultAtlas.value.image, pixels = atlas.getContext('2d').getImageData(0, 0, atlas.width, atlas.height).data;
    const tile = peaks.geometry.attributes.mountainFaultTile, size = shader.uniforms.mountainFaultTileSize.value;
    const pixel = (id, uv) => {
      const x = Math.min(atlas.width-1, Math.max(0, Math.floor((tile.getX(id) + uv.x * size.x) * atlas.width)));
      const y = Math.min(atlas.height-1, Math.max(0, Math.floor((1 - tile.getY(id) - uv.y * size.y) * atlas.height)));
      return Array.from(pixels.slice((y * atlas.width + x) * 4, (y * atlas.width + x) * 4 + 4));
    };
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(), eye = camera.position.clone();
    const probe = point => {
      ray.set(eye, point.clone().sub(eye).normalize());
      const hit = ray.intersectObject(peaks)[0];
      if (!hit || hit.point.distanceTo(point) > .015) return null;
      const foreground = ray.intersectObjects(scene.children, true).find(h => h.object.visible && h.distance < hit.distance - .02);
      const materialUV=peaks.geometry.attributes.mountainFaultUv??peaks.geometry.attributes.uv, positions=peaks.geometry.attributes.position;
      const transform=new THREE.Matrix4();peaks.getMatrixAt(hit.instanceId,transform);transform.premultiply(peaks.matrixWorld);
      const local=hit.point.clone().applyMatrix4(transform.invert()), ids=[hit.face.a,hit.face.b,hit.face.c];
      const bary=THREE.Triangle.getBarycoord(local,...ids.map(id=>new THREE.Vector3().fromBufferAttribute(positions,id)),new THREE.Vector3());
      const faultUV=new THREE.Vector2();ids.forEach((id,i)=>faultUV.addScaledVector(new THREE.Vector2().fromBufferAttribute(materialUV,id),bary.getComponent(i)));
      const repeat=shader.uniforms.mountainTextRepeat?.value,offsetScale=shader.uniforms.mountainTextOffsetScale?.value;
      const textUV=repeat?faultUV.clone().multiply(repeat).add(new THREE.Vector2(tile.getX(hit.instanceId),tile.getY(hit.instanceId)).multiply(offsetScale)):null;
      return { instance: hit.instanceId, point: hit.point.toArray(), uv: hit.uv.toArray(), faultUV:faultUV.toArray(),textUV:textUV?.toArray()??null, rgba: pixel(hit.instanceId, faultUV), distance: hit.distance, occludedBy: foreground?.object.name ?? null };
    };
    if (fixed) return probe(new THREE.Vector3(...fixed.point));
    const g = peaks.geometry, p = g.attributes.position, uv = g.attributes.mountainFaultUv??g.attributes.uv, index = g.index, candidates = [], matrix = new THREE.Matrix4();
    for (let id = 0; id < peaks.count; id++) {
      peaks.getMatrixAt(id, matrix); matrix.premultiply(peaks.matrixWorld);
      for (let i = 0; i < index.count; i += 3) {
        const ids = [index.getX(i), index.getX(i+1), index.getX(i+2)];
        if (ids.every(n => p.getY(n) < -.49)) continue;
        for (const a of [.15,.35,.55,.75]) for (const b of [.15,.35,.55,.75]) {
          const c = 1-a-b; if (c < .08) continue;
          const tex = new THREE.Vector2(uv.getX(ids[0])*a+uv.getX(ids[1])*b+uv.getX(ids[2])*c, uv.getY(ids[0])*a+uv.getY(ids[1])*b+uv.getY(ids[2])*c);
          const rgba = pixel(id, tex); if (rgba[3] < 240 || rgba[2] < 150 || rgba[0] > 100) continue;
          const point = new THREE.Vector3(); for (let k=0;k<3;k++) point.addScaledVector(new THREE.Vector3().fromBufferAttribute(p,ids[k]), [a,b,c][k]);
          point.applyMatrix4(matrix);
          if (point.y < 1 || point.y > 9) continue;
          candidates.push({ point, distance: point.distanceTo(eye) });
        }
      }
    }
    candidates.sort((a,b)=>a.distance-b.distance);
    for (const candidate of candidates) { const hit=probe(candidate.point); if (hit && !hit.occludedBy) return hit; }
    return null;
  }, fixed);
}

async function atlasAudit(page) {
  return page.evaluate(() => {
    const peaks=window.__mountainScene.getObjectByName('Peripheral_mountains');
    const shader={uniforms:{},vertexShader:'#include <common>\n#include <uv_vertex>',fragmentShader:'#include <common>\n#include <map_fragment>'};
    peaks.material.onBeforeCompile(shader,null);
    const texture=shader.uniforms.mountainFaultAtlas.value, c=texture.image, data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    const size=shader.uniforms.mountainFaultTileSize.value, tileWidth=Math.round(c.width*size.x),tileHeight=Math.round(c.height*size.y),columns=Math.round(1/size.x),tiles=[];
    for(let id=0;id<peaks.count;id++) { let weighted=0,total=0,white=0,blue=0; const col=id%columns,row=Math.floor(id/columns);
      for(let y=0;y<tileHeight;y++)for(let x=0;x<tileWidth;x++){const i=((row*tileHeight+y)*c.width+col*tileWidth+x)*4, w=(y+.5)/tileHeight; total+=w; weighted+=w*data[i+3]/255;if(data[i+3]>128){if(data[i]>150&&data[i+1]>150)white++;else blue++;}}
      tiles.push({id,coverage:weighted/total,whitePixels:white,bluePixels:blue});
    }
    const compiled=window.__mountainShaderAudit.sources.filter(s=>s.includes('vMountainFaultUv'));
    const errorTexture=shader.uniforms.mountainErrorText?.value;
    let lettering=null;
    if(errorTexture){const glyphCanvas=errorTexture.image,glyphData=glyphCanvas.getContext('2d').getImageData(0,0,glyphCanvas.width,glyphCanvas.height).data;let whitePixels=0;for(let i=0;i<glyphData.length;i+=4)if(glyphData[i+3]>32&&glyphData[i]>150&&glyphData[i+1]>150)whitePixels++;lettering={width:glyphCanvas.width,height:glyphCanvas.height,whitePixels,wrapS:errorTexture.wrapS,wrapT:errorTexture.wrapT};}
    return {width:c.width,height:c.height,tileWidth,tileHeight,columns,tiles,lettering,weightedCoverage:tiles.reduce((s,t)=>s+t.coverage,0)/tiles.length,compiledShaderCount:compiled.length,compileErrors:window.__mountainShaderAudit.errors,vertexSource:shader.vertexShader,fragmentSource:shader.fragmentShader,filter:{mag:texture.magFilter,min:texture.minFilter,anisotropy:texture.anisotropy}};
  });
}

async function capture(page,name) {
  await page.waitForTimeout(120); await page.screenshot({path:out+name+'.png',fullPage:true});
  report.views.push({name,pose:(await snap(page)).pose}); console.log('SCREENSHOT: '+name);
}

try {
  const initial = await setup(); report.initial = await snap(initial.page); report.terrain = await terrain(initial.page);
  assert.deepEqual(report.initial.pose, report.initial.map.spawn);
  assert.equal(report.initial.eyeY, 1.65); assert.equal(report.initial.assets.length, 10);
  assert.equal(report.initial.pickups.length, 5); assert.equal(report.initial.mapOpen, false);
  if (baselineOnly) {
    await writeFile(out + 'mountain-baseline/snapshot.json', JSON.stringify({ state: report.initial, terrain: report.terrain }, null, 2));
    await initial.page.screenshot({ path: out + 'mountain-baseline/spawn.png', fullPage: true });
    check('Original runtime baseline saved', { mountains: report.terrain.invariants.count, colliders: report.initial.colliders.length });
  } else {
    const baseline = JSON.parse(await readFile(out+'mountain-baseline/snapshot.json','utf8'));
    // JSON baseline canonically stores both +0 and -0 as 0.
    assert.deepEqual(JSON.parse(JSON.stringify(report.terrain.invariants)),baseline.terrain.invariants);
    assert.deepEqual(report.terrain.camera,baseline.terrain.camera);
    for(const key of ['map','colliders','assets','sky','camera','clues','memes','collectedPickups','pickupInventory','pickupStyle']) assert.deepEqual(report.initial[key],baseline.state[key],key+' unchanged');
    assert.deepEqual(report.initial.pickups.map(p=>({id:p.id,basePosition:p.basePosition,memeId:p.memeId})),baseline.state.pickups.map(p=>({id:p.id,basePosition:p.basePosition,memeId:p.memeId})));
    assert.equal(report.terrain.material.type,'MeshLambertMaterial'); assert.equal(report.terrain.material.color,'80a78a');
    assert.equal(report.terrain.material.flatShading,true); assert.equal(report.terrain.material.depthTest,true); assert.equal(report.terrain.material.depthWrite,true); assert.equal(report.terrain.material.transparent,false);
    check('山体原几何/实例矩阵、地图/碰撞/资产/天空/拾取物和相机完全符合修改前快照');
    report.atlas=await atlasAudit(initial.page);
    assert.ok(report.atlas.weightedCoverage>.05&&report.atlas.weightedCoverage<.25);
    assert.ok(report.atlas.tiles.filter(t=>t.coverage===0).length>=5);
    assert.ok(report.atlas.compiledShaderCount>=2); assert.deepEqual(report.atlas.compileErrors,[]);
    assert.ok(report.atlas.lettering?report.atlas.lettering.whitePixels>0:report.atlas.tiles.some(t=>t.whitePixels>0));
    assert.match(report.atlas.vertexSource,/mountainFaultTile \+ (mountainFaultUv|uv) \* mountainFaultTileSize/);
    assert.doesNotMatch(report.atlas.vertexSource+report.atlas.fragmentSource,/gl_FragCoord|cameraPosition|time|viewMatrix/);
    check('实际编译材质使用实例UV，保留深度遮挡；无屏幕/相机/时间坐标，含独立斑块和完整绿色山体', {coverage:report.atlas.weightedCoverage,intact:report.atlas.tiles.filter(t=>t.coverage===0).length});
    await aim(initial.page,Math.PI,.16); await capture(initial.page,'mountain-spawn-south-far');
    await walk(initial.page,[[0,11]],'原出生点实际向南步行约2米');
    assert.deepEqual((await terrain(initial.page)).invariants,report.terrain.invariants);
    await initial.context.close();
    for(const edge of [
      {name:'west',pose:{x:-13,z:-20,yaw:0,pitch:0},nodes:[[-14.5,-20]],yaw:Math.PI/2},
      {name:'south',pose:{x:0,z:13,yaw:0,pitch:0},nodes:[[0,14.5]],yaw:Math.PI},
      {name:'east',pose:{x:65,z:-16,yaw:0,pitch:0},nodes:[[66.5,-16]],yaw:-Math.PI/2},
      {name:'north',pose:{x:0,z:-55,yaw:0,pitch:0},nodes:[[0,-56.5]],yaw:0},
    ]) {
      const t=await setup(edge.pose); const start=await snap(t.page);
      assert.ok(Math.hypot(start.pose.x-edge.pose.x,start.pose.z-edge.pose.z)<.005,'legal edge fixture');
      await walk(t.page,edge.nodes,edge.name+'边缘：独立合法存档点加载后真实WASD走近山体');
      await aim(t.page,edge.yaw,.2);
      const fixed=await sampleSurface(t.page); assert.ok(fixed,edge.name+' visible blue surface sample');
      await aimPoint(t.page,{x:fixed.point[0],y:fixed.point[1],z:fixed.point[2]});
      await capture(t.page,'mountain-'+edge.name+'-near');
      const afterAim=await sampleSurface(t.page,fixed); assert.ok(afterAim);
      assert.equal(afterAim.instance,fixed.instance); assert.ok(Math.hypot(...afterAim.uv.map((v,i)=>v-fixed.uv[i]))<.0001); assert.deepEqual(afterAim.rgba,fixed.rgba);
      // Walk backward then turn back to the exact same world-space fault texel.
      const beforeMove=(await snap(t.page)).pose;
      await t.page.keyboard.down('s'); await t.page.waitForTimeout(750); await t.page.keyboard.up('s');
      const afterMove=await snap(t.page); assert.ok(Math.hypot(afterMove.pose.x-beforeMove.x,afterMove.pose.z-beforeMove.z)>.3);
      await aimPoint(t.page,{x:fixed.point[0],y:fixed.point[1],z:fixed.point[2]});
      const movedSample=await sampleSurface(t.page,fixed); assert.ok(movedSample,edge.name+' same rock face after movement');
      assert.equal(movedSample.instance,fixed.instance); assert.ok(Math.hypot(...movedSample.uv.map((v,i)=>v-fixed.uv[i]))<.0001); assert.deepEqual(movedSample.rgba,fixed.rgba);
      if(fixed.textUV) assert.ok(Math.hypot(...movedSample.textUV.map((v,i)=>v-fixed.textUV[i]))<.0001,'shared error text remains fixed to same face');
      assert.deepEqual((await terrain(t.page)).invariants,report.terrain.invariants);
      assert.equal(afterMove.eyeY,1.65); assert.equal(afterMove.mapOpen,false);
      const shaders=await t.page.evaluate(()=>window.__mountainShaderAudit.errors); assert.deepEqual(shaders,[]);
      if(edge.name==='west') await capture(t.page,'mountain-west-moved-and-turned');
      check(edge.name+'边缘实走和转头后同一蓝斑仍命中原实例/世界点/UV/RGBA', {fixed,afterAim,movedSample,beforeMove,afterMove:afterMove.pose});
      await t.context.close();
    }
  }
  if(baselineOnly) await initial.context.close();
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) {
  report.passed = false; report.errors.push(error.stack || String(error)); console.error(error); process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(out + (baselineOnly ? 'mountain-baseline/report.json' : 'mountain-browser-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
