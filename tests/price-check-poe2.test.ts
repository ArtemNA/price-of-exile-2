// Stage 3: the PoE2 parts of the price check: header chips, the rarity switch, listing types and
// buyout currency as they reach the trade2 request. No live requests: the trade API answers with
// the responses saved from it (tests/fixtures/trade2-*.json).

import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseClipboard, type ParsedItem } from '@/parser';
import { createTradeRequest as createBulkRequest } from '../src/lib/ee2/web/price-check/trade/pathofexile-bulk';
import { apiToSatisfySearch } from '../src/lib/ee2/web/price-check/trade/common';
import { createTradeRequest } from '../src/lib/ee2/web/price-check/trade/pathofexile-trade';
import { LISTING_TYPES } from '../src/app/constants';
import { setHttpFetch } from '../src/app/core/http';
import { requestFilters, signedPseudo } from '../src/app/price-check/filter-view';
import { itemFilterChips } from '../src/app/price-check/item-filter-chips';
import { activePreset, createItemPresets } from '../src/app/price-check/price-check';
import { TradeSearch } from '../src/app/price-check/trade-search';
import { loadGameDataFromDisk, loadI18nFromDisk } from './game-data';
import * as items from './items';

beforeAll(async () => {
  await loadGameDataFromDisk();
  await loadI18nFromDisk();
});

const parse = (text: string): ParsedItem => parseClipboard(text)._unsafeUnwrap();
const presetOf = (text: string) => {
  const item = parse(text);
  return { item, ...activePreset(createItemPresets(item, 'Standard')) };
};
const chip = (text: string, key: string) => itemFilterChips(presetOf(text).filters).find((c) => c.key === key);
/** The trade2 query filters the item's search sends, as `createTradeRequest` builds them. */
const query = (preset: ReturnType<typeof presetOf>) =>
  createTradeRequest(requestFilters(preset.filters), preset.stats, preset.item).query as { filters: Record<string, { filters: Record<string, unknown> }>; status: unknown };

