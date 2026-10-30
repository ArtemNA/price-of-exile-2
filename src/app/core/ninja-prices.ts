// poe.ninja PoE2 prices: the official API's overviews (docs/analysis/poe2-services.md §3) in one
// index, and how EE2 `background/Prices.ts`, `trends/PriceTrend.vue`, `related-items/RelatedItems.vue`
// and `stack-value/StackValue.vue` read it. EE2 takes one blob from its author's proxy and searches
// the raw text; here each overview is parsed and indexed by `ns::name // variant`, the id format of
// `item-drop.json`, so related items take their prices from the same index (as the PoE1 app, F-33).

import { BaseType, ITEM_BY_REF, ITEM_DROP } from '@/assets/data';
import type { ParsedItem } from '@/parser';
import { getDetailsId, isValuableBasetype } from '../../lib/ee2/web/price-check/trends/getDetailsId';
import {
  CURRENCY_ABBREVIATIONS,
  DIVINE_FRACTIONS,
  NINJA_DIVINE_ROUNDING,
  POE_NINJA_GEM_TYPES,
  POE_NINJA_ITEM_ROUTES,
  POE_NINJA_MIN_LISTINGS,
  POE_NINJA_MIN_TRADED_PER_HOUR,
  POE_NINJA_SITE,
  POE_NINJA_TYPES,
  POE_NINJA_UNIQUE_ROUTES,
  SMALL_CURRENCIES,
} from '../constants';

// --- The API's answers -------------------------------------------------------------------------

interface NinjaSparkline {
  totalChange: number;
  data: Array<number | null>;
}

/** `core` of every answer: prices are in `primary` (divine); `rates` are per one divine. */
export interface NinjaCore {
  primary: string;
  secondary: string;
  rates: Record<string, number>;
}

/** `/poe2/api/economy/exchange/current/overview`: names only in `items[]`, linked by `id`. */
export interface NinjaExchangeOverview {
  core: NinjaCore;
  lines: Array<{
    id: string;
    primaryValue: number;
    volumePrimaryValue?: number;
    maxVolumeCurrency?: string;
    maxVolumeRate?: number;
    sparkline?: NinjaSparkline;
  }>;
  items: Array<{ id: string; name: string; image?: string; category?: string; detailsId: string }>;
}

/** `/poe2/api/economy/stash/current/item/overview` (uniques): note `sparkLine`, not `sparkline`. */
export interface NinjaStashOverview {
  core: NinjaCore;
  lines: Array<{
    name: string;
    baseType?: string;
    variant?: string;
    detailsId: string;
    primaryValue: number;
    listingCount?: number;
    corrupted?: boolean;
    sparkLine?: NinjaSparkline;
  }>;
}

/** Small currencies per divine: `{ exalted: 711, chaos: 10.14 }`. */
export interface NinjaRates {
  exalted: number;
  chaos: number;
}

export function ratesFromCore(core: NinjaCore | undefined): NinjaRates | null {
  const exalted = core?.rates?.['exalted'] ?? 0;
  const chaos = core?.rates?.['chaos'] ?? 0;
  return core?.primary === 'divine' && exalted > 0 && chaos > 0 ? { exalted, chaos } : null;
}

/** One priced item of an overview, the same shape for both APIs. */
export interface NinjaPrice {
  /** Overview type ("Currency", "UniqueAccessories"). */
  type: string;
  ns: string;
  name: string;
  variant?: string;
  /** In divines. */
  primaryValue: number;
  detailsId: string;
  sparkline: NinjaSparkline;
  /** Exchange: divines traded per hour. */
  volumePrimaryValue?: number;
  /** Stash: listings the price comes from. */
  listingCount?: number;
  /** Stash: a separate line for corrupted copies. */
  corrupted?: boolean;
}

