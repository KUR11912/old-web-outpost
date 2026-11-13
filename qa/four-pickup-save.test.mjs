import test from 'node:test';
import assert from 'node:assert/strict';
import { CLUES, CLUE_ORDER, hasAllClues } from '../src/archive-data.ts';
import { MEMES, PICKUPS, getPickupContent, collectedPickupEntries } from '../src/pickup-data.ts';
import { SAVE_KEY, CLUE_ID, createDefaultSave, collectPickup, normalizeSave, loadSave, saveGame, resetSave } from '../src/save.ts';

const folderIds = ['field-folder-01', 'field-folder-02', 'field-folder-03', 'field-folder-04'];
const memeIds = ['friendship-boat', 'gg-or-mm', 'awesome-my-bro', 'devil-or-showoff'];
const collectionIds = memeIds.map(id => `collection-${id}`);
const names = ['友谊的小船', '你是GG还是MM', '厉害了我的哥', '你是魔鬼还是秀儿'];
const positions = [{ x: 20.4, z: -46 }, { x: 24.5, z: -20 }, { x: 26.6, z: 9 }, { x: 60, z: 3 }];
const originalPickupId = 'outpost-blue-mushroom-folder';
const correctAnswers = { meaning: 'emotion', context: 'shared-self-mockery' };

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('four existing folders retain their stable bindings and resolve the installed archive data', () => {
  assert.equal(PICKUPS.length, 5, 'Only the original five world folders exist');
  assert.equal(new Set(PICKUPS.map(pickup => pickup.id)).size, PICKUPS.length);
  assert.equal(new Set(PICKUPS.map(pickup => pickup.memeId)).size, PICKUPS.length);
  assert.deepEqual(CLUE_ORDER, ['missing-caption-image', 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants']);
  for (const [index, id] of folderIds.entries()) {
    const pickup = PICKUPS.find(candidate => candidate.id === id);
    assert.ok(pickup, id);
    assert.equal(pickup.memeId, memeIds[index]);
    assert.equal(pickup.model, 'MemeFolder_01');
    assert.deepEqual(pickup.position, positions[index]);
    assert.equal(pickup.marker, index + 1);
    const meme = MEMES[memeIds[index]], card = CLUES[collectionIds[index]];
    assert.deepEqual(getPickupContent(pickup), {
      name: names[index],
      description: card.summary,
      icon: card.image,
      clueId: collectionIds[index],
      placeholder: false,
    });
    assert.equal(meme.clueId, collectionIds[index]);
    assert.equal(meme.clue, card);
    assert.equal(CLUE_ORDER.includes(card.id), false);
    assert.match(card.image, /^assets\/memes\//);
    assert.equal(card.year, undefined);
    assert.ok(card.sources.length > 0);
    assert.ok(card.period.length > 0);
  }
});

test('each named folder awards its own item and name once, without research, and survives refresh', () => {
  const store = storage();
  let state = createDefaultSave();
  for (const [index, id] of folderIds.entries()) {
    assert.equal(collectPickup(state, id), true);
    for (let repeat = 0; repeat < 3; repeat++) assert.equal(collectPickup(state, id), false);
    assert.deepEqual(state.pickupInventory, folderIds.slice(0, index + 1));
    assert.deepEqual(state.collectedPickups, state.pickupInventory);
    assert.deepEqual(state.clues, []);
    assert.deepEqual(state.queriedMemes, []);
    assert.deepEqual(state.memes, memeIds.slice(0, index + 1));
    assert.deepEqual(CLUE_ORDER.filter(id => state.clues.includes(id)), []);
    assert.equal(state.investigated, false);
    assert.deepEqual(state.archive, createDefaultSave().archive);
    assert.equal(saveGame(state, store), true);
    const serialized = JSON.parse(store.getItem(SAVE_KEY));
    assert.equal(serialized.version, 1);
    assert.deepEqual(serialized.pickupInventory, folderIds.slice(0, index + 1));
    state = loadSave(store);
    assert.deepEqual(state.pickupInventory, serialized.pickupInventory);
    assert.deepEqual(state.collectedPickups, state.pickupInventory);
    assert.deepEqual(state.clues, []);
    assert.deepEqual(state.memes, memeIds.slice(0, index + 1));
    assert.equal(collectPickup(state, id), false);
  }
  assert.equal(state.collectedPickups.includes(originalPickupId), false);
  assert.equal(collectPickup(state, originalPickupId), true);
  assert.deepEqual(state.clues, []);
  assert.deepEqual(state.memes, [...memeIds, 'blue-mushroom']);
  assert.deepEqual(CLUE_ORDER.filter(id => state.clues.includes(id)), []);
  assert.deepEqual(collectedPickupEntries(state.pickupInventory).map(pickup => pickup.id), [originalPickupId, ...folderIds]);
  assert.equal(state.pickupInventory.length, 5);
});

test('one named collection never hides another folder; legacy markers preserve old collections only', () => {
  const state = createDefaultSave();
  assert.equal(collectPickup(state, folderIds[1]), true);
  const restored = normalizeSave({ ...state, collectedPickups: [...folderIds, originalPickupId] });
  assert.deepEqual(restored.pickupInventory, [folderIds[1]]);
  assert.deepEqual(restored.collectedPickups, [folderIds[1]]);
  assert.deepEqual(restored.memes, [memeIds[1]]);
  assert.deepEqual(restored.clues, []);
  const flagsOnly = normalizeSave({ version: 1, collectedPickups: [...folderIds, originalPickupId] });
  assert.deepEqual(flagsOnly.pickupInventory, [originalPickupId, ...folderIds]);
  assert.deepEqual(flagsOnly.collectedPickups, flagsOnly.pickupInventory);
  assert.deepEqual(flagsOnly.queriedMemes, []);
  assert.deepEqual(flagsOnly.memes, ['blue-mushroom', ...memeIds]);
});

test('legacy cards and meme names preserve history without inventing pickup ownership', () => {
  const pose = { x: 57, z: -35, yaw: .4, pitch: -.1 };
  const variants = [
    { clues: [CLUE_ID] },
    { clues: [], memes: ['blue-mushroom'], collectedPickups: [] },
  ];
  for (const legacyInventory of variants) {
    const previous = { version: 1, investigated: true, ...legacyInventory, pose, updatedAt: 1234,
      archive: { answers: { meaning: 'food', context: 'serious-help' }, completed: false } };
    const migrated = normalizeSave(previous);
    assert.deepEqual(migrated.pickupInventory, []);
    assert.deepEqual(migrated.collectedPickups, []);
    assert.deepEqual(migrated.clues, previous.clues);
    assert.deepEqual(migrated.memes, []);
    assert.deepEqual(migrated.pose, pose);
    assert.deepEqual(migrated.archive, previous.archive);
    assert.equal(migrated.updatedAt, 1234);
    assert.equal(migrated.investigated, true);
    assert.equal(collectPickup(migrated, originalPickupId), true);
    for (const id of folderIds) assert.equal(collectPickup(migrated, id), true);
  }
  const completed = normalizeSave({ version: 1, clues: [...CLUE_ORDER], memes: ['blue-mushroom'],
    archive: { answers: correctAnswers, completed: true } });
  assert.deepEqual(completed.clues, CLUE_ORDER, 'Retain existing historical cards and completion');
  assert.equal(completed.archive.completed, true);
  assert.deepEqual(completed.pickupInventory, []);
});

test('four named collections do not count toward the archive clues or alter answers/completion', () => {
  const state = createDefaultSave();
  state.archive.answers = { ...correctAnswers };
  for (const id of folderIds) collectPickup(state, id);
  assert.equal(state.clues.length, 0);
  assert.equal(CLUE_ORDER.filter(id => state.clues.includes(id)).length, 0);
  assert.equal(hasAllClues(state.clues), false);
  assert.equal(normalizeSave({ ...state, archive: { answers: correctAnswers, completed: true } }).archive.completed, false);
  assert.deepEqual(state.archive, { answers: correctAnswers, completed: false });
  const completed = normalizeSave({ version: 1, clues: [...CLUE_ORDER], investigated: true,
    archive: { answers: correctAnswers, completed: true }, pose: { x: 57, z: -35, yaw: .4, pitch: -.1 } });
  const previousArchive = structuredClone(completed.archive);
  for (const id of folderIds) collectPickup(completed, id);
  const restored = normalizeSave(completed);
  assert.deepEqual(restored.clues, [...CLUE_ORDER]);
  assert.deepEqual(CLUE_ORDER.filter(id => restored.clues.includes(id)), CLUE_ORDER);
  assert.deepEqual(restored.archive, previousArchive);
  assert.deepEqual(restored.pose, completed.pose);
});

test('old collected placeholder saves acquire current names without respawning or changing quest progress', () => {
  const pose = { x: 57, z: -35, yaw: .4, pitch: -.1 };
  for (const owned of [folderIds.slice(0, 1), [folderIds[1]], [folderIds[2]], [folderIds[3]], folderIds]) {
    const store = storage();
    const previous = { version: 1, pickupInventory: owned, collectedPickups: owned, clues: [], memes: [],
      investigated: false, pose, updatedAt: 1234, archive: { answers: { meaning: 'food', context: null }, completed: false } };
    store.setItem(SAVE_KEY, JSON.stringify(previous));
    const oldBytes = store.getItem(SAVE_KEY), restored = loadSave(store);
    assert.deepEqual(restored.pickupInventory, owned);
    assert.deepEqual(restored.collectedPickups, owned);
    assert.deepEqual(restored.memes, owned.map(id => memeIds[folderIds.indexOf(id)]));
    assert.deepEqual(restored.clues, [], 'Existing pickup ownership does not synthesize historical cards');
    assert.deepEqual(restored.archive, previous.archive);
    assert.deepEqual(restored.pose, pose);
    assert.equal(restored.updatedAt, 1234);
    assert.equal(restored.investigated, false);
    assert.equal(hasAllClues(restored.clues), false);
    assert.equal(restored.pickupInventory.includes(originalPickupId), false);
    assert.equal(store.getItem(SAVE_KEY), oldBytes, 'Read migration must not overwrite the saved data');
    for (const id of owned) assert.equal(collectPickup(restored, id), false);
    assert.deepEqual(collectedPickupEntries(restored.pickupInventory).map(p => getPickupContent(p).name), owned.map(id => names[folderIds.indexOf(id)]));
    saveGame(restored, store);
    const reloaded = loadSave(store);
    assert.deepEqual(reloaded.pickupInventory, owned);
    assert.deepEqual(reloaded.memes, restored.memes);
    assert.deepEqual(reloaded.clues, restored.clues);
    assert.deepEqual(reloaded.archive, previous.archive);
  }
});

test('stable item ownership resolves current configuration after a placeholder is bound to a real meme', () => {
  const store = storage();
  const state = createDefaultSave();
  const pickup = PICKUPS.find(candidate => candidate.id === folderIds[0]);
  const memeId = 'future-folder-meme';
  const clueId = 'future-folder-clue';
  const originalMemeId = pickup.memeId;
  const futureClue = { id: clueId, name: '后续真实老梗', location: '原占位文件夹', summary: '更新后的老梗简介',
    content: ['实际内容'], sourceLabel: '测试配置', sourceNote: '用于验证存档绑定', image: 'assets/future-meme.png' };
  try {
    pickup.memeId = null;
    assert.equal(collectPickup(state, pickup.id), true);
    assert.equal(saveGame(state, store), true);
    const savedPlaceholder = store.getItem(SAVE_KEY);
    CLUES[clueId] = futureClue;
    MEMES[memeId] = { id: memeId, name: futureClue.name, clueId, clue: futureClue };
    pickup.memeId = memeId;
    const restored = loadSave(store);
    assert.deepEqual(restored.pickupInventory, [pickup.id]);
    assert.deepEqual(restored.collectedPickups, [pickup.id]);
    assert.deepEqual(restored.memes, [memeId]);
    assert.deepEqual(restored.clues, []);
    assert.deepEqual(restored.queriedMemes, []);
    assert.deepEqual(restored.archive, createDefaultSave().archive);
    assert.equal(hasAllClues(restored.clues), false);
    assert.equal(collectPickup(restored, pickup.id), false, 'Content rebinding does not respawn or reaward the stable item');
    assert.equal(getPickupContent(pickup).name, futureClue.name);
    assert.equal(getPickupContent(pickup).icon, futureClue.image);
    assert.equal(getPickupContent(pickup).clueId, clueId);
    assert.equal(getPickupContent(pickup).placeholder, false);
    assert.equal(store.getItem(SAVE_KEY), savedPlaceholder, 'Loading never overwrites the original save');
    assert.equal(saveGame(restored, store), true);
    const reloaded = loadSave(store);
    assert.deepEqual(reloaded.pickupInventory, [pickup.id]);
    assert.deepEqual(reloaded.collectedPickups, [pickup.id]);
    assert.deepEqual(reloaded.clues, [], 'New material requires a terminal query, even for an existing stable item');
    assert.deepEqual(reloaded.memes, [memeId]);
    futureClue.name = '再次更新的展示名称';
    MEMES[memeId].name = futureClue.name;
    assert.equal(getPickupContent(pickup).name, futureClue.name, 'Presentation is looked up from current data, not copied into a save');
  } finally {
    pickup.memeId = originalMemeId;
    delete MEMES[memeId];
    delete CLUES[clueId];
  }
});

test('normalization drops unknown or duplicate item ids and tolerates malformed inventory', () => {
  const state = normalizeSave({ ...createDefaultSave(),
    pickupInventory: [folderIds[2], 'unknown-pickup', '__proto__', folderIds[2], null, 123, { id: folderIds[0] }],
    collectedPickups: folderIds, clues: ['unknown-clue'], memes: ['unknown-meme'] });
  assert.deepEqual(state.pickupInventory, [folderIds[2]]);
  assert.deepEqual(state.collectedPickups, [folderIds[2]]);
  assert.deepEqual(state.clues, []);
  assert.deepEqual(state.memes, [memeIds[2]]);
  for (const rawInventory of [null, {}, folderIds[0], 1]) {
    assert.deepEqual(normalizeSave({ version: 1, pickupInventory: rawInventory }).pickupInventory, []);
  }
  assert.equal(collectPickup(state, '__proto__'), false);
  assert.equal(collectPickup(state, 'unknown-pickup'), false);
});

test('a failed inventory insertion never hides a folder or grants its real card', () => {
  for (const id of [...folderIds, originalPickupId]) {
    const state = createDefaultSave();
    state.pickupInventory.push = () => 0;
    assert.equal(collectPickup(state, id), false);
    assert.equal(state.pickupInventory.length, 0);
    assert.deepEqual(state.collectedPickups, []);
    assert.deepEqual(state.clues, []);
    assert.deepEqual(state.memes, []);
  }
});

test('reset clears every named collection and keeps unrelated saves', () => {
  const store = storage();
  const state = createDefaultSave();
  for (const id of folderIds) collectPickup(state, id);
  saveGame(state, store);
  store.setItem('another-game', 'keep');
  assert.equal(resetSave(store), true);
  assert.equal(store.getItem('another-game'), 'keep');
  assert.deepEqual(loadSave(store), createDefaultSave());
  const reset = loadSave(store);
  for (const id of folderIds) assert.equal(collectPickup(reset, id), true);
});
