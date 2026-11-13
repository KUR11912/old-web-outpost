import * as THREE from 'three';
import { MAP, type MapPoint } from './map-config';
import type { Collider, AssetEntry } from './world';
import { applyMountainFaults } from './mountain-faults';

const simple = (color:THREE.ColorRepresentation) => new THREE.MeshLambertMaterial({color,flatShading:true});
function rng(seed:number) { return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}; }
function texture(draw:(c:CanvasRenderingContext2D)=>void,w=128,h=128) {
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const c=canvas.getContext('2d');if(!c)throw new Error('无法绘制地图纹理');draw(c);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;return t;
}
function cube(parent:THREE.Object3D,s:number[],p:number[],m:THREE.Material) {
  const o=new THREE.Mesh(new THREE.BoxGeometry(...s as [number,number,number]),m);o.position.set(...p as [number,number,number]);o.castShadow=o.receiveShadow=true;parent.add(o);return o;
}
function boxes(parent:THREE.Object3D,items:{p:number[];s:number[]}[],mat:THREE.Material,name:string) {
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat,items.length);mesh.name=name;
  const dummy=new THREE.Object3D();items.forEach(({p,s},i)=>{dummy.position.set(...p as [number,number,number]);dummy.scale.set(...s as [number,number,number]);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
  mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingSphere();parent.add(mesh);return mesh;
}
function sign(scene:THREE.Scene,name:string,subtitle:string,x:number,y:number,z:number,w=3.5,h=.8) {
  const map=texture(c=>{c.fillStyle='#244a67';c.fillRect(0,0,512,128);c.strokeStyle='#d7d4b5';c.lineWidth=5;c.strokeRect(6,6,500,116);c.textAlign='center';c.fillStyle='#faf1d3';c.font='bold 47px "Microsoft YaHei",sans-serif';c.fillText(name,256,60);c.font='20px "Microsoft YaHei",sans-serif';c.fillText(subtitle,256,101);},512,128);
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}));panel.position.set(x,y,z);scene.add(panel);return panel;
}

