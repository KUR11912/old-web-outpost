import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createInputs } from './four-pickups-input-helpers.mjs';

// Isolated browser storage; debug access is read-only. Bridge routes begin from
// explicitly labeled saved positions near the bridge, then use real mouse/WASD.
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] || 'http://127.0.0.1:5180/';
const skipPhotos = process.argv.includes('--skip-photos');
const out = fileURLToPath(new URL('./', import.meta.url));
const SAVE = 'old-web-outpost:save:v1';
const CARDS = ['missing-caption-image', 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'];
const oldWorld = JSON.parse(await readFile(new URL('./four-pickup-placement-snapshot.json', import.meta.url), 'utf8'));
const oldSky = JSON.parse(await readFile(new URL('./sky-browser-report.json', import.meta.url), 'utf8')).initial;
const report = { url, startedAt: new Date().toISOString(), method: 'Isolated saved positions near the bridge; actual mouse/WASD thereafter, not a complete walking route from spawn', checks: [], routes: [], movementSamples: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling'] });
const snap = page => page.evaluate(() => window.__OUTPOST_DEBUG__.snapshot());
const { aim, aimPoint, walk } = createInputs(snap, report);
const check = (name, details = true) => { report.checks.push({ name, details }); console.log('PASS: ' + name); };
const shot = async (page, name) => { if (skipPhotos) return; await page.waitForTimeout(160); await page.screenshot({ path: out + name + '.png', fullPage: true }); };
const pose = (x, z, yaw = 0, pitch = 0) => ({ x, z, yaw, pitch });
const completed = p => ({ version: 1, investigated: true, clues: CARDS, pickupInventory: oldSky.pickups.map(p => p.id), archive: { answers: { meaning: 'emotion', context: 'shared-self-mockery' }, completed: true }, pose: p });
function overlaps(p, c, r = .26) {
  if (c.kind === 'circle') return Math.hypot(p.x - c.x, p.z - c.z) < c.radius + r - .0002;
  const nx = Math.max(c.x - c.halfX, Math.min(c.x + c.halfX, p.x)), nz = Math.max(c.z - c.halfZ, Math.min(c.z + c.halfZ, p.z));
  return Math.hypot(p.x - nx, p.z - nz) < r - .0002;
}
function progress(s, expectedInventory = 5) {
  assert.deepEqual([...s.clues].sort(), [...CARDS].sort()); assert.equal(s.archive.completed, true);
  assert.deepEqual(s.archive.answers, { meaning: 'emotion', context: 'shared-self-mockery' });
  assert.equal(s.pickupInventory.length, expectedInventory); assert.equal(s.collectedPickups.length, expectedInventory);
}
async function setup(fixture) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  if (fixture) await context.addInitScript(({ key, fixture }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture)); }, { key: SAVE, fixture });
  const page = await context.newPage(), responses = [];
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push({ text: message.text(), location: message.location() }); });
  page.on('response', response => { if (/\.glb(?:\?|$)|cloud-sky\.png(?:\?|$)/.test(response.url())) responses.push({ url: response.url(), status: response.status() }); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready);
  await page.locator('#enter-drag').click();
  return { context, page, responses };
}
async function forwardX(page, target, name) {
  const before = await snap(page), sign = Math.sign(target - before.pose.x);
  await aim(page, sign > 0 ? -Math.PI / 2 : Math.PI / 2);
  await page.keyboard.down('w'); let previous = before.pose.x, stalled = 0;
  try {
    for (let i = 0; i < 600; i++) {
      await page.waitForTimeout(50); const s = await snap(page);
      report.movementSamples.push({ route: name, pose: s.pose, eyeY: s.eyeY });
      assert.ok(s.active); assert.ok(Math.abs(s.eyeY - 1.65) < .005);
      assert.ok(Math.abs(s.pose.z + 8) < .04, 'Keep original bridge centerline');
      assert.ok(!s.colliders.some(c => overlaps(s.pose, c)), 'Walking capsule may not overlap bridge columns or boundaries');
      stalled = Math.abs(s.pose.x - previous) < .002 ? stalled + 1 : 0;
      assert.ok(stalled < 35, 'Passage blocked'); previous = s.pose.x;
      if (sign * (s.pose.x - target) >= -.03) {
        report.routes.push({ name, start: before.pose, end: s.pose }); return;
      }
    }
    throw new Error('Bridge crossing timed out');
  } finally { await page.keyboard.up('w'); }
}
async function pressFor(page, key, ms) {
  await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); return snap(page);
}
async function reload(page) {
  await page.keyboard.press('Escape'); await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__OUTPOST_DEBUG__?.snapshot().ready); return snap(page);
}

