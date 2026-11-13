import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createInputs } from './four-pickups-input-helpers.mjs';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5181/';
const out = fileURLToPath(new URL('./', import.meta.url));
const SAVE = 'old-web-outpost:save:v1';
const ALL = ['outpost-blue-mushroom-folder', 'field-folder-01', 'field-folder-02', 'field-folder-03', 'field-folder-04'];
const QUEST = ['missing-caption-image', 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'];
const REMOVED = [
  { id: 'chat-viewer', label: '聊天记录查看器', x: 20, z: -36.1, y: 1.30 },
  { id: 'image-cache', label: '图片缓存终端', x: 22.8, z: -35.8, y: 1.18 },
  { id: 'archive-desk', label: '整理线索', x: 25, z: -32.5, y: 1.14 },
];
const baseline = JSON.parse(await readFile(out + 'remove-archive-baseline/previous-scene-snapshot.json', 'utf8')).state;
const report = { url, startedAt: new Date().toISOString(), checks: [], routes: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling'] });
const snap = page => page.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const { aim, aimPoint, walk } = createInputs(snap, report);
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS: ' + name); };
const shot = (page, name) => page.screenshot({ path: out + name + '.png', fullPage: true });

async function setup(fixture, enter = true) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  if (fixture) await context.addInitScript(({ key, fixture }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture));
  }, { key: SAVE, fixture });
  const page = await context.newPage();
  // Observe the real rendered scene inside this isolated QA context only.
  await page.route('**/src/main.ts*', async route => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace(/(\brenderer\s*=\s*new THREE\.WebGLRenderer\([^;]+;)/,
      '$1\nconst __qaRender = renderer.render; renderer.render = function(scene, camera) { window.__removeArchiveScene = scene; return __qaRender.call(this, scene, camera); };');
    await route.fulfill({ response, body });
  });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready && window.__removeArchiveScene);
  if (enter) await page.locator('#enter-drag').click();
  return { context, page };
}

async function noRetiredGuidance(page) {
  assert.doesNotMatch(await page.locator('.mission').innerText(), /整理线索|三个终端|四张线索|聊天记录|图片缓存/);
  const note = (await snap(page)).map.locations.archive.note;
  assert.doesNotMatch(note, /整理线索|三处调查/);
}

