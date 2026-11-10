import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5180/';
const out = fileURLToPath(new URL('./', import.meta.url));
const OLD_COUNTS = { Tree_01: 86, Rock_01: 20, Grass_01: 349, PathTile_01: 67, Outpost_01: 1 };
const CARDS = ['missing-caption-image', 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'];
const report = { url, startedAt: new Date().toISOString(), checks: [], routes: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling'] });
const snapshot = p => p.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS: ' + name); };
const shot = (p, name) => p.screenshot({ path: out + name + '.png', fullPage: true });
async function setup() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await context.addInitScript(cards => {
    if (!localStorage.getItem('old-web-outpost:save:v1')) localStorage.setItem('old-web-outpost:save:v1', JSON.stringify({
      version: 1, investigated: true, clues: cards, pose: { x: 16.6, z: -31.3, yaw: 0, pitch: 0 },
      archive: { answers: { meaning: 'emotion', context: 'shared-self-mockery' }, completed: true }, updatedAt: 1,
    }));
  }, CARDS);
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  const glbs = [];
  page.on('response', r => { if (r.url().includes('.glb')) glbs.push({ url: r.url(), status: r.status() }); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  await page.locator('#enter-drag').click();
  return { context, page, glbs };
}
async function aim(page, yaw, pitch = 0) {
  const pose = (await snapshot(page)).pose;
  const dx = -Math.atan2(Math.sin(yaw - pose.yaw), Math.cos(yaw - pose.yaw)) / .0022;
  const dy = (pose.pitch - pitch) / .0022;
  const box = await page.locator('#game-canvas').boundingBox();
  const count = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 300));
  for (let i = 0; i < count; i++) {
    const x = box.x + box.width * .5, y = box.y + box.height * .55;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + dx / count, y + dy / count, { steps: 6 }); await page.mouse.up();
  }
}
async function lookAt(page, point) {
  const p = (await snapshot(page)).pose, dx = point.x - p.x, dz = point.z - p.z;
  await aim(page, Math.atan2(-dx, -dz), Math.atan2(point.y - 1.65, Math.hypot(dx, dz)));
}
async function walkAxis(page, axis, target) {
  const begin = (await snapshot(page)).pose, diff = target - begin[axis];
  if (Math.abs(diff) < .08) return;
  const sign = Math.sign(diff), key = axis === 'x' ? (sign > 0 ? 'd' : 'a') : (sign > 0 ? 's' : 'w');
  let previous = begin, stuck = 0;
  await page.keyboard.down(key);
  try {
    for (let i = 0; i < 350; i++) {
      await page.waitForTimeout(45); const s = await snapshot(page);
      assert.ok(s.active); assert.ok(Math.abs(s.eyeY - 1.65) < .005);
      if (Math.hypot(s.pose.x - previous.x, s.pose.z - previous.z) < .002) stuck++; else stuck = 0;
      if (stuck > 35) throw new Error(`Blocked moving ${axis}=${target}, pose=${JSON.stringify(s.pose)}`);
      previous = s.pose;
      if (sign * (s.pose[axis] - target) >= -.03) return;
    }
    throw new Error('Walking timed out');
  } finally { await page.keyboard.up(key); }
}
async function walk(page, points, name) {
  await aim(page, 0); const start = (await snapshot(page)).pose;
  for (const [x, z] of points) { await walkAxis(page, 'x', x); await walkAxis(page, 'z', z); }
  report.routes.push({ name, start, end: (await snapshot(page)).pose });
}
async function pauseCheck(page) {
  const before = (await snapshot(page)).pose;
  await page.keyboard.down('w'); await page.waitForTimeout(250); await page.keyboard.up('w');
  assert.deepEqual((await snapshot(page)).pose, before);
}
try {
  const { page, context, glbs } = await setup();
  let s = await snapshot(page);
  report.renderer = await page.evaluate(() => { const g = document.querySelector('canvas').getContext('webgl2'), e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unavailable'; });
  const crt = s.assets.find(a => a.name === 'OldTerminal_CRT_01');
  assert.equal(s.assets.length, 8); assert.ok(crt && crt.instances === 1 && crt.meshes > 0 && crt.texturedMaterials > 0);
  assert.ok(crt.dimensions.x > .3 && crt.dimensions.y > .3 && crt.dimensions.z > .3);
  assert.ok(glbs.some(r => r.url.includes('OldTerminal_CRT_01.glb') && r.status === 200));
  check('第六个 CRT GLB 实际请求成功，网格与贴图加载完成', crt);
  for (const [name, instances] of Object.entries(OLD_COUNTS)) assert.equal(s.assets.find(a => a.name === name)?.instances, instances, name + ' instance count changed');
  assert.deepEqual(s.interactables.map(i => i.id).sort(), ['mailbox', 'old-terminal', 'chat-viewer', 'image-cache', 'archive-desk'].sort());
  check('其他五类 GLB 实例数与五个调查点 ID 保持不变', OLD_COUNTS);
  const materials = crt.materialDetails ?? await page.evaluate(() => window.__OUTPOST_DEBUG__.terminalMaterials?.());
  assert.ok(Array.isArray(materials) && materials.length > 0, 'Need actual post-world material inspection');
  assert.ok(materials.some(m => Math.abs(m.roughness - .7) < .03), 'CRT plastic roughness must remain .7');
  assert.ok(materials.some(m => Math.abs(m.roughness - .25) < .03), 'CRT glass roughness must remain .25');
  assert.ok(materials.some(m => [m.map, m.emissiveMap].some(t => t?.width === 256 && t?.height === 192)), '256 x 192 local CRT screen texture must load');
  check('网页中的塑料与玻璃粗糙度保留 .7 / .25，未统一覆盖为 1', materials);
  assert.deepEqual([...s.clues].sort(), [...CARDS].sort()); assert.equal(s.archive.completed, true);
  check('既有 v1 四卡及已完成调查状态保持', s.archive);
  const terminal = s.interactables.find(i => i.id === 'old-terminal');
  assert.ok(terminal.modelNames.includes('OldTerminal_CRT_01_instance'));
  assert.equal(terminal.modelNames.filter(name => name === '').length, 5, 'Original tabletop and four legs must remain');
  check('新电脑挂接原 old-terminal 调查对象，原桌面和四条桌腿保留');

  await walk(page, [[17.3, -31.8]], '走近终端并观察与右侧聊天站的关系');
  await lookAt(page, { x: 18.0, y: 1.12, z: -35.5 }); await shot(page, 'terminal-game-reference');
  await walk(page, [[terminal.approach.x, -31.8], [terminal.approach.x, terminal.approach.z]], '真实靠近旧终端');
  await lookAt(page, terminal.aim); await shot(page, 'terminal-game-front');
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__.snapshot().targetId === 'old-terminal');
  await page.keyboard.press('e'); await page.locator('#modal').waitFor({ state: 'visible' });
  const content = await page.locator('#modal-body').innerText();
  assert.match(content, /读音便笺/); assert.match(content, /难受，想哭/); assert.match(content, /读音示意/);
  assert.equal(await page.locator('#collect-clue:enabled').count(), 0);
  assert.deepEqual([...(await snapshot(page)).clues].sort(), [...CARDS].sort());
  await pauseCheck(page); await shot(page, 'terminal-game-investigation');
  check('真实瞄准 CRT 按 E 仍打开原读音资料，已持有线索不重复发放');
  await page.locator('#modal-close').click(); assert.equal((await snapshot(page)).active, false);
  await pauseCheck(page); await page.locator('#enter-drag').click(); assert.equal((await snapshot(page)).active, true);
  check('窗口暂停、关闭后明确点击恢复正常');

  await walk(page, [[15.15, terminal.approach.z], [15.15, -36.3]], '绕左侧查看 CRT 深度及背面');
  await lookAt(page, { x: 16.6, y: 1.22, z: -35.5 }); await shot(page, 'terminal-game-side');
  check('可从左侧绕到后方，桌面与建筑碰撞没有新增卡点');
  const beforeReload = (await snapshot(page)).pose;
  await page.keyboard.press('Escape'); await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  s = await snapshot(page);
  assert.deepEqual([...s.clues].sort(), [...CARDS].sort()); assert.equal(s.archive.completed, true);
  assert.ok(Math.hypot(s.pose.x - beforeReload.x, s.pose.z - beforeReload.z) < .01);
  assert.equal(s.archive.answers.meaning, 'emotion'); assert.equal(s.archive.answers.context, 'shared-self-mockery');
  check('刷新后位置、四张线索、两项答案和完成状态完整恢复', s.pose);
  await context.close(); assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) {
  report.passed = false; report.errors.push(error.stack || String(error)); console.error(error); process.exitCode = 1;
  for (const context of browser.contexts()) for (const page of context.pages()) {
    await shot(page, 'terminal-test-failure').catch(() => {});
    const s = await snapshot(page).catch(() => null);
    console.log(JSON.stringify(s && { pose: s.pose, targetId: s.targetId, active: s.active, archive: s.archive }));
  }
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(out + 'terminal-browser-report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
