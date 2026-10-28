import { beforeAll, describe, expect, it } from 'vitest';
import { parseClipboard, type ParsedItem } from '@/parser';
import {
  canCraftOfExile,
  craftOfExileUrl,
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

describe('item check', () => {
  it('links to the wiki and PoE2DB by the base or unique name', () => {
    const unique = parse(items.UNIQUE_FOCUS);
    expect(wikiUrl(unique)).toBe('https://www.poe2wiki.net/wiki/The_Eternal_Spark');
    expect(poedbUrl(unique)).toBe('https://poe2db.tw/us/The_Eternal_Spark');
    expect(wikiUrl(parse(items.RARE_RING))).toBe('https://www.poe2wiki.net/wiki/Prismatic_Ring');
  });

  it('offers Craft of Exile only for craftable, uncorrupted items', () => {
    const ring = parse(items.RARE_RING);
    expect(canCraftOfExile(ring)).toBe(true);
    expect(craftOfExileUrl(ring)).toBe(`https://craftofexile.com/?game=poe2&eimport=${encodeURIComponent(items.RARE_RING)}`);
    expect(canCraftOfExile(parse(items.RARE_CROSSBOW))).toBe(false);
    expect(canCraftOfExile(parse(items.CURRENCY_EXALTED))).toBe(false);
  });

  it('searches the stash for the item name as a phrase', () => {
    expect(stashSearchText(parse(items.UNIQUE_FOCUS))).toBe('"The Eternal Spark"');
    expect(stashSearchText(parse(items.RARE_RING))).toBe('"Prismatic Ring"');
  });

  it('computes weapon DPS from the properties', () => {
    // 20 % quality and corrupted: no better quality possible.
    expect(weaponDps(parse(items.RARE_BOW))).toEqual({ phys: 522, elem: 88, total: 610 });
    const q10Bow = items.RARE_BOW.replace('Quality: +20% (augmented)', 'Quality: +10% (augmented)').replace('--------\nCorrupted\n', '');
    expect(weaponDps(parse(q10Bow))).toEqual({ phys: 522, elem: 88, total: 610, q20: { phys: 569, total: 657 } });
    expect(weaponDps(parse(items.RARE_RING))).toBeNull();
  });
});
