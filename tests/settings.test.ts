import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_HOTKEYS, DEFAULT_MAP_CHECK, DEFAULT_MAP_MARKS, DEFAULT_STASH_SEARCH, SETTINGS_VERSION } from '../src/app/constants';
import { defaultSettings, upgradeSettings } from '../src/app/core/settings';
import { host, hostConfig } from '../src/app/host';
import { hotkeyConflicts, hotkeyLabel, recordHotkey } from '../src/app/settings/hotkey';

const invoke = vi.hoisted(() => vi.fn(async () => [] as string[]));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

function key(code: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}, key = code) {
  return { code, key, ctrlKey: Boolean(mods.ctrl), altKey: Boolean(mods.alt), shiftKey: Boolean(mods.shift) };
}

describe('settings', () => {
  it('treats settings without a version as the oldest format', () => {
    const marks = { ...DEFAULT_MAP_CHECK, profile: 2 };
    const settings = upgradeSettings({ language: 'en', useIntlSite: true, accountName: 'me', leagueId: 'Keepers', mapCheck: marks });
    expect(settings).toEqual({
      ...defaultSettings(),
      useIntlSite: true,
      accountName: 'me',
      leagueId: 'Keepers',
      mapCheck: marks,
    });
    expect(settings.configVersion).toBe(SETTINGS_VERSION);
    expect(settings.hotkeys).toEqual(DEFAULT_HOTKEYS);
  });

  it('gives old settings the default chat commands and keeps edited ones', () => {
    expect(upgradeSettings({ language: 'en' }).commands.map((c) => [c.text, c.hotkey])).toEqual([
      ['/hideout', 'F5'],
      ['/exit', 'F9'],
      ['@last ty', null],
      ['/invite @last', null],
      ['/tradewith @last', null],
      ['/hideout @last', null],
    ]);
    const commands = [{ text: '/kingsmarch', hotkey: 'F6', send: true }];
    expect(upgradeSettings({ configVersion: 1, commands }).commands).toEqual(commands);
    expect(upgradeSettings({ configVersion: 1, commands: 'broken' }).commands).toEqual(defaultSettings().commands);
  });

  it('gives old settings the stash search presets and the panel hotkey', () => {
    const settings = upgradeSettings({ configVersion: 1, hotkeys: { 'price-check': 'Ctrl+KeyD' } });
    expect(settings.hotkeys['stash-panel']).toBe('Alt+KeyF');
    expect(settings.stashSearch.map((group) => group.title)).toEqual(['Map rolling', 'Dump sorting']);
    expect(settings.stashSearch[0].entries.map((entry) => entry.text)).not.toContain('Reflect');
    const groups = [{ id: 7, title: 'Mine', enableHotkeys: false, entries: [] }];
    expect(upgradeSettings({ configVersion: 1, stashSearch: groups }).stashSearch).toEqual(groups);
  });

  it('turns the "instant buyout only" switch of version 1 into a listing type', () => {
    expect(defaultSettings().priceCheck.listingType).toBe('securable');
    const on = upgradeSettings({ configVersion: 1, priceCheck: { merchantOnly: true, searchStatRange: 5 } });
    expect(on.priceCheck).toEqual({ ...defaultSettings().priceCheck, listingType: 'securable', searchStatRange: 5 });
    expect(on.priceCheck).not.toHaveProperty('merchantOnly');
    expect(upgradeSettings({ configVersion: 1, priceCheck: { merchantOnly: false } }).priceCheck.listingType).toBe('online');
    // Version 2 keeps its choice.
    expect(upgradeSettings({ configVersion: 2, priceCheck: { listingType: 'any' } }).priceCheck.listingType).toBe('any');
    expect(upgradeSettings({ configVersion: 1 }).priceCheck.listingType).toBe('securable');
  });

  it('moves the PoE1 map marks of version 2 to PoE2 mods and adds the PoE2 defaults', () => {
    expect(SETTINGS_VERSION).toBe(4);
    const mine = { matcher: 'Monsters are Armoured', decision: '-g-' };
    const mapCheck = {
      profile: 2,
      showNewStats: true,
      selectedStats: [
        { matcher: 'Players have #% to all maximum Resistances', decision: 'w-d' },
        { matcher: 'Players have #% less Recovery Rate of Life and Energy Shield', decision: 'dd-' },
        { matcher: 'Area contains two Unique Bosses', decision: 'g--' },
        { matcher: 'Monsters reflect #% of Physical Damage', decision: 'd--' },
        mine,
      ],
    };
    const upgraded = upgradeSettings({ configVersion: 2, mapCheck }).mapCheck;
    expect(upgraded.profile).toBe(2);
    expect(upgraded.showNewStats).toBe(true);
    expect(upgraded.selectedStats).toEqual([
      { matcher: '#% maximum Player Resistances', decision: 'w-d' },
      { matcher: 'Players have #% less Recovery Rate of Life and Energy Shield', decision: 'dd-' },
      mine,
      { matcher: 'Players have #% less Cooldown Recovery Rate', decision: 'w--' },
      { matcher: 'Players are periodically Cursed with Elemental Weakness', decision: 'w--' },
      { matcher: 'Players are periodically Cursed with Enfeeble', decision: 'w--' },
      { matcher: 'Players are periodically Cursed with Temporal Chains', decision: 'w--' },
      ...DEFAULT_MAP_MARKS.ru,
    ]);
    // Version 3 gets the defaults of the Russian game; version 4 keeps the marks as they are,
    // removed defaults stay removed.
    const v3 = { ...mapCheck, selectedStats: [mine] };
    expect(upgradeSettings({ configVersion: 3, mapCheck: v3 }).mapCheck).toEqual({ ...v3, selectedStats: [mine, ...DEFAULT_MAP_MARKS.ru] });
    expect(upgradeSettings({ configVersion: 4, mapCheck: v3 }).mapCheck).toEqual(v3);
    expect(upgradeSettings({ configVersion: 2 }).mapCheck).toEqual(DEFAULT_MAP_CHECK);
  });

  it('turns the PoE1 stash search presets of version 2 into PoE2 ones and keeps edited ones', () => {
    const v2 = [
      {
        id: 1,
        title: 'Map rolling',
        enableHotkeys: true,
        entries: [
          { id: 1, name: '', text: '"Pack Size: +3"', hotkey: 'F2' },
          { id: 2, name: '', text: '"less Recovery"', hotkey: null },
          { id: 3, name: 'mine', text: '"Monster Damage"', hotkey: null },
          { id: 4, name: '', text: '"Cannot Leech Mana"', hotkey: null },
        ],
      },
      {
        id: 2,
        title: 'Dump sorting',
        enableHotkeys: false,
        entries: ['Currency', '"Divination Card"', 'Fossil', '"Map Tier"', '"Map Device" "Rarity: Normal"', 'Tane Laboratory'].map(
          (text, i) => ({ id: i + 1, name: '', text, hotkey: null }),
        ),
      },
    ];
    const [rolling, dump] = upgradeSettings({ configVersion: 2, stashSearch: v2 }).stashSearch;
    expect(rolling.entries).toEqual([
      { id: 1, name: '', text: '"Increased Pack Size"', hotkey: 'F2' },
      { id: 2, name: '', text: '"Additional Packs"', hotkey: null },
      { id: 3, name: 'mine', text: '"Monster Damage"', hotkey: null },
      { id: 4, name: '', text: '"Less Recovery Rate"', hotkey: null },
    ]);
    expect(dump).toEqual({ ...DEFAULT_STASH_SEARCH[1], enableHotkeys: false });
    expect(defaultSettings().stashSearch).toEqual(DEFAULT_STASH_SEARCH);
    expect(upgradeSettings({ configVersion: 3, stashSearch: v2 }).stashSearch).toEqual(v2);
  });

  it('reads the copy key from the game config unless the settings choose one', () => {
    expect(SETTINGS_VERSION).toBe(4);
    expect(defaultSettings().copyKey).toBeNull();
    // Version 3 files from before the field get the default without a new version.
    expect(upgradeSettings({ configVersion: 3, gameTitle: 'Path of Exile 2' }).copyKey).toBeNull();
    for (const key of ['Alt', 'Shift', 'Ctrl'] as const) expect(upgradeSettings({ configVersion: 3, copyKey: key }).copyKey).toBe(key);
    for (const key of ['alt', 'Z', 18, true, {}]) expect(upgradeSettings({ configVersion: 3, copyKey: key }).copyKey).toBeNull();
  });

  it('sends the host its part of the settings, with the copy key', async () => {
    const settings = {
      ...defaultSettings(),
      gameTitle: 'Path of Exile 2',
      popupPosition: 'opposite-cursor' as const,
      copyKey: 'Shift' as const,
      commands: [
        { text: '/hideout', hotkey: 'F5', send: true },
        { text: '  ', hotkey: 'F6', send: true },
      ],
      stashSearch: [
        {
          id: 1,
          title: 'On',
          enableHotkeys: true,
          entries: [
            { id: 1, name: '', text: 'Jewel', hotkey: 'F2' },
            { id: 2, name: '', text: 'Rune', hotkey: null },
            { id: 3, name: '', text: ' ', hotkey: 'F3' },
          ],
        },
        { id: 2, title: 'Off', enableHotkeys: false, entries: [{ id: 1, name: '', text: 'Gem', hotkey: 'F4' }] },
      ],
    };
    const config = hostConfig(settings);
    expect(config).toEqual({
      gameTitle: 'Path of Exile 2',
      hotkeys: DEFAULT_HOTKEYS,
      commands: [{ text: '/hideout', hotkey: 'F5', send: true }],
      stashPresets: [{ hotkey: 'F2', text: 'Jewel' }],
      popupPosition: 'opposite-cursor',
      copyKey: 'Shift',
    });
    await host.setHostConfig(config);
    expect(invoke).toHaveBeenLastCalledWith('set_host_config', config);
    // Null asks the host to read the game config.
    await host.setHostConfig(hostConfig(defaultSettings()));
    expect(invoke).toHaveBeenLastCalledWith('set_host_config', expect.objectContaining({ copyKey: null, popupPosition: 'center' }));
  });

  it('fills missing nested fields and survives a damaged file', () => {
    const settings = upgradeSettings({ configVersion: 1, hotkeys: { wiki: 'Alt+KeyW' }, priceCheck: { searchStatRange: 5 } });
    expect(settings.hotkeys).toEqual({ ...DEFAULT_HOTKEYS, wiki: 'Alt+KeyW' });
    expect(settings.priceCheck).toEqual({ ...defaultSettings().priceCheck, searchStatRange: 5 });
    expect(upgradeSettings('not json')).toEqual(defaultSettings());
    expect(upgradeSettings(null)).toEqual(defaultSettings());
  });

  it('drops hotkeys the host cannot read, which would make it refuse all of them', () => {
    const settings = upgradeSettings({
      configVersion: SETTINGS_VERSION,
      hotkeys: { 'price-check': 'Ctrl+KeyE', 'item-check': 5, wiki: null, overlay: 'Shift+Space', poedb: { key: 'P' } },
      commands: [{ text: '/hideout', hotkey: 'F5', send: true }, { hotkey: 'F6' }, null, { text: '/exit', hotkey: 9, send: true }],
      stashSearch: [null, { id: 1, title: 'Maps', enableHotkeys: true, entries: [{ id: 1, name: '', text: 'pack', hotkey: 'Alt+Digit1' }, { id: 2, hotkey: 'Alt+Digit2' }] }],
    });
    expect(settings.hotkeys).toEqual({ ...DEFAULT_HOTKEYS, 'price-check': 'Ctrl+KeyE', wiki: null });
    expect(settings.commands).toEqual([{ text: '/hideout', hotkey: 'F5', send: true }]);
    expect(settings.stashSearch).toEqual([{ id: 1, title: 'Maps', enableHotkeys: true, entries: [{ id: 1, name: '', text: 'pack', hotkey: 'Alt+Digit1' }] }]);
    // What the host gets deserialises: every action known, every hotkey a text or null.
    const config = hostConfig(settings);
    expect(Object.keys(config.hotkeys).sort()).toEqual(Object.keys(DEFAULT_HOTKEYS).sort());
    expect(config.stashPresets).toEqual([{ hotkey: 'Alt+Digit1', text: 'pack' }]);
  });

  it('falls back to defaults for languages and a listing type the app does not have', () => {
    const settings = upgradeSettings({ configVersion: SETTINGS_VERSION, language: 'de', uiLanguage: 'fr', priceCheck: { listingType: 'instant' } });
    expect([settings.language, settings.uiLanguage, settings.priceCheck.listingType]).toEqual(['en', 'en', defaultSettings().priceCheck.listingType]);
    expect(upgradeSettings({ language: 'ru', uiLanguage: 'uk' })).toMatchObject({ language: 'ru', uiLanguage: 'uk' });
  });

  it('takes the settings of Price of Exile (PoE1) copied over', () => {
    // A PoE1 settings.json of 0.1.13: version 1, merchantOnly, a PoE1 league, theme and autoUpdate.
    const poe1 = {
      configVersion: 1,
      leagueId: 'Mercenaries',
      language: 'ru',
      uiLanguage: 'uk',
      useIntlSite: false,
      accountName: 'me#1234',
      gameTitle: 'Path of Exile',
      startMessage: true,
      autoUpdate: true,
      popupPosition: 'opposite-cursor',
      theme: 'apt',
      hotkeys: { ...DEFAULT_HOTKEYS, wiki: 'Alt+KeyW' },
      commands: [{ text: '/hideout', hotkey: 'F5', send: true }],
      stashSearch: structuredClone(DEFAULT_STASH_SEARCH),
      priceCheck: { searchStatRange: 10, merchantOnly: false, collapseListings: 'app', activateStockFilter: false, defaultCurrency: null, smartInitialSearch: true, builtinBrowser: false },
      mapCheck: { ...DEFAULT_MAP_CHECK, selectedStats: [] },
    };
    const settings = upgradeSettings(poe1);
    expect(settings).toMatchObject({ configVersion: SETTINGS_VERSION, language: 'ru', uiLanguage: 'uk', popupPosition: 'opposite-cursor' });
    expect(settings.priceCheck.listingType).toBe('online');
    expect(settings.hotkeys.wiki).toBe('Alt+KeyW');
    // The PoE1 league goes once the trade2 league list arrives (leagues.test.ts: pickLeague).
    expect(settings.leagueId).toBe('Mercenaries');
    expect(settings.mapCheck.selectedStats.length).toBeGreaterThan(0);
  });
});

