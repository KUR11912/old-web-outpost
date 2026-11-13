import test from 'node:test';
import assert from 'node:assert/strict';
import { CLUES, CLUE_ORDER } from '../src/archive-data.ts';
import { MEMES, PICKUPS } from '../src/pickup-data.ts';
import { SAVE_KEY, CLUE_ID, createDefaultSave, collectPickup, normalizeSave, loadSave, saveGame, resetSave } from '../src/save.ts';

const memeId = 'blue-mushroom';
const pickupId = 'outpost-blue-mushroom-folder';

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('pickup registry reuses the existing meme card and keeps its stable world instance', () => {
  assert.ok(Object.hasOwn(MEMES, memeId));
  assert.equal(MEMES[memeId].clueId, CLUE_ID);
  assert.strictEqual(MEMES[memeId].clue, CLUES[CLUE_ID]);
  const original = PICKUPS.find(pickup => pickup.id === pickupId);
  assert.equal(original?.memeId, memeId);
  assert.equal(PICKUPS.filter(pickup => pickup.memeId === memeId).length, 1);
  assert.equal(original.model, 'MemeFolder_01');
  assert.deepEqual(original.position, { x: 1.5, z: -1.8 });
  assert.equal(original.icon, CLUES[CLUE_ID].image);
  assert.equal(new Set(PICKUPS.map(pickup => pickup.id)).size, PICKUPS.length);
  for (const pickup of PICKUPS) {
    if (pickup.memeId === null) continue;
    assert.ok(Object.hasOwn(MEMES, pickup.memeId));
    assert.ok(Object.hasOwn(CLUES, MEMES[pickup.memeId].clueId));
  }
});

test('first collection grants only ownership; repeated calls in the same frame never grant again', () => {
  const state = createDefaultSave();
  assert.deepEqual(state.memes, []);
  assert.deepEqual(state.collectedPickups, []);
  assert.equal(collectPickup(state, pickupId), true);
  for (let i = 0; i < 4; i++) assert.equal(collectPickup(state, pickupId), false);
  assert.deepEqual(state.clues, []);
  assert.deepEqual(state.queriedMemes, []);
  assert.deepEqual(state.memes, [memeId]);
  assert.deepEqual(state.collectedPickups, [pickupId]);
  assert.equal(state.investigated, false, 'Touching a folder does not read the mailbox');
  assert.equal(normalizeSave(state).investigated, false);
  assert.deepEqual(state.archive, createDefaultSave().archive);
});

test('old mailbox cards retain their history without creating world collections or queries', () => {
  const previous = { version: 1, investigated: true, clues: [CLUE_ID], pose: { x: 57, z: -35, yaw: .4, pitch: -.1 }, updatedAt: 1234 };
  const migrated = normalizeSave(previous);
  assert.deepEqual(migrated.clues, [CLUE_ID]);
  assert.deepEqual(migrated.memes, []);
  assert.deepEqual(migrated.collectedPickups, []);
  assert.deepEqual(migrated.queriedMemes, []);
  assert.deepEqual(migrated.pose, previous.pose);
  assert.equal(migrated.investigated, true);
  assert.equal(migrated.updatedAt, 1234);
  assert.equal(collectPickup(migrated, pickupId), true);
  assert.deepEqual(migrated.queriedMemes, []);
  assert.equal(normalizeSave({ ...previous, investigated: false }).investigated, true, 'Legacy clue implies the old explicit mailbox collection');
});

test('reading the letter alone never grants the image or hides the world pickup', () => {
  const state = normalizeSave({ version: 1, investigated: true, clues: [] });
  assert.equal(state.investigated, true);
  assert.deepEqual(state.clues, []);
  assert.deepEqual(state.memes, []);
  assert.deepEqual(state.collectedPickups, []);
  assert.equal(collectPickup(state, pickupId), true);
});

test('old cards and meme names do not suppress a first real pickup', () => {
  const cardOwner = normalizeSave({ version: 1, clues: [CLUE_ID] });
  assert.deepEqual(cardOwner.pickupInventory, []);
  assert.equal(collectPickup(cardOwner, pickupId), true);
  assert.deepEqual(cardOwner.memes, [memeId]);
  assert.deepEqual(cardOwner.collectedPickups, [pickupId]);
  assert.deepEqual(cardOwner.clues, [CLUE_ID]);
  const memeOwner = normalizeSave({ version: 1, memes: [memeId] });
  assert.deepEqual(memeOwner.pickupInventory, []);
  assert.equal(collectPickup(memeOwner, pickupId), true);
  assert.deepEqual(memeOwner.clues, []);
  assert.deepEqual(memeOwner.collectedPickups, [pickupId]);
});

