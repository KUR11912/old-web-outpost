import { CLUES, type ClueCard } from './archive-data.ts';

export interface MemeDefinition {
  id: string;
  clueId: string;
  /** Reuse the existing card for its name, image, and introduction. */
  clue: ClueCard;
}

export interface PickupDefinition {
  id: string;
  /** Bind a verified content entry later; the pickup id remains unchanged. */
  memeId: string | null;
  model: string;
  position: { x: number; z: number };
  name: string;
  description: string;
  icon: string;
  location: string;
  marker?: number;
}

export const MEMES: Record<string, MemeDefinition> = {
  'blue-mushroom': {
    id: 'blue-mushroom',
    clueId: 'missing-caption-image',
    clue: CLUES['missing-caption-image'],
  },
};

export const PICKUPS: readonly PickupDefinition[] = [
  {
    id: 'outpost-blue-mushroom-folder',
    memeId: 'blue-mushroom',
    model: 'MemeFolder_01',
    position: { x: 1.5, z: -1.8 },
    name: CLUES['missing-caption-image'].name,
    description: CLUES['missing-caption-image'].summary,
    icon: CLUES['missing-caption-image'].image!,
    location: '旧网驿站 · 邮箱前',
  },
  {
    id: 'field-folder-01', memeId: null, model: 'MemeFolder_01',
    position: { x: 20.4, z: -46 }, marker: 1,
    name: '待定老梗01', description: '老梗内容待补充',
    icon: 'assets/folder-icon.svg', location: '回声档案馆北侧草地',
  },
  {
    id: 'field-folder-02', memeId: null, model: 'MemeFolder_01',
    position: { x: 24.5, z: -20 }, marker: 2,
    name: '待定老梗02', description: '老梗内容待补充',
    icon: 'assets/folder-icon.svg', location: '回声档案馆东南侧 · 河流西岸林隙',
  },
  {
    id: 'field-folder-03', memeId: null, model: 'MemeFolder_01',
    position: { x: 26.6, z: 9 }, marker: 3,
    name: '待定老梗03', description: '老梗内容待补充',
    icon: 'assets/folder-icon.svg', location: '地图南部 · 河流西侧草地',
  },
  {
    id: 'field-folder-04', memeId: null, model: 'MemeFolder_01',
    position: { x: 60, z: 3 }, marker: 4,
    name: '待定老梗04', description: '老梗内容待补充',
    icon: 'assets/folder-icon.svg', location: '桥梁东南侧 · 河流东岸林隙',
  },
];

/** Names and imagery are resolved at display time, so old collections get new content. */
export function getPickupContent(pickup: PickupDefinition) {
  const meme = pickup.memeId && Object.hasOwn(MEMES, pickup.memeId) ? MEMES[pickup.memeId] : null;
  return {
    name: meme?.clue.name ?? pickup.name,
    description: meme?.clue.summary ?? pickup.description,
    icon: meme?.clue.image ?? pickup.icon,
    clueId: meme?.clueId,
    placeholder: !meme,
  };
}

/** Existing quest cards retain their own bag slots; these are additional collections. */
export function extraPickupEntries(inventory: readonly string[], questClues: readonly string[]) {
  return PICKUPS.filter(pickup => inventory.includes(pickup.id)
    && !questClues.includes(getPickupContent(pickup).clueId ?? ''));
}

export const PICKUP_STYLE = {
  width: .8,
  hoverHeight: .6,
  bobAmplitude: .1,
  bobPeriod: 3.4,
  rotationPeriod: 5,
  pickupRadius: .85,
} as const;
