/**
 * Static, tunable values of the app in one place. Rust counterparts: src-tauri/src/constants.rs.
 * Which hosts the app may call at all is the HTTP allowlist in src-tauri/capabilities/default.json.
 * Ported EE2 code (src/lib/ee2) keeps its own constants, identical to upstream.
 */

import tauriConfig from '../../src-tauri/tauri.conf.json';

/** Identifies the app to GGG and other APIs (name, version, contact, as GGG asks of third-party tools). */
export const APP_NAME = 'PriceOfExile2';
/** The released version, read from tauri.conf.json at build time, so it cannot fall behind. */
export const APP_VERSION: string = tauriConfig.version;
export const APP_CONTACT = 'https://github.com/ArtemNA/price-of-exile-2';
export const USER_AGENT = `${APP_NAME}/${APP_VERSION} (+${APP_CONTACT})`;

/**
 * Game data language: the language the game copies items in (public/data/<id>, from EE2) and the
 * trade site that goes with it. Apart from the interface language below.
 */
export type Lang = 'en' | 'ru';
export const DEFAULT_LANG: Lang = 'en';
/** `itemClass`: first line of an item the game copies in that language (as in client_strings.js). */
export const GAME_LANGS: ReadonlyArray<{ id: Lang; label: string; itemClass: string }> = [
  { id: 'en', label: 'English', itemClass: 'Item Class: ' },
  { id: 'ru', label: 'Русский', itemClass: 'Класс предмета: ' },
];

/**
 * Interface language, apart from the game data language above: only the overlay's own texts
 * change. English is the source text; the others come from public/i18n/<id>.json.
 */
export type UiLang = 'en' | 'uk' | 'ru';
export const DEFAULT_UI_LANG: UiLang = 'en';
export const UI_LANGS: ReadonlyArray<{ id: UiLang; label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'uk', label: 'Українська' },
  { id: 'ru', label: 'Русский' },
];
/** Interface translations folder, relative to the app base URL. */
export const UI_I18N_PATH = 'i18n';

/** Game data folder, relative to the app base URL. */
export const DATA_PATH = 'data';

/** Official site per game language (APT `poeWebApi`). Also used when "force English site" is on. */
export const POE_WEB_API: Record<Lang, string> = {
  en: 'www.pathofexile.com',
  ru: 'ru.pathofexile.com',
};
export const POE_INTL_WEB_API = 'www.pathofexile.com';

/**
 * The trade site's own item and stat lists (EE2 `TradeData.ts`): the parser falls back to them for
 * bases and mods missing from the game data. Always English, as the parser matches ref names.
 */
export const TRADE_DATA_ITEMS_URL = 'https://www.pathofexile.com/api/trade2/data/items';
export const TRADE_DATA_STATS_URL = 'https://www.pathofexile.com/api/trade2/data/stats';
/** Reload them at most this often, and only if an item was checked within the interest span. */
export const TRADE_DATA_UPDATE_INTERVAL = 2 * 60 * 60 * 1000;
export const TRADE_DATA_INTEREST_SPAN = 60 * 60 * 1000;
/** How often to see whether a reload is due. */
export const TRADE_DATA_RETRY_INTERVAL = 30 * 60 * 1000;

/** Seconds added to every server rate-limit window to absorb latency (APT default `apiLatencySeconds`). */
export const API_LATENCY_SECONDS = 2;

/** Permanent leagues (EE2 `Leagues.ts`); Hardcore is not offered. Names on pc-ggg and pc-garena. */
export const PERMANENT_SC_LEAGUES = ['Standard', '標準模式'];
export const PERMANENT_HC_LEAGUES = ['Hardcore', '專家模式'];
/** The Hardcore twin of a PoE2 challenge league is "HC <name>" ("HC Forbidden Rites"). */
export const HC_LEAGUE_PREFIX = 'HC ';

/** Price check defaults (APT price-check widget `initInstance`). */
export const PRICE_CHECK_DEFAULTS = {
  /** ±% around each roll used for min/max of stat filters. */
  searchStatRange: 10,
  /** Only listings with instant buyout (merchant tabs). */
  merchantOnly: true,
  /** Group same-seller listings by the trade API ('api') or by the app ('app'). */
  collapseListings: 'api' as 'api' | 'app',
  activateStockFilter: false,
  /** Buyout currency filter: null = any. */
  defaultCurrency: null as string | null,
  /** Search immediately when the hotkey is pressed, for items where filters rarely need edits. */
  smartInitialSearch: true,
  /** Trade requests through the built-in browser's page, with its login and Cloudflare clearance (APT `builtinBrowser`). */
  builtinBrowser: false,
  showSeller: false as false | 'account' | 'ign',
};

