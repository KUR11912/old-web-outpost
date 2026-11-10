import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMovement } from '../src/player.ts';
import { SAVE_KEY, CLUE_ID, createDefaultSave, normalizeSave, loadSave, saveGame, resetSave } from '../src/save.ts';
import { MAP } from '../src/map-config.ts';

test('large movement does not tunnel through a trunk or building', () => {
  const trunk = { kind: 'circle', x: 0, z: 0, radius: 0.4, label: 'tree' };
  const a = resolveMovement({ x: 0, z: 3 }, { x: 0, z: -6 }, [trunk], 14);
  assert.ok(a.collided && a.z > 0.659 && a.z < 0.662);
  const building = { kind: 'box', x: 0, z: 0, halfX: 2, halfZ: 2, label: 'building' };
  const b = resolveMovement({ x: 0, z: 3 }, { x: 0, z: -6 }, [building], 14);
  assert.ok(b.collided && b.z > 2.259 && b.z < 2.262);
});

test('player slides along wall, stays within boundary, recovers embedded position', () => {
  const wall = { kind: 'box', x: 0, z: 0, halfX: 2, halfZ: 2, label: 'wall' };
  const p = resolveMovement({ x: 0, z: 2.3 }, { x: 1, z: -1 }, [wall], 14);
  assert.ok(p.x > 0.99 && p.z > 2.259);
  const edge = resolveMovement({ x: 13, z: 0 }, { x: 5, z: 0 }, [], 14);
  assert.ok(edge.x <= 13.74 && edge.x > 13.739);
  const recovered = resolveMovement({ x: 0, z: 0 }, { x: 0, z: 0 }, [wall], 14);
  assert.ok(Math.abs(recovered.x) >= 2.26 || Math.abs(recovered.z) >= 2.26);
});

function memoryStorage() {
  const items = new Map();
  return {
    items,
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: key => items.delete(key),
  };
}

test('save survives reload, keeps one clue, reset leaves other games untouched', () => {
  const storage = memoryStorage();
  storage.setItem('ember-courier-save', 'original');
  const state = createDefaultSave();
  state.investigated = true;
  state.clues = [CLUE_ID, CLUE_ID, 'combat-item'];
  state.pose = { x: 1.5, z: -1.8, yaw: 0.2, pitch: -0.1 };
  assert.equal(saveGame(state, storage), true);
  const restored = loadSave(storage);
  assert.deepEqual(restored.clues, [CLUE_ID]);
  assert.equal(restored.investigated, true);
  assert.equal(restored.pose.z, -1.8);
  assert.equal(resetSave(storage), true);
  assert.equal(storage.getItem(SAVE_KEY), null);
  assert.equal(storage.getItem('ember-courier-save'), 'original');
});

test('reading a mailbox does not grant a card until explicit collection', () => {
  const storage = memoryStorage();
  const state = createDefaultSave();
  state.investigated = true;
  assert.equal(saveGame(state, storage), true);
  const afterReading = loadSave(storage);
  assert.equal(afterReading.investigated, true);
  assert.deepEqual(afterReading.clues, []);
  afterReading.clues.push(CLUE_ID);
  assert.equal(saveGame(afterReading, storage), true);
  const afterCollecting = loadSave(storage);
  assert.equal(afterCollecting.investigated, true);
  assert.deepEqual(afterCollecting.clues, [CLUE_ID]);
});

test('corrupt / old saves and storage denial do not crash exploration', () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, '{broken');
  assert.deepEqual(loadSave(storage), createDefaultSave());
  assert.deepEqual(normalizeSave({ version: 0, investigated: true }), createDefaultSave());
  const badPose = normalizeSave({ version: 1, investigated: true, pose: { x: Infinity, z: -5, yaw: 0, pitch: 0 } });
  assert.deepEqual(badPose.pose, createDefaultSave().pose);
  assert.deepEqual(badPose.clues, []);
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  assert.deepEqual(loadSave(denied), createDefaultSave());
  assert.equal(saveGame(createDefaultSave(), denied), false);
  assert.equal(resetSave(denied), false);
});