export function makeExpandedTerrain(scene:THREE.Scene) {
  const b=MAP.bounds,r=MAP.river,random=rng(MAP.preserved.seed);
  const grass=texture(c=>{c.fillStyle='#79a64a';c.fillRect(0,0,128,128);for(let i=0;i<2900;i++){c.fillStyle=['#719b43','#82ad50','#7da74a','#8bb45a','#729c45'][Math.floor(random()*5)];c.fillRect(Math.floor(random()*128),Math.floor(random()*128),1+Math.floor(random()*4),1+Math.floor(random()*3));}});
  for(const [left,right,label] of [[b.minX,r.minX,'West'],[r.maxX,b.maxX,'East']] as const) {
    const t=grass.clone();t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set((right-left)*12/28,(b.maxZ-b.minZ)*12/28);t.offset.set((left+14)*12/28,(14-b.maxZ)*12/28);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(right-left,b.maxZ-b.minZ),new THREE.MeshLambertMaterial({map:t}));mesh.rotation.x=-Math.PI/2;mesh.position.set((left+right)/2,0,(b.minZ+b.maxZ)/2);mesh.name=`Ground_${label}_bank`;mesh.receiveShadow=true;scene.add(mesh);
  }
  const waterMap=texture(c=>{c.fillStyle='#4b9cbb';c.fillRect(0,0,128,128);for(let i=0;i<80;i++){c.fillStyle=i%3?'#67b0c7':'#7fbfd0';c.fillRect(random()*128,random()*128,3+random()*15,1);}});
  waterMap.wrapS=waterMap.wrapT=THREE.RepeatWrapping;waterMap.repeat.set(2,24);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(r.maxX-r.minX,r.maxZ-r.minZ),new THREE.MeshLambertMaterial({map:waterMap}));water.name='River_water_nonwalkable';water.rotation.x=-Math.PI/2;water.position.set((r.minX+r.maxX)/2,r.waterY,(r.minZ+r.maxZ)/2);scene.add(water);
  const bank=simple('#a4a181');for(const x of [r.minX-.08,r.maxX+.08])cube(scene,[.16,.34,r.maxZ-r.minZ],[x,-.17,(r.minZ+r.maxZ)/2],bank);
  const horizon=new THREE.Mesh(new THREE.PlaneGeometry(260,240),simple('#7fa956'));horizon.rotation.x=-Math.PI/2;horizon.position.set(26,-.4,-21);scene.add(horizon);
  // Peripheral mountain geometry is deliberately outside the playable rectangle.
  const mountainPositions:{x:number;z:number;radius:number;height:number}[]=[];
  for(let x=b.minX-8;x<=b.maxX+8;x+=11)for(const z of [b.minZ-9,b.maxZ+10])mountainPositions.push({x,z,radius:8+random()*3,height:8+random()*7});
  for(let z=b.minZ+4;z<b.maxZ;z+=12)for(const x of [b.minX-10,b.maxX+10])mountainPositions.push({x,z,radius:9+random()*2,height:9+random()*6});
  const peaks=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,6),simple('#80a78a'),mountainPositions.length);const d=new THREE.Object3D();
  mountainPositions.forEach((p,i)=>{d.position.set(p.x,p.height/2-.4,p.z);d.scale.set(p.radius,p.height,p.radius);d.rotation.y=random()*Math.PI;d.updateMatrix();peaks.setMatrixAt(i,d.matrix);});peaks.computeBoundingSphere();peaks.name='Peripheral_mountains';scene.add(peaks);
  applyMountainFaults(peaks);
  const fenceItems:{p:number[];s:number[]}[]=[];
  for(let x=b.minX;x<=b.maxX;x+=2)for(const z of [b.minZ,b.maxZ])if(x<r.minX||x>r.maxX)fenceItems.push({p:[x,.39,z],s:[.13,.78,.13]});
  for(let z=b.minZ;z<=b.maxZ;z+=2)for(const x of [b.minX,b.maxX])fenceItems.push({p:[x,.39,z],s:[.13,.78,.13]});
  for(const z of [b.minZ,b.maxZ])for(const [left,right] of [[b.minX,r.minX],[r.maxX,b.maxX]])fenceItems.push({p:[(left+right)/2,.55,z],s:[right-left,.12,.08]});
  for(const x of [b.minX,b.maxX])fenceItems.push({p:[x,.55,(b.minZ+b.maxZ)/2],s:[.08,.12,b.maxZ-b.minZ]});
  boxes(scene,fenceItems,simple('#b8ae83'),'Expanded_boundary_fence');
}

