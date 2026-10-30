// poe.ninja prices for the selected league, loaded as they are needed (owner's decision, ANALYSIS §7):
// the currency overview with the divine → exalted / chaos rates at once and every
// POE_NINJA_REFRESH_MS; every other overview type the first time an item of it is checked, again
// when it is checked after the same time. One league at a time, one request per type, If-None-Match.
// Everything lands in one index (`ninja-prices.ts`) the title bar, listings, poe.ninja tab, related
// items, bulk and the EE2 shim (`ee2-shims/prices.ts`) read.

import { signal } from '@angular/core';
import { ITEMS_ITERATOR } from '@/assets/data';
import {
  POE_NINJA_API,
  POE_NINJA_RATES_TYPE,
  POE_NINJA_REFRESH_MS,
  POE_NINJA_RETRY_MS,
  POE_NINJA_TYPES,
} from '../constants';
import { poeFetch } from './http';
import { settings } from './settings';
import {
  buildPriceDb,
  lookupPrice,
  type NinjaExchangeOverview,
  type NinjaPrice,
  type NinjaRates,
  type NinjaStashOverview,
  ninjaTypesFor,
  parseQueryId,
  type PriceDb,
  pricesFromOverview,
  ratesFromCore,
  type TypeStates,
} from './ninja-prices';

/** Per game language: the names differ, the English `refName` (poe.ninja's) does not. */
const byTradeTag = new Map<string, { name: string; refName: string; icon: string } | null>();

function currencyItem(tradeTag: string): { name: string; refName: string; icon: string } | null {
  const key = `${settings().language}:${tradeTag}`;
  if (!byTradeTag.has(key)) {
    // EE2 data is written with a space after the colon.
    const item = ITEMS_ITERATOR(`"tradeTag": "${tradeTag}"`).next().value;
    byTradeTag.set(key, item?.tradeTag === tradeTag ? { name: item.name, refName: item.refName, icon: item.icon } : null);
  }
  return byTradeTag.get(key) ?? null;
}

/** Trade site currency id ("chrome") → item name ("Chromatic Orb"), from the game data. */
export function currencyName(tradeTag: string): string | undefined {
  return currencyItem(tradeTag)?.name;
}

/** Trade site currency id → the game's icon of it (prices are shown with the currency's icon). */
export function currencyIcon(tradeTag: string): string | undefined {
  return currencyItem(tradeTag)?.icon || undefined;
}

/**
 * Divine value of `amount` units of a trade currency: divine, exalted and chaos by the rates,
 * anything else ("alch", "annul") by its poe.ninja price. Undefined while poe.ninja does not know it.
 */
export function toDivine(amount: number, tradeTag: string, rates: NinjaRates | null, db: PriceDb): number | undefined {
  if (tradeTag === 'divine') return amount;
  if (!rates) return undefined;
  if (tradeTag === 'exalted' || tradeTag === 'chaos') return amount / rates[tradeTag];
  const name = currencyItem(tradeTag)?.refName;
  const price = name ? lookupPrice(db, { ns: 'ITEM', name }) : undefined;
  return price ? amount * price.primaryValue : undefined;
}

interface TypeEntry {
  prices: NinjaPrice[];
  etag?: string;
  /** When the type was last fetched (or failed). */
  at: number;
}

// Module state shared by everything in one window (like settings).
const rates = signal<NinjaRates | null>(null);
const prices = signal<PriceDb>(new Map());
const states = signal<TypeStates>(new Map());
const updatedAt = signal<Date | null>(null);
const error = signal<string | null>(null);
let league: string | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let entries = new Map<string, TypeEntry>();
const inFlight = new Set<string>();
let now = () => Date.now();

export const currencyRates = {
  /** Small currencies per divine; null until the currency overview arrives. */
  rates: rates.asReadonly(),
  /** Every loaded poe.ninja price, by `ns::name // variant`. */
  prices: prices.asReadonly(),
  /** Which overview types are loading, loaded or failed. */
  states: states.asReadonly(),
  /** When the rates were last fetched. */
  updatedAt: updatedAt.asReadonly(),
  /** Why the rates could not be loaded. */
  error: error.asReadonly(),
};

function setState(type: string, state: 'loading' | 'loaded' | 'error'): void {
  states.update((all) => new Map(all).set(type, state));
}

