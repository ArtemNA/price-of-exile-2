import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { getName, getVersion } from '@tauri-apps/api/app';
import { appLogDir, join } from '@tauri-apps/api/path';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import { poeWebApi } from '@/web/Config';
import {
  APP_CONTACT,
  COPY_KEYS,
  CopyKey,
  DEFAULT_CURRENCY_OPTIONS,
  LISTING_TYPES,
  GAME_LANGS,
  HotkeyAction,
  Lang,
  POE_INTL_WEB_API,
  PopupPosition,
  releaseUrl,
  SEARCH_STAT_RANGE_MAX,
  STASH_SEARCH_MAX_LENGTH,
  UI_LANGS,
  UiLang,
} from '../constants';
import { TrErrorPipe, TrPipe } from '../core/i18n';
import { Leagues } from '../core/leagues';
import { type ChatCommand, isFirstStart, type PriceCheckSettings, settings, type StashSearchGroup, updateSettings } from '../core/settings';
import { updates } from '../core/updates';
import { CopyKeysSource, CopyKeysStatus, ForegroundEvent, host, hostConfig } from '../host';
import { MapModsEditor } from '../map-check/map-mods-editor';
import { hotkeyConflicts } from './hotkey';
import { HotkeyInput } from './hotkey-input';
import { THEMES, themeById } from '../themes';

interface LogLine {
  time: string;
  text: string;
}

const MAX_LOG_LINES = 200;

type Section = 'general' | 'overlay' | 'hotkeys' | 'chat' | 'stash-search' | 'price-check' | 'map-check' | 'log' | 'about';

// Labels and hints are English texts: the template translates them with `tr`.
const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'hotkeys', label: 'Hotkeys' },
  { id: 'chat', label: 'Chat' },
  { id: 'stash-search', label: 'Stash search' },
  { id: 'price-check', label: 'Price check' },
  { id: 'map-check', label: 'Map check' },
  { id: 'log', label: 'Log' },
  { id: 'about', label: 'About' },
];

const HOTKEYS: Array<{ action: HotkeyAction; label: string; hint: string }> = [
  { action: 'price-check', label: 'Price check', hint: 'Trade listings and poe.ninja price of the hovered item' },
  { action: 'item-check', label: 'Item check', hint: 'Links and details; on waystones and logbooks the map check' },
  { action: 'wiki', label: 'Open on wiki', hint: 'poe2wiki.net page of the item, without the popup' },
  { action: 'poedb', label: 'Open on PoEDB', hint: 'poe2db.tw page of the item, without the popup' },
  { action: 'craft-of-exile', label: 'Open in Craft of Exile', hint: 'The item in the crafting simulator' },
  { action: 'stash-search', label: 'Find in stash', hint: 'Types the item name into the stash search' },
  { action: 'stash-panel', label: 'Stash search presets', hint: 'Buttons with your stash searches, between the stash and the inventory' },
  { action: 'browser', label: 'Built-in browser', hint: 'Shows pathofexile.com; pressed again in the browser, back to the game' },
];

/** How the copy keys' source reads after the keys ("Ctrl + Alt + C — from the game's settings"). */
const COPY_KEYS_SOURCES: Record<CopyKeysSource, string> = {
  'game-config': "from the game's settings",
  default: "the game's default: its settings could not be read",
  settings: 'set here',
};

