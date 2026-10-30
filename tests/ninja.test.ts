import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseClipboard, type ParsedItem } from '@/parser';
import { POE_NINJA_REFRESH_MS } from '../src/app/constants';
import { currencyRates, requestNinjaPrices, setNinjaClock, toDivine, trackCurrencyRates } from '../src/app/core/currency-rates';
import { setHttpFetch } from '../src/app/core/http';
import {
  autoCurrency,
  buildPriceDb,
  divineFractions,
  formatAmount,
  formatValue,
  idsToPrice,
  itemQuote,
  lookupPrice,
  type NinjaPrice,
  ninjaLeagueSlug,
  ninjaTypesFor,
  ninjaUrl,
  priceTrend,
  pricesFromOverview,
  ratesFromCore,
  relatedItems,
  sparkline,
} from '../src/app/core/ninja-prices';
import { usePoeninja } from '../src/app/ee2-shims/prices';
import { loadGameDataFromDisk } from './game-data';
import * as items from './items';

beforeAll(loadGameDataFromDisk);

/** Live answers of the official poe.ninja PoE2 API, Forbidden Rites, 28 and 30.10.2026 (some trimmed). */
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/ninja-poe2-${name}.json`, import.meta.url), 'utf-8'));
const OVERVIEWS: Record<string, any> = {
  Currency: fixture('exchange-currency'),
  Fragments: fixture('exchange-fragments'),
  Breach: fixture('exchange-breach'),
  UncutGems: fixture('exchange-uncutgems'),
  LineageSupportGems: fixture('exchange-lineagesupportgems'),
  Runes: fixture('exchange-runes'),
  Idols: fixture('exchange-idols'),
  UniqueAccessories: fixture('stash-uniqueaccessories'),
};
const RATES = ratesFromCore(OVERVIEWS['Currency'].core)!;
const parsed = () => Object.entries(OVERVIEWS).map(([type, data]) => pricesFromOverview(type, data));
let DB: ReturnType<typeof buildPriceDb>;
const LOADED = new Map(Object.keys(OVERVIEWS).map((type) => [type, 'loaded' as const]));

const parse = (text: string): ParsedItem => parseClipboard(text)._unsafeUnwrap();

const DIVINE_ORB = `Item Class: Stackable Currency
Rarity: Currency
Divine Orb
--------
Stack Size: 3/20
--------
Randomises the numeric values of the random modifiers on an item
`;

beforeAll(() => {
  DB = buildPriceDb(parsed());
});

describe('poe.ninja overviews', () => {
  it('reads the divine → exalted / chaos rates from core', () => {
    expect(RATES).toEqual({ exalted: 672.9, chaos: 10.2 });
    expect(ratesFromCore({ primary: 'chaos', secondary: 'divine', rates: { exalted: 1, chaos: 1 } })).toBeNull();
  });

  it('names exchange lines from items[] and keeps their sparkline', () => {
    const exalted = lookupPrice(DB, { ns: 'ITEM', name: 'Exalted Orb' })!;
    expect(exalted).toMatchObject({ type: 'Currency', primaryValue: 0.001486, detailsId: 'exalted-orb' });
    expect(exalted.sparkline.totalChange).toBe(2.79);
    expect(lookupPrice(DB, { ns: 'GEM', name: "Ixchel's Torment" })?.type).toBe('LineageSupportGems');
    expect(lookupPrice(DB, { ns: 'ITEM', name: 'Uncut Skill Gem (Level 19)' })?.primaryValue).toBe(0.01524);
  });

  it('reads stash lines (sparkLine) and skips uniques with too few listings', () => {
    const lines = pricesFromOverview('UniqueAccessories', OVERVIEWS['UniqueAccessories']);
    const names = lines.map((line) => line.name);
    expect(names).toContain('Mageblood');
    expect(names).not.toContain('The Gnashing Sash'); // 5,060 div from 6 listings
    expect(names).not.toContain('Bursting Decay'); // 8 listings
    const mageblood = lookupPrice(DB, { ns: 'UNIQUE', name: 'Mageblood', variant: 'Utility Belt' })!;
    expect(mageblood).toMatchObject({ primaryValue: 140, listingCount: 7482 });
    expect(mageblood.sparkline.data).toEqual([null, 0, 0, 3.5, -2.8, null, -2.1]);
    // By name alone too (EE2 gives flasks no base).
    expect(lookupPrice(DB, { ns: 'UNIQUE', name: 'Mageblood' })).toBe(mageblood);
  });

  it('skips exchange lines that hardly trade', () => {
    const data = {
      core: OVERVIEWS['Currency'].core,
      lines: [
        { id: 'a', primaryValue: 1, volumePrimaryValue: 0.05 },
        { id: 'b', primaryValue: 0.001, volumePrimaryValue: 0.001 },
      ],
      items: [
        { id: 'a', name: 'A', detailsId: 'a' },
        { id: 'b', name: 'B', detailsId: 'b' },
      ],
    };
    expect(pricesFromOverview('Currency', data).map((line) => line.name)).toEqual(['B']);
  });

  it('prefers a line that is not corrupted for the same name', () => {
    const line = (primaryValue: number, corrupted: boolean): NinjaPrice => ({
      type: 'UniqueAccessories', ns: 'UNIQUE', name: 'X', variant: 'Ring', primaryValue, detailsId: 'x', sparkline: { totalChange: 0, data: [] }, corrupted,
    });
    expect(lookupPrice(buildPriceDb([[line(9, true), line(2, false)]]), { ns: 'UNIQUE', name: 'X', variant: 'Ring' })?.primaryValue).toBe(2);
  });
});

describe('which overview lists an item', () => {
  it('routes stackables by game data category and name', () => {
    expect(ninjaTypesFor({ ns: 'ITEM', name: 'Exalted Orb' })).toEqual(['Currency']);
    expect(ninjaTypesFor({ ns: 'ITEM', name: 'Greater Iron Rune' })).toEqual(['Runes', 'SoulCores', 'Idols']);
    expect(ninjaTypesFor({ ns: 'ITEM', name: "Atziri's Soul Core of Alacrity" })).toEqual(['SoulCores']);
    expect(ninjaTypesFor({ ns: 'ITEM', name: 'Wolf Idol' })).toEqual(['Idols']);
    expect(ninjaTypesFor({ ns: 'ITEM', name: 'Omen of Light' })).toEqual(['Ritual']);
    expect(ninjaTypesFor({ ns: 'ITEM', name: 'Greater Essence of Ice' })).toEqual(['Essences']);
    expect(ninjaTypesFor({ ns: 'ITEM', name: 'Reaver Catalyst' })).toEqual(['Breach']);
    expect(ninjaTypesFor({ ns: 'ITEM', name: 'Breach Splinter' })).toEqual(['Breach']);
    expect(ninjaTypesFor({ ns: 'ITEM', name: 'Deadly Fate' })).toEqual(['Fragments']);
    expect(ninjaTypesFor({ ns: 'ITEM', name: 'Uncut Skill Gem (Level 19)' })).toEqual(['UncutGems']);
  });

  it('routes lineage gems and uniques by their base; nothing for rares and skill gems', () => {
    expect(ninjaTypesFor({ ns: 'GEM', name: "Ixchel's Torment" })).toEqual(['LineageSupportGems']);
    expect(ninjaTypesFor({ ns: 'GEM', name: 'Mirage Archer' })).toEqual([]);
    expect(ninjaTypesFor({ ns: 'UNIQUE', name: 'Mageblood', variant: 'Utility Belt' })).toEqual(['UniqueAccessories']);
    expect(ninjaTypesFor({ ns: 'UNIQUE', name: 'The Eternal Spark', variant: 'Crystal Focus' })).toEqual(['UniqueArmours']);
    const ring = parse(items.RARE_RING);
    expect(ninjaTypesFor({ ns: 'ITEM', name: ring.info.refName })).toEqual([]);
  });
});

describe('prices as shown', () => {
  it('shows divines from about one up, exalted below, like EE2', () => {
    expect(autoCurrency(0.5, RATES)).toEqual({ min: 336.45, max: 336.45, currency: 'exalted' });
    expect(autoCurrency(0.97, RATES)).toEqual({ min: 1, max: 1, currency: 'div' });
    expect(autoCurrency(3, RATES)).toEqual({ min: 3, max: 3, currency: 'div' });
    expect(autoCurrency(1, RATES, 'exalted', true).currency).toBe('exalted');
    expect(autoCurrency(0.5, RATES, 'chaos')).toEqual({ min: 5.1, max: 5.1, currency: 'chaos' });
  });

  it('formats amounts compactly', () => {
    expect(formatAmount(0.01516)).toBe('0.015');
    expect(formatAmount(0.2435)).toBe('0.24');
    expect(formatAmount(3.82)).toBe('3.8');
    expect(formatAmount(672.9)).toBe('673');
    expect(formatValue({ min: 1.5, max: 1.5, currency: 'div' })).toBe('1.5 div');
    expect(formatValue({ min: 12, max: 12, currency: 'exalted' })).toBe('12 ex');
    expect(formatValue({ min: 0.2, max: 0.2, currency: 'chaos' })).toBe('0.2 c');
  });

  it('builds the divine → exalted · chaos tooltip rows', () => {
    const rows = divineFractions(RATES);
    expect(rows).toHaveLength(10);
    expect(rows[0].exalted).toBeCloseTo(67.29);
    expect(rows[0].chaos).toBeCloseTo(1.02);
    expect(rows[9]).toEqual({ divine: 1, exalted: 672.9, chaos: 10.2 });
  });

  it('converts listing prices to divines', () => {
    expect(toDivine(2, 'divine', RATES, DB)).toBe(2);
    expect(toDivine(672.9, 'exalted', RATES, DB)).toBe(1);
    expect(toDivine(5.1, 'chaos', RATES, DB)).toBe(0.5);
    expect(toDivine(2, 'vaal', RATES, DB)).toBeCloseTo(0.03022);
    expect(toDivine(1, 'exalted', null, DB)).toBeUndefined();
  });
});

describe('item quotes', () => {
  it('prices a currency in exalted with chaos next to it, the orbs themselves in the other one', () => {
    const divine = itemQuote(DB, LOADED, RATES, parse(DIVINE_ORB), 'Forbidden Rites')!;
    expect(divine.value).toEqual({ min: 672.9, max: 672.9, currency: 'exalted' });
    expect(divine.also).toEqual([{ amount: 10.2, currency: 'chaos' }]);

    const exalted = itemQuote(DB, LOADED, RATES, parse(items.CURRENCY_EXALTED), 'Forbidden Rites')!;
    expect(exalted.value?.currency).toBe('chaos');
    expect(exalted.value?.min).toBeCloseTo(0.01516);
    expect(exalted.also).toEqual([]); // not "1 ex" for an Exalted Orb
    expect(exalted.url).toBe('https://poe.ninja/poe2/economy/forbiddenrites/currency/exalted-orb');
    expect(exalted.trend?.change).toBe(2.79);
    expect(exalted.traded).toEqual({ perHour: expect.closeTo(377390, -2) });

    const chaos = itemQuote(DB, LOADED, RATES, parse(items.CURRENCY_CHAOS), 'Forbidden Rites')!;
    expect(formatValue(chaos.value)).toBe('66 ex');
    expect(chaos.also).toEqual([]);
  });

  it('prices uncut gems by level and runes', () => {
    const gem = itemQuote(DB, LOADED, RATES, parse(items.UNCUT_GEM), 'Forbidden Rites')!;
    expect(gem.label).toBe('Uncut Skill Gem (Level 19)');
    expect(formatValue(gem.value)).toBe('10 ex');
    expect(gem.also.map((a) => a.currency)).toEqual(['chaos']);
    const rune = itemQuote(DB, LOADED, RATES, parse(readFileSync(new URL('./fixtures/items/rune.txt', import.meta.url), 'utf-8')), 'Forbidden Rites')!;
    expect(rune.price?.type).toBe('Runes');
    expect(formatValue(rune.value)).toBe('4.9 ex');
  });

  it('tells a type still loading from no price, and kinds poe.ninja has no prices for', () => {
    const focus = parse(items.UNIQUE_FOCUS);
    const loading = itemQuote(DB, LOADED, RATES, focus, 'Forbidden Rites')!;
    expect(loading.types).toEqual(['UniqueArmours']);
    expect(loading).toMatchObject({ price: undefined, pending: true });
    const failed = itemQuote(DB, new Map([['UniqueArmours', 'error']]), RATES, focus, 'Forbidden Rites')!;
    expect(failed.pending).toBe(false);
    expect(itemQuote(DB, LOADED, RATES, parse(items.RARE_RING), 'Forbidden Rites')).toBeNull();
    expect(itemQuote(DB, LOADED, RATES, parse(items.WAYSTONE), 'Forbidden Rites')).toBeNull();
  });

  it('links to the item page in poe.ninja league slugs', () => {
    expect(ninjaLeagueSlug('Forbidden Rites')).toBe('forbiddenrites');
    expect(ninjaLeagueSlug('HC Forbidden Rites')).toBe('forbiddenriteshc');
    expect(ninjaLeagueSlug('Standard')).toBe('standard');
    const mageblood = lookupPrice(DB, { ns: 'UNIQUE', name: 'Mageblood' })!;
    expect(ninjaUrl(mageblood, 'Runes of Aldur')).toBe('https://poe.ninja/poe2/economy/runesofaldur/unique-accessories/mageblood-utility-belt');
  });

  it('reads the week change from the cumulative graph', () => {
    expect(priceTrend([0.5, 2, 3, 2, 4, 5, 6])!.change).toBe(6);
    expect(priceTrend([-0.2, -2, -1, -3, -2, null, null])!.change).toBe(-2);
    expect(priceTrend([null, null, 3, null, null, null, null])).toBeNull();
  });

  it('draws the sparkline over the 7 day slots, keeping gaps', () => {
    const spark = sparkline([null, 0, 10, null, null, null, 20], 60, 20);
    expect(spark.line).toBe('M10,20 L20,10 L60,0');
    expect(spark.area).toBe('M10,20 L20,10 L60,0 L60,20 L10,20 Z');
    expect(spark.zeroY).toBe(20);
  });
});

describe('related items', () => {
  it('lists the set and what it drops, with prices from the same index', () => {
    const group = relatedItems('ITEM::Deadly Fate', DB);
    if (!group || 'error' in group) throw new Error(`unexpected ${JSON.stringify(group)}`);
    expect(group.related.map((e) => [e.name, e.div, e.highlight])).toEqual([
      ['Deadly Fate', 13.44, true],
      ['Victorious Fate', 9.47, false],
      ['Cowardly Fate', 11.49, false],
    ]);
    expect(group.items.find((e) => e.name === "Ixchel's Torment")?.div).toBe(0.286);
    expect(group.items.find((e) => e.name === "Zerphi's Genesis")?.div).toBeUndefined(); // not in the trimmed fixture
    const exalted = relatedItems('ITEM::Exalted Orb', DB);
    expect(exalted && 'related' in exalted && exalted.related.map((e) => e.name)).toEqual(['Exalted Orb', 'Greater Exalted Orb', 'Perfect Exalted Orb']);
    expect(relatedItems('GEM::Mirage Archer', DB)).toBeNull();
  });

  it('asks for the prices of the item and its related items', () => {
    const ids = idsToPrice(parse(items.UNIQUE_FOCUS));
    expect(ids[0]).toBe('UNIQUE::The Eternal Spark // Crystal Focus');
  });
});

describe('loading poe.ninja', () => {
  let requests: Array<{ type: string; ifNoneMatch: string | null }> = [];
  let clock = Date.parse('2026-10-30T10:00:00Z');
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeAll(() => {
    setNinjaClock(() => clock);
    setHttpFetch(async (input, init) => {
      const url = new URL(String(input));
      const type = url.searchParams.get('type')!;
      const ifNoneMatch = new Headers(init?.headers).get('If-None-Match');
      requests.push({ type, ifNoneMatch });
      expect(new Headers(init?.headers).get('User-Agent')).toMatch(/^PriceOfExile2\//);
      expect(url.searchParams.get('league')).toBe('Forbidden Rites');
      const etag = `W/${type}`;
      if (ifNoneMatch === etag) return new Response(null, { status: 304, headers: { etag } });
      const data = OVERVIEWS[type] ?? { core: OVERVIEWS['Currency'].core, lines: [], items: [] };
      return Response.json(data, { headers: { etag } });
    });
  });

  afterAll(() => trackCurrencyRates(undefined));

  it('loads the rates with the league, other types when an item of them is checked', async () => {
    trackCurrencyRates('Forbidden Rites');
    await flush();
    expect(requests).toEqual([{ type: 'Currency', ifNoneMatch: null }]);
    expect(currencyRates.rates()).toEqual(RATES);
    expect(currencyRates.updatedAt()).not.toBeNull();

    requests = [];
    requestNinjaPrices(['ITEM::Greater Iron Rune', 'ITEM::Exalted Orb']);
    requestNinjaPrices(['ITEM::Greater Iron Rune']); // already on its way
    await flush();
    expect(requests.map((r) => r.type)).toEqual(['Runes']);
    expect(lookupPrice(currencyRates.prices(), { ns: 'ITEM', name: 'Greater Iron Rune' })?.primaryValue).toBe(0.007355);

    requests = [];
    requestNinjaPrices(['ITEM::Greater Iron Rune']);
    await flush();
    expect(requests).toEqual([]);
  });

  it('tries the next type that may list an item, one at a time', async () => {
    requests = [];
    const id = 'ITEM::Legacy of Ashrend'; // a SoulCore-category item: Runes, then SoulCores, then Idols
    for (let i = 0; i < 4; i++) {
      requestNinjaPrices([id]);
      await flush();
    }
    expect(requests.map((r) => r.type)).toEqual(['SoulCores', 'Idols']); // Runes is loaded already
    expect(currencyRates.states().get('Idols')).toBe('loaded');
  });

  it('asks again after the refresh time with If-None-Match and keeps the prices on 304', async () => {
    requests = [];
    clock += POE_NINJA_REFRESH_MS;
    requestNinjaPrices(['ITEM::Greater Iron Rune']);
    await flush();
    expect(requests).toEqual([
      { type: 'Currency', ifNoneMatch: 'W/Currency' },
      { type: 'Runes', ifNoneMatch: 'W/Runes' },
    ]);
    expect(lookupPrice(currencyRates.prices(), { ns: 'ITEM', name: 'Greater Iron Rune' })).toBeDefined();
    expect(currencyRates.rates()).toEqual(RATES);
  });

  it('backs the EE2 usePoeninja interface', () => {
    const ninja = usePoeninja();
    expect(ninja.xchgRate.value).toBe(672.9);
    expect(ninja.xchgRateCurrency.value?.id).toBe('exalted');
    const exalted = ninja.findPriceByQuery({ ns: 'ITEM', name: 'Exalted Orb' })!;
    expect(exalted).toMatchObject({ primaryValue: 0.001486, cx: true });
    expect(exalted.url).toBe('https://poe.ninja/poe2/economy/forbiddenrites/currency/exalted-orb');
    expect(ninja.cachedCurrencyByQuery({ ns: 'ITEM', name: 'Divine Orb' }, 2)).toEqual({ min: 2, max: 2, currency: 'div' });
    expect(ninja.cachedCurrencyByQuery({ ns: 'ITEM', name: 'Chaos Orb' }, 3)?.currency).toBe('exalted');
    expect(ninja.cachedCurrencyByQuery({ ns: 'nan ns', name: 'nan item' }, 1)).toBeUndefined();
    expect(ninja.autoCurrency(0.5)).toEqual({ min: 336.45, max: 336.45, currency: 'exalted' });
    const sum = ninja.addPrice({ min: 336.45, max: 336.45, currency: 'exalted' }, { min: 1, max: 1, currency: 'div' });
    expect(sum).toEqual({ min: 1.5, max: 1.5, currency: 'div' });
    expect(ninja.comparePrice({ min: 2, max: 2, currency: 'div' }, '>', { min: 100, max: 100, currency: 'exalted' })).toBe(true);
    expect(ninja.ITEM_DROP.value.length).toBeGreaterThan(0);
  });

  it('starts over for another league', async () => {
    trackCurrencyRates(undefined);
    expect(currencyRates.rates()).toBeNull();
    expect(currencyRates.prices().size).toBe(0);
  });
});
