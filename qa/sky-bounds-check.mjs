// Read-only verification of the proposed sky enclosure against original terrain
// and actual GLB vertex positions. Only this report is written; src is untouched.
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import ts from 'typescript';
import {MAP} from '../src/map-config.ts';
import {SKY_ENCLOSURE} from '../src/sky-config.ts';

const enclosure = {...SKY_ENCLOSURE.bounds,bottom:SKY_ENCLOSURE.bottomY,top:SKY_ENCLOSURE.topY};
const cameraFar = SKY_ENCLOSURE.cameraFar;
// Running the original draw callbacks also consumes their RNG calls, preserving
// the exact mountain arrangement (grass 2900*5, water 80*3, then peaks).
const context = {fillRect(){}};
globalThis.document = {createElement:()=>({width:0,height:0,getContext:()=>context})};
let terrainSource = ts.transpileModule(await readFile(new URL('../src/map-environment.ts',import.meta.url),'utf8'), {
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
}).outputText;
terrainSource = terrainSource.replace("'three'",JSON.stringify(import.meta.resolve('three')))
  .replace("'./map-config'",JSON.stringify(new URL('../src/map-config.ts',import.meta.url).href));
const {makeExpandedTerrain} = await import(`data:text/javascript;base64,${Buffer.from(terrainSource).toString('base64')}`);
const scene = new THREE.Scene();
makeExpandedTerrain(scene);
scene.updateMatrixWorld(true);
const mountains = scene.getObjectByName('Peripheral_mountains');
assert(mountains instanceof THREE.InstancedMesh);
const mountainBox = new THREE.Box3();
const instanceBoxes = [];
const vector = new THREE.Vector3(), matrix = new THREE.Matrix4();
for(let i=0;i<mountains.count;i++) {
  mountains.getMatrixAt(i,matrix); matrix.premultiply(mountains.matrixWorld);
  const box = new THREE.Box3(), positions = mountains.geometry.getAttribute('position');
  for(let v=0;v<positions.count;v++)box.expandByPoint(vector.fromBufferAttribute(positions,v).applyMatrix4(matrix));
  instanceBoxes.push(box); mountainBox.union(box);
}

async function glbBounds(file,placement) {
  const buffer = await readFile(new URL(`../public/assets/${file}.glb`,import.meta.url));
  const length = buffer.readUInt32LE(12);
  const gltf = JSON.parse(buffer.subarray(20,20+length).toString());
  const binary = buffer.subarray(28+length);
  const bounds = new THREE.Box3(); let vertices = 0;
  function visit(index,parent) {
    const node = gltf.nodes[index];
    const local = node.matrix ? new THREE.Matrix4().fromArray(node.matrix) : new THREE.Matrix4().compose(
      new THREE.Vector3(...(node.translation??[0,0,0])),
      new THREE.Quaternion(...(node.rotation??[0,0,0,1])),
      new THREE.Vector3(...(node.scale??[1,1,1])),
    );
    local.premultiply(parent);
    if(node.mesh!=null)for(const primitive of gltf.meshes[node.mesh].primitives) {
      const accessor = gltf.accessors[primitive.attributes.POSITION], view = gltf.bufferViews[accessor.bufferView];
      assert.equal(accessor.componentType,5126); assert.equal(accessor.type,'VEC3');
      assert(!accessor.sparse,'Sparse position accessors need explicit handling');
      for(let i=0;i<accessor.count;i++) {
        const offset = (view.byteOffset??0)+(accessor.byteOffset??0)+i*(view.byteStride??12);
        bounds.expandByPoint(new THREE.Vector3(binary.readFloatLE(offset),binary.readFloatLE(offset+4),binary.readFloatLE(offset+8)).applyMatrix4(local));
        vertices++;
      }
    }
    for(const child of node.children??[])visit(child,local);
  }
  const world = new THREE.Matrix4().makeTranslation(placement.x,0,placement.z);
  for(const index of gltf.scenes[gltf.scene??0].nodes)visit(index,world);
  return {bounds,vertices};
}
const rounded = v => Math.round(v*1e6)/1e6;
const serializedBox = box => ({min:box.min.toArray().map(rounded),max:box.max.toArray().map(rounded)});
const clearance = box => ({west:box.min.x-enclosure.minX,east:enclosure.maxX-box.max.x,north:box.min.z-enclosure.minZ,south:enclosure.maxZ-box.max.z,bottom:box.min.y-enclosure.bottom,top:enclosure.top-box.max.y});
const checkBox = box => Object.fromEntries(Object.entries(clearance(box)).map(([key,value])=>{
  assert(value>0,`${key}: enclosure intersects geometry at ${value}`); return [key,rounded(value)];
}));
const buildings = {};
for(const [id,file] of [['outpost','Outpost_01'],['archive','Archive_01'],['lighthouse','Lighthouse_01']]) {
  const {bounds,vertices} = await glbBounds(file,MAP.locations[id].position);
  buildings[id] = {bounds:serializedBox(bounds),vertices,clearance:checkBox(bounds)};
}
// All maxima of distance between these convex cuboids occur at corner pairs.
const skyCorners = [];
for(const x of [enclosure.minX,enclosure.maxX])for(const y of [enclosure.bottom,enclosure.top])for(const z of [enclosure.minZ,enclosure.maxZ])skyCorners.push(new THREE.Vector3(x,y,z));
let farthest = {distance:0};
for(const x of [MAP.bounds.minX,MAP.bounds.maxX])for(const z of [MAP.bounds.minZ,MAP.bounds.maxZ]) {
  const player = new THREE.Vector3(x,1.65,z);
  for(const skyCorner of skyCorners) {
    const distance = player.distanceTo(skyCorner);
    if(distance>farthest.distance)farthest={distance,player:player.toArray(),skyCorner:skyCorner.toArray()};
  }
}
assert(farthest.distance<cameraFar);
farthest.distance=rounded(farthest.distance);
// Construct the actual module with only its image loader stubbed. This permits
// geometric ray checks without a browser or modifying any authored texture.
let skySource = ts.transpileModule(await readFile(new URL('../src/sky-enclosure.ts',import.meta.url),'utf8'), {
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
}).outputText;
skySource = skySource.replace("'three'",JSON.stringify(import.meta.resolve('three')))
  .replace("'./sky-config'",JSON.stringify(new URL('../src/sky-config.ts',import.meta.url).href))
  .replace('import.meta.env.BASE_URL',"''");
