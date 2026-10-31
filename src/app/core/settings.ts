import { signal } from '@angular/core';
import type { MapCheckConfig } from '@/web/map-check/common';
import {
  COPY_KEYS,
  CopyKey,
  DEFAULT_CHAT_COMMANDS,
  DEFAULT_GAME_TITLE,
  DEFAULT_HOTKEYS,
  DEFAULT_LANG,
  DEFAULT_UI_LANG,
  DEFAULT_MAP_CHECK,
  DEFAULT_MAP_MARKS,
  DEFAULT_POPUP_POSITION,
  DEFAULT_STASH_SEARCH,
  GAME_LANGS,
  HOTKEY_ACTIONS,
  HotkeyAction,
  Lang,
  LISTING_TYPES,
  ListingType,
  UI_LANGS,
  UiLang,
  PopupPosition,
  POE1_MAP_CHECK_MATCHERS,
  POE1_STASH_SEARCH_TEXTS,
  PRICE_CHECK_DEFAULTS,
  SETTINGS_CHANGED_EVENT,
  SETTINGS_FILE,
  SETTINGS_STORE_KEY,
  SETTINGS_VERSION,
  MAIN_WINDOW_LABEL,
} from '../constants';

/** Price check options the user can change (APT `PriceCheckWidget`, the subset ported so far). */
export interface PriceCheckSettings {
  searchStatRange: number;
  /** Listings a search starts with (EE2 `listingType`); the price check can change it per search. */
  listingType: ListingType;
  collapseListings: 'api' | 'app';
  activateStockFilter: boolean;
  defaultCurrency: string | null;
  smartInitialSearch: boolean;
  builtinBrowser: boolean;
}

/** A chat command (APT `Config.commands`): `text` is typed into the chat, `send` presses Enter. */
export interface ChatCommand {
  text: string;
  hotkey: string | null;
  send: boolean;
}

/** A group of stash search presets (APT `StashSearchWidget`). */
export interface StashSearchGroup {
  id: number;
  title: string;
  /** The entries' hotkeys work only while this is on (APT `enableHotkeys`). */
  enableHotkeys: boolean;
  entries: Array<{ id: number; name: string; text: string; hotkey: string | null }>;
}

export interface Settings {
  configVersion: number;
  leagueId?: string;
  language: Lang;
  /** Language of the overlay's own texts (menus, buttons, hints); the game data stays `language`. */
  uiLanguage: UiLang;
  /** Use the international (English) trade site regardless of game language. */
  useIntlSite: boolean;
  /** PoE account name: own listings are marked in results. */
  accountName: string;
  /** Exact title of the game window. */
  gameTitle: string;
  /** A short message in the corner when the overlay starts (APT `showAttachNotification`). */
  startMessage: boolean;
  /** Install a new version when the overlay starts (never in the middle of a session). */
  autoUpdate: boolean;
  popupPosition: PopupPosition;
  /** The app's look: ours or an addon theme built in (src/app/themes.ts); '' = the build's default. */
  theme: string;
  hotkeys: Record<HotkeyAction, string | null>;
  /**
   * The game's "show advanced item descriptions" key, for players whose game config the overlay
   * cannot read; null = read it from the game config.
   */
  copyKey: CopyKey | null;
  commands: ChatCommand[];
  stashSearch: StashSearchGroup[];
  priceCheck: PriceCheckSettings;
  /** Map check profile and marked map mods (APT `ItemCheckWidget.maps`). */
  mapCheck: MapCheckConfig;
}

export function defaultSettings(): Settings {
  const {
    searchStatRange,
    listingType,
    collapseListings,
    activateStockFilter,
    defaultCurrency,
    smartInitialSearch,
    builtinBrowser,
  } = PRICE_CHECK_DEFAULTS;
  return {
    configVersion: SETTINGS_VERSION,
    language: DEFAULT_LANG,
    uiLanguage: DEFAULT_UI_LANG,
    useIntlSite: false,
    accountName: '',
    gameTitle: DEFAULT_GAME_TITLE,
    startMessage: true,
    autoUpdate: true,
    popupPosition: DEFAULT_POPUP_POSITION,
    theme: '',
    hotkeys: { ...DEFAULT_HOTKEYS },
    copyKey: null,
    commands: DEFAULT_CHAT_COMMANDS.map((command) => ({ ...command })),
    stashSearch: structuredClone(DEFAULT_STASH_SEARCH),
    priceCheck: {
      searchStatRange,
      listingType,
      collapseListings,
      activateStockFilter,
      defaultCurrency,
      smartInitialSearch,
      builtinBrowser,
    },
    mapCheck: DEFAULT_MAP_CHECK,
  };
}

