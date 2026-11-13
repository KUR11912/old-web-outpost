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
  'friendship-boat': {
    id: 'friendship-boat', clueId: 'collection-friendship-boat',
    clue: CLUES['collection-friendship-boat'],
  },
  'gg-or-mm': {
    id: 'gg-or-mm', clueId: 'collection-gg-or-mm',
    clue: CLUES['collection-gg-or-mm'],
  },
  'awesome-my-bro': {
    id: 'awesome-my-bro', clueId: 'collection-awesome-my-bro',
    clue: CLUES['collection-awesome-my-bro'],
  },
  'devil-or-showoff': {
    id: 'devil-or-showoff', clueId: 'collection-devil-or-showoff',
    clue: CLUES['collection-devil-or-showoff'],
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
    id: 'field-folder-01', memeId: 'friendship-boat', model: 'MemeFolder_01',
    position: { x: 20.4, z: -46 }, marker: 1,
    name: '友谊的小船', description: '梗图、年份与出处待补充。',
    icon: 'assets/folder-icon.svg', location: '回声档案馆北侧草地',
  },
  {
    id: 'field-folder-02', memeId: 'gg-or-mm', model: 'MemeFolder_01',
    position: { x: 24.5, z: -20 }, marker: 2,
    name: '你是GG还是MM', description: '梗图、年份与出处待补充。',
    icon: 'assets/folder-icon.svg', location: '回声档案馆东南侧 · 河流西岸林隙',
  },
  {
    id: 'field-folder-03', memeId: 'awesome-my-bro', model: 'MemeFolder_01',
    position: { x: 26.6, z: 9 }, marker: 3,
    name: '厉害了我的哥', description: '梗图、年份与出处待补充。',
    icon: 'assets/folder-icon.svg', location: '地图南部 · 河流西侧草地',
  },
  {
    id: 'field-folder-04', memeId: 'devil-or-showoff', model: 'MemeFolder_01',
    position: { x: 60, z: 3 }, marker: 4,
    name: '你是魔鬼还是秀儿', description: '梗图、年份与出处待补充。',
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

/** All owned world pickups share one collection list, including blue mushroom. */
export function collectedPickupEntries(inventory: readonly string[]) {
  return PICKUPS.filter(pickup => inventory.includes(pickup.id));
}

export const PICKUP_STYLE = {
  width: .8,
  hoverHeight: .6,
  bobAmplitude: .1,
  bobPeriod: 3.4,
  rotationPeriod: 5,
  pickupRadius: .85,
} as const;
