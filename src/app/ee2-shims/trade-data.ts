/**
 * Stands in for EE2 `@/web/background/TradeData` (`useTradeData`). EE2 loads the trade site's
 * `/api/trade2/data/{items,stats}` and lets the parser fall back to them for bases and mods
 * missing from items.ndjson / stats.ndjson (`TRADE_ITEM_BY_REF`, `TRADE_STAT_BY_MATCH_STR`).
 *
 * Stub until stage 2 (HTTP layer, PLAN §6): the sets stay empty, so the parser knows only the
 * local game data, and an item with an unknown base or mod parses as EE2 does offline.
 * Same shape as EE2's (`.value` holders instead of Vue refs).
 */

const state = {
  isLoading: { value: false },
  error: { value: null as string | null },
  tradeItemData: { value: new Set<string>() as ReadonlySet<string> },
  /** Translated stat text → trade stat ids per mod type (`explicit`, `implicit`, …). */
  tradeStatData: { value: new Map() as ReadonlyMap<string, { [type: string]: string[] }> },
  tradeStatDataSet: { value: new Set<string>() as ReadonlySet<string> },
};

export function useTradeData() {
  return {
    ...state,
    expressInterest: () => {},
    /** EE2 returns how many items and stats the download added. */
    load: async (_force = false): Promise<{ foundItems: number; foundStats: number }> => ({ foundItems: 0, foundStats: 0 }),
  };
}
