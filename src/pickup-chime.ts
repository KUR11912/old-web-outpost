const DURATION = 0.32;
const VOICE_GAIN = 0.75;
const FADE_OUT = 0.015;

/** Original arcade-style rising chime; no external recording or runtime download. */
export function createPickupChimeSamples(sampleRate: number) {
  const samples = new Float32Array(Math.ceil(DURATION * sampleRate));
  const notes = [
    { start: 0, duration: 0.085, frequency: 1046.5023, decay: 24, level: 0.88 },
    { start: 0.075, duration: 0.245, frequency: 1567.9817, decay: 12, level: 1 },
  ];
  for (const note of notes) {
    const first = Math.round(note.start * sampleRate);
    const count = Math.min(Math.round(note.duration * sampleRate), samples.length - first);
    for (let i = 0; i < count; i++) {
      const time = i / sampleRate;
      // Smooth the edges but retain a fast, recognisable coin-like attack.
      const attack = Math.min(1, time / 0.002);
      const release = Math.min(1, (count - 1 - i) / (sampleRate * 0.012));
      const envelope = attack * release * Math.exp(-note.decay * time) * note.level;
      const phase = 2 * Math.PI * note.frequency * time;
      // A softened pulse: the upper odd harmonics are deliberately quiet.
      const pulse = Math.sin(phase) + 0.16 * Math.sin(3 * phase) + 0.035 * Math.sin(5 * phase);
      samples[first + i] += envelope * pulse;
    }
  }
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const scale = peak > 0 ? 0.6 / peak : 0;
  for (let i = 0; i < samples.length; i++) samples[i] *= scale;
  return samples;
}

type Voice = { source: AudioBufferSourceNode; gain: GainNode; stopping: boolean };

export class PickupChime {
  private context: AudioContext;
  private destination: AudioNode;
  private buffer: AudioBuffer;
  private voices = new Set<Voice>();
  private plays = 0;

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.destination = destination;
    const samples = createPickupChimeSamples(context.sampleRate);
    this.buffer = context.createBuffer(1, samples.length, context.sampleRate);
    this.buffer.copyToChannel(samples, 0);
  }

  play(): void {
    // Do not queue a reward to sound later after the user resumes or unmutes.
    if (this.context.state !== 'running') return;
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    const gain = this.context.createGain();
    gain.gain.value = VOICE_GAIN;
    source.connect(gain); gain.connect(this.destination);
    const voice: Voice = { source, gain, stopping: false };
    this.voices.add(voice);
    source.onended = () => {
      source.disconnect(); gain.disconnect(); this.voices.delete(voice);
    };
    source.start();
    this.plays++;
  }

  stop(): void {
    const now = this.context.currentTime;
    for (const voice of this.voices) {
      if (voice.stopping) continue;
      voice.stopping = true;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + FADE_OUT);
      voice.source.stop(now + FADE_OUT);
    }
  }

  snapshot() {
    return { plays: this.plays, activeVoices: this.voices.size, duration: this.buffer.duration, ready: true };
  }
}
