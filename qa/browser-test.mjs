import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5180/';
const out = fileURLToPath(new URL('./', import.meta.url));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-background-timer-throttling'],
});
const SAVE = 'old-web-outpost:save:v1';
const report = { url, startedAt: new Date().toISOString(), checks: [], assets: [], errors: [] };
const check = (name, details = true) => { report.checks.push({ name, details }); console.log(`PASS: ${name}`); };
const shot = (page, name) => page.screenshot({ path: out + name + '.png', fullPage: true });
const snap = page => page.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());

async function setup(seed, failAsset = false, denyLock = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', response => { if (/\.glb(?:\?|$)/.test(response.url())) requests.push({ url: response.url(), status: response.status() }); });
  if (seed) await context.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: SAVE, state: seed });
  if (denyLock) await context.addInitScript(() => {
    HTMLCanvasElement.prototype.requestPointerLock = function () { throw new DOMException('Test: pointer lock unavailable', 'SecurityError'); };
  });
  if (failAsset) await page.route('**/Outpost_01.glb', route => route.abort('failed'));
  await page.goto(url, { waitUntil: 'networkidle' });
  if (!failAsset) await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready, { timeout: 30000 });
  return { context, page, errors, requests };
}

async function hold(page, key, duration = 500) {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
}

async function walkUntil(page, key, done, limit = 160) {
  await page.keyboard.down(key);
  try {
    for (let n = 0; n < limit; n++) {
      await page.waitForTimeout(90);
      const s = await snap(page);
      if (done(s.pose)) return s;
    }
    throw new Error(`Walking ${key} never reached target: ${JSON.stringify(await snap(page))}`);
  } finally { await page.keyboard.up(key); }
}

async function drag(page, dx, dy = 0) {
  const b = await page.locator('#game-canvas').boundingBox();
  const x = b.x + b.width * .5, y = b.y + b.height * .5;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 }); await page.mouse.up();
}

async function resume(page) {
  if (await page.locator('#enter-drag').isVisible()) await page.locator('#enter-drag').click();
  else await page.locator('#game-canvas').click({ position: { x: 400, y: 300 } });
  assert.equal((await snap(page)).active, true, 'Explicit click restores exploration');
}

async function assertPaused(page, label) {
  const before = (await snap(page)).pose;
  await hold(page, 'w', 350);
  const after = (await snap(page)).pose;
  assert.deepEqual(after, before, label);
}

