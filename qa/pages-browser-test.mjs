import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'https://kur11912.github.io/old-web-outpost/';
const target = new URL(url);
assert.equal(target.protocol, 'https:'); assert.equal(target.hostname, 'kur11912.github.io'); assert.equal(target.pathname, '/old-web-outpost/');
const PREFIX = '/old-web-outpost/';
const out = fileURLToPath(new URL('./', import.meta.url));
const CARDS = ['missing-caption-image', 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'];
const HASH = 'ffd6990d1b3b76a7bfcd45633fa94a449b704e6180a5aea9bbd98793c1ac795e';
const report = { url, startedAt: new Date().toISOString(), checks: [], responses: [], requestFailures: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling'] });
const snap = p => p.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS: ' + name); };
const shot = (p, name) => p.screenshot({ path: out + name + '.png', fullPage: true });
async function setup(legacy = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  if (legacy) await context.addInitScript(cards => {
    if (!localStorage.getItem('old-web-outpost:save:v1')) localStorage.setItem('old-web-outpost:save:v1', JSON.stringify({
      version: 1, investigated: true, clues: cards, pose: { x: 16.6, z: -33.7, yaw: 0, pitch: -.2142 },
      archive: { answers: { meaning: 'emotion', context: 'shared-self-mockery' }, completed: true }, updatedAt: 1,
    }));
  }, CARDS);
  const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
  page.on('response', r => report.responses.push({ url: r.url(), status: r.status(), type: r.request().resourceType() }));
  page.on('requestfailed', r => report.requestFailures.push({ url: r.url(), reason: r.failure()?.errorText }));
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }); assert.equal(response.status(), 200);
  assert.equal(new URL(page.url()).origin, target.origin); assert.match(await page.title(), /旧网驿站/);
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready, undefined, { timeout: 60000 });
  assert.equal((await snap(page)).assets.length, 8);
  await page.locator('#enter-drag').click(); return { page, context };
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
async function walkAxis(page, axis, end) {
  const start = (await snap(page)).pose[axis], sign = Math.sign(end - start);
  if (Math.abs(end - start) < .08) return;
  const key = axis === 'x' ? (sign > 0 ? 'd' : 'a') : (sign > 0 ? 's' : 'w');
  await page.keyboard.down(key);
  try {
    for (let n = 0; n < 300; n++) {
      await page.waitForTimeout(50); const s = await snap(page); assert.ok(s.active);
      if (sign * (s.pose[axis] - end) >= -.03) return;
    }
    throw new Error('Published page walking timed out: ' + JSON.stringify((await snap(page)).pose));
  } finally { await page.keyboard.up(key); }
}
async function investigate(page, id) {
  const s = await snap(page), point = s.interactables.find(i => i.id === id).aim;
  const dx = point.x - s.pose.x, dz = point.z - s.pose.z;
  await aim(page, Math.atan2(-dx, -dz), Math.atan2(point.y - s.eyeY, Math.hypot(dx, dz)));
  await page.waitForFunction(id => window.__OUTPOST_DEBUG__.snapshot().targetId === id, id);
  await page.keyboard.press('e'); await page.locator('#modal').waitFor({ state: 'visible' });
}
async function imageInfo(page) {
  const img = page.locator('#modal .clue-heading img.clue-image'); await img.waitFor({ state: 'visible' }); await img.evaluate(i => i.decode());
  const info = await img.evaluate(i => ({ src: i.currentSrc, width: i.naturalWidth, height: i.naturalHeight, objectFit: getComputedStyle(i).objectFit }));
  assert.equal(info.width, 594); assert.equal(info.height, 528); assert.equal(info.objectFit, 'contain');
  assert.equal(new URL(info.src).pathname, PREFIX + 'assets/blue-mushroom-meme.png'); return info;
}
try {
  const { page, context } = await setup();
  const state = await snap(page); assert.equal(state.clues.length, 0);
  check('真实GitHub Pages首页200，8个GLB全部启动完成', { title: await page.title(), assets: state.assets.map(a => ({ name: a.name, url: a.url, instances: a.instances })) });
  for (const asset of state.assets) assert.ok(new URL(asset.url, url).pathname.startsWith(PREFIX + 'assets/'));
  const glbs = report.responses.filter(r => r.url.endsWith('.glb'));
  assert.equal(new Set(glbs.map(r => r.url)).size, 8); assert.ok(glbs.every(r => r.status === 200 && new URL(r.url).pathname.startsWith(PREFIX)));
  check('8个GLB真实从项目子路径加载，无根目录路径错误', glbs);
  await shot(page, 'pages-home');
  await aim(page, .18, .02); assert.ok(Math.abs((await snap(page)).pose.yaw - .18) < .01);
  await aim(page, 0, 0); await walkAxis(page, 'x', 1.5); await walkAxis(page, 'z', -1.4);
  check('线上场景实际WASD行走和鼠标拖拽转头正常', (await snap(page)).pose);
  await investigate(page, 'mailbox'); const originalImage = await imageInfo(page);
  const response = await page.request.get(originalImage.src); assert.equal(response.status(), 200);
  report.imageSha256 = createHash('sha256').update(await response.body()).digest('hex'); assert.equal(report.imageSha256, HASH);
  await page.locator('#collect-clue').click(); assert.deepEqual((await snap(page)).clues, [CARDS[0]]);
  await shot(page, 'pages-mailbox'); check('邮箱E调查、原始PNG子路径和一次领取正常', originalImage);
  await page.locator('#modal-close').click(); assert.equal((await snap(page)).active, false);
  await page.keyboard.press('b'); await page.locator(`[data-clue-id="${CARDS[0]}"]`).click();
  assert.equal((await imageInfo(page)).src, originalImage.src); await shot(page, 'pages-backpack');
  check('线上背包回看同一完整原图，窗口保持原有交互');
  const before = (await snap(page)).pose;
  await page.reload({ waitUntil: 'networkidle', timeout: 60000 }); await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  const restored = await snap(page); assert.deepEqual(restored.clues, [CARDS[0]]);
  assert.ok(Math.hypot(restored.pose.x - before.x, restored.pose.z - before.z) < .01);
  await page.locator('#enter-drag').click(); await investigate(page, 'mailbox');
  assert.equal(await page.locator('#collect-clue:enabled').count(), 0);
  check('刷新恢复线上位置和领取状态，重复调查不再发卡'); await context.close();

  const legacy = await setup(true); await investigate(legacy.page, 'old-terminal');
  assert.equal((await imageInfo(legacy.page)).src, originalImage.src);
  assert.deepEqual((await snap(legacy.page)).clues, CARDS); assert.equal((await snap(legacy.page)).archive.completed, true);
  await shot(legacy.page, 'pages-meaning');
  await legacy.page.locator('#modal-close').click(); await legacy.page.keyboard.press('b');
  await legacy.page.locator(`[data-clue-id="${CARDS[1]}"]`).click(); assert.equal((await imageInfo(legacy.page)).src, originalImage.src);
  check('线上读音便笺与背包显示新修复原图，隔离v1旧进度保持'); await legacy.context.close();
  const failedApplicationResponses = report.responses.filter(r => r.status >= 400 && new URL(r.url).pathname.startsWith(PREFIX));
  const scriptsAndStyles = report.responses.filter(r => ['script', 'stylesheet'].includes(r.type) && new URL(r.url).origin === target.origin);
  assert.ok(scriptsAndStyles.length >= 2 && scriptsAndStyles.every(r => new URL(r.url).pathname.startsWith(PREFIX)), 'Published JS/CSS must use the project subpath');
  assert.deepEqual(failedApplicationResponses, []); assert.deepEqual(report.errors, []);
  const appFailures = report.requestFailures.filter(r => new URL(r.url).pathname.startsWith(PREFIX)); assert.deepEqual(appFailures, []);
  check('线上应用资源无404或失败请求，页面脚本错误0'); report.passed = true;
} catch (error) {
  report.passed = false; report.errors.push(error.stack || String(error)); console.error(error); process.exitCode = 1;
  for (const context of browser.contexts()) for (const page of context.pages()) await shot(page, 'pages-test-failure').catch(() => {});
} finally {
  report.finishedAt = new Date().toISOString(); await writeFile(out + 'pages-browser-report.json', JSON.stringify(report, null, 2)); await browser.close();
}
