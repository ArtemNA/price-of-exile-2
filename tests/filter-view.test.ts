import { beforeAll, describe, expect, it } from 'vitest';
import { parseClipboard, type ParsedItem } from '@/parser';
import type { StatFilter } from '../src/lib/ee2/web/price-check/filters/interfaces';
import { activePreset, createItemPresets } from '../src/app/price-check/price-check';
import {
  baseSwitch,
  corruptedState,
  fitListingType,
  groupStats,
  setCorrupted,
  setExactBase,
  signedTemplate,
  sourceLines,
  statCounts,
  statLine,
  statTemplate,
  statTier,
  tradeOptionsSummary,
  unrevealedRow,
} from '../src/app/price-check/filter-view';
import { loadGameDataFromDisk, loadI18nFromDisk } from './game-data';
import * as items from './items';

beforeAll(async () => {
  await loadGameDataFromDisk();
  await loadI18nFromDisk();
});

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

describe('PoE2 stat groups', () => {
  const names = (text: string, id?: string) => groupStats(preset(text, id).stats).groups.map((g) => g.name);

  it('has Rune, Enchant and Skill groups and no Eldritch implicits', () => {
    // Gemini Crossbow: an enchant (Corruption Enhancement), a rune, a granted skill (hidden below level 19).
    expect(names(items.RARE_CROSSBOW)).toEqual(['Properties', 'Implicit', 'Explicit', 'Rune', 'Enchant']);
    expect(groupStats(preset(items.RARE_CROSSBOW).stats).hidden.map((f) => f.tag)).toEqual(['property', 'skill']);
    expect(names(items.RARE_BOW)).toEqual(['Properties', 'Implicit', 'Explicit', 'Rune']);
    expect(names(items.RARE_UNIDENTIFIED)).toEqual(['Skill']);
  });

  it('keeps fractured mods with the explicit ones and desecrated duplicates hidden', () => {
    const { groups, hidden } = groupStats(preset(items.AMULET_FRACTURED, 'mods').stats);
    // The anointment is an enchant, hidden: the buyer likely changes it.
    expect(groups.map((g) => g.name)).toEqual(['Implicit', 'Explicit']);
    expect(groups[1].entries.map((f) => f.tag)).toEqual(['explicit', 'explicit', 'explicit', 'explicit', 'explicit', 'explicit']);
    expect(hidden.map((f) => [f.tag, f.hidden])).toEqual([
      ['enchant', 'filters.hide_anointment'],
      ['fractured', 'filters.hide_for_crafting'],
      ['desecrated', 'filters.hide_for_crafting'],
    ]);
  });

  it('puts Vaal unique mods under Mutated', () => {
    const vaal = items.UNIQUE_FOCUS.replace(
      '{ Unique Modifier — Elemental, Lightning, Resistance }\n+26',
      '{ Vaal Unique Modifier — Elemental, Lightning, Resistance }\n+26',
    );
    const { groups } = groupStats(preset(vaal).stats);
    expect(groups.map((g) => g.name)).toEqual(['Explicit', 'Mutated']);
    expect(groups[1].entries.map((f) => f.text)).toEqual(['#% to Lightning Resistance']);
  });

  it('shows unrevealed desecrated mods as a row of the Desecrated group', () => {
    const text = items.RARE_RING.replace('{ Suffix Modifier', '{ Suffix Modifier }\nDesecrated Suffix\n{ Suffix Modifier');
    const item = parse(text);
    const { filters, stats } = preset(text);
    const row = unrevealedRow(item, filters)!;
    expect(row).toMatchObject({ text: 'Unrevealed suffix', filter: { veiledCount: 1, disabled: true } });
    const { groups } = groupStats(stats, row);
    expect(groups.map((g) => g.name)).toEqual(['Totals', 'Explicit', 'Desecrated']);
    expect(groups[2]).toMatchObject({ entries: [], unrevealed: row });
    expect(unrevealedRow(parse(items.RARE_RING), preset(items.RARE_RING).filters)).toBeNull();
  });
});

describe('statTier and statCounts', () => {
  it('reads the tier of the mod behind a filter', () => {
    const { groups } = groupStats(preset(items.RARE_RING, 'mods').stats);
    // Mana regeneration and light radius are one mod, so one tier.
    expect(groups[1].entries.map(statTier)).toEqual([3, 7, 3, 3, 7]);
    expect(statTier(groups[0].entries[0])).toBeNull();
  });

  it('shows no tiers on waystones and jewels, as EE2', () => {
    const tiers = (text: string) => preset(text).stats.map((filter) => statTier(filter, parse(text)));
    expect(preset(items.WAYSTONE).stats.some((filter) => filter.sources.some((s) => s.modifier.info.tier))).toBe(true);
    expect(tiers(items.WAYSTONE).every((tier) => tier == null)).toBe(true);
    expect(tiers(items.JEWEL).every((tier) => tier == null)).toBe(true);
    expect(tiers(items.RARE_BELT)).toContain(1);
  });

  it('counts the filters that are on', () => {
    expect(statCounts(preset(items.RARE_RING).stats)).toEqual({ on: 1, all: 8 });
  });
});

