import { beforeAll, describe, expect, it } from 'vitest';
import { parseClipboard, type ParsedItem } from '@/parser';
import { StatTag } from '@/web/map-check/common';
import { DEFAULT_MAP_CHECK } from '../src/app/constants';
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
} from '../src/app/map-check/map-check';
import { loadGameDataFromDisk } from './game-data';
import * as items from './items';

beforeAll(loadGameDataFromDisk);

function parse(text: string): ParsedItem {
  return parseClipboard(text)._unsafeUnwrap();
}

const MAX_RES = 'Players have #% to all maximum Resistances';
const LESS_RECOVERY = 'Players have #% less Recovery Rate of Life and Energy Shield';
const TWO_BOSSES = 'Area contains two Unique Bosses';

describe('map check', () => {
  it('opens for non-unique maps only', () => {
    expect(isMapLike(parse(items.RARE_MAP))).toBe(true);
    expect(isMapLike(parse(items.NORMAL_MAP))).toBe(true);
    expect(isMapLike(parse(items.RARE_RING))).toBe(false);
  });

  it('lists the explicit map mods with rolls and the default marks', () => {
    const view = mapCheckView(parse(items.RARE_MAP), DEFAULT_MAP_CHECK);
    expect(view.name).toBe('Strand');
    expect(view.image).toBe('https://i.imgur.com/7aE4Xzp.jpg');
    expect(view.mavenReminder).toBe(false);
    expect(view.hasOutdated).toBe(false);
    expect(view.unknown).toEqual([]);
    expect(view.stats).toEqual([
      { matcher: TWO_BOSSES, roll: undefined, decision: 'g' },
      { matcher: '#% more Monster Life', roll: 40, decision: '-' },
      { matcher: 'Monsters deal #% extra Physical Damage as Fire', roll: 102, decision: '-' },
      { matcher: MAX_RES, roll: -10, decision: 'w' },
      { matcher: LESS_RECOVERY, roll: 40, decision: 'd' },
      { matcher: 'Monsters take #% reduced Extra Damage from Critical Strikes', roll: 25, decision: '-' },
    ]);
  });

  it('reminds about Maven memory bosses and shows unknown mods', () => {
    const memory = items.NORMAL_MAP.replace('Map Area: Courtyard', 'Map Area: Courtyard of Wasting');
    expect(mapCheckView(parse(memory), DEFAULT_MAP_CHECK).mavenReminder).toBe(true);
    const odd = items.RARE_MAP.replace('Area contains two Unique Bosses', 'Monsters reflect 18(18-20)% of Physical Damage');
    expect(mapCheckView(parse(odd), DEFAULT_MAP_CHECK).unknown).toEqual(['Monsters reflect 18(18-20)% of Physical Damage']);
  });

  it('flags marks whose wording left the stat data', () => {
    const config = withDecision(DEFAULT_MAP_CHECK, 'Monsters reflect #% of Physical Damage', 'd');
    expect(mapCheckView(parse(items.NORMAL_MAP), config).hasOutdated).toBe(true);
    const list = filterAreaMods(allAreaMods(), config, 'zzz', false);
    expect(list).toEqual([{ matchStr: 'Monsters reflect #% of Physical Damage', tag: StatTag.Outdated }]);
  });

  it('cycles marks per profile without touching the others', () => {
    let config = DEFAULT_MAP_CHECK;
    const order = [];
    for (let i = 0; i < 5; i++) {
      config = cycleDecision(config, '#% more Monster Life');
      order.push(decisionOf(config, '#% more Monster Life'));
    }
    expect(order).toEqual(['d', 'w', 'g', 's', 'd']);

    config = withDecision({ ...DEFAULT_MAP_CHECK, profile: 2 }, MAX_RES, 'd');
    expect(config.selectedStats.find((s) => s.matcher === MAX_RES)?.decision).toBe('wd-');
    expect(decisionOf(config, MAX_RES, 1)).toBe('w');
    // No marks left in any profile: the entry goes away.
    config = withDecision({ ...DEFAULT_MAP_CHECK, profile: 1 }, TWO_BOSSES, '-');
    expect(config.selectedStats.some((s) => s.matcher === TWO_BOSSES)).toBe(false);
  });

  it('marks new mods as seen only with the new mods icon on', () => {
    expect(toggleSeen(DEFAULT_MAP_CHECK, '#% more Monster Life')).toBe(DEFAULT_MAP_CHECK);
    const config = toggleSeen({ ...DEFAULT_MAP_CHECK, showNewStats: true }, '#% more Monster Life');
    expect(decisionOf(config, '#% more Monster Life')).toBe('s');
    expect(decisionOf(toggleSeen(config, '#% more Monster Life'), '#% more Monster Life')).toBe('-');
  });

  it('puts the roll in place of #', () => {
    expect(modTextParts('Players have #% to all maximum Resistances', -10)).toEqual([
      { text: 'Players have ' },
      { text: '-10', value: true },
      { text: '% to all maximum Resistances' },
    ]);
    expect(modTextParts('+#% Monster Elemental Resistances')).toEqual([{ text: '#' }, { text: '% Monster Elemental Resistances' }]);
  });

  it('searches every map mod, ordinary first', () => {
    const all = allAreaMods();
    expect(all.length).toBeGreaterThan(200);
    expect(all[0].tag).toBeUndefined();
    expect(all.at(-1)?.tag).toBe(StatTag.HeistExclusive);
    expect(filterAreaMods(all, DEFAULT_MAP_CHECK, 'unique bosses', false).map((m) => m.matchStr)).toContain(TWO_BOSSES);
    expect(filterAreaMods(all, DEFAULT_MAP_CHECK, '', true).map((m) => m.matchStr).sort()).toEqual(
      [LESS_RECOVERY, MAX_RES, TWO_BOSSES].sort(),
    );
  });
});
