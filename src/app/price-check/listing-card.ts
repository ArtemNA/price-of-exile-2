import type { ListingCardMode } from '../constants';
import type { DisplayItem, DisplayItemLine } from '@/web/price-check/trade/pathofexile-trade';

// The card of a listed item (EE2 `trade/TooltipItem.vue`): what the trade site's fetch result says
// about the item, laid out as the game's own tooltip. The data is made by EE2's `parseFetchResult`
// (`PricingResult.displayItem`); this only puts it in sections and words.

/** One line: a label and the value after it, or a whole text in the line's colour. */
export interface CardLine {
  label: string;
  value?: string;
  /** Trade API colour index (EE2 `TradeNumberColors`): the class `color-<n>`. */
  color: number;
  /** "P1", "S3", "P1 + S2". */
  tier?: string;
}

export interface ListingCardData {
  title: string[];
  /** The header art: `Rare-title`, `Unique-runic`…; null for a rarity without one (gems, currency). */
  header: string | null;
  /** The separator art between sections: `Rare`, `Magic`, `Unique`; null draws a plain line. */
  separator: string | null;
  icon?: { url: string; w: number; h: number };
  sockets: Array<{ type: string; item?: string }>;
  /** Non-empty sections in the game's order; a separator goes between each two. */
  sections: CardLine[][];
}

/** EE2 `STRIP_PERCENT_MODS`: their texts end in "{0}%", the value already has its "%". */
const STRIP_PERCENT = new Set([
  'item.crit',
  'item.block',
  'item.map_pack_size',
  'item.map_magic_monsters',
  'item.map_rare_monsters',
  'item.map_drop_chance',
  'item.map_item_rarity',
  'item.map_gold',
]);

const HEADER_RARITIES = new Set(['Normal', 'Magic', 'Rare', 'Unique']);
const SEPARATOR_RARITIES = new Set(['Magic', 'Rare', 'Unique']);
/** Frame types of runic items (EE2 `DisplayFrameType.Runic*`). */
const RUNIC_FRAMES = new Set([12, 13, 14]);

/**
 * The label of a line: the translated text without its `{0}` (the value is drawn after it, in its
 * own colour). For a few the value carries the "%" too: cut at the last space, as EE2 does.
 */
export function cardLabel(key: string, translate: (key: string) => string): string {
  const text = translate(key);
  if (STRIP_PERCENT.has(key)) return text.slice(0, text.lastIndexOf(' ')) + ' ';
  return text.replace('{0}', '');
}

function line(entry: DisplayItemLine, translate: (key: string) => string): CardLine {
  const value = entry.value == null || entry.value === '' ? undefined : String(entry.value);
  return { label: cardLabel(entry.text, translate), value, color: entry.color, tier: entry.tier || undefined };
}

/** EE2 `TooltipItem` sections, empty ones left out; each footer tag is a section of its own. */
export function listingCard(item: DisplayItem, translate: (key: string) => string): ListingCardData {
  const blocks: Array<DisplayItemLine[] | undefined> = [
    item.nameBlock,
    item.itemProps,
    item.enchantMods,
    item.runeMods,
    item.grantSkill,
    item.implicitMods,
    [
      ...(item.fracturedMods ?? []),
      ...(item.explicitMods ?? []),
      ...(item.desecratedMods ?? []),
      ...(item.mutatedMods ?? []),
      ...(item.veiledMods ?? []),
    ],
    item.pseudoMods,
    ...(item.itemTags ?? []).map((tag) => [tag]),
  ];
  const rarity = String(item.rarity);
  return {
    title: item.title,
    header: HEADER_RARITIES.has(rarity) ? `${rarity}-${RUNIC_FRAMES.has(item.frameType ?? -1) ? 'runic' : 'title'}` : null,
    separator: SEPARATOR_RARITIES.has(rarity) ? rarity : null,
    icon: item.icon?.url ? item.icon : undefined,
    sockets: item.sockets ?? [],
    sections: blocks.filter((block): block is DisplayItemLine[] => !!block?.length).map((block) => block.map((entry) => line(entry, translate))),
  };
}

/**
 * Whether the card shows for the row under the pointer (EE2 `TradeItem`): never when off, on
 * hover when "always", only while Shift is held for "keybind", and only while the pointer is on
 * the row's eye icon for "eye" (no key: the game keeps its Shift).
 */
export function cardShown(mode: ListingCardMode, pointer: { shift: boolean; eye: boolean }): boolean {
  switch (mode) {
    case 'always':
      return true;
    case 'keybind':
      return pointer.shift;
    case 'eye':
      return pointer.eye;
    default:
      return false;
  }
}

/** Gap between the row and the card, the arrow sits in it. */
const CARD_GAP = 10;
/** The card keeps this far from the window's edges. */
const CARD_MARGIN = 4;
/** Room on the left that is enough for most cards: the card stays there, as EE2's does. */
const CARD_ENOUGH_ROOM = 400;

/** Where the card stands in the window (fixed positions, px). */
export interface CardPlace {
  item: DisplayItem;
  side: 'left' | 'right';
  /** From the window's right edge (card on the left) or left edge (card on the right). */
  x: number;
  maxWidth: number;
  maxHeight: number;
  /** The row's middle, from the window's top: the arrow points there, the card is centred on it (`cardTop`). */
  rowMiddle: number;
  /** The window's height, for `cardTop`. */
  windowHeight: number;
  /** When the pointer asked for the card (`performance.now()`), for the test's timing. */
  askedAt?: number;
}

/**
 * Beside the row: on its left (EE2's tippy `placement: "left"`) when there is room enough or more
 * than on the right, else on the right (tippy flipping). Its height is known once drawn: `cardTop`
 * then centres it on the row.
 */
export function cardPlace(
  item: DisplayItem,
  row: { left: number; right: number; top: number; bottom: number },
  window: { width: number; height: number },
): CardPlace {
  const left = row.left >= Math.min(CARD_ENOUGH_ROOM, window.width - row.right);
  const room = left ? row.left : window.width - row.right;
  return {
    item,
    side: left ? 'left' : 'right',
    x: (left ? window.width - row.left : row.right) + CARD_GAP,
    maxWidth: Math.max(0, room - CARD_GAP - CARD_MARGIN),
    maxHeight: Math.max(0, window.height - 2 * CARD_MARGIN),
    rowMiddle: (row.top + row.bottom) / 2,
    windowHeight: window.height,
  };
}

/**
 * The card's top once its height is known (the PoE1 app's placement): centred on the row's
 * middle, moved in to stay inside the window; a card taller than the window starts at its top.
 */
export function cardTop(rowMiddle: number, cardHeight: number, windowHeight: number): number {
  const lowest = windowHeight - CARD_MARGIN - cardHeight;
  return Math.max(CARD_MARGIN, Math.min(rowMiddle - cardHeight / 2, lowest));
}