try {
  const { page, context, requests, errors } = await setup();
  await shot(page, 'outpost-overview');
  assert.equal(new Set(requests.filter(r => r.status === 200).map(r => r.url.split('/').at(-1))).size, 5, 'All five GLBs actually fetched');
  report.assets = (await snap(page)).assets;
  for (const asset of report.assets) {
    assert.ok(asset.texturedMaterials > 0 && asset.instances > 0, `${asset.name} needs textures and real instances`);
    if (/Tree|Grass/.test(asset.name)) assert.ok(asset.alphaCutoutMaterials > 0, `${asset.name} needs alpha cutout`);
  }
  const unchangedCounts = { Tree_01:14, Rock_01:6, Grass_01:89, PathTile_01:8 };
  for (const [name, count] of Object.entries(unchangedCounts)) assert.equal(report.assets.find(a => a.name === name)?.instances, count, `${name} placement count must remain unchanged`);
  const outpost = report.assets.find(a => a.name === 'Outpost_01');
  assert.ok(outpost && outpost.instances === 1 && outpost.dimensions.y > 4.5 && outpost.dimensions.x > 5.5, 'Blender outpost loaded with expected scale');
  check('四个环境 GLB 与新驿站 GLB 实际加载', requests);
  await page.locator('#enter-drag').click();
  const initial = await snap(page);
  assert.equal(initial.mode, 'drag');
  await drag(page, 35);
  assert.ok(Math.abs((await snap(page)).pose.yaw - initial.pose.yaw) > .01, 'Drag turns camera');
  await drag(page, -35);
  await walkUntil(page, 'w', p => p.z < -1.35);
  await walkUntil(page, 'd', p => p.x > 1.43);
  const aim = (await snap(page)).pose;
  const target = { x: 1.5, y: 1.25, z: -3.44 };
  const yaw = Math.atan2(-(target.x - aim.x), -(target.z - aim.z));
  const pitch = Math.atan2(target.y - 1.65, Math.hypot(target.x - aim.x, target.z - aim.z));
  await drag(page, (aim.yaw - yaw) / .0022, (aim.pitch - pitch) / .0022);
  let s = await snap(page);
  // The gaze test is intentionally verified using real mouse movement.
  if (!s.canInvestigate) {
    await drag(page, 0, -20);
    s = await snap(page);
  }
  assert.equal(s.canInvestigate, true, `Mailbox must be within gaze/range: ${JSON.stringify(s.pose)}`);
  await page.locator('#interaction').waitFor({ state: 'visible' });
  await shot(page, 'outpost-mailbox');
  check('出生点实际 WASD 行走、拖拽转头、接近并看向邮箱', s.pose);
  await page.keyboard.press('e');
  await page.locator('#modal[open]').waitFor();
  assert.match(await page.locator('#modal').innerText(), /原型测试|虚构/);
  await assertPaused(page, 'Dialog blocks movement');
  await page.locator('#collect-clue').click();
  assert.deepEqual((await snap(page)).clues, ['missing-caption-image']);
  assert.equal((await snap(page)).investigated, true);
  check('E 调查、阅读虚构留言、获得唯一线索，窗口中停止移动');
  await page.locator('#modal-close').click();
  await assertPaused(page, 'Closing dialog does not silently resume');
  await resume(page);
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__.snapshot().canInvestigate);
  await page.keyboard.press('e');
  await page.locator('#modal[open]').waitFor();
  assert.equal((await snap(page)).clues.length, 1);
  assert.equal(await page.locator('#collect-clue').count(), 0, 'Repeat investigation gives no collection button');
  await page.locator('#modal-close').click();
  await page.keyboard.press('b');
  await page.locator('#modal[open]').waitFor();
  assert.match(await page.locator('#modal').innerText(), /缺少配文的图片/);
  await assertPaused(page, 'Bag blocks movement');
  await shot(page, 'outpost-backpack');
  check('重复调查不重复发卡，B 背包可查看名称和说明');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  s = await snap(page);
  assert.equal(s.investigated, true); assert.deepEqual(s.clues, ['missing-caption-image']);
  assert.ok(Math.abs(s.pose.x - saved.pose.x) < .01 && Math.abs(s.pose.z - saved.pose.z) < .01);
  assert.equal(s.active, false);
  await page.locator('#bag-button').click();
  await shot(page, 'outpost-restored');
  check('刷新后位置、调查状态和线索恢复，必须明确点击恢复探索');
  assert.deepEqual(errors, []);
  const colliders = s.colliders;
  await context.close();

  for (const [label, collider] of [
    ['树干', colliders.find(c => /tree|树/i.test(c.label))],
    ['石头', colliders.find(c => /rock|石/i.test(c.label))],
    ['建筑', colliders.find(c => c.kind === 'box' && /building|outpost|驿站|建筑/i.test(c.label))],
  ]) {
    assert.ok(collider, `Missing ${label} collider`);
    const extent = collider.kind === 'circle' ? collider.radius : collider.halfZ;
    const startZ = collider.z + extent + 1.2;
    const pose = { x: collider.x, z: startZ, yaw: 0, pitch: 0 };
    const tested = await setup({ version: 1, investigated: false, clues: [], pose, updatedAt: Date.now() });
    await tested.page.locator('#enter-drag').click();
    await hold(tested.page, 'w', 2000);
    const result = (await snap(tested.page)).pose;
    assert.ok(result.z >= collider.z + extent + .20, `${label} collision failed ${JSON.stringify(result)}`);
    assert.ok(result.z < startZ - .15, `${label} movement did not begin`);
    check(`${label}实际行走碰撞阻挡`, { collider, result });
    await tested.context.close();
  }
  const edge = await setup({ version: 1, investigated: false, clues: [], pose: { x: 0, z: 12.8, yaw: Math.PI, pitch: 0 }, updatedAt: Date.now() });
  await edge.page.locator('#enter-drag').click(); await hold(edge.page, 'w', 1800);
  assert.ok((await snap(edge.page)).pose.z <= 13.75);
  check('地图边界阻挡'); await edge.context.close();

  const broken = await setup(undefined, true);
  await broken.page.waitForTimeout(500);
  assert.match(await broken.page.locator('body').innerText(), /加载失败|加载出错|资源.*失败|无法加载/);
  assert.match(await broken.page.locator('body').innerText(), /Outpost_01\.glb/);
  await shot(broken.page, 'outpost-loading-failure');
  check('新建筑 GLB 加载失败显示文件名与重试提示');
  await broken.context.close();

  const controls = await setup();
  await controls.page.locator('#enter-lock').click();
  await controls.page.waitForFunction(() => document.pointerLockElement?.id === 'game-canvas');
  assert.equal((await snap(controls.page)).mode, 'locked');
  await controls.page.mouse.move(600, 400); await controls.page.mouse.move(640, 400);
  assert.ok(Math.abs((await snap(controls.page)).pose.yaw) > .01);
  await controls.page.keyboard.press('b');
  await controls.page.locator('#modal[open]').waitFor();
  assert.equal(await controls.page.evaluate(() => document.pointerLockElement), null);
  await assertPaused(controls.page, 'Opening bag releases pointer and stops movement');
  await controls.page.locator('#modal-close').click();
  assert.equal((await snap(controls.page)).active, false);
  await controls.page.locator('#enter-lock').click();
  await controls.page.waitForFunction(() => document.pointerLockElement?.id === 'game-canvas');
  await controls.page.keyboard.press('Escape');
  assert.equal((await snap(controls.page)).active, false);
  assert.equal(await controls.page.evaluate(() => document.pointerLockElement), null);
  check('真实鼠标锁定/转头、背包释放、点击恢复、Esc 释放');
  await controls.context.close();

  const fallback = await setup(undefined, false, true);
  await fallback.page.locator('#enter-lock').click();
  assert.equal((await snap(fallback.page)).mode, 'drag');
  assert.match(await fallback.page.locator('#status').innerText(), /不可用.*拖拽/);
  await drag(fallback.page, 20);
  assert.ok(Math.abs((await snap(fallback.page)).pose.yaw) > .01);
  await hold(fallback.page, 'w', 300);
  assert.ok((await snap(fallback.page)).pose.z < 9);
  check('模拟锁定被拒时自动回退拖拽，仍可转头与行走');
  await fallback.context.close();

  // Regression: opening a letter is distinct from accepting its clue card.
  const unclaimed = await setup({
    version: 1, investigated: false, clues: [], pose: { x: 1.5, z: -1.4, yaw: 0, pitch: -.19 }, updatedAt: Date.now(),
  });
  await unclaimed.page.locator('#enter-drag').click();
  await unclaimed.page.waitForFunction(() => window.__OUTPOST_DEBUG__.snapshot().canInvestigate);
  await unclaimed.page.keyboard.press('e');
  await unclaimed.page.locator('#collect-clue').waitFor();
  await unclaimed.page.locator('#modal-close').click();
  await unclaimed.page.reload({ waitUntil: 'networkidle' });
  await unclaimed.page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  assert.equal((await snap(unclaimed.page)).investigated, true);
  assert.deepEqual((await snap(unclaimed.page)).clues, []);
  await unclaimed.page.locator('#enter-drag').click();
  await unclaimed.page.waitForFunction(() => window.__OUTPOST_DEBUG__.snapshot().canInvestigate);
  await unclaimed.page.keyboard.press('e');
  await unclaimed.page.locator('#collect-clue').click();
  assert.equal((await snap(unclaimed.page)).clues.length, 1);
  await unclaimed.page.locator('#modal-close').click();
  await unclaimed.page.evaluate(() => localStorage.setItem('meme-archaeology-v1', 'legacy-save-sentinel'));
  await unclaimed.page.locator('#reset-button').click();
  await unclaimed.page.locator('#confirm-reset').click();
  const reset = await snap(unclaimed.page);
  assert.equal(reset.investigated, false); assert.deepEqual(reset.clues, []);
  assert.deepEqual(reset.pose, { x: 0, z: 9, yaw: 0, pitch: 0 });
  assert.equal(await unclaimed.page.evaluate(() => localStorage.getItem('meme-archaeology-v1')), 'legacy-save-sentinel');
  check('只读未领取刷新不自动发卡，确认重置清空本原型并保留旧游戏存档');
  await unclaimed.context.close();
  report.passed = true;
} catch (error) {
  report.passed = false; report.errors.push(error.stack || String(error));
  console.error(error);
  for (const context of browser.contexts()) for (const page of context.pages()) {
    await shot(page, 'outpost-failure').catch(() => {});
    console.log(await snap(page).catch(() => page.locator('body').innerText()));
  }
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(out + 'browser-report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
