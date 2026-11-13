import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createInputs } from './four-pickups-input-helpers.mjs';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5173/';
const out = fileURLToPath(new URL('./', import.meta.url));
const pack = JSON.parse(await readFile(new URL('../meme_asset/source/old-web-meme-pack/memes.json', import.meta.url), 'utf8'));
const SAVE = 'old-web-outpost:save:v1';
const BLUE = 'outpost-blue-mushroom-folder';
const IDS = ['field-folder-01', 'field-folder-02', 'field-folder-03', 'field-folder-04'];
const MEMES = ['friendship-boat', 'gg-or-mm', 'awesome-my-bro', 'devil-or-showoff'];
const CLUES = ['collection-friendship-boat', 'collection-gg-or-mm', 'collection-awesome-my-bro', 'collection-devil-or-showoff'];
const terminalPose = { x: 16.6, z: -33.7, yaw: 0, pitch: 0 };
const fixture = (pose = terminalPose, inventory = []) => ({ version: 1, investigated: false, clues: [], memes: [], pickupInventory: inventory,
  archive: { answers: { meaning: null, context: null }, completed: false }, pose });
const report = { url, startedAt: new Date().toISOString(), checks: [], routes: [], errors: [], screenshots: [],
  method: 'Isolated browser contexts; main run starts from an empty saved pose near the first folder, physically collects all four with WASD, walks to the terminal and presses E. Other cases are labeled legacy-save fixtures. No user browser storage or production debug state is written.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling'] });