/** The main window: settings (APT `SettingsWindow.vue`) and the host log. Pushes the host's part of the settings. */
@Component({
  selector: 'app-settings-window',
  imports: [HotkeyInput, MapModsEditor, TrPipe, TrErrorPipe],
  templateUrl: './settings-window.html',
})
export class SettingsWindow {
  protected readonly sections = SECTIONS;
  protected readonly hotkeyRows = HOTKEYS;
  protected readonly currencies = DEFAULT_CURRENCY_OPTIONS;
  protected readonly listingTypes = LISTING_TYPES;
  protected readonly statRangeMax = SEARCH_STAT_RANGE_MAX;
  protected readonly positions: Array<{ value: PopupPosition; label: string }> = [
    { value: 'center', label: 'Centre of the game' },
    { value: 'opposite-cursor', label: 'Opposite the cursor' },
  ];
  protected readonly stashTextMax = STASH_SEARCH_MAX_LENGTH;
  protected readonly copyKeyOptions: Array<{ value: CopyKey | null; label: string }> = [
    { value: null, label: 'From the game' },
    ...COPY_KEYS.map((key) => ({ value: key, label: key })),
  ];
  protected readonly copyKeySources = COPY_KEYS_SOURCES;
  /** The keys the host copies items with and where they came from; null until the host answers. */
  protected readonly copyKeys = signal<CopyKeysStatus | null>(null);
  protected readonly uiLangs = UI_LANGS;
  protected readonly gameLangs = GAME_LANGS;
  protected readonly intlSite = POE_INTL_WEB_API;
  /** The trade site the price check uses with these settings. */
  protected readonly tradeSite = computed(() => (settings(), poeWebApi()));
  /** The chat placeholder for the last whisperer (an `@` cannot stand in template text). */
  protected readonly lastTarget = '@last';
  protected readonly section = signal<Section>('general');
  protected readonly settings = settings;
  protected readonly leagues = inject(Leagues);
  protected readonly gameActive = signal(false);
  /** The game ran in exclusive fullscreen at the last hotkey: the overlay cannot show over it. */
  protected readonly exclusiveFullscreen = signal(false);
  /** The title the host really looks for; differs from the setting when `POE_GAME_TITLE` is set (dev). */
  protected readonly hostGameTitle = signal<string | null>(null);
  protected readonly log = signal<LogLine[]>([]);
  /** Messages from the host about hotkeys it could not register. */
  protected readonly hotkeyErrors = signal<string[]>([]);
  /** Hotkey owners that share a key: action ids and `chat-<index>` for chat commands. */
  protected readonly conflicts = computed(() =>
    hotkeyConflicts({
      ...settings().hotkeys,
      ...Object.fromEntries(settings().commands.map((command, i) => [`chat-${i}`, command.hotkey])),
      ...Object.fromEntries(
        settings().stashSearch.flatMap((group) =>
          group.enableHotkeys ? group.entries.map((entry) => [`stash-${group.id}-${entry.id}`, entry.hotkey]) : [],
        ),
      ),
    }),
  );

  protected readonly updates = updates;
  protected readonly version = signal('');

  constructor() {
    // The window starts hidden (the app lives in the tray): show it once after installing.
    if (isFirstStart()) void getCurrentWindow().show().then(() => getCurrentWindow().setFocus());
    if (settings().startMessage) void host.showToast();
    void getVersion().then((version) => this.version.set(version));
    void updates.checkOnStart();
    void this.loadLeagues();
    host.getStatus().then((status) => this.gameActive.set(status.gameActive));

    // The host keeps no settings of its own: every change of the title or the hotkeys goes there.
    effect(() => this.pushHostConfig());

    const unlisteners = [
      listen<ForegroundEvent>('foreground', ({ payload }) => {
        this.gameActive.set(payload.isGame);
        this.append(`Foreground: "${payload.title}"${payload.isGame ? ' → game' : ''}`);
      }),
      listen<string>('log', ({ payload }) => this.append(payload)),
      listen<boolean>('exclusive-fullscreen', ({ payload }) => this.exclusiveFullscreen.set(payload)),
      // The settings window opened from the tray: the key may have been rebound in the game since.
      getCurrentWindow().onFocusChanged(({ payload: focused }) => {
        if (focused) this.refreshCopyKeys();
      }),
    ];
    inject(DestroyRef).onDestroy(() => unlisteners.forEach((p) => p.then((unlisten) => unlisten())));
  }

  private pushHostConfig(): void {
    host
      .setHostConfig(hostConfig(settings()))
      .then((errors) => {
        this.hotkeyErrors.set(errors);
        this.refreshCopyKeys();
        return host.getStatus();
      })
      .then(
        (status) => this.hostGameTitle.set(status.gameTitle),
        (e) => this.hotkeyErrors.set([String(e)]),
      );
  }

  /** Reads the copy keys again; when they changed, the hotkeys go to the host again to be checked against them. */
  private refreshCopyKeys(): void {
    host.getCopyKeys().then(
      (status) => {
        this.copyKeys.set(status);
        if (status.changed) this.pushHostConfig();
      },
      (e) => this.append(`Copy keys: ${e}`),
    );
  }

  /** "Ctrl+Alt+C" → "Ctrl + Alt + C", as the hotkeys show. */
  protected copyKeysLabel(keys: string): string {
    return keys.split('+').join(' + ');
  }

  protected setCopyKey(copyKey: CopyKey | null): void {
    updateSettings({ copyKey });
  }

  protected setGameTitle(title: string): void {
    const trimmed = title.trim();
    if (trimmed && trimmed !== settings().gameTitle) updateSettings({ gameTitle: trimmed });
  }

  protected setUiLanguage(uiLanguage: UiLang): void {
    updateSettings({ uiLanguage });
  }

