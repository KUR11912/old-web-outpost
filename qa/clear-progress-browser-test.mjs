import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5173/';
const out = fileURLToPath(new URL('./', import.meta.url));
const SAVE = 'old-web-outpost:save:v1', BACKUP = SAVE + ':before-collection-repair';
const MUSIC = 'old-web-outpost:music', SOUND = 'old-web-outpost:footsteps';
const ALL = ['outpost-blue-mushroom-folder', 'field-folder-01', 'field-folder-02', 'field-folder-03', 'field-folder-04'];
const MEMES = ['blue-mushroom', 'friendship-boat', 'gg-or-mm', 'awesome-my-bro', 'devil-or-showoff'];
const initial = { version: 1, collectionVersion: 2, pickupInventory: ALL, collectedPickups: ALL, memes: MEMES, queriedMemes: MEMES,
  clues: ['missing-caption-image', 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'], investigated: true,
  archive: { answers: { meaning: 'emotion', context: 'shared-self-mockery' }, completed: true },
  pose: { x: 16.6, z: -33.7, yaw: 0, pitch: 0 } };
const music = JSON.stringify({ volume: .23, muted: true, lastAudibleVolume: .23 });
const report = { url, startedAt: new Date().toISOString(), checks: [], errors: [], screenshots: [],
  method: 'Isolated headless Chrome, one-time sessionStorage-guarded save seed. Real cancel/confirm UI actions; no access to the user IAB or its save.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addInitScript(({ initial, music, SAVE, BACKUP, MUSIC, SOUND }) => {
  if (sessionStorage.getItem('clear-progress-test:seeded')) return;
  sessionStorage.setItem('clear-progress-test:seeded', 'yes');
  localStorage.setItem(SAVE, JSON.stringify(initial));
  localStorage.setItem(BACKUP, JSON.stringify(initial));
  localStorage.setItem(MUSIC, music); localStorage.setItem(SOUND, 'off');
  localStorage.setItem('clear-progress-test:unrelated', 'keep');
}, { initial, music, SAVE, BACKUP, MUSIC, SOUND });
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
const snap = () => page.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const check = name => { report.checks.push({ name }); console.log('PASS: ' + name); };
async function shot(name) { await page.screenshot({ path: out + name + '.png', fullPage: true }); report.screenshots.push(name + '.png'); }
async function clearedState() {
  const state = await snap();
  for (const key of ['pickupInventory', 'collectedPickups', 'memes', 'queriedMemes', 'clues']) assert.deepEqual(state[key], [], key);
  assert.equal(state.investigated, false);
  assert.deepEqual(state.archive, { answers: { meaning: null, context: null }, completed: false });
  assert.deepEqual(state.pose, { x: 0, z: 9, yaw: 0, pitch: 0 });
  assert.equal(state.pickups.length, 5); assert.ok(state.pickups.every(item => item.visible));
  assert.equal(state.active, false); assert.equal(state.mapOpen, false);
  assert.equal(await page.locator('#quest-count').innerText(), '0 / 5');
  const stored = await page.evaluate(({ SAVE, BACKUP, MUSIC, SOUND }) => ({ save: localStorage.getItem(SAVE), backup: localStorage.getItem(BACKUP), music: localStorage.getItem(MUSIC), sound: localStorage.getItem(SOUND), other: localStorage.getItem('clear-progress-test:unrelated') }), { SAVE, BACKUP, MUSIC, SOUND });
  assert.equal(stored.backup, null);
  if (stored.save) { const parsed = JSON.parse(stored.save); assert.deepEqual(parsed.pickupInventory, []); assert.deepEqual(parsed.queriedMemes, []); }
  assert.equal(stored.music, music); assert.equal(stored.sound, 'off'); assert.equal(stored.other, 'keep');
  assert.equal(state.music.volume, .23); assert.equal(state.music.muted, true); assert.equal(state.footsteps.enabled, false);
}
try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  assert.equal(await page.locator('#reset-button').innerText(), '清空游玩进度');
  assert.deepEqual((await snap()).pickupInventory, ALL);
  await page.locator('#reset-button').click();
  assert.equal(await page.locator('#modal-title').innerText(), '清空游玩进度');
  assert.match(await page.locator('#modal-body').innerText(), /清空后无法恢复原进度/);
  await shot('clear-progress-confirm');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  const cancelled = await snap();
  assert.deepEqual(cancelled.pickupInventory, ALL); assert.deepEqual(cancelled.queriedMemes, MEMES);
  assert.equal(cancelled.archive.completed, true); assert.equal(cancelled.investigated, true);
  assert.ok(await page.evaluate(key => localStorage.getItem(key), BACKUP));
  check('顶部清空游玩进度按钮可见；确认窗口说明范围，取消不清空收藏/查询/调查/备份');
  await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click();
  await clearedState();
  assert.equal(await page.locator('#pause-title').innerText(), '重新开始探索');
  assert.equal(await page.locator('#toast').innerText(), '游玩进度已清空');
  check('确认后全部收藏/查询/调查和修正备份清空，五文件夹恢复，玩家回出生点并保持暂停');
  check('清空仍保留23%音乐音量、静音状态、音效关闭偏好及无关存储');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  await clearedState();
  await page.locator('#bag-button').click();
  assert.equal(await page.locator('[data-pickup-entry]').count(), 0);
  assert.match(await page.locator('#modal-title').innerText(), /0 件物品/);
  await shot('clear-progress-empty-bag');
  check('刷新后空背包/出生点/未查询状态保持；旧存档与旧备份均不反弹');
  assert.deepEqual(report.errors, []); check('浏览器运行错误为0，测试仅使用隔离存档');
  report.passed = true;
} catch (error) {
  report.passed = false; report.failure = error.stack || String(error); console.error(report.failure); process.exitCode = 1;
  await shot('clear-progress-failure').catch(() => {});
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(out + 'clear-progress-browser-report.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