describe('statLine and sourceLines', () => {
  it('fills in the roll; pseudo totals keep their own "+"', () => {
    expect(statLine('+# total maximum Life ', 93)).toBe('+93 total maximum Life');
    expect(statLine('#% increased Attack Speed', 7)).toBe('7% increased Attack Speed');
    expect(statLine('Adds # to # Fire Damage', 3)).toBe('Adds # to # Fire Damage');
  });

  it('brings the "+" back from the item text (FINDINGS F-08)', () => {
    const raw = items.AMULET_FRACTURED;
    expect(statLine('# to Spirit', 30, raw)).toBe('+30 to Spirit');
    expect(statLine('# to Level of all Spell Skills', 3, raw)).toBe('+3 to Level of all Spell Skills');
    expect(statLine('#% to Cold Resistance', 37, raw)).toBe('+37% to Cold Resistance');
    expect(statLine('#% to Fire and Chaos Resistances', 17, raw)).toBe('+17% to Fire and Chaos Resistances');
    expect(statLine('#% increased Spell Damage', 29, raw)).toBe('29% increased Spell Damage');
    // "# to Spirit" must not take the sign of a longer line that starts the same way.
    expect(signedTemplate('# to Spirit', '+30 to Spirit per Socket filled\n30 to Spirit')).toBe('# to Spirit');
    // A sign in the middle of a line; a minus stays part of the roll.
    expect(signedTemplate('Allies in your Presence have #% to all Elemental Resistances', 'Allies in your Presence have +12(10-15)% to all Elemental Resistances'))
      .toBe('Allies in your Presence have +#% to all Elemental Resistances');
    expect(signedTemplate('#% to Cold Resistance', '-10% to Cold Resistance')).toBe('#% to Cold Resistance');
  });

  it('shows the sign in every row of a real item', () => {
    const item = parse(items.RARE_RING);
    const mods = preset(items.RARE_RING, 'mods').stats;
    expect(mods.map((filter) => statLine(statTemplate(filter), filter.roll?.value, item.rawText))).toEqual([
      '+8% to all Elemental Resistances',
      '+143 to Evasion Rating',
      '+12 to Strength',
      '8% increased Mana Regeneration Rate',
      '5% increased Light Radius',
      '+15% to Cold Resistance',
      '2 Empty Modifier',
    ]);
  });

  it('writes item properties with EE2 i18n keys, as EE2 does', () => {
    const sceptre = preset(items.RARE_SCEPTRE).stats.find((filter) => filter.tradeId[0] === 'item.spirit')!;
    expect(sceptre.text).toBe('Spirit: #%');
    expect(statLine(statTemplate(sceptre), sceptre.roll?.value)).toBe('Spirit: 152');
    const waystone = preset(items.WAYSTONE).stats.find((filter) => filter.tradeId[0] === 'item.map_pack_size')!;
    expect(statLine(statTemplate(waystone), waystone.roll?.value)).toBe('Monster Pack Size: +34%');
  });

  it('lists the mods behind a pseudo total, with what each adds', () => {
    const stats = preset(items.RARE_BELT).stats;
    const life = stats.find((s) => s.statRef === '+# total maximum Life')!;
    expect(sourceLines(life, items.RARE_BELT)).toEqual([
      { text: '+161 to maximum Life', kind: undefined, adds: undefined },
      { text: '+33 to Strength', kind: undefined, adds: 66 },
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

  it('keeps a listing type the API takes and sums the trade options up', () => {
    const { trade } = preset(items.RARE_RING).filters;
    expect(trade.listingType).toBe('securable');
    expect(tradeOptionsSummary(trade, 'trade')).toBe('instant buyout');
    trade.currency = 'divine';
    expect(tradeOptionsSummary(trade, 'trade', 'Divine Orb')).toBe('instant buyout · Divine Orb');
    // Bulk exchange has no instant buyout: EE2 switches to online.
    fitListingType(trade, 'bulk', 'securable');
    expect(trade.listingType).toBe('online');
    expect(tradeOptionsSummary(trade, 'bulk', 'Divine Orb')).toBe('online');
    trade.listingType = 'onlineleague';
    expect(tradeOptionsSummary(trade, 'bulk')).toBe('online in league');
    // Item search has no "online in league": back to the default from the settings.
    fitListingType(trade, 'trade', 'available');
    expect(trade.listingType).toBe('available');
    expect(tradeOptionsSummary(trade, 'trade')).toBe('instant or online');
  });
});