/** The lines worth showing: lines with too few listings or trades are outliers more often than not. */
export function pricesFromOverview(type: string, data: NinjaExchangeOverview | NinjaStashOverview): NinjaPrice[] {
  const known = POE_NINJA_TYPES[type];
  if (!known) return [];
  const empty: NinjaSparkline = { totalChange: 0, data: [] };
  if (known.api === 'exchange') {
    const items = new Map(((data as NinjaExchangeOverview).items ?? []).map((item) => [item.id, item]));
    return (data as NinjaExchangeOverview).lines.flatMap((line) => {
      const item = items.get(line.id);
      if (!item || !(line.primaryValue > 0)) return [];
      const tradedPerHour = (line.volumePrimaryValue ?? 0) / line.primaryValue;
      if (tradedPerHour < POE_NINJA_MIN_TRADED_PER_HOUR) return [];
      return [{
        type,
        ns: known.ns,
        name: item.name,
        primaryValue: line.primaryValue,
        detailsId: item.detailsId,
        sparkline: line.sparkline ?? empty,
        volumePrimaryValue: line.volumePrimaryValue,
      }];
    });
  }
  return (data as NinjaStashOverview).lines.flatMap((line) => {
    if (!(line.primaryValue > 0) || (line.listingCount ?? 0) < POE_NINJA_MIN_LISTINGS) return [];
    return [{
      type,
      ns: known.ns,
      name: line.name,
      variant: line.variant ?? line.baseType,
      primaryValue: line.primaryValue,
      detailsId: line.detailsId,
      sparkline: line.sparkLine ?? empty,
      listingCount: line.listingCount,
      corrupted: line.corrupted,
    }];
  });
}

// --- The index ---------------------------------------------------------------------------------

export interface DetailsQuery {
  ns: string;
  name: string;
  variant?: string;
}

/** Prices by `ns::name // variant` (the id format of EE2 `item-drop.json`). */
export type PriceDb = ReadonlyMap<string, NinjaPrice>;

export function queryId(query: DetailsQuery): string {
  return `${query.ns}::${query.name}${query.variant ? ` // ${query.variant}` : ''}`;
}

/**
 * One index over the loaded overviews. Uniques are also found by name alone: EE2 names flasks
 * without a base and relics as "Relic". The first line of a name wins, a corrupted one only
 * when there is no other (poe.ninja lists corrupted copies of some uniques separately).
 */
export function buildPriceDb(overviews: Iterable<NinjaPrice[]>): PriceDb {
  const db = new Map<string, NinjaPrice>();
  const put = (key: string, price: NinjaPrice) => {
    const taken = db.get(key);
    if (!taken || (taken.corrupted && !price.corrupted)) db.set(key, price);
  };
  for (const prices of overviews) {
    for (const price of prices) {
      put(queryId(price), price);
      if (price.ns === 'UNIQUE' && price.variant) put(queryId({ ns: price.ns, name: price.name }), price);
    }
  }
  return db;
}

export function lookupPrice(db: PriceDb, query: DetailsQuery): NinjaPrice | undefined {
  return db.get(queryId(query)) ?? (query.ns === 'UNIQUE' ? db.get(queryId({ ns: query.ns, name: query.name })) : undefined);
}

/**
 * Overview types that may list the item, most likely first ([] when poe.ninja has none: rares,
 * bases, waystones, skill gems). Decided from the game data, so related items route too.
 */
export function ninjaTypesFor(query: DetailsQuery): string[] {
  const found = ITEM_BY_REF(query.ns as BaseType['namespace'], query.name);
  if (query.ns === 'UNIQUE') {
    const unique = (query.variant && found?.find((item) => item.unique?.base === query.variant)) || found?.[0];
    const base = unique?.unique?.base ? ITEM_BY_REF('ITEM', unique.unique.base)?.[0] : undefined;
    const category = base?.craftable?.category;
    return (category && POE_NINJA_UNIQUE_ROUTES.find((route) => route.categories.includes(category))?.types) || [];
  }
  const item = found?.find((entry) => entry.tradeTag) ?? found?.[0];
  if (!item?.tradeTag) return [];
  if (query.ns === 'GEM') return POE_NINJA_GEM_TYPES;
  if (query.ns !== 'ITEM') return [];
  const category = item.craftable?.category;
  const route = POE_NINJA_ITEM_ROUTES.find(
    (rule) => (!rule.category || rule.category === category) && (!rule.name || rule.name.test(query.name)),
  );
  return route?.types ?? [];
}

