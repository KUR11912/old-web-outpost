import * as THREE from 'three';
import './style.css';
import { createWorld } from './world';
import { PlayerController } from './player';
import { loadSave, saveGame, resetSave, CLUE_ID, createDefaultSave, collectPickup } from './save';
import { MAP, currentRegion } from './map-config';
import { createInvestigationUI } from './investigation-ui';
import { CLUE_ORDER, hasAllClues } from './archive-data';
import type { SceneInteractable } from './archive-scene';
import { getPickupContent, extraPickupEntries, PICKUP_STYLE } from './pickup-data';
import { updatePickupObjects } from './pickups';
import { SKY_ENCLOSURE } from './sky-config';

const $ = <T extends HTMLElement = HTMLElement>(id:string) => document.getElementById(id) as T;
$('app').innerHTML = `
  <header class="titlebar"><div class="brand"><span class="brand-icon">▧</span> 旧网驿站 <span class="build-tag">OLD WEB OUTPOST</span></div><span class="build-tag">NETWORK MEMORY / PROTOTYPE 01</span></header>
  <nav class="menubar"><span>网络梗考古 <span class="caption">／ 一处还没断开连接的地方</span></span><div class="toolbuttons"><button id="map-button" disabled>全图 [M]</button><button id="bag-button" disabled>线索背包 [B]</button><button id="reset-button" disabled>重置测试进度</button></div></nav>
  <main id="viewport"><canvas id="game-canvas" tabindex="0" aria-label="旧网驿站三维场景，WASD 移动，鼠标转头，E 调查邮箱"></canvas>
    <section class="mission"><span class="eyebrow">FIELD NOTE / 003</span><span class="check" id="quest-count">0 / 4</span><h1 id="quest-title">寻找漂浮文件夹</h1><p id="quest-text">沿石板路走向驿站，靠近邮箱前的黄色文件夹，自动拾取老梗。</p></section>
    <div class="coordinate"><span id="region-name">旧网驿站 · 晴</span><span id="coordinates">84 × 74 M</span></div>
    <div id="map-labels" hidden>${Object.values(MAP.locations).map(site=>`<div class="map-site" data-map-site="${site.id}"><small>${site.tag}</small><strong>${site.name}</strong><span>${site.note}</span></div>`).join('')}<div class="map-direction">N ↑<br><small>北</small></div><div class="map-legend">遗址全图 · 84 × 74 米<br><span>档案馆可调查 · 桥梁开放 · 灯塔任务待开放</span><br><span>按 M 返回，点击场景继续探索</span></div></div>
    <div id="crosshair" hidden></div><div id="interaction" hidden><kbd>E</kbd> 调查邮箱</div>
    <section id="pause-panel" hidden><h2 id="pause-title">欢迎来到旧网驿站</h2><p id="pause-copy">邮箱前漂浮着一个黄色文件夹。<br>靠近即可拾取老梗，再去档案馆寻找它的含义与语境。</p><div class="enter-actions"><button id="enter-lock" class="primary">点击开始探索</button><button id="enter-drag">拖拽模式进入</button></div><p class="note" style="margin-bottom:0">WASD 行走 · 鼠标转头 · 靠近文件夹自动拾取 · Esc 释放鼠标</p></section>
    <div id="loading" role="status"><h2>连接旧网驿站…</h2><progress max="10" value="0"></progress><p id="load-text">正在读取本地环境资产</p></div>
    <div id="toast" role="status" hidden></div>
  </main>
  <div class="instructions"><kbd>W A S D</kbd> 移动　 <kbd>鼠标</kbd> 转头　 <kbd>E</kbd> 调查　 <kbd>B</kbd> 背包　 <kbd>M</kbd> 全图　 <kbd>Esc</kbd> 暂停 / 关闭窗口</div>
  <footer class="statusbar"><div id="status" aria-live="polite">正在准备场景…</div><div id="asset-status">资源 0 / 10</div><div id="save-status">本地自动存档</div></footer>
  <dialog id="modal" aria-labelledby="modal-title"><header class="dialog-title"><span id="modal-title"></span><button id="modal-close" aria-label="关闭窗口">×</button></header><div id="modal-body" class="dialog-body"></div><div id="modal-actions" class="dialog-actions"></div></dialog>`;

