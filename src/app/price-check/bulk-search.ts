// Bulk exchange search. Port of EE2 `bulk-api.ts` / TradeBulk.vue and APT `useMarketRatioFinder`
// (MIT © 2020 Alexander Drozdov and EE2 contributors) on Angular signals, plus bait detection
// (reference FINDINGS F-26, F-30). An offer is "pay `exchangeAmount` of the currency → get
// `itemAmount` items" (the offer's trade2 `exchange` and `item`); prices are compared in divines
// at the poe.ninja rates.

import { computed, signal } from '@angular/core';
import type { ParsedItem } from '@/parser';
import type { ItemFilters } from '../../lib/ee2/web/price-check/filters/interfaces';
import { getTradeEndpoint } from '../../lib/ee2/web/price-check/trade/common';
import {
  type BulkSearch as Ee2BulkSearch,
  createTradeRequest,
  execBulkSearch,
  type PricingResult,
} from '../../lib/ee2/web/price-check/trade/pathofexile-bulk';
import { BULK_BAIT_RATIO } from '../constants';
import { formatValue, type NinjaRates, priceOf } from '../core/ninja-prices';
import { settings } from '../core/settings';

export type BulkHave = 'exalted' | 'divine' | 'chaos';

/** poe.ninja prices the bulk tab works with. */
export interface BulkPrices {
  /** Price of one item being priced, in divines. */
  div?: number;
  /** Exalted and chaos per divine. */
  rates?: NinjaRates | null;
}

export interface BulkRow extends PricingResult {
  /** Price of one item in divines, at the poe.ninja rate of the currency paid. */
  divPerItem?: number;
  /** Far below the poe.ninja price: almost certainly a bait listing. */
  isBait: boolean;
}

/** poe.ninja's price as a pseudo-offer, placed among the listings like APT's "Market Ratio" row. */
export interface MarketRatio {
  exchangeAmount: number;
  itemAmount: number;
}

/**
 * Currencies to pay with: EE2's set, exalted, divine and chaos. EE2 override: at league start many
 * players misprice these among themselves, which breaks the combined search, so each of them is
 * bought only with the other two (an Exalted Orb is never paid for with exalted).
 */
export function bulkHaves(item: ParsedItem): BulkHave[] {
  switch (item.info.refName) {
    case 'Exalted Orb':
      return ['divine', 'chaos'];
    case 'Chaos Orb':
      return ['exalted', 'divine'];
    case 'Divine Orb':
      return ['exalted', 'chaos'];
    default:
      return ['exalted', 'divine', 'chaos'];
  }
}

/** Divines per one unit of the currency paid. */
function divinesPer(have: BulkHave, rates: NinjaRates | null | undefined): number | undefined {
  if (have === 'divine') return 1;
  return rates ? 1 / rates[have] : undefined;
}

export function priceOffers(rows: PricingResult[], have: BulkHave, prices: BulkPrices): BulkRow[] {
  const rate = divinesPer(have, prices.rates);
  return rows.map((row) => {
    const divPerItem = rate != null ? (row.exchangeAmount / row.itemAmount) * rate : undefined;
    const isBait = divPerItem != null && prices.div != null && divPerItem < prices.div * BULK_BAIT_RATIO;
    return { ...row, divPerItem, isBait };
  });
}

/** The cheapest offer that is not bait. */
export function bestOffer(rows: BulkRow[]): BulkRow | undefined {
  return rows.find((row) => !row.isBait);
}

/**
 * Port of APT `useMarketRatioFinder`: a round "pay → get" pair close to the poe.ninja price.
 * Exalted and chaos work as APT's chaos (none for an item worth a divine or more), divine as APT's.
 */
export function marketRatio(have: BulkHave, prices: BulkPrices): MarketRatio | undefined {
  const rate = divinesPer(have, prices.rates);
  const div = prices.div;
  if (rate == null || div == null || div <= 0) return undefined;
  if (have === 'divine') {
    if (div > 0.94) return { exchangeAmount: div, itemAmount: 1 };
    const price = div > 0.2 ? 2 : 1;
    return { exchangeAmount: price, itemAmount: price / div };
  }
  if (div >= 1.06) return undefined;
  const perItem = div / rate;
  if (perItem > 4) return { exchangeAmount: perItem, itemAmount: 1 };
  const price = perItem > 1 ? 20 : 10;
  return { exchangeAmount: price, itemAmount: price / perItem };
}

/**
 * Which currency to show first. With poe.ninja rates: the one with the cheapest real offer (on the
 * trade site most divine offers for cheap items are "1 div → 1" placeholders, so EE2's "more
 * offers" picks the wrong one). Exalted left out of a crowded combined search is shown, and so
 * loaded, for items worth under a divine. Without rates: the one with more offers, as EE2.
 */
