import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseClipboard, type ParsedItem } from '@/parser';
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

// stage 7 rewrites the map check for waystones and tablets with PoE2 default marks; until then
// this covers what works on PoE2 data. The defaults still mark PoE1 mods (see `hasOutdated`).

beforeAll(loadGameDataFromDisk);

function parse(text: string): ParsedItem {
  return parseClipboard(text)._unsafeUnwrap();
}

const WAYSTONE = readFileSync(new URL('./fixtures/items/waystone.txt', import.meta.url), 'utf-8');
const MAX_RES = 'Players have #% to all maximum Resistances';
const MONSTER_DAMAGE = '#% increased Monster Damage';

describe('map check', () => {
  it('opens for non-unique waystones only', () => {
    expect(isMapLike(parse(WAYSTONE))).toBe(true);
    expect(isMapLike(parse(items.RARE_RING))).toBe(false);
  });

  it('lists the explicit waystone mods with rolls and marks', () => {
    const config = withDecision(DEFAULT_MAP_CHECK, MONSTER_DAMAGE, 'd');
    const view = mapCheckView(parse(WAYSTONE), config);
    expect(view.name).toBe('Waystone (Tier 14)');
    expect(view.mavenReminder).toBe(false);
    expect(view.stats).toEqual([
      { matcher: 'Area has patches of Shocked Ground', roll: undefined, decision: '-' },
      { matcher: MONSTER_DAMAGE, roll: 28, decision: 'd' },
      { matcher: 'Monsters fire # additional Projectiles', roll: 2, decision: '-' },
      { matcher: 'Monsters have #% increased Critical Hit Chance', roll: 293, decision: '-' },
    ]);
    // The second line of a hybrid mod the stat data does not know.
    expect(view.unknown).toEqual(['+26(26-30)% to Monster Critical Damage Bonus']);
    // The PoE1 default marks: two of three are gone from PoE2 data (stage 7).
    expect(view.hasOutdated).toBe(true);
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

  it('puts the roll in place of #', () => {
    expect(modTextParts(MONSTER_DAMAGE, 28)).toEqual([{ text: '28', value: true }, { text: '% increased Monster Damage' }]);
  });

  it('searches every map mod of the stat data', () => {
    const all = allAreaMods();
    expect(all.length).toBeGreaterThan(150);
    expect(filterAreaMods(all, DEFAULT_MAP_CHECK, 'shocked ground', false).map((m) => m.matchStr)).toContain(
      'Area has patches of Shocked Ground',
    );
  });
});