export function addMapStructures(scene:THREE.Scene,colliders:Collider[],archiveModel:THREE.Group,lighthouseModel:THREE.Group,bridgeModel:THREE.Group) {
  const river=MAP.river,bridge=MAP.bridge,archive=MAP.locations.archive,tower=MAP.locations.lighthouse;
  const openingHalf=bridge.width/2-.20;
  for(const [minZ,maxZ] of [[river.minZ,bridge.z-openingHalf],[bridge.z+openingHalf,river.maxZ]])
    colliders.push({kind:'box',x:(river.minX+river.maxX)/2,z:(minZ+maxZ)/2,halfX:(river.maxX-river.minX)/2,halfZ:(maxZ-minZ)/2,label:'河流 · 只能从桥上通过'});
  // Authored bottom-centre origin; the flat top stays flush with both stone roads.
  const arcade=bridge.arcade;
  bridgeModel.name='ArcadeBridge_scene_loaded';
  bridgeModel.position.set(bridge.x,bridge.deckTop-arcade.deckThickness,bridge.z);
  scene.add(bridgeModel);
  // Keep the uninterrupted flat walking corridor. Only low edges and individual
  // column bases obstruct horizontal movement; overhead arches are not ground boxes.
  for(const side of [-1,1]) {
    colliders.push({kind:'box',x:bridge.x,z:bridge.z+side*(bridge.width/2-arcade.curbWidth/2),halfX:bridge.length/2,halfZ:arcade.curbWidth/2,label:'拱廊桥石缘'});
    for(const dx of arcade.columnOffsetsX) {
      colliders.push({kind:'box',x:bridge.x+dx,z:bridge.z+side*arcade.columnZ,halfX:arcade.columnHalfWidth,halfZ:arcade.columnHalfWidth,label:'拱廊桥石柱'});
    }
  }
  if(!bridge.crossingOpen)colliders.push({kind:'box',x:bridge.x,z:bridge.z,halfX:.2,halfZ:bridge.width/2,label:'断链桥 · 待解锁'});
  const {x:ax,z:az}=archive.position;
  // Blender source: bottom-centre origin, metre scale, glTF front +Z.
  // The canopy is above the player's head; only the body/base obstruct walking.
  archiveModel.name='Archive_scene_loaded';
  archiveModel.position.set(ax,0,az);
  scene.add(archiveModel);
  // Include the shallow window trim and door handles, excluding overhead signage.
  colliders.push({kind:'box',x:ax,z:az,halfX:archive.size.width/2+.10,halfZ:archive.size.depth/2+.13,label:'回声档案馆外墙'});
  const {x:tx,z:tz}=tower.position;
  const lighthouse=MAP.lighthouse;
  lighthouseModel.name='Lighthouse_scene_loaded';
  lighthouseModel.position.set(tx,0,tz);
  scene.add(lighthouseModel);
  const plaque=sign(scene,tower.name,'后续任务',tx,lighthouse.sign.y,tz+lighthouse.sign.z,lighthouse.sign.width,lighthouse.sign.height);
  plaque.name='Lighthouse_editable_nameplate';
  // Ground-only obstacles: the open spiral, balcony and lantern remain overhead.
  colliders.push({kind:'circle',x:tx,z:tz,radius:lighthouse.baseRadius,label:'记忆灯塔基座'});
  colliders.push({kind:'box',x:tx,z:tz+lighthouse.hut.z,halfX:lighthouse.hut.width/2+.06,halfZ:lighthouse.hut.depth/2+.06,label:'记忆灯塔门房'});
  // Signposts remain beside the route rather than in the walking corridor.
  for(const [x,z,title,sub] of [[10.7,-5.3,'↑ 回声档案馆','向北沿石板路'],[16.3,-10.4,'断链桥 →','过桥前往记忆灯塔'],[47.4,-10.4,'↑ 记忆灯塔','桥梁走测开放']] as const){cube(scene,[.12,1.7,.12],[x,.85,z],simple('#75684c'));sign(scene,title,sub,x,1.65,z+.08,2.4,.64);colliders.push({kind:'circle',x,z,radius:.14,label:'路标柱'});}
  sign(scene,'断链桥','拱廊通行 · 后续接入解锁',bridge.x,1.45,bridge.z-bridge.width/2-.12,2.1,.5);
}

type Placement={x:number;z:number;y?:number;sx?:number;sy?:number;sz?:number;rotation?:number};
function batch(scene:THREE.Scene,template:THREE.Group,placements:Placement[],name:string) {
  if(!placements.length)return;
  template.updateMatrixWorld(true);const transform=new THREE.Object3D(),matrix=new THREE.Matrix4();
  template.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    const instances=new THREE.InstancedMesh(o.geometry,o.material,placements.length);instances.name=name;
    placements.forEach((p,i)=>{transform.position.set(p.x,p.y??0,p.z);transform.scale.set(p.sx??1,p.sy??p.sx??1,p.sz??p.sx??1);transform.rotation.set(0,p.rotation??0,0);transform.updateMatrix();matrix.multiplyMatrices(transform.matrix,o.matrixWorld);instances.setMatrixAt(i,matrix);});
    instances.castShadow=name!=='Grass_extension';instances.receiveShadow=true;instances.computeBoundingSphere();scene.add(instances);
  });
}
function distanceToSegment(p:MapPoint,a:MapPoint,b:MapPoint) {const dx=b.x-a.x,dz=b.z-a.z;const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);}
const key=(p:MapPoint)=>`${p.x.toFixed(3)}:${p.z.toFixed(3)}`;

