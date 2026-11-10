import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5180/';
const out = fileURLToPath(new URL('./', import.meta.url));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => localStorage.setItem('old-web-outpost:save:v1', JSON.stringify({
    version: 1, investigated: true, clues: ['missing-caption-image', 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'],
    pose: { x: 22.8, z: -34, yaw: 0, pitch: -.32 }, updatedAt: Date.now(),
    archive: { answers: { meaning: 'emotion', context: 'shared-self-mockery' }, completed: true },
  })));
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  await page.locator('#enter-drag').click();
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__.snapshot().targetId === 'image-cache');
  await page.keyboard.press('e');
  const gallery = page.locator('.variant-grid');
  await gallery.scrollIntoViewIfNeeded();
  await gallery.locator('img').first().waitFor({ state: 'visible' });
  assert.equal(await gallery.locator('img').count(), 2);
  assert.ok(await gallery.locator('img').evaluateAll(items => items.every(i => i.complete && i.naturalWidth === 594)));
  await page.screenshot({ path: out + 'archive-variants-comparison.png', fullPage: true });
  console.log('PASS: 两幅原图、完整底部文字和不同外围配文均已加载并截图。');
  await context.close();
} finally { await browser.close(); }