/**
 * Brings stored settings of any older version up to `SETTINGS_VERSION` (APT `upgradeConfig`).
 * Versions 1 and 2 are the formats of the first development builds.
 * Version 1 had APT's "instant buyout only" switch (`merchantOnly`) instead of EE2's four listing
 * types: on means instant buyout, off meant online sellers.
 * Version 2 had the PoE1 map marks and stash search presets: version 3 has PoE2 ones (`upgradeMapCheck`,
 * `upgradeStashSearch`). Version 3 had the default map marks of the English game only.
 * Fields added later (`copyKey`, `theme`) get their defaults without a new version. Unknown or missing
 * fields fall back to the defaults, so a damaged file still loads; so do values the app cannot use
 * (a game language without data, a listing type the trade site does not know, a hotkey that is
 * not text, which would make the host refuse every hotkey).
 */
export function upgradeSettings(raw: unknown): Settings {
  const defaults = defaultSettings();
  if (!raw || typeof raw !== 'object') return defaults;
  const stored = raw as Partial<Settings>;
  const { merchantOnly, ...priceCheck } = (stored.priceCheck ?? {}) as Partial<PriceCheckSettings> & { merchantOnly?: boolean };
  if (!LISTING_TYPES.some((type) => type.value === priceCheck.listingType)) delete priceCheck.listingType;
  if (priceCheck.listingType == null && typeof merchantOnly === 'boolean') {
    priceCheck.listingType = merchantOnly ? 'securable' : 'online';
  }
  const version = stored.configVersion ?? 0;
  const poe1 = version < 3;
  const stashSearch = Array.isArray(stored.stashSearch) ? stored.stashSearch : defaults.stashSearch;
  const mapCheck = { ...defaults.mapCheck, ...stored.mapCheck };
  return {
    ...defaults,
    ...stored,
    configVersion: SETTINGS_VERSION,
    language: GAME_LANGS.some((lang) => lang.id === stored.language) ? stored.language! : defaults.language,
    uiLanguage: UI_LANGS.some((lang) => lang.id === stored.uiLanguage) ? stored.uiLanguage! : defaults.uiLanguage,
    hotkeys: upgradeHotkeys(stored.hotkeys, defaults.hotkeys),
    copyKey: COPY_KEYS.includes(stored.copyKey as CopyKey) ? (stored.copyKey as CopyKey) : null,
    // A theme id this build does not have stays (another build may have it); themeById falls back.
    theme: typeof stored.theme === 'string' ? stored.theme : defaults.theme,
    autoUpdate: typeof stored.autoUpdate === 'boolean' ? stored.autoUpdate : defaults.autoUpdate,
    commands: Array.isArray(stored.commands) ? stored.commands.filter(isChatCommand) : defaults.commands,
    stashSearch: poe1 ? upgradeStashSearch(withValidEntries(stashSearch)) : withValidEntries(stashSearch),
    priceCheck: { ...defaults.priceCheck, ...priceCheck },
    mapCheck: poe1 ? upgradeMapCheck(mapCheck) : version < 4 ? withDefaultMarks(mapCheck, DEFAULT_MAP_MARKS.ru) : mapCheck,
  };
}

/**
 * The host takes the hotkeys only all together (one value it cannot read refuses them all): known
 * actions with a text or null; a missing or unreadable one gets its default.
 */
function upgradeHotkeys(stored: unknown, defaults: Record<HotkeyAction, string | null>): Record<HotkeyAction, string | null> {
  const hotkeys = { ...defaults };
  if (!stored || typeof stored !== 'object') return hotkeys;
  for (const action of HOTKEY_ACTIONS) {
    const value = (stored as Record<string, unknown>)[action];
    if (typeof value === 'string' || value === null) hotkeys[action] = value;
  }
  return hotkeys;
}

const isHotkey = (value: unknown): value is string | null | undefined => value == null || typeof value === 'string';

function isChatCommand(command: unknown): command is ChatCommand {
  const c = command as Partial<ChatCommand> | null;
  return typeof c?.text === 'string' && typeof c.send === 'boolean' && isHotkey(c.hotkey);
}

