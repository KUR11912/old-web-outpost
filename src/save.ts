import type { Pose } from './player';
import { MAP } from './map-config.ts';
import { CLUE_ORDER, createArchiveState, evaluateArchive, hasAllClues, normalizeArchiveAnswers } from './archive-data.ts';
import type { ArchiveState } from './archive-data.ts';

export const SAVE_KEY = 'old-web-outpost:save:v1';
export const CLUE_ID = 'missing-caption-image';
export interface SaveData {
  version: 1;
  investigated: boolean;
  clues: string[];
  archive: ArchiveState;
  pose: Pose;
  updatedAt: number;
}
type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function createDefaultSave(): SaveData {
  return { version: 1, investigated: false, clues: [], archive: createArchiveState(), pose: { ...MAP.spawn }, updatedAt: 0 };
}

/** Existing v1 saves acquire archive defaults without losing pose or clue ownership. */
export function normalizeSave(value: unknown): SaveData {
  const fresh = createDefaultSave();
  if (!value || typeof value !== 'object') return fresh;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1) return fresh;
  const hasClue = Array.isArray(raw.clues) && raw.clues.includes(CLUE_ID);
  const investigated = raw.investigated === true || hasClue;
  const pose = raw.pose as Partial<Pose> | null;
  if (pose && finite(pose.x) && finite(pose.z) && finite(pose.yaw) && finite(pose.pitch)
    && pose.x >= MAP.bounds.minX && pose.x <= MAP.bounds.maxX
    && pose.z >= MAP.bounds.minZ && pose.z <= MAP.bounds.maxZ) {
    fresh.pose = {
      x: Math.max(MAP.bounds.minX + .26, Math.min(MAP.bounds.maxX - .26, pose.x)),
      z: Math.max(MAP.bounds.minZ + .26, Math.min(MAP.bounds.maxZ - .26, pose.z)),
      yaw: Math.atan2(Math.sin(pose.yaw), Math.cos(pose.yaw)),
      pitch: Math.max(-1.25, Math.min(1.25, pose.pitch)),
    };
  }
  fresh.investigated = investigated;
  // Reading the letter and explicitly collecting its card are separate actions.
  const rawClues: unknown[] = Array.isArray(raw.clues) ? raw.clues : [];
  fresh.clues = CLUE_ORDER.filter(id => rawClues.includes(id));
  const archive = raw.archive && typeof raw.archive === 'object' ? raw.archive as Record<string, unknown> : null;
  fresh.archive.answers = normalizeArchiveAnswers(archive?.answers);
  // Explicit submission is required. Correct answers alone never auto-complete.
  fresh.archive.completed = archive?.completed === true && hasAllClues(fresh.clues) && evaluateArchive(fresh.archive.answers).allCorrect;
  fresh.updatedAt = finite(raw.updatedAt) && raw.updatedAt >= 0 ? raw.updatedAt : 0;
  return fresh;
}

export function loadSave(storage?: SaveStorage): SaveData {
  try {
    const text = (storage ?? localStorage).getItem(SAVE_KEY);
    return text ? normalizeSave(JSON.parse(text)) : createDefaultSave();
  } catch {
    return createDefaultSave();
  }
}

export function saveGame(data: SaveData, storage?: SaveStorage): boolean {
  try {
    (storage ?? localStorage).setItem(SAVE_KEY, JSON.stringify({ ...normalizeSave(data), updatedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function resetSave(storage?: SaveStorage): boolean {
  try {
    (storage ?? localStorage).removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}
