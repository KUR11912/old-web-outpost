import { footstepSurfaceAt, type FootstepSurface } from './footstep-surface';
import { PickupChime } from './pickup-chime';

const VARIANTS = 5;
const MASTER_VOLUME = 0.3;
const FADE_OUT = 0.015;
const PREFERENCE_KEY = 'old-web-outpost:footsteps';
type Position = { x: number; z: number };

/** Count metres actually travelled, so collisions and diagonal input cannot speed up steps. */
export class FootstepCadence {
  private remaining = 0.12;

  reset() { this.remaining = 0.12; }

  advance(distance: number, dt: number, active: boolean): boolean {
    // A pose restore/teleport is not a footstep. No catch-up bursts after a stalled frame.
    if (!active || !Number.isFinite(distance) || !Number.isFinite(dt) || dt <= 0 ||
        distance < 0.0001 || distance > 4 * Math.min(dt, 0.05) + 0.001) {
      this.reset();
      return false;
    }
    this.remaining -= distance;
    if (this.remaining > 1e-8) return false;
    this.remaining += 1.12;
    return true;
  }
}

type Voice = { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode; stopping: boolean };

/** Shared game sound bus, unlocked only by a user gesture. */
export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private pickupChime?: PickupChime;
  private buffers?: Record<FootstepSurface, AudioBuffer[]>;
  private loading?: Promise<void>;
  private cadence = new FootstepCadence();
  private voices = new Set<Voice>();
  private previousVariant: Record<FootstepSurface, number> = { grass: -1, stone: -1 };
  private _enabled = true;
  private disposed = false;
  private surface: FootstepSurface = 'grass';
  private steps = 0;
  private lastStep: { surface: FootstepSurface; variant: number; time: number; playbackRate: number } | null = null;
  private error: string | null = null;

  constructor() {
    try { this._enabled = localStorage.getItem(PREFERENCE_KEY) !== 'off'; } catch { /* Storage is optional. */ }
  }

  get enabled() { return this._enabled; }

  setEnabled(enabled: boolean) {
    this._enabled = enabled;
    try { localStorage.setItem(PREFERENCE_KEY, enabled ? 'on' : 'off'); } catch { /* Session setting still works. */ }
    if (!enabled) this.stop();
  }

  /** Call synchronously in a click handler, before yielding browser user activation. */
  unlock(): void {
    if (!this._enabled || this.disposed) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = MASTER_VOLUME;
        this.master.connect(this.context.destination);
        this.pickupChime = new PickupChime(this.context, this.master);
      }
      if (this.context.state !== 'running') {
        void this.context.resume().catch(() => { this.error = 'Audio playback was not allowed'; });
      }
      if (!this.buffers && !this.loading) {
        this.loading = this.load(this.context).catch(error => {
          this.error = error instanceof Error ? error.message : String(error);
        }).finally(() => { this.loading = undefined; });
      }
    } catch (error) {
      // Missing/blocked audio must never prevent exploration, saving, or opening UI.
      this.error = error instanceof Error ? error.message : String(error);
    }
  }

  private async load(context: AudioContext): Promise<void> {
    const loadSurface = (surface: FootstepSurface) => Promise.all(Array.from({ length: VARIANTS }, async (_, index) => {
      const url = `${import.meta.env.BASE_URL}audio/footsteps/${surface}-${String(index + 1).padStart(2, '0')}.wav`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Footstep audio: HTTP ${response.status}`);
      return context.decodeAudioData(await response.arrayBuffer());
    }));
    const [grass, stone] = await Promise.all([loadSurface('grass'), loadSurface('stone')]);
    if (!this.disposed) {
      this.buffers = { grass, stone };
      this.error = null;
    }
  }

  update(before: Position, after: Position, dt: number, active: boolean): void {
    this.surface = footstepSurfaceAt(after.x, after.z);
    const distance = Math.hypot(after.x - before.x, after.z - before.z);
    const canPlay = active && this._enabled && !!this.buffers && this.context?.state === 'running';
    if (!canPlay || distance < 0.0001 || distance > 4 * Math.min(dt, 0.05) + 0.001) {
      this.stopFootsteps();
      return;
    }
    if (this.cadence.advance(distance, dt, canPlay)) this.play(this.surface, distance / dt);
  }

  private play(surface: FootstepSurface, speed: number): void {
    const context = this.context!, master = this.master!, buffers = this.buffers![surface];
    const previous = this.previousVariant[surface];
    let variant = Math.floor(Math.random() * (previous < 0 ? buffers.length : buffers.length - 1));
    if (previous >= 0 && variant >= previous) variant++;
    this.previousVariant[surface] = variant;
    const source = context.createBufferSource();
    source.buffer = buffers[variant];
    source.playbackRate.value = 0.96 + Math.random() * 0.08;
    const gain = context.createGain();
    gain.gain.value = (0.88 + Math.random() * 0.12) * Math.min(1, Math.max(0.55, speed / 2.4));
    const pan = context.createStereoPanner();
    pan.pan.value = this.steps % 2 ? 0.06 : -0.06;
    source.connect(gain); gain.connect(pan); pan.connect(master);
    const voice: Voice = { source, gain, pan, stopping: false };
    this.voices.add(voice);
    source.onended = () => {
      source.disconnect(); gain.disconnect(); pan.disconnect();
      this.voices.delete(voice);
    };
    source.start();
    this.steps++;
    this.lastStep = { surface, variant: variant + 1, time: context.currentTime, playbackRate: source.playbackRate.value };
  }

  /** Only successful, newly awarded world pickups call this; no replay queue. */
  playPickup(): void {
    if (!this._enabled || this.disposed || this.context?.state !== 'running') return;
    try { this.pickupChime?.play(); }
    catch (error) { this.error = error instanceof Error ? error.message : String(error); }
  }

  /** Pausing/muting silences both channels; standing still only silences footsteps. */
  stop(): void {
    this.stopFootsteps();
    this.pickupChime?.stop();
  }

  private stopFootsteps(): void {
    this.cadence.reset();
    if (!this.context) return;
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
    return {
      enabled: this._enabled, ready: !!this.buffers, context: this.context?.state ?? 'uninitialized',
      surface: this.surface, steps: this.steps, lastStep: this.lastStep ? { ...this.lastStep } : null,
      activeVoices: this.voices.size, variantsPerSurface: VARIANTS, volume: MASTER_VOLUME, error: this.error,
      pickup: this.pickupChime?.snapshot() ?? { plays: 0, activeVoices: 0, duration: 0, ready: false },
    };
  }

  dispose(): void {
    this.stop(); this.disposed = true;
    void this.context?.close().catch(() => {});
  }
}