describe('header chips for PoE2', () => {
  it('has rune sockets instead of links', () => {
    const preset = presetOf(items.RARE_CROSSBOW);
    expect(itemFilterChips(preset.filters).find((c) => c.key === 'augmentSockets')).toMatchObject({ label: 'Sockets', enabled: true, numeric: { value: 2 } });
    expect(itemFilterChips(preset.filters).some((c) => c.key === 'linkedSockets')).toBe(false);
    expect(query(preset).filters.equipment_filters.filters.rune_sockets).toEqual({ min: 2 });
    // One socket on a sceptre is the normal count: shown, not searched.
    expect(chip(items.RARE_SCEPTRE, 'augmentSockets')).toMatchObject({ enabled: false, numeric: { value: 1 } });
  });

  it('searches the waystone tier exactly', () => {
    const preset = presetOf(items.WAYSTONE);
    expect(itemFilterChips(preset.filters).find((c) => c.key === 'mapTier')).toMatchObject({ label: 'Map Tier', enabled: true, numeric: { value: 14 } });
    expect(query(preset).filters.map_filters.filters.map_tier).toEqual({ min: 14, max: 14 });
  });

  it('has gem level, quality and support sockets for a gem', () => {
    const preset = presetOf(items.META_GEM);
    const chips = itemFilterChips(preset.filters);
    // Below level 19 the level rarely sets the price (EE2): shown off.
    expect(chips.find((c) => c.key === 'gemLevel')).toMatchObject({ label: 'Level', enabled: false, numeric: { value: 14 } });
    expect(chips.find((c) => c.key === 'socketNumber')).toMatchObject({ enabled: true, numeric: { value: 4 } });
    chips.find((c) => c.key === 'gemLevel')!.toggle();
    expect(query(preset).filters.misc_filters.filters).toMatchObject({ gem_level: { min: 14 }, gem_sockets: { min: 4 } });

    const quality = presetOf(items.META_GEM.replace('Level: 14\n', 'Level: 20 (Max)\nQuality: +20% (augmented)\n'));
    expect(itemFilterChips(quality.filters).filter((c) => c.enabled && c.numeric).map((c) => [c.key, c.numeric!.value])).toEqual([
      ['socketNumber', 4],
      ['gemLevel', 20],
      ['quality', 20],
    ]);
    expect(query(quality).filters.type_filters.filters.quality).toEqual({ min: 20 });
  });

  it('prices uncut gems by their level in the name, in bulk', () => {
    // EE2's uncut gem filters (level ±1) never apply: PoE2 has one item per level with its own trade tag.
    const preset = presetOf(items.UNCUT_GEM);
    expect(preset.filters.gemLevel).toBeUndefined();
    expect(preset.filters.searchExact.baseTypeTrade).toBe('Uncut Skill Gem (Level 19)');
    expect(apiToSatisfySearch(preset.item, preset.stats, preset.filters)).toBe('bulk');
  });

  it('has the unidentified tier instead of the plain unidentified switch', () => {
    const preset = presetOf(items.MAGIC_UNID_TIER);
    const chips = itemFilterChips(preset.filters);
    // EE2 turns it on from tier 5 up.
    expect(chips.find((c) => c.key === 'unidentifiedTier')).toMatchObject({ label: 'Unidentified', enabled: false, numeric: { value: 4 } });
    expect(chips.some((c) => c.key === 'unidentified')).toBe(false);
    expect(query(preset).filters.misc_filters?.filters.unidentified_tier).toBeUndefined();
    chips.find((c) => c.key === 'unidentifiedTier')!.toggle();
    expect(query(preset).filters.misc_filters.filters.unidentified_tier).toEqual({ min: 4 });
    expect(chip(items.RARE_UNIDENTIFIED, 'unidentified')).toBeDefined();
  });

  it('switches sanctified between any and not sanctified, as EE2 labels it', () => {
    const preset = presetOf(`${items.RARE_RING}--------\nSanctified\n`);
    const sanctified = () => itemFilterChips(preset.filters).find((c) => c.key === 'sanctified')!;
    expect(sanctified()).toMatchObject({ label: 'Sanctified', enabled: true });
    expect(query(preset).filters.misc_filters.filters.sanctified).toBeUndefined();
    sanctified().toggle();
    expect(sanctified()).toMatchObject({ label: 'Not Sanctified', enabled: false });
    expect(query(preset).filters.misc_filters.filters.sanctified).toEqual({ option: 'false' });
  });
});

describe('rarity switch', () => {
  it('turns EE2 "nonunique" off by leaving it out of the request', () => {
    const preset = presetOf(items.RARE_RING);
    const rarity = () => itemFilterChips(preset.filters).find((c) => c.key === 'rarity')!;
    expect(rarity()).toMatchObject({ label: 'Not unique', enabled: true });
    expect(query(preset).filters.type_filters.filters.rarity).toEqual({ option: 'nonunique' });
    rarity().toggle();
    expect(rarity().enabled).toBe(false);
    expect(query(preset).filters.type_filters.filters.rarity).toBeUndefined();
    // EE2's filter object itself is untouched, so turning it on again brings it back.
    expect(preset.filters.rarity?.value).toBe('nonunique');
    rarity().toggle();
    expect(query(preset).filters.type_filters.filters.rarity).toEqual({ option: 'nonunique' });
  });

  it('names the exact rarities of the exact presets and has none for uniques', () => {
    expect(chip(items.NORMAL_HELMET, 'rarity')?.label).toBe('Normal');
    expect(chip(items.MAGIC_UNID_TIER, 'rarity')?.label).toBe('Magic');
    expect(chip(items.UNIQUE_FOCUS, 'rarity')).toBeUndefined();
  });

  it('keeps the switch in the copy the Mods preset makes', () => {
    const presets = createItemPresets(parse(items.RARE_RING), 'Standard');
    const pseudo = presets.presets.find((p) => p.id === 'filters.preset_pseudo')!;
    const mods = presets.presets.find((p) => p.id === 'mods')!;
    itemFilterChips(pseudo.filters).find((c) => c.key === 'rarity')!.toggle();
    expect(itemFilterChips(mods.filters).find((c) => c.key === 'rarity')!.enabled).toBe(true);
  });
});

