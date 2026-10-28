import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseClipboard, type ParsedItem } from '@/parser';
import { chaosRatesFromNinja } from '../src/app/core/currency-rates';
import { setHttpFetch } from '../src/app/core/http';
import {
  bestOffer,
  bulkHaves,
  BulkSearch,
  bulkSiteUrl,
  marketRatio,
  priceOffers,
  stackWorth,
} from '../src/app/price-check/bulk-search';
import { activePreset, createItemPresets } from '../src/app/price-check/price-check';
import { loadGameDataFromDisk } from './game-data';
import * as items from './items';

beforeAll(loadGameDataFromDisk);

/** Real exchange response, chaos → divine, Allflame 26.10.2026 (accounts anonymized). */
const EXCHANGE = JSON.parse(readFileSync(new URL('./fixtures/bulk-chaos-divine.json', import.meta.url), 'utf-8'));
const DIVINE = 342.6;

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

const parse = (text: string): ParsedItem => parseClipboard(text)._unsafeUnwrap();

describe('bulkHaves', () => {
  it('pays chaos for divines, divines for chaos, both for anything else', () => {
    expect(bulkHaves(parse(DIVINE_ORB))).toEqual(['chaos']);
    expect(bulkHaves(parse(items.CURRENCY_CHAOS))).toEqual(['divine']);
  });
});

describe('bait offers', () => {
  const offers = Object.values(EXCHANGE.result).map((result: any) => ({
    id: result.id,
    relativeDate: '',
    exchangeAmount: result.listing.offers[0].exchange.amount,
    itemAmount: result.listing.offers[0].item.amount,
    stock: result.listing.offers[0].item.stock,
    accountStatus: 'online' as const,
    isMine: false,
    accountName: result.listing.account.name,
    ign: result.listing.account.lastCharacterName,
  }));

  it('marks "5 chaos → 1 divine" as bait and skips it for the best offer', () => {
    const rows = priceOffers(offers, 'chaos', DIVINE, DIVINE);
    expect(rows.map((r) => [r.exchangeAmount, r.isBait])).toEqual([
      [5, true], [320, false], [330, false], [350, false], [370, false], [380, false],
    ]);
    expect(bestOffer(rows)?.exchangeAmount).toBe(320);
  });

  it('marks nothing without a poe.ninja price', () => {
    expect(priceOffers(offers, 'chaos', undefined, DIVINE).some((r) => r.isBait)).toBe(false);
  });

  it('converts divine offers to chaos per item', () => {
    const [row] = priceOffers([{ ...offers[1], exchangeAmount: 1, itemAmount: 20 }], 'divine', 15, DIVINE);
    expect(row.chaosPerItem).toBeCloseTo(DIVINE / 20);
    expect(row.isBait).toBe(false);
  });
});

describe('marketRatio (APT)', () => {
  it('prices a divine at its chaos value', () => {
    expect(marketRatio('chaos', DIVINE, DIVINE)).toEqual({ exchangeAmount: DIVINE, itemAmount: 1 });
    expect(marketRatio('divine', DIVINE, DIVINE)).toEqual({ exchangeAmount: 1, itemAmount: 1 });
    // Paying chaos for something worth well over a divine: no chaos ratio (APT).
    expect(marketRatio('chaos', 1000, DIVINE)).toBeUndefined();
  });

  it('uses round amounts for cheap items', () => {
    expect(marketRatio('chaos', 0.5, DIVINE)).toEqual({ exchangeAmount: 10, itemAmount: 20 });
    expect(marketRatio('chaos', 12.5, DIVINE)).toEqual({ exchangeAmount: 12.5, itemAmount: 1 });
  });
});

describe('stackWorth', () => {
  it('shows divines once a stack is worth one', () => {
    expect(stackWorth(12, 12.5, DIVINE, false)).toBe('150 chaos');
    expect(stackWorth(40, 12.5, DIVINE, false)).toBe('1.5 div');
    expect(stackWorth(12, DIVINE, DIVINE, true)).toBe('4111 chaos');
  });
});

describe('poe.ninja bulk prices', () => {
  it('includes stackable item overviews such as essences, not uniques', () => {
    const rates = chaosRatesFromNinja({
      currencyOverviews: [{ type: 'Currency', lines: [{ name: 'Divine Orb', chaos: DIVINE }] }],
      itemOverviews: [
        { type: 'Essence', lines: [{ name: 'Deafening Essence of Doubt', chaos: 6.06 }] },
        { type: 'UniqueArmour', lines: [{ name: 'Tabula Rasa', chaos: 9 }] },
      ],
    });
    expect(rates.get('Deafening Essence of Doubt')).toBe(6.06);
    expect(rates.has('Tabula Rasa')).toBe(false);
  });
});

describe('BulkSearch', () => {
  it('searches the exchange and returns offers sorted by price', async () => {
    let request: { url: string; body: any } | undefined;
    setHttpFetch(async (input, init) => {
      request = { url: String(input), body: JSON.parse(String(init?.body)) };
      return Response.json(EXCHANGE, {
        headers: { 'x-rate-limit-rules': 'Ip', 'x-rate-limit-ip': '100:1:1', 'x-rate-limit-ip-state': '0:1:0' },
      });
    });

    const item = parse(DIVINE_ORB);
    const { filters } = activePreset(createItemPresets(item, 'Allflame'));
    const bulk = new BulkSearch();
    await bulk.search(item, filters);

    expect(request?.url).toBe('https://www.pathofexile.com/api/trade/exchange/Allflame');
    expect(request?.body.query).toMatchObject({ have: ['chaos'], want: ['divine'] });
    expect(bulk.error()).toBeNull();
    expect(bulk.selected()).toBe('chaos');
    expect(bulk.current()?.listed.map((r) => r.exchangeAmount)).toEqual([5, 320, 330, 350, 370, 380]);
    expect(bulkSiteUrl(item, filters, 'chaos')).toContain('/trade/exchange/Allflame?q=');
  });
});