/** Stash search groups and presets the settings page and the host can read; damaged ones are dropped. */
function withValidEntries(groups: StashSearchGroup[]): StashSearchGroup[] {
  return groups
    .filter((group) => group && typeof group === 'object' && Array.isArray(group.entries))
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => typeof entry?.text === 'string' && isHotkey(entry.hotkey)),
    }));
}

/**
 * PoE1 map marks of version 2: a mark moves to the PoE2 mod that replaces it or is dropped, and
 * the PoE2 default marks are added where the mod has no entry yet. The user's other marks stay.
 */
function upgradeMapCheck(config: MapCheckConfig): MapCheckConfig {
  const stats = Array.isArray(config.selectedStats) ? config.selectedStats : [];
  const selectedStats = stats.flatMap((entry) => {
    if (!Object.hasOwn(POE1_MAP_CHECK_MATCHERS, entry.matcher)) return [entry];
    const matcher = POE1_MAP_CHECK_MATCHERS[entry.matcher];
    return matcher && !stats.some((other) => other.matcher === matcher) ? [{ ...entry, matcher }] : [];
  });
  return withDefaultMarks({ ...config, selectedStats }, DEFAULT_MAP_CHECK.selectedStats);
}

/** Adds the default `marks` whose mod has no entry yet. */
function withDefaultMarks(config: MapCheckConfig, marks: ReadonlyArray<{ matcher: string; decision: string }>): MapCheckConfig {
  const selectedStats = Array.isArray(config.selectedStats) ? [...config.selectedStats] : [];
  for (const entry of marks) {
    if (!selectedStats.some((other) => other.matcher === entry.matcher)) selectedStats.push({ ...entry });
  }
  return { ...config, selectedStats };
}

/** PoE1 stash search presets of version 2 become the PoE2 ones; edited presets and groups stay. */
function upgradeStashSearch(groups: StashSearchGroup[]): StashSearchGroup[] {
  return groups.map((group) => ({
    ...group,
    entries: (group.entries ?? []).map((entry) =>
      Object.hasOwn(POE1_STASH_SEARCH_TEXTS, entry.text) ? { ...entry, text: POE1_STASH_SEARCH_TEXTS[entry.text] } : entry,
    ),
  }));
}

const state = signal<Settings>(defaultSettings());

/** Current settings; plain module state so ported APT code can read it outside Angular DI. */
export const settings = state.asReadonly();

interface Persistence {
  save(value: Settings): Promise<void>;
  broadcast(value: Settings): Promise<void>;
}
let persistence: Persistence | null = null;
let firstStart = false;

/** No settings file was there: the app was just installed. */
export function isFirstStart(): boolean {
  return firstStart;
}

/**
 * Loads the settings before the app starts (call once per window). Without Tauri (unit tests)
 * the defaults stay and nothing is saved.
 */
export async function initSettings(): Promise<void> {
  const { load } = await import('@tauri-apps/plugin-store');
  const { emit, listen } = await import('@tauri-apps/api/event');
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const store = await load(SETTINGS_FILE, { defaults: {}, autoSave: false });
  const stored = await store.get<unknown>(SETTINGS_STORE_KEY);
  firstStart = stored === undefined;
  const settings = upgradeSettings(stored);
  state.set(settings);

  const label = getCurrentWindow().label;
  persistence = {
    async save(value) {
      await store.set(SETTINGS_STORE_KEY, value);
      await store.save();
    },
    broadcast: (value) => emit(SETTINGS_CHANGED_EVENT, { from: label, settings: value }),
  };
  // Both windows load the same file; the one that changes a setting tells the other.
  await listen<{ from: string; settings: Settings }>(SETTINGS_CHANGED_EVENT, ({ payload }) => {
    if (payload.from !== label) state.set(payload.settings);
  });
  // Only the settings window writes the first file: if the popup did, the settings window
  // (loading a moment later) would no longer see a first start.
  const outdated = stored === undefined || (stored as Partial<Settings>).configVersion !== SETTINGS_VERSION;
  if (outdated && label === MAIN_WINDOW_LABEL) {
    await persistence.save(settings);
  }
}

export function updateSettings(patch: Partial<Settings>): void {
  state.update((current) => ({ ...current, ...patch }));
  const value = state();
  void persistence?.save(value).catch((e) => console.error('Saving settings failed', e));
  void persistence?.broadcast(value);
}
