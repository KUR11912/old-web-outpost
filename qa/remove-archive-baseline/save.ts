import type { Pose } from './player';
import { MAP } from './map-config.ts';
import { CLUES, CLUE_ORDER, createArchiveState, evaluateArchive, hasAllClues, normalizeArchiveAnswers } from './archive-data.ts';
import type { ArchiveState } from './archive-data.ts';
import { MEMES, PICKUPS } from './pickup-data.ts';

export const SAVE_KEY = 'old-web-outpost:save:v1';
export const CLUE_ID = 'missing-caption-image';
export interface SaveData {
  version: 1;
  investigated: boolean;
  clues: string[];
  memes: string[];
  /** Stable world item ids; display content is always resolved from pickup-data. */
  pickupInventory: string[];
  collectedPickups: string[];
  archive: ArchiveState;
  pose: Pose;
  updatedAt: number;
}
type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function createDefaultSave(): SaveData {
  return { version: 1, investigated: false, clues: [], memes: [], pickupInventory: [], collectedPickups: [], archive: createArchiveState(), pose: { ...MAP.spawn }, updatedAt: 0 };
}

/** Existing v1 saves retain their card inventory, archive progress, and pose. */
export function normalizeSave(value: unknown): SaveData {
  const fresh = createDefaultSave();
  if (!value || typeof value !== 'object') return fresh;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1) return fresh;
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
  // Reading the letter and explicitly collecting its card are separate actions.
  const rawClues: unknown[] = Array.isArray(raw.clues) ? raw.clues : [];
  const rawMemes: unknown[] = Array.isArray(raw.memes) ? raw.memes : [];
  const rawInventory: unknown[] = Array.isArray(raw.pickupInventory) ? raw.pickupInventory : [];
  const ownedPickups = new Set(PICKUPS.filter(pickup => rawInventory.includes(pickup.id)).map(pickup => pickup.id));
  const ownedClues = new Set(CLUE_ORDER.filter(id => rawClues.includes(id)));
  for (const meme of Object.values(MEMES)) {
    if (!Object.hasOwn(CLUES, meme.clueId)) continue;
    // A placeholder may later bind to a real meme without changing its item id.
    const ownsBoundPickup = PICKUPS.some(pickup => pickup.memeId === meme.id && ownedPickups.has(pickup.id));
    if (!rawClues.includes(meme.clueId) && !rawMemes.includes(meme.id) && !ownsBoundPickup) continue;
    ownedClues.add(meme.clueId);
    fresh.memes.push(meme.id);
  }
  fresh.clues = [
    ...CLUE_ORDER.filter(id => ownedClues.has(id)),
    ...[...ownedClues].filter(id => !CLUE_ORDER.includes(id)),
  ];
  // Existing card/meme ownership migrates to stable item ownership as well.
  for (const pickup of PICKUPS) {
    if (pickup.memeId !== null && fresh.memes.includes(pickup.memeId)) ownedPickups.add(pickup.id);
  }
  fresh.pickupInventory = PICKUPS.filter(pickup => ownedPickups.has(pickup.id)).map(pickup => pickup.id);
  // A trigger marker alone never awards either a real card or a placeholder.
  fresh.collectedPickups = [...fresh.pickupInventory];
  // Before world pickups existed, this card could only be collected after reading.
  const legacyMailboxCollection = !Object.hasOwn(raw, 'memes') && rawClues.includes(CLUE_ID);
  fresh.investigated = raw.investigated === true || legacyMailboxCollection;
  const archive = raw.archive && typeof raw.archive === 'object' ? raw.archive as Record<string, unknown> : null;
  fresh.archive.answers = normalizeArchiveAnswers(archive?.answers);
  // Explicit submission is required. Correct answers alone never auto-complete.
  fresh.archive.completed = archive?.completed === true && hasAllClues(fresh.clues) && evaluateArchive(fresh.archive.answers).allCorrect;
  fresh.updatedAt = finite(raw.updatedAt) && raw.updatedAt >= 0 ? raw.updatedAt : 0;
  return fresh;
}

/** Mutates inventory synchronously; true only when this call awards a new item. */
export function collectPickup(save: SaveData, pickupId: string): boolean {
  const pickup = PICKUPS.find(candidate => candidate.id === pickupId);
  if (!pickup) return false;
  if (pickup.memeId !== null && !Object.hasOwn(MEMES, pickup.memeId)) return false;
  const meme = pickup.memeId === null ? null : MEMES[pickup.memeId];
  if (meme && !Object.hasOwn(CLUES, meme.clueId)) return false;

  const alreadyOwned = save.pickupInventory.includes(pickup.id)
    || !!meme && (save.clues.includes(meme.clueId) || save.memes.includes(meme.id));
  const previousInventory = [...save.pickupInventory];
  const previousClues = [...save.clues];
  const previousMemes = [...save.memes];
  if (!save.pickupInventory.includes(pickup.id)) save.pickupInventory.push(pickup.id);
  if (!save.pickupInventory.includes(pickup.id)) return false;
  if (meme) {
    if (!save.clues.includes(meme.clueId)) save.clues.push(meme.clueId);
    if (!save.memes.includes(meme.id)) save.memes.push(meme.id);
    if (!save.clues.includes(meme.clueId) || !save.memes.includes(meme.id)) {
      save.pickupInventory = previousInventory;
      save.clues = previousClues;
      save.memes = previousMemes;
      return false;
    }
    for (const matching of PICKUPS) {
      if (matching.memeId === meme.id && !save.pickupInventory.includes(matching.id)) save.pickupInventory.push(matching.id);
    }
  }
  // Hide world instances only after their stable ids are confirmed in inventory.
  save.collectedPickups = PICKUPS.filter(candidate => save.pickupInventory.includes(candidate.id)).map(candidate => candidate.id);
  return !alreadyOwned;
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
