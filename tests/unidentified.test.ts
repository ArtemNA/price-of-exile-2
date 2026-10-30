// Stage 11: the "Which one?" picker for an unidentified unique and the search after picking.
// PoE2 copies such an item with its base only ("Rarity: Unique", "Felt Cap", "Unidentified").

import { beforeAll, describe, expect, it } from 'vitest';
import { ItemRarity, parseClipboard, type ParsedItem } from '@/parser';
import { createTradeRequest } from '../src/lib/ee2/web/price-check/trade/pathofexile-trade';
import { requestFilters } from '../src/app/price-check/filter-view';
import { activePreset, createItemPresets } from '../src/app/price-check/price-check';
import { identifiedVariants, identifyAs, needsIdentification } from '../src/app/price-check/unidentified';
import { loadGameDataFromDisk, loadI18nFromDisk } from './game-data';
import * as items from './items';

beforeAll(async () => {
  await loadGameDataFromDisk();
  await loadI18nFromDisk();
});

const parse = (text: string): ParsedItem => parseClipboard(text)._unsafeUnwrap();
const pick = (item: ParsedItem, name: string) => identifyAs(item, identifiedVariants(item).find((u) => u.refName === name)!);
/** The trade2 query the item's first search sends. */
function query(item: ParsedItem) {
  const preset = activePreset(createItemPresets(item, 'Standard'));
  return createTradeRequest(requestFilters(preset.filters), preset.stats, item).query as {
    name?: unknown;
    type?: unknown;
    filters: Record<string, { filters: Record<string, unknown> }>;
  };
}

describe('unidentified uniques', () => {
  it('has a single choice for a base with one unique', () => {
    const cap = parse(items.UNIQUE_UNIDENTIFIED);
    expect(needsIdentification(cap)).toBe(true);
    expect(cap.info).toMatchObject({ namespace: 'ITEM', refName: 'Felt Cap' });
    // The "Runemastered Felt Cap" Goldrim is another base, not a second choice.
    expect(identifiedVariants(cap).map((u) => u.refName)).toEqual(['Goldrim']);
  });

  it('lists the uniques the base can be', () => {
    const ring = parse(items.UNIQUE_UNIDENTIFIED_SEVERAL);
    expect(needsIdentification(ring)).toBe(true);
    const variants = identifiedVariants(ring);
    expect(variants.map((u) => u.refName).sort()).toEqual(['Dream Fragments', 'Polcirkeln', 'Whisper of the Brotherhood']);
    expect(variants.every((u) => u.icon?.startsWith('https://'))).toBe(true);
  });

  it('skips the data placeholders: unnamed and "INCOMPLETE" uniques', () => {
    const spear = parse(items.UNIQUE_UNIDENTIFIED.replace('Helmets', 'Spears').replace('Felt Cap', 'Hunting Spear'));
    expect(identifiedVariants(spear).map((u) => u.refName)).toEqual(['Chainsting']);
    const ring = parse(items.UNIQUE_UNIDENTIFIED_SEVERAL.replace('Sapphire Ring', 'Ring'));
    expect(identifiedVariants(ring).map((u) => u.refName)).toEqual(["Kalandra's Touch"]);
  });

  it('identifies as the picked unique, keeping the base and the unidentified state', () => {
    const ring = parse(items.UNIQUE_UNIDENTIFIED_SEVERAL);
    const polcirkeln = pick(ring, 'Polcirkeln');
    expect(polcirkeln.info).toMatchObject({ namespace: 'UNIQUE', refName: 'Polcirkeln', unique: { base: 'Sapphire Ring' } });
    expect(polcirkeln.isUnidentified).toBe(true);
    expect(polcirkeln.rarity).toBe(ItemRarity.Unique);
    expect(needsIdentification(polcirkeln)).toBe(false);
    // The copied item stays as it was.
    expect(ring.info.refName).toBe('Sapphire Ring');
  });

  it('searches the picked unique by name and base, unidentified only', () => {
    const q = query(pick(parse(items.UNIQUE_UNIDENTIFIED_SEVERAL), 'Polcirkeln'));
    expect(q.name).toBe('Polcirkeln');
    expect(q.type).toBe('Sapphire Ring');
    expect(q.filters.misc_filters.filters.identified).toEqual({ option: 'false' });
  });

  it('searches the auto-picked unique the same way', () => {
    const cap = parse(items.UNIQUE_UNIDENTIFIED);
    const q = query(identifyAs(cap, identifiedVariants(cap)[0]));
    expect(q).toMatchObject({ name: 'Goldrim', type: 'Felt Cap' });
    expect(q.filters.misc_filters.filters.identified).toEqual({ option: 'false' });
  });

  it('leaves identified uniques and unidentified rare or magic items alone', () => {
    expect(needsIdentification(parse(items.UNIQUE_FOCUS))).toBe(false);
    expect(needsIdentification(parse(items.RARE_UNIDENTIFIED))).toBe(false);
    expect(needsIdentification(parse(items.MAGIC_UNID_TIER))).toBe(false);
  });
});
