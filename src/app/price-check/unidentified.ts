// Unidentified uniques: which uniques the base can be (APT `unidentified-resolver/UnidentifiedResolver.vue`).
// stage 11: EE2 has no APT `makeIdentifiedUnique`; until our own (PLAN F8) the picker stays off.

import { type BaseType, ITEMS_ITERATOR } from '@/assets/data';
import type { ParsedItem } from '@/parser';

/** An unidentified unique whose name the copied text does not tell: the user has to pick it. */
export function needsIdentification(_item: ParsedItem): boolean {
  return false;
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

/** stage 11: only the base data is swapped, the unique's mods are not added. */
export function identifyAs(item: ParsedItem, unique: BaseType): ParsedItem {
  return { ...item, info: unique };
}
