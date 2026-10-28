// poe.ninja item prices: port of APT `background/Prices.ts` (lookup, currency display),
// `trends/PriceTrend.vue` (7 day change, read differently: see `priceTrend`) and `related-items/RelatedItems.vue`.
// APT searches the raw JSON text by key order; here the parsed overviews are indexed instead.

import { BaseType, ITEM_BY_REF, ITEM_DROP } from '@/assets/data';
import type { ParsedItem } from '@/parser';
import { getDetailsId, isValuableBasetype } from '../../lib/apt/web/price-check/trends/getDetailsId';
import { NINJA_DIVINE_ROUNDING, POE_NINJA_NAMESPACES, POE_NINJA_SITE } from '../constants';

export interface NinjaLine {
  name: string;
  variant?: string;
  chaos: number;
  /** Daily change in percent over the last 7 days, oldest first; null where nothing traded. */
  graph: Array<number | null>;
}

export interface NinjaOverview {
  type: string;
  lines: NinjaLine[];
}

export interface NinjaOverviews {
  currencyOverviews: NinjaOverview[];
  itemOverviews?: NinjaOverview[];
}

export interface DetailsQuery {
  ns: string;
  name: string;
  variant: string | undefined;
}

export interface NinjaPrice extends NinjaLine {
  /** Overview URL segment, e.g. "unique-armours". */
  page: string;
}

/** Prices by `ns::name // variant` (the id format of APT `item-drop.json`). */
export type PriceDb = ReadonlyMap<string, NinjaPrice>;

export function queryId(query: DetailsQuery): string {
  return `${query.ns}::${query.name}${query.variant ? ` // ${query.variant}` : ''}`;
}

export function priceDbFromNinja(data: NinjaOverviews): PriceDb {
  const db = new Map<string, NinjaPrice>();
  for (const overview of [...data.currencyOverviews, ...(data.itemOverviews ?? [])]) {
    const known = POE_NINJA_NAMESPACES.find((entry) => entry.type === overview.type);
    if (!known) continue;
    for (const line of overview.lines) {
      const id = queryId({ ns: known.ns, name: line.name, variant: line.variant });
      if (!db.has(id)) db.set(id, { ...line, page: known.url });
    }
  }
  return db;
}

/** poe.ninja's league slug: "Standard" → "standard", "Hardcore Settlers" → "settlershc". */
export function ninjaLeagueSlug(leagueId: string): string {
  switch (leagueId) {
    case 'Standard':
      return 'standard';
    case 'Hardcore':
      return 'hardcore';
    default: {
      const slug = leagueId.replace('Hardcore ', '').toLowerCase();
      return leagueId.startsWith('Hardcore ') ? `${slug}hc` : slug;
    }
  }
}

function detailsSlug(price: NinjaLine): string {
  return (price.variant ? `${price.name}, ${price.variant}` : price.name)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9:\- ]/g, '')
    .toLowerCase()
    .replace(/ /g, '-');
}

export function ninjaUrl(price: NinjaPrice, leagueId: string): string {
  return `${POE_NINJA_SITE}/${ninjaLeagueSlug(leagueId)}/${price.page}/${detailsSlug(price)}`;
}

/** The poe.ninja entry for a checked item: variant by links, gem level, item level, map tier… */
export function findItemPrice(db: PriceDb, item: ParsedItem): { query: DetailsQuery; price: NinjaPrice | undefined } | null {
  const query = getDetailsId(item);
  if (!query) return null;
  return { query, price: db.get(queryId(query)) };
}

export interface CurrencyValue {
  min: number;
  max: number;
  currency: 'chaos' | 'div';
}

/** Chaos amount shown as chaos or divines, like APT (`autoCurrency`). */
export function autoCurrency(value: number | [number, number], divine: number | undefined): CurrencyValue {
  const rate = divine || 9999;
  if (Array.isArray(value)) {
    if (value[1] > rate) return { min: value[0] / rate, max: value[1] / rate, currency: 'div' };
    return { min: value[0], max: value[1], currency: 'chaos' };
  }
  if (value > rate * (1 - NINJA_DIVINE_ROUNDING)) {
    if (value < rate * (1 + NINJA_DIVINE_ROUNDING)) return { min: 1, max: 1, currency: 'div' };
    return { min: value / rate, max: value / rate, currency: 'div' };
  }
  return { min: value, max: value, currency: 'chaos' };
}

