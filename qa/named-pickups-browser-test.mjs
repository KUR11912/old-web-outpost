import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createInputs } from './four-pickups-input-helpers.mjs';
import { createHash } from 'node:crypto';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5181/';
const out = fileURLToPath(new URL('./', import.meta.url));
const baselineOnly = process.argv.includes('--baseline');
const SAVE = 'old-web-outpost:save:v1';
const ORIGINAL = 'outpost-blue-mushroom-folder';
const QUEST = ['missing-caption-image', 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'];
const EXPECTED = [
  { id: 'field-folder-01', name: '友谊的小船', memeId: 'friendship-boat', clueId: 'collection-friendship-boat', x:20.4, z:-46 },
  { id: 'field-folder-02', name: '你是GG还是MM', memeId: 'gg-or-mm', clueId: 'collection-gg-or-mm', x:24.5, z:-20 },
  { id: 'field-folder-03', name: '厉害了我的哥', memeId: 'awesome-my-bro', clueId: 'collection-awesome-my-bro', x:26.6, z:9 },
  { id: 'field-folder-04', name: '你是魔鬼还是秀儿', memeId: 'devil-or-showoff', clueId: 'collection-devil-or-showoff', x:60, z:3 },
];
const report = { url, startedAt:new Date().toISOString(),checks:[],routes:[],errors:[] };
const browser = await chromium.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-timer-throttling'] });
const snap = page => page.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const { aimPoint, walk } = createInputs(snap,report);
const check = (name, details=true) => { report.checks.push({name,details}); console.log('PASS: '+name); };
const shot = (page,name) => page.screenshot({path:out+name+'.png',fullPage:true});
const sorted = values => [...values].sort();
const get = (state,id) => state.pickups.find(p=>p.id===id);
async function setup(fixture, enter=true) {
  const context = await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  if(fixture) await context.addInitScript(({key,fixture})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));},{key:SAVE,fixture});
  const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(url,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__OUTPOST_DEBUG__?.snapshot().ready);
  if(enter) await page.locator('#enter-drag').click();
  return {context,page};
}
async function data(page) {
  return page.evaluate(async()=>{
    const {PICKUPS,PICKUP_STYLE,MEMES}=await import('/src/pickup-data.ts');
    const {CLUES,CLUE_ORDER}=await import('/src/archive-data.ts');
    return {pickups:PICKUPS,style:PICKUP_STYLE,memes:MEMES,clues:CLUES,clueOrder:CLUE_ORDER};
  });
}
function inventory(state, owned, original=false) {
  const ids=owned.map(p=>p.id), allIds=original?[...ids,ORIGINAL]:ids;
  assert.deepEqual(sorted(state.pickupInventory),sorted(allIds));
  assert.deepEqual(sorted(state.collectedPickups),sorted(allIds));
  assert.equal(new Set(state.pickupInventory).size,state.pickupInventory.length);
  for(const target of EXPECTED)assert.equal(get(state,target.id).visible,!ids.includes(target.id));
  assert.equal(get(state,ORIGINAL).visible,!original);
  for(const target of owned) {
    assert.equal(state.memes.filter(id=>id===target.memeId).length,1);
    assert.equal(state.clues.filter(id=>id===target.clueId).length,1);
  }
}
async function noQuestProgress(page,owned) {
  const state=await snap(page);
  assert.deepEqual(state.clues.filter(id=>QUEST.includes(id)),[]);
  assert.deepEqual(sorted(state.clues),sorted(owned.map(p=>p.clueId)));
  assert.deepEqual(sorted(state.memes),sorted(owned.map(p=>p.memeId)));
  assert.equal(state.investigated,false);
  assert.deepEqual(state.archive,{answers:{meaning:null,context:null},completed:false});
  assert.equal(await page.locator('#quest-count').innerText(),'0 / 4');
}
async function waitReady(page) {await page.waitForFunction(()=>window.__OUTPOST_DEBUG__?.snapshot().ready);}
async function checkBag(page,owned,screenshotName) {
  await page.keyboard.press('b');
  assert.equal(await page.locator('[data-pickup-entry]').count(),owned.length);
  const entries=await page.locator('[data-pickup-entry]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.pickupEntry,text:n.innerText,image:n.querySelector('img')?.getAttribute('src'),complete:n.querySelector('img')?.complete,width:n.querySelector('img')?.naturalWidth})));
  for(const target of owned) {
    const entry=entries.find(e=>e.id===target.id);
    assert.ok(entry);assert.ok(entry.text.includes(target.name));assert.match(entry.text,/梗图、年份与出处待补充/);
    assert.match(entry.image,/assets\/folder-icon\.svg$/);assert.ok(entry.complete&&entry.width>0);
  }
  assert.doesNotMatch(await page.locator('#modal-body').innerText(),/待定老梗|占位条目/);
  if(screenshotName) await shot(page,screenshotName);
  for(const target of owned) {
    await page.locator(`button[data-pickup-id="${target.id}"]`).click();
    assert.equal(await page.locator('#modal-body h2').first().innerText(),target.name);
    const text=await page.locator('#modal-body').innerText();
    assert.match(text,/梗图[：、]|原图/);assert.match(text,/年份/);assert.match(text,/出处/);assert.match(text,/待补充/);
    assert.equal(await page.locator('#modal-body img').count(),0,'No invented or reused meme image');
    assert.equal(await page.locator('#modal-body a').count(),0,'No invented source link');
    await page.locator('#return-bag').click();
  }
  await page.locator('#modal-close').click();
  return entries;
}
try {
  if(baselineOnly) {
    const t=await setup(undefined,false);
    const snapshot={state:await snap(t.page),data:await data(t.page)};
    await writeFile(out+'named-pickups-baseline/snapshot.json',JSON.stringify(snapshot,null,2));
    check('Original runtime baseline saved');
  } else {
    const baseline=JSON.parse(await readFile(out+'named-pickups-baseline/snapshot.json','utf8'));
    const initial=await setup(undefined,false), currentData=await data(initial.page), initialState=await snap(initial.page);
    report.initial=initialState;report.bindings=currentData.pickups;
    assert.equal(currentData.pickups.length,5);assert.equal(initialState.assets.length,10);
    assert.deepEqual(currentData.clueOrder,baseline.data.clueOrder);
    assert.deepEqual(currentData.style,baseline.data.style);
    assert.deepEqual(currentData.memes['blue-mushroom'],baseline.data.memes['blue-mushroom']);
    for(const [id,card]of Object.entries(baseline.data.clues))assert.deepEqual(currentData.clues[id],card);
    for(const key of ['map','colliders','assets','sky','camera','pickupStyle'])assert.deepEqual(initialState[key],baseline.state[key],key+' unchanged');
    assert.deepEqual(currentData.pickups.find(p=>p.id===ORIGINAL),baseline.data.pickups.find(p=>p.id===ORIGINAL));
    for(const target of EXPECTED) {
      const old=baseline.data.pickups.find(p=>p.id===target.id), now=currentData.pickups.find(p=>p.id===target.id);
      assert.equal(old.memeId,null);assert.equal(now.memeId,target.memeId);assert.equal(now.name,target.name);
      const invariant=p=>Object.fromEntries(Object.entries(p).filter(([key])=>!['memeId','name','description'].includes(key)));
      assert.deepEqual(invariant(now),invariant(old));
      assert.equal(now.position.x,target.x);assert.equal(now.position.z,target.z);
      assert.equal(currentData.memes[target.memeId].clueId,target.clueId);
      const card=currentData.clues[target.clueId];assert.equal(card.name,target.name);assert.equal(card.image,undefined);
      assert.equal(card.sources,undefined);assert.ok(!currentData.clueOrder.includes(target.clueId));
    }
    inventory(initialState,[]);await noQuestProgress(initial.page,[]);
    check('四个原占位绑定一对一正式名称；五个实例/位置/模型/动画参数/地图/碰撞/蓝瘦资料及任务顺序不变',currentData.pickups);
    await initial.context.close();

    let saved={version:1};const owned=[];
    for(const [index,target]of EXPECTED.entries()) {
      // Independent legal near-position save fixtures, followed by real WASD.
      // No runtime teleport, debug mutation or simulated pickup event is used.
      const side=index<2?1:-1, pose={x:target.x,z:target.z+side*1.7,yaw:0,pitch:0};
      const t=await setup({...saved,pose});let state=await snap(t.page);
      assert.ok(Math.hypot(state.pose.x-pose.x,state.pose.z-pose.z)<.01);
      inventory(state,owned);await noQuestProgress(t.page,owned);
      const before=get(state,target.id);assert.equal(before.visible,true);assert.ok(Math.hypot(state.pose.x-target.x,state.pose.z-target.z)>state.pickupStyle.pickupRadius);
      await t.page.waitForTimeout(300);
      const animated=get(await snap(t.page),target.id);assert.ok(Math.abs(animated.rotationY-before.rotationY)>.01,'Folder still spins');
      await aimPoint(t.page,{x:target.x,y:.9,z:target.z});
      await walk(t.page,[[target.x,target.z+side*.55]],'靠近原文件夹自动拾取 '+target.name);
      await t.page.waitForFunction(id=>window.__OUTPOST_DEBUG__.snapshot().collectedPickups.includes(id),target.id);
      owned.push(target);state=await snap(t.page);inventory(state,owned);await noQuestProgress(t.page,owned);
      const toast=await t.page.locator('#toast').innerText();assert.equal(toast,'已获得老梗：'+target.name);assert.equal(await t.page.locator('#toast').isVisible(),true);
      assert.equal(state.active,true);assert.equal(state.modal,false);
      await aimPoint(t.page,{x:target.x,y:.9,z:target.z});await shot(t.page,`named-pickup-${index+1}-collected`);
      saved=await t.page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
      assert.deepEqual(sorted(saved.pickupInventory),sorted(owned.map(p=>p.id)));assert.deepEqual(sorted(saved.collectedPickups),sorted(saved.pickupInventory));
      assert.deepEqual(sorted(saved.memes),sorted(owned.map(p=>p.memeId)));assert.deepEqual(sorted(saved.clues),sorted(owned.map(p=>p.clueId)));
      await walk(t.page,[[target.x,target.z-side*.5],[target.x,target.z+side*1.7]],'往返原位置验证不重复 '+target.name);
      inventory(await snap(t.page),owned);await noQuestProgress(t.page,owned);
      await t.page.reload({waitUntil:'networkidle'});await waitReady(t.page);
      inventory(await snap(t.page),owned);await noQuestProgress(t.page,owned);
      const entries=await checkBag(t.page,owned,index===3?'named-pickups-backpack':undefined);
      check(`${target.id} → ${target.name}：真实靠近、正确提示、唯一记录、消失、往返去重和刷新/详情均正确`,{target,toast,entries,savedInventory:saved.pickupInventory});
      await t.context.close();
    }

    const legacyFixture={version:1,pickupInventory:EXPECTED.map(p=>p.id),collectedPickups:EXPECTED.map(p=>p.id),clues:[],memes:[],pose:{x:0,z:9,yaw:0,pitch:0},archive:{answers:{meaning:null,context:null},completed:false}};
    const legacy=await setup(legacyFixture,false);inventory(await snap(legacy.page),EXPECTED);await noQuestProgress(legacy.page,EXPECTED);
    await checkBag(legacy.page,EXPECTED,'named-pickups-legacy-backpack');
    await legacy.page.reload({waitUntil:'networkidle'});await waitReady(legacy.page);inventory(await snap(legacy.page),EXPECTED);await noQuestProgress(legacy.page,EXPECTED);
    check('已收集的旧占位存档按原pickupId显示四个新名称，文件夹保持隐藏且不增加蓝瘦任务进度');
    await legacy.context.close();

    const complete=await setup({...legacyFixture,investigated:true,clues:QUEST,archive:{answers:{meaning:'emotion',context:'shared-self-mockery'},completed:true}},false);
    let completeState=await snap(complete.page);inventory(completeState,EXPECTED,true);
    assert.deepEqual(completeState.clues.filter(id=>QUEST.includes(id)),QUEST);assert.equal(completeState.archive.completed,true);assert.equal(await complete.page.locator('#quest-count').innerText(),'已完成');
    assert.equal(completeState.memes.filter(id=>id==='blue-mushroom').length,1);
    await complete.page.reload({waitUntil:'networkidle'});await waitReady(complete.page);completeState=await snap(complete.page);
    inventory(completeState,EXPECTED,true);assert.equal(completeState.archive.completed,true);
    check('已有蓝瘦四卡、调查答案和完成状态与四个正式收藏共存，刷新不回退');await complete.context.close();

    const original=await setup({...saved,pose:{x:1.5,z:-.1,yaw:0,pitch:0}});
    inventory(await snap(original.page),EXPECTED);await noQuestProgress(original.page,EXPECTED);
    await walk(original.page,[[1.5,-1.15]],'原蓝瘦文件夹独立拾取回归');
    await original.page.waitForFunction(id=>window.__OUTPOST_DEBUG__.snapshot().collectedPickups.includes(id),ORIGINAL);
    const originalState=await snap(original.page);inventory(originalState,EXPECTED,true);
    assert.equal(await original.page.locator('#toast').innerText(),'已获得老梗：蓝瘦香菇图片');assert.equal(await original.page.locator('#quest-count').innerText(),'1 / 4');
    assert.deepEqual(originalState.clues.filter(id=>QUEST.includes(id)),[QUEST[0]]);assert.equal(originalState.archive.completed,false);
    check('原蓝瘦香菇文件夹仍单独拾取，只有它令任务升至1/4，四个新梗不计入');await original.context.close();

    const hashes=JSON.parse(await readFile(out+'named-pickups-baseline/source-hashes.json','utf8'));
    report.sourcePreservation=[];
    for(const entry of hashes) {
      if(['pickup-data.ts','archive-data.ts'].includes(entry.file))continue;
      const text=await readFile(new URL('../src/'+entry.file,import.meta.url),'utf8');
      if(entry.file==='investigation-ui.ts') {
        const before=await readFile(out+'named-pickups-baseline/'+entry.file,'utf8');
        assert.equal(text.replace('探索收藏不计入下方','占位条目不计入下方'),before);
        report.sourcePreservation.push({file:entry.file,change:'Only collection-note copy'});
      } else {
        assert.equal(createHash('sha256').update(text).digest('hex').toUpperCase(),entry.sha256);
        report.sourcePreservation.push({file:entry.file,unchanged:true});
      }
    }
    check('拾取/存档/玩家/场景/山体/天空/样式源码保持原样；UI仅纠正收藏说明文字',report.sourcePreservation);
    assert.deepEqual(report.errors,[]);
  }
  report.passed=true;
} catch(error) {
  report.passed=false;report.errors.push(error.stack||String(error));console.error(error);process.exitCode=1;
  for(const c of browser.contexts())for(const p of c.pages())await shot(p,'named-pickups-test-failure').catch(()=>{});
} finally {
  report.finishedAt=new Date().toISOString();
  await writeFile(out+(baselineOnly?'named-pickups-baseline/report.json':'named-pickups-browser-report.json'),JSON.stringify(report,null,2));
  await browser.close();
}
