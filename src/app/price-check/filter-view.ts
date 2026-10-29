// How the price check shows EE2's filter objects (design A+B, reference FINDINGS F-54): stat filters
// in groups by kind with tiers, the mods behind pseudo totals, hidden filters apart, and the item
// header's base / corrupted switches. The filter objects stay EE2's; only the view is ours.
// EE2 has no OR groups of filters (APT `FilterOrGroup`): the groups here are our own headings.

import type { ParsedItem } from '@/parser';
import { ModifierType } from '@/parser/modifiers';
import {
  BULK_LISTING_TYPES,
  CATEGORY_NAMES,
  LISTING_TYPES,
  type ListingType,
  NO_TIER_CATEGORIES,
  STAT_GROUP_OTHER,
  STAT_GROUP_UNREVEALED,
  STAT_GROUPS,
} from '../constants';
import { t, tr } from '../core/i18n';
import { INTERNAL_TRADE_IDS, type ItemFilters, type StatFilter } from '../../lib/ee2/web/price-check/filters/interfaces';

export type CorruptedState = 'any' | 'not' | 'only';

export interface StatGroup {
  name: string;
  entries: StatFilter[];
  /** The item's unrevealed desecrated mods, as one row of the Desecrated group. */
  unrevealed?: UnrevealedRow;
}

/**
 * Unrevealed desecrated mods (EE2 `veiled`): the parser knows only that they are there. EE2 searches
 * them as one item filter: "veiled" plus the number of unrevealed mods (`createTradeRequest`).
 */
export interface UnrevealedRow {
  filter: NonNullable<ItemFilters['veiled']>;
  text: string;
}

export interface SourceLine {
  text: string;
  /** "crafted", "implicit", …: the mod's kind when it is not a plain explicit. */
  kind?: string;
  /** What the mod adds to the total when it differs from its own roll ("+18 to Strength" → 9 life). */
  adds?: number;
}


/**
 * Visible filters in groups; hidden ones (APT `hidden`: "rarely moves the price") on their own.
 * The unrevealed desecrated mods join the Desecrated group.
 */
export function groupStats(stats: StatFilter[], unrevealed?: UnrevealedRow | null): { groups: StatGroup[]; hidden: StatFilter[] } {
  const groups = new Map<string, StatFilter[]>();
  const hidden: StatFilter[] = [];
  for (const entry of stats) {
    if (entry.hidden != null) {
      hidden.push(entry);
      continue;
    }
    const name = STAT_GROUPS.find((group) => group.tags.includes(entry.tag))?.name ?? STAT_GROUP_OTHER;
    groups.set(name, [...(groups.get(name) ?? []), entry]);
  }
  if (unrevealed && !groups.has(STAT_GROUP_UNREVEALED)) groups.set(STAT_GROUP_UNREVEALED, []);
  const order = [...STAT_GROUPS.map((group) => group.name), STAT_GROUP_OTHER];
  return {
    groups: order
      .filter((name) => groups.has(name))
      .map((name) => ({
        name,
        entries: groups.get(name)!,
        ...(unrevealed && name === STAT_GROUP_UNREVEALED ? { unrevealed } : {}),
      })),
    hidden,
  };
}

/** "Unrevealed suffix", or "2 unrevealed modifiers" when there are more. */
export function unrevealedRow(item: ParsedItem, filters: ItemFilters): UnrevealedRow | null {
  const filter = filters.veiled;
  if (!filter) return null;
  const mods = item.newMods.filter((mod) => mod.info.type === ModifierType.Veiled);
  const count = filter.veiledCount || mods.length;
  const generation = mods.length === 1 ? mods[0].info.generation : undefined;
  const text =
    count > 1
      ? tr('{0} unrevealed modifiers', count)
      : generation === 'prefix'
        ? tr('Unrevealed prefix')
        : generation === 'suffix'
          ? tr('Unrevealed suffix')
          : tr('Unrevealed modifier');
  return { filter, text };
}

/**
 * Best (lowest) tier among the mods behind a filter: T1 is the top roll range. None for waystones,
 * tablets and jewels, where EE2 shows none either.
 */
export function statTier(filter: StatFilter, item?: ParsedItem): number | null {
  if (item?.category && NO_TIER_CATEGORIES.includes(item.category)) return null;
  const tiers = filter.sources.map((source) => source.modifier.info.tier).filter((tier): tier is number => tier != null);
  return tiers.length ? Math.min(...tiers) : null;
}

/** A roll as the game prints it, with the advanced copy's range after it: "+68(60-75)". */
const ROLL_IN_TEXT = String.raw`([+-]?)\d+(?:\.\d+)?(?:\([^)]*\))?`;
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The stat template with the signs the game prints. EE2 matches "+68 to maximum Life" as
 * "# to maximum Life" with 68 and keeps the "+" nowhere: not in the matcher, not in the stat ref
 * (FINDINGS F-08). The copied item text still has it, so the template's line is looked up there.
 * Templates the text does not have (pseudo totals, item properties) stay as they are.
 */
export function signedTemplate(template: string, rawText: string | undefined): string {
  const text = template.trim();
  if (!rawText || !text.includes('#')) return text;
  const parts = text.split('#');
  const pattern = parts.map(escapeRegExp).join(ROLL_IN_TEXT);
  // The line ends there or goes on with " (implicit)", " (rune)" or " — Unscalable Value".
  const match = new RegExp(`^${pattern}(?=[ \\t]*(?:$|\\(|—))`, 'm').exec(rawText);
  if (!match) return text;
  return parts.reduce((out, part, i) => (i === 0 ? part : `${out}${match[i] === '+' ? '+#' : '#'}${part}`), '');
}

