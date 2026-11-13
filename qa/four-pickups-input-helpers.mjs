import assert from 'node:assert/strict';

// Same real mouse/WASD helpers used by pickup-browser-test.mjs.
export function createInputs(snap, report) {
async function aim(page, yaw, pitch = 0) {
  const p = (await snap(page)).pose;
  const dx = -Math.atan2(Math.sin(yaw - p.yaw), Math.cos(yaw - p.yaw)) / .0022, dy = (p.pitch - pitch) / .0022;
  const b = await page.locator('#game-canvas').boundingBox(), n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 300));
  for (let i = 0; i < n; i++) {
    const x = b.x + b.width * .5, y = b.y + b.height * .55;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx / n, y + dy / n, { steps: 6 }); await page.mouse.up();
  }
}
async function aimPoint(page, point) {
  const p = (await snap(page)).pose, dx = point.x - p.x, dz = point.z - p.z;
  await aim(page, Math.atan2(-dx, -dz), Math.atan2(point.y - 1.65, Math.hypot(dx, dz)));
}
async function walkAxis(page, axis, target) {
  const begin = (await snap(page)).pose, diff = target - begin[axis];
  if (Math.abs(diff) < .08) return;
  const sign = Math.sign(diff), key = axis === 'x' ? (sign > 0 ? 'd' : 'a') : (sign > 0 ? 's' : 'w');
  let previous = begin, stuck = 0;
  await page.keyboard.down(key);
  try {
    for (let i = 0; i < 700; i++) {
      await page.waitForTimeout(50); const s = await snap(page);
      assert.ok(s.active, 'Movement paused unexpectedly'); assert.ok(Math.abs(s.eyeY - 1.65) < .005);
      if (Math.hypot(s.pose.x - previous.x, s.pose.z - previous.z) < .002) stuck++; else stuck = 0;
      if (stuck > 35) throw new Error(`Blocked ${axis}=${target} at ${JSON.stringify(s.pose)}`);
      previous = s.pose;
      if (sign * (s.pose[axis] - target) >= -.03) return;
    }
    throw new Error('Movement timed out');
  } finally { await page.keyboard.up(key); }
}
async function walk(page, nodes, name) {
  await aim(page, 0); const started = performance.now(), start = (await snap(page)).pose;
  for (const [x, z] of nodes) { await walkAxis(page, 'x', x); await walkAxis(page, 'z', z); }
  const item = { name, seconds: +((performance.now() - started) / 1000).toFixed(2), start, end: (await snap(page)).pose };
  report.routes.push(item); console.log('WALK: ' + JSON.stringify(item));
}
return { aim, aimPoint, walkAxis, walk };
}
