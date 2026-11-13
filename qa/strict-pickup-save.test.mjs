import test from 'node:test';
import assert from 'node:assert/strict';
import { CLUE_ORDER } from '../src/archive-data.ts';
import { PICKUPS } from '../src/pickup-data.ts';
import { searchMemeArchive, unlockMemeArchive, MEME_ARCHIVES } from '../src/meme-archives.ts';
import { SAVE_KEY, createDefaultSave, normalizeSave, collectPickup, loadSave, saveGame } from '../src/save.ts';

const ids = PICKUPS.map(pickup => pickup.id);
const memeIds = PICKUPS.map(pickup => pickup.memeId);
const historicalClues = [...CLUE_ORDER, ...memeIds.slice(1).map(id => `collection-${id}`)];
const pose = { x: 16.6, z: -33.7, yaw: .4, pitch: -.1 };
const archive = { answers: { meaning: 'emotion', context: 'shared-self-mockery' }, completed: true };
const history = { version: 1, clues: historicalClues, memes: memeIds, collectedPickups: ids, queriedMemes: memeIds,
  investigated: true, pose, archive, updatedAt: 1234 };
function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

test('fresh games own and unlock none of the five configured archives', () => {
  const save = createDefaultSave();
  assert.deepEqual(save.pickupInventory, []);
  assert.deepEqual(save.queriedMemes, []);
  for (const memeId of memeIds) {
    assert.equal(searchMemeArchive(save, MEME_ARCHIVES[memeId].name).status, 'uncollected');
    assert.equal(unlockMemeArchive(save, memeId), false);
  }
  assert.deepEqual(save, createDefaultSave());
});

test('explicit empty or malformed inventory overrides every legacy ownership hint in all versions', () => {
  for (const collectionVersion of [undefined, 1, 2]) {
    for (const pickupInventory of [[], null, undefined, {}, ids[0], true, 1]) {
      const save = normalizeSave({ ...history, collectionVersion, pickupInventory });
      assert.deepEqual(save.pickupInventory, []);
      assert.deepEqual(save.collectedPickups, []);
      assert.deepEqual(save.memes, []);
      assert.deepEqual(save.queriedMemes, []);
      assert.deepEqual(save.clues, historicalClues, 'Keep historical documents without turning them into folders');
      assert.deepEqual(save.archive, archive);
      assert.deepEqual(save.pose, pose);
      assert.equal(save.investigated, true);
      assert.equal(save.updatedAt, 1234);
      assert.deepEqual(normalizeSave(save), save, 'Repeated load cannot reconstruct cleared ownership');
    }
  }
});

test('old pickup markers are accepted only when the inventory field is absent', () => {
  for (const collectionVersion of [undefined, 1, 2]) {
    const raw = { ...history, collectionVersion, collectedPickups: [ids[2], ids[2], 'unknown-pickup'] };
    const fallback = normalizeSave(raw);
    assert.deepEqual(fallback.pickupInventory, [ids[2]]);
    assert.deepEqual(fallback.queriedMemes, [memeIds[2]]);
    const explicit = normalizeSave({ ...raw, pickupInventory: [ids[1]] });
    assert.deepEqual(explicit.pickupInventory, [ids[1]]);
    assert.deepEqual(explicit.queriedMemes, [memeIds[1]]);
    assert.deepEqual(explicit.collectedPickups, [ids[1]]);
  }
});

test('blue mushroom and every other meme require a new explicit query after collection', () => {
  for (const pickup of PICKUPS) {
    const raw = { version: 1, pickupInventory: [pickup.id], clues: historicalClues, memes: memeIds };
    const save = normalizeSave(raw);
    assert.deepEqual(save.queriedMemes, []);
    const result = searchMemeArchive(save, MEME_ARCHIVES[pickup.memeId].name);
    assert.equal(result.status, 'success');
    assert.equal(result.alreadyQueried, false);
    assert.equal(unlockMemeArchive(save, pickup.memeId), true);
    assert.deepEqual(save.queriedMemes, [pickup.memeId]);
    assert.deepEqual(save.pickupInventory, [pickup.id]);
  }
});

test('first pickup removes only its orphan query; repeated pickup keeps legitimate research', () => {
  for (const pickup of PICKUPS) {
    const other = PICKUPS.find(candidate => candidate.id !== pickup.id);
    const save = createDefaultSave();
    collectPickup(save, other.id);
    unlockMemeArchive(save, other.memeId);
    save.queriedMemes.push(pickup.memeId); // In-memory stale state from before ownership was checked.
    assert.equal(collectPickup(save, pickup.id), true);
    assert.deepEqual(save.queriedMemes, [other.memeId]);
    assert.equal(unlockMemeArchive(save, pickup.memeId), true);
    assert.equal(collectPickup(save, pickup.id), false);
    assert.deepEqual(save.queriedMemes, [other.memeId, pickup.memeId]);
    assert.equal(save.pickupInventory.length, 2);
  }
});

test('failed pickup writes neither clear queries nor hide scene folders', () => {
  const save = createDefaultSave();
  save.queriedMemes = [memeIds[0]];
  save.pickupInventory.push = () => 0;
  assert.equal(collectPickup(save, ids[0]), false);
  assert.deepEqual(save.queriedMemes, [memeIds[0]]);
  assert.deepEqual(save.collectedPickups, []);
  assert.deepEqual(save.memes, []);
});

test('genuine v2 inventory and explicit queries survive repeated saves without resetting history or preferences', () => {
  const store = storage();
  const raw = { ...history, collectionVersion: 2, pickupInventory: ids, queriedMemes: [memeIds[0], memeIds[3]] };
  store.setItem(SAVE_KEY, JSON.stringify(raw));
  store.setItem('old-web-outpost:music:v1', '{"volume":0.15,"muted":false}');
  store.setItem('another-game', 'keep');
  for (let index = 0; index < 3; index++) {
    const save = loadSave(store);
    assert.deepEqual(save.pickupInventory, ids);
    assert.deepEqual(save.queriedMemes, raw.queriedMemes);
    assert.deepEqual(save.clues, historicalClues);
    assert.deepEqual(save.pose, pose);
    assert.deepEqual(save.archive, archive);
    assert.equal(save.investigated, true);
    assert.equal(saveGame(save, store), true);
  }
  assert.equal(store.getItem('old-web-outpost:music:v1'), '{"volume":0.15,"muted":false}');
  assert.equal(store.getItem('another-game'), 'keep');
});
