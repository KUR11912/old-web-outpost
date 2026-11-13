import test from 'node:test';
import assert from 'node:assert/strict';
import { BackgroundMusic } from '../src/background-music.ts';

const KEY = 'old-web-outpost:music';
const tick = () => new Promise(resolve => setImmediate(resolve));

function environment(t, saved) {
  const names = ['window', 'document', 'localStorage', 'Audio', 'MediaError'];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const win = new EventTarget(), doc = new EventTarget();
  doc.hidden = false; doc.focused = true; doc.hasFocus = () => doc.focused;
  const storage = new Map(saved === undefined ? [] : [[KEY, saved]]);
  const instances = [];
  class FakeAudio extends EventTarget {
    src = ''; preload = ''; loop = false; volume = 1; muted = false;
    paused = true; ended = false; currentTime = 0; duration = 180; readyState = 4;
    error = null; plays = 0; pauses = 0; loads = 0; nextPlay;
    constructor() { super(); instances.push(this); }
    play() {
      this.plays++;
      if (this.nextPlay) { const next = this.nextPlay; this.nextPlay = undefined; return next(); }
      this.paused = false;
      return Promise.resolve();
    }
    pause() { this.paused = true; this.pauses++; }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    load() { this.error = null; this.loads++; }
  }
  Object.assign(globalThis, {
    window: win, document: doc, Audio: FakeAudio, MediaError: { MEDIA_ERR_SRC_NOT_SUPPORTED: 4 },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  });
  const tracks = [];
  t.after(() => {
    for (const track of tracks) track.dispose();
    for (const name of names) {
      const descriptor = previous.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  });
  return { win, doc, storage, instances, create() { const track = new BackgroundMusic(); tracks.push(track); return track; } };
}

test('defaults are quiet, looping, correctly encoded, and never autoplay on load or focus', async t => {
  const env = environment(t), track = env.create(), audio = env.instances[0];
  assert.equal(track.volume, .15); assert.equal(track.muted, false); assert.equal(audio.loop, true);
  assert.equal(decodeURIComponent(track.snapshot().url), '/audio/music/11月13日.mp3');
  env.win.dispatchEvent(new Event('focus'));
  env.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(audio.plays, 0); assert.equal(track.snapshot().started, false);
  track.start(); await tick();
  audio.currentTime = 21;
  track.start(); track.start(); await tick();
  assert.equal(env.instances.length, 1); assert.equal(audio.plays, 1);
  assert.equal(track.snapshot().currentTime, 21); assert.equal(track.snapshot().playing, true);
});

test('volume, explicit mute, and zero-volume recovery persist separately from game progress', t => {
  const env = environment(t), track = env.create();
  env.storage.set('old-web-outpost:save:v1', 'unchanged');
  track.setVolume(.31); track.toggleMuted();
  assert.equal(track.volume, .31); assert.equal(track.muted, true);
  const restored = env.create();
  assert.equal(restored.volume, .31); assert.equal(restored.muted, true);
  restored.setVolume(.22); assert.equal(restored.muted, false);
  restored.setVolume(0); assert.equal(restored.muted, true);
  restored.toggleMuted(); assert.equal(restored.volume, .22); assert.equal(restored.muted, false);
  assert.equal(env.storage.get('old-web-outpost:save:v1'), 'unchanged');
  assert.equal(restored.snapshot().started, false);
});

test('invalid preference values and unavailable storage cannot prevent playback controls', t => {
  const env = environment(t, JSON.stringify({ volume: 8, muted: 'yes', lastAudibleVolume: -2 }));
  const track = env.create();
  assert.equal(track.volume, .15); assert.equal(track.muted, false);
  track.setVolume(NaN); assert.equal(track.volume, .15);
  track.setVolume(9); assert.equal(track.volume, 1);
  track.setVolume(-2); assert.equal(track.volume, 0);
  globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const blocked = env.create();
  assert.equal(blocked.volume, .15);
  assert.doesNotThrow(() => { blocked.setVolume(.27); blocked.toggleMuted(); blocked.start(); });
});

test('blur, hidden state and pagehide pause without rewinding and require both visibility and focus to resume', async t => {
  const env = environment(t), track = env.create(), audio = env.instances[0];
  track.start(); await tick(); audio.currentTime = 48;
  env.doc.focused = false; env.win.dispatchEvent(new Event('blur'));
  assert.equal(audio.paused, true); assert.equal(audio.currentTime, 48);
  env.doc.hidden = true; env.doc.dispatchEvent(new Event('visibilitychange'));
  env.win.dispatchEvent(new Event('focus'));
  assert.equal(audio.paused, true, 'focus while hidden must stay silent');
  env.doc.hidden = false; env.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(audio.paused, true, 'visible but unfocused must stay silent');
  env.doc.focused = true; env.win.dispatchEvent(new Event('focus')); await tick();
  assert.equal(audio.paused, false); assert.equal(audio.currentTime, 48);
  env.win.dispatchEvent(new Event('pagehide'));
  env.win.dispatchEvent(new Event('focus'));
  assert.equal(audio.paused, true, 'pagehide cannot be undone by a stray focus event');
  env.win.dispatchEvent(new Event('pageshow')); await tick();
  assert.equal(audio.paused, false); assert.equal(audio.currentTime, 48);
});

test('late play completions cannot leak music after blur or invalidate a newer play attempt', async t => {
  const env = environment(t), track = env.create(), audio = env.instances[0];
  let finishFirst;
  audio.nextPlay = () => new Promise(resolve => { finishFirst = () => { audio.paused = false; resolve(); }; });
  track.start(); track.start();
  assert.equal(audio.plays, 1, 'pending playback is not duplicated');
  env.win.dispatchEvent(new Event('blur'));
  finishFirst(); await tick();
  assert.equal(audio.paused, true); assert.equal(track.snapshot().pending, false);
  let rejectOld;
  audio.nextPlay = () => new Promise((_, reject) => { rejectOld = reject; });
  track.start(); env.win.dispatchEvent(new Event('blur'));
  env.win.dispatchEvent(new Event('focus')); await tick();
  rejectOld(new DOMException('interrupted', 'AbortError')); await tick();
  assert.equal(audio.paused, false); assert.equal(track.snapshot().error, null);
});

test('playback rejections and media errors are recoverable and never escape into game code', async t => {
  const env = environment(t), track = env.create(), audio = env.instances[0];
  audio.nextPlay = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
  assert.doesNotThrow(() => track.start()); await tick();
  assert.match(track.snapshot().error, /Click Music/);
  track.start(); await tick();
  assert.equal(track.snapshot().error, null);
  audio.pause(); audio.error = { code: 4 }; audio.dispatchEvent(new Event('error'));
  assert.match(track.snapshot().error, /format/i);
  track.start(); await tick();
  assert.equal(audio.loads, 1); assert.equal(track.snapshot().error, null);
});

test('disposing releases the media and ignores late completion or lifecycle events', async t => {
  const env = environment(t), track = env.create(), audio = env.instances[0];
  let finish;
  audio.nextPlay = () => new Promise(resolve => { finish = () => { audio.paused = false; resolve(); }; });
  track.start(); track.dispose(); finish(); await tick();
  assert.equal(audio.paused, true); assert.equal(audio.src, '');
  env.win.dispatchEvent(new Event('focus')); env.doc.dispatchEvent(new Event('visibilitychange'));
  track.start(); assert.equal(audio.plays, 1);
});