const canvas = $<HTMLCanvasElement>('game-canvas');
const modal = $<HTMLDialogElement>('modal');
const save = loadSave();
let controller:PlayerController;
let world:Awaited<ReturnType<typeof createWorld>>;
let ready=false, canInvestigate=false, firstEntry=true, toastTimer=0, lastSave=0, dirty=false;
let modalKind='';
let target:SceneInteractable|null=null;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(67,1,.08,SKY_ENCLOSURE.cameraFar);
camera.position.set(0,1.65,9);
const mapCamera = new THREE.OrthographicCamera(-50,50,50,-50,.1,300);
const mapCenter = new THREE.Vector3((MAP.bounds.minX+MAP.bounds.maxX)/2,0,(MAP.bounds.minZ+MAP.bounds.maxZ)/2);
mapCamera.position.set(mapCenter.x,110,mapCenter.z);mapCamera.up.set(0,0,-1);mapCamera.lookAt(mapCenter);
let mapOpen=false, walkingFog:THREE.Fog|null=null;
let renderer:THREE.WebGLRenderer;

function toast(message:string) { clearTimeout(toastTimer); $('toast').textContent=message; $('toast').hidden=false; toastTimer=window.setTimeout(()=>$('toast').hidden=true,3800); }
function persist() { if(controller) save.pose=controller.getPose(); const ok=saveGame(save); $('save-status').textContent=ok?'进度已保存':'存储不可用 · 本次进度仅在内存'; dirty=false; }
function refreshQuest() {
  const found=save.clues.includes(CLUE_ID),count=CLUE_ORDER.filter(id=>save.clues.includes(id)).length;
  $('quest-count').textContent=save.archive.completed?'已完成':`${count} / 4`;
  $('quest-title').textContent=save.archive.completed?'前往断链桥':!found?'寻找漂浮文件夹':hasAllClues(save.clues)?'整理四张线索':'调查回声档案馆';
  $('quest-text').textContent=save.archive.completed?'档案馆调查已完成。沿石板路向南，再向东前往断链桥。本轮桥梁保持开放。':!found?'靠近驿站红色邮箱前的黄色文件夹，自动获得“蓝瘦香菇”。邮箱中仍可阅读留言。':hasAllClues(save.clues)?'资料收齐了。调查档案馆门前的“整理线索”桌，完成含义与语境两个判断。':'已收藏老梗。沿石板路向北到档案馆，调查三个终端并记录资料，找回含义与使用语境。按 B 回看。';
  $('bag-button').textContent=`线索背包 [B] · ${count+extraPickupEntries(save.pickupInventory,CLUE_ORDER).length}`;
}
function setOverview(open:boolean) {
  if(!ready||modal.open)return;
  if(open)controller.pause();
  mapOpen=open;scene.fog=open?null:walkingFog;
  world.sky.group.visible=!open;
  $('map-labels').hidden=!open;$('viewport').classList.toggle('overview',open);
  $('map-button').textContent=open?'返回探索 [M]':'全图 [M]';
  $('pause-panel').hidden=open;$('crosshair').hidden=true;$('interaction').hidden=true;
  if(open)$('status').textContent='俯视全图 · 已暂停移动 · 桥梁在本轮开放';
  else{$('pause-title').textContent='地图已收起';$('pause-copy').textContent='点击场景或下方按钮，回到原位置继续探索。';$('status').textContent='已暂停 · 点击继续探索';}
}
function closeModal() { modal.close(); modalKind=''; $('pause-panel').hidden=false; $('pause-title').textContent='已暂停探索'; $('pause-copy').textContent='窗口已关闭。点击下方按钮或场景，继续行走。'; }
function showModal(title:string,body:string,actions:{text:string;id?:string;action:()=>void}[]) {
  controller.pause(); canInvestigate=false; $('interaction').hidden=true; $('pause-panel').hidden=true;
  $('modal-title').textContent=title; $('modal-body').innerHTML=body; $('modal-body').scrollTop=0; $('modal-actions').replaceChildren();
  for(const item of actions) { const b=document.createElement('button'); b.textContent=item.text; if(item.id)b.id=item.id; b.addEventListener('click',item.action); $('modal-actions').appendChild(b); }
  if(!modal.open)modal.showModal(); $('modal-close').focus();
}
const investigationUI=createInvestigationUI({save,persist,refresh:refreshQuest,toast,close:closeModal,
  open:(title,body,actions,kind)=>{modalKind=kind;showModal(title,body,actions);},
});
function showBag() { if(mapOpen)setOverview(false); investigationUI.showBag(); }
function investigate() {
  if(!canInvestigate||!target||modal.open||!controller.active)return;
  investigationUI.showStation(target.id);
}
function showReset() { if(mapOpen)setOverview(false); modalKind='reset'; showModal('重置测试进度',`<h2>重新从驿站入口出发？</h2><p>这会清空本原型的老梗收藏、调查记录和线索背包，恢复文件夹与出生位置。</p><p class="note">仅影响“旧网驿站”的独立存档。</p>`,[{text:'取消',action:closeModal},{text:'确认重置',id:'confirm-reset',action:()=>{const ok=resetSave(); Object.assign(save,createDefaultSave()); controller.setPose(save.pose.x,save.pose.z,save.pose.yaw,save.pose.pitch); refreshQuest(); if(ok)persist(); else $('save-status').textContent='存储不可用 · 无法清除旧进度'; closeModal(); toast(ok?'测试进度已重置':'本次进度已重置；浏览器存储不可用');}}]); }
function activate(mode:'locked'|'drag') { if(!ready||modal.open||mapOpen)return; firstEntry=false; controller.activate(mode); }
$('enter-lock').addEventListener('click',()=>activate('locked'));
$('enter-drag').addEventListener('click',()=>activate('drag'));
canvas.addEventListener('click',()=>{if(!controller?.active)activate(controller?.mode??'locked');});
$('bag-button').addEventListener('click',showBag); $('reset-button').addEventListener('click',showReset);
$('map-button').addEventListener('click',()=>setOverview(!mapOpen));
$('modal-close').addEventListener('click',closeModal);
modal.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
document.addEventListener('keydown',e=>{ if(!ready||e.repeat)return; if(e.code==='KeyM'&&!modal.open){e.preventDefault();setOverview(!mapOpen);} if(e.code==='Escape'&&mapOpen){e.preventDefault();setOverview(false);} if(e.code==='KeyB'){e.preventDefault();if(modal.open){if(modalKind==='bag')closeModal();}else showBag();} if(e.code==='KeyE'){e.preventDefault();investigate();} });
window.addEventListener('pagehide',()=>{if(ready)persist();});