test('asymmetric map edges constrain both axes without returning to old 28m bounds', () => {
  const northeast = resolveMovement({ x: 67, z: -57 }, { x: 10, z: -10 }, [], MAP.bounds);
  assert.ok(northeast.collided);
  assert.ok(northeast.x > 67.739 && northeast.x <= 67.74);
  assert.ok(northeast.z < -57.739 && northeast.z >= -57.74);
  const southwest = resolveMovement({ x: -15, z: 15 }, { x: -10, z: 10 }, [], MAP.bounds);
  assert.ok(southwest.x >= -15.74 && southwest.x < -15.739);
  assert.ok(southwest.z <= 15.74 && southwest.z > 15.739);
});

function riverColliders() {
  return [
    { kind: 'box', x: 39, z: (-58 - 9.7) / 2, halfX: 3, halfZ: (58 - 9.7) / 2, label: '北段河流' },
    { kind: 'box', x: 39, z: (-6.3 + 16) / 2, halfX: 3, halfZ: (16 + 6.3) / 2, label: '南段河流' },
  ];
}

test('river blocks a long step from either bank while the bridge gap remains walkable', () => {
  const water = riverColliders();
  const west = resolveMovement({ x: 34, z: -30 }, { x: 12, z: 0 }, water, MAP.bounds);
  assert.ok(west.collided && west.x < 35.741 && west.x > 35.739);
  const east = resolveMovement({ x: 44, z: 0 }, { x: -12, z: 0 }, water, MAP.bounds);
  assert.ok(east.collided && east.x > 42.259 && east.x < 42.261);
  const bridge = resolveMovement({ x: 34, z: -8 }, { x: 10, z: 0 }, water, MAP.bounds);
  assert.ok(!bridge.collided && Math.abs(bridge.x - 44) < 1e-8);
  const returnTrip = resolveMovement(bridge, { x: -10, z: 0 }, water, MAP.bounds);
  assert.ok(!returnTrip.collided && Math.abs(returnTrip.x - 34) < 1e-8);
});

test('a loaded position inside river at the map edge recovers to a clear bank', () => {
  const water = riverColliders();
  for (const z of [-57.8, 15.8, -30, 0]) {
    const recovered = resolveMovement({ x: 39, z }, { x: 0, z: 0 }, water, MAP.bounds);
    assert.ok(recovered.collided);
    assert.ok(recovered.x < 35.741 || recovered.x > 42.259, JSON.stringify(recovered));
    assert.ok(recovered.z >= MAP.bounds.minZ + .26 && recovered.z <= MAP.bounds.maxZ - .26);
    const moving = resolveMovement(recovered, { x: recovered.x < 39 ? -1 : 1, z: 0 }, water, MAP.bounds);
    assert.ok(Math.abs(moving.x - recovered.x) > .99, 'Recovered player is not stuck');
  }
});

test('existing v1 clue ownership survives saving on the expanded east and north map', () => {
  const storage = memoryStorage();
  const state = { version: 1, investigated: true, clues: [CLUE_ID], pose: { x: 1.5, z: -1.4, yaw: 0, pitch: -.19 }, updatedAt: 12 };
  storage.setItem(SAVE_KEY, JSON.stringify(state));
  const existing = loadSave(storage);
  assert.deepEqual(existing.pose, state.pose);
  existing.pose = { x: 57, z: -35, yaw: .4, pitch: .1 };
  assert.equal(saveGame(existing, storage), true);
  const east = loadSave(storage);
  assert.equal(east.pose.x, 57);
  assert.equal(east.pose.z, -35);
  assert.deepEqual(east.clues, [CLUE_ID]);
  assert.equal(east.investigated, true);
  east.pose = { x: 20, z: -50, yaw: 0, pitch: 0 };
  saveGame(east, storage);
  assert.deepEqual(loadSave(storage).pose, east.pose);
  const outside = normalizeSave({ ...state, pose: { x: 100, z: -35, yaw: 0, pitch: 0 } });
  assert.deepEqual(outside.pose, createDefaultSave().pose);
  assert.deepEqual(outside.clues, [CLUE_ID]);
});
