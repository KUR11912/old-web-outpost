import { PerspectiveCamera } from 'three';
import type { Collider } from './world';
import type { MapBounds } from './map-config';

export interface Pose { x: number; z: number; yaw: number; pitch: number }
export interface PointXZ { x: number; z: number }
export interface ControlState { active: boolean; mode: 'locked' | 'drag'; message: string }

export const PLAYER_HEIGHT = 1.65;
export const PLAYER_RADIUS = 0.26;
export const WALK_SPEED = 2.4;
const MAX_PITCH = 1.25;
const EPSILON = 0.0001;
const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v));

function overlaps(p: PointXZ, c: Collider, radius: number): boolean {
  if (c.kind === 'circle') {
    return Math.hypot(p.x - c.x, p.z - c.z) < radius + (c.radius ?? 0) - EPSILON;
  }
  const nearestX = clamp(p.x, c.x - (c.halfX ?? 0), c.x + (c.halfX ?? 0));
  const nearestZ = clamp(p.z, c.z - (c.halfZ ?? 0), c.z + (c.halfZ ?? 0));
  return Math.hypot(p.x - nearestX, p.z - nearestZ) < radius - EPSILON;
}

/** Horizontal capsule against circles / upright boxes. Bounded substeps prevent tunnelling. */
export function resolveMovement(
  position: PointXZ,
  delta: PointXZ,
  colliders: Collider[],
  bounds: number | MapBounds,
  radius = PLAYER_RADIUS,
): PointXZ & { collided: boolean } {
  const extent = typeof bounds === 'number'
    ? { minX: -bounds, maxX: bounds, minZ: -bounds, maxZ: bounds }
    : bounds;
  const inset = {
    minX: Math.min(extent.minX + radius, (extent.minX + extent.maxX) / 2),
    maxX: Math.max(extent.maxX - radius, (extent.minX + extent.maxX) / 2),
    minZ: Math.min(extent.minZ + radius, (extent.minZ + extent.maxZ) / 2),
    maxZ: Math.max(extent.maxZ - radius, (extent.minZ + extent.maxZ) / 2),
  };
  const inBounds = (q: PointXZ) => q.x >= inset.minX && q.x <= inset.maxX && q.z >= inset.minZ && q.z <= inset.maxZ;
  const valid = (q: PointXZ) => inBounds(q) && !colliders.some(c => overlaps(q, c, radius));
  const p = {
    x: clamp(Number.isFinite(position.x) ? position.x : 0, inset.minX, inset.maxX),
    z: clamp(Number.isFinite(position.z) ? position.z : 0, inset.minZ, inset.maxZ),
  };
  let collided = p.x !== position.x || p.z !== position.z;

  // Recover a saved position inside a collider, e.g. after layout changes.
  for (let pass = 0; pass < 4; pass += 1) {
    let corrected = false;
    for (const c of colliders) {
      if (!overlaps(p, c, radius)) continue;
      collided = corrected = true;
      const candidates: PointXZ[] = [];
      if (c.kind === 'circle') {
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        const distance = Math.hypot(dx, dz);
        const reach = radius + (c.radius ?? 0) + EPSILON;
        candidates.push({
          x: c.x + (distance > EPSILON ? dx / distance : 1) * reach,
          z: c.z + (distance > EPSILON ? dz / distance : 0) * reach,
        });
        candidates.push({ x: c.x - reach, z: c.z }, { x: c.x + reach, z: c.z }, { x: c.x, z: c.z - reach }, { x: c.x, z: c.z + reach });
      } else {
        const hx = c.halfX ?? 0;
        const hz = c.halfZ ?? 0;
        const qx = clamp(p.x, c.x - hx, c.x + hx);
        const qz = clamp(p.z, c.z - hz, c.z + hz);
        const dx = p.x - qx;
        const dz = p.z - qz;
        const distance = Math.hypot(dx, dz);
        if (distance > EPSILON) {
          candidates.push({ x: qx + dx / distance * (radius + EPSILON), z: qz + dz / distance * (radius + EPSILON) });
        }
        candidates.push(
          { x: c.x - hx - radius - EPSILON, z: p.z },
          { x: c.x + hx + radius + EPSILON, z: p.z },
          { x: p.x, z: c.z - hz - radius - EPSILON },
          { x: p.x, z: c.z + hz + radius + EPSILON },
        );
      }
      // A river can meet the outer boundary: pushing toward the nearest end
      // then clamping would leave the player inside water. Prefer a clear,
      // in-bounds exit instead, retaining the nearest valid bank or wall side.
      candidates.sort((a, b) => (a.x - p.x) ** 2 + (a.z - p.z) ** 2 - (b.x - p.x) ** 2 - (b.z - p.z) ** 2);
      const exit = candidates.find(valid) ?? candidates.find(inBounds);
      if (exit) { p.x = exit.x; p.z = exit.z; }
    }
    if (!corrected) break;
  }

  const dx = Number.isFinite(delta.x) ? delta.x : 0;
  const dz = Number.isFinite(delta.z) ? delta.z : 0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.1));
  const step = { x: dx / steps, z: dz / steps };
  for (let i = 0; i < steps; i += 1) {
    for (const axis of ['x', 'z'] as const) {
      if (!step[axis]) continue;
      const candidate = { ...p, [axis]: p[axis] + step[axis] };
      if (valid(candidate)) {
        p[axis] = candidate[axis];
      } else {
        collided = true;
        // Keep the unobstructed fraction, then slide along the other axis.
        let low = 0;
        let high = 1;
        for (let n = 0; n < 10; n += 1) {
          const fraction = (low + high) / 2;
          if (valid({ ...p, [axis]: p[axis] + step[axis] * fraction })) low = fraction;
          else high = fraction;
        }
        p[axis] += step[axis] * low;
      }
    }
  }
  return { ...p, collided };
}

