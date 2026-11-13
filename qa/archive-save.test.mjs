import test from 'node:test';
import assert from 'node:assert/strict';
import { CLUE_ORDER, CLUES, ARCHIVE_QUESTIONS, evaluateArchive, hasAllClues } from '../src/archive-data.ts';
import { SAVE_KEY, CLUE_ID, createDefaultSave, normalizeSave, loadSave, saveGame } from '../src/save.ts';

function storage() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

test('a pre-archive v1 save retains its original card, investigation and east-bank pose', () => {
  const store = storage();
  const previous = { version: 1, investigated: true, clues: [CLUE_ID], pose: { x: 57, z: -35, yaw: .4, pitch: -.1 }, updatedAt: 1234 };
  store.setItem(SAVE_KEY, JSON.stringify(previous));
  const migrated = loadSave(store);
  assert.deepEqual(migrated.pose, previous.pose);
  assert.deepEqual(migrated.clues, [CLUE_ID]);
  assert.deepEqual(migrated.memes, []);
  assert.deepEqual(migrated.collectedPickups, []);
  assert.deepEqual(migrated.queriedMemes, []);
  assert.equal(migrated.investigated, true);
  assert.equal(migrated.updatedAt, 1234);
  assert.deepEqual(migrated.archive, { answers: { meaning: null, context: null }, completed: false });
  assert.equal(CLUES[CLUE_ID].name, '蓝瘦香菇图片');
  assert.equal(CLUES[CLUE_ID].image, 'assets/blue-mushroom-meme.png');
  assert.equal(store.getItem(SAVE_KEY), JSON.stringify(previous), 'Loading migration does not destructively rewrite stored data');
});

test('normalization allows only the four cards and legal per-question answers', () => {
  const state = normalizeSave({ ...createDefaultSave(), clues: [CLUE_ID, 'echo-chat-context', 'echo-chat-context', 'combat-sword', '__proto__'], archive: { answers: { meaning: 'shared-self-mockery', context: 'serious-help', unknown: 'x' }, completed: 'true' } });
  assert.deepEqual(state.clues, [CLUE_ID, 'echo-chat-context']);
  assert.deepEqual(state.archive.answers, { meaning: null, context: 'serious-help' });
  assert.equal(state.archive.completed, false);
  assert.equal(state.investigated, false, 'New world pickups do not imply that the mailbox letter was read');
});

test('wrong attempts survive refresh and can be replaced by a successful retry', () => {
  const store = storage();
  const state = createDefaultSave(); state.clues = [...CLUE_ORDER];
  state.archive.answers = { meaning: 'food', context: 'serious-help' };
  assert.equal(saveGame(state, store), true);
  const wrong = loadSave(store);
  assert.deepEqual(wrong.archive.answers, state.archive.answers);
  assert.equal(evaluateArchive(wrong.archive.answers).allCorrect, false);
  wrong.archive.answers.meaning = 'emotion';
  saveGame(wrong, store);
  const partial = loadSave(store);
  assert.deepEqual(evaluateArchive(partial.archive.answers), { meaning: true, context: false, allCorrect: false });
  partial.archive.answers.context = 'shared-self-mockery';
  saveGame(partial, store);
  const correct = loadSave(store);
  assert.equal(evaluateArchive(correct.archive.answers).allCorrect, true);
  assert.equal(correct.archive.completed, false, 'Correct answers do not substitute for explicit submission');
  correct.archive.completed = true;
  saveGame(correct, store);
  assert.equal(loadSave(store).archive.completed, true);
});

test('completion requires explicit submission plus all four cards and both correct answers', () => {
  const complete = { ...createDefaultSave(), clues: [...CLUE_ORDER], archive: { answers: { meaning: 'emotion', context: 'shared-self-mockery' }, completed: true } };
  assert.equal(normalizeSave(complete).archive.completed, true);
  assert.equal(normalizeSave({ ...complete, clues: CLUE_ORDER.slice(0, 3) }).archive.completed, false);
  assert.equal(normalizeSave({ ...complete, archive: { answers: { meaning: 'food', context: 'shared-self-mockery' }, completed: true } }).archive.completed, false);
  assert.equal(normalizeSave({ ...complete, archive: { answers: complete.archive.answers, completed: false } }).archive.completed, false);
  assert.equal(normalizeSave({ ...complete, archive: { answers: complete.archive.answers } }).archive.completed, false);
  assert.equal(normalizeSave({ ...complete, archive: null }).archive.completed, false);
});

test('reading without collecting still does not award the first card after archive migration', () => {
  const state = normalizeSave({ version: 1, investigated: true, clues: [], pose: { x: 0, z: 9, yaw: 0, pitch: 0 } });
  assert.equal(state.investigated, true);
  assert.deepEqual(state.clues, []);
  assert.equal(hasAllClues(state.clues), false);
  assert.deepEqual(state.archive.answers, { meaning: null, context: null });
});

test('data contains two three-option judgments, concrete card references and source distinctions', () => {
  assert.equal(CLUE_ORDER.length, 4);
  assert.equal(new Set(CLUE_ORDER).size, 4);
  assert.equal(ARCHIVE_QUESTIONS.length, 2);
  for (const question of ARCHIVE_QUESTIONS) {
    assert.equal(question.options.length, 3);
    assert.equal(question.options.filter(option => option.correct).length, 1);
    for (const option of question.options) {
      assert.ok(option.referenceIds.length > 0);
      for (const id of option.referenceIds) {
        assert.ok(CLUES[id]);
        assert.ok(option.feedback.includes(CLUES[id].name), `${question.id}/${option.id} should name referenced material`);
      }
    }
  }
  assert.match(CLUES[CLUE_ID].sourceLabel, /用户提供图片.*来源待核验/);
  assert.match(CLUES['echo-meaning-note'].sourceLabel, /读音示意.*无原始录音/);
  assert.match(CLUES['echo-chat-context'].sourceLabel, /游戏情境示例/);
  assert.match(CLUES['echo-image-variants'].sourceLabel, /游戏改编示例/);
});