describe('listing types and buyout currency in the trade2 request', () => {
  it('sends each of the four listing types as the status option', () => {
    const preset = presetOf(items.RARE_RING);
    expect(LISTING_TYPES.map((type) => type.value)).toEqual(['securable', 'available', 'online', 'any']);
    for (const { value } of LISTING_TYPES) {
      preset.filters.trade.listingType = value;
      expect(query(preset).status).toEqual({ option: value });
    }
  });

  it('sends the buyout currency as the price option', () => {
    const preset = presetOf(items.RARE_RING);
    expect(query(preset).filters.trade_filters.filters.price).toBeUndefined();
    for (const currency of ['exalted', 'chaos', 'divine', 'exalted_divine']) {
      preset.filters.trade.currency = currency;
      expect(query(preset).filters.trade_filters.filters.price).toEqual({ option: currency });
    }
  });

  it('gives the bulk exchange "online in league", and online instead of instant buyout', () => {
    const preset = presetOf(items.CURRENCY_EXALTED);
    preset.filters.trade.listingType = 'onlineleague';
    expect(createBulkRequest(preset.filters, preset.item, ['divine']).query.status).toEqual({ option: 'onlineleague' });
  });

  it('searches the live API answers with the chosen listing type and currency', async () => {
    const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf-8');
    const headers = (name: string) =>
      new Headers(
        fixture(name)
          .split('\n')
          .filter((line) => line.toLowerCase().startsWith('x-rate-limit'))
          .map((line) => line.trim().split(': ') as [string, string]),
      );
    const search = JSON.parse(fixture('trade2-search-prismatic-ring.json')) as { id: string; result: string[]; total: number };
    const fetched = JSON.parse(fixture('trade2-fetch-prismatic-ring.json'));
    const bodies: unknown[] = [];
    setHttpFetch(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/trade2/search/')) {
        bodies.push(JSON.parse(String(init?.body)));
        // Two ids, so one fetch answers them all.
        return Response.json({ ...search, result: search.result.slice(0, 2) }, { headers: headers('trade2-search-prismatic-ring.headers.txt') });
      }
      return Response.json(fetched, { headers: headers('trade2-fetch-prismatic-ring.headers.txt') });
    });

    const preset = presetOf(items.RARE_RING);
    preset.filters.trade.listingType = 'available';
    preset.filters.trade.currency = 'exalted';
    itemFilterChips(preset.filters).find((c) => c.key === 'rarity')!.toggle();
    const trade = new TradeSearch();
    await trade.search(preset.filters, preset.stats, preset.item);

    expect(trade.error()).toBeNull();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      query: { status: { option: 'available' }, filters: { trade_filters: { filters: { price: { option: 'exalted' } } } } },
      sort: { price: 'asc' },
    });
    expect((bodies[0] as { query: { filters: { type_filters: { filters: object } } } }).query.filters.type_filters.filters).not.toHaveProperty('rarity');
    expect(trade.searchResult()?.total).toBe(search.total);
    // The live listings were priced in Orbs of Augmentation (trade id "aug").
    expect(trade.rows().map((row) => `${row.priceAmount} ${row.priceCurrency}`)).toEqual(['1 aug']);
  });
});

describe('signedPseudo', () => {
  it('gives totals of flat values the sign the trade site shows', () => {
    expect(signedPseudo('#% total Elemental Resistance')).toBe('+#% total Elemental Resistance');
    expect(signedPseudo('+# total to Strength')).toBe('+# total to Strength');
    expect(signedPseudo('#% total increased Attack Speed')).toBe('#% total increased Attack Speed');
  });
});
