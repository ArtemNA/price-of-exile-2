import { readdirSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseClipboard } from '@/parser';
import { createTradeRequest } from '../src/lib/ee2/web/price-check/trade/pathofexile-trade';
import { apiToSatisfySearch, tradeTag } from '../src/lib/ee2/web/price-check/trade/common';
import { canCraftOfExile, craftOfExileUrl, itemAction, weaponDps } from '../src/app/core/item-links';
import { idsToPrice, itemQuote, queryId, relatedItems } from '../src/app/core/ninja-prices';
import { settings } from '../src/app/core/settings';
import { isMapLike, mapCheckView } from '../src/app/map-check/map-check';
import { toItemView } from '../src/app/popup-window/item-view';
import { bulkHaves, bulkSiteUrl } from '../src/app/price-check/bulk-search';
import {
  baseSwitch,
  corruptedState,
  groupStats,
  requestFilters,
  signedPseudo,
  sourceLines,
  statCounts,
  statLine,
  statTemplate,
  statTier,
  unrevealedRow,
} from '../src/app/price-check/filter-view';
import { itemFilterChips } from '../src/app/price-check/item-filter-chips';
import { activePreset, createItemPresets, shouldSearchImmediately } from '../src/app/price-check/price-check';
import { tradeSiteUrl } from '../src/app/price-check/trade-search';
import { identifiedVariants, identifyAs, needsIdentification } from '../src/app/price-check/unidentified';
import { loadGameDataFromDisk } from './game-data';

// Every item text of tests/fixtures/items through what the popup computes for it: price check
// (every preset, its filters, chips, stat rows, the trade and bulk requests), poe.ninja, item
// check and map check. With the advanced descriptions and without them (plain Ctrl+C), the way
// the game copies when the overlay pressed the wrong key: nothing may throw.

beforeAll(loadGameDataFromDisk);

const FIXTURES = new URL('./fixtures/items/', import.meta.url);
const files = readdirSync(FIXTURES).filter((file) => file.endsWith('.txt'));
const advanced = (file: string) => readFileSync(new URL(file, FIXTURES), 'utf-8');
/** Ctrl+C: no `{ … }` headers and no roll ranges. */
const plain = (file: string) =>
  advanced(file)
    .replace(/^\{ .* \}\r?\n/gm, '')
    .replace(/(\d+)\(\d+(?:\.\d+)?-\d+(?:\.\d+)?\)/g, '$1');

/** What the popup shows for `text`: 'item' or the parser's error key. */
function check(text: string): string {
  const parsed = parseClipboard(text);
  if (parsed.isErr()) return parsed.error;
  let item = parsed.value;
  if (needsIdentification(item)) {
    const variants = identifiedVariants(item);
    if (variants.length) item = identifyAs(item, variants[0]);
  }
  toItemView(item);

  const presets = createItemPresets(item, 'Standard');
  shouldSearchImmediately(item, presets);
  for (const preset of presets.presets) {
    const { filters, stats } = activePreset({ ...presets, active: preset.id });
    itemFilterChips(filters);
    baseSwitch(filters);
    corruptedState(filters);
    groupStats(stats, unrevealedRow(item, filters));
    statCounts(stats);
    for (const filter of stats) {
      statTier(filter, item);
      const template = filter.tag === 'pseudo' ? signedPseudo(statTemplate(filter)) : statTemplate(filter);
      statLine(template, filter.roll?.value, item.rawText);
      sourceLines(filter, item.rawText);
    }
    apiToSatisfySearch(item, stats, filters);
    createTradeRequest(requestFilters(filters), stats, item);
    tradeSiteUrl(filters, stats, item);
    if (tradeTag(item) != null) for (const have of bulkHaves(item)) bulkSiteUrl(item, filters, have);
  }

  // poe.ninja before anything has loaded.
  const quote = itemQuote(new Map(), new Map(), null, item, 'Standard');
  if (quote?.query) relatedItems(queryId(quote.query), new Map());
  idsToPrice(item);

  weaponDps(item);
  if (canCraftOfExile(item)) craftOfExileUrl(item);
  for (const action of ['wiki', 'poedb', 'craft-of-exile', 'stash-search'] as const) itemAction(action, item, 'en');
  if (isMapLike(item)) mapCheckView(item, settings().mapCheck);
  return 'item';
}

describe('every item through the popup', () => {
  it.each(files)('%s copied with advanced descriptions', (file) => {
    expect(check(advanced(file))).toBe(file === 'tablet.txt' ? 'item.unknown' : 'item');
  });

  it.each(files)('%s copied with plain Ctrl+C', (file) => {
    expect(check(plain(file))).toBe(file === 'tablet.txt' ? 'item.unknown' : 'item');
  });

  it('answers non-item text and an unknown base with a parser error key, not an exception', () => {
    expect(check('')).toBe('item.parse_error');
    expect(check('Hello from the chat')).toBe('item.parse_error');
    expect(check('Item Class: Rings\nRarity: Rare')).toBe('item.parse_error');
    // A base added by a patch, before game data and the trade data know it.
    expect(check('Item Class: Rings\nRarity: Rare\nDoom Loop\nGlimmering Ring\n--------\nItem Level: 80\n--------\n+10 to Strength')).toBe('item.unknown');
  });
});