/** pathofexile.com hosts: rate limits, Cloudflare checks and the built-in browser apply to them (F-45, F-60). */
export const POE_OFFICIAL_HOSTS: readonly string[] = ['www.pathofexile.com', 'ru.pathofexile.com'];
/** Error text when pathofexile.com answers with a Cloudflare check instead of data; the UI offers the browser. */
export const CLOUDFLARE_CHECK_ERROR = 'pathofexile.com asks to confirm you are human (Cloudflare)';

/** Id and label of the price check preset with every mod on its own (no pseudo totals). */
export const MODS_PRESET_ID = 'mods';
export const MODS_PRESET_LABEL = 'Mods';

/** Price check window (logical px): its height follows the filters, between these two. */
export const PRICE_CHECK_WIDTH = 960;
export const PRICE_CHECK_MIN_HEIGHT = 590;
export const PRICE_CHECK_MAX_HEIGHT = 900;

/** Price check stat filter headings in display order, and which filter tags go under each (F-54). */
export const STAT_GROUPS: ReadonlyArray<{ name: string; tags: readonly string[] }> = [
  { name: 'Properties', tags: ['property'] },
  { name: 'Totals', tags: ['pseudo'] },
  { name: 'Enchant', tags: ['enchant'] },
  { name: 'Implicit', tags: ['implicit', 'scourge', 'synthesised', 'foulborn', 'vestigial', 'corrupted'] },
  { name: 'Eldritch implicits', tags: ['eldritch'] },
  {
    name: 'Explicit',
    tags: ['explicit', 'fractured', 'veiled', 'explicit-shaper', 'explicit-elder', 'explicit-crusader', 'explicit-hunter', 'explicit-redeemer', 'explicit-warlord', 'explicit-delve', 'explicit-incursion'],
  },
  { name: 'Crafted', tags: ['crafted'] },
];
export const STAT_GROUP_OTHER = 'Other';

/** Short labels of the item filter chips in the price check header. */
export const ITEM_CHIP_SHORT_LABELS: Record<string, string> = {
  itemLevel: 'iLvl',
  gemLevel: 'Gem level',
  mapTier: 'Tier',
  areaLevel: 'Area level',
  stackSize: 'Stack',
};

/** The leagues list is loaded again on a check when it is older than this (ms). */
export const LEAGUES_REFRESH_AFTER = 3 * 60 * 60 * 1000;

/** Upper limit of the stat filter range setting, % (APT `settings-price-check.vue`). */
export const SEARCH_STAT_RANGE_MAX = 50;
/** Buyout currency filter choices in the settings; values are trade API price options. */
export const DEFAULT_CURRENCY_OPTIONS: Array<{ value: string | null; label: string }> = [
  { value: null, label: 'Any currency' },
  { value: 'chaos', label: 'Chaos Orb' },
  { value: 'divine', label: 'Divine Orb' },
];

/** Trade listings (APT `TradeListing.vue`). */
export const TRADE_LISTING = {
  /** Rows shown in the popup. */
  showResults: 20,
  /** Ids per /api/trade/fetch request (API maximum is 10). */
  fetchChunk: 10,
  /** Never fetch beyond this many results of one search. */
  apiFetchLimit: 100,
  /** Keep fetching while there are fewer distinct sellers than this… */
  minNotGrouped: 7,
  /** …or fewer rows after grouping than this. */
  minGrouped: 10,
};

/**
 * stage 4: shown on the poe.ninja tab instead of loading prices, until the PoE2 poe.ninja adapter
 * replaces the PoE1 API below (it has no PoE2 leagues). null loads them.
 */
