// Hotkey recording (APT `settings/HotkeyInput.vue`). Hotkeys are stored in the format
// `tauri-plugin-global-shortcut` parses: modifiers, then `KeyboardEvent.code` ("Ctrl+Shift+KeyD").

/** Keys the global shortcut parser knows, by `KeyboardEvent.code`. */
const KEY_CODE =
  /^(Key[A-Z]|Digit\d|F([1-9]|1\d|2[0-4])|Numpad(\d|Add|Subtract|Multiply|Divide|Decimal)|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|Space|Tab|Insert|Delete|Home|End|PageUp|PageDown|Arrow(Up|Down|Left|Right)|Pause)$/;

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'AltGraph']);

export type RecordResult = { hotkey: string } | 'clear' | 'cancel' | 'wait';

interface KeyLike {
  code: string;
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/** What a key press in the hotkey field means: Backspace clears, Esc cancels, a lone modifier waits for the key. */
export function recordHotkey(event: KeyLike): RecordResult {
  if (event.code === 'Backspace') return 'clear';
  if (event.code === 'Escape') return 'cancel';
  if (MODIFIER_KEYS.has(event.key) || !KEY_CODE.test(event.code)) return 'wait';
  const modifiers = [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift'].filter(Boolean);
  return { hotkey: [...modifiers, event.code].join('+') };
}

/** "Ctrl+Shift+KeyD" → "Ctrl + Shift + D", for display. */
export function hotkeyLabel(hotkey: string): string {
  return hotkey
    .split('+')
    .map((part) => part.replace(/^Key(?=[A-Z]$)/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ').replace(/^Arrow/, ''))
    .join(' + ');
}

/** Actions that share a hotkey, which the host cannot register twice. */
export function hotkeyConflicts(hotkeys: Record<string, string | null>): Set<string> {
  const byKey = new Map<string, string[]>();
  for (const [action, hotkey] of Object.entries(hotkeys)) {
    if (hotkey) byKey.set(hotkey, [...(byKey.get(hotkey) ?? []), action]);
  }
  return new Set([...byKey.values()].filter((actions) => actions.length > 1).flat());
}
