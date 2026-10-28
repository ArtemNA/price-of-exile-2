import { beforeAll, describe, expect, it, vi } from 'vitest';
import { chaosRatesFromNinja, currencyName, divineFractions, toChaos } from '../src/app/core/currency-rates';
import { formatChaos, limiterUsage, summarizeListings } from '../src/app/price-check/listing-summary';
import type { GroupedResult } from '../src/app/price-check/trade-search';
import { RateLimiter } from '../src/lib/apt/web/price-check/trade/RateLimiter';
import { loadGameDataFromDisk } from './game-data';

beforeAll(loadGameDataFromDisk);

// Shape of poe.ninja /poe1/api/economy/current/dense/overviews (Allflame, 26.10.2026).
const NINJA = {
  currencyOverviews: [
    {
      type: 'Currency',
      lines: [
        { name: 'Divine Orb', chaos: 342.6 },
        { name: 'Chromatic Orb', chaos: 3.82 },
        { name: 'Vaal Orb', chaos: 0.2435 },
      ],
    },
  ],
};
const rates = chaosRatesFromNinja(NINJA);

describe('currency rates', () => {
  it('reads chaos values from poe.ninja and knows chaos itself', () => {
    expect(rates.get('Divine Orb')).toBe(342.6);
    expect(rates.get('Chaos Orb')).toBe(1);
  });

  it('builds the divine → chaos tooltip rows', () => {
    const rows = divineFractions(342.6);
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({ divine: 0.1, chaos: 34 });
    expect(rows[4]).toEqual({ divine: 0.5, chaos: 171 });
    expect(rows[9]).toEqual({ divine: 1, chaos: 343 });
  });

  it('maps trade currency ids to item names through game data', () => {
    expect(currencyName('chrome')).toBe('Chromatic Orb');
    expect(currencyName('divine')).toBe('Divine Orb');
    expect(currencyName('no-such-currency')).toBeUndefined();
  });

  it('converts listing prices to chaos', () => {
    expect(toChaos(2, 'chaos', rates)).toBe(2);
    expect(toChaos(1, 'chrome', rates)).toBeCloseTo(3.82);
    expect(toChaos(1, 'exalted', rates)).toBeUndefined(); // not in this poe.ninja sample
  });
});

describe('listing summary', () => {
  const row = (priceAmount: number, priceCurrency: string, listedTimes = 1) =>
    ({ id: `${priceAmount}${priceCurrency}${Math.random()}`, priceAmount, priceCurrency, listedTimes }) as GroupedResult;

  it('finds the cheapest listing by chaos value and the most listed price', () => {
    // From the real ring search: chaos listings plus one chrome and one vaal.
    const rows = [row(1, 'chaos', 4), row(2, 'chaos', 10), row(1, 'chrome'), row(1, 'vaal'), row(3, 'chaos', 4)];
    expect(summarizeListings(rows, rates)).toEqual({
      cheapest: { price: '1 vaal', chaos: 0.2435 },
      mostListed: '2 chaos',
    });
  });

  it('formats chaos amounts compactly', () => {
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