export function pickHave(
  haves: BulkHave[],
  results: Partial<Record<BulkHave, Ee2BulkSearch | null>>,
  prices: BulkPrices,
): BulkHave {
  if (haves.includes('exalted') && results.exalted === null && (prices.div == null || prices.div < 1)) return 'exalted';
  const loaded = haves.filter((have) => results[have]);
  const cheapest = loaded
    .map((have) => ({ have, div: bestOffer(priceOffers(results[have]!.listed, have, prices))?.divPerItem }))
    .filter((entry): entry is { have: BulkHave; div: number } => entry.div != null)
    .sort((a, b) => a.div - b.div);
  if (cheapest.length) return cheapest[0].have;
  const byTotal = [...loaded].sort((a, b) => results[b]!.total - results[a]!.total);
  return byTotal[0] ?? haves[0];
}

export class BulkSearch {
  readonly error = signal<string | null>(null);
  readonly isSearching = signal(false);
  /** Per currency: undefined = not searched, null = to load on demand (EE2 `loadedOnDemand`). */
  readonly results = signal<Partial<Record<BulkHave, Ee2BulkSearch | null>>>({});
  readonly selected = signal<BulkHave>('exalted');
  readonly haves = signal<BulkHave[]>([]);
  private searchId = 0;
  private item?: ParsedItem;
  private filters?: ItemFilters;

  /** @param prices poe.ninja prices when the search ends, to pick the currency to show. */
  constructor(private readonly prices: () => BulkPrices = () => ({})) {}

  readonly current = computed(() => this.results()[this.selected()] ?? null);

  reset(): void {
    this.searchId += 1;
    this.error.set(null);
    this.results.set({});
    this.haves.set([]);
    this.isSearching.set(false);
  }

  /** Optimistic search (EE2): one request with all currencies, split by the currency paid. */
  async search(item: ParsedItem, filters: ItemFilters): Promise<void> {
    this.reset();
    this.item = item;
    this.filters = filters;
    const searchId = this.searchId;
    const have = bulkHaves(item);
    this.haves.set(have);
    this.isSearching.set(true);
    try {
      const found = await execBulkSearch(item, filters, have, { accountName: settings().accountName });
      if (searchId !== this.searchId) return;
      const results: Partial<Record<BulkHave, Ee2BulkSearch | null>> = {};
      have.forEach((tag, i) => (results[tag] = found[i]));
      this.results.set(results);
      this.selected.set(pickHave(have, results, this.prices()));
      if (this.results()[this.selected()] === null) await this.loadOnDemand(this.selected());
    } catch (e) {
      if (searchId === this.searchId) this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      if (searchId === this.searchId) this.isSearching.set(false);
    }
  }

  async select(have: BulkHave): Promise<void> {
    this.selected.set(have);
    if (this.results()[have] === null) await this.loadOnDemand(have);
  }

  private async loadOnDemand(have: BulkHave): Promise<void> {
    if (!this.item || !this.filters) return;
    const searchId = this.searchId;
    this.isSearching.set(true);
    try {
      const [found] = await execBulkSearch(this.item, this.filters, [have], { accountName: settings().accountName });
      if (searchId !== this.searchId || !found) return;
      this.results.update((results) => {
        // Fix the total EE2 guessed in the combined search (EE2 `getResultsByHave`).
        const other = have === 'divine' ? results.exalted : results.divine;
        if (other) other.total = Math.max(other.listed.length, other.total - found.total);
        return { ...results, [have]: found };
      });
    } catch (e) {
      if (searchId === this.searchId) this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      if (searchId === this.searchId) this.isSearching.set(false);
    }
  }
}

/**
 * Worth of `amount` items of `refName` at the poe.ninja price `div` (EE2 StackValue): in exalted, or
 * divines from about one up, with the other small currencies next to it ("85 ex · 1.2 c").
 */
export function stackWorth(amount: number, div: number, rates: NinjaRates, refName: string): string {
  const { value, also } = priceOf(amount * div, rates, refName);
  return [formatValue(value), ...also.map((entry) => formatValue({ min: entry.amount, max: entry.amount, currency: entry.currency }))].join(' · ');
}

/** The same exchange on the trade site. */
export function bulkSiteUrl(item: ParsedItem, filters: ItemFilters, have: BulkHave): string {
  const query = { exchange: createTradeRequest(filters, item, [have]).query };
  return `https://${getTradeEndpoint()}/trade2/exchange/poe2/${filters.trade.league}?q=${JSON.stringify(query)}`;
}
