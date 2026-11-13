import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createInputs } from './four-pickups-input-helpers.mjs';

// Browser contexts are isolated. Gameplay uses the existing physical drag/WASD
// helpers; __OUTPOST_DEBUG__ is read only. Edge fixtures are deliberately labeled
// as saved positions, followed by actual walking, not full routes from spawn.
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5180/';
const out = fileURLToPath(new URL('./', import.meta.url));
const SAVE = 'old-web-outpost:save:v1';
const ORIGINAL = 'outpost-blue-mushroom-folder';
const CARDS = ['missing-caption-image', 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'];
const oldWorld = JSON.parse(await readFile(new URL('./four-pickup-placement-snapshot.json', import.meta.url), 'utf8'));
const oldPickups = JSON.parse(await readFile(new URL('./four-pickups-browser-report.json', import.meta.url), 'utf8')).pickups;
const report = { url, startedAt: new Date().toISOString(), checks: [], routes: [], views: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling'] });
const snap = page => page.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const { aim, walk } = createInputs(snap, report);
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS: ' + name); };
const shot = (page, name) => page.screenshot({ path: out + name + '.png', fullPage: true });

async function setup({ fixture, enter = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  if (fixture) await context.addInitScript(({ key, fixture }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture)); }, { key: SAVE, fixture });
  const page = await context.newPage(), assets = [];
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (/\.glb(?:\?|$)|cloud-sky\.png(?:\?|$)/.test(response.url())) assets.push({ url: response.url(), status: response.status() }); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  if (enter) await page.locator('#enter-drag').click();
  return { context, page, assets };
}

async function view(page, name, yaw, pitch, screenshot = true) {
  await aim(page, yaw, pitch);
  await page.waitForTimeout(120);
  const state = await snap(page);
  assert.ok(state.sky?.visible, 'Sky should be visible in exploration');
  assert.deepEqual(state.sky.position, [0, 0, 0]);
  assert.deepEqual(state.sky.faces, report.initial.sky.faces);
  const diagnostics = await page.evaluate(() => {
    const s = window.__OUTPOST_DEBUG__.snapshot(), { yaw, pitch } = s.pose;
    const canvas = document.querySelector('#game-canvas').getBoundingClientRect(), tanV = Math.tan(67 * Math.PI / 360), tanH = tanV * canvas.width / canvas.height;
    const forward = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
    const right = [Math.cos(yaw), 0, -Math.sin(yaw)], up = [Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), Math.cos(yaw) * Math.sin(pitch)];
    const samples = [];
    for (const u of [-.98, -.5, 0, .5, .98]) for (const v of [0, .5, .98]) {
      const ray = forward.map((value, index) => value + right[index] * u * tanH + up[index] * v * tanV);
      if (ray[1] < 0) continue; // Lower rays can intersect the real ground first.
      const direction = { x: ray[0], y: ray[1], z: ray[2] };
      samples.push({ ndc: [u, v], direction, hit: window.__OUTPOST_DEBUG__.skyProbe({ x: s.pose.x, y: s.eyeY, z: s.pose.z }, direction) });
    }
    return samples;
  });
  assert.ok(diagnostics.length > 0);
  for (const sample of diagnostics) { assert.ok(sample.hit, `${name}: upward view ray misses sky ${sample.ndc}`); assert.ok(sample.hit.distance < state.camera.far); }
  const entry = { name, pose: state.pose, sky: state.sky, camera: state.camera, diagnostics };
  report.views.push(entry);
  if (screenshot) await shot(page, name);
  return entry;
}

async function mapRoundTrip(page, screenshot = false) {
  const before = await snap(page);
  await page.keyboard.press('m');
  const overview = await snap(page);
  assert.equal(overview.mapOpen, true);
  assert.equal(overview.sky.visible, false);
  assert.deepEqual(overview.pose, before.pose);
  await page.keyboard.down('w'); await page.waitForTimeout(180); await page.keyboard.up('w');
  assert.deepEqual((await snap(page)).pose, before.pose);
  if (screenshot) { await page.waitForTimeout(150); await shot(page, 'sky-map'); }
  await page.keyboard.press('m');
  const returned = await snap(page);
  assert.equal(returned.mapOpen, false); assert.equal(returned.sky.visible, true);
  assert.deepEqual(returned.pose, before.pose);
  assert.equal(returned.active, false);
  await page.locator('#enter-drag').click();
  return { before: { pose: before.pose, sky: before.sky }, overview: { pose: overview.pose, sky: overview.sky }, returned: { pose: returned.pose, sky: returned.sky } };
}

