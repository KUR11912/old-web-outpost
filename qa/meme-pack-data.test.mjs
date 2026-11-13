import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CLUES } from '../src/archive-data.ts';
import { MEMES, PICKUPS } from '../src/pickup-data.ts';
import { MEME_ARCHIVES, matchMemeName, searchMemeArchive, unlockMemeArchive } from '../src/meme-archives.ts';
import { createDefaultSave, collectPickup, normalizeSave } from '../src/save.ts';

const sourceRoot = new URL('../meme_asset/source/old-web-meme-pack/', import.meta.url);
const pack = JSON.parse(readFileSync(new URL('memes.json', sourceRoot), 'utf8'));
const records = [
  { key: 'friendship_boat', memeId: 'friendship-boat', name: 'Friendship Boat', pickupId: 'field-folder-01',
    location: 'Grassland north of the Echo Archive', position: { x: 20.4, z: -46 } },
  { key: 'gg_mm', memeId: 'gg-or-mm', name: 'Are You GG or MM?', pickupId: 'field-folder-02',
    location: 'Woodland clearing southeast of the Echo Archive · west riverbank', position: { x: 24.5, z: -20 } },
  { key: 'lihai_wode_ge', memeId: 'awesome-my-bro', name: 'Awesome, My Bro!', pickupId: 'field-folder-03',
    location: 'Southern grassland · west of the river', position: { x: 26.6, z: 9 } },
  { key: 'mogui_xiuer', memeId: 'devil-or-showoff', name: 'Devil or Show-off?', pickupId: 'field-folder-04',
    location: 'Woodland clearing southeast of the bridge · east riverbank', position: { x: 60, z: 3 } },
];
const localPath = path => `assets/memes/${path.split('/').at(-1)}`;
const digest = data => createHash('sha256').update(data).digest('hex');

for (const record of records) {
  test(`${record.memeId}: supplied content and provenance adapt into its existing archive`, () => {
    const entry = pack.entries.find(item => item.key === record.key);
    const clueId = `collection-${record.memeId}`;
    const clue = CLUES[clueId], archive = MEME_ARCHIVES[record.memeId];
    const pickup = PICKUPS.find(item => item.id === record.pickupId);
    assert.equal(MEMES[record.memeId].clueId, clueId);
    assert.equal(pickup.memeId, record.memeId);
    assert.equal(pickup.location, record.location);
    assert.deepEqual(pickup.position, record.position);
    assert.equal(clue.location, record.location);
    assert.equal(clue.id, clueId);
    assert.equal(clue.name, record.name);
    assert.equal(archive.name, record.name);
    assert.equal(clue.content.length, entry.paragraphs.length);
    for (const text of [clue.summary, clue.period, ...clue.content, clue.example.label, clue.example.text, clue.contextNote, clue.sourceNote]) {
      assert.ok(text.trim().length > 12, 'English archive section has substantive content');
      assert.doesNotMatch(text, /\p{Script=Han}/u, 'Player-facing archive text is English');
    }
    // Translation changes prose, but dates and supporting sources retain the original scope.
    assert.deepEqual([...clue.period.matchAll(/(?:19|20)\d{2}/g)].map(m => m[0]), [...entry.period.matchAll(/(?:19|20)\d{2}/g)].map(m => m[0]));
    assert.equal(clue.image, localPath(entry.image));
    assert.equal(clue.sources.length, entry.sources.length);
    for (const [index, source] of clue.sources.entries()) {
      assert.equal(source.url, entry.sources[index].url);
      assert.ok(source.note.includes(entry.sources[index].date));
      assert.ok(source.title.length > 10);
      assert.doesNotMatch(source.title + source.note, /\p{Script=Han}/u);
    }
    assert.equal(archive.available, true);
    assert.deepEqual(archive.clueIds, [clueId]);
    assert.equal(archive.summary, clue.summary);
    assert.equal(archive.image, clue.image);
    for (const alias of [entry.displayName, ...entry.aliases]) assert.ok(archive.aliases.includes(alias), 'Original name remains searchable: ' + alias);
    assert.equal(matchMemeName(record.name.toUpperCase())?.id, record.memeId);
    for (const name of [entry.displayName, ...entry.aliases]) {
      assert.equal(matchMemeName(name)?.id, record.memeId, name);
    }

    const images = entry.gallery ?? [{ path: entry.image }];
    assert.equal(clue.gallery.length, images.length);
    assert.ok(clue.gallery[0].caption.length > 20);
    assert.ok(clue.gallery[0].role.length > 5);
    images.forEach((image, index) => {
      const actual = clue.gallery[index];
      const attribution = pack.imageSources.find(item => item.path === image.path);
      assert.equal(actual.src, localPath(image.path));
      for (const field of ['caption', 'role', 'creator', 'note']) {
        assert.ok(actual[field].trim().length > 0);
        assert.doesNotMatch(actual[field], /\p{Script=Han}/u);
      }
      for (const field of ['sourcePage', 'originalUrl']) {
        assert.equal(actual[field], attribution[field], `${image.path} ${field}`);
      }
    });
  });
}

