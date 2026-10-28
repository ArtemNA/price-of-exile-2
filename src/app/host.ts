import { invoke } from '@tauri-apps/api/core';
import type { HotkeyAction, PopupPosition } from './constants';
import type { ChatCommand } from './core/settings';

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
  action: 'wiki' | 'poedb' | 'craft-of-exile' | 'stash-search';
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

export const host = {
  getStatus: () => invoke<Status>('get_status'),
  /** Game window title and hotkeys from the settings; returns a message per unusable hotkey. */
  setHostConfig: (
    gameTitle: string,
    hotkeys: Record<HotkeyAction, string | null>,
    commands: ChatCommand[],
    stashPresets: StashHotkey[],
    popupPosition: PopupPosition,
  ) => invoke<string[]>('set_host_config', { gameTitle, hotkeys, commands, stashPresets, popupPosition }),
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
