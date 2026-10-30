import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseClipboard, type ParsedItem } from '@/parser';
import { setHttpFetch } from '../src/app/core/http';
import {
  bestOffer,
  bulkHaves,
  type BulkPrices,
  BulkSearch,
  bulkSiteUrl,
  marketRatio,
  pickHave,
  priceOffers,
  stackWorth,
} from '../src/app/price-check/bulk-search';
import { activePreset, createItemPresets } from '../src/app/price-check/price-check';
import { loadGameDataFromDisk } from './game-data';
import * as items from './items';

beforeAll(loadGameDataFromDisk);

/** Live trade2 exchange answers, Forbidden Rites 30.10.2026 (accounts anonymized). */
const exchange = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/trade2-exchange-${name}.json`, import.meta.url), 'utf-8'));
/** Exalted Orb, have divine + chaos: 5 offers. */
const EXALTED_ORB = exchange('exalted-orb-divine-chaos');
/** Greater Iron Rune, have exalted + divine + chaos: 36 offers, two listings with two offers each. */
const RUNE_ALL = exchange('greater-iron-rune-divine-exalted-chaos');
/** Greater Iron Rune, have exalted: 9 offers. */
const RUNE_EXALTED = exchange('greater-iron-rune-exalted');
/** Divine Orb, have exalted + chaos: 2 offers. */
const DIVINE_ORB_EXCHANGE = exchange('divine-orb-exalted-chaos');

/** poe.ninja, Forbidden Rites (tests/fixtures/ninja-poe2-exchange-currency.json and -runes.json). */
const RATES = { exalted: 672.9, chaos: 10.2 };
const PRICES = {
  exalted: { div: 0.001486, rates: RATES },
  rune: { div: 0.007355, rates: RATES },
  divine: { div: 1, rates: RATES },
} satisfies Record<string, BulkPrices>;

const DIVINE_ORB = `Item Class: Stackable Currency
Rarity: Currency
Divine Orb
--------
Stack Size: 12/20
--------
Randomises the numeric values of the random modifiers on an item
--------
Right click this item then left click a magic, rare or unique item to apply it.
Shift click to unstack.
`;
const RUNE = readFileSync(new URL('./fixtures/items/rune.txt', import.meta.url), 'utf-8');

const parse = (text: string): ParsedItem => parseClipboard(text)._unsafeUnwrap();

/** Offers of a response paid with `have`, as EE2 `toPricingResult` makes them. */
function offersOf(response: any, have: string) {
  return Object.values(response.result)
    .filter((result: any) => result.listing.offers.length === 1 && result.listing.offers[0].exchange.currency === have)
    .map((result: any) => ({
      id: result.id,
      relativeDate: '',
      exchangeAmount: result.listing.offers[0].exchange.amount,
      itemAmount: result.listing.offers[0].item.amount,
      stock: result.listing.offers[0].item.stock,
      accountStatus: 'online' as const,
      isMine: false,
      accountName: result.listing.account.name,
      ign: result.listing.account.lastCharacterName,
    }))
    .sort((a, b) => a.exchangeAmount / a.itemAmount - b.exchangeAmount / b.itemAmount);
}

/** Serves the responses in turn and records the requests. */
function serve(...responses: any[]) {
  const requests: Array<{ url: string; body: any }> = [];
  setHttpFetch(async (input, init) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return Response.json(responses[requests.length - 1], {
      headers: { 'x-rate-limit-rules': 'Ip', 'x-rate-limit-ip': '100:1:1', 'x-rate-limit-ip-state': '0:1:0' },
    });
  });
  return requests;
}

describe('bulkHaves (EE2)', () => {
  it('pays with exalted, divine and chaos; a currency only with the other two', () => {
    expect(bulkHaves(parse(RUNE))).toEqual(['exalted', 'divine', 'chaos']);
    expect(bulkHaves(parse(items.CURRENCY_EXALTED))).toEqual(['divine', 'chaos']);
    expect(bulkHaves(parse(items.CURRENCY_CHAOS))).toEqual(['exalted', 'divine']);
    expect(bulkHaves(parse(DIVINE_ORB))).toEqual(['exalted', 'chaos']);
  });
});

describe('offers of a real exchange answer', () => {
  it('reads "exchange" as what you pay and "item" as what you get', () => {
    const [offer] = Object.values(EXALTED_ORB.result as Record<string, any>)[0].listing.offers;
    expect(offer.exchange).toMatchObject({ currency: 'divine', amount: 1 });
    expect(offer.item).toMatchObject({ currency: 'exalted', amount: 100, stock: 3640 });
  });

  it('marks rune offers far below poe.ninja (4.9 ex) as bait', () => {
    const rows = priceOffers(offersOf(RUNE_ALL, 'exalted'), 'exalted', PRICES.rune);
    expect(rows.map((r) => [r.exchangeAmount, r.isBait])).toEqual([
      [1, true], [2, true], [15, false], [30, false], [60, false], [100, false], [111, false], [400, false],
    ]);
    expect(bestOffer(rows)?.exchangeAmount).toBe(15);
    expect(bestOffer(rows)?.divPerItem).toBeCloseTo(15 / 672.9);
  });

  it('sees the "1 div → 1" placeholders as overpriced, not bait', () => {
    const rows = priceOffers(offersOf(RUNE_ALL, 'divine'), 'divine', PRICES.rune);
    expect(rows[0]).toMatchObject({ exchangeAmount: 9, itemAmount: 10, isBait: false });
    expect(rows.some((r) => r.isBait)).toBe(false);
  });

  it('prices Exalted Orbs paid with divines', () => {
    const rows = priceOffers(offersOf(EXALTED_ORB, 'divine'), 'divine', PRICES.exalted);
    expect(rows.map((r) => [r.exchangeAmount, r.itemAmount])).toEqual([[1, 100], [1, 1], [5, 1], [999, 1]]);
    expect(rows.some((r) => r.isBait)).toBe(false);
    expect(bestOffer(rows)?.divPerItem).toBeCloseTo(0.01);
  });

  it('marks "1 ex → 1 divine" as bait', () => {
    const exalted = priceOffers(offersOf(DIVINE_ORB_EXCHANGE, 'exalted'), 'exalted', PRICES.divine);
    expect(exalted.map((r) => r.isBait)).toEqual([true]);
    expect(bestOffer(exalted)).toBeUndefined();
    const chaos = priceOffers(offersOf(DIVINE_ORB_EXCHANGE, 'chaos'), 'chaos', PRICES.divine);
    expect(chaos.map((r) => [r.exchangeAmount, r.isBait])).toEqual([[11, false]]);
  });

  it('marks nothing without a poe.ninja price', () => {
    const rows = priceOffers(offersOf(RUNE_ALL, 'exalted'), 'exalted', { rates: RATES });
    expect(rows.some((r) => r.isBait)).toBe(false);
    expect(priceOffers(offersOf(RUNE_ALL, 'exalted'), 'exalted', {})[0].divPerItem).toBeUndefined();
  });
});

describe('marketRatio (APT)', () => {
  it('pays exalted or chaos for the poe.ninja price of one item, or round amounts for cheap items', () => {
    expect(marketRatio('exalted', PRICES.rune)?.exchangeAmount).toBeCloseTo(4.949, 3);
    expect(marketRatio('exalted', PRICES.rune)?.itemAmount).toBe(1);
    expect(marketRatio('chaos', PRICES.rune)).toMatchObject({ exchangeAmount: 10 });
    expect(marketRatio('chaos', PRICES.rune)?.itemAmount).toBeCloseTo(133.3, 1);
    expect(marketRatio('chaos', PRICES.divine)?.exchangeAmount).toBeCloseTo(10.2);
    expect(marketRatio('exalted', { div: 1.5, rates: RATES })).toBeUndefined();
  });

  it('pays one or two divines for cheap items, the price for dear ones', () => {
    expect(marketRatio('divine', PRICES.exalted)).toMatchObject({ exchangeAmount: 1 });
    expect(marketRatio('divine', PRICES.exalted)?.itemAmount).toBeCloseTo(672.9, 0);
    expect(marketRatio('divine', { div: 0.5, rates: RATES })).toEqual({ exchangeAmount: 2, itemAmount: 4 });
    expect(marketRatio('divine', { div: 3, rates: RATES })).toEqual({ exchangeAmount: 3, itemAmount: 1 });
  });

  it('needs the poe.ninja price and rates', () => {
    expect(marketRatio('divine', { rates: RATES })).toBeUndefined();
    expect(marketRatio('exalted', { div: 0.01 })).toBeUndefined();
  });
});

describe('stackWorth', () => {
  it('shows exalted with chaos next to it, divines once a stack is worth one', () => {
    expect(stackWorth(12, 0.01, RATES, 'Greater Iron Rune')).toBe('81 ex · 1.2 c');
    expect(stackWorth(40, 0.05, RATES, 'Greater Iron Rune')).toBe('2 div · 1346 ex · 20 c');
    expect(stackWorth(3, 1, RATES, 'Divine Orb')).toBe('2019 ex · 31 c'); // divines themselves in exalted
    expect(stackWorth(7, 0.001486, RATES, 'Exalted Orb')).toBe('0.11 c'); // no "7 ex" for exalted orbs
  });
});

describe('BulkSearch', () => {
  it('searches all currencies at once and shows the one with the cheapest real offer', async () => {
    const requests = serve(RUNE_ALL);
    const item = parse(RUNE);
    const { filters } = activePreset(createItemPresets(item, 'Forbidden Rites'));
    const bulk = new BulkSearch(() => PRICES.rune);
    await bulk.search(item, filters);

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('https://www.pathofexile.com/api/trade2/exchange/Forbidden Rites');
    expect(requests[0].body).toMatchObject({
      engine: 'new',
      query: { have: ['exalted', 'divine', 'chaos'], want: ['greater-iron-rune'], status: { option: 'online' } },
      sort: { have: 'asc' },
    });
    expect(bulk.error()).toBeNull();
    expect(bulk.selected()).toBe('exalted');
    // The listing with a 10 ex and a 2 div offer is left out of the combined search (EE2).
    expect(bulk.current()?.listed.map((r) => r.exchangeAmount)).toEqual([1, 2, 15, 30, 60, 100, 111, 400]);
    // EE2's guess for one currency of a combined search counts the listings with two offers too.
    expect(bulk.results().exalted?.total).toBe(10);
    expect(bulk.results().divine?.listed[0]).toMatchObject({ exchangeAmount: 9, itemAmount: 10, stock: 53, accountStatus: 'afk' });
    expect(bulk.results().chaos?.listed.map((r) => r.exchangeAmount)).toEqual([1, 1, 1, 2, 10, 1000]);
    expect(bulkSiteUrl(item, filters, 'exalted')).toContain('/trade2/exchange/poe2/Forbidden Rites?q=');
  });

  it('shows the currency with more offers without poe.ninja prices (EE2)', async () => {
    serve(RUNE_ALL);
    const item = parse(RUNE);
    const { filters } = activePreset(createItemPresets(item, 'Forbidden Rites 2'));
    const bulk = new BulkSearch();
    await bulk.search(item, filters);
    expect(bulk.selected()).toBe('divine');
  });

  it('never pays for Exalted Orbs with exalted', async () => {
    const requests = serve(EXALTED_ORB);
    const item = parse(items.CURRENCY_EXALTED);
    const { filters } = activePreset(createItemPresets(item, 'Forbidden Rites'));
    filters.stackSize = { value: 7, disabled: false }; // the stock filter, "Stock ≥ 7"
    const bulk = new BulkSearch(() => PRICES.exalted);
    await bulk.search(item, filters);

    expect(requests[0].body.query).toMatchObject({ have: ['divine', 'chaos'], want: ['exalted'], minimum: 7 });
    expect(bulk.haves()).toEqual(['divine', 'chaos']);
    expect(bulk.selected()).toBe('divine');
    expect(bulk.current()?.listed.map((r) => `${r.exchangeAmount}→${r.itemAmount}`)).toEqual(['1→100', '1→1', '5→1', '999→1']);
    expect(bulk.results().chaos?.listed.map((r) => `${r.exchangeAmount}→${r.itemAmount}`)).toEqual(['1→1']);
  });

  it('loads exalted on demand when the combined search is crowded with other currencies', async () => {
    // As if 250 offers were found and the first 100 (by the raw amount) held only 3 exalted ones.
    const result = Object.fromEntries(
      Object.entries(RUNE_ALL.result as Record<string, any>).filter(([, r]) => {
        const [offer] = r.listing.offers;
        return r.listing.offers.length > 1 || offer.exchange.currency !== 'exalted' || offer.exchange.amount < 30;
      }),
    );
    const crowded = { ...RUNE_ALL, result, total: 250 };
    const requests = serve(crowded, RUNE_EXALTED);
    const item = parse(RUNE);
    const { filters } = activePreset(createItemPresets(item, 'Forbidden Rites 3'));
    const bulk = new BulkSearch(() => PRICES.rune);
    await bulk.search(item, filters);

    expect(requests.map((r) => r.body.query.have)).toEqual([['exalted', 'divine', 'chaos'], ['exalted']]);
    expect(bulk.selected()).toBe('exalted');
    expect(bulk.current()?.listed.map((r) => r.exchangeAmount)).toEqual([1, 2, 10, 15, 30, 60, 100, 111]);
    expect(bulk.current()?.total).toBe(9);
    // EE2 subtracts it from its guess for divine, here an exact count of the first page (20).
    expect(bulk.results().divine?.total).toBe(11);
  });
});

describe('pickHave', () => {
  it('falls back to the first currency when nothing was found', () => {
    expect(pickHave(['exalted', 'divine'], {}, PRICES.rune)).toBe('exalted');
  });
});