export const NINJA_PENDING_MESSAGE: string | null = 'prices for Path of Exile 2 are not connected yet';
/** poe.ninja currency and item prices (APT `Prices.ts` endpoint), host + path without scheme. */
export const POE_NINJA_OVERVIEWS = 'poe.ninja/poe1/api/economy/current/dense/overviews';
/** Re-fetch poe.ninja prices this often while the app runs. */
export const POE_NINJA_REFRESH_MS = 10 * 60 * 1000;
/**
 * poe.ninja item overview types priced by name for bulk exchange (stackable, one price per name).
 * Uniques, gems, bases and maps are left out: one name has many variants there.
 */
export const POE_NINJA_BULK_TYPES = [
  'Essence', 'Fossil', 'Resonator', 'Scarab', 'Oil', 'Vial', 'DeliriumOrb', 'Invitation', 'Fragment',
  'DivinationCard', 'Omen', 'Tattoo', 'AllflameEmber', 'Runegraft', 'Wombgift', 'Artifact',
];

/** poe.ninja item pages: `${POE_NINJA_SITE}/${league slug}/${overview url}/${details id}`. */
export const POE_NINJA_SITE = 'https://poe.ninja/poe1/economy';

/**
 * poe.ninja overview types APT prices items from (`Prices.ts` NAMESPACE_MAP): game data
 * namespace, site URL segment, overview type. Earlier entries win for the same name.
 */
export const POE_NINJA_NAMESPACES: ReadonlyArray<{ ns: string; url: string; type: string }> = [
  { ns: 'ITEM', url: 'currency', type: 'Currency' },
  { ns: 'ITEM', url: 'fragments', type: 'Fragment' },
  { ns: 'ITEM', url: 'delirium-orbs', type: 'DeliriumOrb' },
  { ns: 'ITEM', url: 'scarabs', type: 'Scarab' },
  { ns: 'ITEM', url: 'artifacts', type: 'Artifact' },
  { ns: 'ITEM', url: 'base-types', type: 'BaseType' },
  { ns: 'ITEM', url: 'fossils', type: 'Fossil' },
  { ns: 'ITEM', url: 'resonators', type: 'Resonator' },
  { ns: 'ITEM', url: 'incubators', type: 'Incubator' },
  { ns: 'ITEM', url: 'oils', type: 'Oil' },
  { ns: 'ITEM', url: 'vials', type: 'Vial' },
  { ns: 'ITEM', url: 'invitations', type: 'Invitation' },
  { ns: 'ITEM', url: 'blighted-maps', type: 'BlightedMap' },
  { ns: 'ITEM', url: 'blight-ravaged-maps', type: 'BlightRavagedMap' },
  { ns: 'ITEM', url: 'essences', type: 'Essence' },
  { ns: 'ITEM', url: 'maps', type: 'Map' },
  { ns: 'ITEM', url: 'tattoos', type: 'Tattoo' },
  { ns: 'ITEM', url: 'omens', type: 'Omen' },
  { ns: 'ITEM', url: 'coffins', type: 'Coffin' },
  { ns: 'ITEM', url: 'allflame-embers', type: 'AllflameEmber' },
  { ns: 'ITEM', url: 'djinn-coins', type: 'DjinnCoin' },
  { ns: 'ITEM', url: 'astrolabes', type: 'Astrolabe' },
  { ns: 'ITEM', url: 'runegrafts', type: 'Runegraft' },
  { ns: 'ITEM', url: 'ducats', type: 'Ducat' },
  { ns: 'ITEM', url: 'enshrouding-crystals', type: 'EnshroudingCrystal' },
  { ns: 'ITEM', url: 'corpses', type: 'Corpse' },
  { ns: 'DIVINATION_CARD', url: 'divination-cards', type: 'DivinationCard' },
  { ns: 'CAPTURED_BEAST', url: 'beasts', type: 'Beast' },
  { ns: 'UNIQUE', url: 'unique-jewels', type: 'UniqueJewel' },
  { ns: 'UNIQUE', url: 'unique-flasks', type: 'UniqueFlask' },
  { ns: 'UNIQUE', url: 'unique-weapons', type: 'UniqueWeapon' },
  { ns: 'UNIQUE', url: 'unique-armours', type: 'UniqueArmour' },
  { ns: 'UNIQUE', url: 'unique-accessories', type: 'UniqueAccessory' },
  { ns: 'UNIQUE', url: 'unique-maps', type: 'UniqueMap' },
  { ns: 'UNIQUE', url: 'unique-relics', type: 'UniqueRelic' },
  { ns: 'UNIQUE', url: 'unique-tinctures', type: 'UniqueTincture' },
  { ns: 'GEM', url: 'skill-gems', type: 'SkillGem' },
];

