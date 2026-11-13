import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5173/';
const out = fileURLToPath(new URL('./', import.meta.url));
const SAVE = 'old-web-outpost:save:v1';
const BACKUP = SAVE + ':before-collection-repair';
const BLUE = 'outpost-blue-mushroom-folder';
const ALL = [BLUE, 'field-folder-01', 'field-folder-02', 'field-folder-03', 'field-folder-04'];
const MEMES = ['blue-mushroom', 'friendship-boat', 'gg-or-mm', 'awesome-my-bro', 'devil-or-showoff'];
const initial = { version: 1, collectionVersion: 2, pickupInventory: ALL, queriedMemes: MEMES,
  clues: ['missing-caption-image', 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'], investigated: true,
  archive: { answers: { meaning: 'emotion', context: 'shared-self-mockery' }, completed: true },
  pose: { x: 16.6, z: -33.7, yaw: 0, pitch: 0 } };
const report = { url, startedAt: new Date().toISOString(), checks: [], errors: [], screenshots: [],
  method: 'Independent headless Chrome context seeded with an explicit five-item save. Normal UI selection/application/undo/restore actions; no user browser state accessed.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
await context.addInitScript(({ key, initial }) => {
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial));
  localStorage.setItem('collection-repair-test:unrelated', 'preserve');
}, { key: SAVE, initial });
let page = await context.newPage();
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
const snap = () => page.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const check = name => { report.checks.push({ name }); console.log('PASS: ' + name); };
async function shot(name) {
  await page.screenshot({ path: out + name + '.png', fullPage: true }); report.screenshots.push(name + '.png');
}
async function openRepair() {
  if (await page.locator('#modal').evaluate(modal => modal.open)) await page.locator('#modal-close').click();
  await page.locator('#reset-button').click();
  await page.locator('#repair-collection').click();
  assert.equal(await page.locator('#modal-title').innerText(), '修正旧收藏记录');
}
async function chooseRepair() {
  for (const id of ALL.slice(1)) await page.locator(`[data-repair-pickup="${id}"]`).selectOption('remove');
  await page.locator(`[data-repair-pickup="${BLUE}"]`).selectOption('lock');
}
function assertUnrelated(state, before) {
  for (const key of ['pose', 'archive', 'clues', 'investigated']) assert.deepEqual(state[key], before[key], key);
  assert.equal(state.music.volume, before.music.volume);
  assert.equal(state.music.muted, before.music.muted);
}
async function assertRepaired(before) {
  const state = await snap();
  assert.deepEqual(state.pickupInventory, [BLUE]);
  assert.deepEqual(state.collectedPickups, [BLUE]);
  assert.deepEqual(state.queriedMemes, []);
  assert.deepEqual(state.memes, ['blue-mushroom']);
  assert.ok(state.pickups.filter(item => item.id !== BLUE).every(item => item.visible));
  assert.equal(state.pickups.find(item => item.id === BLUE).visible, false);
  assertUnrelated(state, before);
  const stored = await page.evaluate(({ save, backup }) => ({ current: JSON.parse(localStorage.getItem(save)),
    backup: JSON.parse(localStorage.getItem(backup)), other: localStorage.getItem('collection-repair-test:unrelated') }), { save: SAVE, backup: BACKUP });
  assert.deepEqual(stored.current.pickupInventory, [BLUE]);
  assert.deepEqual(stored.current.queriedMemes, []);
  assert.deepEqual(stored.backup.pickupInventory, ALL);
  assert.deepEqual(stored.backup.queriedMemes, MEMES);
  assert.equal(stored.other, 'preserve');
}
async function assertRestored(before) {
  const state = await snap();
  assert.deepEqual(state.pickupInventory, ALL);
  assert.deepEqual(state.queriedMemes, MEMES);
  assert.ok(state.pickups.every(item => !item.visible));
  assertUnrelated(state, before);
}
try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  const before = await snap();
  await openRepair();
  assert.equal(await page.locator('[data-repair-pickup]').count(), 5);
  await page.locator('#apply-collection-repair').click();
  assert.equal(await page.locator('#repair-feedback').innerText(), '请选择需要修正的收藏。');
  assert.deepEqual((await snap()).pickupInventory, ALL);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), BACKUP), null);
  check('修正界面默认保留全部条目；未选择更改不会修改进度或生成备份');
  await chooseRepair(); await shot('collection-repair-selection');
  await page.locator('#apply-collection-repair').click();
  await page.locator('#undo-collection-repair').waitFor({ state: 'visible' });
  await assertRepaired(before); await shot('collection-repair-done');
  check('选择四梗放回地图、蓝瘦仅重锁：背包只保留蓝瘦，四文件夹恢复，位置/历史任务/音量不变且备份完整');
  await page.locator('#undo-collection-repair').click();
  await assertRestored(before);
  assert.equal(await page.locator('#modal-title').innerText(), '已恢复收藏记录');
  check('撤销本次修正恢复原五项收藏和显式查询，地图文件夹重新隐藏');

  await openRepair(); await chooseRepair(); await page.locator('#apply-collection-repair').click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  await assertRepaired(before);
  await page.locator('#bag-button').click(); await page.locator(`[data-pickup-id="${BLUE}"]`).click();
  assert.match(await page.locator('#modal-body').innerText(), /尚未查询[\s\S]*IMG[\s\S]*ARCHIVE/);
  assert.equal(await page.locator('#modal-body img, #modal-body details').count(), 0);
  await shot('collection-repair-blue-locked');
  check('修正结果跨刷新保留：蓝瘦仅占位，无提前资料；其他四梗仍须地图拾取');
  await openRepair();
  assert.equal(await page.locator('[data-repair-pickup]').count(), 1);
  await page.locator('#restore-collection-backup').click();
  await assertRestored(before);
  check('刷新后仍能从修正界面恢复备份，真实旧进度可恢复');

  await context.close();
  const ongoing = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  await ongoing.addInitScript(({ key, initial }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial));
  }, { key: SAVE, initial: { ...initial, pickupInventory: [BLUE, 'field-folder-02'], queriedMemes: ['blue-mushroom'],
    pose: { x: 20.4, z: -44.3, yaw: 0, pitch: 0 } } });
  page = await ongoing.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  await openRepair();
  await page.locator('[data-repair-pickup="field-folder-02"]').selectOption('remove');
  await page.locator('#apply-collection-repair').click();
  await page.locator('#modal-close').click();
  await page.locator('#enter-drag').click();
  await page.keyboard.down('w');
  try { await page.waitForFunction(() => window.__OUTPOST_DEBUG__.snapshot().pickupInventory.includes('field-folder-01')); }
  finally { await page.keyboard.up('w'); }
  assert.deepEqual((await snap()).pickupInventory, [BLUE, 'field-folder-01']);
  await openRepair();
  await page.locator('#restore-collection-backup').click();
  assert.deepEqual((await snap()).pickupInventory, [BLUE, 'field-folder-01', 'field-folder-02']);
  assert.deepEqual((await snap()).queriedMemes, ['blue-mushroom']);
  await shot('collection-repair-preserves-new-pickup');
  check('修正后真实拾取新文件夹，再恢复旧备份时同时保留新收藏和旧收藏');
  assert.deepEqual(report.errors, []); check('修复与恢复浏览器运行错误0，未操作用户存档'); report.passed = true;
} catch (error) {
  report.passed = false; report.failure = error.stack || String(error); console.error(report.failure); process.exitCode = 1;
  await shot('collection-repair-failure').catch(() => {});
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(out + 'collection-repair-browser-report.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
