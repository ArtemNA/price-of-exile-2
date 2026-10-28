// Trade search with listings. Port of `useTradeApi` from APT TradeListing.vue
// (MIT © 2020 Alexander Drozdov); Vue refs replaced with Angular signals, logic unchanged.

import { computed, signal } from '@angular/core';
import type { FilterOrGroup, ItemFilters } from '../../lib/apt/web/price-check/filters/interfaces';
import { getTradeEndpoint } from '../../lib/apt/web/price-check/trade/common';
import {
  createTradeRequest,
  type PricingResult,
  requestResults,
  requestTradeResultList,
  type SearchResult,
} from '../../lib/apt/web/price-check/trade/pathofexile-trade';
import { TRADE_LISTING } from '../constants';
import { settings } from '../core/settings';

export type GroupedResult = PricingResult & { listedTimes: number };

export class TradeSearch {
  readonly error = signal<string | null>(null);
  readonly searchResult = signal<SearchResult | null>(null);
  readonly isSearching = signal(false);
  private readonly fetchResults = signal<PricingResult[]>([]);
  private searchId = 0;
  private collapseMerchant = false;

  /** Consecutive listings of one seller collapse into a row (stack sizes add up). */
  readonly groupedResults = computed(() => {
    const out: GroupedResult[] = [];
    for (const result of this.fetchResults()) {
      if (out.length === 0 || (result.hasFee && !this.collapseMerchant)) {
        out.push({ listedTimes: 1, ...result });
        continue;
      }
      const existing = out.find(
        (added, idx) =>
          (added.accountName === result.accountName &&
            added.priceCurrency === result.priceCurrency &&
            added.priceAmount === result.priceAmount) ||
          (added.accountName === result.accountName && out.length - idx <= 2), // last or prev
      );
      if (existing) {
        if (existing.stackSize) existing.stackSize += result.stackSize!;
        else existing.listedTimes += 1;
      } else {
        out.push({ listedTimes: 1, ...result });
      }
    }
    return out;
  });

  /** Rows to show. The full grouped list above decides whether to fetch more, as in APT. */
  readonly rows = computed(() => this.groupedResults().slice(0, TRADE_LISTING.showResults));

  reset(): void {
    this.searchId += 1;
    this.error.set(null);
    this.searchResult.set(null);
    this.fetchResults.set([]);
    this.isSearching.set(false);
  }

  async search(filters: ItemFilters, stats: FilterOrGroup[]): Promise<void> {
    this.reset();
    const searchId = this.searchId;
    const isCurrent = () => searchId === this.searchId;
    const push = (results: PricingResult[]) => {
      if (isCurrent()) this.fetchResults.update((all) => [...all, ...results]);
    };
    const { accountName } = settings();
    const { fetchChunk, apiFetchLimit, minGrouped, minNotGrouped } = TRADE_LISTING;

    this.isSearching.set(true);
    try {
      const searchResult = await requestTradeResultList(createTradeRequest(filters, stats), filters.trade.league);
      if (!isCurrent()) return;
      this.searchResult.set(searchResult);
      this.collapseMerchant = filters.trade.collapseMerchant;

      // The first two fetches run in parallel (results keep their order), then one by one on demand.
      const ids = searchResult.result;
      const r1 = ids.length > 0
        ? requestResults(searchResult.id, ids.slice(0, fetchChunk), { accountName }).then(push)
        : Promise.resolve();
      const r2 = ids.length > fetchChunk
        ? requestResults(searchResult.id, ids.slice(fetchChunk, 2 * fetchChunk), { accountName }).then((results) =>
            r1.then(() => push(results)),
          )
        : Promise.resolve();
      await Promise.all([r1, r2]);

      let fetched = 2 * fetchChunk;
      while (isCurrent()) {
        const grouped = this.groupedResults();
        const notGrouped = grouped.filter((res) => res.listedTimes <= 2).length;
        const needMore = notGrouped < minNotGrouped || grouped.length < minGrouped;
        if (!needMore || fetched >= ids.length || fetched >= apiFetchLimit) break;
        push(await requestResults(searchResult.id, ids.slice(fetched, fetched + fetchChunk), { accountName }));
        fetched += fetchChunk;
      }
    } catch (e) {
      if (isCurrent()) this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      if (isCurrent()) this.isSearching.set(false);
    }
  }
}

/** Link to the same search on the trade site. */
export function tradeSiteUrl(filters: ItemFilters, stats: FilterOrGroup[], searchId?: string): string {
  const base = `https://${getTradeEndpoint()}/trade/search/${filters.trade.league}`;
  return searchId ? `${base}/${searchId}` : `${base}?q=${JSON.stringify(createTradeRequest(filters, stats))}`;
}
