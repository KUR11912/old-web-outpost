import test from 'node:test';
import assert from 'node:assert/strict';
import { PickupChime, createPickupChimeSamples } from '../src/pickup-chime.ts';

const rms = samples => Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
function tonePower(samples, sampleRate, frequency, from, to) {
  let real = 0, imaginary = 0;
  const begin = Math.round(from * sampleRate), end = Math.round(to * sampleRate);
  for (let i = begin; i < end; i++) {
    const angle = 2 * Math.PI * frequency * i / sampleRate;
    real += samples[i] * Math.cos(angle); imaginary += samples[i] * Math.sin(angle);
  }
  return Math.hypot(real, imaginary) / (end - begin);
}

test('chime is short, deterministic, unclipped PCM with silent edges at common audio rates', () => {
  for (const sampleRate of [22050, 44100, 48000, 96000]) {
    const samples = createPickupChimeSamples(sampleRate);
    assert.deepEqual(samples, createPickupChimeSamples(sampleRate));
    assert.ok(Math.abs(samples.length / sampleRate - 0.32) <= 1 / sampleRate);
    assert.equal(samples[0], 0);
    assert.equal(samples.at(-1), 0);
    let peak = 0;
    for (const value of samples) { assert.ok(Number.isFinite(value)); peak = Math.max(peak, Math.abs(value)); }
    assert.ok(peak > 0.59 && peak < 0.601);
    assert.ok(rms(samples) > 0.1 && rms(samples) < 0.25);
    assert.ok(rms(samples.slice(-Math.round(sampleRate * 0.012))) < 0.025);
  }
});

test('the two-note reward rises in pitch and its upper harmonics stay soft', () => {
  const rate = 48000, samples = createPickupChimeSamples(rate);
  const lowerEarly = tonePower(samples, rate, 1046.5023, 0.008, 0.06);
  const upperEarly = tonePower(samples, rate, 1567.9817, 0.008, 0.06);
  const lowerLate = tonePower(samples, rate, 1046.5023, 0.095, 0.18);
  const upperLate = tonePower(samples, rate, 1567.9817, 0.095, 0.18);
  assert.ok(lowerEarly > upperEarly * 8);
  assert.ok(upperLate > lowerLate * 8);
  const highHarmonic = tonePower(samples, rate, 1567.9817 * 3, 0.095, 0.18);
  assert.ok(highHarmonic < upperLate * 0.2);
});

function audioFixture() {
  const sources = [], gains = [];
  const context = {
    state: 'running', sampleRate: 44100, currentTime: 2,
    createBuffer(_channels, length, sampleRate) {
      return { duration: length / sampleRate, copyToChannel(samples) { assert.equal(samples.length, length); } };
    },
    createBufferSource() {
      const source = { starts: [], stops: [], disconnected: false,
        connect() {}, disconnect() { this.disconnected = true; },
        start(...args) { this.starts.push(args); }, stop(time) { this.stops.push(time); } };
      sources.push(source); return source;
    },
    createGain() {
      const gain = { disconnected: false, connect() {}, disconnect() { this.disconnected = true; },
        gain: { value: 1, ramps: [], cancelScheduledValues() {}, setValueAtTime() {},
          linearRampToValueAtTime(value, time) { this.ramps.push([value, time]); } } };
      gains.push(gain); return gain;
    },
  };
  return { context, sources, gains, chime: new PickupChime(context, {}) };
}

test('one call plays once, ends cleanly, and stop fades every active reward without replaying', () => {
  const { chime, context, sources, gains } = audioFixture();
  assert.deepEqual(chime.snapshot(), { plays: 0, activeVoices: 0, duration: 0.32, ready: true });
  chime.play(); chime.play();
  assert.equal(chime.snapshot().plays, 2);
  assert.equal(chime.snapshot().activeVoices, 2);
  for (const source of sources) assert.equal(source.starts.length, 1);
  sources[0].onended();
  assert.equal(chime.snapshot().activeVoices, 1);
  assert.ok(sources[0].disconnected && gains[0].disconnected);
  chime.stop(); chime.stop();
  assert.deepEqual(sources[1].stops, [context.currentTime + 0.015]);
  assert.deepEqual(gains[1].gain.ramps, [[0, context.currentTime + 0.015]]);
  sources[1].onended();
  assert.equal(chime.snapshot().activeVoices, 0);
  assert.equal(chime.snapshot().plays, 2);
});

test('suspended and closed contexts cannot queue delayed rewards', () => {
  const { chime, context, sources } = audioFixture();
  for (const state of ['suspended', 'closed']) { context.state = state; chime.play(); }
  assert.equal(sources.length, 0);
  assert.equal(chime.snapshot().plays, 0);
  context.state = 'running';
  assert.equal(chime.snapshot().activeVoices, 0);
  chime.play(); assert.equal(chime.snapshot().plays, 1);
});
