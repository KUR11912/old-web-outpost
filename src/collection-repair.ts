import { PICKUPS } from './pickup-data.ts';
import { COLLECTION_BACKUP_KEY, normalizeSave, saveGame, type SaveData } from './save.ts';

export { COLLECTION_BACKUP_KEY } from './save.ts';
type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export interface CollectionRepairPlan {
  removePickupIds: string[];
  lockMemeIds: string[];
}

/** Only an explicit repair changes already saved ownership; loading never guesses its history. */
export function repairedCollection(save: SaveData, plan: CollectionRepairPlan): SaveData {
  const next = normalizeSave(save);
  const removed = PICKUPS.filter(pickup => plan.removePickupIds.includes(pickup.id));
  const locked = new Set([...plan.lockMemeIds, ...removed.map(pickup => pickup.memeId)]);
  next.pickupInventory = next.pickupInventory.filter(id => !removed.some(pickup => pickup.id === id));
  next.queriedMemes = next.queriedMemes.filter(id => !locked.has(id));
  return normalizeSave(next);
}

export function repairCollection(save: SaveData, plan: CollectionRepairPlan, storage?: SaveStorage): boolean {
  try {
    const store = storage ?? localStorage;
    const next = repairedCollection(save, plan);
    // Keep a recoverable snapshot before writing the corrected inventory.
    // A failed backup/write must leave the live game untouched.
    store.setItem(COLLECTION_BACKUP_KEY, JSON.stringify(normalizeSave(save)));
    if (!saveGame(next, store)) return false;
    Object.assign(save, next);
    return true;
  } catch { return false; }
}

export function hasCollectionBackup(storage?: SaveStorage): boolean {
  try {
    const value = JSON.parse((storage ?? localStorage).getItem(COLLECTION_BACKUP_KEY) ?? 'null');
    return value?.version === 1 && Array.isArray(value.pickupInventory) && Array.isArray(value.queriedMemes);
  } catch { return false; }
}

export function restoreCollection(save: SaveData, storage?: SaveStorage): boolean {
  try {
    const store = storage ?? localStorage;
    if (!hasCollectionBackup(store)) return false;
    const backup = normalizeSave(JSON.parse(store.getItem(COLLECTION_BACKUP_KEY)!));
    // Undo only collection changes. Keep the current location and unrelated quest progress.
    const next = normalizeSave({ ...save,
      pickupInventory: [...save.pickupInventory, ...backup.pickupInventory],
      queriedMemes: [...save.queriedMemes, ...backup.queriedMemes],
    });
    if (!saveGame(next, store)) return false;
    Object.assign(save, next);
    return true;
  } catch { return false; }
}