try {
  const { context, page, assets } = await setup();
  let state = await snap(page);
  assert.deepEqual(state.pose, state.map.spawn);
  assert.equal(state.assets.length, 9); assert.equal(state.pickups.length, 5);
  assert.equal(state.assets.find(asset => asset.name === 'MemeFolder_01').instances, 5);
  assert.equal(new Set(assets.filter(asset => asset.url.includes('.glb')).map(asset => asset.url)).size, 9);
  assert.equal(assets.filter(asset => asset.url.includes('cloud-sky.png')).length, 1);
  assert.ok(assets.every(asset => asset.status === 200));
  assert.deepEqual(state.colliders, oldWorld.colliders);
  assert.deepEqual(state.map, oldWorld.map);
  assert.deepEqual(state.pickups.map(p => ({ id: p.id, basePosition: p.basePosition, memeId: p.memeId })), oldPickups.map(p => ({ id: p.id, basePosition: p.basePosition, memeId: p.memeId })));
  assert.deepEqual(state.clues, []); assert.deepEqual(state.pickupInventory, []);
  assert.deepEqual(state.sky.faces.map(f => f.name).sort(), ['east', 'north', 'south', 'top', 'west']);
  assert.equal(state.sky.followsCamera, false); assert.equal(state.sky.colliders, 0);
  assert.deepEqual(state.sky.position, [0, 0, 0]);
  assert.equal(state.sky.texture.width, 1254); assert.equal(state.sky.texture.height, 1254);
  assert.equal(state.camera.far, state.sky.cameraFar);
  for (const face of state.sky.faces) { assert.equal(face.material.side, 'FrontSide'); assert.equal(face.material.fog, false); assert.equal(face.material.type, 'MeshBasicMaterial'); }
  report.initial = state; report.responses = assets;
  check('隔离新存档在原出生点；九个GLB、五文件夹、地图与所有碰撞体和此前快照一致；云图成功读取', { assetCount: state.assets.length, pickups: state.pickups.length, colliderCount: state.colliders.length });

  await view(page, 'sky-exploration', .66, .25);
  await view(page, 'sky-looking-up', .66, .85);
  console.log('SCREENSHOTS READY: sky-exploration.png and sky-looking-up.png');
  report.rays = await page.evaluate(() => {
    const s = window.__OUTPOST_DEBUG__.snapshot(), b = s.map.bounds, samples = [];
    const directions = [{ x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 1, y: .4, z: 1 }, { x: -1, y: .4, z: 1 }, { x: 1, y: .4, z: -1 }, { x: -1, y: .4, z: -1 }];
    for (const x of [b.minX + .26, (b.minX + b.maxX) / 2, b.maxX - .26]) for (const z of [b.minZ + .26, (b.minZ + b.maxZ) / 2, b.maxZ - .26]) {
      const origin = { x, y: 1.65, z };
      for (const direction of directions) samples.push({ origin, direction, hit: window.__OUTPOST_DEBUG__.skyProbe(origin, direction) });
    }
    return samples;
  });
  for (const sample of report.rays) { assert.ok(sample.hit, `World sky ray misses: ${JSON.stringify(sample)}`); assert.ok(sample.hit.distance > state.camera.near && sample.hit.distance < state.camera.far); }
  check('地图内九位置共81条只读实际Mesh射线：水平四向/正上/上斜四角均命中五面且未超过far', { count: report.rays.length, hitFaces: [...new Set(report.rays.map(s => s.hit.face))], maxDistance: Math.max(...report.rays.map(s => s.hit.distance)) });
  for (const [name, yaw] of [['north', 0], ['west', Math.PI / 2], ['south', Math.PI], ['east', -Math.PI / 2]]) {
    await view(page, `sky-spawn-${name}`, yaw, .15, false);
    await view(page, `sky-spawn-${name}-up`, yaw, 1.25, false);
  }
  check('出生点实际鼠标拖拽四向转头并抬头，保持天空可见；另留普通与抬头截图', report.views.map(v => ({ name: v.name, pose: v.pose, diagnostics: v.diagnostics })));
  check('M俯视隐藏围盒、暂停WASD、再次M恢复围盒并保留完整位姿', await mapRoundTrip(page, true));

  await walk(page, [[0, 0], [1.5, 0], [1.5, -1.15]], '从出生区实际WASD走向原蓝瘦文件夹');
  await page.waitForFunction(id => window.__OUTPOST_DEBUG__.snapshot().collectedPickups.includes(id), ORIGINAL);
  state = await snap(page);
  assert.deepEqual(state.pickupInventory, [ORIGINAL]);
  assert.deepEqual(state.clues, ['missing-caption-image']); assert.deepEqual(state.memes, ['blue-mushroom']);
  assert.equal(state.pickups.find(p => p.id === ORIGINAL).visible, false);
  assert.equal(await page.locator('#quest-count').innerText(), '1 / 4');
  assert.equal(state.archive.completed, false);
  await page.keyboard.press('b');
  assert.match(await page.locator('#modal-body').innerText(), /蓝瘦香菇/);
  await shot(page, 'sky-pickup-bag');
  await page.locator('#modal-close').click();
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  state = await snap(page);
  assert.deepEqual(state.pickupInventory, [ORIGINAL]); assert.deepEqual(state.clues, ['missing-caption-image']);
  assert.equal(state.pickups.find(p => p.id === ORIGINAL).visible, false); assert.equal(state.archive.completed, false);
  assert.equal(await page.locator('#quest-count').innerText(), '1 / 4');
  await page.keyboard.press('b'); assert.match(await page.locator('#modal-body').innerText(), /蓝瘦香菇/);
  check('实际步行拾取原蓝瘦文件夹、背包可见，刷新后收藏/隐藏/1⁄4进度保留', { pose: state.pose, inventory: state.pickupInventory, clues: state.clues });
  await context.close();

  // These short edge approaches begin with legal saved coordinates in their own
  // contexts. They do not represent a complete walking route from the spawn.
  const edges = [
    { name: 'west', pose: { x: -13, z: -20, yaw: 0, pitch: 0 }, key: 'a', axis: 'x', boundary: -15.74, yaw: Math.PI / 2 },
    { name: 'east', pose: { x: 65, z: -16, yaw: 0, pitch: 0 }, key: 'd', axis: 'x', boundary: 67.74, yaw: -Math.PI / 2 },
    { name: 'north', pose: { x: 0, z: -55, yaw: 0, pitch: 0 }, key: 'w', axis: 'z', boundary: -57.74, yaw: 0 },
    { name: 'south', pose: { x: 0, z: 13, yaw: 0, pitch: 0 }, key: 's', axis: 'z', boundary: 15.74, yaw: Math.PI },
  ];
  report.edges = [];
  for (const edge of edges) {
    const test = await setup({ fixture: { version: 1, pose: edge.pose } });
    const start = await snap(test.page);
    assert.ok(Math.hypot(start.pose.x - edge.pose.x, start.pose.z - edge.pose.z) < .001, `${edge.name}: fixture must be legal`);
    await test.page.keyboard.down(edge.key); await test.page.waitForTimeout(1600); await test.page.keyboard.up(edge.key);
    const reached = await snap(test.page);
    assert.ok(Math.abs(reached.pose[edge.axis] - edge.boundary) < .09, `${edge.name}: reach map boundary, got ${reached.pose[edge.axis]}`);
    assert.ok(Math.hypot(reached.pose.x - start.pose.x, reached.pose.z - start.pose.z) > 2.4);
    const views = [];
    for (const [suffix, yaw, pitch] of [['outward', edge.yaw, .2], ['corner', edge.yaw + .65, .65], ['up', edge.yaw, 1.25]]) views.push(await view(test.page, `sky-edge-${edge.name}-${suffix}`, yaw, pitch));
    if (edge.name === 'east') { await aim(test.page, edge.yaw + .65, .65); await shot(test.page, 'sky-edge'); }
    const toggle = await mapRoundTrip(test.page);
    report.edges.push({ name: edge.name, method: 'isolated legal save near edge, then physical WASD input to boundary', fixture: edge.pose, start: start.pose, reached: reached.pose, views, toggle });
    check(`${edge.name}边缘：合法隔离存档点实际步行抵达边界，外望/转角/抬头与M往返`, { start: start.pose, reached: reached.pose });
    await test.context.close();
  }

  const completed = await setup({ fixture: { version: 1, investigated: true, clues: CARDS, archive: { answers: { meaning: 'emotion', context: 'shared-self-mockery' }, completed: true } }, enter: false });
  const beforeReload = await snap(completed.page);
  assert.equal(beforeReload.archive.completed, true); assert.equal(await completed.page.locator('#quest-count').innerText(), '已完成');
  await completed.page.reload({ waitUntil: 'networkidle' }); await completed.page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  const afterReload = await snap(completed.page);
  assert.deepEqual(afterReload.archive, beforeReload.archive); assert.deepEqual(afterReload.clues, beforeReload.clues);
  assert.equal(await completed.page.locator('#quest-count').innerText(), '已完成');
  assert.equal(afterReload.pickups.length, 5); assert.equal(afterReload.sky.visible, true);
  check('旧v1四卡已完成存档加载与刷新仍保留任务答案、完成状态和原收藏迁移', { archive: afterReload.archive, clues: afterReload.clues, inventory: afterReload.pickupInventory });
  await completed.context.close();
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) {
  report.passed = false; report.errors.push(error.stack || String(error)); console.error(error); process.exitCode = 1;
  for (const context of browser.contexts()) for (const page of context.pages()) { await shot(page, 'sky-test-failure').catch(() => {}); report.failureState = await snap(page).catch(() => null); }
} finally {
  report.finishedAt = new Date().toISOString(); await writeFile(out + 'sky-browser-report.json', JSON.stringify(report, null, 2)); await browser.close();
}
