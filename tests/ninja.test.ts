import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseClipboard, type ParsedItem } from '@/parser';
import {
  autoCurrency,
  displayRounding,
  findItemPrice,
  ninjaLeagueSlug,
  ninjaUrl,
  priceDbFromNinja,
  priceTrend,
  relatedItems,
  sparkline,
} from '../src/app/core/ninja-prices';
import { loadGameDataFromDisk } from './game-data';
import * as items from './items';

beforeAll(loadGameDataFromDisk);

/** Lines of the real poe.ninja dense overviews, Standard 27.10.2026. */
const NINJA = JSON.parse(readFileSync(new URL('./fixtures/ninja-standard.json', import.meta.url), 'utf-8'));
const DB = priceDbFromNinja(NINJA);

function parse(text: string): ParsedItem {
  return parseClipboard(text)._unsafeUnwrap();
}

const SACRIFICE_AT_DAWN = `Item Class: Map Fragments
Rarity: Normal
Sacrifice at Dawn
--------
Stack Size: 1/10
--------
Can be used in a personal Map Device.
`;

describe('poe.ninja prices', () => {
  it('finds the variant poe.ninja lists for the item', () => {
    const tabula = findItemPrice(DB, parse(items.UNIQUE_TABULA))!;
    expect(tabula.query).toEqual({ ns: 'UNIQUE', name: 'Tabula Rasa', variant: 'Simple Robe, 6L' });
    expect(tabula.price?.page).toBe('unique-armours');

    const arc = findItemPrice(DB, parse(items.GEM_ARC))!;
    expect(arc.query.variant).toBe('20/20');
    expect(arc.price?.name).toBe('Arc');
  });

  it('prices rares by base type and item level, and misses unlisted items', () => {
    const ring = parse(items.RARE_RING);
    expect(findItemPrice(DB, ring)!.query).toMatchObject({ ns: 'ITEM', name: ring.info.refName, variant: String(ring.itemLevel) });
    const doctor = findItemPrice(DB, parse(items.DIVINATION_DOCTOR))!;
    expect(doctor.query.name).toBe('The Doctor');
    expect(doctor.price).toBeUndefined();
  });

  it('links to the poe.ninja item page', () => {
    const tabula = findItemPrice(DB, parse(items.UNIQUE_TABULA))!.price!;
    expect(ninjaUrl(tabula, 'Standard')).toBe(
      'https://poe.ninja/poe1/economy/standard/unique-armours/tabula-rasa-simple-robe-6l',
    );
    expect(ninjaLeagueSlug('Hardcore Settlers')).toBe('settlershc');
    expect(ninjaLeagueSlug('Settlers')).toBe('settlers');
  });

  it('shows prices in chaos or divines like APT', () => {
    expect(autoCurrency(50, 300)).toEqual({ min: 50, max: 50, currency: 'chaos' });
    expect(autoCurrency(290, 300)).toEqual({ min: 1, max: 1, currency: 'div' });
    expect(autoCurrency(900, 300)).toEqual({ min: 3, max: 3, currency: 'div' });
    expect(displayRounding(4.56)).toBe('4.6');
    expect(displayRounding(0.25, true)).toBe('1 / 4');
    expect(displayRounding(123.4)).toBe('123');
  });

  it('reads the week change from the cumulative graph', () => {
    expect(priceTrend([0.5, 2, 3, 2, 4, 5, 6])!.change).toBe(6);
    expect(priceTrend([-0.2, -2, -1, -3, -2, null, null])!.change).toBe(-2);
    expect(priceTrend([null, null, 3, null, null, null, null])).toBeNull();
    expect(priceTrend([null, 0, null, 0, 1, null, 0])!.change).toBe(0);
  });

  it('draws the sparkline over the 7 day slots, keeping gaps', () => {
    const spark = sparkline([null, 0, 10, null, null, null, 20], 60, 20);
    expect(spark.line).toBe('M10,20 L20,10 L60,0');
    expect(spark.area).toBe('M10,20 L20,10 L60,0 L60,20 L10,20 Z');
    expect(spark.zeroY).toBe(20);
    expect(sparkline([0, 0, null, 0, 0, 0, 0], 60, 20).line).toBe('M0,10 L10,10 L30,10 L40,10 L50,10 L60,10');
  });

  it('lists the set and its rewards with prices', () => {
    const query = findItemPrice(DB, parse(SACRIFICE_AT_DAWN))!.query;
    const group = relatedItems(`${query.ns}::${query.name}`, DB);
    if (!group || 'error' in group) throw new Error(`unexpected ${JSON.stringify(group)}`);
    expect(group.related.map((e) => e.name)).toEqual([
      'Sacrifice at Dawn',
      'Sacrifice at Midnight',
      'Sacrifice at Noon',
      'Sacrifice at Dusk',
    ]);
    expect(group.related[0]).toMatchObject({ highlight: true, chaos: expect.any(Number) });
    expect(group.items.find((e) => e.name === 'Mortal Ignorance')?.chaos).toEqual(expect.any(Number));
    expect(relatedItems('GEM::Arc // 20/20', DB)).toBeNull();
  });
});