/** poe.ninja's league slug (EE2 `selectedLeagueToUrl`): "Forbidden Rites" → "forbiddenrites", "HC …" → "…hc". */
export function ninjaLeagueSlug(leagueId: string): string {
  switch (leagueId) {
    case 'Standard':
      return 'standard';
    case 'Hardcore':
      return 'hardcore';
  }
  const slug = leagueId.toLowerCase().replaceAll(' ', '');
  return slug.startsWith('hc') ? `${slug.slice(2)}hc` : slug;
}

export function ninjaUrl(price: NinjaPrice, leagueId: string): string {
  return `${POE_NINJA_SITE}/${ninjaLeagueSlug(leagueId)}/${POE_NINJA_TYPES[price.type].url}/${price.detailsId}`;
}

// --- Currencies --------------------------------------------------------------------------------

export type SmallCurrency = (typeof SMALL_CURRENCIES)[number];

export interface CurrencyValue {
  min: number;
  max: number;
  currency: 'chaos' | 'exalted' | 'div';
}

/**
 * Divines as EE2 shows them (`autoCurrency`): from about one divine up in divines (exactly 1 within
 * ±6 %), below that in `small` (exalted unless said otherwise). `noDiv`: always in `small` (the Divine
 * Orb itself).
 */
export function autoCurrency(
  div: number | [number, number],
  rates: NinjaRates,
  small: SmallCurrency = SMALL_CURRENCIES[0],
  noDiv = false,
): CurrencyValue {
  const [min, max] = Array.isArray(div) ? div : [div, div];
  if (!noDiv) {
    if (Array.isArray(div)) {
      if (max > 1 - NINJA_DIVINE_ROUNDING) return { min, max, currency: 'div' };
    } else if (div > 1 - NINJA_DIVINE_ROUNDING) {
      return div < 1 + NINJA_DIVINE_ROUNDING ? { min: 1, max: 1, currency: 'div' } : { min, max, currency: 'div' };
    }
  }
  return { min: min * rates[small], max: max * rates[small], currency: small };
}

/** The currency a stackable is shown in: exalted, chaos for the Exalted Orb itself. */
export function smallCurrencyFor(refName: string): SmallCurrency {
  return refName === 'Exalted Orb' ? 'chaos' : 'exalted';
}

/**
 * Short amounts: two significant digits below 1 ("0.24", "0.014"), one decimal below 10 ("3.8"),
 * whole numbers above ("343").
 */
export function formatAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs < 1) return String(Number(value.toPrecision(2)));
  if (abs < 10) return String(Math.round(value * 10) / 10);
  return String(Math.round(value));
}

/** Price as shown: "4 ex", "1.2 div", "0.2 c", "2 – 3 div" (ranges). */
export function formatValue(value: CurrencyValue | null | undefined): string {
  if (!value) return '?';
  const unit = CURRENCY_ABBREVIATIONS[value.currency] ?? value.currency;
  const min = formatAmount(value.min);
  const max = formatAmount(value.max);
  return min === max ? `${min} ${unit}` : `${min} – ${max} ${unit}`;
}

/** Trade site currency id of a value ("div" → "divine"), for its icon. */
export function currencyTag(currency: CurrencyValue['currency']): string {
  return currency === 'div' ? 'divine' : currency;
}

/** Divines in each small currency: what goes next to a price shown in another one. */
export function inSmallCurrencies(div: number, rates: NinjaRates): Array<{ amount: number; currency: SmallCurrency }> {
  return SMALL_CURRENCIES.map((currency) => ({ amount: div * rates[currency], currency }));
}

/**
 * How a price of the item `refName` is shown: in divines or its small currency (`autoCurrency`),
 * plus the other small currencies, leaving out the item's own currency (no "1 c" for a Chaos Orb).
 */
export function priceOf(
  div: number,
  rates: NinjaRates,
  refName: string,
): { value: CurrencyValue; also: Array<{ amount: number; currency: SmallCurrency }> } {
  const value = autoCurrency(div, rates, smallCurrencyFor(refName), refName === 'Divine Orb');
  const own = ITEM_BY_REF('ITEM', refName)?.find((item) => item.tradeTag)?.tradeTag;
  const also = inSmallCurrencies(div, rates).filter((entry) => entry.currency !== value.currency && entry.currency !== own);
  return { value, also };
}

