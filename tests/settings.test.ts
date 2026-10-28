import { describe, expect, it } from 'vitest';
import { DEFAULT_HOTKEYS, DEFAULT_MAP_CHECK, SETTINGS_VERSION } from '../src/app/constants';
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
