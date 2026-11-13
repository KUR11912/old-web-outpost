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
const AUTO_CLUES = ['missing-caption-image', 'collection-friendship-boat', 'collection-gg-or-mm', 'collection-awesome-my-bro', 'collection-devil-or-showoff'];
const SUPPLEMENTED = ['友谊的小船', '你是GG还是MM', '厉害了我的哥', '你是魔鬼还是秀儿'];
const report = {
  url, startedAt: new Date().toISOString(), checks: [], routes: [], errors: [], screenshots: [],
  method: 'Isolated browser storage. Main flow physically collects a folder, walks from the outpost to the archive terminal, and presses E. Other cases use explicitly labeled old-save fixtures near the terminal. Real keyboard/mouse input except IME composition event simulation. No writes to user browser state or production debug controls.',
};
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling'] });
const snap = page => page.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const { aim, aimPoint, walk, walkAxis } = createInputs(snap, report);
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS: ' + name); };
const terminalPose = { x: 16.6, z: -33.7, yaw: 0, pitch: 0 };
const fixture = (pose = terminalPose, inventory = []) => ({ version: 1, investigated: false, clues: [], memes: [], pickupInventory: inventory,
  archive: { answers: { meaning: null, context: null }, completed: false }, pose });
let activePage;

async function setup(initial) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, initial }) => {
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
  const item = (await snap(page)).interactables.find(i => i.id === 'old-terminal');
  await aimPoint(page, item.aim);
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__.snapshot().targetId === 'old-terminal');
  await page.keyboard.press('e');
  await page.locator('#terminal-query').waitFor({ state: 'visible' });
  assert.equal((await snap(page)).active, false);
  assert.equal(await page.locator('#modal-title').innerText(), '旧终端 / 老梗检索');
}
async function submit(page, text, enterKey = false) {
  await page.locator('#terminal-query').fill(text);
  if (enterKey) await page.locator('#terminal-query').press('Enter');
  else await page.locator('#terminal-search-submit').click();
}
async function feedback(page, text) {
  assert.ok((await page.locator('#terminal-search-feedback').innerText()).includes(text));
  assert.equal(await page.locator('#modal-body .source-note').count(), 0);
  assert.equal(await page.locator('#modal-body img[src*="blue-mushroom"]').count(), 0);
}
async function lockedDetail(page, id = BLUE) {
  await page.locator('#bag-button').click();
  const entry = page.locator(`[data-pickup-entry="${id}"]`);
  assert.match(await entry.innerText(), /尚未查询/);
  assert.equal(await entry.locator('img[src*="blue-mushroom"]').count(), 0);
  await page.locator(`[data-pickup-id="${id}"]`).click();
  const body = await page.locator('#modal-body').innerText();
  assert.match(body, /尚未查询/);
  assert.match(body, /IMG[\s\S]*ARCHIVE/);
  assert.ok(body.includes('已找到这个梗，但它的语境还不清楚。前往回声档案馆的旧终端，输入梗名查询。'));
  assert.doesNotMatch(body, /难受|想哭|读音示意|流行时期|资料说明|来源待核验|资料待补充/);
  assert.equal(await page.locator('#modal-body img, #modal-body details').count(), 0);
  assert.equal(await page.locator('#return-search, #terminal-query, #collect-clue').count(), 0);
}
async function shot(page, name) {
  await page.screenshot({ path: out + name + '.png', fullPage: true });
  report.screenshots.push(name + '.png');
}
async function assertQueriedDetail(page) {
  assert.match(await page.locator('#modal-body').innerText(), /已查询/);
  assert.match(await page.locator('#modal-body').innerText(), /难受[\s\S]*想哭/);
  assert.ok(await page.locator('#modal-body img[src*="blue-mushroom-meme.png"]').count() > 0);
  assert.ok(await page.locator('#modal-body .source-note').count() > 0);
  assert.equal(await page.locator('#collect-clue').count(), 0);
}

