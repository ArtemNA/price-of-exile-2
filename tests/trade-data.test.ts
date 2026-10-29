import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TRADE_DATA_ITEMS_URL, TRADE_DATA_STATS_URL } from '../src/app/constants';
import { setHttpFetch } from '../src/app/core/http';
import { toItemData, toStatData, useTradeData } from '../src/app/ee2-shims/trade-data';

/** Parts of the live /api/trade2/data/{items,stats} (29.10.2026): 3 categories, 5 entries each. */
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf-8');
const ITEMS = fixture('trade2-data-items-sample.json');
const STATS = fixture('trade2-data-stats-sample.json');

afterEach(() => vi.useRealTimers());

describe('trade data', () => {
  it('collects base types and unique names', () => {
    const items = toItemData(JSON.parse(ITEMS).result);
    const first = JSON.parse(ITEMS).result[0].entries[0];
    expect(items.has(first.type)).toBe(true);
    expect(items.size).toBeGreaterThan(5);
  });

  it('maps stat text to its ids per mod type', () => {
    const [stats, ids] = toStatData(JSON.parse(STATS).result);
    const pseudo = JSON.parse(STATS).result[0];
    expect(pseudo.id).toBe('pseudo');
    expect(stats.get(pseudo.entries[0].text)?.pseudo).toContain(pseudo.entries[0].id);
    expect(ids.size).toBe(15);
  });

  it('loads both lists in the background at start-up, without holding up the caller', async () => {
    const requested: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    setHttpFetch(async (input) => {
      requested.push(String(input));
      await gate;
      return new Response(String(input) === TRADE_DATA_ITEMS_URL ? ITEMS : STATS, { status: 200 });
    });

    const trade = useTradeData();
    expect(await trade.load(true)).toEqual({ foundItems: 0, foundStats: 0 });
    expect(trade.tradeStatDataSet.value.size).toBe(0);
    expect(requested.sort()).toEqual([TRADE_DATA_ITEMS_URL, TRADE_DATA_STATS_URL].sort());

    release();
    await vi.waitFor(() => expect(trade.tradeStatDataSet.value.size).toBe(15));
    expect(trade.isLoading.value).toBe(false);
    expect(trade.error.value).toBeNull();
  });
});
