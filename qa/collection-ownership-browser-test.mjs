import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createInputs } from './four-pickups-input-helpers.mjs';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5173/';
const out = fileURLToPath(new URL('./', import.meta.url));
const SAVE = 'old-web-outpost:save:v1';
const BLUE = 'outpost-blue-mushroom-folder';
const ALL = [BLUE, 'field-folder-01', 'field-folder-02', 'field-folder-03', 'field-folder-04'];
const MEMES = ['blue-mushroom', 'friendship-boat', 'gg-or-mm', 'awesome-my-bro', 'devil-or-showoff'];
const CLUES = ['missing-caption-image', 'collection-friendship-boat', 'collection-gg-or-mm', 'collection-awesome-my-bro', 'collection-devil-or-showoff'];
const OTHER_NAMES = ['友谊的小船', '你是GG还是MM', '厉害了我的哥', '你是魔鬼还是秀儿'];
const nearBlue = { x: 1.5, z: -.45, yaw: 0, pitch: 0 };
const terminalPose = { x: 16.6, z: -33.7, yaw: 0, pitch: 0 };
const report = { url, startedAt: new Date().toISOString(), checks: [], routes: [], errors: [], screenshots: [],
  method: 'Separate headless Chrome contexts only. Deliberately conflicting legacy save fixtures reproduce implicit inventory/research migration. Main flow uses real WASD pickup, walking to the terminal and E interaction. No access to user browser storage or tabs.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--disable-background-timer-throttling'] });
const snap = page => page.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const { aimPoint, walk } = createInputs(snap, report);
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS: ' + name); };
let activePage;

async function setup(initial) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  if (initial) await context.addInitScript(({ key, initial }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial));
  }, { key: SAVE, initial });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  activePage = page;
  return { context, page };
}
async function enter(page) {
  await page.locator('#enter-drag').click();
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__.snapshot().active);
}
async function terminal(page) {
  if (!(await snap(page)).active) await enter(page);
  await aimPoint(page, (await snap(page)).interactables.find(i => i.id === 'old-terminal').aim);
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__.snapshot().targetId === 'old-terminal');
  await page.keyboard.press('e');
  await page.locator('#terminal-query').waitFor({ state: 'visible' });
  assert.equal((await snap(page)).active, false);
}
async function submit(page, text) {
  await page.locator('#terminal-query').fill(text);
  await page.locator('#terminal-search-submit').click();
}
async function shot(page, name) {
  await page.screenshot({ path: out + name + '.png', fullPage: true });
  report.screenshots.push(name + '.png');
}
async function emptyBag(page) {
  const state = await snap(page);
  assert.deepEqual(state.pickupInventory, []);
  assert.deepEqual(state.collectedPickups, []);
  assert.deepEqual(state.queriedMemes, []);
  assert.ok(state.pickups.every(item => item.visible));
  await page.locator('#bag-button').click();
  assert.equal(await page.locator('[data-pickup-entry]').count(), 0);
  assert.equal(await page.locator('#modal-body img').count(), 0);
  assert.match(await page.locator('#modal-body').innerText(), /还没有探索收藏/);
}
async function collectBlue(page) {
  await enter(page);
  await page.keyboard.down('w');
  try { await page.waitForFunction(id => window.__OUTPOST_DEBUG__.snapshot().pickupInventory.includes(id), BLUE); }
  finally { await page.keyboard.up('w'); }
  const state = await snap(page);
  assert.deepEqual(state.pickupInventory, [BLUE]);
  assert.deepEqual(state.queriedMemes, []);
  assert.equal(state.pickups.find(item => item.id === BLUE).visible, false);
  assert.ok(state.pickups.filter(item => item.id !== BLUE).every(item => item.visible));
  assert.match(await page.locator('#toast').innerText(), /蓝瘦香菇。资料尚未解锁/);
}
async function lockedBlue(page) {
  await page.locator('#bag-button').click();
  assert.equal(await page.locator('[data-pickup-entry]').count(), 1);
  const row = page.locator(`[data-pickup-entry="${BLUE}"]`);
  assert.match(await row.innerText(), /尚未查询/);
  assert.equal(await row.locator('img').count(), 0);
  await page.locator(`[data-pickup-id="${BLUE}"]`).click();
  const body = await page.locator('#modal-body').innerText();
  assert.match(body, /尚未查询[\s\S]*IMG[\s\S]*ARCHIVE[\s\S]*蓝瘦香菇/);
  assert.doesNotMatch(body, /难受|想哭|读音|含义|流行时期|资料说明/);
  assert.equal(await page.locator('#modal-body img, #modal-body details').count(), 0);
}