/** Mouse lock is entered only through activate(), called by a visible user action. */
export class PlayerController {
  private camera: PerspectiveCamera;
  private canvas: HTMLCanvasElement;
  private colliders: Collider[];
  private bounds: number | MapBounds;
  private onState: (state: ControlState) => void;
  private onMove?: () => void;
  private keys = new Set<string>();
  private _active = false;
  private _mode: 'locked' | 'drag' = 'locked';
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private lockRequest = 0;
  private yaw = 0;
  private pitch = 0;

  constructor(
    camera: PerspectiveCamera,
    canvas: HTMLCanvasElement,
    colliders: Collider[],
    bounds: number | MapBounds,
    onState: (state: ControlState) => void,
    onMove?: () => void,
  ) {
    this.camera = camera;
    this.canvas = canvas;
    this.colliders = colliders;
    this.bounds = bounds;
    this.onState = onState;
    this.onMove = onMove;
    this.camera.rotation.order = 'YXZ';
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.visibility);
    document.addEventListener('pointerlockchange', this.lockchange);
    document.addEventListener('pointerlockerror', this.lockerror);
    document.addEventListener('mousemove', this.mousemove);
    canvas.addEventListener('pointerdown', this.pointerdown);
    canvas.addEventListener('pointermove', this.pointermove);
    canvas.addEventListener('pointerup', this.pointerup);
    canvas.addEventListener('pointercancel', this.pointerup);
    canvas.addEventListener('lostpointercapture', this.pointerup);
  }

  get active() { return this._active; }
  get mode() { return this._mode; }

  private emit(message: string) { this.onState({ active: this._active, mode: this._mode, message }); }

  activate(mode: 'locked' | 'drag'): void {
    this.keys.clear();
    this.dragging = false;
    this._active = true;
    this._mode = mode;
    const request = ++this.lockRequest;
    if (mode === 'drag') {
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
      this.emit('Drag to look · WASD to move · Esc to pause');
      return;
    }
    this.emit('Enabling mouse look…');
    try {
      if (typeof this.canvas.requestPointerLock !== 'function') {
        this.fallback(request);
        return;
      }
      const result = this.canvas.requestPointerLock();
      if (result && typeof result.catch === 'function') result.catch(() => this.fallback(request));
    } catch {
      this.fallback(request);
    }
  }

  private fallback(request: number): void {
    if (request !== this.lockRequest || !this._active || this._mode !== 'locked') return;
    this._mode = 'drag';
    this.keys.clear();
    this.emit('Mouse lock unavailable · Drag to look · WASD to move');
  }

  pause(): void {
    ++this.lockRequest;
    this._active = false;
    this.dragging = false;
    this.keys.clear();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.emit('Paused · Click to resume exploring');
  }

  setPose(x: number, z: number, yaw: number, pitch: number): void {
    const safe = resolveMovement({ x, z }, { x: 0, z: 0 }, this.colliders, this.bounds);
    this.camera.position.set(safe.x, PLAYER_HEIGHT, safe.z);
    this.yaw = Number.isFinite(yaw) ? Math.atan2(Math.sin(yaw), Math.cos(yaw)) : 0;
    this.pitch = clamp(Number.isFinite(pitch) ? pitch : 0, -MAX_PITCH, MAX_PITCH);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  getPose(): Pose { return { x: this.camera.position.x, z: this.camera.position.z, yaw: this.yaw, pitch: this.pitch }; }

  update(dt: number): void {
    if (!this._active) return;
    const forward = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
    const sideways = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    const length = Math.hypot(forward, sideways);
    if (!length) return;
    const distance = WALK_SPEED * clamp(dt, 0, 0.05) / length;
    const delta = {
      x: (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * sideways) * distance,
      z: (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * sideways) * distance,
    };
    const next = resolveMovement(this.camera.position, delta, this.colliders, this.bounds);
    if (Math.abs(next.x - this.camera.position.x) + Math.abs(next.z - this.camera.position.z) > EPSILON) {
      this.camera.position.set(next.x, PLAYER_HEIGHT, next.z);
      this.onMove?.();
    }
  }

  private rotate(dx: number, dy: number): void {
    this.yaw = Math.atan2(Math.sin(this.yaw - dx * 0.0022), Math.cos(this.yaw - dx * 0.0022));
    this.pitch = clamp(this.pitch - dy * 0.0022, -MAX_PITCH, MAX_PITCH);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.onMove?.();
  }

  private keydown = (event: KeyboardEvent) => {
    if (!this._active) return;
    if (event.code === 'Escape') { this.pause(); return; }
    const target = event.target as HTMLElement | null;
    if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
      event.preventDefault();
      this.keys.add(event.code);
    }
  };
  private keyup = (event: KeyboardEvent) => { this.keys.delete(event.code); };
  private blur = () => { if (this._active) this.pause(); };
  private visibility = () => { if (document.hidden && this._active) this.pause(); };
  private lockchange = () => {
    if (document.pointerLockElement === this.canvas) {
      if (!this._active || this._mode !== 'locked') { document.exitPointerLock(); return; }
      this.emit('Mouse to look · WASD to move · Esc to release the mouse');
    } else if (this._active && this._mode === 'locked') {
      this.pause();
    }
  };
  private lockerror = () => this.fallback(this.lockRequest);
  private mousemove = (event: MouseEvent) => {
    if (this._active && this._mode === 'locked' && document.pointerLockElement === this.canvas) this.rotate(event.movementX, event.movementY);
  };
  private pointerdown = (event: PointerEvent) => {
    if (!this._active || this._mode !== 'drag' || event.button !== 0) return;
    this.dragging = true;
    this.lastPointer = { x: event.clientX, y: event.clientY };
    this.canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  private pointermove = (event: PointerEvent) => {
    if (!this._active || this._mode !== 'drag' || !this.dragging) return;
    this.rotate(event.clientX - this.lastPointer.x, event.clientY - this.lastPointer.y);
    this.lastPointer = { x: event.clientX, y: event.clientY };
  };
  private pointerup = () => { this.dragging = false; };

  dispose(): void {
    this.pause();
    window.removeEventListener('keydown', this.keydown);
    window.removeEventListener('keyup', this.keyup);
    window.removeEventListener('blur', this.blur);
    document.removeEventListener('visibilitychange', this.visibility);
    document.removeEventListener('pointerlockchange', this.lockchange);
    document.removeEventListener('pointerlockerror', this.lockerror);
    document.removeEventListener('mousemove', this.mousemove);
    this.canvas.removeEventListener('pointerdown', this.pointerdown);
    this.canvas.removeEventListener('pointermove', this.pointermove);
    this.canvas.removeEventListener('pointerup', this.pointerup);
    this.canvas.removeEventListener('pointercancel', this.pointerup);
    this.canvas.removeEventListener('lostpointercapture', this.pointerup);
  }
}