/** APT `displayRounding`: "4.5", "37", "1 / 12" for fractions of stackables. */
export function displayRounding(value: number, fraction = false): string {
  if (fraction && Math.abs(value) < 1) {
    if (value === 0) return '0';
    const r = `1 / ${displayRounding(1 / value)}`;
    return r === '1 / 1' ? '1' : r;
  }
  if (Math.abs(value) < 10) return Number(value.toFixed(1)).toString();
  return Math.round(value).toString();
}

/** Price as shown: "4 c", "1.2 div", "1 / 4 c" (fractions), "2 – 3 div" (ranges). */
export function formatValue(value: CurrencyValue | null | undefined, fraction = false): string {
  if (!value) return '?';
  const unit = value.currency === 'div' ? 'div' : 'c';
  const min = displayRounding(value.min, fraction);
  const max = displayRounding(value.max, fraction);
  return min === max ? `${min} ${unit}` : `${min} – ${max} ${unit}`;
}

/** Signed percent: "+59 %", "−9.2 %", "±0 %". */
export function formatPercent(value: number): string {
  const rounded = Math.abs(value) < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : '±'}${Math.abs(rounded)} %`;
}

export interface PriceTrend {
  /** poe.ninja's price change in percent against 7 days ago, per day (oldest first, gaps kept). */
  graph: Array<number | null>;
  /** Change over the week: the latest known point. */
  change: number;
}

/**
 * The week's change from poe.ninja's graph. APT (`deltaFromGraph`) reads the points as daily
 * changes and shows their spread with an up/down forecast, but they are cumulative against
 * 7 days ago (the first point is always near 0), so the last point is the change (F-34).
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

/** What the price check and item check show about an item's poe.ninja price. */
export interface ItemQuote {
  query: DetailsQuery;
  /** Undefined: poe.ninja has no line for the item. */
  price: NinjaPrice | undefined;
  /** The matched poe.ninja line, e.g. "Tabula Rasa, Simple Robe, 6L". */
  label: string;
  url: string | undefined;
  trend: PriceTrend | null;
  /** Chaos, or divines from about one divine up (Divine Orb itself in chaos, like APT). */
  value: CurrencyValue | null;
  /** Rares and magic bases are priced by base type only. */
  baseOnly: boolean;
}

/** Null when the item has no poe.ninja id at all. */
export function itemQuote(db: PriceDb, item: ParsedItem, leagueId: string | undefined, divine: number | undefined): ItemQuote | null {
  const found = findItemPrice(db, item);
  if (!found) return null;
  const { query, price } = found;
  return {
    query,
    price,
    label: [query.name, query.variant].filter(Boolean).join(', '),
    url: price && leagueId ? ninjaUrl(price, leagueId) : undefined,
    trend: price ? priceTrend(price.graph) : null,
    value: !price
      ? null
      : item.info.refName === 'Divine Orb'
        ? { min: price.chaos, max: price.chaos, currency: 'chaos' }
        : autoCurrency(price.chaos, divine),
    baseOnly: isValuableBasetype(item),
  };
}

export interface RelatedEntry {
  name: string;
  icon: string;
  chaos: number | undefined;
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

/**
 * APT `RelatedItems`: for fragments, splinters, divination cards… the set the item belongs to
 * (`related`) and what that set drops or turns into (`items`), with poe.ninja prices.
 */
export function relatedItems(id: string, db: PriceDb): RelatedItems | null {
  // poe.ninja names a variant by links ("Farrul's Fur // 6L"), the sets by base: match by name then.
  const name = `${id.split(' // ')[0]} // `;
  const same = (itemId: string) => itemId === id || itemId.startsWith(name);
  const drop = ITEM_DROP.find((entry) => entry.query.includes(id)) ?? ITEM_DROP.find((entry) => entry.query.some(same));
  if (!drop) return null;

  const entry = (itemId: string): RelatedEntry | string => {
    const item = findItemById(itemId);
    if (!item) return `Can't find "${itemId}".`;
    return { name: item.name, icon: item.icon, chaos: db.get(itemId)?.chaos, highlight: same(itemId) };
  };
  const related: RelatedEntry[] = [];
  const items: RelatedEntry[] = [];
  for (const [ids, out] of [[drop.query, related], [drop.items, items]] as const) {
    for (const itemId of ids) {
      const found = entry(itemId);
      if (typeof found === 'string') return { error: found };
      out.push(found);
    }
  }
  return { related, items };
}
