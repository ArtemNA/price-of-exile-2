import { CATALYST_TO_TAG, CATALYST_TYPES, GROUPED_AUGMENTS, type BaseType } from '@/assets/data';
import { ItemCategory, itemIsModifiable, type ParsedItem } from '@/parser';
import { ItemEditorType } from '@/parser/meta';
import type { EditorItem } from '@/parser/ParsedItem';
import { getCategoryGroups, useAugment } from '@/web/price-check/item-editor/augment';
import { applyCatalyst, getItemEditorType } from '@/web/price-check/item-editor/item-editor';
import { lookupPrice, type PriceDb } from '../core/ninja-prices';

// The item editor (EE2 `item-editor/*`): what the item would be worth with other runes, soul cores
// or idols in its sockets, or with a catalyst's quality on a ring, amulet or jewel. The edits are
// applied by EE2's own `useAugment` / `applyCatalyst` to a copy of the item; the filters are then
// made from the copy, as EE2 makes them again from the edited item.

/** What the editor changed: socket index → what goes there, and the catalyst quality. */
export interface ItemEdits {
  augments: Readonly<Record<number, EditorItem>>;
  catalyst: { refName: string; quality: number } | null;
}

export const NO_EDITS: ItemEdits = { augments: {}, catalyst: null };

export function hasEdits(edits: ItemEdits): boolean {
  return Object.keys(edits.augments).length > 0 || edits.catalyst != null;
}

/**
 * Which editor the item gets (EE2 `FiltersBlock` `showItemEditor`): sockets for weapons and armour
 * that have any (also corrupted ones: what is socketed can still be taken out), a catalyst for a
 * ring, amulet or jewel that can still be changed; uniques get none.
 */
export function editorKind(item: ParsedItem): 'augment' | 'catalyst' | null {
  const type = getItemEditorType(item);
  if (type === ItemEditorType.Augment) return item.augmentSockets?.augments.length ? 'augment' : null;
  if (type === ItemEditorType.Catalyst) return itemIsModifiable(item) ? 'catalyst' : null;
  return null;
}

/** A deep copy, as EE2 makes one before editing (`JSON.parse(JSON.stringify(item))`). */
function copy(item: ParsedItem): ParsedItem {
  return JSON.parse(JSON.stringify(item)) as ParsedItem;
}

/** The item with the edits applied; the item itself when there are none. */
export function applyEdits(item: ParsedItem, edits: ItemEdits): ParsedItem {
  if (!hasEdits(edits)) return item;
  const edited = copy(item);
  for (const [index, augment] of Object.entries(edits.augments)) {
    useAugment(edited, augment, Number(index));
  }
  if (edits.catalyst) {
    const catalyst = catalystsFor(item).find((entry) => entry.refName === edits.catalyst!.refName);
    if (catalyst) applyCatalyst(edited, catalyst, edits.catalyst.quality);
  }
  return edited;
}

/** A socket can take another augment unless what is in it is bound to it (EE2 `socketBound`). */
export function canReplace(item: ParsedItem, index: number): boolean {
  return !item.augmentSockets?.augments[index]?.socketBound;
}

export interface AugmentTab {
  id: string;
  label: string;
  /** Sub-tabs of runes and soul cores; one tab of `items` otherwise. */
  sub: Array<{ id: string; label: string; items: EditorItem[] }>;
}

const augmentTabs = new Map<ItemCategory, AugmentTab[]>();

/** What can go into the sockets of this kind of item, as EE2 groups it (Rune: Lesser … Perfect, Soul Core, Idol, Other). */
export function augmentTabsFor(category: ItemCategory): AugmentTab[] {
  const cached = augmentTabs.get(category);
  if (cached) return cached;
  const groups = getCategoryGroups(GROUPED_AUGMENTS, category);
  const tabs: AugmentTab[] = [
    {
      id: 'rune',
      label: 'Rune',
      sub: [
        { id: 'lesser', label: 'Lesser', items: groups.Rune.Lesser },
        { id: 'normal', label: 'Normal', items: groups.Rune.Normal },
        { id: 'greater', label: 'Greater', items: groups.Rune.Greater },
        { id: 'perfect', label: 'Perfect', items: groups.Rune.Perfect },
        { id: 'other', label: 'Other', items: groups.Rune.Other },
      ],
    },
    {
      id: 'soul-core',
      label: 'Soul Core',
      sub: [
        { id: 'normal', label: 'Normal', items: groups.SoulCore.Normal },
        { id: 'special', label: 'Special', items: groups.SoulCore.Special },
      ],
    },
    { id: 'idol', label: 'Idol', sub: [{ id: 'all', label: 'Idol', items: groups.Idol }] },
    { id: 'legacy', label: 'Legacy', sub: [{ id: 'all', label: 'Legacy', items: groups.Legacy }] },
    { id: 'other', label: 'Other', sub: [{ id: 'all', label: 'Other', items: groups.Other }] },
  ]
    .map((tab) => ({ ...tab, sub: tab.sub.filter((sub) => sub.items.length) }))
    .filter((tab) => tab.sub.length);
  augmentTabs.set(category, tabs);
  return tabs;
}

