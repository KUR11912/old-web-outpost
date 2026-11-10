import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';

// Real browser input only for the main walkthrough; save fixtures use isolated contexts.
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5180/';
const out = fileURLToPath(new URL('./', import.meta.url));
const SAVE = 'old-web-outpost:save:v1';
const ORIGINAL = 'missing-caption-image';
const CARDS = [ORIGINAL, 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'];
const sites = {
  'old-terminal': { approach: { x: 16.6, z: -33.7 }, aim: { x: 16.6, y: 1.25, z: -35.16 }, card: CARDS[1], photo: 'archive-meaning' },
  'chat-viewer': { approach: { x: 20, z: -34.3 }, aim: { x: 20, y: 1.3, z: -35.74 }, card: CARDS[2], photo: 'archive-context' },
  'image-cache': { approach: { x: 23.4, z: -33.7 }, aim: { x: 23.4, y: 1.18, z: -35.12 }, card: CARDS[3], photo: 'archive-variants' },
  'archive-desk': { approach: { x: 25, z: -30.7 }, aim: { x: 25, y: 1.14, z: -32.24 } },
};
const report = { url, startedAt: new Date().toISOString(), checks: [], routes: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling'] });
const snap = p => p.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS: ' + name); };
const shot = (p, name) => p.screenshot({ path: out + name + '.png', fullPage: true });
async function setup(save) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  if (save) await context.addInitScript(({ key, save }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(save)); }, { key: SAVE, save });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  await page.locator('#enter-drag').click();
  return { context, page };
}
async function drag(page, dx, dy = 0) {
  const box = await page.locator('#game-canvas').boundingBox();
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 300));
  for (let n = 0; n < steps; n++) {
    const x = box.x + box.width * .5, y = box.y + box.height * .55;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + dx / steps, y + dy / steps, { steps: 6 }); await page.mouse.up();
  }
}
async function aim(page, yaw, pitch = 0) {
  const pose = (await snap(page)).pose;
  await drag(page, -Math.atan2(Math.sin(yaw - pose.yaw), Math.cos(yaw - pose.yaw)) / .0022, (pose.pitch - pitch) / .0022);
}
async function aimPoint(page, point) {
  const pose = (await snap(page)).pose, dx = point.x - pose.x, dz = point.z - pose.z;
  await aim(page, Math.atan2(-dx, -dz), Math.atan2(point.y - 1.65, Math.hypot(dx, dz)));
}
async function walkAxis(page, axis, target) {
  const begin = (await snap(page)).pose, diff = target - begin[axis];
  if (Math.abs(diff) < .08) return;
  const sign = Math.sign(diff), key = axis === 'x' ? (sign > 0 ? 'd' : 'a') : (sign > 0 ? 's' : 'w');
  let previous = begin, stuck = 0;
  await page.keyboard.down(key);
  try {
    for (let i = 0; i < 700; i++) {
      await page.waitForTimeout(50); const s = await snap(page);
      assert.ok(s.active, 'Movement paused unexpectedly'); assert.ok(Math.abs(s.eyeY - 1.65) < .005);
      if (Math.hypot(s.pose.x - previous.x, s.pose.z - previous.z) < .002) stuck++; else stuck = 0;
      if (stuck > 35) throw new Error(`Blocked ${axis}=${target} at ${JSON.stringify(s.pose)}`);
      previous = s.pose;
      if (sign * (s.pose[axis] - target) >= -.03) return;
    }
    throw new Error('Movement timed out');
  } finally { await page.keyboard.up(key); }
}
async function walk(page, nodes, name) {
  await aim(page, 0); const started = performance.now(), start = (await snap(page)).pose;
  for (const [x, z] of nodes) { await walkAxis(page, 'x', x); await walkAxis(page, 'z', z); }
  const item = { name, seconds: +((performance.now() - started) / 1000).toFixed(2), start, end: (await snap(page)).pose };
  report.routes.push(item); console.log('WALK: ' + JSON.stringify(item));
}
async function closeResume(page) {
  if (await page.locator('#modal').evaluate(e => e.open)) await page.locator('#modal-close').click();
  assert.equal((await snap(page)).active, false, 'Closing a window must not restart movement');
  await page.locator('#enter-drag').click();
}
async function pausedCheck(page) {
  const before = (await snap(page)).pose;
  await page.keyboard.down('w'); await page.waitForTimeout(250); await page.keyboard.up('w');
  assert.deepEqual((await snap(page)).pose, before);
}
async function investigate(page, id, point) {
  await aimPoint(page, point);
  await page.waitForFunction(id => window.__OUTPOST_DEBUG__.snapshot().targetId === id, id);
  await page.keyboard.press('e');
  await page.locator('#modal').waitFor({ state: 'visible' });
  assert.equal((await snap(page)).active, false);
}
async function visit(page, id) {
  const site = sites[id];
  await aim(page, 0); await walkAxis(page, 'z', -30.7);
  await walkAxis(page, 'x', site.approach.x); await walkAxis(page, 'z', site.approach.z);
  await investigate(page, id, site.aim);
}
const choice = (page, question, option) => page.locator(`[data-question-id="${question}"][data-option-id="${option}"], [data-question-id="${question}"] [data-option-id="${option}"]`).first();
async function wrongOption(page, question, correct) {
  const options = await page.locator(`[data-question-id="${question}"][data-option-id], [data-question-id="${question}"] [data-option-id]`).evaluateAll(nodes => nodes.map(n => n.dataset.optionId));
  const other = options.find(x => x !== correct); assert.ok(other, 'A retryable wrong option must exist');
  await choice(page, question, other).click();
}