export function addMapAssetInstances(scene:THREE.Scene,models:Map<string,THREE.Group>,reports:AssetEntry[],colliders:Collider[]) {
  const roads=MAP.roads,allPoints=roads.flatMap(r=>r.points),tilePoses:Placement[]=[];
  const deckEnds=[{x:MAP.bridge.x-MAP.bridge.length/2,z:MAP.bridge.z},{x:MAP.bridge.x+MAP.bridge.length/2,z:MAP.bridge.z}];
  const hasJoint=(p:MapPoint)=>!deckEnds.some(q=>key(q)===key(p));
  const joints=new Map<string,MapPoint>();allPoints.filter(hasJoint).forEach(p=>joints.set(key(p),p));
  for(const p of joints.values())if(!(p.x===2&&p.z===-2))tilePoses.push({x:p.x,z:p.z,y:-.1,sy:1});
  for(const road of roads)for(let i=1;i<road.points.length;i++){
    const a=road.points[i-1],b=road.points[i],length=Math.hypot(b.x-a.x,b.z-a.z),ux=(b.x-a.x)/length,uz=(b.z-a.z)/length;
    const splits=[a,...allPoints.filter(p=>key(p)!==key(a)&&key(p)!==key(b)&&distanceToSegment(p,a,b)<.001),b].sort((p,q)=>(p.x-a.x)*ux+(p.z-a.z)*uz-((q.x-a.x)*ux+(q.z-a.z)*uz));
    for(let j=1;j<splits.length;j++){
      const from=splits[j-1],to=splits[j];const start=hasJoint(from)?road.width/2:0,end=hasJoint(to)?road.width/2:0;const length=Math.hypot(to.x-from.x,to.z-from.z)-start-end;if(length<=0)continue;
      const count=Math.ceil(length/2),piece=length/count;
      for(let k=0;k<count;k++){const d=start+(k+.5)*piece;tilePoses.push({x:from.x+ux*d,z:from.z+uz*d,y:-.1,sx:ux?piece/2:road.width/2,sy:1,sz:uz?piece/2:road.width/2});}
    }
  }
  batch(scene,models.get('PathTile_01')!,tilePoses,'Road_extension');reports.find(r=>r.name==='PathTile_01')!.instances+=tilePoses.length;
  const random=rng(MAP.seed),b=MAP.bounds;
  const roadDistance=(p:MapPoint)=>Math.min(...roads.flatMap(r=>r.points.slice(1).map((q,i)=>distanceToSegment(p,r.points[i],q))));
  const valid=(p:MapPoint,clearance:number)=>{
    const old=MAP.preserved.bounds;
    if(p.x>=old.minX-1&&p.x<=old.maxX+1&&p.z>=old.minZ-1&&p.z<=old.maxZ+1)return false;
    if(p.x>=MAP.river.minX-2.5&&p.x<=MAP.river.maxX+2.5)return false;
    if(roadDistance(p)<clearance)return false;
    if(Object.values(MAP.locations).some(s=>Math.hypot(p.x-s.position.x,p.z-s.position.z)<(s.id==='bridge'?8:7.6)))return false;
    return !colliders.some(c=>Math.hypot(p.x-c.x,p.z-c.z)<2);
  };
  const treePoses:Placement[]=[];
  for(let i=0;i<380&&treePoses.length<72;i++){const p={x:b.minX+2+random()*(b.maxX-b.minX-4),z:b.minZ+2+random()*(b.maxZ-b.minZ-4)};if(!valid(p,3.2)||treePoses.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<3))continue;const s=.8+random()*.35;treePoses.push({...p,sx:s,rotation:random()*Math.PI*2});colliders.push({kind:'circle',...p,radius:.48*s,label:'树干'});}
  const grassPoses:Placement[]=[];
  for(let i=0;i<750&&grassPoses.length<260;i++){const p={x:b.minX+1+random()*(b.maxX-b.minX-2),z:b.minZ+1+random()*(b.maxZ-b.minZ-2)};if(valid(p,1.6))grassPoses.push({...p,sx:.65+random()*.55,rotation:random()*Math.PI*2});}
  const rocks:Placement[]=[];
  for(let i=0;i<120&&rocks.length<14;i++){const p={x:b.minX+2+random()*(b.maxX-b.minX-4),z:b.minZ+2+random()*(b.maxZ-b.minZ-4)};if(!valid(p,3.4))continue;const s=.9+random()*.6;rocks.push({...p,sx:s,rotation:random()*6.28});colliders.push({kind:'circle',...p,radius:.7*s,label:'石头'});}
  for(const [asset,placements,name] of [['Tree_01',treePoses,'Tree_extension'],['Grass_01',grassPoses,'Grass_extension'],['Rock_01',rocks,'Rock_extension']] as const){batch(scene,models.get(asset)!,placements,name);reports.find(r=>r.name===asset)!.instances+=placements.length;}
}
