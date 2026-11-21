// "Import from Exiled Exchange 2": stash search groups and map check marks from EE2's config.json.
// The fixture has the shape of a real EE2 config.json (widgets with wmType), with made-up entries.
import { describe, expect, it } from 'vitest';
import { ee2Hotkey, ee2MapCheck, ee2StashGroups, parseEe2Config } from '../src/app/settings/ee2-import';

const CONFIG = {
  configVersion: 20,
  overlayKey: 'Shift + Space',
  widgets: [
    { wmId: 1, wmType: 'price-check', wmTitle: '', hotkey: 'Ctrl + D', hotkeyHold: 'Alt' },
    {
      wmId: 4,
      wmType: 'stash-search',
      wmTitle: 'Test group A',
      enableHotkeys: true,
      entries: [
        { id: 1, name: '', text: 'alpha beta', hotkey: null },
        { id: 7, name: 'Named', text: '"gamma delta"', hotkey: 'Ctrl + Shift + 1' },
        { id: 9, name: 'Bad key', text: 'epsilon', hotkey: 'Ctrl + MouseWheel' },
        { id: 10, name: 'No text', hotkey: 'F5' },
      ],
    },
    {
      wmId: 5,
      wmType: 'stash-search',
      wmTitle: 'Test group B',
      enableHotkeys: false,
      entries: [{ id: 2, name: '', text: 'zeta', hotkey: 'Alt + F11' }],
    },
    {
      wmId: 6,
      wmType: 'item-check',
      hotkey: 'Ctrl + F11',
      maps: {
        profile: 3,
        showNewStats: true,
        selectedStats: [
          { matcher: 'test stat one', decision: 'w--' },
          { matcher: 'test stat two', decision: 'd-d' },
          { matcher: 'broken', decision: 5 },
        ],
      },
    },
  ],
};

describe('ee2Hotkey', () => {
  it.each([
    ['Ctrl + F11', 'Ctrl+F11'],
    ['Shift + Space', 'Shift+Space'],
    ['Ctrl + Shift + D', 'Ctrl+Shift+KeyD'],
    ['Shift + Ctrl + D', 'Ctrl+Shift+KeyD'],
    ['Control + D', 'Ctrl+KeyD'],
    ['Alt + 1', 'Alt+Digit1'],
    ['F5', 'F5'],
    ['Ctrl + /', 'Ctrl+Slash'],
    ['Ctrl + Up', 'Ctrl+ArrowUp'],
  ])('%s → %s', (ee2, ours) => {
    expect(ee2Hotkey(ee2)).toBe(ours);
  });

  it('drops what cannot be registered', () => {
    expect(ee2Hotkey(null)).toBeNull();
    expect(ee2Hotkey(undefined)).toBeNull();
    expect(ee2Hotkey('')).toBeNull();
    expect(ee2Hotkey('   ')).toBeNull();
    expect(ee2Hotkey('Hyper + D')).toBeNull();
    expect(ee2Hotkey('Ctrl + MouseWheel')).toBeNull();
    expect(ee2Hotkey('Ctrl + ')).toBeNull();
    expect(ee2Hotkey(42)).toBeNull();
  });
});

describe('ee2StashGroups', () => {
  it('turns each stash search widget into a group, hotkeys converted, unusable ones dropped', () => {
    expect(ee2StashGroups(CONFIG)).toEqual([
      {
        id: 1,
        title: 'Test group A',
        enableHotkeys: true,
        entries: [
          { id: 1, name: '', text: 'alpha beta', hotkey: null },
          { id: 2, name: 'Named', text: '"gamma delta"', hotkey: 'Ctrl+Shift+Digit1' },
          { id: 3, name: 'Bad key', text: 'epsilon', hotkey: null },
        ],
      },
      { id: 2, title: 'Test group B', enableHotkeys: false, entries: [{ id: 1, name: '', text: 'zeta', hotkey: 'Alt+F11' }] },
    ]);
  });

  it('keeps hotkeys on when the widget does not say', () => {
    const widgets = [{ wmType: 'stash-search', wmTitle: 123, entries: [{ text: 'x', name: 5 }] }];
    expect(ee2StashGroups({ widgets })).toEqual([{ id: 1, title: '', enableHotkeys: true, entries: [{ id: 1, name: '', text: 'x', hotkey: null }] }]);
  });

  it('does not take the price check hotkeys', () => {
    expect(JSON.stringify(ee2StashGroups(CONFIG))).not.toContain('Ctrl+KeyD');
  });

  it('finds nothing in a config without widgets', () => {
    expect(ee2StashGroups({})).toEqual([]);
    expect(ee2StashGroups(null)).toEqual([]);
    expect(ee2StashGroups({ widgets: 'x' })).toEqual([]);
  });
});

describe('ee2MapCheck', () => {
  it('takes the item check widget maps, leaving out broken marks', () => {
    expect(ee2MapCheck(CONFIG)).toEqual({
      profile: 3,
      showNewStats: true,
      selectedStats: [
        { matcher: 'test stat one', decision: 'w--' },
        { matcher: 'test stat two', decision: 'd-d' },
      ],
    });
  });

  it('uses profile 1 and hides new stats when the widget does not say', () => {
    expect(ee2MapCheck({ widgets: [{ wmType: 'item-check', maps: { selectedStats: [] } }] })).toEqual({ profile: 1, showNewStats: false, selectedStats: [] });
  });

  it('is null without an item check widget or maps', () => {
    expect(ee2MapCheck({ widgets: [] })).toBeNull();
    expect(ee2MapCheck({ widgets: [{ wmType: 'item-check' }] })).toBeNull();
    expect(ee2MapCheck(null)).toBeNull();
  });
});

describe('parseEe2Config', () => {
  it('reads JSON and gives null for a missing or broken file', () => {
    expect(parseEe2Config(JSON.stringify(CONFIG))).toEqual(CONFIG);
    expect(parseEe2Config(null)).toBeNull();
    expect(parseEe2Config('{broken')).toBeNull();
    expect(parseEe2Config('null')).toBeNull();
  });
});