try {
  const main = await setup(fixture({ x: 1.5, z: -0.45, yaw: 0, pitch: 0 }));
  const page = main.page;
  assert.deepEqual((await snap(page)).pickupInventory, []);
  await page.locator('#bag-button').click();
  assert.equal(await page.locator('[data-pickup-entry]').count(), 0);
  await page.locator('#modal-close').click();
  await enter(page);
  await page.keyboard.down('w');
  try { await page.waitForFunction(id => window.__OUTPOST_DEBUG__.snapshot().pickupInventory.includes(id), BLUE); }
  finally { await page.keyboard.up('w'); }
  let state = await snap(page);
  assert.deepEqual(state.pickupInventory, [BLUE]);
  assert.deepEqual(state.queriedMemes, []);
  assert.ok(!state.clues.includes('missing-caption-image'));
  assert.match(await page.locator('#toast').innerText(), /发现野生梗：[\s\S]*资料尚未解锁/);
  check('新存档未拾取时背包为空；实际走近悬浮文件夹后只增加收藏，不解锁资料');
  await lockedDetail(page);
  await shot(page, 'meme-unqueried-bag');
  check('未查询背包列表和详情只显示名字/IMG ARCHIVE占位/查询引导，无真实图片、正文、折叠资料或检索捷径');
  await page.locator('#modal-close').click();
  const closedPose = (await snap(page)).pose;
  await enter(page); await page.waitForTimeout(200);
  assert.deepEqual((await snap(page)).pose, closedPose);
  await walk(page, [[1.5, -2], [13.5, -2], [13.5, -30], [16.6, -30], [16.6, -33.7]], '拾取文件夹后从驿站步行至回声档案馆旧终端');
  await terminal(page);
  assert.deepEqual((await snap(page)).queriedMemes, []);
  const initialSearch = await page.locator('#modal-body').innerText();
  assert.ok(initialSearch.includes('输入你已经找到的梗名，检索遗失的资料。'));
  for (const name of [...SUPPLEMENTED, '蓝瘦香菇']) assert.ok(!initialSearch.includes(name), 'No catalogue revealed by opening terminal');
  assert.equal(await page.locator('#terminal-query').getAttribute('placeholder'), '请输入已收集的梗名');
  await shot(page, 'meme-terminal-search');
  check('真实步行到旧终端并E交互，首先打开空检索页，不默认列出名字或自动解锁');

  await submit(page, '   '); await feedback(page, '请输入梗名');
  await submit(page, '蓝瘦'); await feedback(page, '没有找到匹配的资料，请检查梗名');
  await submit(page, '友谊的小船'); await feedback(page, '请先在地图中找到这个梗');
  assert.deepEqual((await snap(page)).pickupInventory, [BLUE]);
  assert.deepEqual((await snap(page)).queriedMemes, []);
  check('空输入、错误名称与未拾取条目分别反馈，严格匹配且不发放物品');

  const pausedPose = (await snap(page)).pose;
  await page.locator('#terminal-query').fill('');
  await page.locator('#terminal-query').pressSequentially('wasdbmeWASDBME');
  assert.equal(await page.locator('#terminal-query').inputValue(), 'wasdbmeWASDBME');
  state = await snap(page);
  assert.deepEqual(state.pose, pausedPose); assert.equal(state.mapOpen, false); assert.equal(state.active, false);
  assert.equal(await page.locator('#terminal-query').isVisible(), true);
  check('搜索框输入WASDBME只输入文字，不移动、转头、打开背包/地图或触发调查');

  await page.locator('#terminal-query').fill('蓝瘦香菇');
  await page.locator('#terminal-query').dispatchEvent('compositionstart', { data: '蓝瘦香菇' });
  await page.locator('#terminal-query').press('Enter');
  assert.deepEqual((await snap(page)).queriedMemes, []);
  await page.locator('#terminal-query').dispatchEvent('compositionend', { data: '蓝瘦香菇' });
  await page.locator('#terminal-query').evaluate(input => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, which: 229, isComposing: true, bubbles: true, cancelable: true })));
  assert.deepEqual((await snap(page)).queriedMemes, []);
  await page.waitForTimeout(180);
  check('中文输入法合成期间Enter和229候选确认均不误提交');

  const beforeQuery = await snap(page);
  await submit(page, '　蓝瘦香菇图片　', true);
  await page.locator('#return-search').waitFor({ state: 'visible' });
  state = await snap(page);
  assert.deepEqual(state.queriedMemes, ['blue-mushroom']);
  assert.deepEqual(state.pickupInventory, beforeQuery.pickupInventory);
  assert.equal(state.footsteps.pickup.plays, beforeQuery.footsteps.pickup.plays);
  await assertQueriedDetail(page);
  const persisted = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE);
  assert.deepEqual(persisted.queriedMemes, ['blue-mushroom']);
  assert.equal(await page.locator('#archive-update-feedback').isVisible(), true);
  assert.equal(await page.locator('#archive-update-feedback').getAttribute('role'), 'status');
  assert.equal(await page.locator('#archive-update-feedback').innerText(), '档案已更新：蓝瘦香菇');
  await shot(page, 'meme-query-detail');
  check('全角首尾空格和显式别名+回车查询成功，显示正确真实图/含义/语境/来源，立即单条保存且收藏数量与拾取奖励不变');

  await page.locator('#return-search').click();
  await submit(page, '蓝瘦香菇');
  await page.locator('#return-search').waitFor({ state: 'visible' });
  assert.deepEqual((await snap(page)).queriedMemes, ['blue-mushroom']);
  assert.deepEqual((await snap(page)).pickupInventory, [BLUE]);
  assert.equal(await page.locator('#archive-update-feedback').count(), 0);
  check('搜索按钮与回车均可提交；重复查询直接打开详情，不增加计数、奖励或重复更新反馈');
  await page.locator('#view-bag').click();
  const row = page.locator(`[data-pickup-entry="${BLUE}"]`);
  assert.match(await row.innerText(), /已查询/);
  assert.equal(await row.locator('img[src*="blue-mushroom-meme.png"]').count(), 1);
  assert.equal(await page.locator('[data-pickup-entry]').count(), 1);
  await page.locator(`[data-pickup-id="${BLUE}"]`).click();
  await assertQueriedDetail(page);
  assert.equal(await page.locator('#return-search').count(), 0);
  await shot(page, 'meme-queried-bag');
  check('查询后背包同步更新图片和完整资料，离开检索也能查看，但背包无远程检索入口');
  await page.locator('#modal-close').click();
  const beforeResume = (await snap(page)).pose;
  await enter(page); await page.waitForTimeout(200);
  assert.deepEqual((await snap(page)).pose, beforeResume);
  await aim(page, 0);
  await walkAxis(page, 'z', -32.9);
  await page.keyboard.press('Escape');
  const savedPose = (await snap(page)).pose;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  state = await snap(page);
  assert.deepEqual(state.queriedMemes, ['blue-mushroom']);
  assert.deepEqual(state.pickupInventory, [BLUE]);
  assert.deepEqual(state.pose, savedPose);
  await page.locator('#bag-button').click();
  await page.locator(`[data-pickup-id="${BLUE}"]`).click();
  await assertQueriedDetail(page);
  check('关闭详情后无持续移动，恢复控制可正常行走；刷新保留收藏/单条查询/位置并可直接查看完整资料');
  await main.context.close();

  const supplemented = await setup(fixture(terminalPose, ALL));
  await terminal(supplemented.page);
  await submit(supplemented.page, '蓝瘦香菇');
  await supplemented.page.locator('#return-search').waitFor({ state: 'visible' });
  assert.deepEqual((await snap(supplemented.page)).queriedMemes, ['blue-mushroom']);
  await supplemented.page.locator('#view-bag').click();
  assert.equal(await supplemented.page.locator('[data-pickup-entry]').count(), 5);
  for (const id of ALL.slice(1)) assert.match(await supplemented.page.locator(`[data-pickup-entry="${id}"]`).innerText(), /尚未查询/);
  check('查询蓝瘦后其余四梗仍锁定，五项收藏计数不变');
  await supplemented.page.locator('#modal-close').click();
  await terminal(supplemented.page);
  for (const [index, name] of SUPPLEMENTED.entries()) {
    const query = index === 1 ? '　你是ｇｇ还是ｍｍ　' : name;
    await submit(supplemented.page, query, index === 1);
    await supplemented.page.locator('#return-search').waitFor({ state: 'visible' });
    assert.equal(await supplemented.page.locator('#modal-title').innerText(), `旧终端 / ${name}`);
    assert.deepEqual((await snap(supplemented.page)).queriedMemes, MEMES.slice(0, index + 2));
    assert.deepEqual((await snap(supplemented.page)).pickupInventory, ALL);
    assert.ok(await supplemented.page.locator('#modal-body .source-note').count() > 0);
    assert.ok(await supplemented.page.locator('#modal-body img[src*="assets/memes/"]').count() > 0);
    await supplemented.page.locator('#return-search').click();
  }
  check('补齐后的四条本地档案均可按名称独立查询，GG/MM大小写与全半角匹配正确；详细内容和图片另见meme-pack-browser-test.mjs');
  await supplemented.context.close();
  const legacy = await setup({ ...fixture(terminalPose, ALL), memes: MEMES, clues: AUTO_CLUES, investigated: true });
  state = await snap(legacy.page);
  assert.deepEqual(state.pickupInventory, ALL); assert.deepEqual(state.queriedMemes, []); assert.equal(state.investigated, true);
  await lockedDetail(legacy.page);
  check('旧v1明确库存与邮箱进度保留，历史图卡和collection卡不作为查询证据');
  await legacy.context.close();

  const manual = await setup({ ...fixture(terminalPose, [BLUE]), clues: ['missing-caption-image', 'echo-meaning-note'], investigated: true });
  assert.deepEqual((await snap(manual.page)).queriedMemes, []);
  await lockedDetail(manual.page);
  await manual.page.locator('#modal-close').click();
  await terminal(manual.page);
  await submit(manual.page, '蓝瘦香菇');
  await manual.page.locator('#return-search').waitFor({ state: 'visible' });
  await assertQueriedDetail(manual.page);
  assert.deepEqual((await snap(manual.page)).queriedMemes, ['blue-mushroom']);
  assert.deepEqual((await snap(manual.page)).pickupInventory, [BLUE]);
  assert.ok((await snap(manual.page)).clues.includes('echo-meaning-note'));
  check('旧读音便笺保留为历史记录，蓝瘦资料仍须在终端成功查询才解锁，收藏数量不变');
  await manual.context.close();

  const explicit = await setup({ ...fixture(terminalPose, [BLUE]), queriedMemes: [], clues: ['missing-caption-image', 'echo-meaning-note'] });
  assert.deepEqual((await snap(explicit.page)).queriedMemes, []);
  await lockedDetail(explicit.page);
  await explicit.context.close();
  check('新式显式空查询记录为准，旧clues不会在每次读档时再次隐式解锁');

  const explicitRead = await setup({ ...fixture(terminalPose, [BLUE]), queriedMemes: ['blue-mushroom'], clues: [] });
  assert.deepEqual((await snap(explicitRead.page)).queriedMemes, ['blue-mushroom']);
  await explicitRead.page.locator('#bag-button').click();
  await explicitRead.page.locator(`[data-pickup-id="${BLUE}"]`).click();
  await assertQueriedDetail(explicitRead.page);
  await explicitRead.context.close();
  check('真实库存对应的显式queriedMemes保留，合法已查询蓝瘦可以直接在背包阅读');

  assert.deepEqual(report.errors, []);
  check('浏览器无运行错误，所有验收使用隔离存档，未更改用户进度');
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = error.stack || String(error);
  console.error(report.failure);
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: out + 'meme-search-failure.png', fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(out + 'meme-search-browser-report.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
