// Bulk exchange search. Port of `useBulkApi` and `useMarketRatioFinder` from APT TradeBulk.vue
// (MIT © 2020 Alexander Drozdov) on Angular signals, plus bait detection (FINDINGS F-26).

import { computed, signal } from '@angular/core';
import type { ParsedItem } from '@/parser';
import type { ItemFilters } from '../../lib/apt/web/price-check/filters/interfaces';
import { getTradeEndpoint } from '../../lib/apt/web/price-check/trade/common';
import {
  type BulkSearch as AptBulkSearch,
  createTradeRequest,
  execBulkSearch,
  type PricingResult,
} from '../../lib/apt/web/price-check/trade/pathofexile-bulk';
import { BULK_BAIT_RATIO } from '../constants';
import { settings } from '../core/settings';
import { formatChaos } from './listing-summary';

export type BulkHave = 'divine' | 'chaos';

export interface BulkRow extends PricingResult {
  /** Price of one item in chaos (divine offers converted at the poe.ninja rate). */
  chaosPerItem?: number;
  /** Far below the poe.ninja price: almost certainly a bait listing. */
  isBait: boolean;
}

/** poe.ninja's price as a pseudo-offer, placed among the listings like APT's "Market Ratio" row. */
export interface MarketRatio {
  exchangeAmount: number;
  itemAmount: number;
}

/**
 * Currencies to pay with. APT override: at league start many players misprice chaos ↔ divine,
 * which breaks the combined search, so those two only search each other.
 */
export function bulkHaves(item: ParsedItem): BulkHave[] {
  if (item.info.refName === 'Chaos Orb') return ['divine'];
  if (item.info.refName === 'Divine Orb') return ['chaos'];
  return ['divine', 'chaos'];
}

export function priceOffers(
  rows: PricingResult[],
  have: BulkHave,
  ninjaChaos: number | undefined,
  divineChaos: number | undefined,
): BulkRow[] {
  const rate = have === 'chaos' ? 1 : divineChaos;
  return rows.map((row) => {
    const chaosPerItem = rate != null ? (row.exchangeAmount / row.itemAmount) * rate : undefined;
    const isBait = chaosPerItem != null && ninjaChaos != null && chaosPerItem < ninjaChaos * BULK_BAIT_RATIO;
    return { ...row, chaosPerItem, isBait };
  });
}

/** The cheapest offer that is not bait. */
export function bestOffer(rows: BulkRow[]): BulkRow | undefined {
  return rows.find((row) => !row.isBait);
}

/** Port of APT `useMarketRatioFinder`: a round "pay → get" pair close to the poe.ninja price. */
export function marketRatio(have: BulkHave, ninjaChaos: number, divineChaos: number | undefined): MarketRatio | undefined {
  if (have === 'chaos') {
    if (ninjaChaos >= (divineChaos || 9999) * 1.06) return undefined;
    if (ninjaChaos > 4) return { exchangeAmount: ninjaChaos, itemAmount: 1 };
    const price = ninjaChaos > 1 ? 20 : 10;
    return { exchangeAmount: price, itemAmount: price / ninjaChaos };
  }
  if (divineChaos == null) return undefined;
  if (ninjaChaos > divineChaos * 0.94) return { exchangeAmount: ninjaChaos / divineChaos, itemAmount: 1 };
  const price = ninjaChaos > divineChaos * 0.2 ? 2 : 1;
  return { exchangeAmount: price, itemAmount: price * (divineChaos / ninjaChaos) };
}

export class BulkSearch {
  readonly error = signal<string | null>(null);
  readonly isSearching = signal(false);
  /** Per currency: undefined = not searched, null = to load on demand (APT "loadedOnDemand"). */
  readonly results = signal<Partial<Record<BulkHave, AptBulkSearch | null>>>({});
  readonly selected = signal<BulkHave>('chaos');
  readonly haves = signal<BulkHave[]>([]);
  private searchId = 0;
  private item?: ParsedItem;
  private filters?: ItemFilters;

  readonly current = computed(() => this.results()[this.selected()] ?? null);

  reset(): void {
    this.searchId += 1;
    this.error.set(null);
    this.results.set({});
    this.haves.set([]);
    this.isSearching.set(false);
  }

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
      const results: Partial<Record<BulkHave, AptBulkSearch | null>> = {};
      have.forEach((tag, i) => (results[tag] = found[i]));
      this.results.set(results);
      // Show the currency with more offers (APT).
      const divine = results.divine?.total;
      const chaos = results.chaos?.total;
      this.selected.set(divine != null && (chaos == null || divine > chaos) ? 'divine' : 'chaos');
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
        const other = have === 'divine' ? results.chaos : results.divine;
        // Fix the total APT guessed for the other currency in the combined search.
        if (other) other.total -= found.total;
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
 * Worth of `amount` items at the poe.ninja price (APT StackValue): chaos, or divines once it
 * reaches a divine. Divine Orbs themselves are always shown in chaos.
 */
export function stackWorth(amount: number, ninjaChaos: number, divineChaos: number | undefined, isDivine: boolean): string {
  const chaos = amount * ninjaChaos;
  if (!isDivine && divineChaos && chaos >= divineChaos) return `${formatChaos(chaos / divineChaos)} div`;
  return `${formatChaos(chaos)} chaos`;
}

/** The same exchange on the trade site. */
export function bulkSiteUrl(item: ParsedItem, filters: ItemFilters, have: BulkHave): string {
  const query = { exchange: createTradeRequest(filters, item, [have]).query };
  return `https://${getTradeEndpoint()}/trade/exchange/${filters.trade.league}?q=${JSON.stringify(query)}`;
}