try {
  const { page, context } = await setup();
  let s = await snap(page);
  assert.equal(s.clues.length, 0); assert.equal(s.archive.completed, false);
  for (const entry of s.interactables ?? []) if (sites[entry.id]) {
    if (entry.approach) sites[entry.id].approach = entry.approach;
    if (entry.aim) sites[entry.id].aim = entry.aim;
  }
  report.renderer = await page.evaluate(() => { const g = document.querySelector('canvas').getContext('webgl2'), e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unavailable'; });
  check('新玩家从原有固定出生点开始，档案馆任务未完成', s.pose);
  await walk(page, [[1.5, 9], [1.5, -1.4]], '出生点 → 邮箱');
  await investigate(page, 'mailbox', { x: 1.5, y: 1.25, z: -3.44 });
  await pausedCheck(page); await page.locator('#collect-clue').click();
  assert.deepEqual((await snap(page)).clues, [ORIGINAL]);
  assert.ok(await page.locator('#modal img.clue-image').first().evaluate(i => i.complete && i.naturalWidth === 594));
  check('原邮箱流程和用户上传原图保留，领取唯一原线索');
  await closeResume(page);
  await walk(page, [[1.5, -2], [13.5, -2], [13.5, -30], [20, -30], [20, -29]], '邮箱 → 回声档案馆');
  await aim(page, 0, .10); await shot(page, 'archive-stations');
  await visit(page, 'archive-desk');
  let text = await page.locator('#modal-body').innerText();
  assert.match(text, /回声档案馆/); assert.match(text, /缺|还|未|需要/);
  assert.equal((await snap(page)).archive.completed, false);
  check('缺少档案馆线索时，整理界面提示缺卡及调查地点', text);
  await closeResume(page);

  for (const id of ['old-terminal', 'chat-viewer', 'image-cache']) {
    const site = sites[id]; await visit(page, id); await pausedCheck(page);
    const content = await page.locator('#modal-body').innerText();
    assert.match(content, id === 'old-terminal' ? /读音示意/ : id === 'chat-viewer' ? /游戏情境示例/ : /游戏改编示例/);
    await shot(page, site.photo);
    const before = (await snap(page)).clues.length;
    await page.locator('#collect-clue').click();
    s = await snap(page); assert.ok(s.clues.includes(site.card)); assert.equal(s.clues.length, before + 1);
    check('独立调查并领取：' + id, site.card);
    await closeResume(page);
  }
  await visit(page, 'old-terminal');
  assert.equal((await snap(page)).clues.length, 4);
  assert.equal(await page.locator('#collect-clue:enabled').count(), 0);
  check('重复调查已领取的物件不重复发卡');
  await closeResume(page); await page.keyboard.press('b');
  assert.deepEqual([...(await snap(page)).clues].sort(), [...CARDS].sort());
  await shot(page, 'archive-bag');
  for (const card of CARDS) {
    const entry = page.locator(`[data-clue-id="${card}"]`).first();
    await entry.click(); assert.ok((await page.locator('#modal-body').innerText()).length > 50);
    if (card === ORIGINAL) assert.ok(await page.locator('#modal img.clue-image').first().evaluate(i => i.complete && i.naturalWidth === 594));
    await page.locator('#modal-close').click(); await page.keyboard.press('b');
  }
  check('背包四卡均可反复打开回看，原图显示一致');
  await closeResume(page); await visit(page, 'archive-desk');
  // The desk may directly open the two-question view or provide an explicit organize action.
  if (!(await page.locator('[data-question-id]').count())) await page.locator('#organize-clues').click();
  await wrongOption(page, 'meaning', 'emotion');
  await page.locator('#check-association').click();
  assert.equal((await snap(page)).archive.completed, false);
  text = await page.locator('#modal-body').innerText(); assert.match(text, /难受|想哭|情绪|读音/);
  await shot(page, 'archive-retry');
  const review = page.locator('[data-review-clue]').first();
  assert.ok(await review.count()); await review.click();
  assert.ok((await page.locator('#modal-body').innerText()).length > 50);
  await page.locator('#return-association').click();
  await choice(page, 'meaning', 'emotion').click();
  await page.locator('#check-association').click();
  await page.locator('#next-association').click();
  await wrongOption(page, 'context', 'shared-self-mockery');
  await page.locator('#submit-association').click();
  assert.equal((await snap(page)).archive.completed, false);
  assert.match(await page.locator('#modal-body').innerText(), /认真|普通语言|倾听/);
  await shot(page, 'archive-retry');
  await page.locator('[data-review-clue]').first().click();
  assert.match(await page.locator('#modal-body').innerText(), /聊天|语境|读音/);
  await page.locator('#return-association').click();
  await choice(page, 'context', 'shared-self-mockery').click();
  await page.locator('#submit-association').click();
  s = await snap(page); assert.equal(s.archive.completed, true);
  assert.equal(s.archive.answers.meaning, 'emotion'); assert.equal(s.archive.answers.context, 'shared-self-mockery');
  assert.match(await page.locator('#modal-body').innerText(), /断链桥/);
  await shot(page, 'archive-complete');
  check('错误反馈 → 回看材料 → 改选重试 → 整理完成，并提示断链桥');
  const beforeReload = (await snap(page)).pose;
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  s = await snap(page);
  assert.deepEqual([...s.clues].sort(), [...CARDS].sort()); assert.equal(s.archive.completed, true);
  assert.ok(Math.hypot(s.pose.x - beforeReload.x, s.pose.z - beforeReload.z) < .01);
  check('刷新后恢复四张卡、整理答案、完成状态及档案馆位置', s.archive);
  await context.close();

  const oldSave = { version: 1, investigated: true, clues: [ORIGINAL], pose: { x: 57, z: -35, yaw: 0, pitch: 0 }, updatedAt: 1 };
  const legacy = await setup(oldSave);
  s = await snap(legacy.page); assert.deepEqual(s.clues, [ORIGINAL]); assert.equal(s.archive.completed, false);
  assert.ok(Math.hypot(s.pose.x - 57, s.pose.z + 35) < .01);
  await legacy.page.keyboard.press('b'); assert.ok(await legacy.page.locator(`[data-clue-id="${ORIGINAL}"]`).count());
  check('旧 v1 单卡存档兼容；东岸位置及原卡保留，新增任务默认未完成');
  await legacy.context.close();
  const bridge = await setup({ ...oldSave, pose: { x: 33, z: -8, yaw: 0, pitch: 0 } });
  await walk(bridge.page, [[45, -8], [33, -8]], '未完成档案馆时桥梁仍双向开放');
  check('桥梁未因本轮任务新增门锁，仍可双向走通');
  await bridge.context.close();
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) {
  report.passed = false; report.errors.push(error.stack || String(error)); console.error(error); process.exitCode = 1;
  for (const context of browser.contexts()) for (const page of context.pages()) {
    await shot(page, 'archive-test-failure').catch(() => {});
    const s = await snap(page).catch(() => null); console.log(JSON.stringify(s && { pose: s.pose, targetId: s.targetId, archive: s.archive, clues: s.clues, active: s.active, modal: s.modal }));
  }
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(out + 'archive-browser-report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
