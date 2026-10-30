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

/** How the base switch names an EE2 item category where its name is not the game's ("Any Waystone"). */
export const CATEGORY_NAMES: Record<string, string> = { Map: 'Waystone' };

/** Permanent leagues (EE2 `Leagues.ts`); Hardcore is not offered. Names on pc-ggg and pc-garena. */
export const PERMANENT_SC_LEAGUES = ['Standard', '標準模式'];
export const PERMANENT_HC_LEAGUES = ['Hardcore', '專家模式'];
/** The Hardcore twin of a PoE2 challenge league is "HC <name>" ("HC Forbidden Rites"). */
export const HC_LEAGUE_PREFIX = 'HC ';

/** Price check defaults (APT price-check widget `initInstance`). */
export const PRICE_CHECK_DEFAULTS = {
  /** ±% around each roll used for min/max of stat filters. */
  searchStatRange: 10,
  /** Which listings to search (EE2 `listingType`): instant buyout only, as EE2 does by default. */
  listingType: 'securable' as ListingType,
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

/**
 * Price check stat filter headings in display order, and which EE2 filter tags go under each (F-54).
 * PoE2 has no Eldritch implicits; runes, granted skills, desecrated and mutated (Vaal unique) mods
 * are their own groups. Fractured mods stay with the explicit ones (the row has a Fractured switch).
 * Tags as `FilterTag` and, where EE2 passes the mod type through, `ModifierType` (`necropolis`, …).
 */
export const STAT_GROUPS: ReadonlyArray<{ name: string; tags: readonly string[] }> = [
  { name: 'Properties', tags: ['property'] },
  { name: 'Totals', tags: ['pseudo'] },
  { name: 'Implicit', tags: ['implicit', 'synthesised', 'eldritch', 'scourge'] },
  { name: 'Explicit', tags: ['explicit', 'fractured', 'variant', 'veiled', 'explicit-veiled', 'explicit-delve', 'explicit-incursion', 'sanctum'] },
  { name: 'Rune', tags: ['rune', 'added-rune'] },
  { name: 'Enchant', tags: ['enchant', 'corrupted'] },
  { name: 'Skill', tags: ['skill'] },
  { name: 'Desecrated', tags: ['desecrated'] },
  { name: 'Crafted', tags: ['crafted'] },
  { name: 'Mutated', tags: ['mutated'] },
];
/** The group that also shows the item's unrevealed desecrated mods (EE2 `veiled` item filter). */
export const STAT_GROUP_UNREVEALED = 'Desecrated';
export const STAT_GROUP_OTHER = 'Other';

/** Short labels of the item filter chips in the price check header. */
export const ITEM_CHIP_SHORT_LABELS: Record<string, string> = {
  itemLevel: 'iLvl',
  augmentSockets: 'Sockets',
  socketNumber: 'Sockets',
  gemLevel: 'Gem level',
  mapTier: 'Waystone tier',
  areaLevel: 'Area level',
  awardedAscendancyPoints: 'Ascendancy points',
  unidentifiedTier: 'Unid tier',
  stackSize: 'Stack',
};
/** Chips searched for exactly their value, not "at least" (EE2 sends min = max for the waystone tier). */
export const ITEM_CHIPS_EXACT: readonly string[] = ['mapTier'];

/**
 * Items without tier badges on their mods, as in EE2 `FilterModifierTiers.vue`: waystones (EE2 parses
 * them as maps, FINDINGS F-09) and tablets have no tiers worth comparing, and jewel tiers do not
 * rank the rolls the way gear tiers do.
 */
export const NO_TIER_CATEGORIES: readonly string[] = ['Map', 'TowerAugment', 'Jewel', 'Cluster Jewel', 'Abyss Jewel'];

/**
 * Trade listing types (EE2 `OnlineFilter.vue` `listingType`, the trade2 `status.option`) with their
 * labels in the price check and the short form for its summary line.
 */
export type ListingType = 'securable' | 'available' | 'online' | 'any';
export const LISTING_TYPES: ReadonlyArray<{ value: ListingType; label: string; summary: string; hint: string }> = [
  { value: 'securable', label: 'Instant buyout', summary: 'instant buyout', hint: 'Listings in merchant tabs, bought without a whisper' },
  { value: 'available', label: 'Instant or online', summary: 'instant or online', hint: 'Merchant tabs and sellers online to whisper' },
  { value: 'online', label: 'Online', summary: 'online', hint: 'Sellers online to whisper, merchant tabs left out' },
  { value: 'any', label: 'Any', summary: 'online & offline', hint: 'Every listing, sellers offline too' },
];
/** Bulk exchange knows no instant buyout: EE2 offers these three there (`onlineleague` only for bulk). */
export type BulkListingType = 'onlineleague' | 'online' | 'any';
export const BULK_LISTING_TYPES: ReadonlyArray<{ value: BulkListingType; label: string; summary: string; hint: string }> = [
  { value: 'onlineleague', label: 'In league', summary: 'online in league', hint: 'Sellers online and in this league' },
  { value: 'online', label: 'Online', summary: 'online', hint: 'Sellers online' },
  { value: 'any', label: 'Any', summary: 'online & offline', hint: 'Every offer, sellers offline too' },
];

/** The leagues list is loaded again on a check when it is older than this (ms). */
export const LEAGUES_REFRESH_AFTER = 3 * 60 * 60 * 1000;

/** Upper limit of the stat filter range setting, % (APT `settings-price-check.vue`). */
export const SEARCH_STAT_RANGE_MAX = 50;
/**
 * Buyout currency filter choices (EE2 `OnlineFilter.vue`); values are trade2 `price.option`s.
 * PoE2 trades in exalted orbs; chaos and divine orbs are the other two common prices.
 */
export const DEFAULT_CURRENCY_OPTIONS: Array<{ value: string | null; label: string }> = [
  { value: null, label: 'Any currency' },
  { value: 'exalted', label: 'Exalted Orb' },
  { value: 'chaos', label: 'Chaos Orb' },
  { value: 'divine', label: 'Divine Orb' },
  { value: 'exalted_divine', label: 'Exalted or Divine' },
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
 * poe.ninja's official PoE2 economy API (docs/analysis/poe2-services.md §3): host + path without
 * scheme, `?league=<id>&type=<type>` follows. League ids are the trade site's ("Forbidden Rites").
 */
export const POE_NINJA_API = {
  exchange: 'poe.ninja/poe2/api/economy/exchange/current/overview',
  stash: 'poe.ninja/poe2/api/economy/stash/current/item/overview',
};
/**
 * Re-fetch poe.ninja prices this often (PoE2 prices update about hourly): the currency rates on a
 * timer, every other type only when an item of it is checked again after this long. ETag keeps an
 * unchanged answer to a "304 Not Modified".
 */
export const POE_NINJA_REFRESH_MS = 60 * 60 * 1000;
/** After a failed request, the type may be asked for again this much later. */
export const POE_NINJA_RETRY_MS = 4 * 60 * 1000;
/** The overview type with the currency rates (`core.rates`); loaded first, with the league. */
export const POE_NINJA_RATES_TYPE = 'Currency';
/**
 * Stash overview lines (uniques) with fewer listings than this are skipped: a handful of listings
 * makes outliers (The Gnashing Sash at 5,060 div from 6 listings, 28.10.2026).
 */
export const POE_NINJA_MIN_LISTINGS = 10;
/**
 * Exchange overview lines with fewer items traded per hour than this (volume / price) are skipped:
 * the exchange has no listing count, and a price from a trade or two a day is noise.
 */
export const POE_NINJA_MIN_TRADED_PER_HOUR = 0.1;

/**
 * poe.ninja PoE2 overview types: API kind, game data namespace of their lines, and the site's URL
 * segment for item pages (`${POE_NINJA_SITE}/${league slug}/${url}/${detailsId}`).
 */
export const POE_NINJA_TYPES: Readonly<Record<string, { api: 'exchange' | 'stash'; ns: string; url: string }>> = {
  Currency: { api: 'exchange', ns: 'ITEM', url: 'currency' },
  Fragments: { api: 'exchange', ns: 'ITEM', url: 'fragments' },
  Abyss: { api: 'exchange', ns: 'ITEM', url: 'abyssal-bones' },
  UncutGems: { api: 'exchange', ns: 'ITEM', url: 'uncut-gems' },
  LineageSupportGems: { api: 'exchange', ns: 'GEM', url: 'lineage-support-gems' },
  Essences: { api: 'exchange', ns: 'ITEM', url: 'essences' },
  SoulCores: { api: 'exchange', ns: 'ITEM', url: 'soul-cores' },
  Idols: { api: 'exchange', ns: 'ITEM', url: 'idols' },
  Runes: { api: 'exchange', ns: 'ITEM', url: 'runes' },
  Ritual: { api: 'exchange', ns: 'ITEM', url: 'omens' },
  Expedition: { api: 'exchange', ns: 'ITEM', url: 'expedition' },
  Delirium: { api: 'exchange', ns: 'ITEM', url: 'liquid-emotions' },
  Breach: { api: 'exchange', ns: 'ITEM', url: 'breach-catalyst' },
  Verisium: { api: 'exchange', ns: 'ITEM', url: 'verisium' },
  UniqueWeapons: { api: 'stash', ns: 'UNIQUE', url: 'unique-weapons' },
  UniqueArmours: { api: 'stash', ns: 'UNIQUE', url: 'unique-armours' },
  UniqueAccessories: { api: 'stash', ns: 'UNIQUE', url: 'unique-accessories' },
  UniqueFlasks: { api: 'stash', ns: 'UNIQUE', url: 'unique-flasks' },
  UniqueCharms: { api: 'stash', ns: 'UNIQUE', url: 'unique-charms' },
  UniqueJewels: { api: 'stash', ns: 'UNIQUE', url: 'unique-jewels' },
  UniqueSanctumRelics: { api: 'stash', ns: 'UNIQUE', url: 'unique-relics' },
  UniqueTablets: { api: 'stash', ns: 'UNIQUE', url: 'unique-tablets' },
};

/**
 * Which overview types may list a stackable item (game data namespace ITEM with a trade tag), by
 * its game data `craftable.category` and name. The first matching rule wins; its types are
 * loaded one by one until the item is found, so a guess costs at most one request more.
 */
export const POE_NINJA_ITEM_ROUTES: ReadonlyArray<{ category?: string; name?: RegExp; types: string[] }> = [
  { category: 'Omen', types: ['Ritual'] },
  { category: 'UncutSkillGem', types: ['UncutGems'] },
  { category: 'SoulCore', name: /Soul Core/, types: ['SoulCores'] },
  { category: 'SoulCore', name: /Idol\b|^Carved /, types: ['Idols'] },
  { category: 'SoulCore', types: ['Runes', 'SoulCores', 'Idols'] },
  { category: 'Breachstone', types: ['Breach', 'Fragments'] },
  { category: 'ExpeditionLogbook', types: ['Expedition'] },
  { category: 'MapFragment', types: ['Fragments'] },
  { category: 'QuestItem', types: ['Fragments'] },
  { category: 'PinnacleKey', types: ['Fragments'] },
  { category: 'VaultKey', types: ['Fragments'] },
  { name: /Essence of /, types: ['Essences'] },
  { name: /Catalyst$|^Breach Splinter$/, types: ['Breach'] },
  { name: /Splinter$/, types: ['Fragments', 'Currency'] },
  { name: /\bLiquid\b/, types: ['Delirium'] },
  { name: /(Collarbone|Jawbone|Rib|Cranium|Vertebrae)$/, types: ['Abyss'] },
  { name: /Verisium|Starlit Ore|Alloy$|Flux\b/, types: ['Verisium', 'Currency'] },
  { types: ['Currency'] },
];
/** Lineage support gems: the only gems (namespace GEM) poe.ninja prices; they have a trade tag. */
export const POE_NINJA_GEM_TYPES = ['LineageSupportGems'];
/** Unique items by the game data `craftable.category` of their base. */
export const POE_NINJA_UNIQUE_ROUTES: ReadonlyArray<{ categories: string[]; types: string[] }> = [
  { categories: ['Amulet', 'Ring', 'Belt'], types: ['UniqueAccessories'] },
  { categories: ['Quiver'], types: ['UniqueArmours', 'UniqueAccessories'] },
  {
    categories: ['Body Armour', 'Helmet', 'Gloves', 'Boots', 'Shield', 'Buckler', 'Focus'],
    types: ['UniqueArmours'],
  },
  {
    categories: [
      'One Hand Sword', 'Two Hand Sword', 'One Hand Axe', 'Two Hand Axe', 'One Hand Mace', 'Two Hand Mace',
      'Dagger', 'Claw', 'Spear', 'Flail', 'Bow', 'Crossbow', 'Wand', 'Sceptre', 'Staff', 'Warstaff', 'Talisman',
    ],
    types: ['UniqueWeapons'],
  },
  { categories: ['Flask'], types: ['UniqueFlasks'] },
  { categories: ['Charm'], types: ['UniqueCharms'] },
  { categories: ['Jewel'], types: ['UniqueJewels'] },
  { categories: ['Relic'], types: ['UniqueSanctumRelics'] },
  { categories: ['TowerAugment'], types: ['UniqueTablets'] },
];

/** poe.ninja PoE2 item pages: `${POE_NINJA_SITE}/${league slug}/${type url}/${detailsId}`. */
export const POE_NINJA_SITE = 'https://poe.ninja/poe2/economy';

/**
 * The two small trade currencies of PoE2, priced against divines (poe.ninja `core.rates`): prices
 * are shown in the first, the second goes next to it. Owner's decision: both everywhere.
 */
export const SMALL_CURRENCIES = ['exalted', 'chaos'] as const;
/** Short names after amounts: "12 ex", "0.2 c", "1.5 div". */
export const CURRENCY_ABBREVIATIONS: Record<string, string> = { exalted: 'ex', chaos: 'c', div: 'div', divine: 'div' };

/** Item check links (EE2 `item-check/hotkeyable-actions.ts`). */
export const POE_WIKI_SITE = 'https://www.poe2wiki.net/wiki';
export const POEDB_SITE = 'https://poe2db.tw';
/** PoEDB language segment per game language. */
export const POEDB_LANGS: Record<Lang, string> = { en: 'us', ru: 'ru' };
export const CRAFT_OF_EXILE_SITE = 'https://craftofexile.com';
/** PoE2DB page of waystone modifiers; EE2 links a missing page per tier ("Waystone_(Tier_14)", 404). */
export const POEDB_WAYSTONES_PAGE = 'Waystones';
/** Uncut gems have a base per level ("Uncut Skill Gem (Level 19)"), the wiki and PoE2DB one page for all. */
export const UNCUT_GEM_LEVEL = /(?<=^Uncut .+) \(Level \d+\)$/;
/**
 * Weapon property EE2 does not read, per game language (EE2 client strings have no key for it).
 * The Russian text follows "Урон от огня: " and is not checked in the game yet.
 */
export const CHAOS_DAMAGE_PROPERTY: Record<Lang, string> = { en: 'Chaos Damage: ', ru: 'Урон хаосом: ' };

/** Prices from this share of a divine up are shown as divines (≈ 1 div in ±6 %; APT, EE2 `autoCurrency`). */
export const NINJA_DIVINE_ROUNDING = 0.06;

/** Bulk offers below this share of the poe.ninja price are treated as bait (FINDINGS F-26). */
export const BULK_BAIT_RATIO = 0.5;

/** Rows of the divine → exalted · chaos tooltip in the window title bar. */
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
export const SETTINGS_VERSION = 2;
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