test('the five local images are byte-identical originals, including signatures and watermarks', () => {
  const sha256 = {
    'friendship-boat.jpg': '189d93817fd720f2c45c8dabc6776849d450c7d02d77185ad6c0efdd32765c30',
    'gg-mm-qq-context.jpg': '5939de6bc4ebbb3b2e62f594f58c4a4a271c91f16913683b146c29761e055cc9',
    'lihai-le-wode-ge.jpg': '138180422f4a6c8fe7cc76b69c77f9ea416cb44a66629f103609859da9122692',
    'mogui-related.jpg': 'bf99e54ecdc9e979dafab510111c1eae961d440cccb74ead7b4e1cb88948c2f9',
    'xiuer-related.png': '46959e329698433ad4840b1ed845226bc2c72c22d87f3431dd08b7b968ff27da',
  };
  for (const [filename, expected] of Object.entries(sha256)) {
    assert.equal(digest(readFileSync(new URL(`images/${filename}`, sourceRoot))), expected);
    assert.equal(digest(readFileSync(new URL(`../public/assets/memes/${filename}`, import.meta.url))), expected);
  }
});

test('content installation never grants a folder or research; legacy ownership remains searchable', () => {
  for (const record of records) {
    const name = MEME_ARCHIVES[record.memeId].name;
    const empty = createDefaultSave(), before = structuredClone(empty);
    assert.equal(searchMemeArchive(empty, name).status, 'uncollected');
    assert.equal(unlockMemeArchive(empty, record.memeId), false);
    assert.deepEqual(empty, before);
    const migrated = normalizeSave({ version: 1, pickupInventory: [record.pickupId] });
    assert.deepEqual(migrated.queriedMemes, []);
    const result = searchMemeArchive(migrated, name);
    assert.equal(result.status, 'success');
    assert.equal(result.alreadyQueried, false);
    assert.equal(unlockMemeArchive(migrated, record.memeId), true);
    assert.deepEqual(normalizeSave(migrated).queriedMemes, [record.memeId]);
    assert.deepEqual(migrated.pickupInventory, [record.pickupId]);
    assert.equal(collectPickup(migrated, record.pickupId), false);
  }
});

test('blue mushroom retains its four original materials, image and uncertainty after translation', () => {
  const ids = ['missing-caption-image', 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'];
  const archive = MEME_ARCHIVES['blue-mushroom'];
  assert.equal(archive.name, 'Blue and Mushroom');
  assert.deepEqual(archive.clueIds, ids);
  assert.equal(archive.image, 'assets/blue-mushroom-meme.png');
  assert.equal(digest(readFileSync(new URL('../public/assets/blue-mushroom-meme.png', import.meta.url))), 'ffd6990d1b3b76a7bfcd45633fa94a449b704e6180a5aea9bbd98793c1ac795e');
  assert.match(CLUES[ids[0]].sourceNote, /not been verified/);
  assert.match(CLUES[ids[1]].sourceNote, /not original first publications/);
  assert.match(CLUES[ids[2]].sourceNote, /written for this game/);
  assert.match(CLUES[ids[3]].sourceNote, /not presented as existing historical adaptations/);
  for (const id of ids) assert.doesNotMatch(JSON.stringify(CLUES[id]), /\p{Script=Han}/u);
});

test('translated archives preserve qualifications about origins and contextual images', () => {
  assert.match(CLUES['collection-friendship-boat'].sourceNote, /should not automatically be credited/);
  assert.match(CLUES['collection-gg-or-mm'].sourceNote, /No single creator or exact first publication date has been confirmed/);
  assert.match(CLUES['collection-gg-or-mm'].gallery[0].note, /no exact year/);
  assert.match(CLUES['collection-awesome-my-bro'].sourceNote, /not sufficiently verified as the sole source/);
  assert.match(CLUES['collection-devil-or-showoff'].sourceNote, /first uploader has not been verified/);
  assert.equal(CLUES['collection-devil-or-showoff'].gallery.length, 2);
  assert.match(CLUES['collection-devil-or-showoff'].sourceNote, /does not establish/);
});