describe('hotkey recording', () => {
  it('records modifiers and the key code', () => {
    expect(recordHotkey(key('KeyD', { ctrl: true, shift: true }, 'D'))).toEqual({ hotkey: 'Ctrl+Shift+KeyD' });
    expect(recordHotkey(key('F5'))).toEqual({ hotkey: 'F5' });
    expect(recordHotkey(key('Digit1', { alt: true }, '1'))).toEqual({ hotkey: 'Alt+Digit1' });
  });

  it('waits for a key after a modifier, clears on Backspace, cancels on Esc', () => {
    expect(recordHotkey(key('ControlLeft', { ctrl: true }, 'Control'))).toBe('wait');
    expect(recordHotkey(key('IntlBackslash'))).toBe('wait');
    expect(recordHotkey(key('Backspace'))).toBe('clear');
    expect(recordHotkey(key('Escape'))).toBe('cancel');
  });

  it('shows hotkeys readably and finds the ones used twice', () => {
    expect(hotkeyLabel('Ctrl+Shift+KeyD')).toBe('Ctrl + Shift + D');
    expect(hotkeyLabel('Alt+Digit1')).toBe('Alt + 1');
    expect(hotkeyLabel('Numpad3')).toBe('Num 3');
    expect(hotkeyConflicts({ a: 'Ctrl+KeyD', b: 'Ctrl+KeyD', c: 'F5', d: null })).toEqual(new Set(['a', 'b']));
  });
});
