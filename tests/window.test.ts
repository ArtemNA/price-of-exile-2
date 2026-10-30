import { beforeAll, describe, expect, it, vi } from 'vitest';
import { currencyName } from '../src/app/core/currency-rates';
import { formatChaos, limiterUsage, summarizeListings } from '../src/app/price-check/listing-summary';
import type { GroupedResult } from '../src/app/price-check/trade-search';
import { RateLimiter } from '../src/lib/ee2/web/price-check/trade/RateLimiter';
import { loadGameDataFromDisk } from './game-data';

beforeAll(loadGameDataFromDisk);

/** Divines per unit, rounded from poe.ninja (Forbidden Rites, 28.10.2026). poe.ninja itself: ninja.test.ts. */
const DIVINES: Record<string, number> = { divine: 1, exalted: 0.001486, chaos: 0.09809, vaal: 0.0004 };
const toDivine = (amount: number, currency: string) => (currency in DIVINES ? amount * DIVINES[currency] : undefined);

describe('currency names', () => {
  it('maps trade currency ids to item names through game data', () => {
    expect(currencyName('exalted')).toBe('Exalted Orb');
    expect(currencyName('divine')).toBe('Divine Orb');
    expect(currencyName('no-such-currency')).toBeUndefined();
  });
});

describe('listing summary', () => {
  const row = (priceAmount: number, priceCurrency: string, listedTimes = 1) =>
    ({ id: `${priceAmount}${priceCurrency}${Math.random()}`, priceAmount, priceCurrency, listedTimes }) as GroupedResult;

  it('finds the cheapest listing by divine value and the most listed price', () => {
    const rows = [row(1, 'chaos', 4), row(2, 'chaos', 10), row(1, 'exalted'), row(1, 'vaal'), row(3, 'chaos', 4), row(1, 'annul')];
    expect(summarizeListings(rows, toDivine)).toEqual({
      cheapest: { price: '1 vaal', div: 0.0004 },
      mostListed: '2 chaos',
    });
  });

  it('takes the trade site order for the cheapest listing while there are no rates', () => {
    // Before poe.ninja answers: the exalted listing first, as the site sorted it.
    const rows = [row(2, 'exalted'), row(1, 'chaos', 3), row(3, 'exalted')];
    expect(summarizeListings(rows, null)).toEqual({ cheapest: { price: '2 exalted' }, mostListed: '1 chaos' });
  });

  it('leaves listings without a price out of the cheapest and most listed prices', () => {
    // Online listings include items with no price: EE2 gives them 0 "no price", the trade site lists them last.
    const unpriced = [row(0, 'no price', 3), row(0, 'no price', 2)];
    expect(summarizeListings([...unpriced, row(5, 'exalted')], toDivine)).toEqual({ cheapest: { price: '5 exalted', div: 5 * DIVINES.exalted }, mostListed: '5 exalted' });
    expect(summarizeListings([...unpriced, row(5, 'exalted')], null)).toEqual({ cheapest: { price: '5 exalted' }, mostListed: '5 exalted' });
    expect(summarizeListings(unpriced, null)).toEqual({});
  });

  it('formats amounts compactly', () => {
    expect(formatChaos(0.0152)).toBe('0.015');
    expect(formatChaos(0.2435)).toBe('0.24');
    expect(formatChaos(3.82)).toBe('3.8');
    expect(formatChaos(342.6)).toBe('343');
  });

  it('reports the most used rate limiter', async () => {
    vi.useFakeTimers();
    const tight = new RateLimiter(2, 10);
    const loose = new RateLimiter(10, 10);
    await tight.wait();
    await loose.wait();
    expect(limiterUsage([loose, tight])).toEqual({ used: 1, max: 2 });
    vi.useRealTimers();
  });
});
