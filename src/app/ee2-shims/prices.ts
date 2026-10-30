/**
 * Stands in for EE2 `@/web/background/Prices` (`usePoeninja`) with the same interface, backed by our
 * own adapter to the official poe.ninja API (`core/currency-rates.ts`, `core/ninja-prices.ts`) instead
 * of EE2's author's proxy. Vue refs become `{ value }` getters over signals. Prices are in divines;
 * the core currency is exalted (PoE2's main small currency; chaos is shown next to it by our UI).
 * Types and `displayRounding` are EE2's (MIT, see src/lib/ee2/LICENSE).
 */

import { ITEM_BY_REF, ITEM_DROP } from '@/assets/data';
import { SMALL_CURRENCIES } from '../constants';
import { currencyRates, ninjaLeague, requestNinjaPrices } from '../core/currency-rates';
import { autoCurrency as divToValue, lookupPrice, ninjaTypesFor, ninjaUrl } from '../core/ninja-prices';

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

const CORE_CURRENCIES: CoreCurrency[] = [
  { id: 'exalted', abbrev: 'ex', ref: 'Exalted Orb', text: 'Exalted Orb', icon: '/images/exa.png' },
  { id: 'chaos', abbrev: 'c', ref: 'Chaos Orb', text: 'Chaos Orb', icon: '/images/chaos.png' },
];

export const DivCurrency: CoreCurrency = {
  id: 'div',
  abbrev: 'div',
  ref: 'Divine Orb',
  text: 'Divine Orb',
  icon: '/images/div.png',
};

/** The core currency (EE2 setting `coreCurrency`): always the first small currency, exalted. */
const CORE_ID = SMALL_CURRENCIES[0];

/** A line as EE2's `findPriceByQuery` returns it: `cx` for the exchange, `url` of the item page. */
export interface NinjaInfo {
  name: string;
  variant?: string;
  primaryValue: number;
  detailsId: string;
  volumePrimaryValue?: number;
  sparkline: { totalChange: number; data: Array<number | null> };
  cx: boolean;
  url: string;
}

function findPriceByQuery(query: DbQuery): NinjaInfo | null {
  const price = lookupPrice(currencyRates.prices(), query);
  if (!price || !ninjaTypesFor(query).includes(price.type)) return null;
  return {
    name: price.name,
    variant: price.variant,
    primaryValue: price.primaryValue,
    detailsId: price.detailsId,
    volumePrimaryValue: price.volumePrimaryValue,
    sparkline: price.sparkline,
    cx: price.volumePrimaryValue != null,
    url: ninjaUrl(price, ninjaLeague() ?? ''),
  };
}

/** Divines in the core currency, or in divines from about one up (EE2 `autoCurrency`). */
function autoCurrency(value: number | [number, number], coreOnly: boolean = false): CurrencyValue {
  const rates = currencyRates.rates();
  if (!rates) {
    // EE2: "this should never run, assuming we have loaded a currency".
    const [min, max] = Array.isArray(value) ? value : [value, value];
    return { min, max, currency: 'div' };
  }
  return divToValue(value, rates, CORE_ID, coreOnly);
}

function toDivine(value: CurrencyValue): CurrencyValue {
  const rates = currencyRates.rates();
  if (value.currency === 'div' || !rates) return value;
  return { min: value.min / rates[value.currency], max: value.max / rates[value.currency], currency: 'div' };
}

/**
 * EE2 caches per load; here the cache lives as long as the price index it was made from. Made on
 * first use: this module is imported (through EE2 trade code) before the price state exists.
 */
let cache: { db: unknown; rates: unknown; values: Map<string, CurrencyValue> } | undefined;

function cachedCurrencyByQuery(query: DbQuery, count: number): CurrencyValue | undefined {
  const db = currencyRates.prices();
  const rates = currencyRates.rates();
  if (!cache || cache.db !== db || cache.rates !== rates) cache = { db, rates, values: new Map() };
  const key = `${query.ns}:${query.name}:${query.variant ?? ''}:${count}`;
  if (cache.values.has(key)) return cache.values.get(key);
  const price = rates ? findPriceByQuery(query) : null;
  if (!price) return undefined;
  const value = autoCurrency(price.primaryValue * count);
  cache.values.set(key, value);
  return value;
}

