import test from 'node:test';
import assert from 'node:assert/strict';
import { CLUES, CLUE_ORDER } from '../src/archive-data.ts';
import { PICKUPS, getPickupContent } from '../src/pickup-data.ts';
import { MEME_ARCHIVES, getMemeArchive, normalizeMemeName, matchMemeName, searchMemeArchive, unlockMemeArchive, hasMemeArchiveContent } from '../src/meme-archives.ts';
import { SAVE_KEY, createDefaultSave, collectPickup, normalizeSave, saveGame, loadSave, resetSave } from '../src/save.ts';

const blue = 'blue-mushroom', folder = 'outpost-blue-mushroom-folder';
const other = PICKUPS.filter(item => item.id !== folder);
const withoutQueries = save => { const copy = structuredClone(save); delete copy.queriedMemes; return copy; };
function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('picking up only awards stable ownership, never archive cards or query state', () => {
  const state = createDefaultSave();
  for (const pickup of PICKUPS) {
    assert.equal(collectPickup(state, pickup.id), true);
    assert.equal(collectPickup(state, pickup.id), false);
    assert.ok(state.pickupInventory.includes(pickup.id));
    assert.ok(state.memes.includes(pickup.memeId));
    assert.deepEqual(state.queriedMemes, []);
    assert.deepEqual(state.clues, []);
  }
  assert.equal(state.pickupInventory.length, 5);
  assert.deepEqual(normalizeSave(state), state);
  assert.equal(getPickupContent(PICKUPS[0]).name, 'Blue and Mushroom');
});

test('empty, unknown and uncollected queries are distinct and never modify saves', () => {
  const state = createDefaultSave(), before = structuredClone(state);
  assert.equal(searchMemeArchive(state, ' \u3000 ').status, 'empty');
  assert.equal(searchMemeArchive(state, '不存在的梗').status, 'unknown');
  assert.equal(searchMemeArchive(state, '蓝瘦香菇').status, 'uncollected');
  assert.equal(searchMemeArchive(state, '你是GG还是MM').status, 'uncollected');
  assert.equal(unlockMemeArchive(state, blue), false);
  assert.deepEqual(state, before);
});

test('name normalization is exact, case/width tolerant and only uses explicit aliases', () => {
  assert.equal(normalizeMemeName(' \u3000你是ｇｇ还是ＭＭ\u3000 '), '你是gg还是mm');
  assert.equal(matchMemeName(' 你是ｇｇ还是ＭＭ ')?.id, 'gg-or-mm');
  assert.equal(matchMemeName('你是gg还是mm?')?.id, 'gg-or-mm');
  assert.equal(matchMemeName('蓝瘦香菇图片')?.id, blue);
  assert.equal(matchMemeName('蓝瘦,香菇')?.id, blue);
  assert.equal(matchMemeName('友谊的小船说翻就翻')?.id, 'friendship-boat');
  assert.equal(matchMemeName('友谊小船')?.id, 'friendship-boat');
  assert.equal(matchMemeName('ＧＧ还是ｍｍ')?.id, 'gg-or-mm');
  assert.equal(matchMemeName('厉害了，ＷＯＲＤ哥')?.id, 'awesome-my-bro');
  assert.equal(matchMemeName('你是魔鬼还是秀儿?')?.id, 'devil-or-showoff');
  for (const query of ['蓝瘦', '香菇', '蓝瘦香菇图片extra', '你是GG 还是MM', '<img src=x>', '__proto__']) {
    assert.equal(matchMemeName(query), undefined, query);
  }
  const oldAliases = MEME_ARCHIVES['friendship-boat'].aliases;
  try {
    MEME_ARCHIVES['friendship-boat'].aliases = ['蓝瘦香菇'];
    assert.equal(matchMemeName('蓝瘦香菇'), undefined, 'ambiguous config does not unlock an arbitrary record');
  } finally { MEME_ARCHIVES['friendship-boat'].aliases = oldAliases; }
});

test('successful lookup is read-only until shown, then unlocks just the existing item', () => {
  const state = createDefaultSave();
  for (const pickup of PICKUPS) collectPickup(state, pickup.id);
  const before = structuredClone(state);
  const result = searchMemeArchive(state, '蓝瘦香菇');
  assert.equal(result.status, 'success');
  assert.equal(result.archive.id, blue);
  assert.equal(result.alreadyQueried, false);
  assert.deepEqual(state, before, 'simply opening/searching cannot grant anything');
  assert.equal(unlockMemeArchive(state, result.archive.id), true);
  assert.deepEqual(state.queriedMemes, [blue]);
  assert.deepEqual(withoutQueries(state), withoutQueries(before));
  assert.equal(unlockMemeArchive(state, blue), false);
  assert.equal(searchMemeArchive(state, '蓝瘦香菇图片').alreadyQueried, true);
  assert.equal(state.pickupInventory.length, 5);
});

