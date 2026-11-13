import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const sourceRoot = new URL('../src/', import.meta.url).href;
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.startsWith(sourceRoot) && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    return next(`${specifier}.ts`, context);
  }
  return next(specifier, context);
} });
const { FootstepCadence } = await import('../src/footsteps.ts');

function simulate(speed, seconds, fps = 60, diagonal = false) {
  const cadence = new FootstepCadence(), events = [];
  for (let frame = 1; frame <= Math.round(seconds * fps); frame++) {
    const axis = speed / fps / (diagonal ? Math.SQRT2 : 1);
    const distance = diagonal ? Math.hypot(axis, axis) : axis;
    if (cadence.advance(distance, 1 / fps, true)) events.push({ frame, metres: frame * speed / fps, seconds: frame / fps });
  }
  return events;
}

test('cadence follows travelled distance at different movement speeds', () => {
  const fast = simulate(2.4, 5), slow = simulate(1.2, 10);
  assert.equal(fast.length, 11);
  assert.equal(slow.length, fast.length);
  for (let i = 0; i < fast.length; i++) {
    assert.ok(Math.abs(fast[i].metres - slow[i].metres) <= .041);
    if (i) assert.ok(Math.abs(fast[i].seconds - fast[i - 1].seconds - 1.12 / 2.4) < .018);
  }
});

test('equal actual distance gives equal diagonal and axial cadence', () => {
  assert.deepEqual(simulate(2.4, 5, 60, true), simulate(2.4, 5));
});

test('cadence is stable across rendering frame rates', () => {
  const runs = [30, 60, 144].map(fps => simulate(2.4, 5, fps));
  for (const events of runs) {
    assert.equal(events.length, 11);
    for (let i = 0; i < events.length; i++) assert.ok(Math.abs(events[i].metres - (.12 + i * 1.12)) <= .081);
  }
});

test('stationary movement and a held key against a wall cannot create footsteps', () => {
  const cadence = new FootstepCadence();
  assert.equal(cadence.advance(.12, .05, true), true);
  for (let i = 0; i < 120; i++) assert.equal(cadence.advance(0, 1 / 60, true), false);
  // Sub-pixel collision recovery does not accumulate over thousands of frames.
  for (let i = 0; i < 1200; i++) assert.equal(cadence.advance(.00001, 1 / 60, true), false);
});

test('pause discards a partial step; resuming needs new real movement', () => {
  const cadence = new FootstepCadence();
  assert.equal(cadence.advance(.08, .05, true), false);
  assert.equal(cadence.advance(.04, .05, false), false);
  assert.equal(cadence.advance(.04, .05, true), false);
  assert.equal(cadence.advance(.08, .05, true), true);
  assert.equal(cadence.advance(0, .05, true), false);
  assert.equal(cadence.advance(.08, .05, true), false);
});

test('restored poses, teleports, and stalled-frame catch-up cannot burst footsteps', () => {
  const cadence = new FootstepCadence();
  assert.equal(cadence.advance(20, .016, true), false);
  assert.equal(cadence.advance(2.4, 1, true), false);
  assert.equal(cadence.advance(.08, .05, true), false);
  assert.equal(cadence.advance(.04, .05, true), true);
});

test('invalid frame inputs remain silent and reset accumulated stride', () => {
  for (const [distance, dt] of [[NaN, .016], [Infinity, .016], [-1, .016], [.04, NaN], [.04, 0], [.04, -1]]) {
    const cadence = new FootstepCadence();
    cadence.advance(.08, .05, true);
    assert.equal(cadence.advance(distance, dt, true), false);
    assert.equal(cadence.advance(.08, .05, true), false);
  }
});