const png = await readFile(new URL(`../public/${SKY_ENCLOSURE.texture.asset}`,import.meta.url));
const actualLoadAsync = THREE.TextureLoader.prototype.loadAsync;
THREE.TextureLoader.prototype.loadAsync = async()=>new THREE.Texture({width:png.readUInt32BE(16),height:png.readUInt32BE(20)});
const {createSkyEnclosure} = await import(`data:text/javascript;base64,${Buffer.from(skySource).toString('base64')}`);
const skyScene = new THREE.Scene();
let skyGroup;
try { skyGroup=(await createSkyEnclosure(skyScene)).group; }
finally { THREE.TextureLoader.prototype.loadAsync=actualLoadAsync; }
skyScene.updateMatrixWorld(true);
const raycaster = new THREE.Raycaster();
raycaster.near=.08; raycaster.far=cameraFar;
const rayOrigins = [[MAP.bounds.minX,MAP.bounds.minZ],[MAP.bounds.minX,MAP.bounds.maxZ],[MAP.bounds.maxX,MAP.bounds.minZ],[MAP.bounds.maxX,MAP.bounds.maxZ],[MAP.spawn.x,MAP.spawn.z],[SKY_ENCLOSURE.centre.x,SKY_ENCLOSURE.centre.z]];
let coveredRays=0;
const hitFaces = new Set();
const degenerateEdgeRays = [];
for(const [x,z] of rayOrigins)for(const elevation of [0,.001,.05,.2,.5,.8,1.2,Math.PI/2])for(let i=0;i<720;i++) {
  const yaw=i*Math.PI/360;
  const direction=new THREE.Vector3(Math.sin(yaw)*Math.cos(elevation),Math.sin(elevation),-Math.cos(yaw)*Math.cos(elevation));
  raycaster.set(new THREE.Vector3(x,1.65,z),direction);
  const hits=raycaster.intersectObject(skyGroup,true);
  if(!hits.length) {
    // Exact shared-edge rays can miss both strict CPU triangle tests because of
    // sin/cos roundoff. Verify both sides at 1e-8 radians (~1 micrometre at 100m).
    for(const offset of [-1e-8,1e-8]) {
      const adjusted=new THREE.Vector3(Math.sin(yaw+offset)*Math.cos(elevation),Math.sin(elevation),-Math.cos(yaw+offset)*Math.cos(elevation));
      raycaster.set(new THREE.Vector3(x,1.65,z),adjusted);
      const adjacentHits=raycaster.intersectObject(skyGroup,true);
      assert(adjacentHits.length>0,`Uncovered neighbouring ray at ${x},${z}; yaw=${yaw}, elevation=${elevation}`);
      hitFaces.add(adjacentHits[0].object.name);
    }
    degenerateEdgeRays.push({origin:[x,1.65,z],yaw,elevation,adjacentAngularOffset:1e-8});
  } else hitFaces.add(hits[0].object.name);
  coveredRays++;
}
raycaster.set(new THREE.Vector3(SKY_ENCLOSURE.centre.x,110,SKY_ENCLOSURE.centre.z),new THREE.Vector3(0,-1,0));
assert.equal(raycaster.intersectObject(skyGroup,true).length,0,'The sky must not obscure the overview from above');
const report = {
  checkedAt:new Date().toISOString(), enclosure, mapBounds:MAP.bounds,
  method:'Original makeExpandedTerrain with Canvas drawing stub, all actual ConeGeometry instance vertices; all GLB POSITION vertices with node/world transforms',
  mountains:{instances:mountains.count,bounds:serializedBox(mountainBox),clearance:checkBox(mountainBox)},
  buildings,
  perspectiveCamera:{eyeY:1.65,far:cameraFar,farthest,farMargin:rounded(cameraFar-farthest.distance),conservative:'Uses full playable rectangle including inaccessible exact boundary corners'},
  actualModuleRayChecks:{coveredRays,origins:rayOrigins.length,hitFaces:[...hitFaces].sort(),degenerateEdgeRays,overviewDownwardRayUnobstructed:true,imageLoaderOnlyStubbed:true},
  notes:[
    'Existing below-grade horizon plane is intentionally wider than enclosure; it is excluded from mountain/building containment.',
    'Overview camera at Y=110 is above the top; inward-facing surfaces must use front-face culling, or the top must be hidden in overview.',
    'Sky material should be unlit, fog=false; preserve existing scene fog and lights.'
  ],
  passed:true,
};
await writeFile(new URL('./sky-bounds-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