async function load(type: string, leagueId: string): Promise<void> {
  const known = POE_NINJA_TYPES[type];
  if (!known || inFlight.has(type)) return;
  inFlight.add(type);
  const entry = entries.get(type);
  if (!entry) setState(type, 'loading');
  try {
    const url = `https://${POE_NINJA_API[known.api]}?league=${encodeURIComponent(leagueId)}&type=${type}`;
    const response = await poeFetch(url, { headers: entry?.etag ? { 'If-None-Match': entry.etag } : {} });
    if (leagueId !== league) return;
    if (response.status === 304 && entry) {
      entry.at = now();
    } else {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as NinjaExchangeOverview | NinjaStashOverview;
      if (leagueId !== league) return;
      const parsed = ratesFromCore(data.core);
      if (type === POE_NINJA_RATES_TYPE || !rates()) {
        if (parsed) rates.set(parsed);
        else if (type === POE_NINJA_RATES_TYPE) throw new Error(`no currency rates for ${leagueId}`);
      }
      const lines = Array.isArray(data?.lines) ? pricesFromOverview(type, data) : [];
      entries.set(type, { prices: lines, at: now(), etag: response.headers.get('etag') ?? undefined });
      prices.set(buildPriceDb([...entries.values()].map((e) => e.prices)));
    }
    if (type === POE_NINJA_RATES_TYPE) {
      updatedAt.set(new Date(now()));
      error.set(null);
    }
    setState(type, 'loaded');
  } catch (e) {
    if (leagueId !== league) return;
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`poe.ninja ${type}: ${message}`);
    if (entry) entry.at = now(); // keep the older prices, ask again after the refresh time
    else {
      entries.set(type, { prices: [], at: now() });
      setState(type, 'error');
    }
    if (type === POE_NINJA_RATES_TYPE) error.set(message);
  } finally {
    if (leagueId === league) inFlight.delete(type);
  }
}

/** Fetched long enough ago (or failed long enough ago) to ask again. */
function isStale(type: string): boolean {
  const entry = entries.get(type);
  if (!entry) return true;
  const failed = states().get(type) === 'error';
  return now() - entry.at >= (failed ? POE_NINJA_RETRY_MS : POE_NINJA_REFRESH_MS);
}

/**
 * Makes sure the prices of these items (`ns::name // variant` ids) get loaded: the type that lists
 * each, or the next type that may list it. Types loaded long ago are fetched again. Cheap to call
 * repeatedly: nothing is requested twice at once. It reads the prices, so an effect that calls it
 * runs again when a type arrives and goes on to the next candidate type where the item is missing.
 */
export function requestNinjaPrices(ids: Iterable<string>): void {
  const leagueId = league;
  if (!leagueId) return;
  // The rates too: a check after a failed or old rates request asks again.
  const wanted = new Set<string>([POE_NINJA_RATES_TYPE]);
  for (const id of ids) {
    const query = parseQueryId(id);
    const types = ninjaTypesFor(query);
    const found = lookupPrice(prices(), query);
    if (found && types.includes(found.type)) {
      wanted.add(found.type); // refresh the type it is in, if old
      continue;
    }
    // Not found yet: the first candidate type not loaded (or due again).
    const next = types.find((type) => !entries.has(type) || isStale(type));
    if (next) wanted.add(next);
  }
  for (const type of wanted) {
    if (isStale(type)) void load(type, leagueId);
  }
}

/** Loads the rates for the league and keeps them fresh; call again when the league changes. */
export function trackCurrencyRates(leagueId: string | undefined): void {
  if (leagueId === league) return;
  league = leagueId;
  clearInterval(timer);
  entries = new Map();
  inFlight.clear();
  rates.set(null);
  prices.set(new Map());
  states.set(new Map());
  updatedAt.set(null);
  error.set(null);
  if (!leagueId) return;
  void load(POE_NINJA_RATES_TYPE, leagueId);
  // Checked every retry period: the rates come again once old, or soon after a failure.
  timer = setInterval(() => {
    if (isStale(POE_NINJA_RATES_TYPE)) void load(POE_NINJA_RATES_TYPE, leagueId);
  }, POE_NINJA_RETRY_MS);
}

/** The league the prices are for. */
export function ninjaLeague(): string | undefined {
  return league;
}

/** Tests: a clock for the refresh times. */
export function setNinjaClock(clock: () => number): void {
  now = clock;
}
