import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createInputs } from './four-pickups-input-helpers.mjs';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5180/';
const out = fileURLToPath(new URL('./', import.meta.url));
const report = { url, startedAt: new Date().toISOString(), method: 'Isolated legal saved photo poses, actual drag camera input; supplemental framing only', photos: [], requests: [], console: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const snap = page => page.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const { aimPoint, aim } = createInputs(snap, report);
try {
  for (const photo of [
    { name: 'bridge-head', pose: { x: 30.8, z: -8, yaw: 0, pitch: 0 }, target: { x: 39, y: 2.7, z: -8 } },
    { name: 'bridge-inside', pose: { x: 35.5, z: -8, yaw: 0, pitch: 0 }, yaw: -Math.PI / 2, pitch: .16 },
  ]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(pose => localStorage.setItem('old-web-outpost:save:v1', JSON.stringify({ version: 1, pose })), photo.pose);
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') { const error = { text: m.text(), location: m.location() }; report.console.push(error); console.log(JSON.stringify(error)); } });
    page.on('response', r => { if (r.status() >= 400) { const response = { url: r.url(), status: r.status() }; report.requests.push(response); console.log(JSON.stringify(response)); } });
    await page.goto(url, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
    await page.locator('#enter-drag').click();
    let s = await snap(page); assert.equal(s.assets.length, 10); assert.ok(Math.hypot(s.pose.x - photo.pose.x, s.pose.z - photo.pose.z) < .001); assert.equal(s.eyeY, 1.65);
    if (photo.target) await aimPoint(page, photo.target); else await aim(page, photo.yaw, photo.pitch);
    await page.waitForTimeout(150); await page.screenshot({ path: out + photo.name + '.png', fullPage: true });
    s = await snap(page); report.photos.push({ name: photo.name, pose: s.pose, eyeY: s.eyeY, skyVisible: s.sky.visible }); await context.close();
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.console, []); assert.deepEqual(report.requests, []); report.passed = true;
} catch (error) { report.errors.push(error.stack || String(error)); report.passed = false; process.exitCode = 1; }
finally { report.finishedAt = new Date().toISOString(); await writeFile(out + 'bridge-photo-report.json', JSON.stringify(report, null, 2)); await browser.close(); }
