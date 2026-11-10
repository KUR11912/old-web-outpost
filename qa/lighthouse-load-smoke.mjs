import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5180/';
const out = fileURLToPath(new URL('./', import.meta.url));
const report = { url, startedAt: new Date().toISOString(), errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
  const responsePromise = page.waitForResponse(r => r.url().includes('/assets/Lighthouse_01.glb'));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  const response = await responsePromise; assert.equal(response.status(), 200);
  const served = await response.body(), local = await readFile(new URL('../public/assets/Lighthouse_01.glb', import.meta.url));
  const hash = buffer => createHash('sha256').update(buffer).digest('hex');
  report.sha256 = hash(served); report.bytes = served.length; assert.equal(report.sha256, hash(local));
  const state = await page.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
  assert.equal(state.assets.length, 8);
  const tower = state.assets.find(a => a.name === 'Lighthouse_01');
  assert.equal(tower.instances, 1); assert.equal(tower.triangles, 1616); assert.ok(tower.texturedMaterials > 0);
  assert.ok(tower.nodeNames.includes('Lighthouse_Lamp_Core'));
  assert.ok(Math.abs(tower.dimensions.x - 3.84) < .01 && Math.abs(tower.dimensions.y - 14.3) < .01 && Math.abs(tower.dimensions.z - 5.41) < .01);
  assert.ok(tower.materialDetails.some(m => /glass/i.test(m.name) && m.transparent && Math.abs(m.opacity - .24) < .01));
  assert.ok(tower.materialDetails.some(m => m.emissive && m.emissive !== '000000' && m.emissiveIntensity > 0));
  report.asset = tower; assert.deepEqual(report.errors, []); report.passed = true;
  console.log('PASS: 最终实际服务GLB与本地文件SHA256一致，8件加载、Lamp_Core、玻璃、发光及尺寸正常。');
  await context.close();
} catch (error) { report.passed = false; report.errors.push(error.stack || String(error)); console.error(error); process.exitCode = 1; }
finally { report.finishedAt = new Date().toISOString(); await writeFile(out + 'lighthouse-load-smoke-report.json', JSON.stringify(report, null, 2)); await browser.close(); }