/** Catalysts that fit the item: refined ones for jewels (EE2 `QualityEditor`). */
export function catalystsFor(item: ParsedItem): BaseType[] {
  return item.category === ItemCategory.Jewel ? CATALYST_TYPES.Refined : CATALYST_TYPES.Normal;
}

/** What a catalyst raises ("Life", "Armour, Evasion, Energy Shield"). */
export function catalystTags(catalyst: BaseType): string {
  return (CATALYST_TO_TAG[catalyst.tags[1]] ?? []).join(', ');
}

/** Quality steps a catalyst can be applied with (EE2 `QualityEditor`: jewels up to 20, Breach Ring up to 70). */
export function qualitySteps(item: ParsedItem): number[] {
  if (item.info.refName === 'Breach Ring') return [0, 20, 30, 40, 50, 60, 70];
  if (item.category === ItemCategory.Jewel) return [0, 20];
  return [0, 20, 30, 40, 50];
}

/** The catalyst already on the item, if its quality comes from one. */
export function currentCatalyst(item: ParsedItem): BaseType | undefined {
  if (!item.qualityType || !item.quality) return undefined;
  return catalystsFor(item).find((catalyst) => catalyst.tags[1] === item.qualityType);
}

export const EXTRACTION_ORB = 'Orb of Extraction';

/** poe.ninja ids of what the editor shows prices for: socketables, catalysts and the Orb of Extraction. */
export function editorPriceIds(item: ParsedItem, edits: ItemEdits): string[] {
  const names = new Set<string>([EXTRACTION_ORB]);
  for (const augment of item.augmentSockets?.augments ?? []) if (augment) names.add(augment.refName);
  for (const augment of Object.values(edits.augments)) names.add(augment.refName);
  if (edits.catalyst) names.add(edits.catalyst.refName);
  return [...names].map((name) => `ITEM::${name}`);
}

/** poe.ninja price of an item by its name, in divines. */
export function ninjaDivines(db: PriceDb, refName: string): number | undefined {
  return lookupPrice(db, { ns: 'ITEM', name: refName })?.primaryValue;
}

export interface ExtractionValue {
  /** What is socketed, in divines (only the priced ones). */
  socketed: number;
  extraction: number;
  /** Socketed minus the Orb of Extraction. */
  net: number;
  /** Socketed things poe.ninja has no price for. */
  unpriced: number;
}

/**
 * EE2 `ExtractionValue`: what the socketed runes, cores and idols are worth minus the Orb of
 * Extraction that takes them out. Null without anything socketed, a price for the orb, or a price
 * for any of them.
 */
export function extractionValue(item: ParsedItem, db: PriceDb): ExtractionValue | null {
  const augments = (item.augmentSockets?.augments ?? []).filter((augment): augment is EditorItem => augment != null);
  const extraction = ninjaDivines(db, EXTRACTION_ORB);
  if (!augments.length || extraction == null) return null;
  let socketed = 0;
  let unpriced = 0;
  for (const augment of augments) {
    const price = ninjaDivines(db, augment.refName);
    if (price == null) unpriced++;
    else socketed += price;
  }
  if (unpriced === augments.length) return null;
  return { socketed, extraction, net: socketed - extraction, unpriced };
}

/** The editor item for a socketable by name (a rune put into a socket by the tests). */
export function editorItemByName(category: ItemCategory, refName: string): EditorItem | undefined {
  for (const tab of augmentTabsFor(category)) {
    for (const sub of tab.sub) {
      const found = sub.items.find((item) => item.refName === refName);
      if (found) return found;
    }
  }
  return undefined;
}
