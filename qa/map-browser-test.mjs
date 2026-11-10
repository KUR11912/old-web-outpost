import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5180/';
const hardware=process.argv.includes('--hardware');
const photosOnly=process.argv.includes('--photos-only');
const timingsOnly=process.argv.includes('--timings-only');
const out = fileURLToPath(new URL('./', import.meta.url));
const browser = await chromium.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true,
  args:hardware?['--disable-background-timer-throttling']:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-background-timer-throttling'] });
const SAVE='old-web-outpost:save:v1';
const report={url,startedAt:new Date().toISOString(),checks:[],timings:[],waypoints:[],errors:[]};
const check=(name,details=true)=>{report.checks.push({name,details});console.log('PASS: '+name);};
const snap=p=>p.evaluate(()=>window.__OUTPOST_DEBUG__.snapshot());
const shot=(p,name)=>p.screenshot({path:out+name+'.png',fullPage:true});
const delay=(p,ms)=>p.waitForTimeout(ms);
async function setup(pose,owned=false) {
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  if(pose)await context.addInitScript(({key,pose,owned})=>{
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,investigated:owned,clues:owned?['missing-caption-image']:[],pose,updatedAt:Date.now()}));
  },{key:SAVE,pose,owned});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(url,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__OUTPOST_DEBUG__?.snapshot().ready,{timeout:30000});
  await page.locator('#enter-drag').click();
  return {context,page};
}
async function drag(page,dx,dy=0){
  const box=await page.locator('#game-canvas').boundingBox();
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/300));
  for(let i=0;i<steps;i++){
    const x=box.x+box.width*.5,y=box.y+box.height*.55;
    await page.mouse.move(x,y);await page.mouse.down();
    await page.mouse.move(x+dx/steps,y+dy/steps,{steps:6});await page.mouse.up();
  }
}
async function aim(page,yaw,pitch=0){
  const s=await snap(page),d=Math.atan2(Math.sin(yaw-s.pose.yaw),Math.cos(yaw-s.pose.yaw));
  await drag(page,-d/.0022,(s.pose.pitch-pitch)/.0022);
}
async function hold(page,key,ms){await page.keyboard.down(key);await delay(page,ms);await page.keyboard.up(key);}
async function walkAxis(page,axis,target){
  const begin=(await snap(page)).pose,difference=target-begin[axis];
  if(Math.abs(difference)<.09)return {distance:0,keySeconds:0};
  const sign=Math.sign(difference),key=axis==='x'?(sign>0?'d':'a'):(sign>0?'s':'w');
  const start=performance.now();let previous=begin,distance=0,stuck=0;
  await page.keyboard.down(key);
  try{
    for(let n=0;n<600;n++){
      await delay(page,60);const s=await snap(page);
      assert.ok(s.active,'Movement unexpectedly paused');
      if(typeof s.eyeY==='number')assert.ok(Math.abs(s.eyeY-1.65)<.005,'Ground / bridge eye height changed');
      const moved=Math.hypot(s.pose.x-previous.x,s.pose.z-previous.z);distance+=moved;
      if(moved<.002)stuck++;else stuck=0;
      if(stuck>35)throw new Error(`Blocked walking ${key} toward ${axis}=${target}: ${JSON.stringify(s.pose)}`);
      previous=s.pose;
      if(sign*(s.pose[axis]-target)>=-.035){
        report.waypoints.push({...s.pose});
        return {distance,keySeconds:(performance.now()-start)/1000};
      }
    }
    throw new Error('Movement timeout '+JSON.stringify(await snap(page)));
  }finally{await page.keyboard.up(key);}
}
async function route(page,name,nodes){
  await aim(page,0,0);
  await page.evaluate(()=>{
    window.__QA_FRAMES__={running:true,intervals:[],previous:0};
    const sample=t=>{const s=window.__QA_FRAMES__;if(!s.running)return;if(s.previous)s.intervals.push(t-s.previous);s.previous=t;requestAnimationFrame(sample);};
    requestAnimationFrame(sample);
  });
  const startPose=(await snap(page)).pose,started=performance.now();let distance=0,keySeconds=0;
  for(const [x,z] of nodes){
    for(const [axis,target] of [['x',x],['z',z]]){
      const result=await walkAxis(page,axis,target);distance+=result.distance;keySeconds+=result.keySeconds;
    }
  }
  const result={name,start:startPose,end:(await snap(page)).pose,distanceMetres:+distance.toFixed(2),walkingSeconds:+keySeconds.toFixed(2),elapsedSeconds:+((performance.now()-started)/1000).toFixed(2)};
  result.frames=await page.evaluate(()=>{
    const s=window.__QA_FRAMES__;s.running=false;const a=s.intervals,total=a.reduce((x,y)=>x+y,0);
    return {samples:a.length,averageFps:+(1000*a.length/total).toFixed(2),above50ms:a.filter(x=>x>50).length,longestFrameMs:+Math.max(...a).toFixed(2),cappedTimeRatio:+(a.reduce((x,y)=>x+Math.min(y,50),0)/total).toFixed(3)};
  });
  result.measuredSpeed=+(distance/keySeconds).toFixed(2);report.timings.push(result);console.log('WALK '+JSON.stringify(result));
}
async function scenario(pose,callback,owned=false){const p=await setup(pose,owned);try{await callback(p.page);}finally{await p.context.close();}}