test('all four supplied archives resolve and unlock independently without adding inventory', () => {
  const state = createDefaultSave();
  for (const pickup of other) collectPickup(state, pickup.id);
  const inventoryBefore = structuredClone(withoutQueries(state));
  const expectedQueries = [];
  for (const pickup of other) {
    const result = searchMemeArchive(state, getPickupContent(pickup).name);
    assert.equal(result.status, 'success');
    assert.equal(result.alreadyQueried, false);
    assert.equal(result.archive.id, pickup.memeId);
    assert.deepEqual(result.archive.clueIds, [`collection-${pickup.memeId}`]);
    assert.equal(result.archive.image, CLUES[`collection-${pickup.memeId}`].image);
    assert.notEqual(result.archive.image, MEME_ARCHIVES[blue].image);
    assert.equal(unlockMemeArchive(state, pickup.memeId), true);
    expectedQueries.push(pickup.memeId);
    assert.deepEqual(state.queriedMemes, expectedQueries);
    assert.equal(unlockMemeArchive(state, pickup.memeId), false);
    assert.equal(searchMemeArchive(state, getPickupContent(pickup).name).alreadyQueried, true);
    assert.deepEqual(withoutQueries(state), inventoryBefore);
  }
  assert.equal(state.queriedMemes.includes(blue), false);
  const archive = getMemeArchive(blue);
  assert.equal(hasMemeArchiveContent(archive), true);
  assert.equal(archive.image, 'assets/blue-mushroom-meme.png');
  assert.ok(archive.clueIds.includes('echo-meaning-note'));
  assert.ok(archive.clueIds.includes('echo-chat-context'));
  assert.equal(getMemeArchive('__proto__'), undefined);
});

test('unavailable or placeholder materials stay locked even for an owned item', () => {
  const id = 'friendship-boat', old = MEME_ARCHIVES[id];
  const clueId = old.clueIds[0], originalClue = CLUES[clueId];
  const state = createDefaultSave();
  collectPickup(state, 'field-folder-01');
  const before = structuredClone(state);
  try {
    MEME_ARCHIVES[id] = { ...old, available: false, missingReason: '终端资料暂缺' };
    const unavailable = searchMemeArchive(state, old.name);
    assert.equal(unavailable.status, 'unavailable');
    assert.equal(unavailable.archive.id, id);
    assert.equal(unlockMemeArchive(state, id), false);
    MEME_ARCHIVES[id] = old;
    CLUES[clueId] = { ...originalClue, sourceLabel: 'Information pending' };
    assert.equal(searchMemeArchive(state, old.name).status, 'unavailable');
    assert.equal(unlockMemeArchive(state, id), false);
    assert.deepEqual(state, before);
  } finally { MEME_ARCHIVES[id] = old; CLUES[clueId] = originalClue; }
});

test('legacy explicit pickups retain ownership; cards and names stay historical only', () => {
  for (const pickup of PICKUPS) {
    const oldClue = pickup.memeId === blue ? 'missing-caption-image' : `collection-${pickup.memeId}`;
    for (const record of [
      { pickupInventory: [pickup.id] }, { memes: [pickup.memeId] },
      { clues: [oldClue] }, { collectedPickups: [pickup.id] },
    ]) {
      const old = { version: 1, ...record, pose: { x: 57, z: -35, yaw: .4, pitch: -.1 }, updatedAt: 1234 };
      const state = normalizeSave(old);
      const ownsPickup = !!record.pickupInventory || !!record.collectedPickups;
      assert.deepEqual(state.pickupInventory, ownsPickup ? [pickup.id] : []);
      assert.deepEqual(state.memes, ownsPickup ? [pickup.memeId] : []);
      assert.deepEqual(state.clues, record.clues ?? []);
      assert.deepEqual(state.queriedMemes, []);
      assert.deepEqual(state.pose, old.pose);
      assert.equal(state.updatedAt, 1234);
      assert.deepEqual(normalizeSave(state), state, 'migration is idempotent');
    }
  }
});

test('old investigation cards preserve history without silently unlocking blue mushroom', () => {
  const previous = { version: 1, pickupInventory: PICKUPS.map(p => p.id), clues: [...CLUE_ORDER], investigated: true,
    archive: { answers: { meaning: 'emotion', context: 'shared-self-mockery' }, completed: true } };
  const state = normalizeSave(previous);
  assert.deepEqual(state.queriedMemes, []);
  assert.deepEqual(state.archive, previous.archive);
  assert.equal(state.investigated, true);
  const terminalOnly = normalizeSave({ version: 1, clues: ['echo-meaning-note'] });
  assert.deepEqual(terminalOnly.pickupInventory, [], 'research evidence never grants a missing folder');
  assert.deepEqual(terminalOnly.queriedMemes, [], 'old investigation is not a new terminal search');
  assert.equal(searchMemeArchive(terminalOnly, '蓝瘦香菇').status, 'uncollected');
});

