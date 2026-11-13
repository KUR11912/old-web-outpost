import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createInputs } from './four-pickups-input-helpers.mjs';
import { CLUES } from '../src/archive-data.ts';
import { MEME_ARCHIVES } from '../src/meme-archives.ts';
import { PICKUPS } from '../src/pickup-data.ts';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5174/';
const out = fileURLToPath(new URL('./', import.meta.url));
const SAVE = 'old-web-outpost:save:v1';
const ALL = PICKUPS.map(p => p.id), MEMES = PICKUPS.map(p => p.memeId);
const terminalPose = { x: 16.6, z: -33.7, yaw: 0, pitch: 0 };
const fixture = (inventory = [], pose = terminalPose) => ({ version: 1, collectionVersion: 2, pickupInventory: inventory,
  collectedPickups: inventory, queriedMemes: [], clues: [], investigated: false, pose,
  archive: { answers: { meaning: null, context: null }, completed: false } });
const report = { url, startedAt: new Date().toISOString(), checks: [], routes: [], errors: [], requestsFailed: [], screenshots: [],
  method: 'Isolated browser contexts only. Physical WASD pickup of Blue and Mushroom; labeled ownership fixtures for independent English terminal searches. Terminal opened by real mouse/E interaction. No user browser saves are touched.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const snap = page => page.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const { aimPoint, walk } = createInputs(snap, report);
const check = name => { report.checks.push(name); console.log('PASS: ' + name); };
let activePage;
async function setup(initial) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  if (initial) await context.addInitScript(({ key, initial }) => {
    if (sessionStorage.getItem('english-test-seeded')) return;
    sessionStorage.setItem('english-test-seeded', 'yes'); localStorage.setItem(key, JSON.stringify(initial));
  }, { key: SAVE, initial });
  const page = await context.newPage(); activePage = page;
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) report.requestsFailed.push({ url: r.url(), status: r.status() }); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal((await snap(page)).assets.length, 10);
  return { context, page };
}
async function enter(page) { await page.locator('#enter-drag').click(); await page.waitForFunction(() => window.__OUTPOST_DEBUG__.snapshot().active); }
async function terminal(page) {
  if (!(await snap(page)).active) await enter(page);
  await aimPoint(page, (await snap(page)).interactables.find(s => s.id === 'old-terminal').aim);
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__.snapshot().targetId === 'old-terminal');
  await page.keyboard.press('e'); await page.locator('#terminal-query').waitFor({ state: 'visible' });
  assert.equal((await snap(page)).active, false);
}
async function search(page, value, enter = false) {
  await page.locator('#terminal-query').fill(value);
  if (enter) await page.locator('#terminal-query').press('Enter'); else await page.locator('#terminal-search-submit').click();
}
async function english(page) {
  assert.doesNotMatch(await page.locator('body').innerText(), /\p{Script=Han}/u, 'Visible interface text is English');
  const width = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(width.document <= width.viewport + 1, 'No document horizontal overflow');
}
async function shot(page, name) { await page.screenshot({ path: out + name + '.png', fullPage: true }); report.screenshots.push(name + '.png'); }
async function locked(page, pickup) {
  await page.locator('#bag-button').click();
  const row = page.locator(`[data-pickup-entry="${pickup.id}"]`);
  assert.equal(await row.getAttribute('data-archive-state'), 'unqueried');
  assert.equal(await row.locator('img').count(), 0);
  await page.locator(`[data-pickup-id="${pickup.id}"]`).click();
  assert.equal(await page.locator('#modal-body [data-archive-state]').getAttribute('data-archive-state'), 'unqueried');
  assert.ok((await page.locator('#modal-body').innerText()).includes(MEME_ARCHIVES[pickup.memeId].name));
  assert.equal(await page.locator('#modal-body img, #modal-body details, [data-archive-clue]').count(), 0);
  await english(page);
}
async function detail(page, memeId) {
  const archive = MEME_ARCHIVES[memeId];
  assert.equal(await page.locator('[data-archive-state]').first().getAttribute('data-archive-state'), 'queried');
  const body = await page.locator('#modal-body').innerText(); assert.ok(body.includes(archive.name)); assert.ok(body.includes(archive.summary));
  assert.deepEqual(await page.locator('[data-archive-clue]').evaluateAll(items => items.map(i => i.dataset.archiveClue)), archive.clueIds);
  for (const id of archive.clueIds) {
    const clue = CLUES[id], section = page.locator(`[data-archive-clue="${id}"]`);
    for (const paragraph of clue.content) assert.ok((await section.innerText()).includes(paragraph), paragraph);
    if (clue.period) assert.ok((await section.innerText()).includes(clue.period));
    if (clue.example) assert.ok((await section.innerText()).includes(clue.example.text));
    const notes = section.locator('details'); assert.equal(await notes.getAttribute('open'), null);
    assert.ok((await notes.textContent()).includes(clue.sourceNote));
    for (const source of clue.sources ?? []) assert.ok(await notes.locator(`a[href="${source.url}"]`).count() >= 1);
  }
  for (const img of await page.locator('#modal-body img').all()) {
    await img.evaluate(img => img.decode());
    const metrics = await img.evaluate(img => ({ width: img.naturalWidth, height: img.naturalHeight, fit: getComputedStyle(img).objectFit }));
    assert.ok(metrics.width > 0 && metrics.height > 0); assert.equal(metrics.fit, 'contain');
  }
  await english(page);
}