function failure(error:unknown) { console.error(error); $('loading').hidden=false; $('loading').classList.add('error'); $('loading').innerHTML='<h2>驿站暂时没有连接上</h2><p></p><button id="retry-load">重新加载</button>'; $('loading').querySelector('p')!.textContent=error instanceof Error?error.message:String(error); $('retry-load').onclick=()=>location.reload(); $('status').textContent='资源加载失败，请检查服务和 assets 文件夹'; }
function bridgeSnapshot() {
  const bridge=MAP.bridge;
  world.bridge.updateWorldMatrix(true,true);
  const bounds=new THREE.Box3().setFromObject(world.bridge);
  const nodeNames:string[]=[];world.bridge.traverse(object=>nodeNames.push(object.name));
  return {
    model:bridge.arcade.model,position:world.bridge.position.toArray(),
    worldBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},nodeNames,
    deckTop:bridge.deckTop,traversableGroundY:MAP.groundY,waterY:MAP.river.waterY,
    walkableSurface:{minX:bridge.x-bridge.length/2,maxX:bridge.x+bridge.length/2,minZ:bridge.z-bridge.width/2,maxZ:bridge.z+bridge.width/2},
    clearWidth:bridge.arcade.columnZ*2-bridge.arcade.columnHalfWidth*2,
    springHeight:bridge.arcade.springHeight,archHeight:bridge.arcade.archHeight,
    columnColliders:world.colliders.filter(c=>c.label==='拱廊桥石柱').map(c=>({...c})),
    edgeColliders:world.colliders.filter(c=>c.label==='拱廊桥石缘').map(c=>({...c})),
    oldObjectsPresent:['Bridge_flush_walkable_deck','Bridge_railings'].filter(name=>!!scene.getObjectByName(name)),
  };
}
async function start() {
  try {
    renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.NoToneMapping; renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFShadowMap;
    world=await createWorld(scene,(n,total,name)=>{ $('load-text').textContent=`读取 ${name} · ${n} / ${total}`; const progress=$('loading').querySelector('progress')!; progress.max=total; progress.value=n; $('asset-status').textContent=`资源 ${n} / ${total}`; });
    walkingFog=scene.fog as THREE.Fog|null;
    controller=new PlayerController(camera,canvas,world.colliders,world.bounds,s=>{
      $('status').textContent=s.message; $('pause-panel').hidden=s.active||modal.open||mapOpen; $('crosshair').hidden=!s.active||mapOpen;
      if(!s.active){canInvestigate=false; $('interaction').hidden=true; if(!firstEntry){$('pause-title').textContent='探索已暂停';$('pause-copy').textContent='点击场景或下方按钮继续。拖拽模式下，按住鼠标左键转头。';} if(ready)persist();}
    },()=>{dirty=true;});
    controller.setPose(save.pose.x,save.pose.z,save.pose.yaw,save.pose.pitch);
    updatePickupObjects(world.pickups,0,save.collectedPickups);
    ready=true; refreshQuest(); $('loading').hidden=true; $('pause-panel').hidden=false; $('bag-button').removeAttribute('disabled'); $('reset-button').removeAttribute('disabled'); $('map-button').removeAttribute('disabled'); $('status').textContent='准备就绪 · 选择一种操作方式进入';
    if(save.updatedAt>0){$('pause-title').textContent='欢迎回到旧网驿站';$('pause-copy').textContent='已恢复上次的位置和线索记录。选择一种操作方式继续探索。';}
    const resize=()=>{const r=$('viewport').getBoundingClientRect(); camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);const halfH=Math.max((MAP.bounds.maxZ-MAP.bounds.minZ+14)/2,(MAP.bounds.maxX-MAP.bounds.minX+14)/2/camera.aspect);mapCamera.left=-halfH*camera.aspect;mapCamera.right=halfH*camera.aspect;mapCamera.top=halfH;mapCamera.bottom=-halfH;mapCamera.updateProjectionMatrix();};
    new ResizeObserver(resize).observe($('viewport')); resize();
    const ray=new THREE.Raycaster();ray.far=2.8;let previous=performance.now();const animationStart=previous;
    const visibleTarget=(item:SceneInteractable,hit:THREE.Vector3)=>{
      // Horizontal solids block inspection through walls or another station.
      const length=Math.hypot(hit.x-camera.position.x,hit.z-camera.position.z);
      const n=Math.max(1,Math.ceil(length/.12));
      for(let i=1;i<n;i++){
        const x=camera.position.x+(hit.x-camera.position.x)*i/n,z=camera.position.z+(hit.z-camera.position.z)*i/n;
        if(world.colliders.some(c=>{
          if(c.label===item.name||(item.id==='mailbox'&&c.label==='邮箱'))return false;
          return c.kind==='circle'?Math.hypot(x-c.x,z-c.z)<(c.radius??0):Math.abs(x-c.x)<(c.halfX??0)&&Math.abs(z-c.z)<(c.halfZ??0);
        }))return false;
      }
      return true;
    };
    function frame(now:number) {
      const dt=Math.min((now-previous)/1000,.05);previous=now; controller.update(dt);
      const elapsed=(now-animationStart)/1000;
      updatePickupObjects(world.pickups,elapsed,save.collectedPickups);
      if(controller.active&&!modal.open&&!mapOpen){
        for(const pickup of world.pickups){
          if(!pickup.object.visible||Math.hypot(camera.position.x-pickup.basePosition.x,camera.position.z-pickup.basePosition.z)>PICKUP_STYLE.pickupRadius)continue;
          if(collectPickup(save,pickup.definition.id)){
            updatePickupObjects(world.pickups,elapsed,save.collectedPickups);
            refreshQuest();persist();toast(`已获得老梗：${getPickupContent(pickup.definition).name}`);
          }
        }
      }
      canInvestigate=false;target=null;
      if(controller.active&&!modal.open&&!mapOpen){
        ray.setFromCamera(new THREE.Vector2(0,0),camera);
        let nearest=2.8;
        for(const item of world.interactables){const hit=ray.intersectObject(item.object,true)[0];if(hit&&hit.distance<=nearest&&visibleTarget(item,hit.point)){target=item;nearest=hit.distance;}}
        canInvestigate=!!target;
      }
      $('interaction').hidden=!canInvestigate;$('interaction').innerHTML=`<kbd>E</kbd> ${target?.id==='archive-desk'?'整理线索':`调查${target?.name??''}`}`; $('crosshair').classList.toggle('hot',canInvestigate);
      $('coordinates').textContent=`X ${camera.position.x.toFixed(1)} / Z ${camera.position.z.toFixed(1)}`;
      $('region-name').textContent=mapOpen?'遗址全图 · 北 ↑':currentRegion(camera.position.x,camera.position.z)+' · 晴';
      if(mapOpen){const area=$('viewport');for(const site of Object.values(MAP.locations)){const projected=new THREE.Vector3(site.position.x,0,site.position.z+4).project(mapCamera);const label=area.querySelector<HTMLElement>(`[data-map-site="${site.id}"]`)!;label.style.left=`${(projected.x+1)*.5*area.clientWidth}px`;label.style.top=`${(1-projected.y)*.5*area.clientHeight}px`;}}
      if(dirty&&now-lastSave>1500){persist();lastSave=now;}
      renderer.render(scene,mapOpen?mapCamera:camera); requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    Object.defineProperty(window,'__OUTPOST_DEBUG__',{value:{snapshot:()=>({ready,pose:controller.getPose(),eyeY:camera.position.y,camera:{near:camera.near,far:camera.far},sky:{...world.sky.report,visible:world.sky.group.visible,position:world.sky.group.position.toArray()},mapOpen,map:MAP,active:controller.active,mode:controller.mode,canInvestigate,targetId:target?.id??null,investigated:save.investigated,clues:[...save.clues],memes:[...save.memes],collectedPickups:[...save.collectedPickups],pickupInventory:[...save.pickupInventory],pickupStyle:{...PICKUP_STYLE},bridge:bridgeSnapshot(),pickups:world.pickups.map(({definition,object,basePosition})=>({id:definition.id,memeId:definition.memeId,name:getPickupContent(definition).name,marker:definition.marker,location:definition.location,visible:object.visible,position:{x:object.position.x,y:object.position.y,z:object.position.z},rotationY:object.rotation.y,basePosition:{...basePosition}})),archive:structuredClone(save.archive),interactables:world.interactables.map(({id,name,aim,approach,object})=>({id,name,aim,approach,modelNames:object.children.map(child=>child.name)})),assets:world.assetReport,colliders:world.colliders.map(c=>({...c})),modal:modal.open}),bridgeProbe:(origin:{x:number;y:number;z:number},direction:{x:number;y:number;z:number})=>{
      world.bridge.updateWorldMatrix(true,true);
      const probe=new THREE.Raycaster(new THREE.Vector3(origin.x,origin.y,origin.z),new THREE.Vector3(direction.x,direction.y,direction.z).normalize(),0,camera.far);
      const hit=probe.intersectObject(world.bridge,true)[0];
      return hit?{node:hit.object.name,distance:hit.distance,point:hit.point.toArray()}:null;
    },skyProbe:(origin:{x:number;y:number;z:number},direction:{x:number;y:number;z:number})=>{
      const originVector=new THREE.Vector3(origin.x,origin.y,origin.z),directionVector=new THREE.Vector3(direction.x,direction.y,direction.z).normalize();
      world.sky.group.updateWorldMatrix(true,true);
      const probe=new THREE.Raycaster(originVector,directionVector,0,camera.far);
      const hit=probe.intersectObject(world.sky.group,true)[0];
      return hit?{face:hit.object.name,distance:hit.distance,point:hit.point.toArray(),uv:hit.uv?.toArray()}:null;
    },rendererInfo:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles})},writable:false});
  }catch(error){failure(error);}
}
start();
