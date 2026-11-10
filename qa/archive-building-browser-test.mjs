import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5180/';
const photosOnly = process.argv.includes('--photos-only');
const out = fileURLToPath(new URL('./', import.meta.url));
const COUNTS = { Tree_01: 86, Rock_01: 20, Grass_01: 349, PathTile_01: 67, Outpost_01: 1, OldTerminal_CRT_01: 1 };
const CARDS = ['missing-caption-image', 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'];
const OLD_APPROACHES = { 'old-terminal': [16.6, -33.7], 'chat-viewer': [20, -34.3], 'image-cache': [22.8, -34], 'archive-desk': [25, -30.7] };
const report = { url, startedAt: new Date().toISOString(), checks: [], routes: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling'] });
const snap = p => p.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS: ' + name); };
const shot = (p, name) => p.screenshot({ path: out + name + '.png', fullPage: true });
async function setup(pose = { x: 20, z: -29, yaw: 0, pitch: .16 }) {
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
  await page.locator('#enter-drag').click();
  return { page, context, glbs };
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
    for (let i = 0; i < 500; i++) {
      await page.waitForTimeout(45); const s = await snap(page); assert.ok(s.active); assert.ok(Math.abs(s.eyeY - 1.65) < .005);
      if (Math.hypot(s.pose.x - previous.x, s.pose.z - previous.z) < .002) stuck++; else stuck = 0;
      if (stuck > 35) throw new Error(`Blocked ${axis}=${target} at ${JSON.stringify(s.pose)}`);
      previous = s.pose; if (sign * (s.pose[axis] - target) >= -.03) return;
    }
    throw new Error('Walk timed out');
  } finally { await page.keyboard.up(key); }
}
async function walk(page, points, name) {
  await aim(page, 0); const start = (await snap(page)).pose;
  for (const [x, z] of points) { await walkAxis(page, 'x', x); await walkAxis(page, 'z', z); }
  report.routes.push({ name, start, end: (await snap(page)).pose });
}
async function pausedCheck(page) {
  const before = (await snap(page)).pose;
  await page.keyboard.down('w'); await page.waitForTimeout(250); await page.keyboard.up('w'); assert.deepEqual((await snap(page)).pose, before);
}
async function closeResume(page) {
  await page.locator('#modal-close').click(); assert.equal((await snap(page)).active, false);
  await page.locator('#enter-drag').click();
}
try {
 if(photosOnly){
  for(const photo of [
    {pose:{x:14.9,z:-29.5,yaw:0,pitch:0},target:{x:20,y:3.6,z:-39.2},name:'archive-building-game-oblique'},
    {pose:{x:20,z:-49.2,yaw:Math.PI,pitch:0},target:{x:20,y:3.5,z:-40},name:'archive-building-game-rear'},
    {pose:{x:28.8,z:-37.8,yaw:0,pitch:0},target:{x:20,y:3.4,z:-40},name:'archive-building-game-right'},
  ]){const p=await setup(photo.pose);await lookAt(p.page,photo.target);await shot(p.page,photo.name);report.routes.push({name:photo.name,pose:(await snap(p.page)).pose});await p.context.close();}
  report.passed=true;
 }else{
  const { page, context, glbs } = await setup();
  let s = await snap(page);
  report.renderer = await page.evaluate(() => { const g = document.querySelector('canvas').getContext('webgl2'), e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unavailable'; });
  const archive = s.assets.find(a => a.name === 'Archive_01');
  assert.equal(s.assets.length, 8); assert.ok(archive && archive.instances === 1 && archive.meshes > 0 && archive.texturedMaterials > 0);
  assert.ok(archive.dimensions.y >= 7 && archive.dimensions.x >= 4.9 && archive.dimensions.z >= 6);
  assert.ok(glbs.some(r => r.url.includes('Archive_01.glb') && r.status === 200));
  check('第七个 Archive_01 GLB 实际加载，模型及贴图完整', archive);
  for (const [name, count] of Object.entries(COUNTS)) assert.equal(s.assets.find(a => a.name === name)?.instances, count, name + ' instances changed');
  for (const [id, point] of Object.entries(OLD_APPROACHES)) {
    const item = s.interactables.find(i => i.id === id); assert.ok(item);
    assert.ok(Math.hypot(item.approach.x - point[0], item.approach.z - point[1]) < .001);
  }
  const crt = s.assets.find(a => a.name === 'OldTerminal_CRT_01');
  assert.ok(crt.materialDetails.some(m => Math.abs(m.roughness - .25) < .02));
  check('原六类模型实例、CRT玻璃及四个调查站位保持');
  assert.deepEqual([...s.clues].sort(), [...CARDS].sort()); assert.equal(s.archive.completed, true);
  check('已有 v1 四卡及档案馆完成状态保留');
  await lookAt(page, { x: 20, y: 3.4, z: -39 }); await shot(page, 'archive-building-game-front');
  await walk(page, [[14.9, -29], [14.9, -29.5]], '沿现有道路前场观察左前斜视');
  await lookAt(page, { x: 20, y: 3.6, z: -39.2 }); await shot(page, 'archive-building-game-oblique');
  await walk(page, [[18.5, -31.8]], '返回调查区观察设备与雨棚');
  await lookAt(page, { x: 19.6, y: 1.9, z: -36.5 }); await shot(page, 'archive-building-game-stations');

  for (const id of ['old-terminal', 'chat-viewer', 'image-cache']) {
    const item = s.interactables.find(i => i.id === id);
    await aim(page, 0); await walkAxis(page, 'z', -30.7); await walkAxis(page, 'x', item.approach.x); await walkAxis(page, 'z', item.approach.z);
    await lookAt(page, item.aim);
    await page.waitForFunction(id => window.__OUTPOST_DEBUG__.snapshot().targetId === id, id);
    await page.keyboard.press('e'); await page.locator('#modal').waitFor({ state: 'visible' });
    const body = await page.locator('#modal-body').innerText();
    assert.match(body, id === 'old-terminal' ? /读音便笺/ : id === 'chat-viewer' ? /聊天片段/ : /图片改编记录/);
    assert.equal(await page.locator('#collect-clue:enabled').count(), 0);
    assert.deepEqual([...(await snap(page)).clues].sort(), [...CARDS].sort());
    await pausedCheck(page);
    if (id === 'chat-viewer') await shot(page, 'archive-building-game-investigation');
    check('新建筑前 E 调查不受遮挡、内容保留且不重复发卡：' + id);
    await closeResume(page);
  }
  await page.keyboard.press('b');
  for (const card of CARDS) assert.ok(await page.locator(`[data-clue-id="${card}"]`).count());
  await pausedCheck(page); await closeResume(page); check('背包四卡可查看，窗口暂停和恢复正常');

  await walk(page, [[22.8, -30.7], [15.5, -30.7], [15.5, -44], [20, -44], [20, -45.8]], '真实绕左侧到背后');
  await lookAt(page, { x: 20, y: 3.2, z: -40 }); await shot(page, 'archive-building-game-rear');
  await walk(page, [[20, -44], [24.2, -44], [24.2, -37.2]], '真实绕后方到右侧');
  await lookAt(page, { x: 20, y: 3.2, z: -40 }); await shot(page, 'archive-building-game-right');
  check('建筑左侧、背后及右侧实际行走可达，脚下高度稳定');
  const before = (await snap(page)).pose;
  await page.keyboard.press('Escape'); await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  s = await snap(page); assert.ok(Math.hypot(s.pose.x - before.x, s.pose.z - before.z) < .01);
  assert.deepEqual([...s.clues].sort(), [...CARDS].sort()); assert.equal(s.archive.completed, true);
  assert.equal(s.archive.answers.meaning, 'emotion'); assert.equal(s.archive.answers.context, 'shared-self-mockery');
  check('刷新恢复建筑旁位置、四卡、答案及完成状态', s.pose);
  const wall = s.colliders.find(c => c.label === '回声档案馆外墙'); assert.ok(wall);
  await context.close();
  for (const test of [
    { name: '前墙及雨棚下', pose: { x: 18.5, z: -35.8, yaw: 0, pitch: 0 }, axis: 'z', limit: wall.z + wall.halfZ + .26, sign: 1 },
    { name: '后墙', pose: { x: 20, z: -44.2, yaw: Math.PI, pitch: 0 }, axis: 'z', limit: wall.z - wall.halfZ - .26, sign: -1 },
    { name: '左墙', pose: { x: 16.6, z: -40, yaw: -Math.PI / 2, pitch: 0 }, axis: 'x', limit: wall.x - wall.halfX - .26, sign: -1 },
    { name: '右墙', pose: { x: 23.5, z: -40, yaw: Math.PI / 2, pitch: 0 }, axis: 'x', limit: wall.x + wall.halfX + .26, sign: 1 },
  ]) {
    const fixture = await setup(test.pose);
    await fixture.page.keyboard.down('w'); await fixture.page.waitForTimeout(1200); await fixture.page.keyboard.up('w');
    const end = (await snap(fixture.page)).pose;
    assert.ok(test.sign * (end[test.axis] - test.limit) > -.02, test.name + ' passed through wall');
    assert.ok(Math.abs(end[test.axis] - test.limit) < .05, test.name + ' stopped before body boundary, possible canopy collider');
    check(test.name + '碰撞阻挡准确', end); await fixture.context.close();
  }
  assert.deepEqual(report.errors, []); report.passed = true;
 }
} catch (error) {
  report.passed = false; report.errors.push(error.stack || String(error)); console.error(error); process.exitCode = 1;
  for (const context of browser.contexts()) for (const page of context.pages()) {
    await shot(page, 'archive-building-test-failure').catch(() => {});
    const s = await snap(page).catch(() => null); console.log(JSON.stringify(s && { pose: s.pose, targetId: s.targetId, active: s.active }));
  }
} finally {
  report.finishedAt = new Date().toISOString(); await writeFile(out + (photosOnly?'archive-building-photo-report.json':'archive-building-browser-report.json'), JSON.stringify(report, null, 2)); await browser.close();
}
