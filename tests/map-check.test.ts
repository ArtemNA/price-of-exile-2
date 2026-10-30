import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { STAT_BY_MATCH_STR } from '@/assets/data';
import { parseClipboard, type ParsedItem } from '@/parser';
import { DEFAULT_MAP_CHECK, POE1_MAP_CHECK_MATCHERS } from '../src/app/constants';
import {
  allAreaMods,
  cycleDecision,
  decisionOf,
  filterAreaMods,
  isMapLike,
  mapCheckView,
  modTextParts,
  toggleSeen,
  withDecision,
  withoutRollRange,
} from '../src/app/map-check/map-check';
import { loadGameDataFromDisk } from './game-data';
import * as items from './items';

beforeAll(loadGameDataFromDisk);

function parse(text: string): ParsedItem {
  return parseClipboard(text)._unsafeUnwrap();
}

const fixture = (name: string) => readFileSync(new URL(`./fixtures/items/${name}`, import.meta.url), 'utf-8');
const WAYSTONE = fixture('waystone.txt');
const CORRUPTED = fixture('waystone-corrupted.txt');
const MAX_RES = '#% maximum Player Resistances';
const MONSTER_DAMAGE = '#% increased Monster Damage';
const LESS_RECOVERY = 'Players have #% less Recovery Rate of Life and Energy Shield';
const TEMPORAL_CHAINS = 'Players are periodically Cursed with Temporal Chains';

