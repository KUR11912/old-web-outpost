import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createInputs } from './four-pickups-input-helpers.mjs';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5173/';
const out = fileURLToPath(new URL('./', import.meta.url));
const SAVE = 'old-web-outpost:save:v1';
const PICKUPS = [
  { id: 'outpost-blue-mushroom-folder', x: 1.5, z: -1.8 },
  { id: 'field-folder-01', x: 20.4, z: -46 },
  { id: 'field-folder-02', x: 24.5, z: -20 },
  { id: 'field-folder-03', x: 26.6, z: 9 },
  { id: 'field-folder-04', x: 60, z: 3 },
];
const report = {
  url, startedAt: new Date().toISOString(), checks: [], routes: [], playback: [], errors: [],
  method: 'Isolated save fixtures and actual mouse/keyboard input. Transparent Web Audio start/stop/ended observation verifies nonzero PCM and playback lifecycle, not subjective speaker listening. No writes to user saves or test teleport hooks.',
};
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling'] });
const snap = page => page.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const { walkAxis } = createInputs(snap, report);
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS: ' + name); };
const fixture = (target, offset = 1.35) => ({ version: 1, investigated: false, clues: [], memes: [], pickupInventory: [],
  archive: { answers: { meaning: null, context: null }, completed: false }, pose: { x: target.x, z: target.z + offset, yaw: 0, pitch: 0 } });

