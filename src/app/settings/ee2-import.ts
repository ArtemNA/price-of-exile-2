// "Import from Exiled Exchange 2": stash search groups and map check marks from EE2's settings
// file (%APPDATA%\exiled-exchange-2\apt-data\config.json, read by the host), for users moving over.
// EE2 keeps the same shapes (we ported them): a stash search widget is a group, the item check
// widget's `maps` is our map check config. Only hotkeys differ: EE2 writes "Ctrl + Shift + D",
// we keep `tauri-plugin-global-shortcut` codes ("Ctrl+Shift+KeyD"). Price check hotkeys are not
// imported: EE2 has two modes there (hold, open until closed).

import type { MapCheckConfig } from '@/web/map-check/common';
import type { StashSearchGroup } from '../core/settings';
import { recordHotkey } from './hotkey';

type Json = Record<string, any>;

const MODIFIERS = new Set(['Ctrl', 'Alt', 'Shift']);
const MODIFIER_ALIASES: Record<string, string> = { Control: 'Ctrl' };

/** EE2's key names that are not `KeyboardEvent.code` already. */
const KEY_NAMES: Record<string, string> = {
  '`': 'Backquote',
  '-': 'Minus',
  '=': 'Equal',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '\\': 'Backslash',
  ';': 'Semicolon',
  "'": 'Quote',
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  Up: 'ArrowUp',
  Down: 'ArrowDown',
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
  Ins: 'Insert',
  Del: 'Delete',
  PgUp: 'PageUp',
  PgDn: 'PageDown',
};

/** "Ctrl + Shift + D" → "Ctrl+Shift+KeyD"; null when EE2 had none or a key we cannot register. */
export function ee2Hotkey(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parts = value.split(' + ').map((part) => part.trim());
  const key = parts.pop();
  if (!key) return null;
  const modifiers = parts.map((part) => MODIFIER_ALIASES[part] ?? part);
  if (modifiers.some((m) => !MODIFIERS.has(m))) return null;
  const code = /^[A-Z]$/i.test(key) ? `Key${key.toUpperCase()}` : /^\d$/.test(key) ? `Digit${key}` : (KEY_NAMES[key] ?? key);
  // recordHotkey knows which codes the global shortcut parser accepts.
  const result = recordHotkey({
    code,
    key: code,
    ctrlKey: modifiers.includes('Ctrl'),
    altKey: modifiers.includes('Alt'),
    shiftKey: modifiers.includes('Shift'),
  });
  return typeof result === 'object' ? result.hotkey : null;
}

/** Stash search groups of an EE2 config, in EE2's order; empty when there are none. */
export function ee2StashGroups(config: unknown): StashSearchGroup[] {
  const widgets = (config as Json)?.widgets;
  if (!Array.isArray(widgets)) return [];
  return widgets
    .filter((w: Json) => w?.wmType === 'stash-search' && Array.isArray(w.entries))
    .map((w: Json, groupIndex: number) => ({
      id: groupIndex + 1,
      title: typeof w.wmTitle === 'string' ? w.wmTitle : '',
      enableHotkeys: w.enableHotkeys !== false,
      entries: w.entries
        .filter((e: Json) => typeof e?.text === 'string')
        .map((e: Json, entryIndex: number) => ({
          id: entryIndex + 1,
          name: typeof e.name === 'string' ? e.name : '',
          text: e.text,
          hotkey: ee2Hotkey(e.hotkey),
        })),
    }));
}

/** The map check config of an EE2 config (its item check widget's `maps`), or null. */
export function ee2MapCheck(config: unknown): MapCheckConfig | null {
  const widgets = (config as Json)?.widgets;
  if (!Array.isArray(widgets)) return null;
  const maps = widgets.find((w: Json) => w?.wmType === 'item-check')?.maps;
  if (!maps || !Array.isArray(maps.selectedStats)) return null;
  return {
    profile: Number.isInteger(maps.profile) ? maps.profile : 1,
    showNewStats: Boolean(maps.showNewStats),
    selectedStats: maps.selectedStats
      .filter((s: Json) => typeof s?.matcher === 'string' && typeof s?.decision === 'string')
      .map((s: Json) => ({ matcher: s.matcher, decision: s.decision })),
  };
}

/** Parses EE2's settings file; null when it is missing or not JSON. */
export function parseEe2Config(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