try {
  const fresh = await setup();
  await emptyBag(fresh.page);
  await shot(fresh.page, 'collection-ownership-empty-start');
  check('无存档的新开局背包为空，五个文件夹全部可拾取，没有默认梗图或资料');
  await fresh.context.close();

  const polluted = { version: 1, pickupInventory: [], collectedPickups: ALL, memes: MEMES,
    clues: [...CLUES, 'echo-meaning-note', 'echo-chat-context'], queriedMemes: ['blue-mushroom'], investigated: true,
    archive: { answers: { meaning: 'emotion', context: null }, completed: false }, pose: nearBlue };
  const main = await setup(polluted), page = main.page;
  await emptyBag(page);
  assert.equal((await snap(page)).investigated, true);
  assert.deepEqual((await snap(page)).archive.answers, polluted.archive.answers);
  await shot(page, 'collection-ownership-legacy-empty');
  check('旧卡片/梗名单/拾取标记与明确空库存冲突时不发物；孤立蓝瘦查询被过滤，位置和历史任务保留');
  await page.locator('#modal-close').click();
  await collectBlue(page);
  await lockedBlue(page);
  await shot(page, 'collection-ownership-blue-unqueried');
  check('真实走近蓝瘦文件夹才入包；旧调查记录不会提前解锁，拾取后仅名字/IMG占位和尚未查询');
  await page.locator('#modal-close').click();
  await enter(page);
  await walk(page, [[1.5, -2], [13.5, -2], [13.5, -30], [16.6, -30], [16.6, -33.7]], '从真实蓝瘦拾取点沿道路走到旧终端');
  await terminal(page);
  for (const name of OTHER_NAMES) {
    await submit(page, name);
    assert.equal(await page.locator('#terminal-search-feedback').innerText(), '请先在地图中找到这个梗');
    assert.equal(await page.locator('#modal-body img, #modal-body details').count(), 0);
    assert.deepEqual((await snap(page)).pickupInventory, [BLUE]);
    assert.deepEqual((await snap(page)).queriedMemes, []);
  }
  check('四个未拾取梗逐一在终端查询均拒绝，不补发物品或泄露资料');
  await submit(page, '蓝瘦香菇');
  await page.locator('#return-search').waitFor({ state: 'visible' });
  assert.deepEqual((await snap(page)).queriedMemes, ['blue-mushroom']);
  assert.deepEqual((await snap(page)).pickupInventory, [BLUE]);
  assert.match(await page.locator('#modal-body').innerText(), /难受[\s\S]*想哭/);
  assert.ok(await page.locator('#modal-body img[src*="blue-mushroom-meme.png"]').count() > 0);
  await shot(page, 'collection-ownership-blue-queried');
  await page.locator('#return-search').click();
  await submit(page, '蓝瘦香菇');
  await page.locator('#return-search').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#archive-update-feedback').count(), 0);
  assert.deepEqual((await snap(page)).pickupInventory, [BLUE]);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  assert.deepEqual((await snap(page)).queriedMemes, ['blue-mushroom']);
  assert.deepEqual((await snap(page)).pickupInventory, [BLUE]);
  await page.locator('#bag-button').click();
  await page.locator(`[data-pickup-id="${BLUE}"]`).click();
  assert.match(await page.locator('#modal-body').innerText(), /难受[\s\S]*想哭/);
  check('蓝瘦与其他梗一样，只有终端成功查询才显示完整信息；重复不加物，刷新后查询状态保留');
  await main.context.close();

  for (const fixture of [
    { version: 1, clues: ['missing-caption-image', 'echo-meaning-note'], pose: nearBlue },
    { version: 1, collectionVersion: 2, pickupInventory: [], queriedMemes: ['blue-mushroom'], pose: nearBlue },
  ]) {
    const legacy = await setup(fixture);
    await emptyBag(legacy.page);
    await legacy.page.locator('#modal-close').click();
    await collectBlue(legacy.page); await lockedBlue(legacy.page);
    await legacy.context.close();
  }
  check('旧版仅资料卡和新版孤立查询两种存档均不授予蓝瘦；其后首次拾取仍保持未查询');

  const realInventory = [BLUE, 'field-folder-02', 'field-folder-03', 'field-folder-04'];
  const realQueries = ['blue-mushroom', 'gg-or-mm', 'devil-or-showoff'];
  const genuine = await setup({ version: 1, collectionVersion: 2, pickupInventory: realInventory,
    queriedMemes: realQueries, clues: ['echo-meaning-note'], investigated: true, pose: terminalPose });
  assert.deepEqual((await snap(genuine.page)).pickupInventory, realInventory);
  assert.deepEqual((await snap(genuine.page)).queriedMemes, realQueries);
  await genuine.page.locator('#bag-button').click();
  assert.equal(await genuine.page.locator('[data-pickup-entry]').count(), 4);
  for (const id of realInventory) {
    const row = genuine.page.locator(`[data-pickup-entry="${id}"]`);
    assert.match(await row.innerText(), id === 'field-folder-03' ? /尚未查询/ : /已查询/);
  }
  await genuine.context.close();
  check('已明确保存的四件真实收藏和三条显式查询保留，修复不会全局清空旧进度');
  assert.deepEqual(report.errors, []); check('隔离浏览器运行错误0，未操作用户存档');
  report.passed = true;
} catch (error) {
  report.passed = false; report.failure = error.stack || String(error); console.error(report.failure); process.exitCode = 1;
  if (activePage && !activePage.isClosed()) {
    await shot(activePage, 'collection-ownership-failure').catch(() => {});
    report.failureState = await snap(activePage).catch(() => null);
  }
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(out + 'collection-ownership-browser-report.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
