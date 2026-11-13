import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createInputs } from './four-pickups-input-helpers.mjs';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5181/';
const out = fileURLToPath(new URL('./', import.meta.url));
const SAVE = 'old-web-outpost:save:v1';
const BLUE = 'outpost-blue-mushroom-folder';
const QUEST = ['missing-caption-image', 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'];
const ALL = [BLUE, 'field-folder-01', 'field-folder-02', 'field-folder-03', 'field-folder-04'];
const NAMES = ['蓝瘦香菇图片', '友谊的小船', '你是GG还是MM', '厉害了我的哥', '你是魔鬼还是秀儿'];
const report = { url, startedAt: new Date().toISOString(), checks: [], routes: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling'] });
const snap = page => page.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const { walk } = createInputs(snap, report);
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS: ' + name); };
const shot = (page, name) => page.screenshot({ path: out + name + '.png', fullPage: true });
const sorted = values => [...values].sort();

async function setup(fixture, enter = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  if (fixture) await context.addInitScript(({ key, fixture }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture));
  }, { key: SAVE, fixture });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  if (enter) await page.locator('#enter-drag').click();
  return { context, page };
}

async function bag(page, ids, screenshot) {
  await page.keyboard.press('b');
  assert.equal(await page.locator('[data-pickup-entry]').count(), ids.length);
  assert.equal(await page.locator('#modal [data-clue-id]').count(), 0);
  assert.equal(await page.locator('#modal .missing-card').count(), 0);
  const text = await page.locator('#modal-body').innerText();
  assert.match(text, /探索收藏/);
  assert.doesNotMatch(text, /蓝瘦香菇\s*·|张线索|调查资料|尚未记录资料|尚未拾取老梗|不计入下方|老梗收藏\s*\d/);
  assert.match(await page.locator('#modal-title').innerText(), new RegExp(`收藏背包.*${ids.length} 件物品`));
  assert.equal(await page.locator('#bag-button').innerText(), `收藏背包 [B] · ${ids.length}`);
  const entries = await page.locator('[data-pickup-entry]').evaluateAll(nodes => nodes.map(node => ({
    id: node.dataset.pickupEntry, title: node.querySelector('h3')?.textContent,
    image: node.querySelector('img')?.getAttribute('src'),
    complete: node.querySelector('img')?.complete, width: node.querySelector('img')?.naturalWidth,
  })));
  assert.deepEqual(sorted(entries.map(entry => entry.id)), sorted(ids));
  for (const entry of entries) {
    assert.equal(entry.title, NAMES[ALL.indexOf(entry.id)]);
    assert.ok(entry.complete && entry.width > 0);
  }
  if (ids.includes(BLUE)) {
    assert.equal(entries.filter(entry => entry.id === BLUE).length, 1);
    assert.match(entries.find(entry => entry.id === BLUE).image, /assets\/blue-mushroom-meme\.png$/);
  }
  if (screenshot) await shot(page, screenshot);
  return entries;
}

