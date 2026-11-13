import { CLUES } from './archive-data.ts';
import { MEMES, PICKUPS } from './pickup-data.ts';
import type { SaveData } from './save.ts';

export interface MemeArchive {
  /** Stable meme id; independent of display names and world pickup ids. */
  id: string;
  name: string;
  aliases: string[];
  available: boolean;
  clueIds: string[];
  image?: string;
  summary?: string;
  missingReason?: string;
}

/** Only existing, documented materials are eligible for unlocking. */
export const MEME_ARCHIVES: Record<string, MemeArchive> = {
  'blue-mushroom': {
    id: 'blue-mushroom', name: '蓝瘦香菇', aliases: ['蓝瘦香菇图片', '蓝瘦，香菇'], available: true,
    clueIds: ['missing-caption-image', 'echo-meaning-note', 'echo-chat-context', 'echo-image-variants'],
    image: CLUES['missing-caption-image'].image,
    summary: CLUES['echo-meaning-note'].summary,
  },
  'friendship-boat': {
    id: 'friendship-boat', name: '友谊的小船', aliases: ['友谊的小船说翻就翻', '友谊小船'], available: true,
    clueIds: ['collection-friendship-boat'],
    image: CLUES['collection-friendship-boat'].image,
    summary: CLUES['collection-friendship-boat'].summary,
  },
  'gg-or-mm': {
    id: 'gg-or-mm', name: '你是GG还是MM', aliases: ['你是gg还是mm', '你是GG还是MM？', 'GG还是MM'], available: true,
    clueIds: ['collection-gg-or-mm'],
    image: CLUES['collection-gg-or-mm'].image,
    summary: CLUES['collection-gg-or-mm'].summary,
  },
  'awesome-my-bro': {
    id: 'awesome-my-bro', name: '厉害了我的哥', aliases: ['厉害了，我的哥', '厉害了word哥', '厉害了，word哥'], available: true,
    clueIds: ['collection-awesome-my-bro'],
    image: CLUES['collection-awesome-my-bro'].image,
    summary: CLUES['collection-awesome-my-bro'].summary,
  },
  'devil-or-showoff': {
    id: 'devil-or-showoff', name: '你是魔鬼还是秀儿', aliases: ['你是魔鬼还是秀儿？'], available: true,
    clueIds: ['collection-devil-or-showoff'],
    image: CLUES['collection-devil-or-showoff'].image,
    summary: CLUES['collection-devil-or-showoff'].summary,
  },
};

export function getMemeArchive(id: string): MemeArchive | undefined {
  return Object.hasOwn(MEME_ARCHIVES, id) ? MEME_ARCHIVES[id] : undefined;
}

/** No substring/fuzzy matching: widths and Latin case differ, identities do not. */
export function normalizeMemeName(input: string): string {
  return input.normalize('NFKC').trim().toLowerCase();
}

export function matchMemeName(input: string): MemeArchive | undefined {
  const query = normalizeMemeName(input);
  if (!query) return undefined;
  const matches = Object.values(MEME_ARCHIVES).filter(archive =>
    [archive.name, ...archive.aliases].some(name => normalizeMemeName(name) === query));
  // Ambiguous future aliases fail closed instead of opening whichever came first.
  return matches.length === 1 ? matches[0] : undefined;
}

export function ownsMeme(save: Pick<SaveData, 'pickupInventory'>, id: string): boolean {
  return PICKUPS.some(pickup => pickup.memeId === id && save.pickupInventory.includes(pickup.id));
}

export function hasMemeArchiveContent(archive: MemeArchive): boolean {
  return archive.available && !!archive.image && !!archive.summary?.trim() && archive.clueIds.length > 0
    && archive.clueIds.every(id => Object.hasOwn(CLUES, id) && CLUES[id].content.length > 0
      && CLUES[id].sourceLabel !== '资料待补充');
}

export type MemeSearchResult =
  | { status: 'empty' | 'unknown' }
  | { status: 'uncollected' | 'unavailable'; archive: MemeArchive }
  | { status: 'success'; archive: MemeArchive; alreadyQueried: boolean };

/** Resolves a terminal query without awarding items or unlocking before display. */
export function searchMemeArchive(save: Pick<SaveData, 'pickupInventory' | 'queriedMemes'>, input: string): MemeSearchResult {
  if (!normalizeMemeName(input)) return { status: 'empty' };
  const archive = matchMemeName(input);
  if (!archive) return { status: 'unknown' };
  if (!ownsMeme(save, archive.id)) return { status: 'uncollected', archive };
  if (!hasMemeArchiveContent(archive)) return { status: 'unavailable', archive };
  return { status: 'success', archive, alreadyQueried: save.queriedMemes.includes(archive.id) };
}

/** Called after a successful details display. Collection and legacy clues stay untouched. */
export function unlockMemeArchive(save: SaveData, id: string): boolean {
  const archive = getMemeArchive(id);
  if (!archive || !Object.hasOwn(MEMES, id) || !ownsMeme(save, id)
      || !hasMemeArchiveContent(archive) || save.queriedMemes.includes(id)) return false;
  save.queriedMemes.push(id);
  return save.queriedMemes.includes(id);
}