try {
  const physical = await setup(fixture([], { x: 1.5, z: 0, yaw: 0, pitch: 0 }));
  assert.deepEqual((await snap(physical.page)).pickupInventory, []); assert.deepEqual((await snap(physical.page)).queriedMemes, []);
  await english(physical.page); await shot(physical.page, 'english-home');
  await enter(physical.page); await walk(physical.page, [[1.5, -1.1]], 'Physically collect the blue mushroom folder');
  await physical.page.waitForFunction(id => window.__OUTPOST_DEBUG__.snapshot().pickupInventory.includes(id), ALL[0]);
  await locked(physical.page, PICKUPS[0]); await shot(physical.page, 'english-unqueried-bag');
  assert.deepEqual((await snap(physical.page)).queriedMemes, []); await physical.context.close();
  check('Fresh save is empty; physical folder pickup reveals only its English name and placeholder');

  const absent = await setup(fixture()); await terminal(absent.page);
  for (const archive of Object.values(MEME_ARCHIVES)) {
    await search(absent.page, archive.name); assert.match(await absent.page.locator('#terminal-search-feedback').innerText(), /find.*map|map.*first/i);
    assert.deepEqual((await snap(absent.page)).pickupInventory, []); assert.deepEqual((await snap(absent.page)).queriedMemes, []);
  }
  await english(absent.page); await absent.context.close(); check('All five English searches reject uncollected items without awarding anything');

  const owned = await setup(fixture(ALL)), page = owned.page;
  for (const pickup of PICKUPS) { await locked(page, pickup); await page.locator('#modal-close').click(); }
  await terminal(page); await shot(page, 'english-terminal-search');
  const pose = (await snap(page)).pose;
  await page.locator('#terminal-query').pressSequentially('wasdbme'); assert.equal(await page.locator('#terminal-query').inputValue(), 'wasdbme');
  assert.deepEqual((await snap(page)).pose, pose); assert.equal((await snap(page)).mapOpen, false);
  await page.locator('#terminal-query').fill(MEME_ARCHIVES[MEMES[0]].name);
  await page.locator('#terminal-query').dispatchEvent('compositionstart'); await page.locator('#terminal-query').press('Enter');
  assert.deepEqual((await snap(page)).queriedMemes, []); await page.locator('#terminal-query').dispatchEvent('compositionend'); await page.waitForTimeout(150);
  await search(page, '  '); assert.match(await page.locator('#terminal-search-feedback').innerText(), /enter.*meme/i);
  await search(page, 'unknown archive'); assert.match(await page.locator('#terminal-search-feedback').innerText(), /no.*match|not.*found/i);
  check('English search feedback, paused movement, shortcut suppression and composition handling work');
  for (const [index, memeId] of MEMES.entries()) {
    const archive = MEME_ARCHIVES[memeId], before = await snap(page);
    await search(page, '  ' + archive.name.toUpperCase() + '  ', index % 2 === 1);
    await page.locator('#return-search').waitFor({ state: 'visible' }); await detail(page, memeId);
    assert.deepEqual((await snap(page)).queriedMemes, MEMES.slice(0, index + 1)); assert.deepEqual((await snap(page)).pickupInventory, ALL);
    assert.equal(await page.locator('#archive-update-feedback').count(), 1);
    assert.equal((await snap(page)).footsteps.pickup.plays, before.footsteps.pickup.plays);
    assert.deepEqual((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE)).queriedMemes, MEMES.slice(0, index + 1));
    await shot(page, 'english-detail-' + memeId);
    if (index > 0) {
      const gallery = page.locator('[data-archive-image]'); assert.equal(await gallery.count(), index === 4 ? 2 : 1);
      await gallery.first().click(); await page.locator('#return-archive').waitFor({ state: 'visible' }); await english(page);
      await page.locator('#return-archive').click(); await detail(page, memeId);
    }
    await page.locator('#view-bag').click(); assert.equal(await page.locator('[data-pickup-entry]').count(), ALL.length);
    for (const [n, pickup] of PICKUPS.entries()) {
      const row = page.locator(`[data-pickup-entry="${pickup.id}"]`); assert.equal(await row.getAttribute('data-archive-state'), n <= index ? 'queried' : 'unqueried');
    }
    await page.locator(`[data-pickup-id="${ALL[index]}"]`).click(); await detail(page, memeId);
    if (index === 4) await shot(page, 'english-queried-bag');
    await page.locator('#modal-close').click(); await terminal(page); await search(page, archive.name);
    await page.locator('#return-search').waitFor({ state: 'visible' }); assert.equal(await page.locator('#archive-update-feedback').count(), 0);
    assert.deepEqual((await snap(page)).queriedMemes, MEMES.slice(0, index + 1)); assert.deepEqual((await snap(page)).pickupInventory, ALL);
    await page.locator('#return-search').click(); check(archive.name + ': correct English archive, source notes, images, independent unlock, synced bag and no duplicate rewards');
  }
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  assert.deepEqual((await snap(page)).queriedMemes, MEMES); assert.deepEqual((await snap(page)).pickupInventory, ALL);
  await page.setViewportSize({ width: 1024, height: 768 }); await page.locator('#bag-button').click(); await english(page); await shot(page, 'english-bag-1024');
  await page.locator('#modal-close').click(); await page.locator('#reset-button').click(); await english(page); await shot(page, 'english-reset-confirm');
  await page.locator('#modal-close').click(); assert.deepEqual((await snap(page)).pickupInventory, ALL);
  await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click(); assert.deepEqual((await snap(page)).pickupInventory, []); assert.deepEqual((await snap(page)).queriedMemes, []);
  assert.ok((await snap(page)).pickups.every(p => p.visible)); await english(page);
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  assert.deepEqual((await snap(page)).pickupInventory, []); assert.deepEqual((await snap(page)).queriedMemes, []);
  await owned.context.close(); check('Refresh retains unlocked archives; English UI fits 1024px; reset cancel/confirm and persisted empty progress work');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.requestsFailed, []); check('All local assets load and browser runtime errors are zero'); report.passed = true;
} catch (error) {
  report.passed = false; report.failure = error.stack || String(error); console.error(report.failure); process.exitCode = 1;
  if (activePage && !activePage.isClosed()) await shot(activePage, 'english-failure').catch(() => {});
} finally {
  report.finishedAt = new Date().toISOString(); await writeFile(out + 'english-browser-report.json', JSON.stringify(report, null, 2) + '\n'); await browser.close();
}