const snap = page => page.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const { aim, aimPoint, walk } = createInputs(snap, report);
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS: ' + name); };
let activePage;
async function setup(initial, storageState) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, storageState });
  if (initial) await context.addInitScript(({ key, initial }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial)); }, { key: SAVE, initial });
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
async function submit(page, text, useEnter = false) {
  await page.locator('#terminal-query').fill(text);
  if (useEnter) await page.locator('#terminal-query').press('Enter');
  else await page.locator('#terminal-search-submit').click();
}
async function shot(page, name) {
  await page.screenshot({ path: out + name + '.png', fullPage: true });
  report.screenshots.push(name + '.png');
}
async function locked(page, index) {
  await page.locator('#bag-button').click();
  assert.match(await page.locator(`[data-pickup-entry="${IDS[index]}"]`).innerText(), /尚未查询/);
  assert.equal(await page.locator(`[data-pickup-entry="${IDS[index]}"] img`).count(), 0);
  await page.locator(`[data-pickup-id="${IDS[index]}"]`).click();
  const body = await page.locator('#modal-body').innerText();
  assert.ok(body.includes(pack.entries[index].displayName));
  assert.match(body, /尚未查询[\s\S]*IMG[\s\S]*ARCHIVE/);
  assert.equal(await page.locator('#modal-body img, #modal-body details, [data-archive-image]').count(), 0);
  for (const entry of pack.entries) for (const hidden of [entry.summary, entry.period, entry.paragraphs[0], entry.example.text, entry.contextNote, entry.provenanceNote]) assert.ok(!body.includes(hidden));
}
async function fullDetail(page, index) {
  const entry = pack.entries[index];
  const body = await page.locator('#modal-body').innerText();
  for (const content of ['已查询', entry.displayName, entry.archiveTitle, entry.period, entry.summary, ...entry.paragraphs, entry.example.label, entry.example.text, entry.contextNote, entry.imageCaption]) assert.ok(body.includes(content), 'Missing visible content: ' + content);
  assert.equal(await page.locator('[data-archive-clue]').count(), 1);
  assert.equal(await page.locator('[data-archive-clue]').getAttribute('data-archive-clue'), CLUES[index]);
  assert.equal(await page.locator('#modal-body img[src*="blue-mushroom"]').count(), 0);
  for (let n = 0; n < pack.entries.length; n++) if (n !== index) assert.ok(!body.includes(pack.entries[n].summary));
  const details = page.locator('#modal-body details.source-note');
  assert.equal(await details.count(), 1);
  assert.equal(await details.getAttribute('open'), null);
  const sourceText = await details.textContent();
  assert.ok(sourceText.includes(entry.provenanceNote));
  assert.ok(!body.includes(entry.provenanceNote), 'Provenance belongs inside closed details');
  for (const source of entry.sources) {
    assert.ok(sourceText.includes(source.title)); assert.ok(sourceText.includes(source.publisher)); assert.ok(sourceText.includes(source.date));
    assert.ok(await details.locator(`a[href="${source.url}"]`).count() > 0);
  }
  const images = page.locator('.archive-gallery-image');
  assert.equal(await images.count(), index === 3 ? 2 : 1);
  const paths = index === 3 ? entry.gallery.map(image => image.path) : [entry.image];
  const dimensions = [];
  for (const [n, path] of paths.entries()) {
    const meta = pack.imageSources.find(source => source.path === path), localPath = 'assets/memes/' + path.split('/').at(-1);
    const img = images.nth(n);
    assert.ok((await img.getAttribute('src')).endsWith(localPath));
    await img.evaluate(async img => { if (!img.complete) await new Promise((resolve, reject) => { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', reject, { once: true }); }); });
    const metrics = await img.evaluate(img => { const r = img.getBoundingClientRect(), style = getComputedStyle(img); return { width: r.width, height: r.height, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, objectFit: style.objectFit }; });
    assert.ok(metrics.naturalWidth > 0 && metrics.naturalHeight > 0);
    assert.equal(metrics.objectFit, 'contain');
    assert.ok(Math.abs(metrics.width / metrics.height - metrics.naturalWidth / metrics.naturalHeight) < .03, 'Full image aspect ratio preserved');
    dimensions.push({ path: localPath, ...metrics });
    for (const text of [meta.creator, meta.note]) assert.ok(sourceText.includes(text), 'Image attribution: ' + text);
    for (const href of [meta.sourcePage, meta.originalUrl]) assert.ok(await details.locator(`a[href="${href}"]`).count() > 0, 'Image link: ' + href);
  }
  return dimensions;
}

const localRoutes = [
  [[13.5, -30], [15, -30], [15, -36.8], [16.5, -36.8], [16.5, -44.3], [20.4, -44.3]],
  [[13.5, -20], [18.5, -20], [18.5, -18.3], [24.5, -18.3]],
  [[26.6, -8], [26.6, 7.3]],
  [[50, -8], [58, -8], [58, 0], [60, 0], [60, 1.3]],
];
try {
  const main = await setup(fixture({ x: 20.4, z: -44.3, yaw: 0, pitch: 0 }));
  const page = main.page;
  assert.deepEqual((await snap(page)).pickupInventory, []);
  await enter(page);
  for (const [index, id] of IDS.entries()) {
    if (index > 0) await walk(page, index === 2 ? [[13.5, -8], ...localRoutes[index]] : localRoutes[index], `沿道路前往 ${pack.entries[index].displayName}`);
    const item = (await snap(page)).pickups.find(item => item.id === id);
    assert.equal(item.visible, true);
    const side = Math.sign(localRoutes[index].at(-1)[1] - item.basePosition.z);
    await walk(page, [[item.basePosition.x, item.basePosition.z + side * .55]], `实际靠近拾取 ${pack.entries[index].displayName}`);
    await page.waitForFunction(id => window.__OUTPOST_DEBUG__.snapshot().pickupInventory.includes(id), id);
    const state = await snap(page);
    assert.deepEqual(state.pickupInventory, IDS.slice(0, index + 1));
    assert.deepEqual(state.queriedMemes, []);
    assert.equal(state.pickups.find(item => item.id === id).visible, false);
    await locked(page, index);
    if (index === 0) await shot(page, 'meme-pack-unqueried-bag');
    check(`实际拾取 ${pack.entries[index].displayName} 后，背包仅名称与统一占位图，正文/时期/来源/图片全锁定`);
    await page.locator('#modal-close').click(); await enter(page);
    await walk(page, [...localRoutes[index]].reverse(), `${pack.entries[index].displayName} 原路返回石板路`);
  }
  await walk(page, [[13.5, -8], [13.5, -30], [16.6, -30], [16.6, -33.7]], '从东岸经石桥返回旧终端');
  await terminal(page);
  assert.deepEqual((await snap(page)).queriedMemes, []);
  await shot(page, 'meme-pack-terminal-search');
  const paused = (await snap(page)).pose;
  await page.locator('#terminal-query').pressSequentially('wasdbme');
  assert.deepEqual((await snap(page)).pose, paused);
  assert.equal((await snap(page)).mapOpen, false);
  assert.equal(await page.locator('#terminal-query').inputValue(), 'wasdbme');
  await page.locator('#terminal-query').fill('友谊的小船');
  await page.locator('#terminal-query').dispatchEvent('compositionstart', { data: '友谊的小船' });
  await page.locator('#terminal-query').press('Enter');
  assert.deepEqual((await snap(page)).queriedMemes, []);
  await page.locator('#terminal-query').dispatchEvent('compositionend', { data: '友谊的小船' });
  await page.locator('#terminal-query').evaluate(input => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, which: 229, isComposing: true, bubbles: true, cancelable: true })));
  assert.deepEqual((await snap(page)).queriedMemes, []);
  await page.waitForTimeout(180);
  await submit(page, '  '); assert.equal(await page.locator('#terminal-search-feedback').innerText(), '请输入梗名');
  await submit(page, '没有这个名字'); assert.equal(await page.locator('#terminal-search-feedback').innerText(), '没有找到匹配的资料，请检查梗名');
  await submit(page, '蓝瘦香菇'); assert.equal(await page.locator('#terminal-search-feedback').innerText(), '请先在地图中找到这个梗');
  assert.deepEqual((await snap(page)).pickupInventory, IDS);
  check('步行到旧终端才打开检索；快捷键输入不影响角色、IME候选确认不误提交；空/错误/未拾取搜索均无奖励');
  for (const [index, meme] of MEMES.entries()) {
    const before = await snap(page);
    const query = index === 1 ? '　你是ｇｇ还是ｍｍ　' : pack.entries[index].displayName;
    await submit(page, query, index % 2 === 1);
    await page.locator('#return-search').waitFor({ state: 'visible' });
    const dimensions = await fullDetail(page, index);
    const state = await snap(page);
    assert.deepEqual(state.queriedMemes, MEMES.slice(0, index + 1));
    assert.deepEqual(state.pickupInventory, IDS);
    assert.equal(state.footsteps.pickup.plays, before.footsteps.pickup.plays);
    assert.equal(await page.locator('#archive-update-feedback').innerText(), '档案已更新：' + pack.entries[index].displayName);
    assert.deepEqual((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE)).queriedMemes, MEMES.slice(0, index + 1));
    await shot(page, 'meme-pack-detail-' + meme);
    await page.locator('[data-archive-image]').first().click();
    await page.locator('#return-archive').waitFor({ state: 'visible' });
    assert.equal((await snap(page)).active, false);
    assert.ok((await page.locator('#modal-body img').first().getAttribute('src')).endsWith(pack.entries[index].image.split('/').at(-1)));
    if (index === 0) await shot(page, 'meme-pack-comic-zoom');
    await page.locator('#return-archive').click();
    await fullDetail(page, index);
    if (index === 3) {
      await page.locator('.archive-gallery-image').last().scrollIntoViewIfNeeded();
      await shot(page, 'meme-pack-related-gallery');
    }
    await page.locator('#view-bag').click();
    assert.equal(await page.locator('[data-pickup-entry]').count(), 4);
    for (const [n, id] of IDS.entries()) {
      const row = page.locator(`[data-pickup-entry="${id}"]`);
      assert.match(await row.innerText(), n <= index ? /已查询/ : /尚未查询/);
      assert.equal(await row.locator('img').count(), n <= index ? 1 : 0);
    }
    await page.locator(`[data-pickup-id="${IDS[index]}"]`).click();
    await fullDetail(page, index);
    if (index === 0) await shot(page, 'meme-pack-queried-bag');
    await page.locator('#modal-close').click(); await terminal(page);
    await submit(page, pack.entries[index].aliases[0]);
    await page.locator('#return-search').waitFor({ state: 'visible' });
    await fullDetail(page, index);
    assert.deepEqual((await snap(page)).queriedMemes, MEMES.slice(0, index + 1));
    assert.deepEqual((await snap(page)).pickupInventory, IDS);
    assert.equal((await snap(page)).footsteps.pickup.plays, before.footsteps.pickup.plays);
    assert.equal(await page.locator('#archive-update-feedback').count(), 0);
    await page.locator('#return-search').click();
    check(`${pack.entries[index].displayName} 独立查询正确完整档案、本地原比例图片和署名，放大可返回；背包同步且重复搜索不重复奖励`, dimensions);
  }
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  assert.deepEqual((await snap(page)).queriedMemes, MEMES);
  assert.deepEqual((await snap(page)).pickupInventory, IDS);
  for (const [index, id] of IDS.entries()) {
    await page.locator('#bag-button').click(); await page.locator(`[data-pickup-id="${id}"]`).click();
    await fullDetail(page, index); await page.locator('#modal-close').click();
  }
  const stored = await main.context.storageState(); await main.context.close();
  const reopened = await setup(null, stored);
  assert.deepEqual((await snap(reopened.page)).queriedMemes, MEMES);
  assert.deepEqual((await snap(reopened.page)).pickupInventory, IDS);
  await reopened.context.close();
  check('刷新和新浏览器上下文重新读档，四条查询进度与收藏保持一致，背包直接可读');

  const legacy = await setup({ ...fixture(terminalPose, [BLUE, ...IDS]), memes: ['blue-mushroom', ...MEMES], clues: ['missing-caption-image', ...CLUES], investigated: true });
  assert.deepEqual((await snap(legacy.page)).pickupInventory, [BLUE, ...IDS]);
  assert.deepEqual((await snap(legacy.page)).queriedMemes, []);
  for (let index = 0; index < IDS.length; index++) { await locked(legacy.page, index); await legacy.page.locator('#modal-close').click(); }
  await terminal(legacy.page); await submit(legacy.page, '厉害了我的哥');
  await legacy.page.locator('#return-search').waitFor({ state: 'visible' }); await fullDetail(legacy.page, 2);
  assert.deepEqual((await snap(legacy.page)).queriedMemes, ['awesome-my-bro']);
  assert.deepEqual((await snap(legacy.page)).pickupInventory, [BLUE, ...IDS]);
  await legacy.context.close();
  check('旧版本只拾取的五条收藏原样迁移；新补资料不自动解锁，已有厉害了我的哥可直接查询补全');

  const oldBlue = await setup({ ...fixture(terminalPose, [BLUE, ...IDS]), clues: ['missing-caption-image', 'echo-meaning-note'], investigated: true });
  assert.deepEqual((await snap(oldBlue.page)).queriedMemes, []);
  await oldBlue.page.locator('#bag-button').click(); await oldBlue.page.locator(`[data-pickup-id="${BLUE}"]`).click();
  assert.match(await oldBlue.page.locator('#modal-body').innerText(), /尚未查询/);
  assert.equal(await oldBlue.page.locator('#modal-body img, #modal-body details, [data-archive-clue]').count(), 0);
  await oldBlue.page.locator('#modal-close').click();
  await terminal(oldBlue.page); await submit(oldBlue.page, '蓝瘦香菇');
  await oldBlue.page.locator('#return-search').waitFor({ state: 'visible' });
  assert.match(await oldBlue.page.locator('#modal-body').innerText(), /难受[\s\S]*想哭/);
  assert.ok(await oldBlue.page.locator('#modal-body img[src*="blue-mushroom-meme.png"]').count() > 0);
  assert.equal(await oldBlue.page.locator('#modal-body [data-archive-clue]').count(), 4);
  assert.equal(await oldBlue.page.locator('#archive-update-feedback').count(), 1);
  await oldBlue.page.locator('#return-search').click(); await submit(oldBlue.page, '蓝瘦香菇');
  await oldBlue.page.locator('#return-search').waitFor({ state: 'visible' });
  assert.equal(await oldBlue.page.locator('#archive-update-feedback').count(), 0);
  assert.deepEqual((await snap(oldBlue.page)).queriedMemes, ['blue-mushroom']);
  assert.deepEqual((await snap(oldBlue.page)).pickupInventory, [BLUE, ...IDS]);
  await oldBlue.context.close();
  check('旧蓝瘦线索不自动解锁，首次终端查询后已有图与四段档案正常，重复查询无奖励，其余四梗仍锁定');

  const explicitBlue = await setup({ ...fixture(terminalPose, [BLUE, ...IDS]), queriedMemes: ['blue-mushroom'] });
  assert.deepEqual((await snap(explicitBlue.page)).queriedMemes, ['blue-mushroom']);
  await explicitBlue.page.locator('#bag-button').click(); await explicitBlue.page.locator(`[data-pickup-id="${BLUE}"]`).click();
  assert.match(await explicitBlue.page.locator('#modal-body').innerText(), /已查询[\s\S]*难受[\s\S]*想哭/);
  assert.equal(await explicitBlue.page.locator('#modal-body [data-archive-clue]').count(), 4);
  await explicitBlue.context.close();
  check('原有明确库存与显式查询记录保持，蓝瘦香菇已查询资料仍能直接回看');
  assert.deepEqual(report.errors, []); check('浏览器运行错误为0，资源加载有效；全部使用隔离存档'); report.passed = true;
} catch (error) {
  report.passed = false; report.failure = error.stack || String(error); console.error(report.failure); process.exitCode = 1;
  if (activePage && !activePage.isClosed()) { await shot(activePage, 'meme-pack-failure').catch(() => {}); report.failureState = await snap(activePage).catch(() => null); }
} finally {
  report.finishedAt = new Date().toISOString(); await writeFile(out + 'meme-pack-browser-report.json', JSON.stringify(report, null, 2) + '\n'); await browser.close();
}