/** "0.1 div = 71 ex · 1 c" rows for the title bar tooltip. */
export function divineFractions(rates: NinjaRates): Array<{ divine: number; exalted: number; chaos: number }> {
  return DIVINE_FRACTIONS.map((divine) => ({ divine, exalted: divine * rates.exalted, chaos: divine * rates.chaos }));
}

/** Signed percent: "+59 %", "−9.2 %", "±0 %". */
export function formatPercent(value: number): string {
  const rounded = Math.abs(value) < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : '±'}${Math.abs(rounded)} %`;
}

// --- Trend ---------------------------------------------------------------------------------------

export interface PriceTrend {
  /** poe.ninja's price change in percent against 7 days ago, per day (oldest first, gaps kept). */
  graph: Array<number | null>;
  /** Change over the week: the latest known point (poe.ninja's `totalChange`). */
  change: number;
}

/**
 * The week's change from poe.ninja's graph. EE2 (`deltaFromGraph`) reads the points as daily
 * changes, but they are cumulative against 7 days ago and the last one is `totalChange` (F-34 of
 * the PoE1 app, the same in PoE2), so the last known point is the change.
 */
export function priceTrend(graph: Array<number | null>): PriceTrend | null {
  const points = graph.filter((p): p is number => p != null);
  if (points.length < 2) return null;
  return { graph, change: points[points.length - 1] };
}

/** SVG path data for a sparkline of the trend in a `width` × `height` box (y grows down). */
export function sparkline(graph: Array<number | null>, width: number, height: number): { line: string; area: string; zeroY: number } {
  const known = graph.map((value, i) => ({ value, i })).filter((p): p is { value: number; i: number } => p.value != null);
  const values = [0, ...known.map((p) => p.value)];
  const min = Math.min(...values);
  const span = Math.max(...values) - min;
  const x = (i: number) => (graph.length > 1 ? (i / (graph.length - 1)) * width : 0);
  // A flat week (all 0) runs through the middle rather than along the bottom edge.
  const y = (value: number) => (span ? height - ((value - min) / span) * height : height / 2);
  const round = (n: number) => Math.round(n * 10) / 10;
  const coords = known.map((p) => `${round(x(p.i))},${round(y(p.value))}`);
  const line = coords.length ? `M${coords.join(' L')}` : '';
  const area = coords.length
    ? `${line} L${round(x(known[known.length - 1].i))},${height} L${round(x(known[0].i))},${height} Z`
    : '';
  return { line, area, zeroY: round(y(0)) };
}

// --- What the windows show -----------------------------------------------------------------------

/** What the price check and item check show about an item's poe.ninja price. */
export interface ItemQuote {
  query: DetailsQuery;
  /** Types that may list the item, most likely first. */
  types: string[];
  /** Undefined: poe.ninja has no line for the item (yet: see `pending`). */
  price: NinjaPrice | undefined;
  /** A type that may list it is still loading. */
  pending: boolean;
  /** The matched poe.ninja line, e.g. "Mageblood, Utility Belt". */
  label: string;
  url: string | undefined;
  trend: PriceTrend | null;
  /** In divines from about one divine up, below that in exalted (the Exalted Orb: chaos). */
  value: CurrencyValue | null;
  /** The same price in the small currencies `value` is not in (not the item's own currency). */
  also: Array<{ amount: number; currency: SmallCurrency }>;
  /** Items traded per hour (exchange) or listings (uniques). */
  traded: { perHour: number } | { listings: number } | null;
  /** Rares and magic bases are priced by base type only. */
  baseOnly: boolean;
}

/** Which state the loader is in for each type: what `itemQuote` needs to tell "loading" from "no price". */
export type TypeStates = ReadonlyMap<string, 'loading' | 'loaded' | 'error'>;

/** Null when poe.ninja has no prices for this kind of item at all. */
export function itemQuote(
  db: PriceDb,
  states: TypeStates,
  rates: NinjaRates | null,
  item: ParsedItem,
  leagueId: string | undefined,
): ItemQuote | null {
  const query = getDetailsId(item);
  if (!query) return null;
  const types = ninjaTypesFor(query);
  if (!types.length) return null;
  const found = lookupPrice(db, query);
  const price = found && types.includes(found.type) ? found : undefined;
  const own = item.info.refName;
  const shown = price && rates ? priceOf(price.primaryValue, rates, own) : null;
  return {
    query,
    types,
    price,
    pending: !price && types.some((type) => states.get(type) !== 'loaded' && states.get(type) !== 'error'),
    label: [query.name, query.variant].filter(Boolean).join(', '),
    url: price && leagueId ? ninjaUrl(price, leagueId) : undefined,
    trend: price ? priceTrend(price.sparkline.data) : null,
    value: shown?.value ?? null,
    also: shown?.also ?? [],
    traded: !price
      ? null
      : price.listingCount != null
        ? { listings: price.listingCount }
        : price.volumePrimaryValue != null
          ? { perHour: price.volumePrimaryValue / price.primaryValue }
          : null,
    baseOnly: isValuableBasetype(item),
  };
}

export interface RelatedEntry {
  id: string;
  name: string;
  icon: string;
  /** In divines. */
  div: number | undefined;
  /** The checked item itself in its group. */
  highlight: boolean;
}

export type RelatedItems = { error: string } | { related: RelatedEntry[]; items: RelatedEntry[] };

function findItemById(id: string): BaseType | undefined {
  const [ns, encodedName] = id.split('::');
  const [name, variant] = encodedName.split(' // ');
  let found = ITEM_BY_REF(ns as BaseType['namespace'], name);
  if (found && ns === 'UNIQUE') {
    const filtered = found.filter((unique) => unique.unique!.base === variant);
    if (filtered.length) found = filtered;
  }
  return found?.[0];
}

/** `ns::name // variant` back into a query. */
export function parseQueryId(id: string): DetailsQuery {
  const [ns, encodedName] = id.split('::');
  const [name, variant] = encodedName.split(' // ');
  return { ns, name, variant };
}

