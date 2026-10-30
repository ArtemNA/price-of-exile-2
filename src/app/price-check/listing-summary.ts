import type { RateLimiter } from '../../lib/ee2/web/price-check/trade/RateLimiter';
import { formatAmount } from '../core/ninja-prices';
import type { GroupedResult } from './trade-search';

/** Short amount: 0.24, 3.8, 343 (`formatAmount`; the name is the PoE1 app's). */
export const formatChaos = formatAmount;

/** EE2's `priceCurrency` of a listing without a price (Online and Any listings have them). */
export const NO_PRICE = 'no price';

/** Divine value of a listing price; undefined for a currency poe.ninja has no price for. */
export type ToDivine = (amount: number, currency: string) => number | undefined;

export interface ListingSummary {
  /**
   * Cheapest listing by its divine value, as listed ("1 vaal"), plus that value. Without currency
   * rates it is the first listing: the trade site sorts them by price already.
   */
  cheapest?: { price: string; div?: number };
  /** The price most listings ask ("2 chaos"). */
  mostListed?: string;
}

/** `toDivine` null: no rates (yet). Listings without a price count for neither. */
export function summarizeListings(allRows: GroupedResult[], toDivine: ToDivine | null): ListingSummary {
  const rows = allRows.filter((row) => row.priceCurrency !== NO_PRICE);
  let cheapest: ListingSummary['cheapest'];
  const counts = new Map<string, number>();
  for (const row of rows) {
    const price = `${row.priceAmount} ${row.priceCurrency}`;
    counts.set(price, (counts.get(price) ?? 0) + row.listedTimes);
    const div = toDivine?.(row.priceAmount, row.priceCurrency);
    if (div != null && (!cheapest || div < cheapest.div!)) cheapest = { price, div };
  }
  // Without rates, comparing only the listings in one currency would mislead.
  if (!toDivine && rows.length) cheapest = { price: `${rows[0].priceAmount} ${rows[0].priceCurrency}` };
  let mostListed: string | undefined;
  let best = 0;
  for (const [price, count] of counts) {
    if (count > best) [mostListed, best] = [price, count];
  }
  return { cheapest, mostListed };
}

/** The most used limiter of a rule set: what the status bar shows as "used/max". */
export function limiterUsage(limiters: Iterable<RateLimiter>): { used: number; max: number } | undefined {
  let worst: { used: number; max: number } | undefined;
  for (const limiter of limiters) {
    limiter.revision();
    const usage = { used: limiter.stack.length, max: limiter.max };
    if (!worst || usage.used / usage.max > worst.used / worst.max) worst = usage;
  }
  return worst;
}
