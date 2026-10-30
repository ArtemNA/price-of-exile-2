import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseClipboard, type ParsedItem } from '@/parser';
import {
  canCraftOfExile,
  craftOfExileUrl,
  itemAction,
  poedbUrl,
  stashSearchText,
  weaponDps,
  wikiUrl,
} from '../src/app/core/item-links';
import { loadGameDataFromDisk } from './game-data';
import * as items from './items';

beforeAll(loadGameDataFromDisk);

function parse(text: string): ParsedItem {
  return parseClipboard(text)._unsafeUnwrap();
}

const fixture = (name: string) => readFileSync(new URL(`./fixtures/items/${name}.txt`, import.meta.url), 'utf-8');

const WIKI = 'https://www.poe2wiki.net/wiki';
const POEDB = 'https://poe2db.tw/us';

describe('item check links', () => {
  // Pages marked "live" answered 200 on 30.10.2026; EE2's "Waystone_(Tier_14)" on PoE2DB is a 404.
  it.each([
    // [fixture, wiki page, PoE2DB path]
    ['rare-ring', 'Prismatic_Ring', 'Rings#ModifiersCalc'], // live (PoE2DB: Rings)
    ['unique', 'The_Eternal_Spark', 'The_Eternal_Spark'], // live
    ['unique-unid', 'Felt_Cap', 'Felt_Cap'],
    ['rune', 'Greater_Iron_Rune', 'Greater_Iron_Rune'], // live
    ['waystone', 'Waystone_(Tier_14)', 'Waystones'], // live
    ['waystone-corrupted', 'Waystone_(Tier_16)', 'Waystones'],
    ['uncut-gem', 'Uncut_Skill_Gem', 'Uncut_Skill_Gem'], // live
    ['uncut-spirit-gem', 'Uncut_Spirit_Gem', 'Uncut_Spirit_Gem'],
    ['meta-gem-no-item-class', 'Mirage_Archer', 'Mirage_Archer'],
    ['currency', 'Exalted_Orb', 'Exalted_Orb'],
    ['jewel', 'Ruby', 'Ruby#ModifiersCalc'],
    ['charm', 'Silver_Charm', 'Charms#ModifiersCalc'],
    ['normal-helmet', 'Divine_Crown', 'Helmets_str_int#ModifiersCalc'],
    ['weapon', 'Gemini_Crossbow', 'Crossbows#ModifiersCalc'],
    ['bow-runes-crafted', 'Obliterator_Bow', 'Bows#ModifiersCalc'],
    ['magic-mace', 'Temple_Maul', 'Two_Hand_Maces#ModifiersCalc'],
    ['sceptre-spirit', 'Shrine_Sceptre', 'Sceptres#ModifiersCalc'],
  ])('%s: wiki %s, PoE2DB %s', (name, wiki, poedb) => {
    const item = parse(fixture(name));
    expect(wikiUrl(item)).toBe(`${WIKI}/${wiki}`);
    expect(poedbUrl(item)).toBe(`${POEDB}/${poedb}`);
  });

  it('opens PoE2DB in the game language', () => {
    expect(poedbUrl(parse(items.RARE_RING), 'ru')).toBe('https://poe2db.tw/ru/Rings#ModifiersCalc');
    expect(poedbUrl(parse(items.UNIQUE_FOCUS), 'ru')).toBe('https://poe2db.tw/ru/The_Eternal_Spark');
  });

  it('encodes what is not valid in a URL', () => {
    const item = parse(items.RARE_RING);
    const named = { ...item, info: { ...item.info, refName: "Kalisa's Grace" } };
    expect(wikiUrl(named)).toBe(`${WIKI}/Kalisa's_Grace`);
    expect(poedbUrl({ ...named, category: undefined })).toBe(`${POEDB}/Kalisas_Grace`);
    expect(wikiUrl({ ...item, info: { ...item.info, refName: 'Ünique Ring' } })).toBe(`${WIKI}/%C3%9Cnique_Ring`);
  });

  it('searches the stash for the item name as a phrase', () => {
    expect(stashSearchText(parse(items.UNIQUE_FOCUS))).toBe('"The Eternal Spark"');
    expect(stashSearchText(parse(items.RARE_RING))).toBe('"Prismatic Ring"');
    expect(stashSearchText(parse(items.UNCUT_GEM))).toBe('"Uncut Skill Gem (Level 19)"');
  });
});

describe('Craft of Exile', () => {
  it.each([
    ['rare-ring', true],
    ['magic-mace', true],
    ['normal-helmet', true],
    ['jewel', true],
    ['charm', true],
    ['waystone', true],
    ['amulet-fractured-desecrated', true],
    // Corrupted.
    ['weapon', false],
    ['bow-runes-crafted', false],
    ['waystone-corrupted', false],
    // Uniques, unidentified or not.
    ['unique', false],
    ['unique-unid', false],
    // Marked craftable in EE2 data, but nothing to craft on (FINDINGS F-09).
    ['currency', false],
    ['rune', false],
    ['uncut-gem', false],
    ['meta-gem-no-item-class', false],
  ])('%s: %s', (name, craftable) => {
    expect(canCraftOfExile(parse(fixture(name)))).toBe(craftable);
  });

  it('imports the item text into the PoE2 calculator', () => {
    expect(craftOfExileUrl(parse(items.RARE_RING))).toBe(
      `https://craftofexile.com/?game=poe2&eimport=${encodeURIComponent(items.RARE_RING)}`,
    );
  });
});

