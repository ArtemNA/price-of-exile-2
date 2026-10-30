import { invoke } from '@tauri-apps/api/core';
import type { CopyKey, HotkeyAction, PopupPosition } from './constants';
import type { ChatCommand, Settings } from './core/settings';
import type { ItemAction } from './core/item-links';

/** A stash search preset with a hotkey, for the host. */
export interface StashHotkey {
  hotkey: string;
  text: string;
}

/**
 * Whether the popup currently holds the keyboard. Tracked here rather than read from
 * `document.hasFocus()`, which WebView2 keeps reporting as true after the window lost focus.
 */
let popupHasKeyboard = false;

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  width: number;
  height: number;
}

/** Which popup the host shows: a check of the hovered item or the stash search panel. */
export type CheckTarget = 'price-check' | 'item-check' | 'stash-search';

/** Payload of the `item-text` event, emitted to the popup after a price or item check hotkey. */
export interface ItemTextEvent {
  /** Which hotkey copied the item. */
  target: CheckTarget;
  text: string;
  cursor: Point;
  gameRect: Rect;
  elapsedMs: number;
}

/** Payload of the `item-action` event: a link or stash search hotkey, handled without showing the popup. */
export interface ItemActionEvent {
  action: ItemAction;
  text: string;
}

export interface ForegroundEvent {
  title: string;
  isGame: boolean;
}

export interface Status {
  gameTitle: string;
  gameActive: boolean;
}

/** What the host gets of the settings (`set_host_config`). */
export interface HostConfig {
  gameTitle: string;
  hotkeys: Record<HotkeyAction, string | null>;
  /** Chat commands with text. */
  commands: ChatCommand[];
  /** Stash search presets with a hotkey and text, of the groups whose hotkeys are on. */
  stashPresets: StashHotkey[];
  popupPosition: PopupPosition;
  /** The advanced descriptions key instead of the game config's; null = the game config. */
  copyKey: CopyKey | null;
}

/** The part of the settings the host needs: it keeps no settings of its own. */
export function hostConfig(settings: Settings): HostConfig {
  const { gameTitle, hotkeys, commands, stashSearch, popupPosition, copyKey } = settings;
  const stashPresets = stashSearch
    .filter((group) => group.enableHotkeys)
    .flatMap((group) => group.entries)
    .filter((entry) => entry.hotkey && entry.text.trim())
    .map((entry) => ({ hotkey: entry.hotkey!, text: entry.text }));
  return { gameTitle, hotkeys, commands: commands.filter((command) => command.text.trim()), stashPresets, popupPosition, copyKey };
}

/** Where the copy keys came from: the settings, the game config, or the default (config not read). */
export type CopyKeysSource = 'settings' | 'game-config' | 'default';

/** The keys the host presses to copy an item (`get_copy_keys`). */
export interface CopyKeysStatus {
  /** "Ctrl+Alt+C". */
  keys: string;
  source: CopyKeysSource;
  /** The game config file, or why it could not be read. */
  detail: string;
  /** They changed since the last read: send the hotkeys again, so the host refuses the new copy keys. */
  changed: boolean;
}

export const host = {
  getStatus: () => invoke<Status>('get_status'),
  /** Game window title, hotkeys and copy key from the settings; returns a message per unusable hotkey. */
  setHostConfig: (config: HostConfig) => invoke<string[]>('set_host_config', { ...config }),
  /** Reads the copy keys again (from the game config unless the settings set them). */
  getCopyKeys: () => invoke<CopyKeysStatus>('get_copy_keys'),
  hidePopup: () => invoke<void>('hide_popup'),
  /** The popup takes the keyboard (for typing into a field); false if Windows refused. */
  popupFocusInput: async () => (popupHasKeyboard = await invoke<boolean>('popup_focus_input')),
  /** Keyboard back to the game; no-op when the popup does not have it. */
  popupReleaseFocus: async () => {
    if (!popupHasKeyboard) return;
    popupHasKeyboard = false;
    await invoke<void>('popup_release_focus');
  },
  /** Hides the popup and types `text` into the game's stash search (Ctrl+F, paste, Enter). */
  stashSearch: (text: string) => invoke<void>('stash_search', { text }),
  /** Resizes the shown popup to its content (logical pixels), keeping its side and anchor. */
  fitPopup: (width: number, height: number) => invoke<void>('fit_popup', { width, height }),
  /** The start message in the screen corner, for a few seconds. */
  showToast: () => invoke<void>('show_toast'),
  openSettings: () => invoke<void>('open_settings'),
  /** The trade site of the game language: the built-in browser opens and makes requests there. */
  setTradeHost: (host: string) => invoke<void>('set_trade_host', { host }),
  /** Tray menu labels in the interface language. */
  setTrayLabels: (labels: { settings: string; browser: string; quit: string }) => invoke<void>('set_tray_labels', { labels }),
  /** The bare exe without the installer: no self-update. */
  isPortable: () => invoke<boolean>('is_portable'),
  /** Shows the built-in browser (pathofexile.com), on `url` if given. */
  browserOpen: (url?: string) => invoke<void>('browser_open', { url: url ?? null }),
  /** The host took the keyboard back (popup hidden, game clicked). */
  popupLostKeyboard: () => (popupHasKeyboard = false),
};
