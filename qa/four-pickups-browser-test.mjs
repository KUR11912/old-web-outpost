import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createInputs } from './four-pickups-input-helpers.mjs';

// The main collection run starts at the real spawn in a clean browser context.
// It uses only physical mouse/WASD input and read-only game snapshots.
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5180/';
const out = fileURLToPath(new URL('./', import.meta.url));
const SAVE = 'old-web-outpost:save:v1';
const IDS = ['field-folder-01', 'field-folder-02', 'field-folder-03', 'field-folder-04'];
const ORIGINAL = 'outpost-blue-mushroom-folder', CLUE = 'missing-caption-image';
const CARDS = [CLUE, 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'];
const report = { url, startedAt: new Date().toISOString(), checks: [], routes: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling'] });
const snap = p => p.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const { aim, aimPoint, walk } = createInputs(snap, report);
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS: ' + name); };
const shot = (page, name) => page.screenshot({ path: out + name + '.png', fullPage: true });
const get = (s, id) => s.pickups.find(p => p.id === id);
const sorted = values => [...values].sort();

async function setup({ storageState, fixture, enter = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, storageState });
  if (fixture) await context.addInitScript(({ key, fixture }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture)); }, { key: SAVE, fixture });
  const page = await context.newPage(), glbs = [];
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('response', r => { if (r.url().includes('.glb')) glbs.push({ url: r.url(), status: r.status() }); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  if (enter) await page.locator('#enter-drag').click();
  return { context, page, glbs };
}
async function resume(page) {
  if (await page.locator('#modal').evaluate(e => e.open)) await page.locator('#modal-close').click();
  if ((await snap(page)).mapOpen) await page.keyboard.press('m');
  assert.equal((await snap(page)).active, false);
  await page.locator('#enter-drag').click();
}
async function unchangedQuest(page, expected) {
  const s = await snap(page);
  assert.deepEqual(s.clues, expected.clues);
  assert.deepEqual(s.memes, expected.memes);
  assert.deepEqual(s.archive, expected.archive);
  assert.equal(await page.locator('#quest-count').innerText(), expected.quest);
}
function inventory(s, ids, original = false) {
  assert.deepEqual(sorted(s.pickupInventory), sorted(original ? [...ids, ORIGINAL] : ids));
  assert.deepEqual(sorted(s.collectedPickups), sorted(original ? [...ids, ORIGINAL] : ids));
  for (const id of IDS) assert.equal(get(s, id).visible, !ids.includes(id), `${id} visibility`);
  assert.equal(get(s, ORIGINAL).visible, !original);
  assert.equal(new Set(s.pickupInventory).size, s.pickupInventory.length);
  assert.equal(new Set(s.collectedPickups).size, s.collectedPickups.length);
}
async function overview(page) {
  await page.keyboard.press('m');
  assert.equal((await snap(page)).mapOpen, true);
  await page.waitForTimeout(300);
  await shot(page, 'four-pickups-map-clean');
  const labels = await page.evaluate(ids => {
    const s = window.__OUTPOST_DEBUG__.snapshot(), viewport = document.querySelector('#viewport');
    const r = viewport.getBoundingClientRect(), b = s.map.bounds, aspect = r.width / r.height;
    const halfH = Math.max((b.maxZ - b.minZ + 14) / 2, (b.maxX - b.minX + 14) / 2 / aspect);
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const overlay = document.createElement('div'); overlay.id = 'qa-only-pickup-map-annotations';
    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:50;font-family:Arial,Microsoft YaHei,sans-serif;';
    const caption = document.createElement('div'); caption.textContent = 'QA 截图标注 · 新增 4 个文件夹的实际位置';
    caption.style.cssText = 'position:absolute;left:50%;bottom:24px;transform:translateX(-50%);padding:10px 18px;background:#183728;color:white;border-radius:6px;font-size:18px'; overlay.append(caption);
    const points = ids.map((id, index) => {
      const p = s.pickups.find(p => p.id === id), x = (p.basePosition.x - cx) / (2 * halfH * aspect) * r.width + r.width / 2;
      const y = (p.basePosition.z - cz) / (2 * halfH) * r.height + r.height / 2;
      const dot = document.createElement('div');
      dot.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:18px;height:18px;border:3px solid #fff;background:#d03b29;border-radius:50%;box-shadow:0 0 0 3px #8d2518;transform:translate(-50%,-50%);`;
      const label = document.createElement('div'); label.textContent = `${String(index + 1).padStart(2, '0')} · ${p.location || p.name || id}`;
      label.style.cssText = `position:absolute;left:${x + 17}px;top:${y - 38}px;background:#fff8e8;color:#592318;border:2px solid #a53d24;border-radius:5px;padding:5px 9px;white-space:nowrap;font-weight:bold;font-size:15px;box-shadow:0 2px 8px #0006;`;
      overlay.append(dot, label); return { id, world: p.basePosition, pixel: { x, y } };
    }); viewport.append(overlay); return { points, camera: { cx, cz, halfH, aspect }, viewport: { width: r.width, height: r.height } };
  }, IDS);
  await shot(page, 'four-pickups-overview');
  await page.locator('#qa-only-pickup-map-annotations').evaluate(e => e.remove());
  check('实际俯视地图另存无标注原图与仅用于验收的四点标注图', labels);
  await resume(page);
}

// Each route uses existing stone-road junctions, then the clear approach next to
// its folder. No controller pose, debug state, or gameplay event is mutated.
const localRoutes = [
  [[13.5, -30], [15, -30], [15, -36.8], [16.5, -36.8], [16.5, -44.3], [20.4, -44.3]],
  [[13.5, -20], [18.5, -20], [18.5, -18.3], [24.5, -18.3]],
  [[26.6, -8], [26.6, 7.3]],
  [[50, -8], [58, -8], [58, 0], [60, 0], [60, 1.3]],
];
function approaches(index) {
  if (index === 0) return [[0, 0], [3, 0], [3, -2], [13.5, -2], ...localRoutes[0]];
  if (index === 1) return localRoutes[1];
  if (index === 2) return [[13.5, -8], ...localRoutes[2]];
  return localRoutes[3];
}

try {
  const { context, page, glbs } = await setup();
  let s = await snap(page);
  assert.deepEqual(s.pose, s.map.spawn);
  assert.equal(s.pickups.length, 5); inventory(s, []);
  assert.equal(s.assets.length, 9);
  const folderModel = s.assets.find(a => a.name === 'MemeFolder_01');
  assert.equal(folderModel.instances, 5); assert.ok(folderModel.meshes > 0);
  assert.equal(new Set(glbs.map(r => r.url)).size, 9); assert.ok(glbs.every(r => r.status === 200));
  for (const id of IDS) { assert.equal(get(s, id).memeId, null); assert.equal(get(s, id).basePosition.y, .6); }
  assert.ok(!s.colliders.some(c => /folder|文件夹/i.test(c.label)));
  report.assets = s.assets; report.pickups = s.pickups;
  report.renderer = await page.evaluate(() => { const g = document.querySelector('canvas').getContext('webgl2'), e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unavailable'; });
  const baseline = { clues: s.clues, memes: s.memes, archive: s.archive, quest: await page.locator('#quest-count').innerText() };
  assert.equal(baseline.quest, '0 / 4');
  check('全新隔离存档原出生点，原九个GLB且文件夹模型复用为五实例，四新增点无memeId且无碰撞体', { folderModel, pickups: s.pickups });
  await overview(page);
  const owned = [];
  for (const [index, id] of IDS.entries()) {
    const p = get(await snap(page), id).basePosition;
    await walk(page, approaches(index), `沿现有道路到 ${id} 范围外`);
    s = await snap(page); inventory(s, owned); await unchangedQuest(page, baseline);
    assert.ok(Math.hypot(s.pose.x - p.x, s.pose.z - p.z) > s.pickupStyle.pickupRadius);
    await aimPoint(page, { ...p, y: .9 }); await shot(page, `four-pickups-${index + 1}-near`);
    const side = Math.sign(localRoutes[index].at(-1)[1] - p.z);
    await walk(page, [[p.x, p.z + side * .55]], `靠近自动拾取 ${id}`);
    await page.waitForFunction(id => window.__OUTPOST_DEBUG__.snapshot().collectedPickups.includes(id), id);
    owned.push(id); s = await snap(page); inventory(s, owned); await unchangedQuest(page, baseline);
    assert.equal(s.active, true); assert.equal(s.modal, false);
    await aimPoint(page, { ...p, y: .9 }); await shot(page, `four-pickups-${index + 1}-collected`);
    await walk(page, [[p.x, p.z - side * .5], [p.x, p.z + side * 1.7]], `往返穿过 ${id} 原位置`);
    inventory(await snap(page), owned); await unchangedQuest(page, baseline);
    const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE);
    assert.deepEqual(sorted(stored.pickupInventory), sorted(owned)); assert.deepEqual(sorted(stored.collectedPickups), sorted(owned));
    check(`${id} 仅近距离自动收集一次、马上消失、可往返穿过、存档保留独立ID且蓝瘦任务不变`, { position: p, inventory: [...owned] });
    await walk(page, [...localRoutes[index]].reverse(), `${id} 原路返回石板路`);
  }
  await page.keyboard.press('b');
  const pausedPose = (await snap(page)).pose;
  await page.keyboard.down('w'); await page.waitForTimeout(250); await page.keyboard.up('w');
  assert.deepEqual((await snap(page)).pose, pausedPose);
  assert.equal(await page.locator('[data-pickup-entry]').count(), 4);
  const entries = await page.locator('[data-pickup-entry]').evaluateAll(nodes => nodes.map(n => ({ id: n.dataset.pickupEntry, text: n.innerText, image: n.querySelector('img')?.getAttribute('src'), complete: n.querySelector('img')?.complete, width: n.querySelector('img')?.naturalWidth })));
  for (const [index, entry] of entries.entries()) { assert.equal(entry.id, IDS[index]); assert.match(entry.text, new RegExp(`待定老梗\\s*0${index + 1}`)); assert.match(entry.text, /老梗内容待补充/); assert.match(entry.image, /assets\/folder-icon\.svg$/); assert.ok(entry.complete && entry.width > 0); }
  await page.setViewportSize({ width: 1440, height: 1400 });
  await page.locator('[data-pickup-entry]').first().scrollIntoViewIfNeeded(); await shot(page, 'four-pickups-backpack');
  for (const id of IDS) {
    await page.locator(`button[data-pickup-id="${id}"]`).click();
    assert.match(await page.locator('#modal-body').innerText(), /老梗内容待补充/);
    assert.ok(await page.locator('#modal img.clue-image').evaluate(i => i.complete && i.naturalWidth > 0 && i.getAttribute('src').endsWith('assets/folder-icon.svg')));
    await page.locator('#return-bag').click();
  }
  check('背包四个独立占位条目均显示通用folder icon，可打开详情，内容明确待补充', entries);
  await page.setViewportSize({ width: 1440, height: 1000 }); await resume(page);
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  inventory(await snap(page), IDS); await unchangedQuest(page, baseline);
  const storageState = await context.storageState(); await context.close();
  const reopened = await setup({ storageState, enter: false });
  inventory(await snap(reopened.page), IDS); await unchangedQuest(reopened.page, baseline);
  await reopened.page.keyboard.press('b'); assert.equal(await reopened.page.locator('[data-pickup-entry]').count(), 4); await resume(reopened.page);
  check('刷新及关闭重开独立浏览器context均恢复四项背包和隐藏状态，蓝瘦仍为0/4且未完成');
  // Return via the bridge to the original outpost pickup and confirm separation.
  await walk(reopened.page, [[50, -8], [13.5, -8], [13.5, -2], [2.7, -2], [1.5, -1.15]], '东岸沿道路返回驿站领取原蓝瘦文件夹');
  await reopened.page.waitForFunction(id => window.__OUTPOST_DEBUG__.snapshot().collectedPickups.includes(id), ORIGINAL);
  s = await snap(reopened.page); inventory(s, IDS, true); assert.deepEqual(s.clues, [CLUE]); assert.deepEqual(s.memes, ['blue-mushroom']);
  assert.equal(await reopened.page.locator('#quest-count').innerText(), '1 / 4'); assert.equal(s.archive.completed, false);
  check('原驿站蓝瘦文件夹仍单独可拾取，只新增原图及一个meme，蓝瘦进度仅升至1/4');
  await reopened.context.close();
  const completed = await setup({ fixture: { version: 1, investigated: true, clues: CARDS, pickupInventory: IDS, collectedPickups: IDS, archive: { answers: { meaning: 'emotion', context: 'shared-self-mockery' }, completed: true } }, enter: false });
  s = await snap(completed.page); inventory(s, IDS, true); assert.deepEqual(sorted(s.clues), sorted(CARDS)); assert.equal(s.archive.completed, true); assert.equal(await completed.page.locator('#quest-count').innerText(), '已完成');
  await completed.page.reload({ waitUntil: 'networkidle' }); await completed.page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  assert.equal((await snap(completed.page)).archive.completed, true); inventory(await snap(completed.page), IDS, true);
  check('已有蓝瘦四卡和正确完成状态与四占位共存，刷新保持已完成'); await completed.context.close();
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) {
  report.passed = false; report.errors.push(error.stack || String(error)); console.error(error); process.exitCode = 1;
  for (const context of browser.contexts()) for (const page of context.pages()) { await shot(page, 'four-pickups-test-failure').catch(() => {}); const state = await snap(page).catch(() => null); report.failureState = state; console.log(JSON.stringify(state && { pose: state.pose, pickupInventory: state.pickupInventory, collectedPickups: state.collectedPickups, pickups: state.pickups, active: state.active })); }
} finally {
  report.finishedAt = new Date().toISOString(); await writeFile(out + 'four-pickups-browser-report.json', JSON.stringify(report, null, 2)); await browser.close();
}