try {
  const hashes = JSON.parse(await readFile(out + 'remove-archive-baseline/source-hashes.json', 'utf8'));
  report.protectedSources = [];
  for (const item of hashes.filter(item => item.file !== 'archive-data.ts')) {
    const hash = createHash('sha256').update(await readFile(new URL('../src/' + item.file, import.meta.url))).digest('hex').toUpperCase();
    assert.equal(hash, item.sha256, item.file + ' unchanged');
    report.protectedSources.push({ file: item.file, unchanged: true });
  }
  check('存档、收藏绑定/动画、玩家、世界/地形/天空和样式等10个源码不变');

  const initial = await setup();
  const state = await snap(initial.page);
  report.initial = state;
  const map = structuredClone(state.map);
  assert.equal(map.locations.archive.note, '旧终端 · 读音便笺');
  assert.equal(map.futureHooks.find(hook => hook.id === 'archive_investigation').enabled, false);
  map.locations.archive.note = baseline.map.locations.archive.note;
  map.futureHooks.find(hook => hook.id === 'archive_investigation').enabled = baseline.map.futureHooks.find(hook => hook.id === 'archive_investigation').enabled;
  assert.deepEqual(map, baseline.map);
  const legacyContent = await initial.page.evaluate(async () => {
    const current = await import('/src/archive-data.ts');
    const before = await import('/qa/remove-archive-baseline/archive-data.ts');
    return { current: { cards: current.CLUES, order: current.CLUE_ORDER, questions: current.ARCHIVE_QUESTIONS }, before: { cards: before.CLUES, order: before.CLUE_ORDER, questions: before.ARCHIVE_QUESTIONS } };
  });
  legacyContent.before.cards['missing-caption-image'].content[2] = legacyContent.current.cards['missing-caption-image'].content[2];
  assert.deepEqual(legacyContent.current, legacyContent.before);
  assert.deepEqual(state.interactables.map(item => item.id), ['mailbox', 'old-terminal']);
  const retained = baseline.interactables.filter(item => ['mailbox', 'old-terminal'].includes(item.id));
  assert.deepEqual(state.interactables, retained);
  assert.deepEqual(state.colliders, baseline.colliders.filter(item => !REMOVED.some(removed => removed.label === item.label)));
  assert.deepEqual(state.assets, baseline.assets);
  assert.deepEqual(state.sky, baseline.sky);
  assert.deepEqual(state.camera, baseline.camera);
  assert.equal(state.eyeY, 1.65);
  assert.equal(state.pickups.length, 5);
  assert.deepEqual(state.pickups.map(item => ({ id: item.id, position: item.basePosition })), baseline.pickups.map(item => ({ id: item.id, position: item.basePosition })));
  const geometry = await initial.page.evaluate(ids => {
    const scene = window.__removeArchiveScene;
    const removed = ids.map(id => ({ id, object: !!scene.getObjectByName(id + '_interactable'), label: !!scene.getObjectByName(id + '_label') }));
    return { removed, retained: ['old-terminal_interactable', 'old-terminal_label', 'OldTerminal_CRT_01_instance'].map(name => ({ name, present: !!scene.getObjectByName(name) })) };
  }, REMOVED.map(item => item.id));
  assert.ok(geometry.removed.every(item => !item.object && !item.label));
  assert.ok(geometry.retained.every(item => item.present));
  const staleRoutes = await initial.page.evaluate(async removed => {
    const { createInvestigationUI } = await import('/src/investigation-ui.ts');
    const { createDefaultSave } = await import('/src/save.ts');
    const opened = [];
    const ui = createInvestigationUI({ save: createDefaultSave(), open: (...args) => opened.push(args[0]), close() {}, persist() {}, refresh() {}, toast() {} });
    removed.forEach(id => ui.showStation(id));
    return { opened, exposed: Object.keys(ui) };
  }, REMOVED.map(item => item.id));
  assert.deepEqual(staleRoutes.opened, []);
  assert.ok(!staleRoutes.exposed.includes('showAssociation'));
  await noRetiredGuidance(initial.page);
  assert.equal(await initial.page.locator('#quest-count').innerText(), '0 / 5');
  check('三个物件、牌子、碰撞和旧交互路由全部移除；旧终端/邮箱、五收藏和其他场景数据保持原样', { geometry, staleRoutes, colliders: state.colliders.length });
  await initial.context.close();

  for (const item of REMOVED) {
    const visit = await setup({ version: 1, pose: { x: item.x, z: item.z + 1.8, yaw: 0, pitch: 0 } });
    await aimPoint(visit.page, { x: item.x, y: item.y, z: item.z + .3 });
    await visit.page.waitForTimeout(100);
    assert.equal((await snap(visit.page)).targetId, null);
    assert.equal(await visit.page.locator('#interaction').isVisible(), false);
    await visit.page.keyboard.press('e');
    assert.equal((await snap(visit.page)).modal, false);
    await walk(visit.page, [[item.x, item.z], [item.x + 1.2, item.z], [item.x + 1.2, item.z + 1.8]], '实际走入并穿过原' + item.label + '占地');
    const end = await snap(visit.page);
    // The existing physical-input helper samples every 50ms (up to .12m of
    // travel), plus one rendered frame before releasing the key.
    assert.ok(Math.abs(end.pose.x - item.x - 1.2) < .22 && Math.abs(end.pose.z - item.z - 1.8) < .22);
    assert.equal(end.modal, false);
    check(item.label + '原位置无E提示/旧窗口，真实WASD穿过原碰撞占地', { start: { x: item.x, z: item.z + 1.8 }, end: end.pose });
    await visit.context.close();
  }

  const terminal = await setup({ version: 1, pose: { x: 16.6, z: -33.7, yaw: 0, pitch: 0 } });
  const old = (await snap(terminal.page)).interactables.find(item => item.id === 'old-terminal');
  await aimPoint(terminal.page, old.aim);
  await terminal.page.waitForFunction(() => window.__OUTPOST_DEBUG__.snapshot().targetId === 'old-terminal');
  await terminal.page.keyboard.press('e');
  assert.equal((await snap(terminal.page)).modal, true);
  assert.match(await terminal.page.locator('#modal-body').innerText(), /读音便笺/);
  await terminal.page.locator('#collect-clue').click();
  assert.ok((await snap(terminal.page)).clues.includes('echo-meaning-note'));
  assert.equal(await terminal.page.locator('#organize-clues, #return-association, #submit-association').count(), 0);
  assert.equal(await terminal.page.locator('#quest-count').innerText(), '0 / 5');
  await terminal.page.locator('#modal-close').click();
  await terminal.page.locator('#enter-drag').click();
  await walk(terminal.page, [[16.6, -31.5], [20, -31.5]], '从保留旧终端走到档案馆前方检查清理后的空间');
  await aim(terminal.page, 0, .15);
  await shot(terminal.page, 'removed-archive-front');
  check('保留旧终端可正常E调查并记录读音资料，没有整理入口，原三个位置清空', { clues: (await snap(terminal.page)).clues });
  await terminal.context.close();

  const complete = await setup({ version: 1, pickupInventory: ALL, collectedPickups: ALL, clues: QUEST, investigated: true,
    archive: { answers: { meaning: 'emotion', context: 'shared-self-mockery' }, completed: true } }, false);
  const oldSave = await snap(complete.page);
  assert.equal(oldSave.archive.completed, true);
  await noRetiredGuidance(complete.page);
  assert.equal(await complete.page.locator('#quest-count').innerText(), '5 / 5');
  await complete.page.keyboard.press('b');
  assert.equal(await complete.page.locator('[data-pickup-entry]').count(), 5);
  assert.equal(await complete.page.locator('#organize-clues, #return-association, #submit-association').count(), 0);
  await shot(complete.page, 'removed-archive-collections');
  await complete.page.reload({ waitUntil: 'networkidle' });
  await complete.page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  const restored = await snap(complete.page);
  assert.deepEqual(restored.archive, oldSave.archive);
  assert.deepEqual(restored.clues, oldSave.clues);
  assert.deepEqual(restored.pickupInventory, oldSave.pickupInventory);
  assert.ok(restored.pickups.every(item => !item.visible));
  assert.equal(await complete.page.locator('#quest-count').innerText(), '5 / 5');
  check('旧已完成调查存档及五项收藏完整恢复，刷新仍隐藏原文件夹；HUD仅显示5/5探索收藏');
  await complete.context.close();

  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.errors.push(error.stack || String(error));
  console.error(error);
  process.exitCode = 1;
  for (const context of browser.contexts()) for (const page of context.pages()) {
    await shot(page, 'removed-archive-failure').catch(() => {});
    const failure = await snap(page).catch(() => null);
    console.log(JSON.stringify(failure && { pose: failure.pose, targetId: failure.targetId, modal: failure.modal }));
  }
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(out + 'remove-archive-browser-report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
