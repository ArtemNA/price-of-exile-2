import { describe, expect, it } from 'vitest';
import { DEFAULT_HOTKEYS, DEFAULT_MAP_CHECK, DEFAULT_STASH_SEARCH, SETTINGS_VERSION } from '../src/app/constants';
import { defaultSettings, upgradeSettings } from '../src/app/core/settings';
import { hotkeyConflicts, hotkeyLabel, recordHotkey } from '../src/app/settings/hotkey';

function key(code: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}, key = code) {
  return { code, key, ctrlKey: Boolean(mods.ctrl), altKey: Boolean(mods.alt), shiftKey: Boolean(mods.shift) };
}

describe('settings', () => {
  it('upgrades the localStorage format of stages 2–10', () => {
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
    expect(SETTINGS_VERSION).toBe(3);
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
    ]);
    // Version 3 keeps the marks as they are, removed defaults stay removed.
    const v3 = { ...mapCheck, selectedStats: [mine] };
    expect(upgradeSettings({ configVersion: 3, mapCheck: v3 }).mapCheck).toEqual(v3);
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

  it('fills missing nested fields and survives a damaged file', () => {
    const settings = upgradeSettings({ configVersion: 1, hotkeys: { wiki: 'Alt+KeyW' }, priceCheck: { searchStatRange: 5 } });
    expect(settings.hotkeys).toEqual({ ...DEFAULT_HOTKEYS, wiki: 'Alt+KeyW' });
    expect(settings.priceCheck).toEqual({ ...defaultSettings().priceCheck, searchStatRange: 5 });
    expect(upgradeSettings('not json')).toEqual(defaultSettings());
    expect(upgradeSettings(null)).toEqual(defaultSettings());
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
