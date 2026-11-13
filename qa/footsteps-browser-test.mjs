import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createInputs } from './four-pickups-input-helpers.mjs';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5173/';
const out = fileURLToPath(new URL('./', import.meta.url));
const SAVE = 'old-web-outpost:save:v1';
const ALL = ['outpost-blue-mushroom-folder', 'field-folder-01', 'field-folder-02', 'field-folder-03', 'field-folder-04'];
const CLUES = ['missing-caption-image', 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'];
const report = {
  url, startedAt: new Date().toISOString(),
  method: 'Isolated save fixtures, actual keyboard/mouse movement, read-only debug snapshots and transparent observation of real Web Audio buffer playback. This verifies decoded nonzero audio and playback lifecycle, not subjective speaker listening.',
  checks: [], routes: [], playback: [], resources: [], errors: [],
};
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling'] });
const snap = page => page.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const { aim, walkAxis } = createInputs(snap, report);
const check = (name, details = true) => { report.checks.push({ name, details }); console.log(`PASS: ${name}`); };
const fixture = (x, z, yaw = 0) => ({ version: 1, investigated: true, clues: CLUES, pickupInventory: ALL,
  archive: { answers: { meaning: 'emotion', context: 'shared-self-mockery' }, completed: true }, pose: { x, z, yaw, pitch: 0 } });
const progress = state => ({ clues: state.clues, memes: state.memes, inventory: state.pickupInventory, collected: state.collectedPickups, archive: state.archive, investigated: state.investigated });

async function setup(pose) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await context.addInitScript(({ save, fixture }) => {
    if (!localStorage.getItem(save)) localStorage.setItem(save, JSON.stringify(fixture));
    window.__qaFootsteps = [];
    const buffers = new WeakMap(); let nextBuffer = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer) {
        if (!buffers.has(this.buffer)) buffers.set(this.buffer, ++nextBuffer);
        const data = this.buffer.getChannelData(0);
        let peak = 0, square = 0;
        for (const sample of data) { peak = Math.max(peak, Math.abs(sample)); square += sample * sample; }
        const state = window.__OUTPOST_DEBUG__?.snapshot();
        window.__qaFootsteps.push({ bufferId: buffers.get(this.buffer), surface: state?.footsteps.surface,
          audioTime: this.context.currentTime, pose: state?.pose, duration: this.buffer.duration,
          peak, rms: Math.sqrt(square / data.length), rate: this.playbackRate.value });
      }
      return start.apply(this, args);
    };
  }, { save: SAVE, fixture: pose });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('response', response => { if (/\/audio\/footsteps\/.+\.wav/.test(response.url())) report.resources.push({ url: response.url(), status: response.status() }); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  return { context, page };
}
async function enter(page) {
  await page.locator('#enter-drag').click();
  await page.waitForFunction(() => { const f = window.__OUTPOST_DEBUG__.snapshot().footsteps; return f.ready && f.context === 'running'; });
}
async function quiet(page, name, paused = false) {
  await page.waitForTimeout(120);
  const first = await snap(page);
  if (paused) assert.equal(first.active, false, `${name}: exploration paused`);
  assert.equal(first.footsteps.activeVoices, 0, `${name}: all voices stopped`);
  await page.waitForTimeout(320);
  const second = await snap(page);
  assert.equal(second.footsteps.steps, first.footsteps.steps, `${name}: no future playback`);
  assert.equal(second.footsteps.activeVoices, 0);
  check(name);
}
async function record(page, name) {
  const events = await page.evaluate(() => window.__qaFootsteps);
  for (const event of events) {
    assert.ok(event.peak > .01 && event.peak < 1, `${name}: nonzero unclipped sample`);
    assert.ok(event.rms > .001, `${name}: nonzero RMS`);
    assert.ok(event.duration > .04 && event.duration < 1.5, `${name}: short one-shot`);
    assert.ok(event.rate >= .959 && event.rate <= 1.041);
  }
  for (const surface of ['grass', 'stone']) {
    const subset = events.filter(event => event.surface === surface);
    for (let i = 1; i < subset.length; i++) assert.notEqual(subset[i].bufferId, subset[i - 1].bufferId, `${surface}: no immediately repeated sample`);
  }
  report.playback.push({ name, events });
  return events;
}
let activePage;
try {
  const ground = await setup(fixture(3, 8)); activePage = ground.page;
  const initial = await snap(ground.page), inventory = progress(initial);
  assert.equal(initial.footsteps.context, 'uninitialized');
  assert.equal(initial.footsteps.steps, 0);
  check('首次打开静音，不自动创建/播放音频');
  await enter(ground.page);
  assert.equal((await snap(ground.page)).footsteps.variantsPerSurface, 5);
  assert.ok((await snap(ground.page)).footsteps.volume <= .35);
  await quiet(ground.page, '点击进入后站立不播放');
  await walkAxis(ground.page, 'z', 5);
  assert.equal((await snap(ground.page)).footsteps.lastStep.surface, 'grass');
  check('草地实际行走触发草叶脚步');
  await quiet(ground.page, '松开移动键后快速停止');
  await aim(ground.page, .4); await aim(ground.page, 0);
  await quiet(ground.page, '原地转头不触发脚步');
  const grassSteps = (await snap(ground.page)).footsteps.steps;
  await walkAxis(ground.page, 'x', 0);
  assert.equal((await snap(ground.page)).footsteps.lastStep.surface, 'stone');
  assert.ok((await snap(ground.page)).footsteps.steps > grassSteps);
  await walkAxis(ground.page, 'z', 1);
  check('实际跨越草地到驿站石板路时自动切换石面');
  const events = await record(ground.page, 'grass-to-stone');
  assert.ok(events.filter(e => e.surface === 'grass').length >= 3);
  assert.ok(events.filter(e => e.surface === 'stone').length >= 3);
  check('两类音频均解码出非零PCM，真实播放且相邻变体不重复');
  assert.deepEqual(progress(await snap(ground.page)), inventory);
  await ground.context.close();

  const lifecycle = await setup(fixture(13.5, -15)); activePage = lifecycle.page;
  await enter(lifecycle.page);
  for (const kind of ['escape', 'bag', 'map', 'blur']) {
    const before = (await snap(lifecycle.page)).footsteps.steps;
    await lifecycle.page.keyboard.down('w');
    await lifecycle.page.waitForFunction(n => window.__OUTPOST_DEBUG__.snapshot().footsteps.steps > n, before);
    if (kind === 'escape') await lifecycle.page.keyboard.press('Escape');
    if (kind === 'bag') await lifecycle.page.keyboard.press('b');
    if (kind === 'map') await lifecycle.page.keyboard.press('m');
    if (kind === 'blur') await lifecycle.page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await lifecycle.page.keyboard.up('w');
    await quiet(lifecycle.page, `${kind} 暂停立即停止且无延迟排队脚步`, true);
    if (kind === 'bag') await lifecycle.page.locator('#modal-close').click();
    if (kind === 'map') await lifecycle.page.keyboard.press('m');
    await enter(lifecycle.page);
    await quiet(lifecycle.page, `${kind} 恢复后静止不补播`);
  }
  const beforeMute = (await snap(lifecycle.page)).footsteps.steps;
  await lifecycle.page.locator('#sound-button').click();
  assert.equal((await snap(lifecycle.page)).footsteps.enabled, false);
  await lifecycle.page.keyboard.down('w'); await lifecycle.page.waitForTimeout(600); await lifecycle.page.keyboard.up('w');
  assert.equal((await snap(lifecycle.page)).footsteps.steps, beforeMute);
  await quiet(lifecycle.page, '关闭脚步声后行走无声');
  const progressBeforeReload = progress(await snap(lifecycle.page));
  await lifecycle.page.keyboard.press('Escape');
  const savedPose = (await snap(lifecycle.page)).pose;
  await lifecycle.page.reload({ waitUntil: 'networkidle' });
  await lifecycle.page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  const restored = await snap(lifecycle.page);
  assert.equal(restored.footsteps.enabled, false);
  assert.equal(restored.footsteps.context, 'uninitialized');
  assert.deepEqual(progress(restored), progressBeforeReload);
  assert.ok(Math.hypot(restored.pose.x - savedPose.x, restored.pose.z - savedPose.z) < .001);
  check('静音偏好、游戏进度及位置刷新后保留');
  await lifecycle.page.locator('#sound-button').click();
  await enter(lifecycle.page);
  await lifecycle.page.keyboard.down('w');
  await lifecycle.page.waitForFunction(() => window.__OUTPOST_DEBUG__.snapshot().footsteps.steps > 0);
  await lifecycle.page.keyboard.up('w');
  check('重新开启后实际行走恢复播放');
  await record(lifecycle.page, 'lifecycle-after-reload');
  await lifecycle.context.close();

  const bridge = await setup(fixture(34, -8, -Math.PI / 2)); activePage = bridge.page;
  await enter(bridge.page);
  await aim(bridge.page, 0);
  await walkAxis(bridge.page, 'x', 44.5);
  const bridgeEvents = await record(bridge.page, 'bridge-crossing');
  assert.ok(bridgeEvents.length >= 8);
  assert.ok(bridgeEvents.every(event => event.surface === 'stone'));
  const onDeck = bridgeEvents.filter(event => event.pose.x > 34 && event.pose.x < 44);
  assert.ok(onDeck.length >= 7);
  check('两岸石路与石桥全程使用石面脚步，接缝无草地误判');
  await quiet(bridge.page, '过桥停止后无残留声音');
  await bridge.context.close();

  const wall = await setup(fixture(0, -4)); activePage = wall.page;
  await enter(wall.page);
  await wall.page.keyboard.down('w');
  await wall.page.waitForTimeout(900);
  const blocked = await snap(wall.page);
  await wall.page.waitForTimeout(800);
  const stillBlocked = await snap(wall.page);
  assert.ok(Math.hypot(blocked.pose.x - stillBlocked.pose.x, blocked.pose.z - stillBlocked.pose.z) < .001);
  assert.equal(stillBlocked.footsteps.steps, blocked.footsteps.steps);
  assert.equal(stillBlocked.footsteps.activeVoices, 0);
  await wall.page.keyboard.up('w');
  check('持续按住前进撞墙时实际位移为零，不播放脚步');
  await wall.context.close();

  const resources = new Map(report.resources.map(item => [item.url, item.status]));
  assert.equal(resources.size, 10); assert.ok([...resources.values()].every(status => status === 200));
  check('两种材质各5段本地WAV全部加载成功');
  assert.deepEqual(report.errors, []);
  check('浏览器无运行错误，原有收藏与任务进度保持');
  report.passed = true;
} catch (error) {
  report.passed = false; report.failure = { message: error.message, stack: error.stack };
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: out + 'footsteps-test-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(out + 'footsteps-browser-report.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
