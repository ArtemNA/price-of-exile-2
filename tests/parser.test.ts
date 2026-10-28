import { beforeAll, describe, expect, it } from 'vitest';
import { ITEM_BY_REF, STAT_BY_MATCH_STR } from '@/assets/data';
import { ItemCategory, ItemRarity, parseClipboard, type ParsedItem } from '@/parser';
import { loadGameDataFromDisk } from './game-data';
import * as items from './items';

beforeAll(loadGameDataFromDisk);

function parse(text: string): ParsedItem {
  const result = parseClipboard(text);
  if (result.isErr()) throw new Error(`parse failed: ${result.error}`);
  return result.value;
}

const explicitTexts = (item: ParsedItem) =>
  item.statsByType.filter((s) => s.type === 'explicit').map((s) => s.stat.ref);

describe('game data indexes', () => {
  it('finds items by namespace and ref name', () => {
    expect(ITEM_BY_REF('UNIQUE', 'Headhunter')?.[0].refName).toBe('Headhunter');
    expect(ITEM_BY_REF('ITEM', 'Sapphire Ring')?.[0].namespace).toBe('ITEM');
  });

  it('finds stats by matcher string', () => {
    // Matcher strings are stored without the sign.
    expect(STAT_BY_MATCH_STR('# to maximum Life')?.stat.ref).toBe('+# to maximum Life');
  });
});

describe('parseClipboard', () => {
  it('parses a rare ring with advanced mod descriptions', () => {
    const item = parse(items.RARE_RING);
    expect(item.rarity).toBe(ItemRarity.Rare);
    expect(item.category).toBe(ItemCategory.Ring);
    expect(item.info.refName).toBe('Sapphire Ring');
    expect(item.itemLevel).toBe(84);
    expect(item.unknownModifiers).toEqual([]);
    expect(item.statsByType.find((s) => s.type === 'implicit')?.stat.ref).toBe('+#% to Cold Resistance');
    expect(explicitTexts(item)).toEqual(
      expect.arrayContaining([
        '+# to maximum Life',
        '+#% to Fire Resistance',
        '+#% to Lightning Resistance',
        '+# to Dexterity',
      ]),
    );

    const life = item.newMods.find((m) => m.info.name === 'Rotund');
    expect(life?.info).toMatchObject({ generation: 'prefix', tier: 4 });
  });

  // Since 3.29 the game always copies advanced descriptions, and APT dropped
  // parsing mods without `{ ... }` headers. The base is still recognized.
  it('recognizes the base but not the mods of pre-3.29 text', () => {
    const item = parse(items.LEGACY_RARE_RING);
    expect(item.info.refName).toBe('Sapphire Ring');
    expect(explicitTexts(item)).toEqual([]);
  });

  it('parses a unique with linked sockets', () => {
    const item = parse(items.UNIQUE_TABULA);
    expect(item.rarity).toBe(ItemRarity.Unique);
    expect(item.info.refName).toBe('Tabula Rasa');
    expect(item.sockets).toEqual({ linked: 6, white: 6 });
  });

  it('parses a currency stack', () => {
    const item = parse(items.CURRENCY_CHAOS);
    expect(item.info.refName).toBe('Chaos Orb');
    expect(item.category).toBe(ItemCategory.Currency);
    expect(item.stackSize).toEqual({ value: 15, max: 20 });
  });

  it('parses a skill gem', () => {
    const item = parse(items.GEM_ARC);
    expect(item.category).toBe(ItemCategory.Gem);
    expect(item.info.refName).toBe('Arc');
    expect(item.gemLevel).toBe(20);
    expect(item.quality).toBe(20);
  });

  it('parses a divination card', () => {
    const item = parse(items.DIVINATION_DOCTOR);
    expect(item.category).toBe(ItemCategory.DivinationCard);
    expect(item.info.refName).toBe('The Doctor');
  });

  it('parses an unidentified corrupted rare', () => {
    const item = parse(items.UNIDENTIFIED_CORRUPTED);
    expect(item.info.refName).toBe('Onyx Amulet');
    expect(item.isUnidentified).toBe(true);
    expect(item.isCorrupted).toBe(true);
  });

  it('rejects text that is not an item', () => {
    expect(parseClipboard('hello world').isErr()).toBe(true);
  });
});
