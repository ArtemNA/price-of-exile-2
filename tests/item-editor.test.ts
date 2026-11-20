import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { ItemCategory, parseClipboard, type ParsedItem } from '@/parser';
import { buildPriceDb, type NinjaPrice } from '../src/app/core/ninja-prices';
import {
  applyEdits,
  augmentTabsFor,
  catalystsFor,
  editorItemByName,
  editorKind,
  extractionValue,
  NO_EDITS,
  qualitySteps,
} from '../src/app/price-check/item-editor';
import { createItemPresets } from '../src/app/price-check/price-check';
import { loadGameDataFromDisk } from './game-data';

beforeAll(loadGameDataFromDisk);

const FIXTURES = new URL('./fixtures/items/', import.meta.url);
const parse = (file: string): ParsedItem => parseClipboard(readFileSync(new URL(file, FIXTURES), 'utf-8'))._unsafeUnwrap();
// Every preset's filters: the Pseudo one sums stats, the Mods one keeps them as they are.
const stats = (item: ParsedItem) => createItemPresets(item, 'Standard').presets.flatMap((preset) => preset.stats);
const roll = (item: ParsedItem, ref: string) => stats(item).find((filter) => filter.statRef === ref)?.roll?.value;
const price = (name: string, primaryValue: number) =>
  ({ type: 'Runes', ns: 'ITEM', name, primaryValue, detailsId: name, sparkline: { data: [], totalChange: 0 } }) as unknown as NinjaPrice;

describe('item editor', () => {
  it('gives sockets to weapons with sockets and a catalyst to rings, nothing to the rest', () => {
    expect(editorKind(parse('bow-runes-crafted.txt'))).toBe('augment');
    expect(editorKind(parse('rare-ring.txt'))).toBe('catalyst');
    expect(editorKind(parse('jewel.txt'))).toBe('catalyst');
    expect(editorKind(parse('unique.txt'))).toBeNull();
    // Armour without sockets has nothing to edit.
    expect(editorKind(parse('normal-helmet.txt'))).toBeNull();
  });

  it('puts another rune into a socket: the filters follow, the checked item stays as copied', () => {
    const bow = parse('bow-runes-crafted.txt');
    const dexterity = editorItemByName(ItemCategory.Bow, 'Greater Adept Rune')!;
    expect(dexterity).toBeDefined();
    const edited = applyEdits(bow, { augments: { 0: dexterity }, catalyst: null });
    expect(edited.augmentSockets!.augments[0]!.refName).toBe('Greater Adept Rune');
    expect(stats(edited).some((filter) => filter.statRef === '# to Dexterity')).toBe(true);
    // The original keeps its Perfect Iron Rune and gets no Dexterity.
    expect(bow.augmentSockets!.augments[0]!.refName).toBe('Perfect Iron Rune');
    expect(stats(bow).some((filter) => filter.statRef === '# to Dexterity')).toBe(false);
    expect(applyEdits(bow, NO_EDITS)).toBe(bow);
  });

  it('raises the matching mods by the catalyst quality', () => {
    const ring = parse('rare-ring.txt');
    expect(roll(ring, '# to Strength')).toBe(12);
    const edited = applyEdits(ring, { augments: {}, catalyst: { refName: 'Adaptive Catalyst', quality: 20 } });
    expect(roll(edited, '# to Strength')).toBe(14);
    expect(roll(edited, '#% to Cold Resistance')).toBe(15); // not an attribute
    expect(roll(ring, '# to Strength')).toBe(12);
    const cold = applyEdits(ring, { augments: {}, catalyst: { refName: "Tul's Catalyst", quality: 20 } });
    expect(roll(cold, '#% to Cold Resistance')).toBe(18);
  });

  it('groups socketables and catalysts as EE2 does', () => {
    const tabs = augmentTabsFor(ItemCategory.Bow);
    expect(tabs.map((tab) => tab.id)).toContain('rune');
    expect(tabs.find((tab) => tab.id === 'rune')!.sub.map((sub) => sub.id)).toEqual(['lesser', 'normal', 'greater', 'perfect', 'other']);
    expect(catalystsFor(parse('rare-ring.txt'))).toHaveLength(13);
    expect(catalystsFor(parse('jewel.txt')).every((catalyst) => catalyst.tags[0] === 'jewel_catalyst')).toBe(true);
    expect(qualitySteps(parse('rare-ring.txt'))).toEqual([0, 20, 30, 40, 50]);
    expect(qualitySteps(parse('jewel.txt'))).toEqual([0, 20]);
  });

  it('values what is socketed minus the Orb of Extraction', () => {
    const bow = parse('bow-runes-crafted.txt');
    const db = buildPriceDb([[price('Perfect Iron Rune', 0.5), price('Greater Iron Rune', 0.1), price('Orb of Extraction', 0.05)]]);
    const value = extractionValue(bow, db)!;
    expect(value.socketed).toBeCloseTo(0.6);
    expect(value.net).toBeCloseTo(0.55);
    expect(value.unpriced).toBe(1); // Countess Seske's Rune of Archery
    expect(extractionValue(bow, buildPriceDb([[price('Perfect Iron Rune', 0.5)]]))).toBeNull(); // no orb price
    expect(extractionValue(parse('rare-ring.txt'), db)).toBeNull();
  });
});