try{
 if(photosOnly){
  await scenario({x:20,z:-29,yaw:0,pitch:.14},p=>shot(p,'map-archive'));
  await scenario({x:57,z:-29,yaw:0,pitch:.28},p=>shot(p,'map-lighthouse'));
  report.passed=true;
 }else{
  const {context,page}=await setup();
  const s=await snap(page);
  report.renderer=await page.evaluate(()=>{const g=document.querySelector('canvas').getContext('webgl2');const e=g?.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'unavailable';});
  assert.equal(s.assets.length,8);assert.equal(s.assets.find(a=>a.name==='Outpost_01').instances,1);
  assert.equal(s.assets.find(a=>a.name==='OldTerminal_CRT_01').instances,1);
  assert.equal(s.assets.find(a=>a.name==='Archive_01').instances,1);
  assert.equal(s.assets.find(a=>a.name==='Lighthouse_01').instances,1);
  check('八个 GLB 正常加载，驿站与固定出生点保留',{pose:s.pose,assets:s.assets});
  await shot(page,'map-outpost');
  await page.locator('#map-button').click();
  const beforeMap=(await snap(page)).pose;await hold(page,'w',250);
  assert.deepEqual((await snap(page)).pose,beforeMap);await shot(page,'map-overview');
  await page.keyboard.press('m');
  assert.equal((await snap(page)).active,false);
  await page.locator('#enter-drag').click();check('实际场景 M 俯视全图暂停移动，关闭需明确点击恢复');
  await walkAxis(page,'z',-2);
  await route(page,'旧网驿站前道路 → 回声档案馆',[[13.5,-2],[13.5,-30],[20,-30],[20,-35]]);
  await aim(page,0,.12);await shot(page,'map-archive');
  await route(page,'回声档案馆 → 桥梁中心',[[20,-30],[13.5,-30],[13.5,-8],[39,-8]]);
  await aim(page,-Math.PI/2,-.08);await shot(page,'map-bridge');
  await route(page,'桥梁中心 → 记忆灯塔',[[50,-8],[50,-35],[57,-35]]);
  await aim(page,0,.30);await shot(page,'map-lighthouse');
  check('三段主要道路真实连续行走，无传送、卡住或穿地',report.timings);
  const eastPose=(await snap(page)).pose;
  await page.keyboard.press('Escape');await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__OUTPOST_DEBUG__?.snapshot().ready);
  const restored=(await snap(page)).pose;
  assert.ok(Math.hypot(restored.x-eastPose.x,restored.z-eastPose.z)<.01);
  check('新地图东岸位置刷新恢复，不被旧版 14 米边界重置',restored);
  await context.close();
 if(!timingsOnly){
  await scenario({x:34,z:-20,yaw:-Math.PI/2,pitch:0},async p=>{
    await hold(p,'w',1800);const end=(await snap(p)).pose;
    assert.ok(end.x<35.76&&end.x>34.4,'West river bank must block');check('西岸不可涉水穿河',end);
  });
  await scenario({x:44,z:2,yaw:Math.PI/2,pitch:0},async p=>{
    await hold(p,'w',1800);const end=(await snap(p)).pose;
    assert.ok(end.x>42.24&&end.x<43.6,'East river bank must block');check('东岸不可涉水穿河',end);
  });
  await scenario({x:33,z:-8,yaw:0,pitch:0},async p=>{
    await walkAxis(p,'x',45);await walkAxis(p,'x',33);
    check('桥梁双向通行、两端道路无卡点',(await snap(p)).pose);
  });
  await scenario({x:39,z:-8,yaw:0,pitch:0},async p=>{
    await hold(p,'w',1500);const north=(await snap(p)).pose;
    assert.ok(north.z>-9.8,'North bridge edge must block falling');
    await hold(p,'s',2500);const south=(await snap(p)).pose;
    assert.ok(south.z<-6.2,'South bridge edge must block falling');
    check('桥侧护栏阻挡进入河道',{north,south});
  });
  for(const item of [
    {name:'西界',pose:{x:-14.8,z:0,yaw:Math.PI/2,pitch:0},axis:'x',limit:-15.74,sign:1},
    {name:'东界',pose:{x:66.8,z:-20,yaw:-Math.PI/2,pitch:0},axis:'x',limit:67.74,sign:-1},
    {name:'北界',pose:{x:25,z:-56.8,yaw:0,pitch:0},axis:'z',limit:-57.74,sign:1},
    {name:'南界',pose:{x:25,z:14.8,yaw:Math.PI,pitch:0},axis:'z',limit:15.74,sign:-1},
  ])await scenario(item.pose,async p=>{
    await hold(p,'w',1500);const end=(await snap(p)).pose;
    assert.ok(item.sign*(end[item.axis]-item.limit)>-.01,item.name+' escaped');check(item.name+'不可越界',end);
  });
  await scenario({x:1.5,z:-1.4,yaw:0,pitch:-.19},async p=>{
    await p.waitForFunction(()=>window.__OUTPOST_DEBUG__.snapshot().canInvestigate);
    await p.keyboard.press('e');await p.locator('#collect-clue').click();
    assert.deepEqual((await snap(p)).clues,['missing-caption-image']);
    const img=p.locator('#modal img.clue-image');assert.ok(await img.evaluate(i=>i.complete&&i.naturalWidth===594));
    await shot(p,'map-mailbox-backpack');
    await p.reload({waitUntil:'networkidle'});await p.waitForFunction(()=>window.__OUTPOST_DEBUG__?.snapshot().ready);
    assert.deepEqual((await snap(p)).clues,['missing-caption-image']);check('邮箱调查、原图、唯一线索、背包与存档继续正常');
  });
  await scenario({x:57,z:-35,yaw:0,pitch:0},async p=>{
    assert.deepEqual((await snap(p)).clues,['missing-caption-image']);await p.keyboard.press('b');
    await p.locator('[data-clue-id="missing-caption-image"]').click();
    assert.ok(await p.locator('#modal img.clue-image').isVisible());
    const before=(await snap(p)).pose;await hold(p,'w',300);assert.deepEqual((await snap(p)).pose,before);
    await p.locator('#modal-close').click();assert.equal((await snap(p)).active,false);
    check('既有持有线索存档在东岸仍可查看，窗口暂停逻辑正常');
  },true);
 }
  assert.deepEqual(report.errors,[]);report.passed=true;
 }
}catch(error){
  report.passed=false;report.errors.push(error.stack||String(error));console.error(error);process.exitCode=1;
  for(const context of browser.contexts())for(const page of context.pages()){await shot(page,'map-test-failure').catch(()=>{});console.log(await snap(page).catch(()=>null));}
}finally{
  report.finishedAt=new Date().toISOString();await writeFile(out+(photosOnly?'map-photo-report.json':hardware?'map-hardware-timing-report.json':'map-browser-report.json'),JSON.stringify(report,null,2));await browser.close();
}