const api = {
  /** Core currency per divine (EE2: core/div). */
  xchgRate: {
    get value(): number | undefined {
      return currencyRates.rates()?.[CORE_ID];
    },
  },
  /** The core currency prices are shown in. */
  xchgRateCurrency: {
    get value(): CoreCurrency | undefined {
      return currencyRates.rates() ? api.availableCoreCurrencies.value.find((c) => c.id === CORE_ID) : undefined;
    },
  },
  findPriceByQuery,
  autoCurrency,
  /** EE2 asks for a refresh when an item is checked; here the rates come with any price request. */
  queuePricesFetch(): void {
    requestNinjaPrices([]);
  },
  cachedCurrencyByQuery,
  initialLoading: (): boolean => !currencyRates.rates() && !currencyRates.error() && ninjaLeague() != null,
  availableCoreCurrencies: {
    get value(): CoreCurrency[] {
      return CORE_CURRENCIES.map((currency) => ({
        ...currency,
        text: ITEM_BY_REF('ITEM', currency.ref)?.[0]?.name ?? currency.text,
      }));
    },
  },
  /** EE2 downloads it from the proxy; ours comes with the game data (`item-drop.json`). */
  ITEM_DROP: {
    get value() {
      return ITEM_DROP;
    },
  },
  addPrice(addend1: CurrencyValue, addend2: CurrencyValue): CurrencyValue {
    const a = toDivine(addend1);
    const b = toDivine(addend2);
    return autoCurrency([a.min + b.min, a.max + b.max]);
  },
  subtractPrice(minuend: CurrencyValue, subtrahend: CurrencyValue): CurrencyValue {
    const a = toDivine(minuend);
    const b = toDivine(subtrahend);
    return autoCurrency([a.min - b.max, a.max - b.min]);
  },
  comparePrice(left: CurrencyValue, op: '>' | '>=' | '==' | '===' | '<=' | '<', right: CurrencyValue): boolean {
    const l = toDivine(left);
    const r = toDivine(right);
    switch (op) {
      case '>':
        return l.min > r.max;
      case '>=':
        return l.min >= r.max;
      case '==':
        return l.min === r.max && l.max === r.min;
      case '===':
        return left.currency === right.currency && l.min === r.max && l.max === r.min;
      case '<=':
        return l.max <= r.min;
      case '<':
        return l.max < r.min;
    }
  },
};

/** EE2 `usePoeninja` (a global state there too). */
export function usePoeninja() {
  return api;
}

/** EE2 `displayRounding`, unchanged (MIT, see src/lib/ee2/LICENSE). */
export function displayRounding(value: number, fraction: boolean = false, truncateLargeNumbers: boolean = false): string {
  if (fraction && Math.abs(value) < 1) {
    if (value === 0) return '0';
    const r = `1 / ${displayRounding(1 / value)}`;
    return r === '1 / 1' ? '1' : r;
  }
  if (Math.abs(value) < 10) {
    return Number(value.toFixed(1)).toString().replace('.', ' . ');
  }
  if (truncateLargeNumbers && Math.abs(value) > 2250) {
    if (Math.abs(value) < 1_050_000) {
      // keep 1 decimal 12324 -> 12.3k
      return Number((value / 1000).toFixed(1)).toString().replace('.', ' . ') + 'k';
    }
    if (Math.abs(value) < 1_050_000_000) {
      return Number((value / 1_000_000).toFixed(1)).toString().replace('.', ' . ') + 'm';
    }
    if (Math.abs(value) < 1_050_000_000_000) {
      return Number((value / 1_000_000_000).toFixed(1)).toString().replace('.', ' . ') + 'b';
    }
    return Number((value / 1_000_000_000_000).toFixed(1)).toString().replace('.', ' . ') + 't';
  }
  return Math.round(value).toString();
}