/** The `item-drop.json` group of an item id, if any. */
function dropEntry(id: string) {
  // EE2 ids name uniques by base; match by name too, like the PoE1 app (F-54 there).
  const name = `${id.split(' // ')[0]} // `;
  const same = (itemId: string) => itemId === id || itemId.startsWith(name);
  const drop = ITEM_DROP.find((entry) => entry.query.includes(id)) ?? ITEM_DROP.find((entry) => entry.query.some(same));
  return drop ? { drop, same } : null;
}

/** Ids of the items related to `id` (its set and what the set drops), to load their prices. */
export function relatedIds(id: string): string[] {
  const found = dropEntry(id);
  return found ? [...found.drop.query, ...found.drop.items] : [];
}

/**
 * EE2 `RelatedItems`: for fragments, keys, splinters… the set the item belongs to (`related`)
 * and what that set drops or turns into (`items`), with poe.ninja prices.
 */
export function relatedItems(id: string, db: PriceDb): RelatedItems | null {
  const found = dropEntry(id);
  if (!found) return null;
  const { drop, same } = found;

  const entry = (itemId: string): RelatedEntry | string => {
    const item = findItemById(itemId);
    if (!item) return `Can't find "${itemId}".`;
    const price = lookupPrice(db, parseQueryId(itemId));
    return { id: itemId, name: item.name, icon: item.icon, div: price?.primaryValue, highlight: same(itemId) };
  };
  const related: RelatedEntry[] = [];
  const items: RelatedEntry[] = [];
  for (const [ids, out] of [[drop.query, related], [drop.items, items]] as const) {
    for (const itemId of ids) {
      const result = entry(itemId);
      if (typeof result === 'string') return { error: result };
      out.push(result);
    }
  }
  return { related, items };
}

/** Item ids whose prices a check of `item` shows: the item and its related items. */
export function idsToPrice(item: ParsedItem): string[] {
  const query = getDetailsId(item);
  if (!query) return [];
  const id = queryId(query);
  return [id, ...relatedIds(id)];
}
