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
  { key: 'friendship_boat', memeId: 'friendship-boat', pickupId: 'field-folder-01',
    location: '回声档案馆北侧草地', position: { x: 20.4, z: -46 } },
  { key: 'gg_mm', memeId: 'gg-or-mm', pickupId: 'field-folder-02',
    location: '回声档案馆东南侧 · 河流西岸林隙', position: { x: 24.5, z: -20 } },
  { key: 'lihai_wode_ge', memeId: 'awesome-my-bro', pickupId: 'field-folder-03',
    location: '地图南部 · 河流西侧草地', position: { x: 26.6, z: 9 } },
  { key: 'mogui_xiuer', memeId: 'devil-or-showoff', pickupId: 'field-folder-04',
    location: '桥梁东南侧 · 河流东岸林隙', position: { x: 60, z: 3 } },
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
    assert.equal(clue.name, entry.displayName);
    assert.equal(clue.summary, entry.summary);
    assert.equal(clue.period, entry.period);
    assert.deepEqual(clue.content, entry.paragraphs);
    assert.deepEqual(clue.example, entry.example);
    assert.equal(clue.contextNote, entry.contextNote);
    assert.equal(clue.sourceNote, entry.provenanceNote);
    assert.equal(clue.image, localPath(entry.image));
    assert.deepEqual(clue.sources, entry.sources.map(source => ({
      title: source.title, url: source.url, note: `${source.publisher} · ${source.date}`,
    })));
    assert.equal(archive.available, true);
    assert.deepEqual(archive.clueIds, [clueId]);
    assert.equal(archive.summary, entry.summary);
    assert.equal(archive.image, clue.image);
    assert.deepEqual(archive.aliases, entry.aliases);
    for (const name of [entry.displayName, ...entry.aliases]) {
      assert.equal(matchMemeName(name)?.id, record.memeId, name);
    }

    const images = entry.gallery ?? [{ path: entry.image }];
    assert.equal(clue.gallery.length, images.length);
    assert.equal(clue.gallery[0].caption, entry.imageCaption);
    assert.ok(clue.gallery[0].role.includes(entry.imageRole));
    images.forEach((image, index) => {
      const actual = clue.gallery[index];
      const attribution = pack.imageSources.find(item => item.path === image.path);
      assert.equal(actual.src, localPath(image.path));
      if (index > 0) assert.equal(actual.caption, image.caption);
      if (image.role) assert.ok(actual.role.includes(image.role));
      for (const field of ['creator', 'sourcePage', 'originalUrl', 'note']) {
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

test('blue mushroom archive and all four existing blue clue cards remain unchanged', () => {
  const ids = ['missing-caption-image', 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'];
  const content = { archive: MEME_ARCHIVES['blue-mushroom'], clues: ids.map(id => CLUES[id]) };
  assert.equal(digest(JSON.stringify(content)), 'fcade80d3ac24f3f86b4ed8432b057a301e72ead71b843a0ce8b87367095e40d');
});
