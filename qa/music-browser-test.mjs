import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createInputs } from './four-pickups-input-helpers.mjs';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5173/';
const out = fileURLToPath(new URL('./', import.meta.url));
const SAVE = 'old-web-outpost:save:v1';
const ALL = ['outpost-blue-mushroom-folder', 'field-folder-01', 'field-folder-02', 'field-folder-03', 'field-folder-04'];
const fixture = { version: 1, investigated: true, clues: [], pickupInventory: ALL,
  archive: { answers: {}, completed: false }, pose: { x: 3, z: 8, yaw: 0, pitch: 0 } };
const report = {
  url, startedAt: new Date().toISOString(), checks: [], routes: [], resources: [], errors: [],
  method: 'Isolated browser storage and real UI inputs. Observes native media playback and clock advancement. A media-only seek to the final 0.25 seconds validates native looping; blur/focus lifecycle events are dispatched in the isolated page. No user storage or game state mutation, no subjective speaker listening.',
};
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling'] });
const snap = page => page.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const { walkAxis } = createInputs(snap, report);
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS: ' + name); };
const progress = state => ({ clues: state.clues, memes: state.memes, inventory: state.pickupInventory, collected: state.collectedPickups, archive: state.archive, investigated: state.investigated });
async function setup() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(({ key, fixture }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture));
    window.__qaMusicElements = [];
    window.__qaMusicEvents = [];
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      if (!window.__qaMusicElements.includes(this)) {
        window.__qaMusicElements.push(this);
        for (const type of ['playing', 'pause', 'ended', 'error']) this.addEventListener(type, () => {
          window.__qaMusicEvents.push({ type, time: this.currentTime, paused: this.paused, readyState: this.readyState });
        });
      }
      return originalPlay.apply(this, args);
    };
  }, { key: SAVE, fixture });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('response', response => {
    if (response.url().includes('/audio/music/')) report.resources.push({ url: response.url(), status: response.status() });
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  return { context, page };
}
async function advancing(page, label) {
  const before = (await snap(page)).music;
  await page.waitForTimeout(450);
  const after = (await snap(page)).music;
  assert.equal(after.paused, false, label + ': not paused');
  assert.ok(after.currentTime > before.currentTime + .15, label + ': media clock advances');
  check(label);
}
async function enter(page) {
  await page.locator('#enter-drag').click();
  await page.waitForFunction(() => {
    const s = window.__OUTPOST_DEBUG__.snapshot();
    return s.music.started && !s.music.paused && s.music.duration > 1;
  });
}
async function openMusic(page) {
  if (await page.locator('#music-panel').isHidden()) await page.locator('#music-button').click();
  await page.locator('#music-panel').waitFor({ state: 'visible' });
}
let activePage;
try {
  const { context, page } = await setup(); activePage = page;
  const original = await snap(page), originalProgress = progress(original);
  assert.equal(original.music.volume, .15);
  assert.equal(original.music.muted, false);
  assert.equal(original.music.started, false);
  assert.equal(original.music.paused, true);
  assert.equal(original.music.loop, true);
  await page.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); });
  await page.waitForTimeout(200);
  assert.equal((await snap(page)).music.started, false);
  assert.equal((await page.evaluate(() => window.__qaMusicElements)).length, 0);
  check('初次进入默认15%音量，未点击开始前不播放，焦点变化不自动起播');
  await enter(page);
  await advancing(page, '点击进入后上传MP3真实播放，站立时背景音乐继续');
  const media = await page.evaluate(() => window.__qaMusicElements.map(a => ({ src: a.currentSrc, duration: a.duration, volume: a.volume, loop: a.loop, paused: a.paused, readyState: a.readyState })));
  assert.equal(media.length, 1); assert.ok(media[0].readyState >= 2); assert.ok(media[0].duration > 1);
  assert.ok(decodeURIComponent(media[0].src).endsWith('/audio/music/11月13日.mp3'));
  report.initialMedia = media[0];
  check('使用上传的11月13日.mp3，只有一个循环媒体实例', media[0]);

  await walkAxis(page, 'z', 6.5);
  assert.ok((await snap(page)).footsteps.steps > 0);
  await advancing(page, '行走脚步与背景音乐可同时播放');
  await page.keyboard.press('Escape');
  await advancing(page, 'Esc暂停行走时音乐继续');
  await page.locator('#bag-button').click();
  await advancing(page, '查看收藏背包时音乐继续');
  await page.locator('#modal-close').click();
  await page.locator('#map-button').click();
  await advancing(page, '查看全图时音乐继续');
  await page.locator('#map-button').click();
  await enter(page);
  assert.equal(await page.evaluate(() => window.__qaMusicElements.length), 1);
  check('反复暂停恢复共用一个音乐实例，不叠加或从头重播');

  await openMusic(page);
  const range = page.locator('#music-volume');
  await range.focus(); await range.press('Home');
  assert.equal((await snap(page)).music.volume, 0);
  await range.press('End');
  assert.equal((await snap(page)).music.volume, 1);
  await range.press('Home');
  for (let i = 0; i < 23; i++) await range.press('ArrowRight');
  const chosenVolume = Number(await range.inputValue()) / 100;
  assert.ok(chosenVolume > 0 && chosenVolume < 1);
  assert.equal((await snap(page)).music.volume, chosenVolume);
  assert.equal(await page.evaluate(() => window.__qaMusicElements[0].volume), chosenVolume);
  check('顶部滑杆可实时调节0–100%，键盘可操作', { chosenVolume });
  await page.screenshot({ path: out + 'music-volume-panel.png', fullPage: true });
  await page.locator('#music-mute').click();
  assert.equal((await snap(page)).music.muted, true);
  assert.equal((await snap(page)).footsteps.enabled, true);
  assert.equal(await page.evaluate(() => window.__qaMusicElements[0].muted), true);
  check('音乐可独立静音，不关闭脚步和拾取音效');
  await page.locator('#music-mute').click();
  assert.equal((await snap(page)).music.muted, false);
  await page.locator('#sound-button').click();
  assert.equal((await snap(page)).footsteps.enabled, false);
  await advancing(page, '关闭音效不影响背景音乐');
  await page.locator('#sound-button').click();

  const beforeBlur = (await snap(page)).music.currentTime;
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(120);
  const paused = (await snap(page)).music;
  assert.equal(paused.paused, true);
  await page.waitForTimeout(350);
  assert.ok(Math.abs((await snap(page)).music.currentTime - paused.currentTime) < .025);
  assert.ok(paused.currentTime >= beforeBlur - .05);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(() => !window.__OUTPOST_DEBUG__.snapshot().music.paused);
  const restoredTime = (await snap(page)).music.currentTime;
  assert.ok(restoredTime >= paused.currentTime - .05);
  await advancing(page, '切出窗口暂停，回来从原位置继续');

  await page.evaluate(() => { const a = window.__qaMusicElements[0]; a.currentTime = a.duration - .25; });
  await page.waitForFunction(() => window.__qaMusicElements[0].currentTime < 2 && !window.__qaMusicElements[0].paused, null, { timeout: 7000 });
  await advancing(page, '实际抵达曲尾后自动回到开头继续循环');

  await openMusic(page);
  await page.locator('#music-mute').click();
  assert.equal((await snap(page)).music.muted, true);
  const priorSave = await snap(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  const restored = await snap(page);
  assert.equal(restored.music.volume, chosenVolume);
  assert.equal(restored.music.muted, true);
  assert.equal(restored.music.started, false);
  assert.equal(restored.music.paused, true);
  assert.deepEqual(progress(restored), originalProgress);
  assert.ok(Math.hypot(restored.pose.x - priorSave.pose.x, restored.pose.z - priorSave.pose.z) < .001);
  check('刷新保留音乐音量与静音偏好，游戏收藏/进度/位置不变且不自动出声');
  await enter(page);
  assert.equal((await snap(page)).music.muted, true);
  await openMusic(page);
  await page.locator('#music-mute').click();
  await advancing(page, '刷新后取消静音可继续播放');

  for (const width of [1440, 900, 650]) {
    await page.setViewportSize({ width, height: 900 });
    await openMusic(page);
    const panel = await page.locator('#music-panel').boundingBox();
    const button = await page.locator('#music-button').boundingBox();
    assert.ok(panel.x >= 0 && panel.x + panel.width <= width + 1, `${width}: music panel stays in viewport`);
    assert.ok(button.x >= 0 && button.x + button.width <= width + 1, `${width}: music button stays in viewport`);
  }
  check('1440/900/650宽度下顶部音乐控制保持可见、面板未溢出');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: out + 'music-volume-panel.png', fullPage: true });
  report.mediaEvents = await page.evaluate(() => window.__qaMusicEvents);
  assert.ok(report.resources.length >= 1);
  assert.ok(report.resources.every(resource => [200, 206].includes(resource.status)));
  assert.deepEqual(report.errors, []);
  assert.equal((await snap(page)).music.error, null);
  check('音乐资源加载成功，播放过程中无页面/控制台错误');
  await context.close();
  report.passed = true;
} catch (error) {
  report.passed = false; report.failure = { message: error.message, stack: error.stack };
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: out + 'music-test-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(out + 'music-browser-report.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
