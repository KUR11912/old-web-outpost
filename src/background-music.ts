const DEFAULT_VOLUME = 0.15;
const PREFERENCE_KEY = 'old-web-outpost:music';
const TRACK = '11月13日.mp3';

const validVolume = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/** One streamed, looping music track, independent of movement and sound effects. */
export class BackgroundMusic {
  private readonly audio: HTMLAudioElement;
  private readonly url = `${import.meta.env?.BASE_URL ?? '/'}audio/music/${encodeURIComponent(TRACK)}`;
  private started = false;
  private disposed = false;
  private windowFocused = document.hasFocus();
  private pagePresent = true;
  private lastAudibleVolume = DEFAULT_VOLUME;
  private playAttempt = 0;
  private pendingPlay: { id: number } | null = null;
  private error: string | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.audio.loop = true;
    this.audio.volume = DEFAULT_VOLUME;
    try {
      const raw = localStorage.getItem(PREFERENCE_KEY);
      const preference: unknown = raw ? JSON.parse(raw) : null;
      if (preference && typeof preference === 'object') {
        const saved = preference as Record<string, unknown>;
        if (validVolume(saved.volume)) this.audio.volume = saved.volume;
        if (typeof saved.muted === 'boolean') this.audio.muted = saved.muted;
        if (validVolume(saved.lastAudibleVolume) && saved.lastAudibleVolume > 0) {
          this.lastAudibleVolume = saved.lastAudibleVolume;
        } else if (this.audio.volume > 0) this.lastAudibleVolume = this.audio.volume;
      }
    } catch { /* Music preferences remain usable when browser storage is unavailable. */ }
    this.audio.addEventListener('error', this.onError);
    this.audio.src = this.url;
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('focus', this.onFocus);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('pageshow', this.onPageShow);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  get volume() { return this.audio.volume; }
  get muted() { return this.audio.muted || this.audio.volume === 0; }

  /** Call directly from a user click. No playback happens merely by loading the page. */
  start(): void {
    if (this.disposed) return;
    this.started = true;
    // A click in the game is itself a focus signal, including embedded browsers.
    this.windowFocused = true;
    if (this.audio.error) this.audio.load();
    this.syncPlayback();
  }

  setVolume(value: number): void {
    if (this.disposed || !Number.isFinite(value)) return;
    this.audio.volume = Math.min(1, Math.max(0, value));
    // Moving the slider to an audible level is an explicit request to unmute.
    this.audio.muted = false;
    if (this.audio.volume > 0) this.lastAudibleVolume = this.audio.volume;
    this.persist();
  }

  toggleMuted(): void {
    if (this.disposed) return;
    if (this.muted) {
      if (this.audio.volume === 0) this.audio.volume = this.lastAudibleVolume;
      this.audio.muted = false;
    } else this.audio.muted = true;
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(PREFERENCE_KEY, JSON.stringify({
        volume: this.audio.volume, muted: this.audio.muted, lastAudibleVolume: this.lastAudibleVolume,
      }));
    } catch { /* This session still keeps the selected volume. */ }
  }

  private shouldPlay() {
    return this.started && !this.disposed && this.pagePresent && this.windowFocused && !document.hidden;
  }

  private syncPlayback(): void {
    if (!this.shouldPlay()) {
      this.pausePlayback();
      return;
    }
    if (!this.audio.paused || this.pendingPlay) return;
    const attempt = { id: ++this.playAttempt };
    this.pendingPlay = attempt;
    try {
      // Invoke play before yielding the click's browser user activation.
      void this.audio.play().then(() => {
        if (this.pendingPlay === attempt) this.pendingPlay = null;
        // A delayed play promise must not restart audio after blur/pagehide/dispose.
        if (!this.shouldPlay()) this.audio.pause();
        else if (attempt.id === this.playAttempt) this.error = null;
      }).catch(error => {
        if (this.pendingPlay === attempt) this.pendingPlay = null;
        if (attempt.id !== this.playAttempt || !this.shouldPlay() || error?.name === 'AbortError') return;
        this.error = error?.name === 'NotAllowedError'
          ? '请点击音乐按钮继续播放'
          : '背景音乐暂时无法播放，请再次点击音乐按钮重试';
      });
    } catch {
      if (this.pendingPlay === attempt) this.pendingPlay = null;
      this.error = '背景音乐暂时无法播放，请再次点击音乐按钮重试';
    }
  }

  private pausePlayback(): void {
    ++this.playAttempt;
    this.pendingPlay = null;
    this.audio.pause();
  }

  private onBlur = () => { this.windowFocused = false; this.syncPlayback(); };
  private onFocus = () => { this.windowFocused = true; this.syncPlayback(); };
  private onPageHide = () => { this.pagePresent = false; this.syncPlayback(); };
  private onPageShow = () => {
    this.pagePresent = true;
    this.windowFocused = document.hasFocus();
    this.syncPlayback();
  };
  private onVisibility = () => {
    if (!document.hidden) this.windowFocused = document.hasFocus();
    this.syncPlayback();
  };
  private onError = () => {
    this.error = this.audio.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
      ? '无法读取背景音乐，请检查音频文件格式'
      : '背景音乐加载失败，请检查音频文件';
  };

  snapshot() {
    return {
      started: this.started, playing: !this.audio.paused && !this.audio.ended,
      paused: this.audio.paused, currentTime: this.audio.currentTime,
      duration: Number.isFinite(this.audio.duration) ? this.audio.duration : null,
      loop: this.audio.loop, volume: this.volume, muted: this.muted,
      readyState: this.audio.readyState, pending: !!this.pendingPlay, error: this.error, url: this.url,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pausePlayback();
    this.audio.removeEventListener('error', this.onError);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('focus', this.onFocus);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('pageshow', this.onPageShow);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.audio.removeAttribute('src');
    this.audio.load();
  }
}