/**
 * A pseudo total as the trade site writes it: EE2 keeps some without the "+" the site shows
 * ("#% total Elemental Resistance" for "+#% total Elemental Resistance"). Totals of flat values
 * ("total to", "total maximum", "total … Resistance") get it; "increased", "reduced" and counts don't.
 */
export function signedPseudo(template: string): string {
  if (!template.startsWith('#') || !template.includes(' total ') || /\b(increased|reduced|more|less)\b/.test(template)) return template;
  return `+${template}`;
}

/**
 * A stat line with its roll: "# to maximum Life", 68 and the item text → "+68 to maximum Life".
 * The sign comes back from the item text (`signedTemplate`).
 */
export function statLine(template: string, value: number | undefined, rawText?: string): string {
  const signed = signedTemplate(template, rawText);
  return value != null && signed.split('#').length === 2 ? signed.replace('#', String(value)) : signed;
}

/**
 * The template a filter row shows. Item properties (Spirit, Total DPS, waystone Pack Size, …) are
 * written with EE2's i18n keys rather than the filter text, which can be off ("Spirit: #%"), as
 * EE2 `FilterModifier.vue` does.
 */
export function statTemplate(filter: StatFilter): string {
  const id = filter.tradeId[0];
  const label = id && INTERNAL_TRADE_IDS.includes(id) ? t(id, '#', '#') : id;
  return label && label !== id ? label : filter.text;
}

/** The mods a pseudo total adds up (APT "Mods" toggle, `SourceInfo.vue`). */
export function sourceLines(filter: StatFilter, rawText?: string): SourceLine[] {
  if (filter.tag !== 'pseudo') return [];
  return filter.sources.map((source) => {
    const roll = source.stat.roll?.value;
    const text = statLine(source.stat.translation.string, roll, rawText);
    const type = source.modifier.info.type;
    const adds = source.contributes?.value;
    return {
      text,
      kind: type === 'explicit' ? undefined : type,
      adds: adds != null && adds !== roll ? adds : undefined,
    };
  });
}

/** Number of stat filters that are on, and of all of them (APT "3 of 10, stats"). */
export function statCounts(stats: StatFilter[]): { on: number; all: number } {
  return { on: stats.filter((filter) => !filter.disabled).length, all: stats.length };
}

/**
 * APT's corrupted filter has three meanings: `value: false` = not corrupted, `value: true` with
 * `exact` = corrupted only, `value: true` without = any (no filter sent).
 */
export function corruptedState(filters: ItemFilters): CorruptedState | null {
  const corrupted = filters.corrupted;
  if (!corrupted) return null;
  if (!corrupted.value) return 'not';
  return corrupted.exact ? 'only' : 'any';
}

export function setCorrupted(filters: ItemFilters, state: CorruptedState): void {
  if (!filters.corrupted) return;
  filters.corrupted.value = state !== 'not';
  filters.corrupted.exact = state === 'only';
}

/** The header's base switch: the whole category or this exact base (APT `FilterName.vue`). */
export function baseSwitch(filters: ItemFilters): { category: string; base: string; exact: boolean } | null {
  const relaxed = filters.searchRelaxed;
  if (!relaxed) return null;
  const base = filters.searchExact.baseType ?? filters.searchExact.name ?? tr('This base');
  // The category is game data and stays as the trade site names it; EE2 files waystones under Map.
  const category = relaxed.category ? (CATEGORY_NAMES[relaxed.category] ?? relaxed.category) : undefined;
  return { category: category ? tr('Any {0}', category) : tr('Any'), base, exact: relaxed.disabled };
}

export function setExactBase(filters: ItemFilters, exact: boolean): void {
  if (filters.searchRelaxed) filters.searchRelaxed.disabled = exact;
}

type TradeOptions = ItemFilters['trade'];
export type TradeApi = 'trade' | 'bulk';

/** The listing types offered for a search on the trade site or on the bulk exchange (EE2 `OnlineFilter.vue`). */
export function listingTypes(api: TradeApi): ReadonlyArray<{ value: string; label: string; summary: string; hint: string }> {
  return api === 'bulk' ? BULK_LISTING_TYPES : LISTING_TYPES;
}

/**
 * Keeps a listing type the API takes, as EE2 does: the bulk exchange has no instant buyout (EE2
 * switches to "online"), the item search has no "online in league" (back to the default).
 */
export function fitListingType(trade: TradeOptions, api: TradeApi, preferred: ListingType): void {
  if (api === 'bulk' && (trade.listingType === 'securable' || trade.listingType === 'available')) {
    trade.listingType = 'online';
  } else if (api === 'trade' && trade.listingType === 'onlineleague') {
    trade.listingType = preferred;
  }
}

/** "instant buyout · Exalted Orb": the summary line of the trade options. */
export function tradeOptionsSummary(trade: TradeOptions, api: TradeApi, currencyLabel?: string): string {
  const type = listingTypes(api).find((option) => option.value === trade.listingType);
  const parts = [tr(type?.summary ?? trade.listingType)];
  if (api === 'trade' && trade.currency && currencyLabel) parts.push(currencyLabel);
  return parts.join(' · ');
}

/**
 * EE2's rarity filter ("nonunique", "magic", "normal") has no off state: `createTradeRequest` sends
 * whatever is there, and EE2's own UI only shows it (FINDINGS F-10). The "Not unique" switch keeps
 * its own flag on the filter object (APT's shape, so it survives the copy into the Mods preset),
 * and the search leaves the rarity out while the switch is off.
 */
export type RarityFilter = NonNullable<ItemFilters['rarity']> & { disabled?: boolean };

/** The filters a search sends: EE2's, minus what our own switches turned off. */
export function requestFilters(filters: ItemFilters): ItemFilters {
  return (filters.rarity as RarityFilter | undefined)?.disabled ? { ...filters, rarity: undefined } : filters;
}
