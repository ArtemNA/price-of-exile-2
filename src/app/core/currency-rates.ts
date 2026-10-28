// Currency rates from poe.ninja: the divine → chaos rate in the title bar and
// chaos equivalents of listings priced in other currencies. The same download
// also feeds the poe.ninja tab (`ninja-prices.ts`).

import { computed, signal } from '@angular/core';
import { ITEMS_ITERATOR } from '@/assets/data';
import { DIVINE_FRACTIONS, POE_NINJA_BULK_TYPES, POE_NINJA_OVERVIEWS, POE_NINJA_REFRESH_MS } from '../constants';
import { poeFetch } from './http';
import { settings } from './settings';
import { NinjaOverviews, PriceDb, priceDbFromNinja } from './ninja-prices';

/** Chaos value per currency or stackable item name ("Divine Orb" → 342.6). */
export type ChaosRates = ReadonlyMap<string, number>;

export function chaosRatesFromNinja(data: NinjaOverviews): ChaosRates {
  const rates = new Map<string, number>([['Chaos Orb', 1]]);
  const bulkTypes = new Set(POE_NINJA_BULK_TYPES);
  const overviews = [...data.currencyOverviews, ...(data.itemOverviews ?? []).filter((o) => bulkTypes.has(o.type))];
  for (const overview of overviews) {
    for (const line of overview.lines) {
      if (!rates.has(line.name)) rates.set(line.name, line.chaos);
    }
  }
  return rates;
}

/** "0.1 div = 34 c" rows for the title bar tooltip. */
export function divineFractions(divineChaos: number): Array<{ divine: number; chaos: number }> {
  return DIVINE_FRACTIONS.map((divine) => ({ divine, chaos: Math.round(divine * divineChaos) }));
}

/** Per game language: the names differ, the English `refName` (poe.ninja's) does not. */
const byTradeTag = new Map<string, { name: string; refName: string; icon: string } | null>();

function currencyItem(tradeTag: string): { name: string; refName: string; icon: string } | null {
  const key = `${settings().language}:${tradeTag}`;
  if (!byTradeTag.has(key)) {
    const item = ITEMS_ITERATOR(`"tradeTag":"${tradeTag}"`).next().value;
    byTradeTag.set(key, item?.tradeTag === tradeTag ? { name: item.name, refName: item.refName, icon: item.icon } : null);
  }
  return byTradeTag.get(key) ?? null;
}

/** Trade site currency id ("chrome") → item name ("Chromatic Orb"), from the game data. */
export function currencyName(tradeTag: string): string | undefined {
  return currencyItem(tradeTag)?.name;
}

/** Trade site currency id → the game's icon of it (APT shows currencies by their icons). */
export function currencyIcon(tradeTag: string): string | undefined {
  return currencyItem(tradeTag)?.icon || undefined;
}

/** Chaos value of `amount` units of a trade currency, if poe.ninja knows it. */
export function toChaos(amount: number, tradeTag: string, rates: ChaosRates): number | undefined {
  if (tradeTag === 'chaos') return amount;
  const name = currencyItem(tradeTag)?.refName;
  const rate = name ? rates.get(name) : undefined;
  return rate != null ? amount * rate : undefined;
}

// Module state shared by everything in one window (like settings).
const rates = signal<ChaosRates>(new Map());
const prices = signal<PriceDb>(new Map());
const updatedAt = signal<Date | null>(null);
const error = signal<string | null>(null);
let league: string | undefined;
let timer: ReturnType<typeof setInterval> | undefined;

export const currencyRates = {
  rates: rates.asReadonly(),
  /** Every poe.ninja price from the same download (uniques, gems, bases, maps, …). */
  prices: prices.asReadonly(),
  updatedAt: updatedAt.asReadonly(),
  error: error.asReadonly(),
  divine: computed(() => rates().get('Divine Orb')),
};

async function load(leagueId: string): Promise<void> {
  try {
    const response = await poeFetch(
      `https://${POE_NINJA_OVERVIEWS}?league=${encodeURIComponent(leagueId)}&language=en`,
    );
    if (!response.ok) throw new Error(`poe.ninja: HTTP ${response.status}`);
    const data = (await response.json()) as NinjaOverviews;
    if (leagueId !== league) return;
    rates.set(chaosRatesFromNinja(data));
    prices.set(priceDbFromNinja(data));
    updatedAt.set(new Date());
    error.set(null);
  } catch (e) {
    if (leagueId === league) error.set(e instanceof Error ? e.message : String(e));
  }
}

/** Loads rates for the league and keeps them fresh; call again when the league changes. */
export function trackCurrencyRates(leagueId: string | undefined): void {
  if (leagueId === league) return;
  league = leagueId;
  clearInterval(timer);
  rates.set(new Map());
  prices.set(new Map());
  updatedAt.set(null);
  if (!leagueId) return;
  void load(leagueId);
  timer = setInterval(() => void load(leagueId), POE_NINJA_REFRESH_MS);
}
