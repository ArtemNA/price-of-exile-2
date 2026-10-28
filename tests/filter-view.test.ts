import { beforeAll, describe, expect, it } from 'vitest';
import { parseClipboard, type ParsedItem } from '@/parser';
import type { StatFilter } from '../src/lib/ee2/web/price-check/filters/interfaces';
import { activePreset, createItemPresets } from '../src/app/price-check/price-check';
import {
  baseSwitch,
  corruptedState,
  groupStats,
  instantOnly,
  onlineOnly,
  setCorrupted,
  setExactBase,
  setInstantOnly,
  setOnlineOnly,
  sourceLines,
  statCounts,
  statLine,
  statTier,
} from '../src/app/price-check/filter-view';
import { loadGameDataFromDisk } from './game-data';
import * as items from './items';

beforeAll(loadGameDataFromDisk);

const parse = (text: string): ParsedItem => parseClipboard(text)._unsafeUnwrap();
const preset = (text: string, id?: string) => {
  const presets = createItemPresets(parse(text), 'Standard');
  if (id) presets.active = id;
  return activePreset(presets);
};
const texts = (entries: StatFilter[]) => entries.map((s) => s.text.trim());

describe('groupStats', () => {
  it('puts pseudo totals under Totals and hidden filters apart', () => {
    const { groups, hidden } = groupStats(preset(items.RARE_RING).stats);
    expect(groups.map((g) => g.name)).toEqual(['Totals', 'Explicit']);
    expect(texts(groups[0].entries)).toEqual(['#% total Elemental Resistance', '+# total to Strength']);
    expect(texts(hidden)).toEqual(['#% total to all Elemental Resistances', '#% total to Cold Resistance', '# Empty Modifier']);
    expect(hidden.map((filter) => filter.hidden)).toEqual(['filters.hide_total_all_res', 'filters.hide_ele_res', 'filters.hide_empty_mod']);
  });

  it('groups the Mods preset by mod kind, in a fixed order', () => {
    const { groups } = groupStats(preset(items.RARE_RING, 'mods').stats);
    expect(groups.map((g) => g.name)).toEqual(['Implicit', 'Explicit']);
    expect(texts(groups[1].entries)).toEqual([
      '# to Evasion Rating',
      '# to Strength',
      '#% increased Mana Regeneration Rate',
      '#% increased Light Radius',
      '#% to Cold Resistance',
    ]);
  });
});

describe('statTier and statCounts', () => {
  it('reads the tier of the mod behind a filter', () => {
    const { groups } = groupStats(preset(items.RARE_RING, 'mods').stats);
    // Mana regeneration and light radius are one mod, so one tier.
    expect(groups[1].entries.map(statTier)).toEqual([3, 7, 3, 3, 7]);
    expect(statTier(groups[0].entries[0])).toBeNull();
  });

  it('counts the filters that are on', () => {
    expect(statCounts(preset(items.RARE_RING).stats)).toEqual({ on: 1, all: 8 });
  });
});

describe('statLine and sourceLines', () => {
  it('fills in the roll and keeps the sign of the stat ref', () => {
    expect(statLine('# to maximum Life', '+# to maximum Life', 68)).toBe('+68 to maximum Life');
    expect(statLine('+# total maximum Life ', '+# total maximum Life', 93)).toBe('+93 total maximum Life');
    expect(statLine('#% increased Attack Speed', '#% increased Attack Speed', 7)).toBe('7% increased Attack Speed');
  });

  it('lists the mods behind a pseudo total, with what each adds', () => {
    const stats = preset(items.RARE_BELT).stats;
    const life = stats.find((s) => s.statRef === '+# total maximum Life')!;
    // stage 3: EE2 stat refs carry no "+", so the sign does not come back here.
    expect(sourceLines(life)).toEqual([
      { text: '161 to maximum Life', kind: undefined, adds: undefined },
      { text: '33 to Strength', kind: undefined, adds: 66 },
    ]);
  });
});

describe('corrupted, base and listing switches', () => {
  it('maps the corrupted filter to any / not / only and back', () => {
    const { filters } = preset(items.RARE_RING);
    expect(corruptedState(filters)).toBe('not');
    setCorrupted(filters, 'only');
    expect(filters.corrupted).toMatchObject({ value: true, exact: true });
    expect(corruptedState(filters)).toBe('only');
    setCorrupted(filters, 'any');
    expect(corruptedState(filters)).toBe('any');
    setCorrupted(filters, 'not');
    expect(filters.corrupted).toMatchObject({ value: false, exact: false });
  });

  it('switches between the whole category and the exact base', () => {
    const { filters } = preset(items.RARE_RING);
    expect(baseSwitch(filters)).toEqual({ category: 'Any Ring', base: 'Prismatic Ring', exact: false });
    setExactBase(filters, true);
    expect(baseSwitch(filters)!.exact).toBe(true);
  });

  it('maps the instant buyout and online switches onto the listing type', () => {
    const { trade } = preset(items.RARE_RING).filters;
    expect(trade.listingType).toBe('securable');
    expect([instantOnly(trade), onlineOnly(trade)]).toEqual([true, true]);
    setInstantOnly(trade, false);
    expect(trade.listingType).toBe('online');
    setOnlineOnly(trade, false);
    expect(trade.listingType).toBe('any');
    expect([instantOnly(trade), onlineOnly(trade)]).toEqual([false, false]);
  });
});
