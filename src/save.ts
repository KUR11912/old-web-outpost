import type { Pose } from './player';
import { MAP } from './map-config.ts';
import { CLUES, CLUE_ORDER, createArchiveState, evaluateArchive, hasAllClues, normalizeArchiveAnswers } from './archive-data.ts';
import type { ArchiveState } from './archive-data.ts';
import { MEMES, PICKUPS } from './pickup-data.ts';
import { getMemeArchive } from './meme-archives.ts';

export const SAVE_KEY = 'old-web-outpost:save:v1';
export const COLLECTION_BACKUP_KEY = `${SAVE_KEY}:before-collection-repair`;
export const CLUE_ID = 'missing-caption-image';
export interface SaveData {
  version: 1;
  collectionVersion: 2;
  investigated: boolean;
  clues: string[];
  memes: string[];
  /** Separately unlocked archive ids. Owning a folder never populates this list. */
  queriedMemes: string[];
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
  return { version: 1, collectionVersion: 2, investigated: false, clues: [], memes: [], queriedMemes: [], pickupInventory: [], collectedPickups: [], archive: createArchiveState(), pose: { ...MAP.spawn }, updatedAt: 0 };
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
  const rawInventory: unknown[] = Array.isArray(raw.pickupInventory) ? raw.pickupInventory : [];
  // An explicit inventory is authoritative, even when empty or malformed. Old
  // pickup markers are a fallback only for saves predating the inventory field.
  const oldMarkers: unknown[] = !Object.hasOwn(raw, 'pickupInventory') && Array.isArray(raw.collectedPickups) ? raw.collectedPickups : [];
  const ownedPickups = new Set(PICKUPS.filter(pickup => rawInventory.includes(pickup.id) || oldMarkers.includes(pickup.id)).map(pickup => pickup.id));
  const ownedClues = new Set(Object.keys(CLUES).filter(id => rawClues.includes(id)));
  // Historical cards and meme lists are not proof of finding a world folder.
  // Keep the actual old cards, but neither manufacture items nor synthesize cards.
  fresh.clues = [
    ...CLUE_ORDER.filter(id => ownedClues.has(id)),
    ...[...ownedClues].filter(id => !CLUE_ORDER.includes(id)),
  ];
  fresh.pickupInventory = PICKUPS.filter(pickup => ownedPickups.has(pickup.id)).map(pickup => pickup.id);
  fresh.memes = Object.keys(MEMES).filter(id => PICKUPS.some(pickup => pickup.memeId === id && ownedPickups.has(pickup.id)));
  // Synchronize scene visibility with the same authoritative inventory as the bag.
  fresh.collectedPickups = [...fresh.pickupInventory];
  if (Object.hasOwn(raw, 'queriedMemes')) {
    // Only an explicit terminal query for an owned item unlocks its archive.
    // Old investigation cards never pre-unlock blue mushroom or any other meme.
    const queried: unknown[] = Array.isArray(raw.queriedMemes) ? raw.queriedMemes : [];
    fresh.queriedMemes = fresh.memes.filter(id => !!getMemeArchive(id) && queried.includes(id));
  }
  // Before world pickups existed, this card could only be collected after reading.
  const legacyMailboxCollection = raw.collectionVersion !== 2 && !Object.hasOwn(raw, 'memes') && rawClues.includes(CLUE_ID);
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
  const alreadyOwned = save.pickupInventory.includes(pickup.id)
    || !!meme && PICKUPS.some(item => item.memeId === meme.id && save.pickupInventory.includes(item.id));
  const previousInventory = [...save.pickupInventory];
  const previousMemes = [...save.memes];
  if (!save.pickupInventory.includes(pickup.id)) save.pickupInventory.push(pickup.id);
  if (!save.pickupInventory.includes(pickup.id)) return false;
  if (meme) {
    if (!save.memes.includes(meme.id)) save.memes.push(meme.id);
    if (!save.memes.includes(meme.id)) {
      save.pickupInventory = previousInventory;
      save.memes = previousMemes;
      return false;
    }
    for (const matching of PICKUPS) {
      if (matching.memeId === meme.id && !save.pickupInventory.includes(matching.id)) save.pickupInventory.push(matching.id);
    }
  }
  // A stale orphan query cannot turn a first pickup into an already-read archive.
  // Repeated pickup calls keep legitimate research earned after collection.
  if (!alreadyOwned && meme) save.queriedMemes = save.queriedMemes.filter(id => id !== meme.id);
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
    const store = storage ?? localStorage;
    store.removeItem(COLLECTION_BACKUP_KEY);
    store.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}