  /** The language the game copies items in: its data and its trade site (ru.pathofexile.com). */
  protected setGameLanguage(language: Lang): void {
    updateSettings({ language });
  }

  /** The release page of `version`: what changed in it. */
  protected openRelease(version: string): void {
    void openUrl(releaseUrl(version));
  }

  protected openRepository(): void {
    void openUrl(APP_CONTACT);
  }

  protected setUseIntlSite(useIntlSite: boolean): void {
    updateSettings({ useIntlSite });
  }

  protected setAutoUpdate(autoUpdate: boolean): void {
    updateSettings({ autoUpdate });
  }

  protected setStartMessage(startMessage: boolean): void {
    updateSettings({ startMessage });
  }

  /** The themes built in; the choice shows only when there is more than ours. */
  protected readonly themes = THEMES;
  protected readonly currentTheme = computed(() => themeById(settings().theme).id);

  protected setTheme(theme: string): void {
    updateSettings({ theme });
  }

  protected setPopupPosition(popupPosition: PopupPosition): void {
    updateSettings({ popupPosition });
  }

  protected setAccountName(name: string): void {
    updateSettings({ accountName: name.trim() });
  }

  protected setHotkey(action: HotkeyAction, hotkey: string | null): void {
    updateSettings({ hotkeys: { ...settings().hotkeys, [action]: hotkey } });
  }

  protected updateCommand(index: number, patch: Partial<ChatCommand>): void {
    updateSettings({ commands: settings().commands.map((command, i) => (i === index ? { ...command, ...patch } : command)) });
  }

  protected addCommand(): void {
    updateSettings({ commands: [...settings().commands, { text: '', hotkey: null, send: true }] });
  }

  protected removeCommand(index: number): void {
    updateSettings({ commands: settings().commands.filter((_, i) => i !== index) });
  }

  protected updateGroup(groupId: number, patch: Partial<StashSearchGroup>): void {
    updateSettings({ stashSearch: settings().stashSearch.map((group) => (group.id === groupId ? { ...group, ...patch } : group)) });
  }

  protected updateEntry(groupId: number, entryId: number, patch: Partial<StashSearchGroup['entries'][number]>): void {
    const group = settings().stashSearch.find((g) => g.id === groupId)!;
    this.updateGroup(groupId, { entries: group.entries.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry)) });
  }

  protected addEntry(groupId: number): void {
    const group = settings().stashSearch.find((g) => g.id === groupId)!;
    const id = Math.max(0, ...group.entries.map((entry) => entry.id)) + 1;
    this.updateGroup(groupId, { entries: [...group.entries, { id, name: '', text: '', hotkey: null }] });
  }

  protected removeEntry(groupId: number, entryId: number): void {
    const group = settings().stashSearch.find((g) => g.id === groupId)!;
    this.updateGroup(groupId, { entries: group.entries.filter((entry) => entry.id !== entryId) });
  }

  protected addGroup(): void {
    const id = Math.max(0, ...settings().stashSearch.map((group) => group.id)) + 1;
    const group: StashSearchGroup = { id, title: '', enableHotkeys: true, entries: [{ id: 1, name: '', text: '', hotkey: null }] };
    updateSettings({ stashSearch: [...settings().stashSearch, group] });
  }

  protected removeGroup(groupId: number): void {
    updateSettings({ stashSearch: settings().stashSearch.filter((group) => group.id !== groupId) });
  }

  /** The log file of the host, in the app's log folder (tauri-plugin-log names it after the app). */
  protected async openLogFolder(): Promise<void> {
    await revealItemInDir(await join(await appLogDir(), `${await getName()}.log`));
  }

  protected openBrowser(): void {
    void host.browserOpen();
  }

  protected setPriceCheck(patch: Partial<PriceCheckSettings>): void {
    updateSettings({ priceCheck: { ...settings().priceCheck, ...patch } });
  }

  /** APT accepts 0–50 %; anything else keeps the old value. */
  protected setStatRange(text: string): void {
    const value = Number(text);
    if (Number.isInteger(value) && value >= 0 && value <= SEARCH_STAT_RANGE_MAX) this.setPriceCheck({ searchStatRange: value });
  }

  protected async loadLeagues(): Promise<void> {
    await this.leagues.load();
    const error = this.leagues.error();
    this.append(error ? `Leagues failed: ${error}` : `Leagues: ${this.leagues.list().map((l) => l.id).join(', ')}`);
  }

  private append(text: string): void {
    const time = new Date().toLocaleTimeString();
    this.log.update((lines) => [{ time, text }, ...lines].slice(0, MAX_LOG_LINES));
  }
}