try {
  const fresh = await setup(); let s = await snap(fresh.page); report.initial = s; report.responses = fresh.responses;
  report.renderer = await fresh.page.evaluate(() => { const gl = document.querySelector('#game-canvas').getContext('webgl2'), extension = gl?.getExtension('WEBGL_debug_renderer_info'); return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unavailable'; });
  assert.deepEqual(s.pose, s.map.spawn); assert.equal(s.assets.length, 10); assert.equal(s.pickups.length, 5);
  assert.equal(new Set(fresh.responses.filter(r => r.url.includes('.glb')).map(r => r.url)).size, 10);
  assert.ok(fresh.responses.every(r => r.status === 200));
  for (const old of oldSky.assets) {
    const now = s.assets.find(a => a.name === old.name); assert.ok(now); assert.equal(now.instances, old.instances);
    assert.equal(now.meshes, old.meshes); assert.equal(now.texturedMaterials, old.texturedMaterials);
  }
  const model = s.assets.find(a => a.name === 'ArcadeBridge_01');
  assert.equal(model.instances, 1); assert.ok(model.meshes > 0 && model.texturedMaterials > 0);
  assert.ok(Math.abs(model.dimensions.x - 10) < .05); assert.ok(Math.abs(model.dimensions.z - 3.8) < .05);
  assert.ok(s.bridge); report.bridge = s.bridge;
  assert.deepEqual(s.bridge.oldObjectsPresent, []);
  assert.equal(s.bridge.columnColliders.length, 8); assert.equal(s.bridge.edgeColliders.length, 2);
  assert.equal(s.bridge.deckTop, .02); assert.equal(s.bridge.traversableGroundY, 0); assert.equal(s.bridge.waterY, -.28);
  assert.deepEqual(s.bridge.walkableSurface, { minX: 34, maxX: 44, minZ: -9.9, maxZ: -6.1 });
  assert.ok(Math.abs(s.bridge.clearWidth - 2.54) < .001);
  assert.ok(Math.abs(s.bridge.worldBounds.min[0] - 34) < .002 && Math.abs(s.bridge.worldBounds.max[0] - 44) < .002);
  report.geometryProbes = await fresh.page.evaluate(() => {
    const probe = window.__OUTPOST_DEBUG__.bridgeProbe;
    return {
      deck: [34.02, 34.8, 36, 37.6, 39, 40.4, 42, 43.2, 43.98].map(x => ({ x, hit: probe({ x, y: 1.65, z: -8 }, { x: 0, y: -1, z: 0 }) })),
      passage: [-8.8, -8, -7.2].map(z => ({ z, hit: probe({ x: 34, y: 1.65, z }, { x: 1, y: 0, z: 0 }) })),
      arches: [34.8, 37.6, 40.4, 43.2].map(x => ({ x, hit: probe({ x, y: 1.65, z: -8 }, { x: 0, y: 1, z: 0 }) })),
      skyGaps: [36.2, 39, 41.8].map(x => ({ x, hit: probe({ x, y: 1.65, z: -8 }, { x: 0, y: 1, z: 0 }) })),
    };
  });
  for (const sample of report.geometryProbes.deck) assert.ok(sample.hit && Math.abs(sample.hit.point[1] - .02) < .002, 'Actual GLB deck must be level with existing roads');
  for (const sample of report.geometryProbes.passage) assert.equal(sample.hit, null, 'No mesh may obstruct the eye-height corridor');
  for (const sample of report.geometryProbes.arches) assert.ok(sample.hit && sample.hit.point[1] > 3.8, 'Four real overhead arches must leave head clearance');
  for (const sample of report.geometryProbes.skyGaps) assert.equal(sample.hit, null, 'Gaps between transverse arches must remain open to the sky');
  check('实际GLB射线：九桥面点等高0.02、三行走视线无实体阻挡、四拱架有净空、三拱间顶部镂空；旧桥对象和旧栏已移除', report.geometryProbes);
  const retainedMap = structuredClone(s.map), expectedMap = structuredClone(oldWorld.map);
  delete retainedMap.bridge.arcade; delete expectedMap.bridge.railHeight;
  retainedMap.locations.bridge.size.height = expectedMap.locations.bridge.size.height;
  retainedMap.locations.bridge.note = expectedMap.locations.bridge.note;
  assert.deepEqual(retainedMap, expectedMap);
  assert.deepEqual(s.pickups.map(p => ({ id: p.id, memeId: p.memeId, basePosition: p.basePosition })), oldSky.pickups.map(p => ({ id: p.id, memeId: p.memeId, basePosition: p.basePosition })));
  assert.deepEqual(s.colliders.filter(c => !c.label.includes('拱廊桥')), oldWorld.colliders.filter(c => c.label !== '桥栏'));
  assert.ok(!s.colliders.some(c => c.label === '桥栏'));
  assert.deepEqual(s.sky, oldSky.sky);
  assert.deepEqual(s.clues, []); assert.deepEqual(s.pickupInventory, []);
  check('新存档原出生点；十GLB与云图全部200，原九模型实例/贴图、地图/任务钩子、五拾取位置、非桥碰撞及天空保持', { model, bridge: s.bridge });

  await walk(fresh.page, [[0, 0], [1.5, 0], [1.5, -1.15]], '新存档从出生点实际步行拾取原蓝瘦文件夹');
  await fresh.page.waitForFunction(() => window.__OUTPOST_DEBUG__.snapshot().pickupInventory.length === 1);
  s = await snap(fresh.page); assert.deepEqual(s.clues, ['missing-caption-image']); assert.equal(await fresh.page.locator('#quest-count').innerText(), '1 / 4');
  const picked = s.pickupInventory; s = await reload(fresh.page);
  assert.deepEqual(s.pickupInventory, picked); assert.equal(s.pickups.find(p => p.id === picked[0]).visible, false);
  check('新存档真实拾取、任务1/4与刷新持久化不变'); await fresh.context.close();

  const crossing = await setup(completed(pose(31.8, -8))); const page = crossing.page;
  s = await snap(page); progress(s); assert.ok(Math.abs(s.pose.x - 31.8) < .001);
  await aimPoint(page, { x: 39, z: -8, y: 2.8 }); await shot(page, 'bridge-head');
  await forwardX(page, 39, '西岸原道路经过桥面接缝至桥内中央');
  const stopped = (await snap(page)).pose;
  for (const [yaw, pitch] of [[-Math.PI / 2, .45], [Math.PI / 2, .45], [0, 1.25], [Math.PI, .1]]) {
    await aim(page, yaw, pitch); const turned = await snap(page);
    assert.ok(Math.hypot(turned.pose.x - stopped.x, turned.pose.z - stopped.z) < .0001); assert.equal(turned.eyeY, 1.65);
  }
  await aim(page, -Math.PI / 2, .35); await shot(page, 'bridge-inside');
  await forwardX(page, 46, '桥内中央通过东岸桥面接缝至原道路');
  await forwardX(page, 31.8, '从东岸实际转身沿原路返回西岸');
  check('西岸→桥内停步转身/抬头→东岸→西岸真实WASD通行，所有采样眼高1.65连续且无柱/边缘重叠', { routes: report.routes, sampleCount: report.movementSamples.length });
  const before = await snap(page);
  await page.keyboard.press('m'); s = await snap(page); assert.equal(s.mapOpen, true); assert.equal(s.sky.visible, false); assert.deepEqual(s.pose, before.pose);
  await pressFor(page, 'w', 180); assert.deepEqual((await snap(page)).pose, before.pose);
  await page.keyboard.press('m'); s = await snap(page); assert.equal(s.sky.visible, true); assert.equal(s.active, false);
  await page.locator('#enter-drag').click();
  s = await reload(page); progress(s); assert.ok(Math.hypot(s.pose.x - before.pose.x, s.pose.z - before.pose.z) < .01);
  await page.keyboard.press('b'); assert.match(await page.locator('#modal-body').innerText(), /蓝瘦香菇/);
  check('五收藏及旧四卡已完成存档进度保持；M隐藏天空/暂停输入/恢复，返西岸刷新位置与背包持久化');
  await crossing.context.close();

  report.collisionTests = [];
  const columns = report.initial.colliders.filter(c => c.label.includes('拱廊桥') && c.label.includes('柱'));
  assert.equal(columns.length, 8);
  for (const column of columns) {
    const test = await setup(completed(pose(column.x, -8)));
    const direction = Math.sign(column.z + 8), key = direction < 0 ? 'w' : 's';
    s = await pressFor(test.page, key, 900);
    const boundary = column.z - direction * (column.halfZ + .26);
    assert.ok(Math.abs(s.pose.z - boundary) < .035, `Column must stop player: ${JSON.stringify(s.pose)} vs ${boundary}`);
    assert.ok(!s.colliders.some(c => overlaps(s.pose, c))); assert.equal(s.eyeY, 1.65);
    report.collisionTests.push({ name: column.label, column, end: s.pose, boundary }); await test.context.close();
  }
  check('两排共八石柱逐个从通道实际逼近，胶囊在柱基表面外0.26处受阻', report.collisionTests);
  for (const x of [35.5, 39, 42.5]) for (const side of [-1, 1]) {
    const test = await setup(completed(pose(x, -8))), start = await snap(test.page);
    s = await pressFor(test.page, side < 0 ? 'w' : 's', 1800);
    assert.ok(side * (s.pose.z + 8) > .9 && side * (s.pose.z + 8) <= 1.65, 'Bridge edge/water boundary must block leaving the deck');
    assert.ok(!s.colliders.some(c => overlaps(s.pose, c))); assert.equal(s.eyeY, 1.65);
    report.collisionTests.push({ name: 'bridge-edge', start: start.pose, end: s.pose }); await test.context.close();
  }
  for (const bank of [{ p: pose(34.5, -13), key: 'd', boundary: 35.74 }, { p: pose(43.5, -13), key: 'a', boundary: 42.26 }]) {
    const test = await setup(completed(bank.p)); s = await pressFor(test.page, bank.key, 1600);
    assert.ok(Math.abs(s.pose.x - bank.boundary) < .035); assert.ok(!s.colliders.some(c => overlaps(s.pose, c)));
    report.collisionTests.push({ name: 'river-bank', start: bank.p, end: s.pose }); await test.context.close();
  }
  check('桥两端与跨中两侧六次横向越界均受阻；两岸离桥下水尝试亦被原河流碰撞阻挡');

  const column = columns[2], legacyFixture = completed(pose(column.x, column.z)); delete legacyFixture.pickupInventory;
  const legacy = await setup(legacyFixture);
  s = await snap(legacy.page); progress(s, 1);
  assert.ok(Math.hypot(s.pose.x - column.x, s.pose.z - column.z) > .3); assert.ok(!s.colliders.some(c => overlaps(s.pose, c)));
  const recovered = s.pose; await aim(legacy.page, 0); s = await pressFor(legacy.page, column.z < -8 ? 's' : 'w', 500);
  assert.ok(Math.hypot(s.pose.x - recovered.x, s.pose.z - recovered.z) > .5); progress(s, 1);
  report.legacyRecovery = { original: pose(column.x, column.z), recovered, afterWalking: s.pose };
  s = await reload(legacy.page); progress(s, 1); assert.deepEqual(s.pickupInventory, ['outpost-blue-mushroom-folder']);
  check('无pickupInventory旧v1站在新石柱内时自动恢复，继续走动与刷新后四卡/已完成任务及原卡迁移保持', report.legacyRecovery); await legacy.context.close();

  const side = await setup(completed(pose(32.8, -18)));
  s = await snap(side.page); assert.ok(Math.hypot(s.pose.x - 32.8, s.pose.z + 18) < .001);
  await aimPoint(side.page, { x: 39, z: -8, y: 2.4 }); await shot(side.page, 'bridge-side');
  report.sidePhotoPose = (await snap(side.page)).pose; await side.context.close();
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) {
  report.passed = false; report.errors.push(error.stack || String(error)); console.error(error); process.exitCode = 1;
  for (const context of browser.contexts()) for (const page of context.pages()) { await shot(page, 'bridge-test-failure').catch(() => {}); report.failureState = await snap(page).catch(() => null); }
} finally {
  report.finishedAt = new Date().toISOString(); await writeFile(out + 'bridge-browser-report.json', JSON.stringify(report, null, 2)); await browser.close();
}
