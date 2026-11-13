import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';

// Main route uses real mouse/WASD input. Every save fixture is an isolated context.
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5180/';
const out = fileURLToPath(new URL('./', import.meta.url));
const SAVE = 'old-web-outpost:save:v1';
const ORIGINAL = 'missing-caption-image', MEME = 'blue-mushroom', PICKUP = 'outpost-blue-mushroom-folder';
const CARDS = [ORIGINAL, 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'];
const report = { url, startedAt: new Date().toISOString(), checks: [], routes: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling'] });
const snap = p => p.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS: ' + name); };
const shot = (p, name) => p.screenshot({ path: out + name + '.png', fullPage: true });
const folder = s => s.pickups.find(p => p.id === PICKUP);
function ownsFolder(s, collected) {
  assert.equal(s.memes.includes(MEME), collected, 'meme ownership');
  assert.equal(s.clues.includes(ORIGINAL), collected, 'original clue ownership');
  assert.equal(s.collectedPickups.includes(PICKUP), collected, 'pickup marker');
  assert.equal(folder(s).visible, !collected, 'world visibility');
}
async function setup(save, enter = true) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  if (save) await context.addInitScript(({ key, save }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(save)); }, { key: SAVE, save });
  const page = await context.newPage(), glbs = [];
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('response', r => { if (r.url().includes('.glb')) glbs.push({ url: r.url(), status: r.status() }); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  if (enter) await page.locator('#enter-drag').click();
  return { context, page, glbs };
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
async function aimPoint(page, point) {
  const p = (await snap(page)).pose, dx = point.x - p.x, dz = point.z - p.z;
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
  await page.keyboard.press('e'); await page.locator('#modal').waitFor({ state: 'visible' });
  assert.equal((await snap(page)).active, false);
}
async function visit(page, id) {
  const site = (await snap(page)).interactables.find(i => i.id === id);
  await aim(page, 0); await walkAxis(page, 'z', -30.7);
  await walkAxis(page, 'x', site.approach.x); await walkAxis(page, 'z', site.approach.z);
  await investigate(page, id, site.aim);
}
const choice = (page, question, option) => page.locator(`[data-question-id="${question}"][data-option-id="${option}"], [data-question-id="${question}"] [data-option-id="${option}"]`).first();
async function wrongOption(page, question, correct) {
  const options = await page.locator(`[data-question-id="${question}"][data-option-id], [data-question-id="${question}"] [data-option-id]`).evaluateAll(nodes => nodes.map(n => n.dataset.optionId));
  const other = options.find(x => x !== correct); assert.ok(other);
  await choice(page, question, other).click();
}
const legacySave = (clues = [], pose = { x: 1.5, z: -1.8, yaw: 0, pitch: 0 }) => ({ version: 1, investigated: true, clues, pose, updatedAt: 1 });

try {
  const { page, context, glbs } = await setup();
  let s = await snap(page); ownsFolder(s, false);
  assert.equal(s.clues.length, 0); assert.equal(s.archive.completed, false);
  const model = s.assets.find(a => a.name === 'MemeFolder_01');
  assert.equal(s.assets.length, 9); assert.ok(model && model.instances === 5 && model.meshes > 0);
  assert.ok(glbs.some(r => r.url.includes('MemeFolder_01.glb') && r.status === 200));
  assert.equal(folder(s).memeId, MEME);
  assert.ok(Math.abs(folder(s).basePosition.x - 1.5) < .001 && Math.abs(folder(s).basePosition.z + 1.8) < .001);
  assert.ok(Math.abs(folder(s).basePosition.y - .6) < .001);
  assert.ok(!s.colliders.some(c => /folder|文件夹/i.test(c.label)));
  report.renderer = await page.evaluate(() => { const g = document.querySelector('canvas').getContext('webgl2'), e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unavailable'; });
  check('新玩家从原出生点开始，第九个 GLB 文件夹已加载且无碰撞体', { pose: s.pose, model, pickup: folder(s) });
  await aimPoint(page, { x: 1.5, y: .9, z: -1.8 }); await shot(page, 'pickup-world');
  await walk(page, [[1.5, 9], [1.5, -.65]], '出生点 → 文件夹前方（拾取范围之外）');
  ownsFolder(await snap(page), false);
  await aimPoint(page, { x: 1.5, y: .9, z: -1.8 }); await shot(page, 'pickup-front-close');
  const samples = [];
  for (let i = 0; i < 35; i++) { const p = folder(await snap(page)); samples.push({ time: performance.now(), y: p.position.y, rotationY: p.rotationY }); await page.waitForTimeout(105); }
  const ys = samples.map(p => p.y), span = Math.max(...ys) - Math.min(...ys);
  assert.ok(span > .17 && span < .205, `bobbing span ${span}`);
  const spin = samples.slice(1).reduce((sum, p, i) => sum + Math.atan2(Math.sin(p.rotationY - samples[i].rotationY), Math.cos(p.rotationY - samples[i].rotationY)), 0);
  const elapsed = (samples.at(-1).time - samples[0].time) / 1000;
  assert.ok(Math.abs(spin / elapsed - 2 * Math.PI / 5) < .22, `rotation ${spin / elapsed}`);
  check('范围外未提前领取；文件夹持续上下浮动约 ±0.1 米、约 5 秒自转一周', { bobbingSpan: span, radiansPerSecond: spin / elapsed, samples });
  await walk(page, [[1.5, -1.15]], '进入 0.85 米自动拾取范围');
  await page.waitForFunction(id => window.__OUTPOST_DEBUG__.snapshot().collectedPickups.includes(id), PICKUP);
  s = await snap(page); ownsFolder(s, true); assert.deepEqual(s.memes, [MEME]); assert.deepEqual(s.clues, [ORIGINAL]); assert.deepEqual(s.collectedPickups, [PICKUP]);
  assert.equal(s.archive.completed, false);
  assert.equal(s.modal, false); assert.equal(s.active, true); await shot(page, 'pickup-collected');
  check('真实靠近无需按 E 自动领取，原线索及 meme 各一份，文件夹立即消失且继续行走', s.pose);
  await walk(page, [[1.5, -2.7], [1.5, -.6], [1.5, -2.2]], '往返穿过文件夹原位置');
  s = await snap(page); ownsFolder(s, true); assert.deepEqual(s.memes, [MEME]); assert.deepEqual(s.clues, [ORIGINAL]); assert.deepEqual(s.collectedPickups, [PICKUP]);
  check('穿过原位置无阻挡，往返不会重复领取');
  await page.keyboard.press('b'); await pausedCheck(page);
  await page.locator(`[data-clue-id="${ORIGINAL}"]`).first().click();
  const image = page.locator('#modal img.clue-image').first();
  assert.ok(await image.evaluate(i => i.complete && i.naturalWidth === 594 && i.naturalHeight > 0));
  await shot(page, 'pickup-bag');
  check('背包可打开原始完整图片并保留蓝瘦香菇字样', await image.evaluate(i => ({ src: i.getAttribute('src'), width: i.naturalWidth, height: i.naturalHeight, objectFit: getComputedStyle(i).objectFit })));
  await closeResume(page);
  await investigate(page, 'mailbox', { x: 1.5, y: 1.25, z: -3.44 }); await pausedCheck(page);
  assert.equal(await page.locator('#collect-clue').count(), 0); assert.match(await page.locator('#modal-body').innerText(), /留言|信/);
  s = await snap(page); ownsFolder(s, true); assert.deepEqual(s.memes, [MEME]); assert.deepEqual(s.clues, [ORIGINAL]);
  await shot(page, 'pickup-mailbox'); check('邮箱仅显示引导留言，无领取按钮或奖励');
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  s = await snap(page); ownsFolder(s, true); assert.deepEqual(s.clues, [ORIGINAL]); assert.deepEqual(s.memes, [MEME]);
  check('刷新恢复已收集记录，文件夹仍消失'); await page.locator('#enter-drag').click();
  await walk(page, [[1.5, -2], [13.5, -2], [13.5, -30], [20, -30]], '驿站 → 回声档案馆');
  await visit(page, 'archive-desk'); assert.match(await page.locator('#modal-body').innerText(), /还需要|缺少|未收/); assert.equal((await snap(page)).archive.completed, false); await closeResume(page);
  for (const [i, id] of ['old-terminal', 'chat-viewer', 'image-cache'].entries()) {
    await visit(page, id); await pausedCheck(page);
    const before = (await snap(page)).clues.length; await page.locator('#collect-clue').click(); s = await snap(page);
    assert.ok(s.clues.includes(CARDS[i + 1])); assert.equal(s.clues.length, before + 1); assert.deepEqual(s.memes, [MEME]); assert.deepEqual(s.collectedPickups, [PICKUP]);
    check('电脑记录调查资料且不额外授予 meme：' + id, CARDS[i + 1]); await closeResume(page);
  }
  await visit(page, 'old-terminal'); assert.equal(await page.locator('#collect-clue:enabled').count(), 0); assert.equal((await snap(page)).clues.length, 4); await closeResume(page);
  await page.keyboard.press('b');
  for (const card of CARDS) { await page.locator(`[data-clue-id="${card}"]`).first().click(); assert.ok((await page.locator('#modal-body').innerText()).length > 50); await page.locator('#return-bag').click(); }
  check('四张卡完整可重复查看，电脑重复调查不发卡'); await closeResume(page);
  await visit(page, 'archive-desk');
  if (!(await page.locator('[data-question-id]').count())) await page.locator('#organize-clues').click();
  await wrongOption(page, 'meaning', 'emotion'); await page.locator('#check-association').click(); assert.equal((await snap(page)).archive.completed, false);
  assert.match(await page.locator('#modal-body').innerText(), /难受|想哭|情绪|读音/);
  await page.locator('[data-review-clue]').first().click(); await page.locator('#return-association').click();
  await choice(page, 'meaning', 'emotion').click(); await page.locator('#check-association').click(); await page.locator('#next-association').click();
  await wrongOption(page, 'context', 'shared-self-mockery'); await page.locator('#submit-association').click(); assert.equal((await snap(page)).archive.completed, false);
  assert.match(await page.locator('#modal-body').innerText(), /认真|普通语言|倾听/); await shot(page, 'pickup-archive-retry');
  await page.locator('[data-review-clue]').first().click(); await page.locator('#return-association').click();
  await choice(page, 'context', 'shared-self-mockery').click(); await page.locator('#submit-association').click();
  s = await snap(page); assert.equal(s.archive.completed, true); assert.equal(s.archive.answers.meaning, 'emotion'); assert.equal(s.archive.answers.context, 'shared-self-mockery');
  assert.match(await page.locator('#modal-body').innerText(), /断链桥/); ownsFolder(s, true); await shot(page, 'pickup-archive-complete');
  check('四卡含义与语境关联均支持错误反馈、回看、重试，最终完成并提示断链桥');
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  s = await snap(page); ownsFolder(s, true); assert.deepEqual([...s.clues].sort(), [...CARDS].sort()); assert.equal(s.archive.completed, true);
  check('刷新保留完整四卡、meme、已拾取标记及档案馆完成状态'); await context.close();

  const old = await setup(legacySave([ORIGINAL]), false); s = await snap(old.page); ownsFolder(s, true); assert.equal(s.archive.completed, false);
  assert.deepEqual(s.clues, [ORIGINAL]); assert.deepEqual(s.memes, [MEME]); assert.deepEqual(s.collectedPickups, [PICKUP]);
  await old.page.locator('#enter-drag').click(); await old.page.waitForTimeout(300); ownsFolder(await snap(old.page), true);
  check('隔离旧 v1 已领原卡存档自动补全 meme 与拾取标记，不重生或重复领取'); await old.context.close();

  const letter = await setup(legacySave([], { x: .45, z: -2.4, yaw: 0, pitch: 0 })); ownsFolder(await snap(letter.page), false);
  await investigate(letter.page, 'mailbox', { x: 1.5, y: 1.25, z: -3.44 }); assert.equal(await letter.page.locator('#collect-clue').count(), 0);
  ownsFolder(await snap(letter.page), false); await pausedCheck(letter.page); check('隔离旧 v1 只读信未领卡存档仍可见文件夹，重读邮箱不获得奖励');
  await closeResume(letter.page); await walk(letter.page, [[1.5, -2.4]], '只读信旧存档 → 靠近补领文件夹'); ownsFolder(await snap(letter.page), true);
  check('只读信旧存档可实际靠近领取一次'); await letter.context.close();

  const terminalFirst = await setup(legacySave([], { x: 20, z: -30, yaw: 0, pitch: 0 }));
  for (const [i, id] of ['old-terminal', 'chat-viewer', 'image-cache'].entries()) {
    await visit(terminalFirst.page, id); await terminalFirst.page.locator('#collect-clue').click(); s = await snap(terminalFirst.page);
    ownsFolder(s, false); assert.deepEqual(s.memes, []); assert.deepEqual(s.collectedPickups, []); assert.ok(s.clues.includes(CARDS[i + 1])); assert.equal(s.archive.completed, false);
    await closeResume(terminalFirst.page);
  }
  await visit(terminalFirst.page, 'archive-desk'); assert.match(await terminalFirst.page.locator('#modal-body').innerText(), /还需要|缺少|未收/);
  check('隔离未拾取存档先读三台电脑只得调查资料，不获得梗本体且缺原图不能完成关联'); await terminalFirst.context.close();

  const gated = await setup(legacySave([]), false); ownsFolder(await snap(gated.page), false);
  await gated.page.waitForTimeout(500); ownsFolder(await snap(gated.page), false);
  await gated.page.keyboard.press('b'); await pausedCheck(gated.page); ownsFolder(await snap(gated.page), false); await gated.page.locator('#modal-close').click();
  await gated.page.keyboard.press('m'); assert.equal((await snap(gated.page)).mapOpen, true); await pausedCheck(gated.page); ownsFolder(await snap(gated.page), false);
  await gated.page.keyboard.press('m'); ownsFolder(await snap(gated.page), false); await gated.page.locator('#enter-drag').click();
  await gated.page.waitForFunction(id => window.__OUTPOST_DEBUG__.snapshot().collectedPickups.includes(id), PICKUP); ownsFolder(await snap(gated.page), true);
  check('范围内初始暂停、背包弹窗及地图均不拾取，恢复 active 后才领取');
  await gated.page.locator('#reset-button').click(); await gated.page.locator('#confirm-reset').click();
  await gated.page.waitForFunction(id => !window.__OUTPOST_DEBUG__.snapshot().collectedPickups.includes(id), PICKUP);
  s = await snap(gated.page); ownsFolder(s, false); assert.deepEqual(s.clues, []); assert.deepEqual(s.memes, []); assert.equal(s.archive.completed, false);
  assert.ok(Math.hypot(s.pose.x, s.pose.z - 9) < .01);
  check('隔离上下文通过原重置按钮清空新进度并恢复出生点与可拾取文件夹'); await gated.context.close();
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) {
  report.passed = false; report.errors.push(error.stack || String(error)); console.error(error); process.exitCode = 1;
  for (const context of browser.contexts()) for (const page of context.pages()) {
    await shot(page, 'pickup-test-failure').catch(() => {});
    const s = await snap(page).catch(() => null); console.log(JSON.stringify(s && { pose: s.pose, targetId: s.targetId, archive: s.archive, clues: s.clues, memes: s.memes, collectedPickups: s.collectedPickups, pickups: s.pickups, active: s.active, modal: s.modal }));
  }
} finally {
  report.finishedAt = new Date().toISOString(); await writeFile(out + 'pickup-browser-report.json', JSON.stringify(report, null, 2)); await browser.close();
}
