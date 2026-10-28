// Unidentified uniques: which uniques the base can be (APT `unidentified-resolver/UnidentifiedResolver.vue`).

import { type BaseType, ITEMS_ITERATOR } from '@/assets/data';
import { ItemRarity, makeIdentifiedUnique, type ParsedItem } from '@/parser';

/** An unidentified unique whose name the copied text does not tell: the user has to pick it. */
export function needsIdentification(item: ParsedItem): boolean {
  return item.rarity === ItemRarity.Unique && item.isUnidentified && !item.info.unique;
}

/** Uniques on the item's base, one entry per unique (APT also ignores their variants). */
export function identifiedVariants(item: ParsedItem): BaseType[] {
  const baseType = item.info.refName;
  const possible: BaseType[] = [];
  for (const match of ITEMS_ITERATOR(JSON.stringify(baseType))) {
    if (match.namespace === 'UNIQUE' && match.unique!.base === baseType && !possible.some((u) => u.refName === match.refName)) {
      possible.push(match);
    }
  }
  return possible;
}

export function identifyAs(item: ParsedItem, unique: BaseType): ParsedItem {
  return makeIdentifiedUnique(unique, item);
}
