import {readFile,writeFile} from 'node:fs/promises';
import {Matrix4,Vector3,Quaternion} from 'three';
const state=JSON.parse(await readFile(new URL('./four-pickup-placement-snapshot.json',import.meta.url),'utf8'));
const glb=await readFile(new URL('../public/assets/Tree_01.glb',import.meta.url));
const len=glb.readUInt32LE(12),gltf=JSON.parse(glb.subarray(20,20+len).toString());
const binary=glb.subarray(28+len);let treeRadius=0;
const visit=(idx,parent=new Matrix4())=>{
 const n=gltf.nodes[idx],m=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3(...(n.translation??[0,0,0])),new Quaternion(...(n.rotation??[0,0,0,1])),new Vector3(...(n.scale??[1,1,1]))); m.premultiply(parent);
 if(n.mesh!=null)for(const p of gltf.meshes[n.mesh].primitives){const a=gltf.accessors[p.attributes.POSITION],v=gltf.bufferViews[a.bufferView];for(let i=0;i<a.count;i++){const off=(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??12),vec=new Vector3(binary.readFloatLE(off),binary.readFloatLE(off+4),binary.readFloatLE(off+8)).applyMatrix4(m);treeRadius=Math.max(treeRadius,Math.hypot(vec.x,vec.z));}}
 for(const c of n.children??[])visit(c,m);
};for(const i of gltf.scenes[gltf.scene??0].nodes)visit(i);
const colliders=state.colliders;
const clearance=(p,c,canopy=false)=>c.kind==='circle'?Math.hypot(p.x-c.x,p.z-c.z)-(canopy&&c.label==='树干'?treeRadius*c.radius/.48:c.radius):Math.hypot(Math.max(0,Math.abs(p.x-c.x)-c.halfX),Math.max(0,Math.abs(p.z-c.z)-c.halfZ));
const nearest=p=>colliders.map(c=>({...c,distance:clearance(p,c),canopyDistance:clearance(p,c,true)})).sort((a,b)=>a.canopyDistance-b.canopyDistance).slice(0,5);
// Fourth marker is nudged 0.2 m west of the initial map estimate for extra canopy margin.
const inputs=[{x:20.4,z:-46},{x:24.5,z:-20},{x:26.6,z:9},{x:60,z:3}];
const plan=inputs.map(p=>{const candidates=[];for(let x=p.x-3;x<=p.x+3;x+=.1)for(let z=p.z-3;z<=p.z+3;z+=.1){const q={x:+x.toFixed(1),z:+z.toFixed(1)},gap=Math.min(...colliders.map(c=>clearance(q,c,true)))-.41;if(gap>=1)candidates.push({...q,gap,offset:Math.hypot(q.x-p.x,q.z-p.z)});}candidates.sort((a,b)=>a.offset-b.offset||b.gap-a.gap);const best=candidates[0];return {requested:p,requestedNearest:nearest(p),final:best,nearest:best&&nearest(best)};});
console.log(JSON.stringify({treeRadius,plan},null,2));
await writeFile(new URL('./four-pickup-placement-plan.json',import.meta.url),JSON.stringify({treeRadius,plan,colliders},null,2));
