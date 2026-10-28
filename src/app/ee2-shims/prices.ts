/**
 * Stands in for EE2 `@/web/background/Prices` (`usePoeninja`). EE2 takes poe.ninja prices from
 * its author's proxy (docs/analysis/ee2-vs-apt.md §2.5); ours will be an own poe.ninja adapter
 * with the same interface (stage 4, PLAN §6).
 *
 * Until then: no prices. `requestResults` (trade/pathofexile-trade.ts) then leaves listings without
 * the normalized price, as EE2 does before its prices load. Types and `displayRounding` are EE2's.
 */

interface DbQuery {
  ns: string;
  name: string;
  variant?: string;
}

export interface CurrencyValue {
  min: number;
  max: number;
  currency: 'chaos' | 'exalted' | 'div';
}

export interface CoreCurrency {
  id: 'exalted' | 'chaos' | 'div';
  abbrev: string;
  ref: string;
  text: string;
  icon: string;
}

export const DivCurrency: CoreCurrency = {
  id: 'div',
  abbrev: 'div',
  ref: 'Divine Orb',
  text: 'Divine Orb',
  icon: '/images/div.png',
};

/** Only what ported EE2 code reads (`requestResults`); stage 4 brings the rest. */
export function usePoeninja() {
  return {
    /** Price of `count` units of the currency, in the core currency or divines. */
    cachedCurrencyByQuery: (_query: DbQuery, _count: number): CurrencyValue | undefined => undefined,
    /** The core currency prices are shown in. */
    xchgRateCurrency: { value: undefined as CoreCurrency | undefined },
  };
}

/** EE2 `displayRounding`, unchanged (MIT, see src/lib/ee2/LICENSE). */
export function displayRounding(value: number, fraction: boolean = false, truncateLargeNumbers: boolean = false): string {
  if (fraction && Math.abs(value) < 1) {
    if (value === 0) return '0';
    const r = `1 / ${displayRounding(1 / value)}`;
    return r === '1 / 1' ? '1' : r;
  }
  if (Math.abs(value) < 10) {
    return Number(value.toFixed(1)).toString().replace('.', ' . ');
  }
  if (truncateLargeNumbers && Math.abs(value) > 2250) {
    if (Math.abs(value) < 1_050_000) {
      // keep 1 decimal 12324 -> 12.3k
      return Number((value / 1000).toFixed(1)).toString().replace('.', ' . ') + 'k';
    }
    if (Math.abs(value) < 1_050_000_000) {
      return Number((value / 1_000_000).toFixed(1)).toString().replace('.', ' . ') + 'm';
    }
    if (Math.abs(value) < 1_050_000_000_000) {
      return Number((value / 1_000_000_000).toFixed(1)).toString().replace('.', ' . ') + 'b';
    }
    return Number((value / 1_000_000_000_000).toFixed(1)).toString().replace('.', ' . ') + 't';
  }
  return Math.round(value).toString();
}
