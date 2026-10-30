import { readdirSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { ItemCategory, ItemRarity, parseClipboard, type ParsedItem } from '@/parser';
import { ModifierType } from '@/parser/modifiers';
import { lacksModDetails } from '../src/app/popup-window/item-view';
import { loadGameDataFromDisk } from './game-data';

// PoE2 item texts copied with Ctrl+Alt+C (tests/fixtures/items, docs/analysis/poe2-items-features.md §6).

beforeAll(loadGameDataFromDisk);

const FIXTURES = new URL('./fixtures/items/', import.meta.url);
const text = (file: string) => readFileSync(new URL(file, FIXTURES), 'utf-8');
const parse = (file: string): ParsedItem => parseClipboard(text(file))._unsafeUnwrap();

/** The fixture keeps the base name from before 0.5; the game data knows only the new one. */
const TABLET_OLD_BASE = 'Delirium Precursor Tablet';

describe('PoE2 item fixtures', () => {
  const files = readdirSync(FIXTURES).filter((file) => file.endsWith('.txt'));

  it('has all 24 item texts', () => {
    expect(files).toHaveLength(24);
  });

  it.each(files.filter((file) => file !== 'tablet.txt'))('parses %s', (file) => {
    const result = parseClipboard(text(file));
    expect(result.isOk(), result.isErr() ? result.error : '').toBe(true);
  });

  it('parses the tablet once its base has the 0.5 name', () => {
    expect(parseClipboard(text('tablet.txt'))._unsafeUnwrapErr()).toBe('item.unknown');
    const item = parseClipboard(text('tablet.txt').replace(TABLET_OLD_BASE, 'Delirium Tablet'))._unsafeUnwrap();
    expect(item.category).toBe(ItemCategory.Tablet);
    expect(item.rarity).toBe(ItemRarity.Rare);
    expect(item.isCorrupted).toBe(true);
    expect(item.note).toBe('~b/o 1 exalted');
    expect(item.unknownModifiers).toEqual([]);
  });

  it('tells an item copied without advanced descriptions (plain Ctrl+C), whose mods EE2 cannot read', () => {
    // As scripts/fake-game.ps1 copies with Ctrl+C: the `{ … }` mod headers gone.
    const plain = (file: string) => parseClipboard(text(file).replace(/^\{ .* \}\r?\n/gm, ''))._unsafeUnwrap();
    for (const file of ['rare-ring.txt', 'unique.txt', 'magic-mace.txt', 'amulet-fractured-desecrated.txt', 'waystone.txt']) {
      expect(lacksModDetails(parse(file)), file).toBe(false);
      expect(lacksModDetails(plain(file)), file).toBe(true);
    }
    expect(plain('rare-ring.txt').newMods).toEqual([]);
    // Nothing to tell from: no mods without headers either, or the mods unknown anyway.
    for (const file of ['currency.txt', 'normal-helmet.txt', 'rare-unid.txt', 'uncut-gem.txt']) {
      expect(lacksModDetails(plain(file)), file).toBe(false);
    }
  });

  it('reads the rare ring: base, implicit and explicit mods with tiers', () => {
    const item = parse('rare-ring.txt');
    expect(item.category).toBe(ItemCategory.Ring);
    expect(item.rarity).toBe(ItemRarity.Rare);
    expect(item.info.refName).toBe('Prismatic Ring');
    expect(item.itemLevel).toBe(79);
    const implicits = item.newMods.filter((mod) => mod.info.type === ModifierType.Implicit);
    const explicits = item.newMods.filter((mod) => mod.info.type === ModifierType.Explicit);
    expect(implicits).toHaveLength(1);
    expect(explicits.map((mod) => [mod.info.generation, mod.info.tier])).toEqual([
      ['prefix', 3],
      ['suffix', 7],
      ['suffix', 3],
      ['suffix', 7],
    ]);
    expect(item.unknownModifiers).toEqual([]);
  });

  it('reads waystone tiers and properties', () => {
    const waystone = parse('waystone.txt');
    // EE2 gives waystones the trade site's "Map" category (ItemCategory.Waystone is unused).
    expect(waystone.category).toBe(ItemCategory.Map);
    expect(waystone.info.refName).toBe('Waystone (Tier 14)');
    expect(waystone.mapTier).toBe(14);
    expect([waystone.mapPackSize, waystone.mapRevives, waystone.mapDropChance]).toEqual([34, 2, 75]);
    const corrupted = parse('waystone-corrupted.txt');
    expect(corrupted.mapTier).toBe(16);
    expect(corrupted.isCorrupted).toBe(true);
  });

  it('reads the gem level and sockets of a meta gem without an Item Class line', () => {
    const gem = parse('meta-gem-no-item-class.txt');
    expect(gem.category).toBe(ItemCategory.Gem);
    expect(gem.info.refName).toBe('Mirage Archer');
    expect(gem.gemLevel).toBe(14);
    expect(gem.gemSockets?.number).toBe(4);
  });

  it('reads uncut gems as currency with the level in the name', () => {
    expect(parse('uncut-gem.txt').info.refName).toBe('Uncut Skill Gem (Level 19)');
    expect(parse('uncut-spirit-gem.txt').info.refName).toBe('Uncut Spirit Gem (Level 16)');
  });

  it('reads rune sockets and the runes in them', () => {
    const bow = parse('bow-runes-crafted.txt');
    expect(bow.augmentSockets).toMatchObject({ current: 3, normal: 2, empty: 0 });
    expect(bow.augmentSockets?.augments.map((rune) => rune?.refName)).toEqual([
      'Perfect Iron Rune',
      'Greater Iron Rune',
      "Countess Seske's Rune of Archery",
    ]);
    expect(bow.newMods.some((mod) => mod.info.type === ModifierType.Crafted)).toBe(true);
    const crossbow = parse('weapon.txt');
    expect(crossbow.category).toBe(ItemCategory.Crossbow);
    expect(crossbow.augmentSockets).toMatchObject({ current: 2, normal: 2 });
    expect(crossbow.isFractured).toBe(true);
    expect(crossbow.isCorrupted).toBe(true);
    const types = new Set(crossbow.newMods.map((mod) => mod.info.type));
    for (const type of [ModifierType.Enchant, ModifierType.Augment, ModifierType.Implicit, ModifierType.Skill, ModifierType.Fractured, ModifierType.Desecrated]) {
      expect(types).toContain(type);
    }
    // Free sockets of a magic item wait for runes.
    expect(parse('magic-mace.txt').augmentSockets).toMatchObject({ current: 0, empty: 2 });
  });

  it('reads spirit, quality, unidentified tiers, uniques and stacks', () => {
    expect(parse('sceptre-spirit.txt').weaponSPIRIT).toBe(152);
    expect(parse('charm.txt')).toMatchObject({ category: ItemCategory.Charm, quality: 14 });
    expect(parse('normal-helmet.txt')).toMatchObject({ rarity: ItemRarity.Normal, quality: 9 });
    expect(parse('magic-unid-tier.txt')).toMatchObject({ isUnidentified: true, unidentifiedTier: 4 });
    expect(parse('rare-unid.txt').isUnidentified).toBe(true);
    const unique = parse('unique.txt');
    expect(unique.info).toMatchObject({ namespace: 'UNIQUE', refName: 'The Eternal Spark' });
    expect(unique.category).toBe(ItemCategory.Focus);
    // Unidentified: only the base is known.
    expect(parse('unique-unid.txt').info).toMatchObject({ namespace: 'ITEM', refName: 'Felt Cap' });
    expect(parse('currency.txt')).toMatchObject({ category: ItemCategory.Currency, stackSize: { value: 7, max: 20 } });
    expect(parse('rune.txt').info.refName).toBe('Greater Iron Rune');
    expect(parse('amulet-fractured-desecrated.txt').newMods.map((mod) => mod.info.type)).toContain(ModifierType.Desecrated);
  });
});