describe('map check', () => {
  it('opens for non-unique waystones, not for tablets', () => {
    expect(isMapLike(parse(WAYSTONE))).toBe(true);
    expect(isMapLike(parse(CORRUPTED))).toBe(true);
    expect(isMapLike(parse(items.RARE_RING))).toBe(false);
    const tablet = parse(fixture('tablet.txt').replace('Delirium Precursor Tablet', 'Delirium Tablet'));
    expect(isMapLike(tablet)).toBe(false);
  });

  it('shows the waystone numbers, mods with rolls and the unknown hybrid line', () => {
    const view = mapCheckView(parse(WAYSTONE), DEFAULT_MAP_CHECK);
    expect(view).toMatchObject({ name: 'Waystone (Tier 14)', tier: 14, corrupted: false, unidentified: false });
    expect(view.numbers).toEqual([
      { label: 'Revives', value: 2, percent: false },
      { label: 'Pack size', value: 34, percent: true },
      { label: 'Rare monsters', value: 28, percent: true },
      { label: 'Waystone drop chance', value: 75, percent: true },
    ]);
    expect(view.stats).toEqual([
      { matcher: 'Area has patches of Shocked Ground', roll: undefined, type: 'explicit', decision: '-' },
      { matcher: MONSTER_DAMAGE, roll: 28, type: 'explicit', decision: '-' },
      { matcher: 'Monsters fire # additional Projectiles', roll: 2, type: 'explicit', decision: '-' },
      { matcher: 'Monsters have #% increased Critical Hit Chance', roll: 293, type: 'explicit', decision: '-' },
    ]);
    // The second line of the hybrid "of Destruction" mod is unknown to the stat data (FINDINGS F-09).
    expect(view.unknown).toEqual(['+26% to Monster Critical Damage Bonus']);
    // The PoE2 default marks all exist in the stat data.
    expect(view.hasOutdated).toBe(false);
  });

  it('shows every number of the corrupted waystone, 0 revives too, and marks per profile', () => {
    const item = parse(CORRUPTED);
    const config = withDecision({ ...DEFAULT_MAP_CHECK, profile: 2 }, MONSTER_DAMAGE, 'd');
    const view = mapCheckView(item, config);
    expect(view).toMatchObject({ tier: 16, corrupted: true, unknown: [], hasOutdated: false });
    expect(view.stats).toHaveLength(7);
    expect(view.numbers.map((n) => [n.label, n.value])).toEqual([
      ['Revives', 0],
      ['Pack size', 20],
      ['Magic monsters', 30],
      ['Rare monsters', 71],
      ['Waystone drop chance', 90],
      ['Item rarity', 17],
      ['Monster rarity', 32],
      ['Monster effectiveness', 45],
    ]);
    const marks = (profile: number) =>
      Object.fromEntries(
        mapCheckView(item, { ...config, profile })
          .stats.filter((s) => s.decision !== '-')
          .map((s) => [s.matcher, s.decision]),
      );
    expect(marks(1)).toEqual({ [TEMPORAL_CHAINS]: 'w' });
    expect(marks(2)).toEqual({ [MONSTER_DAMAGE]: 'd' });
    expect(marks(3)).toEqual({});
  });

  it('marks the default mods when a waystone rolls them', () => {
    // The fixture with its "Painful" mod swapped for three others; not a text from the game.
    const text = WAYSTONE.replace(
      '28(26-30)% increased Monster Damage',
      [
        'Players have 40(40-50)% less Recovery Rate of Life and Energy Shield',
        '-10(-10--5)% maximum Player Resistances',
        'Players have 15(15-20)% less Cooldown Recovery Rate',
      ].join('\n'),
    );
    const view = mapCheckView(parse(text), DEFAULT_MAP_CHECK);
    expect(view.stats.filter((s) => s.decision !== '-').map((s) => [s.matcher, s.roll, s.decision])).toEqual([
      [LESS_RECOVERY, 40, 'd'],
      [MAX_RES, -10, 'w'],
      ['Players have #% less Cooldown Recovery Rate', 15, 'w'],
    ]);
  });

  it('has default marks that all exist in the PoE2 stat data, and PoE1 ones that do not', () => {
    const areaMods = new Set(allAreaMods().map((m) => m.matchStr));
    for (const { matcher } of DEFAULT_MAP_CHECK.selectedStats) {
      expect(STAT_BY_MATCH_STR(matcher), matcher).toBeDefined();
      expect(areaMods.has(matcher), matcher).toBe(true);
    }
    for (const [old, replacement] of Object.entries(POE1_MAP_CHECK_MATCHERS)) {
      expect(STAT_BY_MATCH_STR(old), old).toBeUndefined();
      if (replacement) expect(STAT_BY_MATCH_STR(replacement), replacement).toBeDefined();
    }
    const outdated = withDecision(DEFAULT_MAP_CHECK, 'Monsters reflect #% of Physical Damage', 'd');
    expect(mapCheckView(parse(WAYSTONE), outdated).hasOutdated).toBe(true);
  });

  it('cycles marks per profile without touching the others', () => {
    let config = DEFAULT_MAP_CHECK;
    const order = [];
    for (let i = 0; i < 5; i++) {
      config = cycleDecision(config, MONSTER_DAMAGE);
      order.push(decisionOf(config, MONSTER_DAMAGE));
    }
    expect(order).toEqual(['d', 'w', 'g', 's', 'd']);

    config = withDecision({ ...DEFAULT_MAP_CHECK, profile: 2 }, MAX_RES, 'd');
    expect(config.selectedStats.find((s) => s.matcher === MAX_RES)?.decision).toBe('wd-');
    expect(decisionOf(config, MAX_RES, 1)).toBe('w');
  });

  it('marks new mods as seen only with the new mods icon on', () => {
    expect(toggleSeen(DEFAULT_MAP_CHECK, MONSTER_DAMAGE)).toBe(DEFAULT_MAP_CHECK);
    const config = toggleSeen({ ...DEFAULT_MAP_CHECK, showNewStats: true }, MONSTER_DAMAGE);
    expect(decisionOf(config, MONSTER_DAMAGE)).toBe('s');
    expect(decisionOf(toggleSeen(config, MONSTER_DAMAGE), MONSTER_DAMAGE)).toBe('-');
  });

  it('puts the roll in place of # and drops roll ranges of unknown lines', () => {
    expect(modTextParts(MONSTER_DAMAGE, 28)).toEqual([{ text: '28', value: true }, { text: '% increased Monster Damage' }]);
    expect(withoutRollRange('+26(26-30)% to Monster Critical Damage Bonus')).toBe('+26% to Monster Critical Damage Bonus');
    expect(withoutRollRange('-7(-10--5)% to X, 3(1.5-4.5) Y')).toBe('-7% to X, 3 Y');
  });

  it('lists and searches the PoE2 waystone mods in the editor', () => {
    const all = allAreaMods();
    expect(all.length).toBeGreaterThan(150);
    expect(all.every((m) => m.tag === undefined)).toBe(true);
    const search = (text: string, onlySelected = false) =>
      filterAreaMods(all, DEFAULT_MAP_CHECK, text, onlySelected).map((m) => m.matchStr);
    expect(search('shocked ground')).toEqual(['Area has patches of Shocked Ground']);
    expect(search('periodically cursed')).toEqual([
      'Players are periodically Cursed with Elemental Weakness',
      'Players are periodically Cursed with Enfeeble',
      TEMPORAL_CHAINS,
    ]);
    expect(search('LESS recovery')).toContain(LESS_RECOVERY);
    expect(search('', true).toSorted()).toEqual(DEFAULT_MAP_CHECK.selectedStats.map((s) => s.matcher).toSorted());
  });
});
