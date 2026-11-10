import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5180/';
const out = fileURLToPath(new URL('./', import.meta.url));
const ORIGINAL = 'missing-caption-image', MEANING = 'echo-meaning-note';
const CARDS = [ORIGINAL, MEANING, 'echo-chat-context', 'echo-image-variants'];
const HASH = 'ffd6990d1b3b76a7bfcd45633fa94a449b704e6180a5aea9bbd98793c1ac795e';
const report = { url, startedAt: new Date().toISOString(), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const snap = p => p.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS: ' + name); };
async function setup(owned = true) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await context.addInitScript(({ owned, cards }) => {
    if (!localStorage.getItem('old-web-outpost:save:v1')) localStorage.setItem('old-web-outpost:save:v1', JSON.stringify({
      version: 1, investigated: true, clues: owned ? cards : [cards[0]], pose: { x: 16.6, z: -33.7, yaw: 0, pitch: -.2142 },
      archive: { answers: { meaning: owned ? 'emotion' : null, context: owned ? 'shared-self-mockery' : null }, completed: owned }, updatedAt: 1,
    }));
  }, { owned, cards: CARDS });
  const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  await page.locator('#enter-drag').click(); return { page, context };
}
async function openTerminal(page) {
  const state = await snap(page), aim = state.interactables.find(i => i.id === 'old-terminal').aim;
  const dx = aim.x - state.pose.x, dz = aim.z - state.pose.z;
  const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(aim.y - state.eyeY, Math.hypot(dx, dz));
  const b = await page.locator('#game-canvas').boundingBox(), x = b.x + b.width / 2, y = b.y + b.height * .55;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x - (yaw - state.pose.yaw) / .0022, y + (state.pose.pitch - pitch) / .0022, { steps: 6 }); await page.mouse.up();
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__.snapshot().targetId === 'old-terminal');
  await page.keyboard.press('e'); await page.locator('#modal').waitFor({ state: 'visible' });
}
async function picture(page) {
  const image = page.locator('#modal .clue-heading img.clue-image');
  await image.waitFor({ state: 'visible' });
  await image.evaluate(i => i.decode());
  const data = await image.evaluate(i => ({ src: i.currentSrc, width: i.naturalWidth, height: i.naturalHeight, objectFit: getComputedStyle(i).objectFit, box: { width: i.getBoundingClientRect().width, height: i.getBoundingClientRect().height } }));
  assert.equal(data.width, 594); assert.equal(data.height, 528); assert.equal(data.objectFit, 'contain');
  assert.ok(data.src.endsWith('/assets/blue-mushroom-meme.png')); assert.equal(data.box.width, 112); assert.equal(data.box.height, 112);
  return data;
}
async function closeResume(page) {
  await page.locator('#modal-close').click(); assert.equal((await snap(page)).active, false);
  await page.locator('#enter-drag').click(); assert.equal((await snap(page)).active, true);
}
try {
  const { page, context } = await setup();
  await openTerminal(page); const originalState = await snap(page);
  const meaningImage = await picture(page);
  const response = await page.request.get(meaningImage.src); assert.equal(response.status(), 200);
  report.imageSha256 = createHash('sha256').update(await response.body()).digest('hex'); assert.equal(report.imageSha256, HASH);
  await page.screenshot({ path: out + 'meaning-image-game.png', fullPage: true });
  check('旧终端读音便笺显示用户原始PNG，594×528等比例完整置于112×112缩略图', meaningImage);
  const frozen = (await snap(page)).pose;
  await page.keyboard.down('w'); await page.waitForTimeout(200); await page.keyboard.up('w'); assert.deepEqual((await snap(page)).pose, frozen);
  assert.equal(await page.locator('#collect-clue:enabled').count(), 0);
  await closeResume(page); await openTerminal(page);
  assert.deepEqual((await snap(page)).clues, CARDS); assert.equal(await page.locator('#collect-clue:enabled').count(), 0);
  check('已持有读音便笺的旧存档无需重领，重复调查不增发');
  await page.locator('#modal-close').click(); await page.keyboard.press('b');
  await page.locator(`[data-clue-id="${MEANING}"]`).click();
  const bagMeaning = await picture(page); assert.equal(bagMeaning.src, meaningImage.src);
  await page.screenshot({ path: out + 'meaning-image-bag.png', fullPage: true });
  await page.locator('#return-bag').click(); await page.locator(`[data-clue-id="${ORIGINAL}"]`).click();
  const bagOriginal = await picture(page); assert.equal(bagOriginal.src, bagMeaning.src);
  await page.screenshot({ path: out + 'meaning-image-original-bag.png', fullPage: true });
  check('背包的读音便笺与原图片卡复用同一原始图片，显示一致');
  await closeResume(page);
  const beforeMove = (await snap(page)).pose; await page.keyboard.down('s'); await page.waitForTimeout(250); await page.keyboard.up('s');
  assert.ok((await snap(page)).pose.z > beforeMove.z + .2); await page.keyboard.press('Escape');
  const savedPose = (await snap(page)).pose;
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  const restored = await snap(page); assert.deepEqual(restored.clues, originalState.clues); assert.deepEqual(restored.archive, originalState.archive);
  assert.ok(Math.hypot(restored.pose.x - savedPose.x, restored.pose.z - savedPose.z) < .01);
  check('窗口暂停及关闭后点击恢复正常，刷新保留四卡、位置与完成状态');
  await context.close();

  const fresh = await setup(false); await openTerminal(fresh.page); await picture(fresh.page);
  await fresh.page.locator('#collect-clue').click(); assert.deepEqual((await snap(fresh.page)).clues, [ORIGINAL, MEANING]);
  await picture(fresh.page); assert.equal(await fresh.page.locator('#collect-clue:enabled').count(), 0);
  await closeResume(fresh.page); await openTerminal(fresh.page);
  assert.deepEqual((await snap(fresh.page)).clues, [ORIGINAL, MEANING]);
  check('尚未领取读音便笺的存档仍可正常领取一次，领取后图片持续显示');
  await fresh.context.close(); assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) {
  report.passed = false; report.errors.push(error.stack || String(error)); console.error(error); process.exitCode = 1;
  for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: out + 'meaning-image-test-failure.png', fullPage: true }).catch(() => {});
} finally {
  report.finishedAt = new Date().toISOString(); await writeFile(out + 'meaning-image-browser-report.json', JSON.stringify(report, null, 2)); await browser.close();
}