/** Item check links (EE2 `item-check/hotkeyable-actions.ts`). */
export const POE_WIKI_SITE = 'https://www.poe2wiki.net/wiki';
export const POEDB_SITE = 'https://poe2db.tw';
/** PoEDB language segment per game language. */
export const POEDB_LANGS: Record<Lang, string> = { en: 'us', ru: 'ru' };
export const CRAFT_OF_EXILE_SITE = 'https://craftofexile.com';

/** APT shows chaos prices from this share of the divine rate up as divines (≈ 1 div in ±6 %). */
export const NINJA_DIVINE_ROUNDING = 0.06;

/** Bulk offers below this share of the poe.ninja price are treated as bait (FINDINGS F-26). */
export const BULK_BAIT_RATIO = 0.5;

/** Rows of the divine → chaos tooltip in the window title bar. */
export const DIVINE_FRACTIONS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

/** Name plate colors per item rarity (PoE conventions). Keyed by ParsedItem rarity or category. */
export const RARITY_COLORS: Record<string, { text: string; plate: string; rule: string }> = {
  Normal: { text: '#c8c8c8', plate: 'linear-gradient(#2a2826, #161514)', rule: '#5e5a54' },
  Magic: { text: '#8888ff', plate: 'linear-gradient(#22223a, #12121f)', rule: '#4a4a8a' },
  Rare: { text: '#ffff77', plate: 'linear-gradient(#3a2c18, #1f170d)', rule: '#7a5f36' },
  Unique: { text: '#d97a3a', plate: 'linear-gradient(#3a2414, #1f130a)', rule: '#8a5426' },
  Gem: { text: '#1ba29b', plate: 'linear-gradient(#123230, #0a1a19)', rule: '#2a6a66' },
  Currency: { text: '#d8cfa8', plate: 'linear-gradient(#2a2822, #16150f)', rule: '#5e5a4a' },
  'Divination Card': { text: '#0ebaff', plate: 'linear-gradient(#0f2a36, #08161d)', rule: '#2a5a70' },
};

/** Dot color next to listing prices, by trade currency id. */
export const CURRENCY_COLORS: Record<string, string> = {
  chaos: '#d6b04c',
  divine: '#d8d8e8',
  exalted: '#c9b48a',
  chrome: '#5aa0d8',
  vaal: '#b5413a',
};
export const CURRENCY_COLOR_OTHER = '#8f887c';

/** localStorage key of the settings before stage 13; read once to move them into the store. */
// The old name stays: it is where stages 2–10 kept the settings.
export const LEGACY_SETTINGS_STORAGE_KEY = 'poe-trade-overlay.settings';
/** Settings file of `tauri-plugin-store`, in the app config folder. */
export const SETTINGS_FILE = 'settings.json';
/** Key of the whole settings object inside the store file. */
export const SETTINGS_STORE_KEY = 'settings';
/** Current settings format; `upgradeSettings` brings older files up to it. */
export const SETTINGS_VERSION = 1;
/** Event the window that changed the settings sends to the other windows. */
export const SETTINGS_CHANGED_EVENT = 'settings-changed';

/** Chat commands (APT `Config.ts` `commands`). `@last` is the last whisper partner. */
export const DEFAULT_CHAT_COMMANDS: Array<{ text: string; hotkey: string | null; send: boolean }> = [
  { text: '/hideout', hotkey: 'F5', send: true },
  { text: '/exit', hotkey: 'F9', send: true },
  { text: '@last ty', hotkey: null, send: true },
  { text: '/invite @last', hotkey: null, send: true },
  { text: '/tradewith @last', hotkey: null, send: true },
  { text: '/hideout @last', hotkey: null, send: true },
];

/** Where the popup opens: centred on the game, or in the half opposite to the cursor (APT). */
export type PopupPosition = 'center' | 'opposite-cursor';
export const DEFAULT_POPUP_POSITION: PopupPosition = 'center';

/** Window labels, as in `tauri.conf.json`. */
export const MAIN_WINDOW_LABEL = 'main';
export const TOAST_WINDOW_LABEL = 'toast';