async function details(page, id, expectedCount) {
  await page.locator(`button[data-pickup-id="${id}"]`).click();
  assert.match(await page.locator('#modal-title').innerText(), /^收藏\s*\//);
  assert.ok((await page.locator('#modal-body').innerText()).includes(NAMES[ALL.indexOf(id)]));
  if (id === BLUE) {
    const image = page.locator('#modal img.clue-image').first();
    assert.ok(await image.evaluate(node => node.complete && node.naturalWidth > 0 && node.getAttribute('src').endsWith('assets/blue-mushroom-meme.png')));
  }
  await page.locator('#return-bag').click();
  assert.equal(await page.locator('[data-pickup-entry]').count(), expectedCount);
}

try {
  const hashes = JSON.parse(await readFile(out + 'unified-collection-baseline/source-hashes.json', 'utf8'));
  report.protectedSources = [];
  for (const item of hashes.filter(item => !['main.ts', 'investigation-ui.ts', 'pickup-data.ts'].includes(item.file))) {
    const current = createHash('sha256').update(await readFile(new URL('../src/' + item.file, import.meta.url))).digest('hex').toUpperCase();
    assert.equal(current, item.sha256, item.file + ' unchanged');
    report.protectedSources.push({ file: item.file, unchanged: true, sha256: current });
  }
  check('存档、拾取绑定/动画、任务资料、地图/山体/世界与样式源码保持原样', report.protectedSources);

  const empty = await setup();
  const registry = await empty.page.evaluate(async () => {
    const current = await import('/src/pickup-data.ts');
    const before = await import('/qa/unified-collection-baseline/pickup-data.ts');
    const snapshot = module => ({ pickups: module.PICKUPS, memes: module.MEMES, style: module.PICKUP_STYLE, content: module.PICKUPS.map(module.getPickupContent) });
    return { current: snapshot(current), before: snapshot(before) };
  });
  assert.deepEqual(registry.current, registry.before);
  report.registryUnchanged = true;
  await bag(empty.page, [], 'unified-collection-empty');
  assert.equal(await empty.page.locator('#quest-count').innerText(), '0 / 4');
  assert.ok((await snap(empty.page)).pickups.every(pickup => pickup.visible));
  check('空背包仅展示探索收藏空态，计数0，无旧线索占位列表');
  await empty.context.close();

  const userIds = [BLUE, 'field-folder-02', 'field-folder-03'];
  const user = await setup({ version: 1, pickupInventory: userIds, collectedPickups: userIds, clues: [QUEST[0]], memes: ['blue-mushroom'] });
  const before = await snap(user.page);
  const userEntries = await bag(user.page, userIds, 'unified-collection-user-bag');
  await details(user.page, BLUE, 3);
  await details(user.page, 'field-folder-03', 3);
  assert.deepEqual((await snap(user.page)).clues, before.clues);
  assert.deepEqual((await snap(user.page)).archive, before.archive);
  assert.equal(await user.page.locator('#quest-count').innerText(), '1 / 4');
  check('用户示例的蓝瘦/你是GG还是MM/厉害了我的哥统一三条探索收藏；蓝瘦仅一条，详情与返回正常', userEntries);
  await user.context.close();

  const all = await setup({ version: 1, pickupInventory: ALL, collectedPickups: ALL, clues: QUEST,
    investigated: true, archive: { answers: { meaning: 'emotion', context: 'shared-self-mockery' }, completed: true } });
  const allBefore = await snap(all.page);
  await bag(all.page, ALL, 'unified-collection-all-five');
  assert.equal(await all.page.locator('#quest-count').innerText(), '已完成');
  assert.equal(allBefore.archive.completed, true);
  assert.equal(allBefore.clues.length, 8);
  assert.equal(await all.page.locator('#modal [data-clue-id]').count(), 0);
  await all.page.reload({ waitUntil: 'networkidle' });
  await all.page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  assert.deepEqual((await snap(all.page)).archive, allBefore.archive);
  assert.deepEqual((await snap(all.page)).clues, allBefore.clues);
  await bag(all.page, ALL);
  check('五个收藏统一显示且只计5件，已收集的调查资料不重复进入背包；原已完成任务刷新不变');
  await all.context.close();

  const legacy = await setup({ version: 1, clues: [QUEST[0]], investigated: true });
  let state = await snap(legacy.page);
  assert.deepEqual(state.pickupInventory, [BLUE]);
  assert.equal(state.pickups.find(pickup => pickup.id === BLUE).visible, false);
  await bag(legacy.page, [BLUE]);
  await legacy.page.reload({ waitUntil: 'networkidle' });
  await legacy.page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  state = await snap(legacy.page);
  assert.deepEqual(state.pickupInventory, [BLUE]);
  assert.equal(state.pickups.find(pickup => pickup.id === BLUE).visible, false);
  await bag(legacy.page, [BLUE]);
  check('仅持有旧蓝瘦线索卡的存档自动显示一个探索收藏，刷新仍保有且原文件夹不重生');
  await legacy.context.close();

  const fresh = await setup({ version: 1, pose: { x: 1.5, z: 0, yaw: 0, pitch: 0 } }, true);
  assert.equal((await snap(fresh.page)).pickups.find(pickup => pickup.id === BLUE).visible, true);
  await walk(fresh.page, [[1.5, -1.25]], '从合法近处存档点真实WASD靠近原蓝瘦文件夹');
  await fresh.page.waitForFunction(() => window.__OUTPOST_DEBUG__.snapshot().pickupInventory.includes('outpost-blue-mushroom-folder'));
  assert.equal(await fresh.page.locator('#toast').innerText(), '已获得老梗：蓝瘦香菇图片');
  state = await snap(fresh.page);
  assert.deepEqual(state.pickupInventory, [BLUE]);
  assert.deepEqual(state.collectedPickups, [BLUE]);
  assert.equal(state.pickups.find(pickup => pickup.id === BLUE).visible, false);
  assert.ok(state.pickups.filter(pickup => pickup.id !== BLUE).every(pickup => pickup.visible));
  await bag(fresh.page, [BLUE]);
  await details(fresh.page, BLUE, 1);
  check('真实靠近蓝瘦文件夹自动拾取、原提示/唯一记录/消失正常，立即进入统一探索收藏');
  await fresh.context.close();

  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.errors.push(error.stack || String(error));
  console.error(error);
  process.exitCode = 1;
  for (const context of browser.contexts()) for (const page of context.pages()) await shot(page, 'unified-collection-failure').catch(() => {});
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(out + 'unified-collection-browser-report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