test('explicit new unlock records are authoritative, deduplicated and retained when material is missing', () => {
  const ids = ['blue-mushroom', 'friendship-boat'];
  const state = normalizeSave({ version: 1, pickupInventory: PICKUPS.map(p => p.id),
    clues: ['echo-meaning-note'], queriedMemes: [...ids, blue, 'unknown', '__proto__', null] });
  assert.deepEqual(state.queriedMemes, ids);
  assert.equal(searchMemeArchive(state, '友谊的小船').alreadyQueried, true);
  const old = MEME_ARCHIVES['friendship-boat'];
  try {
    MEME_ARCHIVES['friendship-boat'] = { ...old, available: false };
    assert.equal(searchMemeArchive(state, '友谊的小船').status, 'unavailable', 'stored knowledge cannot turn absent material into a real archive');
    assert.deepEqual(normalizeSave(state).queriedMemes, ids);
  } finally { MEME_ARCHIVES['friendship-boat'] = old; }
  const cleared = normalizeSave({ ...state, queriedMemes: [] });
  assert.deepEqual(cleared.queriedMemes, []);
  assert.deepEqual(normalizeSave(cleared), cleared);
  assert.deepEqual(normalizeSave({ ...state, queriedMemes: 'blue-mushroom' }).queriedMemes, []);
});

test('current schema never manufactures items from a research record or stale collected marker', () => {
  const state = normalizeSave({ ...createDefaultSave(), queriedMemes: [blue], clues: ['echo-meaning-note'],
    collectedPickups: [folder], memes: [blue] });
  assert.deepEqual(state.pickupInventory, []);
  assert.deepEqual(state.memes, []);
  assert.deepEqual(state.queriedMemes, [], 'orphan queries cannot pre-unlock a future pickup');
  assert.equal(searchMemeArchive(state, '蓝瘦香菇').status, 'uncollected');
  assert.equal(collectPickup(state, folder), true, 'a stale clue does not suppress the new pickup notification');
  assert.deepEqual(state.pickupInventory, [folder]);
  assert.deepEqual(state.queriedMemes, []);
});

test('save/reload preserves each state and repeated queries never add reward counts', () => {
  const storage = memoryStorage(), state = createDefaultSave();
  collectPickup(state, folder); collectPickup(state, 'field-folder-02');
  unlockMemeArchive(state, blue);
  state.pose = { x: 16.6, z: -33.7, yaw: .3, pitch: -.1 };
  assert.equal(saveGame(state, storage), true);
  const loaded = loadSave(storage);
  assert.equal(loaded.collectionVersion, 2);
  assert.deepEqual(loaded.pickupInventory, state.pickupInventory);
  assert.deepEqual(loaded.queriedMemes, [blue]);
  assert.deepEqual(loaded.pose, normalizeSave(state).pose);
  assert.equal(searchMemeArchive(loaded, '蓝瘦香菇').alreadyQueried, true);
  assert.equal(unlockMemeArchive(loaded, blue), false);
  assert.equal(loaded.pickupInventory.length, 2);
  assert.equal(searchMemeArchive(loaded, '你是gg还是mm').status, 'success');
  assert.equal(searchMemeArchive(loaded, '你是gg还是mm').alreadyQueried, false);
  assert.equal(unlockMemeArchive(loaded, 'gg-or-mm'), true);
  assert.equal(saveGame(loaded, storage), true);
  assert.deepEqual(loadSave(storage).queriedMemes, [blue, 'gg-or-mm']);
  assert.equal(loadSave(storage).pickupInventory.length, 2);
  storage.setItem('unrelated', 'preserve');
  assert.equal(resetSave(storage), true);
  assert.equal(storage.getItem('unrelated'), 'preserve');
  assert.deepEqual(loadSave(storage), createDefaultSave());
});


test('English display names and explicit English aliases resolve the same five stable identities', () => {
  const expected = {
    'blue-mushroom': 'Blue and Mushroom', 'friendship-boat': 'Friendship Boat',
    'gg-or-mm': 'Are You GG or MM?', 'awesome-my-bro': 'Awesome, My Bro!', 'devil-or-showoff': 'Devil or Show-off?',
  };
  for (const [id, name] of Object.entries(expected)) {
    assert.equal(MEME_ARCHIVES[id].name, name);
    assert.equal(matchMemeName('  ' + name.toUpperCase() + '  ')?.id, id);
    for (const alias of MEME_ARCHIVES[id].aliases) assert.equal(matchMemeName(alias)?.id, id, alias);
  }
  assert.equal(matchMemeName('ＡＲＥ ＹＯＵ ＧＧ ＯＲ ＭＭ？')?.id, 'gg-or-mm');
  for (const partial of ['Blue', 'Friendship', 'GG MM', 'Awesome', 'Devil']) assert.equal(matchMemeName(partial), undefined);
});
