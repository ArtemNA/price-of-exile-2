import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { __testExports, type DisplayItem } from '@/web/price-check/trade/pathofexile-trade';
import { defaultSettings, upgradeSettings } from '../src/app/core/settings';
import { cardLabel, cardPlace, cardShown, cardTop, listingCard } from '../src/app/price-check/listing-card';
import { loadGameDataFromDisk } from './game-data';

beforeAll(loadGameDataFromDisk);

// Real trade fetch answers EE2 keeps for its tooltip tests.
const responses = JSON.parse(readFileSync(new URL('./ee2/docs/fetchResponses.json', import.meta.url), 'utf-8')) as {
  result: Array<{ id: string; item?: unknown }>;
};
const display = (idPrefix: string): DisplayItem =>
  __testExports.parseFetchResult(responses.result.find((result) => result.id.startsWith(idPrefix)) as never)!;
// Texts as the English strings give them.
const EN: Record<string, string> = {
  'item.physical_dps': 'Physical DPS: {0}',
  'item.total_dps': 'Total DPS: {0}',
  'item.item_level': 'Item Level: {0}',
  'item.crit': 'Critical Hit Chance: {0}%',
  'item.aps': 'Attacks per Second: {0}',
};
const translate = (key: string) => EN[key] ?? key;
const texts = (lines: Array<{ label: string; value?: string }>) => lines.map((line) => line.label + (line.value ?? ''));

describe('listing card', () => {
  it('lays a rare weapon out as the game does: title, damage, level, mods with tiers', () => {
    const card = listingCard(display('00d17082'), translate);
    expect(card.title).toEqual(['Phoenix Brand', 'Crumbling Maul']);
    expect(card.header).toBe('Rare-title');
    expect(card.separator).toBe('Rare');
    expect(card.icon?.w).toBe(2);
    const [props, level, ...rest] = card.sections;
    // Total DPS goes before the damage lines; a "{0}%" text keeps its value's own "%".
    expect(texts(props)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Total DPS: [\d.]+$/), expect.stringMatching(/^Critical Hit Chance: [\d.]+%$/)]),
    );
    expect(texts(props).findIndex((text) => text.startsWith('Total DPS'))).toBeLessThan(
      texts(props).findIndex((text) => text.startsWith('Physical DPS')),
    );
    expect(texts(level)[0]).toMatch(/^Item Level: \d+$/);
    const mods = rest.at(-1)!;
    expect(mods.length).toBe(4);
    expect(mods.every((line) => /^[PS]\d/.test(line.tier ?? ''))).toBe(true);
    // No empty section, no "{0}" left anywhere.
    expect(card.sections.every((section) => section.length > 0)).toBe(true);
    expect(card.sections.flat().some((line) => line.label.includes('{0}'))).toBe(false);
  });

  it('draws a magic item on the magic header and its rune socket', () => {
    const card = listingCard(display('8cf987de'), translate);
    expect(card.header).toBe('Magic-title');
    expect(card.sockets).toEqual([{ group: 0, type: 'rune' }]);
  });

  it('puts each footer tag in its own last section: Corrupted in red', () => {
    const card = listingCard(display('91c9f13d'), translate);
    const last = card.sections.at(-1)!;
    expect(last).toHaveLength(1);
    expect(last[0]).toMatchObject({ label: 'Corrupted', color: 2 });
    expect(card.header).toBe('Magic-title');
  });

  it('gives a rarity without header art a plain title (gems, currency)', () => {
    const card = listingCard({ title: ['Divine Orb'], rarity: 'Currency' as never, sockets: [], itemTags: [] }, translate);
    expect(card).toMatchObject({ header: null, separator: null, sections: [] });
  });

  it('labels: the value after the text, "{0}%" texts cut before their value', () => {
    expect(cardLabel('item.item_level', translate)).toBe('Item Level: ');
    expect(cardLabel('item.crit', translate)).toBe('Critical Hit Chance: ');
    expect(cardLabel('Quality: {0}', translate)).toBe('Quality: ');
    expect(cardLabel('Corrupted', translate)).toBe('Corrupted');
  });

  it('shows on hover only as the setting says: never, on the eye, with Shift, always', () => {
    const at = (shift: boolean, eye: boolean) => ({ shift, eye });
    const all = [at(false, false), at(true, false), at(false, true), at(true, true)];
    expect(all.map((pointer) => cardShown('off', pointer))).toEqual([false, false, false, false]);
    // The eye needs no key: Shift alone on the row does nothing, the eye with or without it shows.
    expect(all.map((pointer) => cardShown('eye', pointer))).toEqual([false, false, true, true]);
    expect(all.map((pointer) => cardShown('keybind', pointer))).toEqual([false, true, false, true]);
    expect(all.map((pointer) => cardShown('always', pointer))).toEqual([true, true, true, true]);
  });

  it('stands left of the row when there is room, else right, inside the window', () => {
    const item = display('00d17082');
    const window = { width: 960, height: 600 };
    // Our theme: listings on the right, the filters column on the left gives the room.
    const high = cardPlace(item, { left: 440, right: 960, top: 100, bottom: 124 }, window);
    expect(high).toMatchObject({ side: 'left', x: 530, maxWidth: 426, maxHeight: 592, rowMiddle: 112, windowHeight: 600 });
    // EE2 theme on the left of the game: the room is on the right of the column.
    const right = cardPlace(item, { left: 0, right: 460, top: 100, bottom: 124 }, { width: 980, height: 1000 });
    expect(right).toMatchObject({ side: 'right', x: 470, maxWidth: 506 });
    // EE2 theme in the centre: about as much room on both sides, the card stays on the left as in EE2.
    const centre = cardPlace(item, { left: 536, right: 950, top: 490, bottom: 512 }, { width: 1500, height: 861 });
    expect(centre).toMatchObject({ side: 'left', x: 974, maxWidth: 522 });
  });

  it('is centred on its row once its height is known, moved in at the window edges', () => {
    // A 200 px card on a row in the middle: 100 px above and below the row's middle.
    expect(cardTop(300, 200, 600)).toBe(200);
    // Near the top or the bottom it moves in, 4 px from the edge.
    expect(cardTop(30, 200, 600)).toBe(4);
    expect(cardTop(580, 200, 600)).toBe(396);
    // Taller than the window: from its top (the card scrolls no further; the bottom is cut).
    expect(cardTop(300, 700, 600)).toBe(4);
  });

  it('is shown on the eye by default; a setting the app does not know falls back to it', () => {
    expect(defaultSettings().priceCheck.listingCard).toBe('eye');
    expect(upgradeSettings({ priceCheck: { listingCard: 'sometimes' } }).priceCheck.listingCard).toBe('eye');
    expect(upgradeSettings({ priceCheck: { listingCard: 'keybind' } }).priceCheck.listingCard).toBe('keybind');
    expect(upgradeSettings({ priceCheck: { listingCard: 'always' } }).priceCheck.listingCard).toBe('always');
  });
});
