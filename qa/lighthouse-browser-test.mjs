import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5180/';
const photosOnly = process.argv.includes('--photos-only');
const out = fileURLToPath(new URL('./', import.meta.url));
const COUNTS = { Tree_01: 86, Rock_01: 20, Grass_01: 349, PathTile_01: 67, Outpost_01: 1, OldTerminal_CRT_01: 1, Archive_01: 1 };
const CARDS = ['missing-caption-image', 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'];
const HOOKS = [
  { id: 'archive_investigation', locationId: 'archive', position: { x: 20, z: -35 }, enabled: true },
  { id: 'bridge_unlock', locationId: 'bridge', position: { x: 34, z: -8 }, enabled: false },
  { id: 'lighthouse_task', locationId: 'lighthouse', position: { x: 57, z: -35 }, enabled: false },
];
const APPROACHES = { 'old-terminal': [16.6, -33.7], 'chat-viewer': [20, -34.3], 'image-cache': [22.8, -34], 'archive-desk': [25, -30.7] };
const report = { url, startedAt: new Date().toISOString(), checks: [], routes: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling'] });
const snap = p => p.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS: ' + name); };
const shot = (p, name) => p.screenshot({ path: out + name + '.png', fullPage: true });
async function setup(pose = { x: 39, z: -8, yaw: 0, pitch: 0 }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await context.addInitScript(({ cards, pose }) => {
    if (!localStorage.getItem('old-web-outpost:save:v1')) localStorage.setItem('old-web-outpost:save:v1', JSON.stringify({
      version: 1, investigated: true, clues: cards, pose,
      archive: { answers: { meaning: 'emotion', context: 'shared-self-mockery' }, completed: true }, updatedAt: 1,
    }));
  }, { cards: CARDS, pose });
  const page = await context.newPage(), glbs = [];
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('response', r => { if (r.url().includes('.glb')) glbs.push({ url: r.url(), status: r.status() }); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  await page.locator('#enter-drag').click(); return { page, context, glbs };
}
async function aim(page, yaw, pitch = 0) {
  const p = (await snap(page)).pose;
  const dx = -Math.atan2(Math.sin(yaw - p.yaw), Math.cos(yaw - p.yaw)) / .0022, dy = (p.pitch - pitch) / .0022;
  const b = await page.locator('#game-canvas').boundingBox(), n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 300));
  for (let i = 0; i < n; i++) {
    const x = b.x + b.width * .5, y = b.y + b.height * .55;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx / n, y + dy / n, { steps: 6 }); await page.mouse.up();
  }
}
async function lookAt(page, point) {
  const p = (await snap(page)).pose, dx = point.x - p.x, dz = point.z - p.z;
  await aim(page, Math.atan2(-dx, -dz), Math.atan2(point.y - 1.65, Math.hypot(dx, dz)));
}
async function walkAxis(page, axis, target) {
  const begin = (await snap(page)).pose, diff = target - begin[axis];
  if (Math.abs(diff) < .09) return;
  const sign = Math.sign(diff), key = axis === 'x' ? (sign > 0 ? 'd' : 'a') : (sign > 0 ? 's' : 'w');
  let previous = begin, stuck = 0;
  await page.keyboard.down(key);
  try {
    for (let i = 0; i < 700; i++) {
      await page.waitForTimeout(45); const s = await snap(page); assert.ok(s.active); assert.ok(Math.abs(s.eyeY - 1.65) < .005);
      if (Math.hypot(s.pose.x - previous.x, s.pose.z - previous.z) < .002) stuck++; else stuck = 0;
      if (stuck > 35) throw new Error(`Blocked ${axis}=${target} at ${JSON.stringify(s.pose)}`);
      previous = s.pose; if (sign * (s.pose[axis] - target) >= -.03) return;
    }
    throw new Error('Walk timed out');
  } finally { await page.keyboard.up(key); }
}
async function walk(page, points, name) {
  await aim(page, 0); const start = (await snap(page)).pose, begin = performance.now();
  for (const [x, z] of points) { await walkAxis(page, 'x', x); await walkAxis(page, 'z', z); }
  report.routes.push({ name, start, end: (await snap(page)).pose, seconds: +((performance.now() - begin) / 1000).toFixed(2) });
}
function overlaps(p, c, r = .26) {
  if (c.kind === 'circle') return Math.hypot(p.x - c.x, p.z - c.z) < c.radius + r - .0002;
  const nx = Math.max(c.x - c.halfX, Math.min(c.x + c.halfX, p.x)), nz = Math.max(c.z - c.halfZ, Math.min(c.z + c.halfZ, p.z));
  return Math.hypot(p.x - nx, p.z - nz) < r - .0002;
}
function assertProgress(s) {
  assert.deepEqual([...s.clues].sort(), [...CARDS].sort()); assert.equal(s.archive.completed, true);
  assert.equal(s.archive.answers.meaning, 'emotion'); assert.equal(s.archive.answers.context, 'shared-self-mockery');
}
async function pausedCheck(page) {
  const before = (await snap(page)).pose;
  await page.keyboard.down('w'); await page.waitForTimeout(250); await page.keyboard.up('w'); assert.deepEqual((await snap(page)).pose, before);
}
async function extraPhotos() {
  const bridge = await setup({x:42.5,z:-8,yaw:0,pitch:0});
  await lookAt(bridge.page,{x:57,y:7,z:-41});await shot(bridge.page,'lighthouse-game-bridge-far');
  const environment=await snap(bridge.page);
  report.routes.push({name:'lighthouse-game-bridge-far',pose:environment.pose});
  const trees=environment.colliders.filter(c=>c.label==='树干');
  const sightClearance=p=>Math.min(...trees.map(c=>{
    const dx=57-p.x,dz=-41-p.z,t=Math.max(0,Math.min(1,((c.x-p.x)*dx+(c.z-p.z)*dz)/(dx*dx+dz*dz)));
    return Math.hypot(c.x-p.x-t*dx,c.z-p.z-t*dz)-(c.radius??0);
  }));
  const sideCandidates=[0,20,-20,35,-35,180,160,200,145,215].map(deg=>({x:57+10.5*Math.cos(deg*Math.PI/180),z:-41+10.5*Math.sin(deg*Math.PI/180),yaw:0,pitch:0}))
    .filter(p=>p.x<67.74&&!environment.colliders.some(c=>overlaps(p,c)))
    .sort((a,b)=>sightClearance(b)-sightClearance(a));
  const sidePose=sideCandidates[0];assert.ok(sidePose);report.sidePhotoClearance=sightClearance(sidePose);
  await bridge.context.close();
  for (const photo of [
    { pose: sidePose, target: { x: 57, y: 5.8, z: -41 }, name: 'lighthouse-game-side' },
    { pose: { x: 57, z: -51.5, yaw: 0, pitch: 0 }, target: { x: 57, y: 5.8, z: -41 }, name: 'lighthouse-game-rear' },
  ]) {
    const p = await setup(photo.pose); await lookAt(p.page, photo.target); await shot(p.page, photo.name);
    report.routes.push({ name: photo.name, pose: (await snap(p.page)).pose }); await p.context.close();
  }
}
try {
 if (photosOnly) { await extraPhotos(); report.passed = true; }
 else {
  const { page, context, glbs } = await setup(); let s = await snap(page);
  report.renderer = await page.evaluate(() => { const g = document.querySelector('canvas').getContext('webgl2'), e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unavailable'; });
  const tower = s.assets.find(a => a.name === 'Lighthouse_01');
  assert.equal(s.assets.length, 8); assert.ok(tower && tower.instances === 1 && tower.meshes > 0 && tower.texturedMaterials > 0);
  assert.ok(tower.dimensions.y > 13 && tower.dimensions.y < 16);
  assert.ok(glbs.some(r => r.url.includes('Lighthouse_01.glb') && r.status === 200));
  assert.ok(tower.nodeNames.includes('Lighthouse_Lamp_Core'));
  check('第八个灯塔GLB与贴图真实加载，保留独立Lighthouse_Lamp_Core节点', tower);
  assert.ok(tower.materialDetails.some(m => m.emissive && m.emissive !== '000000' && m.emissiveIntensity > 0));
  check('灯芯发光材质保留，玻璃参数可检查', tower.materialDetails);
  for (const [name, count] of Object.entries(COUNTS)) assert.equal(s.assets.find(a => a.name === name)?.instances, count);
  for (const [id, point] of Object.entries(APPROACHES)) { const i = s.interactables.find(i => i.id === id); assert.ok(i); assert.ok(Math.hypot(i.approach.x - point[0], i.approach.z - point[1]) < .001); }
  assert.deepEqual(s.map.futureHooks, HOOKS); assert.equal(s.map.bridge.crossingOpen, true);
  assert.deepEqual(s.map.locations.lighthouse.position, { x: 57, z: -41 });
  assert.equal(s.interactables.length, 5);
  check('原七类模型数量、调查站位、任务接入口、灯塔位置及桥开放状态不变');
  assertProgress(s); assert.ok(Math.abs(s.eyeY - 1.65) < .005); assert.ok(Math.abs(s.pose.z + 8) < .01);
  await lookAt(page, { x: 57, y: 7, z: -41 }); await shot(page, 'lighthouse-game-bridge-center');
  check('桥中央正常站位远眺，未站在桥栏或抬高相机', s.pose);
  await walk(page, [[50, -8], [50, -30]], '桥梁中心沿既有道路走向灯塔');
  await lookAt(page, { x: 57, y: 6.2, z: -41 }); await shot(page, 'lighthouse-game-near');
  await walk(page, [[50, -35], [57, -35]], '沿既有道路抵达预留灯塔任务点');
  s = await snap(page); assert.ok(!s.colliders.some(c => overlaps(s.pose, c)));
  assert.ok(Math.hypot(s.pose.x - 57, s.pose.z + 35) < .25);
  check('实际走到(57,-35)，道路和预留任务点未被新门房阻断', s.pose);
  await lookAt(page, { x: 57, y: 8.7, z: -41 }); await shot(page, 'lighthouse-game-opening');
  await page.keyboard.press('b');
  for (const id of CARDS) assert.ok(await page.locator(`[data-clue-id="${id}"]`).count());
  await pausedCheck(page); await shot(page, 'lighthouse-game-bag');
  await page.locator('#modal-close').click(); assert.equal((await snap(page)).active, false);
  await page.locator('#enter-drag').click(); check('灯塔附近背包四卡正常，窗口暂停与明确点击恢复保持');
  await walk(page, [[54, -35], [54, -44.5], [57, -44.5]], '从左侧绕到灯塔背后');
  await lookAt(page, { x: 57, y: 8.2, z: -41 }); await shot(page, 'lighthouse-game-rear-opening');
  await walk(page, [[60, -44.5], [60, -35], [57, -35]], '从右侧绕回门房前');
  check('左右与背后实际绕行畅通，眼高稳定，不穿地');
  const before = (await snap(page)).pose;
  await page.keyboard.press('Escape'); await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  s = await snap(page); assertProgress(s); assert.ok(Math.hypot(s.pose.x - before.x, s.pose.z - before.z) < .01);
  check('刷新保持位置、四卡、两题答案及档案馆完成状态', s.pose);
  const base = s.colliders.find(c => c.label === '记忆灯塔基座'), hut = s.colliders.find(c => c.label === '记忆灯塔门房');
  assert.ok(base && hut); assert.equal(base.radius, 1.9);
  assert.ok(!s.colliders.some(c => c.label === '记忆灯塔占位建筑'));
  report.colliders = { base, hut }; await context.close();
  for (const test of [
    { name: '基座西侧', pose: { x: 54.2, z: -41, yaw: -Math.PI / 2, pitch: 0 }, axis: 'x', limit: base.x - base.radius - .26 },
    { name: '基座东侧', pose: { x: 59.8, z: -41, yaw: Math.PI / 2, pitch: 0 }, axis: 'x', limit: base.x + base.radius + .26 },
    { name: '基座后侧', pose: { x: 57, z: -44, yaw: Math.PI, pitch: 0 }, axis: 'z', limit: base.z - base.radius - .26 },
    { name: '门房正面', pose: { x: 57, z: -35.5, yaw: 0, pitch: 0 }, axis: 'z', limit: hut.z + hut.halfZ + .26 },
    { name: '门房左墙', pose: { x: 54.5, z: -38.2, yaw: -Math.PI / 2, pitch: 0 }, axis: 'x', limit: hut.x - hut.halfX - .26 },
    { name: '门房右墙', pose: { x: 59.5, z: -38.2, yaw: Math.PI / 2, pitch: 0 }, axis: 'x', limit: hut.x + hut.halfX + .26 },
  ]) {
    const fixture = await setup(test.pose);
    await fixture.page.keyboard.down('w'); await fixture.page.waitForTimeout(1200); await fixture.page.keyboard.up('w');
    const end = (await snap(fixture.page)).pose;
    assert.ok(Math.abs(end[test.axis] - test.limit) < .04, `${test.name}: ${JSON.stringify(end)} vs ${test.limit}`);
    check(test.name + '实际碰撞阻挡准确', end); await fixture.context.close();
  }
  const legacy = await setup({ x: 57, z: -38.4, yaw: 0, pitch: 0 });
  const recovered = await snap(legacy.page); assertProgress(recovered);
  assert.ok(Math.hypot(recovered.pose.x - 57, recovered.pose.z + 38.4) > .3);
  assert.ok(!recovered.colliders.some(c => overlaps(recovered.pose, c)), 'Legacy pose remains inside new collision');
  await legacy.page.keyboard.down('s'); await legacy.page.waitForTimeout(500); await legacy.page.keyboard.up('s');
  assert.ok((await snap(legacy.page)).pose.z > recovered.pose.z + .5);
  check('旧塔合法站位(57,-38.4)载入后自动推出新门房，仍能走动且进度不丢', recovered.pose);
  await legacy.context.close(); await extraPhotos();
  assert.deepEqual(report.errors, []); report.passed = true;
 }
} catch (error) {
  report.passed = false; report.errors.push(error.stack || String(error)); console.error(error); process.exitCode = 1;
  for (const context of browser.contexts()) for (const page of context.pages()) {
    await shot(page, 'lighthouse-test-failure').catch(() => {});
    const s = await snap(page).catch(() => null); console.log(JSON.stringify(s && { pose: s.pose, active: s.active, clues: s.clues, archive: s.archive }));
  }
} finally {
  report.finishedAt = new Date().toISOString(); await writeFile(out + (photosOnly ? 'lighthouse-photo-report.json' : 'lighthouse-browser-report.json'), JSON.stringify(report, null, 2)); await browser.close();
}
