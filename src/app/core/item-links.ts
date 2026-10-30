// Item check: links to item databases, stash search text and weapon DPS.
// Links: EE2 `item-check/hotkeyable-actions.ts` (its PoE2DB paths as they are, plus the pages it
// gets wrong, checked live: waystones and uncut gems). DPS: EE2 `ItemInfo.vue`, with chaos damage,
// reload time and the value at 20 % quality (reference FINDINGS F-38).

import { ItemCategory, itemIsModifiable, ItemRarity, type ParsedItem } from '@/parser';
import { propAt20Quality, QUALITY_STATS } from '@/parser/calc-q20';
import { __testExports as parserInternals } from '@/parser/Parser';
import { getPoe2dbPath } from '@/web/item-check/hotkeyable-actions';
import {
  CHAOS_DAMAGE_PROPERTY,
  CRAFT_OF_EXILE_SITE,
  DEFAULT_LANG,
  Lang,
  POE_WIKI_SITE,
  POEDB_LANGS,
  POEDB_SITE,
  POEDB_WAYSTONES_PAGE,
  UNCUT_GEM_LEVEL,
} from '../constants';

/** The page name of the item: uncut gems have one page for all levels. */
function pageName(item: ParsedItem): string {
  return item.info.refName.replace(UNCUT_GEM_LEVEL, '');
}

export function wikiUrl(item: ParsedItem): string {
  // EE2 passes the raw name to window.open; the opener plugin needs a valid URL.
  return `${POE_WIKI_SITE}/${encodeURIComponent(pageName(item).replaceAll(' ', '_'))}`;
}

/** PoE2DB: EE2's path (the modifiers page of the base kind, or the item's own page), in the game language. */
export function poedbUrl(item: ParsedItem, lang: Lang = DEFAULT_LANG): string {
  // Waystones are `Map` items (FINDINGS F-09), which EE2 sends to a missing page per tier.
  const path =
    item.category === ItemCategory.Map
      ? POEDB_WAYSTONES_PAGE
      : // Without a category EE2 gives no path at all.
        (getPoe2dbPath({ ...item, info: { ...item.info, refName: pageName(item) } }) ??
        pageName(item).replaceAll(' ', '_').replaceAll("'", ''));
  return `${POEDB_SITE}/${POEDB_LANGS[lang]}/${encodeURI(path)}`;
}

export function craftOfExileUrl(item: ParsedItem): string {
  return `${CRAFT_OF_EXILE_SITE}/?game=poe2&eimport=${encodeURIComponent(item.rawText)}`;
}

/**
 * Craft of Exile only makes sense for bases that can still be crafted on (EE2 `ItemInfo.vue`
 * `showCoE`). EE2 data marks currency, runes and gems craftable too (FINDINGS F-09), and uniques
 * cannot be crafted on: only normal, magic and rare items count.
 */
export function canCraftOfExile(item: ParsedItem): boolean {
  return (
    Boolean(itemIsModifiable(item)) &&
    (item.rarity === ItemRarity.Normal || item.rarity === ItemRarity.Magic || item.rarity === ItemRarity.Rare)
  );
}

/** Stash search text: the item name in quotes, matched as a phrase by the game (EE2 `findSimilarItems`). */
export function stashSearchText(item: ParsedItem): string {
  return JSON.stringify(item.info.name);
}

/** What a link or stash search hotkey does with the item, without the popup. */
export type ItemAction = 'wiki' | 'poedb' | 'craft-of-exile' | 'stash-search';
export type ItemActionEffect = { open: string } | { stashSearch: string } | null;

export function itemAction(action: ItemAction, item: ParsedItem, lang: Lang = DEFAULT_LANG): ItemActionEffect {
  switch (action) {
    case 'wiki':
      return { open: wikiUrl(item) };
    case 'poedb':
      return { open: poedbUrl(item, lang) };
    case 'craft-of-exile':
      // The same rule as the button: nothing to craft on, nothing to open.
      return canCraftOfExile(item) ? { open: craftOfExileUrl(item) } : null;
    case 'stash-search':
      return { stashSearch: stashSearchText(item) };
  }
}

export interface WeaponDps {
  /** At the item's current quality. */
  phys: number;
  /** Fire, cold and lightning. */
  elem: number;
  chaos: number;
  total: number;
  /** Crossbows: seconds. */
  reload?: number;
  /** At 20 % quality, as the price check filters and the trade site count it; only when it is higher. */
  q20?: { phys: number; total: number };
}

type WeaponProps = Pick<ParsedItem, 'weaponAS' | 'weaponPHYSICAL' | 'weaponELEMENTAL' | 'weaponRELOAD'>;

/**
 * The weapon properties of the item. EE2 drops them for uniques (priced by name, not by DPS), so
 * for a unique they are read again with EE2's own `parseWeapon`.
 */
function weaponProps(item: ParsedItem): WeaponProps {
  if (item.weaponAS || item.rarity !== ItemRarity.Unique) return item;
  const props = {} as ParsedItem;
  for (const section of parserInternals.itemTextToSections(item.rawText).slice(1)) {
    if (parserInternals.parseWeapon(section, props) === 'SECTION_PARSED') break;
  }
  return props;
}

/** "Chaos Damage: 10-20 (chaos)": EE2 does not read it, a property only some weapons have. */
function chaosDamage(item: ParsedItem): number {
  for (const line of item.rawText.split(/\r?\n/)) {
    const prefix = Object.values(CHAOS_DAMAGE_PROPERTY).find((text) => line.startsWith(text));
    if (!prefix) continue;
    const values = line.slice(prefix.length).split('-').map((str) => parseInt(str.replace(/[^\d]/g, ''), 10));
    return values.length === 2 ? (values[0] + values[1]) / 2 : (values[0] ?? 0);
  }
  return 0;
}

export function weaponDps(item: ParsedItem): WeaponDps | null {
  const props = weaponProps(item);
  const speed = props.weaponAS;
  if (!speed) return null;
  const physDamage = props.weaponPHYSICAL ?? 0;
  const elemDamage = props.weaponELEMENTAL ?? 0;
  const chaosHit = chaosDamage(item);
  const dps: WeaponDps = {
    phys: Math.round(speed * physDamage),
    elem: Math.round(speed * elemDamage),
    chaos: Math.round(speed * chaosHit),
    // From the exact sum, not the rounded parts (EE2 adds those; one off at times).
    total: Math.round(speed * (physDamage + elemDamage + chaosHit)),
  };
  if (props.weaponRELOAD) dps.reload = props.weaponRELOAD;
  // PoE2 weapon quality raises physical damage only (EE2 `weaponProps`, QUALITY_STATS.PHYSICAL_DAMAGE).
  if (physDamage && (item.quality ?? 0) < 20) {
    const physQ20 = propAt20Quality(physDamage, QUALITY_STATS.PHYSICAL_DAMAGE, item).roll.value;
    // Truncated like the filter values (EE2 `roundRoll`), so both show the same numbers.
    const physDps = speed * physQ20;
    const q20 = { phys: Math.trunc(physDps), total: Math.trunc(physDps + speed * (elemDamage + chaosHit)) };
    if (q20.phys > dps.phys) dps.q20 = q20;
  }
  return dps;
}
