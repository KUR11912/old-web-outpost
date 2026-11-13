import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createInputs } from './four-pickups-input-helpers.mjs';

// Fresh isolated spawn and real mouse dragging. This refines the two requested
// compositions after the full regression; it does not replace that regression.
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const out = fileURLToPath(new URL('./', import.meta.url));
const report = { url: process.argv[3] || 'http://127.0.0.1:5180/', photos: [], errors: [], routes: [] };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(report.url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  await page.locator('#enter-drag').click();
  const snap = p => p.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
  const { aim } = createInputs(snap, report);
  const initial = await snap(page), { minX, minZ } = initial.sky.bounds;
  const dx = minX - initial.pose.x, dz = minZ - initial.pose.z;
  const cornerYaw = Math.atan2(-dx, -dz);
  for (const [name, yaw, pitch] of [['sky-exploration', 0, .08], ['sky-looking-up', cornerYaw, .55]]) {
    await aim(page, yaw, pitch); await page.waitForTimeout(100);
    const state = await snap(page); assert.equal(state.sky.visible, true); assert.equal(state.pose.x, initial.pose.x); assert.equal(state.pose.z, initial.pose.z);
    await page.screenshot({ path: out + name + '.png', fullPage: true });
    report.photos.push({ name, pose: state.pose, method: 'actual mouse drag from clean spawn', sky: state.sky });
  }
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) { report.passed = false; report.errors.push(error.stack); process.exitCode = 1; }
finally { await writeFile(out + 'sky-photo-report.json', JSON.stringify(report, null, 2)); await browser.close(); }
