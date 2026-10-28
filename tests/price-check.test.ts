import { beforeAll, describe, expect, it } from 'vitest';
import { parseClipboard, type ParsedItem } from '@/parser';
import { createTradeRequest } from '../src/lib/apt/web/price-check/trade/pathofexile-trade';
import type { StatFilter } from '../src/lib/apt/web/price-check/filters/interfaces';
import { USER_AGENT } from '../src/app/constants';
import { setHttpFetch } from '../src/app/core/http';
import { activePreset, createItemPresets, shouldSearchImmediately } from '../src/app/price-check/price-check';
import { TradeSearch, tradeSiteUrl } from '../src/app/price-check/trade-search';
import { loadGameDataFromDisk } from './game-data';
import * as items from './items';

beforeAll(loadGameDataFromDisk);

const parse = (text: string): ParsedItem => parseClipboard(text)._unsafeUnwrap();

describe('createItemPresets', () => {
  it('builds pseudo stat filters for a rare ring', () => {
    const presets = createItemPresets(parse(items.RARE_RING), 'Allflame');
    expect(presets.active).toBe('filters.preset_pseudo');
    expect(presets.presets.map((p) => p.id)).toEqual(['filters.preset_pseudo', 'mods', 'filters.preset_base_item']);

    const stats = activePreset(presets).stats as StatFilter[];
    const byRef = (ref: string) => stats.find((s) => s.statRef === ref);
    // Min is the roll minus searchStatRange (10%).
    expect(byRef('+# total maximum Life')).toMatchObject({ disabled: false, roll: { value: 68, min: 61 } });
    // Cold (implicit) + fire + lightning resistances merge into one pseudo stat.
    expect(byRef('+#% total Elemental Resistance')).toMatchObject({ disabled: false, roll: { value: 110, min: 99 } });
    expect(byRef('+#% total to Fire Resistance')).toMatchObject({ disabled: true, hidden: 'filters.hide_ele_res' });
  });

  it('has a Mods preset with every mod on its own instead of pseudo totals', () => {
    const presets = createItemPresets(parse(items.RARE_RING), 'Allflame');
    const mods = presets.presets.find((p) => p.id === 'mods')!.stats as StatFilter[];
    const refs = mods.map((s) => s.statRef);
    expect(refs).toContain('+# to maximum Life');
    expect(refs).toContain('+#% to Fire Resistance');
    expect(refs).not.toContain('+# total maximum Life');
    expect(mods.every((s) => s.tag !== 'pseudo')).toBe(true);
  });

  it('uses the selected league and merchant-only listings', () => {
    const { filters } = activePreset(createItemPresets(parse(items.RARE_RING), 'Allflame'));
    expect(filters.trade).toMatchObject({ league: 'Allflame', merchantOnly: true });
  });
});

describe('createTradeRequest', () => {
  it('turns enabled stat filters into a trade query', () => {
    const { filters, stats } = activePreset(createItemPresets(parse(items.RARE_RING), 'Allflame'));
    const body = createTradeRequest(filters, stats);
    const ids = body.query.stats.flatMap((group) => group.filters.filter((f) => !f.disabled).map((f) => f.id));
    expect(ids.length).toBeGreaterThan(0);
    expect(body.sort).toEqual({ price: 'asc' });
  });
});

describe('shouldSearchImmediately', () => {
  it('searches uniques and currency right away, but not rares', () => {
    const check = (text: string) => {
      const item = parse(text);
      return shouldSearchImmediately(item, createItemPresets(item, 'Allflame'));
    };
    expect(check(items.UNIQUE_TABULA)).toBe(true);
    expect(check(items.CURRENCY_CHAOS)).toBe(true);
    expect(check(items.RARE_RING)).toBe(false);
  });
});

describe('TradeSearch', () => {
  // Generous limits, as the trade API reports them in headers, so the test does not wait.
  const limitHeaders = {
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': '100:1:1',
    'x-rate-limit-ip-state': '0:1:0',
  };
  const listing = (id: string, account: string, amount: number) => ({
    id,
    item: { ilvl: 84 },
    listing: {
      indexed: new Date().toISOString(),
      price: { amount, currency: 'chaos', type: '~price' },
      fee: 0,
      account: { name: account, lastCharacterName: `${account}_char`, online: {} },
    },
  });

  it('searches, fetches listings in chunks of 10 and keeps their order', async () => {
    const ids = Array.from({ length: 15 }, (_, i) => `id${i}`);
    const requests: Array<{ url: string; method: string; userAgent: string | null }> = [];
    setHttpFetch(async (input, init) => {
      const url = String(input);
      requests.push({ url, method: init?.method ?? 'GET', userAgent: new Headers(init?.headers).get('User-Agent') });
      if (url.includes('/api/trade/search/')) {
        return Response.json({ id: 'Q1', result: ids, total: 15 }, { headers: limitHeaders });
      }
      const chunk = new URL(url).pathname.split('/').pop()!.split(',');
      return Response.json({ result: chunk.map((id, i) => listing(id, `seller_${id}`, 10 + i)) }, { headers: limitHeaders });
    });

    const { filters, stats } = activePreset(createItemPresets(parse(items.UNIQUE_TABULA), 'Allflame'));
    const search = new TradeSearch();
    await search.search(filters, stats);

    expect(search.error()).toBeNull();
    expect(search.searchResult()?.total).toBe(15);
    expect(search.rows().map((r) => r.id)).toEqual(ids);
    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname.split('/').slice(0, 4).join('/')}`)).toEqual([
      'POST /api/trade/search',
      'GET /api/trade/fetch',
      'GET /api/trade/fetch',
    ]);
    expect(requests.every((r) => r.userAgent === USER_AGENT)).toBe(true);
    expect(tradeSiteUrl(filters, stats, 'Q1')).toBe('https://www.pathofexile.com/trade/search/Allflame/Q1');
  });

  it('reports trade API errors', async () => {
    setHttpFetch(async () => Response.json({ error: { code: 2, message: 'Invalid query' } }, { headers: limitHeaders }));
    const { filters, stats } = activePreset(createItemPresets(parse(items.CURRENCY_CHAOS), 'Allflame'));
    // Different query than above, so the response cache does not answer it.
    filters.trade.offline = true;
    const search = new TradeSearch();
    await search.search(filters, stats);
    expect(search.error()).toBe('Invalid query');
    expect(search.isSearching()).toBe(false);
  });

  it('ends with a message on a network error, not a stuck "Searching"', async () => {
    setHttpFetch(async () => {
      throw new TypeError('error sending request');
    });
    const { filters, stats } = activePreset(createItemPresets(parse(items.GEM_ARC), 'Allflame'));
    const search = new TradeSearch();
    await search.search(filters, stats);
    expect(search.error()).toContain('error sending request');
    expect(search.isSearching()).toBe(false);
  });
});
