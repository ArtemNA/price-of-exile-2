/**
 * Stands in for EE2 `@/web/background/TradeData` (`useTradeData`), same logic and shape
 * (`.value` holders instead of Vue refs). EE2 loads the trade site's `/api/trade2/data/{items,stats}`
 * and lets the parser fall back to them for bases and mods missing from items.ndjson /
 * stats.ndjson (`TRADE_ITEM_BY_REF`, `TRADE_STAT_BY_MATCH_STR`), e.g. after a patch the game data
 * has not caught up with yet.
 *
 * One difference: EE2 waits for the download before the game data counts as loaded; here the
 * start-up load runs in the background, so a slow or blocked pathofexile.com never holds up the
 * first price check. Until it arrives the parser knows only the local data.
 */
import { poeFetch } from '../core/http';
import {
  TRADE_DATA_INTEREST_SPAN,
  TRADE_DATA_ITEMS_URL,
  TRADE_DATA_RETRY_INTERVAL,
  TRADE_DATA_STATS_URL,
  TRADE_DATA_UPDATE_INTERVAL,
} from '../constants';

interface TradeItem {
  type: string;
  text?: string;
  name?: string;
  flags?: { unique: true };
}

interface TradeStat {
  id: string;
  text: string;
}

type StatData = Map<string, { [type: string]: string[] }>;

const state = {
  isLoading: { value: false },
  error: { value: null as string | null },
  /** Ref names of bases, uniques and gems the trade site knows. */
  tradeItemData: { value: new Set<string>() as ReadonlySet<string> },
  /** Stat text → trade stat ids per mod type (`explicit`, `implicit`, …). */
  tradeStatData: { value: new Map() as ReadonlyMap<string, { [type: string]: string[] }> },
  tradeStatDataSet: { value: new Set<string>() as ReadonlySet<string> },
};

let lastUpdateTime = 0;
let lastInterestTime = 0;
let downloadController: AbortController | undefined;
let timer: ReturnType<typeof setInterval> | undefined;

/** Stat text → ids per mod type, as EE2 `loadStatData`. */
export function toStatData(result: Array<{ id: string; entries: TradeStat[] }>): [StatData, Set<string>] {
  const statData: StatData = new Map();
  const statIds = new Set<string>();
  for (const { id: modType, entries } of result) {
    for (const { id: statId, text: matcher } of entries) {
      let modMap = statData.get(matcher);
      if (!modMap) {
        modMap = {};
        statData.set(matcher, modMap);
      }
      (modMap[modType] ??= []).push(statId);
      statIds.add(statId);
    }
  }
  return [statData, statIds];
}

/** Every base type and unique name the trade site knows, as EE2 `loadItemData`. */
export function toItemData(result: Array<{ entries: TradeItem[] }>): Set<string> {
  const items = new Set<string>();
  for (const category of result) {
    for (const { type, text } of category.entries) {
      if (type) items.add(type);
      if (text) items.add(text);
    }
  }
  return items;
}

// English (ref) data whatever the game language: the parser matches ref names, as in EE2.
async function download<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await poeFetch(url, { signal });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return ((await response.json()) as { result: T }).result;
}

async function update(): Promise<{ foundItems: number; foundStats: number }> {
  downloadController?.abort();
  const controller = (downloadController = new AbortController());
  let foundItems = 0;
  let foundStats = 0;
  try {
    state.isLoading.value = true;
    state.error.value = null;
    const [items, stats] = await Promise.all([
      download<Array<{ entries: TradeItem[] }>>(TRADE_DATA_ITEMS_URL, controller.signal),
      download<Array<{ id: string; entries: TradeStat[] }>>(TRADE_DATA_STATS_URL, controller.signal),
    ]);
    const itemData = toItemData(items);
    const [statData, statIds] = toStatData(stats);
    foundItems = itemData.size - state.tradeItemData.value.size;
    foundStats = statIds.size - state.tradeStatDataSet.value.size;
    // Never replace the data with a smaller set (EE2: "don't regress").
    if (foundItems > 0 && foundStats > 0) {
      state.tradeItemData.value = itemData;
      state.tradeStatData.value = statData;
      state.tradeStatDataSet.value = statIds;
    }
    lastUpdateTime = Date.now();
  } catch (e) {
    if (!controller.signal.aborted) {
      console.warn('Trade data:', e);
      state.error.value = e instanceof Error ? e.message : String(e);
    }
  } finally {
    if (downloadController === controller) state.isLoading.value = false;
  }
  return { foundItems, foundStats };
}

async function load(force = false): Promise<{ foundItems: number; foundStats: number }> {
  timer ??= setInterval(() => void load(), TRADE_DATA_RETRY_INTERVAL);
  const now = Date.now();
  // Not more often than every TRADE_DATA_UPDATE_INTERVAL, and only while items are being checked.
  if (!force && (now - lastUpdateTime < TRADE_DATA_UPDATE_INTERVAL || now - lastInterestTime > TRADE_DATA_INTEREST_SPAN)) {
    return { foundItems: 0, foundStats: 0 };
  }
  if (force) {
    // The start-up load (`loadForLang`): in the background, see the header.
    void update();
    return { foundItems: 0, foundStats: 0 };
  }
  return update();
}

export function useTradeData() {
  return {
    ...state,
    expressInterest: () => {
      lastInterestTime = Date.now();
    },
    load,
  };
}