test('current stale flags and legacy meme names cannot manufacture inventory', () => {
  const forged = normalizeSave({ ...createDefaultSave(), collectedPickups: [pickupId, 'unknown-pickup'], memes: ['unknown-meme', '__proto__'], clues: ['unknown-clue'] });
  assert.deepEqual(forged.clues, []);
  assert.deepEqual(forged.memes, []);
  assert.deepEqual(forged.collectedPickups, []);
  assert.equal(collectPickup(forged, pickupId), true);
  const restored = normalizeSave({ version: 1, memes: [memeId, memeId, 'unknown-meme'], collectedPickups: ['unknown-pickup'] });
  assert.deepEqual(restored.clues, []);
  assert.deepEqual(restored.memes, []);
  assert.deepEqual(restored.collectedPickups, []);
  assert.equal(restored.investigated, false);
});

test('invalid ids cannot collect; missing archive material does not block finding a name', () => {
  const state = createDefaultSave();
  assert.equal(collectPickup(state, 'unknown-pickup'), false);
  assert.equal(collectPickup(state, '__proto__'), false);
  const clue = CLUES[CLUE_ID];
  try {
    delete CLUES[CLUE_ID];
    assert.equal(collectPickup(state, pickupId), true);
    assert.deepEqual(state.pickupInventory, [pickupId]);
    assert.deepEqual(state.queriedMemes, []);
    assert.deepEqual(state.clues, []);
  } finally {
    CLUES[CLUE_ID] = clue;
  }
  // If the backpack write does not take, never hide the pickup or report success.
  const failed = createDefaultSave();
  failed.pickupInventory.push = () => 0;
  assert.equal(collectPickup(failed, pickupId), false);
  assert.deepEqual(failed.memes, []);
  assert.deepEqual(failed.collectedPickups, []);
});

test('save refresh keeps pickup inventory under v1; reset restores the pickup and leaves other saves alone', () => {
  const store = storage();
  const state = createDefaultSave();
  store.setItem('another-game', 'keep');
  collectPickup(state, pickupId);
  state.pose = { x: 3, z: -2, yaw: .5, pitch: -.2 };
  assert.equal(saveGame(state, store), true);
  const stored = JSON.parse(store.getItem(SAVE_KEY));
  assert.equal(stored.version, 1);
  assert.equal(stored.collectionVersion, 2);
  const restored = loadSave(store);
  assert.deepEqual(restored.clues, []);
  assert.deepEqual(restored.queriedMemes, []);
  assert.deepEqual(restored.memes, [memeId]);
  assert.deepEqual(restored.collectedPickups, [pickupId]);
  assert.deepEqual(restored.pose, state.pose);
  assert.equal(restored.investigated, false);
  assert.equal(collectPickup(restored, pickupId), false);
  assert.equal(resetSave(store), true);
  assert.equal(store.getItem(SAVE_KEY), null);
  assert.equal(store.getItem('another-game'), 'keep');
  const reset = loadSave(store);
  assert.deepEqual(reset, createDefaultSave());
  assert.equal(collectPickup(reset, pickupId), true);
});

test('migration preserves incorrect attempts and an already submitted valid completion', () => {
  const store = storage();
  const previous = { version: 1, investigated: true, clues: [...CLUE_ORDER], pose: { x: 57, z: -35, yaw: .4, pitch: -.1 }, updatedAt: 42 };
  const wrongAnswers = { meaning: 'food', context: 'serious-help' };
  const wrong = normalizeSave({ ...previous, archive: { answers: wrongAnswers, completed: false } });
  assert.deepEqual(wrong.archive.answers, wrongAnswers);
  assert.equal(wrong.archive.completed, false);
  assert.equal(collectPickup(wrong, pickupId), true);
  const correctAnswers = { meaning: 'emotion', context: 'shared-self-mockery' };
  const completed = normalizeSave({ ...previous, archive: { answers: correctAnswers, completed: true } });
  assert.deepEqual(completed.clues, CLUE_ORDER);
  assert.deepEqual(completed.archive, { answers: correctAnswers, completed: true });
  assert.deepEqual(completed.pose, previous.pose);
  assert.equal(saveGame(completed, store), true);
  assert.deepEqual(loadSave(store).archive, completed.archive);
});
