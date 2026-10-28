import type { RateLimiter } from '../../lib/apt/web/price-check/trade/RateLimiter';
import { type ChaosRates, toChaos } from '../core/currency-rates';
import type { GroupedResult } from './trade-search';

/** Short chaos amount: 0.24, 3.8, 343. */
export function formatChaos(value: number): string {
  if (value < 1) return String(Math.round(value * 100) / 100);
  if (value < 10) return String(Math.round(value * 10) / 10);
  return String(Math.round(value));
}

export interface ListingSummary {
  /** Cheapest listing by chaos value, as listed ("1 vaal"), plus its chaos value. */
  cheapest?: { price: string; chaos: number };
  /** The price most listings ask ("2 chaos"). */
  mostListed?: string;
}

export function summarizeListings(rows: GroupedResult[], rates: ChaosRates): ListingSummary {
  let cheapest: ListingSummary['cheapest'];
  const counts = new Map<string, number>();
  for (const row of rows) {
    const price = `${row.priceAmount} ${row.priceCurrency}`;
    counts.set(price, (counts.get(price) ?? 0) + row.listedTimes);
    const chaos = toChaos(row.priceAmount, row.priceCurrency, rates);
    if (chaos != null && (!cheapest || chaos < cheapest.chaos)) cheapest = { price, chaos };
  }
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
