import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5180/';
const before = process.argv.includes('--before');
const photosOnly = process.argv.includes('--photos-only');
const out = fileURLToPath(new URL('./', import.meta.url));
const browser = await chromium.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true,
  args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-background-timer-throttling'] });
const key='old-web-outpost:save:v1';
const report={url,startedAt:new Date().toISOString(),checks:[],route:[],errors:[]};
const check=(name,details=true)=>{ report.checks.push({name,details}); console.log('PASS: '+name); };
const snapshot=page=>page.evaluate(()=>window.__OUTPOST_DEBUG__.snapshot());
const shot=(page,name)=>page.screenshot({path:out+name+'.png',fullPage:true});

async function setup(pose,viewport={width:1440,height:1000}) {
 const context=await browser.newContext({viewport,deviceScaleFactor:1});
 if(pose) await context.addInitScript(({key,pose})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,investigated:false,clues:[],pose,updatedAt:Date.now()}));},{key,pose});
 const page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(url,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.__OUTPOST_DEBUG__?.snapshot().ready);
 await page.locator('#enter-drag').click();
 return {context,page};
}
async function drag(page,dx,dy=0) {
 const b=await page.locator('#game-canvas').boundingBox();
 const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/350));
 for(let i=0;i<steps;i++) {
  const x=b.x+b.width*.5,y=b.y+b.height*.55;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx/steps,y+dy/steps,{steps:6});await page.mouse.up();
 }
}
async function aim(page,yaw,pitch=.1) {
 const pose=(await snapshot(page)).pose;
 const difference=Math.atan2(Math.sin(yaw-pose.yaw),Math.cos(yaw-pose.yaw));
 await drag(page,-difference/.0022,(pose.pitch-pitch)/.0022);
}
async function walk(page,key,axis,target,sign) {
 await page.keyboard.down(key);
 try {
  let old=(await snapshot(page)).pose[axis],stuck=0;
  for(let i=0;i<230;i++) {
   await page.waitForTimeout(80);
   const s=await snapshot(page);
   assert.ok(s.active,'Exploration unexpectedly paused');
   if(sign*(s.pose[axis]-target)>=0) {report.route.push({...s.pose});return;}
   if(Math.abs(s.pose[axis]-old)<.003)stuck++;else stuck=0;
   if(stuck>25)throw new Error('Blocked walking '+key+' to '+target+': '+JSON.stringify(s.pose));
   old=s.pose[axis];
  }
  throw new Error('Walking timeout: '+JSON.stringify((await snapshot(page)).pose));
 } finally {await page.keyboard.up(key);}
}
async function photo(pose,name,viewport) {
 const p=await setup(pose,viewport); await shot(p.page,name); await p.context.close();
}
try {
 if(before) {
  await photo({x:0,z:1.2,yaw:0,pitch:.15},'building-before-front');
  report.passed=true;
 } else if(photosOnly) {
  await photo({x:0,z:-.1,yaw:0,pitch:.22},'building-game-front-close',{width:1000,height:900});
  report.passed=true;
 } else {
  const {context,page}=await setup();
  const start=await snapshot(page);
  const building=start.assets.find(a=>a.name==='Outpost_01');
  assert.ok(building&&building.instances===1&&building.texturedMaterials>0,'New Blender building must load');
  assert.ok(building.dimensions.x>5.5&&building.dimensions.y>4.5&&building.dimensions.z>4.9);
  check('新建筑 GLB 实际加载且尺寸正常',building);
  // The whole route starts at spawn and uses real WASD / mouse input only.
  await walk(page,'w','z',-3.9,-1);
  await walk(page,'a','x',-3.85,-1);
  await walk(page,'w','z',-7.35,-1);
  await aim(page,-Math.PI/2,.12); await shot(page,'building-game-left');
  await aim(page,0,0);
  await walk(page,'w','z',-10.9,-1);
  await walk(page,'d','x',0,1);
  await aim(page,Math.PI,.16); await shot(page,'building-game-back');
  await aim(page,0,0);
  await walk(page,'d','x',3.4,1);
  await walk(page,'s','z',-7.6,1);
  await aim(page,Math.PI/2,.12); await shot(page,'building-game-right');
  await aim(page,0,0);
  await walk(page,'s','z',-6.3,1);
  // The retained bench occupies x 3.12..5.08,z -5.75..-5.05; use its outer end.
  await walk(page,'d','x',5.5,1);
  await walk(page,'s','z',-3.9,1);
  await walk(page,'a','x',2.3,-1);
  await walk(page,'s','z',-1.4,1);
  await walk(page,'a','x',1.5,-1);
  check('从出生点真实绕过建筑左右与背面，并返回邮箱',report.route);
  const pose=(await snapshot(page)).pose;
  const target={x:1.5,y:1.25,z:-3.44};
  await aim(page,Math.atan2(-(target.x-pose.x),-(target.z-pose.z)),Math.atan2(target.y-1.65,Math.hypot(target.x-pose.x,target.z-pose.z)));
  await page.waitForFunction(()=>window.__OUTPOST_DEBUG__.snapshot().canInvestigate);
  await page.keyboard.press('e'); await page.locator('#collect-clue').click();
  assert.deepEqual((await snapshot(page)).clues,['missing-caption-image']);
  await shot(page,'building-game-mailbox-clue');
  await page.reload({waitUntil:'networkidle'}); await page.waitForFunction(()=>window.__OUTPOST_DEBUG__?.snapshot().ready);
  assert.deepEqual((await snapshot(page)).clues,['missing-caption-image']);
  check('绕楼后邮箱调查、唯一线索领取与刷新恢复正常');
  await context.close();
  await photo({x:0,z:1.2,yaw:0,pitch:.15},'building-after-front');
  await photo({x:0,z:9,yaw:0,pitch:.08},'building-after-overview');
  // Verify all four wall faces block movement, plus the left ladder protrusion.
  for(const item of [
   {name:'前墙',pose:{x:-1.5,z:-3.9,yaw:0,pitch:0},axis:'z',limit:-4.70,sign:1},
   {name:'背墙',pose:{x:0,z:-11.1,yaw:Math.PI,pitch:0},axis:'z',limit:-10.30,sign:-1},
   {name:'左侧墙',pose:{x:-4,z:-9.5,yaw:-Math.PI/2,pitch:0},axis:'x',limit:-3.10,sign:-1},
   {name:'右侧墙',pose:{x:4,z:-8.5,yaw:Math.PI/2,pitch:0},axis:'x',limit:3.10,sign:1},
   {name:'左侧梯状结构',pose:{x:-4,z:-7.5,yaw:-Math.PI/2,pitch:0},axis:'x',limit:-3.44,sign:-1},
  ]) {
   const p=await setup(item.pose);
   await p.page.keyboard.down('w');await p.page.waitForTimeout(1200);await p.page.keyboard.up('w');
   const end=(await snapshot(p.page)).pose;
   assert.ok(item.sign*(end[item.axis]-item.limit)>=-.025,`${item.name} collision: ${JSON.stringify(end)}`);
   check(item.name+'阻挡穿墙',end);await p.context.close();
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
 }
}catch(error) {
 report.passed=false;report.errors.push(error.stack||String(error));console.error(error);process.exitCode=1;
 for(const context of browser.contexts()) for(const page of context.pages()) {await shot(page,'building-test-failure').catch(()=>{});console.log(await snapshot(page).catch(()=>null));}
}finally {
 report.finishedAt=new Date().toISOString();
 await writeFile(out+(before?'building-before-report.json':photosOnly?'building-photo-report.json':'building-browser-report.json'),JSON.stringify(report,null,2));
 await browser.close();
}