describe('link and stash search hotkeys', () => {
  it('open the same pages as the buttons, PoE2DB in the game language', () => {
    const ring = parse(items.RARE_RING);
    expect(itemAction('wiki', ring)).toEqual({ open: `${WIKI}/Prismatic_Ring` });
    expect(itemAction('poedb', ring, 'ru')).toEqual({ open: 'https://poe2db.tw/ru/Rings#ModifiersCalc' });
    expect(itemAction('craft-of-exile', ring)).toEqual({ open: craftOfExileUrl(ring) });
    expect(itemAction('stash-search', ring)).toEqual({ stashSearch: '"Prismatic Ring"' });
  });

  it('work on every kind of item', () => {
    const rune = parse(fixture('rune'));
    expect(itemAction('wiki', rune)).toEqual({ open: `${WIKI}/Greater_Iron_Rune` });
    expect(itemAction('poedb', parse(items.WAYSTONE))).toEqual({ open: `${POEDB}/Waystones` });
    expect(itemAction('stash-search', parse(items.UNCUT_GEM))).toEqual({ stashSearch: '"Uncut Skill Gem (Level 19)"' });
  });

  it('do nothing in Craft of Exile for items you cannot craft on', () => {
    expect(itemAction('craft-of-exile', parse(items.CURRENCY_EXALTED))).toBeNull();
    expect(itemAction('craft-of-exile', parse(items.RARE_CROSSBOW))).toBeNull();
    expect(itemAction('craft-of-exile', parse(items.UNIQUE_FOCUS))).toBeNull();
  });
});

describe('weapon DPS', () => {
  it('crossbow: physical, lightning and the reload time', () => {
    // 1.89 APS; physical 74-231 (avg 152.5) → 288.2; lightning 10-273 (avg 141.5) → 267.4;
    // total 1.89 × 294 = 555.7. 20 % quality and corrupted: nothing at Q20.
    expect(weaponDps(parse(items.RARE_CROSSBOW))).toEqual({ phys: 288, elem: 267, chaos: 0, total: 556, reload: 0.93 });
  });

  it('bow: physical and fire, Q20 only below 20 % quality', () => {
    // 1.27 APS; physical 288-534 (avg 411) → 522.0; fire 47-92 (avg 69.5) → 88.3; total 610.2.
    expect(weaponDps(parse(items.RARE_BOW))).toEqual({ phys: 522, elem: 88, chaos: 0, total: 610 });
    // At 10 %: 411 / 1.1 × 1.2 = 448.4 physical (the increased and flat mods cancel out), × 1.27 → 569.4.
    const q10Bow = items.RARE_BOW.replace('Quality: +20% (augmented)', 'Quality: +10% (augmented)').replace('--------\nCorrupted\n', '');
    expect(weaponDps(parse(q10Bow))).toEqual({ phys: 522, elem: 88, chaos: 0, total: 610, q20: { phys: 569, total: 657 } });
    // Corrupted: quality cannot be raised any more.
    const q10Corrupted = items.RARE_BOW.replace('Quality: +20% (augmented)', 'Quality: +10% (augmented)');
    expect(weaponDps(parse(q10Corrupted))?.q20).toBeUndefined();
  });

  it('magic mace without quality', () => {
    // 1.2 APS; physical 35-72 (avg 53.5) → 64.2, at 20 % 53.5 × 1.2 × 1.2 = 77.0;
    // lightning 1-50 (avg 25.5) → 30.6; total 94.8, at Q20 107.6.
    expect(weaponDps(parse(fixture('magic-mace')))).toEqual({ phys: 64, elem: 31, chaos: 0, total: 95, q20: { phys: 77, total: 107 } });
  });

  it('adds chaos damage, which EE2 does not read', () => {
    const text = items.RARE_CROSSBOW.replace('Critical Hit Chance:', 'Chaos Damage: 10-20 (chaos)\nCritical Hit Chance:');
    // 1.89 × 15 = 28.4; total 1.89 × (152.5 + 141.5 + 15) = 584.0.
    expect(weaponDps(parse(text))).toEqual({ phys: 288, elem: 267, chaos: 28, total: 584, reload: 0.93 });
  });

  it('reads the properties of unique weapons, which EE2 drops', () => {
    const widowhail = [
      'Item Class: Bows',
      'Rarity: Unique',
      'Widowhail',
      'Crude Bow',
      '--------',
      'Quality: +20% (augmented)',
      'Physical Damage: 7-13',
      'Critical Hit Chance: 5.00%',
      'Attacks per Second: 1.20',
      '--------',
      'Item Level: 10',
      '',
    ].join('\n');
    // 1.2 × 10 = 12.
    expect(weaponDps(parse(widowhail))).toEqual({ phys: 12, elem: 0, chaos: 0, total: 12 });
  });

  it('is not shown for other items', () => {
    expect(weaponDps(parse(items.RARE_RING))).toBeNull();
    expect(weaponDps(parse(items.UNIQUE_FOCUS))).toBeNull();
    expect(weaponDps(parse(items.RARE_SCEPTRE))).toBeNull();
  });
});