async function setup(target = PICKUPS[0], offset = 1.35) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(({ key, initial }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial));
    window.__qaPickupAudio = [];
    const observed = new WeakMap();
    const originalStart = AudioBufferSourceNode.prototype.start;
    const originalStop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer) {
        const data = this.buffer.getChannelData(0);
        let peak = 0, squares = 0;
        for (const value of data) { peak = Math.max(peak, Math.abs(value)); squares += value * value; }
        const state = window.__OUTPOST_DEBUG__?.snapshot();
        const event = { duration: this.buffer.duration, peak, rms: Math.sqrt(squares / data.length),
          rate: this.playbackRate.value, startedAt: this.context.currentTime, endedAt: null, stops: [],
          inventory: state?.pickupInventory, pose: state?.pose };
        observed.set(this, event); window.__qaPickupAudio.push(event);
        this.addEventListener('ended', () => { event.endedAt = this.context.currentTime; });
      }
      return originalStart.apply(this, args);
    };
    AudioBufferSourceNode.prototype.stop = function (...args) {
      observed.get(this)?.stops.push({ at: this.context.currentTime, scheduled: args[0] ?? this.context.currentTime });
      return originalStop.apply(this, args);
    };
  }, { key: SAVE, initial: fixture(target, offset) });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  return { context, page };
}
async function enter(page, muted = false) {
  await page.locator('#enter-drag').click();
  if (!muted) await page.waitForFunction(() => {
    const audio = window.__OUTPOST_DEBUG__.snapshot().footsteps;
    return audio.ready && audio.context === 'running' && audio.pickup.ready;
  });
}
async function approach(page, target) {
  await page.keyboard.down('w');
  try {
    await page.waitForFunction(id => window.__OUTPOST_DEBUG__.snapshot().pickupInventory.includes(id), target.id, { timeout: 5000 });
  } finally { await page.keyboard.up('w'); }
}
const chimes = page => page.evaluate(() => window.__qaPickupAudio.filter(event => event.duration > .25));
async function savePlayback(page, name) {
  const events = await chimes(page); report.playback.push({ name, events }); return events;
}
function validChime(event) {
  assert.ok(event.duration > .25 && event.duration < .5, 'short pickup chime');
  assert.ok(event.peak > .05 && event.peak < 1, 'nonzero, unclipped PCM');
  assert.ok(event.rms > .005 && event.rms < .5, 'audible signal with headroom');
  assert.equal(event.rate, 1);
}
let activePage;
try {
  // Standing inside the radius tests that stationary footsteps do not truncate rewards.
  const stationary = await setup(PICKUPS[0], 0); activePage = stationary.page;
  await stationary.page.waitForTimeout(200);
  let state = await snap(stationary.page);
  assert.deepEqual(state.pickupInventory, []); assert.equal(state.footsteps.pickup.plays, 0);
  assert.equal((await chimes(stationary.page)).length, 0);
  check('暂停在文件夹附近时不收集、不自动播放');
  await enter(stationary.page);
  await stationary.page.waitForFunction(() => window.__OUTPOST_DEBUG__.snapshot().footsteps.pickup.plays === 1);
  await stationary.page.waitForTimeout(450);
  state = await snap(stationary.page);
  assert.equal(state.footsteps.steps, 0);
  assert.deepEqual(state.pickupInventory, [PICKUPS[0].id]);
  assert.equal(state.footsteps.pickup.activeVoices, 0);
  const stationaryEvents = await savePlayback(stationary.page, 'stationary-pickup');
  assert.equal(stationaryEvents.length, 1); validChime(stationaryEvents[0]);
  assert.equal(stationaryEvents[0].stops.length, 0);
  assert.ok(stationaryEvents[0].endedAt - stationaryEvents[0].startedAt >= stationaryEvents[0].duration - .025);
  check('原地成功收集时提示音完整播放，不被静止脚步逻辑截断');
  await stationary.context.close();

  for (const target of PICKUPS) {
    const entry = await setup(target); activePage = entry.page;
    await enter(entry.page);
    assert.equal((await snap(entry.page)).footsteps.pickup.plays, 0);
    await approach(entry.page, target);
    await entry.page.waitForTimeout(450);
    const collected = await snap(entry.page);
    assert.deepEqual(collected.pickupInventory, [target.id]);
    assert.deepEqual(collected.collectedPickups, [target.id]);
    assert.equal(collected.pickups.find(item => item.id === target.id).visible, false);
    assert.equal(collected.footsteps.pickup.plays, 1);
    assert.equal(collected.footsteps.pickup.activeVoices, 0);
    const events = await savePlayback(entry.page, target.id);
    assert.equal(events.length, 1); validChime(events[0]);
    assert.ok(events[0].inventory.includes(target.id), 'sound is triggered after successful award');
    assert.equal(events[0].stops.length, 0, 'releasing movement should not stop a reward');
    assert.ok(events[0].endedAt - events[0].startedAt >= events[0].duration - .025);
    check(`${target.id}：实际靠近只收集一次、只播放一次，松键后尾声正常完成`);
    if (target.id === PICKUPS[0].id) {
      await walkAxis(entry.page, 'z', target.z + 1.35);
      await walkAxis(entry.page, 'z', target.z + .5);
      await entry.page.waitForTimeout(250);
      assert.equal((await snap(entry.page)).footsteps.pickup.plays, 1);
      check('离开后再次靠近已收藏文件夹不重复播放');
      await entry.page.keyboard.press('Escape');
      await entry.page.reload({ waitUntil: 'networkidle' });
      await entry.page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
      await enter(entry.page);
      await entry.page.waitForTimeout(350);
      assert.equal((await snap(entry.page)).footsteps.pickup.plays, 0);
      assert.deepEqual((await snap(entry.page)).pickupInventory, [target.id]);
      assert.equal((await chimes(entry.page)).length, 0);
      check('刷新恢复收藏进度时不补播已获得物品的提示音');
    }
    await entry.context.close();
  }

  const muted = await setup(); activePage = muted.page;
  await muted.page.locator('#sound-button').click();
  await enter(muted.page, true);
  await approach(muted.page, PICKUPS[0]);
  assert.equal((await snap(muted.page)).footsteps.pickup.plays, 0);
  assert.deepEqual((await snap(muted.page)).pickupInventory, [PICKUPS[0].id]);
  assert.equal((await chimes(muted.page)).length, 0);
  check('关闭统一音效开关后仍能收集，但没有提示音');
  await muted.page.locator('#sound-button').click();
  await muted.page.waitForFunction(() => window.__OUTPOST_DEBUG__.snapshot().footsteps.pickup.ready);
  await muted.page.waitForTimeout(400);
  assert.equal((await snap(muted.page)).footsteps.pickup.plays, 0);
  assert.equal((await chimes(muted.page)).length, 0);
  check('重新开启音效时不补播静音期间的收藏');
  await muted.context.close();

  for (const kind of ['escape', 'bag', 'map', 'blur', 'mute']) {
    const entry = await setup(); activePage = entry.page;
    await enter(entry.page);
    await approach(entry.page, PICKUPS[0]);
    if (kind === 'escape') await entry.page.keyboard.press('Escape');
    if (kind === 'bag') await entry.page.keyboard.press('b');
    if (kind === 'map') await entry.page.keyboard.press('m');
    if (kind === 'blur') await entry.page.evaluate(() => window.dispatchEvent(new Event('blur')));
    if (kind === 'mute') await entry.page.locator('#sound-button').click();
    await entry.page.waitForTimeout(100);
    state = await snap(entry.page);
    assert.equal(state.footsteps.pickup.activeVoices, 0);
    if (kind !== 'mute') assert.equal(state.active, false);
    const events = await savePlayback(entry.page, `stop-${kind}`);
    assert.equal(events.length, 1);
    assert.equal(events[0].stops.length, 1, `${kind}: playback was explicitly stopped`);
    // Web Audio stops on its own clock; overview rendering may delay the JS
    // ended event. Assert the actual scheduled stop, not callback delivery lag.
    assert.ok(events[0].stops[0].scheduled - events[0].stops[0].at <= .02, 'short click-free fade-out');
    assert.ok(events[0].endedAt !== null, 'ended source is eventually cleaned up');
    await entry.page.waitForTimeout(350);
    assert.equal((await snap(entry.page)).footsteps.pickup.plays, 1);
    check(`${kind}：及时淡出收集提示音，不排队补播`);
    await entry.context.close();
  }
  assert.deepEqual(report.errors, []);
  check('浏览器无运行错误');
  report.passed = true;
} catch (error) {
  report.passed = false; report.failure = { message: error.message, stack: error.stack };
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: out + 'pickup-audio-test-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(out + 'pickup-audio-browser-report.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
