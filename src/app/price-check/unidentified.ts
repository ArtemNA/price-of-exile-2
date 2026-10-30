// Unidentified uniques: which uniques the base can be (EE2 `unidentified-resolver/UnidentifiedResolver.vue`).

import { type BaseType, ITEMS_ITERATOR } from '@/assets/data';
import { ItemRarity, type ParsedItem } from '@/parser';
import { UNIQUE_PLACEHOLDER_NAME } from '../constants';

/**
 * An unidentified unique whose name the copied text does not tell: the user has to pick it.
 * The parser looks such an item up by its base (`info` is the ITEM entry, no `info.unique`).
 */
export function needsIdentification(item: ParsedItem): boolean {
  return item.rarity === ItemRarity.Unique && item.isUnidentified && !item.info.unique;
}

/**
 * Uniques on the item's base, one entry per unique (EE2 also ignores their variants). Entries
 * without a name and EE2's "INCOMPLETE" stand-ins are not uniques one can price.
 */
export function identifiedVariants(item: ParsedItem): BaseType[] {
  const baseType = item.info.refName;
  const possible: BaseType[] = [];
  for (const match of ITEMS_ITERATOR(JSON.stringify(baseType))) {
    if (match.namespace !== 'UNIQUE' || match.unique!.base !== baseType) continue;
    if (!match.refName || match.refName === UNIQUE_PLACEHOLDER_NAME) continue;
    if (!possible.some((u) => u.refName === match.refName)) possible.push(match);
  }
  return possible;
}

/**
 * The item as the picked unique (APT `makeIdentifiedUnique`, EE2 `select`): `info` becomes the
 * unique, so the search goes by its name with `info.unique.base` as the type. The rest stays as
 * copied: still unidentified (the "Unidentified" filter is on), the base's implicits as filters.
 */
export function identifyAs(item: ParsedItem, unique: BaseType): ParsedItem {
  return { ...item, info: unique };
}