/** Where the portable build sends the user for a new version. */
export const RELEASES_URL = 'https://github.com/ArtemNA/price-of-exile-2/releases/latest';
/** A version's release page, with its "What's new" (the tag's CHANGELOG section) and files. */
export const releaseUrl = (version: string) => `https://github.com/ArtemNA/price-of-exile-2/releases/tag/v${version}`;

/** Identifier suffix of dev builds (`tauri.dev.conf.json`), see `src-tauri/src/constants.rs`. */
export const DEV_IDENTIFIER_SUFFIX = '.dev';

/** Exact title of the game window (APT `windowTitle`). */
export const DEFAULT_GAME_TITLE = 'Path of Exile 2';

/** What a hotkey does: open a check of the hovered item, or act on it without the popup. */
export const HOTKEY_ACTIONS = ['price-check', 'item-check', 'wiki', 'poedb', 'craft-of-exile', 'stash-search', 'stash-panel', 'browser'] as const;
export type HotkeyAction = (typeof HOTKEY_ACTIONS)[number];

/** Hotkeys in `tauri-plugin-global-shortcut` format (modifiers + `KeyboardEvent.code`); null = none. */
export const DEFAULT_HOTKEYS: Record<HotkeyAction, string | null> = {
  /** APT default. */
  'price-check': 'Ctrl+KeyD',
  /** APT has none by default; Alt+D since stage 9. */
  'item-check': 'Alt+KeyD',
  /** APT `wikiKey`, `poedbKey`, `craftOfExileKey`, `stashSearchKey`: none by default. */
  wiki: null,
  poedb: null,
  'craft-of-exile': null,
  'stash-search': null,
  /** The stash search presets; APT shows them in its overlay mode (Shift+Space) instead. */
  'stash-panel': 'Alt+KeyF',
  /** The built-in browser ↔ the game; none by default. */
  browser: null,
};

/**
 * Stash search presets (APT `WidgetStashSearch.vue defaultInstances`). APT's "Reflect" preset
 * looked for map reflect mods, which left the game (FINDINGS F-39): "less Recovery" takes its place.
 */
export const DEFAULT_STASH_SEARCH = [
  {
    id: 1,
    title: 'Map rolling',
    enableHotkeys: true,
    entries: [
      { id: 1, name: '', text: '"Pack Size: +3"', hotkey: null },
      { id: 2, name: '', text: '"less Recovery"', hotkey: null },
      { id: 3, name: '', text: '"Cannot Leech Life"', hotkey: null },
      { id: 4, name: '', text: '"Cannot Leech Mana"', hotkey: null },
    ],
  },
  {
    id: 2,
    title: 'Dump sorting',
    enableHotkeys: true,
    entries: [
      { id: 1, name: '', text: 'Currency', hotkey: null },
      { id: 2, name: '', text: '"Divination Card"', hotkey: null },
      { id: 3, name: '', text: 'Fossil', hotkey: null },
      { id: 4, name: '', text: '"Map Tier"', hotkey: null },
      { id: 5, name: '', text: '"Map Device" "Rarity: Normal"', hotkey: null },
      { id: 6, name: '', text: 'Tane Laboratory', hotkey: null },
    ],
  },
];
/** The game's stash search takes at most this many characters (APT marks longer texts red). */
export const STASH_SEARCH_MAX_LENGTH = 250;

/** Popup widths the item check asks for (logical pixels); the height follows the content. */
export const ITEM_CHECK_WIDTH = 380;
export const MAP_CHECK_WIDTH = 440;
export const STASH_PANEL_WIDTH = 360;

/** Map check profiles, shown as roman numerals; decisions are stored one character per profile. */
export const MAP_CHECK_PROFILES = ['I', 'II', 'III'];
/**
 * Default map check marks (APT `WidgetItemCheck.vue initInstance`). APT also marks physical and
 * elemental reflect, which left the game and would show the "outdated wording" banner (FINDINGS F-39):
 * here the less recovery mod takes their place.
 */
export const DEFAULT_MAP_CHECK = {
  profile: 1,
  showNewStats: false,
  selectedStats: [
    { matcher: 'Players have #% to all maximum Resistances', decision: 'w--' },
    { matcher: 'Players have #% less Recovery Rate of Life and Energy Shield', decision: 'd--' },
    { matcher: 'Area contains two Unique Bosses', decision: 'g--' },
  ],
};
