# Перевикористання коду Price of Exile для PoE2 і стратегія репозиторію

> Аналіз 28.10.2026. Еталон: `C:\Users\Artem\Documents\AI\poe-trade-overlay` (коміт `2258466`, реліз 0.1.8, 61 коміт).
> APT: `_upstream/apt` @ `3188208` (той самий коміт, що портований). EE2: `_upstream/ee2` @ `cca3066` (06.09.2026, `main` 0.16.3).
> Шляхи `file:line` — відносно кореня еталона, якщо не сказано інше. Тільки читання, жодних змін в еталоні.

## 0. Коротко

- **Rust-хост (2 660 рядків) — ~90 % як є.** Ігрове в ньому — лише `constants.rs` (назва вікна, хости, перший рядок предмета, ширина панелей) і `copy_sequence` у `hotkeys.rs` (PoE2 копіює `Ctrl+Alt+C`). Ще 149 рядків `shortcuts.rs` — міграція ярликів PoE1, для PoE2 не потрібна.
- **Власний Angular-код (5 324 рядки): ~18 % як є, ~63 % з правками, ~19 % переписати.** Переписувати — poe.ninja і курси валют (chaos → exalted, інший API), bulk-ринок, unidentified, map check (вейстоуни/таблички).
- **Головний ризик — не наш код, а API EE2.** EE2 відгалузився від APT **24.11.2024** (`73788f0`); у нашому порті є 201 новіший коміт APT, якого EE2 не має. Найбільше б'є відсутність `FilterOrGroup`/`FilterGroup`: на ньому побудовані `filter-view.ts`, `trade-search.ts` і `price-check-panel.*` (групи модів, дизайн A+B). Плюс у EE2 Vue-залежності в ядрі (`useTradeData`, `usePoeninja`, `useAugment`) — шимів буде більше, ніж 3 файли.
- **Рекомендація:** окремий репозиторій (B) + спільний Rust-крейт хоста (C-lite) через Cargo git-залежність з тегами. TS-оболонку не виносимо в пакет: однакові шляхи файлів у двох репо, перенесення правок через `git format-patch | git am -3`. Монорепо відпадає через updater (`releases/latest` PoE1-користувачів).

---

## 1. Інвентар власного коду

Категорії: **(a)** як є · **(b)** з правками під PoE2 · **(c)** переписати. Рядки — `wc -l`.

### 1.1 Rust-хост `src-tauri/src` — 2 660

| Файл | Рядки | Кат. | Що міняти / докази |
|---|---:|:-:|---|
| `platform/windows.rs` + `mod.rs` | 451 | a | WinAPI: foreground hook, `SendInput`, NOACTIVATE, монітори/DPI. Від гри не залежить |
| `popup.rs` | 424 | a | Позиція «навпроти курсора» бере `POE_PANEL_WIDTH_RATIO` з constants (F-58: перевірити ширину панелей PoE2) |
| `hotkeys.rs` | 455 | b | `hotkeys.rs:126-138` `copy_sequence` тисне тільки `Ctrl+C`. EE2 тисне `Ctrl` + `showModsKey` (типово `Alt`, `ee2/main/src/host-files/GameConfig.ts:51`) + `C` і відпускає модифікатори через 10 мс (`ee2/main/src/shortcuts/Shortcuts.ts:293-323`). Винести послідовність у параметр. Коментар `hotkeys.rs:28` (poewiki/PoEDB) |
| `lib.rs` | 310 | a | Команди Tauri, `setup`, перевірка `.dev` identifier (F-41) |
| `browser.rs` | 255 | a/b | `browser.rs:70` назва вікна `"pathofexile.com — Price of Exile"` захардкоджена — винести в constants. Тест `browser.rs:223-232` з `/api/trade/search/Standard` → `/api/trade2/...` |
| `shortcuts.rs` | 149 | — | Міграція ярликів «PoE Trade Overlay» → «Price of Exile» (F-56). Для PoE2 не потрібна; у спільному крейті — опційна |
| `state.rs` | 132 | a | `state.rs:39` бере `DEFAULT_GAME_TITLE` |
| `chat.rs` | 124 | a | Чат-команди (F-42: набір команд — в налаштуваннях TS) |
| `constants.rs` | 104 | b | `:8` `DEFAULT_GAME_TITLE = "Path of Exile"` → `"Path of Exile 2"`; `:23` `BROWSER_HOSTS`, `:25` `DEFAULT_TRADE_HOST`; `:31` `BROWSER_REPLIES_GLOBAL = "__poeTradeOverlayReplies"` (можна лишити); `:47-49` старі ярлики; `:80` `POE_PANEL_WIDTH_RATIO`; `:104` `ITEM_FIRST_LINES` (EE2 знає більше мов, `ee2/main/src/shortcuts/HostClipboard.ts:120+`) |
| `tray.rs` | 85 | a | `tray.rs:57` tooltip = `package_info().name` (з productName) |
| `clipboard.rs` / `toast.rs` / `stash.rs` / `main.rs` | 65/65/35/6 | a | — |
| **Разом** | **2 660** | | **a ≈ 2 390 (90 %)**, b ≈ 120, прибрати 149 |

Конфіг: `tauri.conf.json` (b — ідентичність, §4), `tauri.dev.conf.json` (b), `Cargo.toml:2-7` (b — name/description/repository), плагіни в `Cargo.toml:25-34` (a).

### 1.2 Angular `src/app` — 5 324

| Файл / тека | Рядки | Кат. | Що міняти / докази |
|---|---:|:-:|---|
| `app.ts`, `app.config.ts` | 54 | a | `app.ts:41` мітки трею через `tr()` |
| `host.ts` | 92 | a | `host.ts:42` юніон дій `'wiki' \| 'poedb' \| 'craft-of-exile'` — назви ті самі |
| `game-data.ts` | 39 | a | Але `setDataSource`/`DataSource` — це `[port]`-правка в `src/lib/apt/data/index.ts:6,91-208`; на EE2 (`assets/data/index.ts`, 624 рядки) її треба зробити заново |
| `constants.ts` | 356 | b | Центр PoE1-констант, див. §1.5 |
| `core/http.ts` | 84 | a | Хости й User-Agent — з constants (`http.ts:3,72`) |
| `core/i18n.ts`, `core/updates.ts` | 70 / 62 | a | — |
| `core/settings.ts` | 199 | a | Інфраструктура (store, версії, міграція, `storage`-подія F-15). Форма `Settings` містить `mapCheck`/`priceCheck` — типи з constants і `@/web/map-check/common` (`settings.ts:2`). Міграцію з `LEGACY_SETTINGS_STORAGE_KEY` прибрати |
| `core/leagues.ts` | 98 | b | Ліги з `www.pathofexile.com`; у EE2 `/api/trade2/data/leagues` + `realm=poe2` (`ee2/.../web/background/Leagues.ts:51-53`) |
| `core/item-links.ts` | 55 | b | `:19` `game=poe1`; сайти wiki/poedb з constants; `:5` `getPropQuality` **у EE2 немає**, `propAt20Quality` без аргументу `bounds` (§2) |
| `core/currency-rates.ts` | 107 | c | `:15,56,76` база — chaos, `'Divine Orb'`; `:82` `POE_NINJA_OVERVIEWS` (poe1 dense API). PoE2: базова валюта exalted/divine/chaos, EE2 бере ціни через `api.exiledexchange2.dev/proxy/.../overviewData.json` + `namespaceMap.json` (`ee2/.../background/Prices.ts:173-200`) |
| `core/ninja-prices.ts` | 256 | c | `POE_NINJA_NAMESPACES`, `chaos`/`div` як одиниці (`:95-109,183-204`), slug ліг (`:59`), `getDetailsId` з EE2 інший (347 рядків, `TRADE_TAG_TO_REF`) |
| `price-check/price-check-panel.ts` + `.html` | 661 + 573 | b (важка) | `FilterOrGroup`/`FilterTag` (`.ts:5`), `dustEquivalent` (`.html:463`), ~38 рядків з `chaos`/`divine`, вкладка poe.ninja |
| `price-check/filter-view.ts` | 119 | b | Уся логіка груп на `FilterOrGroup` (`:7,25-34,86-87`) — у EE2 тільки `StatFilter[]` |
| `price-check/trade-search.ts` | 113 | b | `search(filters, stats: FilterOrGroup[])` (`:63`); `createTradeRequest` в EE2 = `(filters, stats: StatFilter[], item)` |
| `price-check/price-check.ts` | 79 | b | `createPresets` опції: `merchantOnly` → `listingType`, + `defaultAllSelected` (`ee2/.../create-presets.ts:14-30`); `initUiModFilters` + `noPseudo` (наша `[port]`-правка); категорії `mapCompletionReward`, `Idol`, `Mercenary Warrant` (`:53-75`) |
| `price-check/item-filter-chips.ts` | 89 | b | `linkedSockets`, `whiteSockets`, `influences` (`:17-18,84`) → у PoE2 `augmentSockets`/руни, `sanctified`, `unidentifiedTier` |
| `price-check/bulk-search.ts` | 163 | c | Market ratio в chaos/divine (`:21-27,62,150`); обмін валют PoE2 інший (F-30) |
| `price-check/unidentified*.ts` | 54 | c | `makeIdentifiedUnique` **у EE2 немає** (`unidentified.ts:4`) |
| `price-check/num-input.ts`, `listing-summary.ts` | 94 / 45 | a | `listing-summary` бере тип `RateLimiter` — API однаковий |
| `item-check/*` | 146 | b | Кнопки Wiki/PoEDB (`item-check-panel.html:21-22`), `dustEquivalent` (`:69,76`) — у PoE2 дусту немає |
| `map-check/*` | 432 | c | `mapArea`, `areaItemQuantity/Rarity/PackSize`, `MEMORY_MAPS` (Maven) (`map-check.ts:87-92`, `map-check-panel.ts:29-31`); `prepareMapStat(calc)` → у EE2 `prepareMapStats(item)` |
| `popup-window/*` | 377 | b | `item-view.ts:37-38` `sockets.linked`, `influences`; `popup-window.html:57` poe.ninja-рядок; дії poedb (`popup-window.ts:141`) |
| `settings/settings-window.*` | 609 | b | Списки дій/підказки (`.ts:51-58` poewiki/poedb/pathofexile.com), секція map check, мова гри (EE2 має 13 мов даних) |
| `settings/hotkey*.ts` | 99 | a | — |
| `stash-search/*`, `toast-window/*` | 75 / 46 | a | Пресети тексту — у constants (b) |
| `shared/currency.ts` | 24 | b | `'div' → 'divine'` (`:21`), іконки валют PoE2 |
| `apt-shims/ipc.ts` | 10 | a | `Host.proxy` той самий в EE2 |
| `apt-shims/web-config.ts`, `overlay-interfaces.ts` | 44 | b | `Config`/`PriceCheckWidget` — набір полів EE2 інший; плюс нові шими (§2.3) |
| **Разом** | **5 324** | | **a 969 (18 %) · b 3 343 (63 %) · c 1 012 (19 %)** |

### 1.3 Решта

| Що | Рядки | Кат. | Примітка |
|---|---:|:-:|---|
| `scripts/*.ps1` (fake-game, press-hotkey, screenshot, measure-popup) | 336 | a | `measure-popup.ps1:20` типовий `$Title = 'Path of Exile'` → параметр/`Path of Exile 2` |
| `scripts/make-data-indexes.mjs` | 80 | a | EE2 теж не зберігає `*.index.bin` (у `ee2/renderer/public/data/en` тільки `.ndjson`) — скрипт потрібен як є (F-07) |
| `tests/` інфраструктура (`game-data.ts`, `http`, `rate-limit`, `settings`, `window`) | ~350 | a | `leagues.test.ts` (82) — b |
| `tests/` предметні (parser, price-check, bulk, ninja, map-check, item-check, unidentified, game-language) + fixtures | ~1 180 + json | c | PoE1-предмети й відповіді poe.ninja; структуру тестів копіювати |
| `public/i18n/uk.json`, `ru.json` | 634 × 2 | a/b | Формат і власні ключі — так; секція `apt` — з `app_i18n.json` EE2 (F-59) |
| `public/data/` | — | c | Дані EE2 (`ee2/renderer/public/data/<lang>`) |
| `.github/workflows/release.yml` | 89 | a | `:67` `price-of-exile.exe` — з імені крейта; `RELEASE_NOTES.md` — тексти |
| `README.md`, `CHANGELOG.md`, `docs/` | — | c | Нові; FINDINGS — новий файл з тегом «PoE1: так/ні» |

### 1.4 Де сидить PoE1 (grep, крім `src/lib/apt`)

| Маркер | Докази |
|---|---|
| `pathofexile.com`, `/api/trade/` | `constants.ts:44-47,76-78,132`; `constants.rs:23,25`; `browser.rs:70,223-232`; `apt-shims/ipc.ts:8`; `settings-window.html:313` |
| `poe.ninja/poe1` | `constants.ts:143,156` |
| `chaos`, `divine` | `currency-rates.ts`, `ninja-prices.ts`, `bulk-search.ts`, `shared/currency.ts:21`, `constants.ts:210-216` (`NINJA_DIVINE_ROUNDING`, `DIVINE_FRACTIONS`), 38 рядків у шаблонах |
| `poewiki`, `poedb`, `craftofexile` | `constants.ts:203-207`; `item-links.ts:19` (`game=poe1`); `item-check-panel.html:21-22`; `settings-window.ts:53-54`. EE2: `poe2wiki.net`, `poe2db.tw`, `game=poe2` (`ee2/.../item-check/hotkeyable-actions.ts:116-125`) |
| `Path of Exile` (назва вікна) | `constants.ts:278`; `constants.rs:8`; `measure-popup.ps1:20`. EE2: `"Path of Exile 2"` (`ee2/.../web/Config.ts:202`) |
| `Maven`, map-специфіка | `constants.ts:339-340` (`MEMORY_MAPS`), `map-check.ts:87-92` |
| `eldritch`, `influence` | `constants.ts:95` (група «Eldritch implicits»); `item-filter-chips.ts:84-85`; `item-view.ts:38` |
| `Allflame` та інші типи ninja | `constants.ts:150-152,162-200` (`POE_NINJA_BULK_TYPES`, `POE_NINJA_NAMESPACES`) |
| Ліги PoE1 | `ninja-prices.ts:59` (slug «settlershc») |
| Ідентичність | `tauri.conf.json:3,5,16,24,38,68-69,83`; `tauri.dev.conf.json:3-4`; `Cargo.toml:2-7`; `package.json:2`; `constants.ts:8-11,241,270-272`; `constants.rs:47-49` |

**Побічна знахідка для PoE1:** `constants.ts:9` `APP_VERSION = '0.1.0'` і `:8` `APP_NAME = 'PoeTradeOverlay'` — User-Agent досі «PoeTradeOverlay/0.1.0», хоча реліз 0.1.8 і назва Price of Exile. GGG просить у UA назву/версію/контакт — варто брати версію з `getVersion()` або з `package.json` під час збірки.

### 1.5 `constants.ts` — що буде іншим у PoE2

Як є: розміри вікон, `TRADE_LISTING`, `SEARCH_STAT_RANGE_MAX`, `RARITY_COLORS`, `SETTINGS_*`, `DEFAULT_CHAT_COMMANDS` (F-42: перевірити), хоткеї. Інші: `APP_*`/`USER_AGENT`, `GAME_LANGS` (EE2 — en, ru, de, fr, es, pt, ja, ko, th, cmn-Hant), `POE_WEB_API`, `POE_OFFICIAL_HOSTS`, `PERMANENT_*_LEAGUES`, `PRICE_CHECK_DEFAULTS` (`listingType` замість `merchantOnly`), `STAT_GROUPS` (desecrated, rune, sanctified замість eldritch/influence), `ITEM_CHIP_SHORT_LABELS`, `DEFAULT_CURRENCY_OPTIONS`, усе `POE_NINJA_*`, wiki/poedb/CoE, `NINJA_DIVINE_ROUNDING`, `DIVINE_FRACTIONS`, `CURRENCY_COLORS`, `RELEASES_URL`, `DEFAULT_GAME_TITLE`, `DEFAULT_STASH_SEARCH`, `MEMORY_MAPS`, `DEFAULT_MAP_CHECK`.

---

## 2. Стик `src/app` ↔ `src/lib/apt` і що з ним в EE2

### 2.1 Як влаштовано в еталоні

- `tsconfig.json` `paths`: `@/parser`, `@/assets/data` → `src/lib/apt/...`; `@/web/Config`, `@/web/background/IPC`, `@/web/overlay/interfaces` → `src/app/apt-shims/*` (F-08, F-14). Частина імпортів — відносні `../../lib/apt/web/price-check/...`.
- Портовано 36 файлів / 7 990 рядків; 31 правка `[port]` у 5 файлах: `data/index.ts` (джерело даних), `RateLimiter.ts` і `trade/common.ts` (Vue `shallowReactive` → сигнали), `create-stat-filters.ts` (`noPseudo` для пресета Mods), `Leagues.ts` (наш замінник).
- Imported API (src/app + tests): `parseClipboard`, `ParsedItem`, `ItemCategory`, `ItemRarity`, `makeIdentifiedUnique`, `ModifierType`, `getPropQuality`/`propAt20Quality`/`QUALITY_STATS`, `init`/`setDataSource`/`ITEMS_ITERATOR`/`ITEM_BY_REF`/`ITEM_DROP`/`STATS_ITERATOR`/`STAT_BY_MATCH_STR`/`BaseType`, `ItemFilters`/`FilterOrGroup`/`StatFilter`/`FilterNumeric`/`FilterTag`/`FilterPreset`, `createPresets`, `initUiModFilters`, `createTradeRequest`, `CATEGORY_TO_TRADE_ID`, `getTradeEndpoint`, `RateLimiter`, `Cache`, `getDetailsId`/`isValuableBasetype`, `MapCheckConfig`/`StatMatcher`/`StatTag`, `prepareMapStat`, `poeWebApi`.

### 2.2 Ті самі API в EE2

EE2 переформатований prettier (подвійні лапки, `;`), тому `diff` без `-w` бачить змінними майже всі рядки; порівняння — за сигнатурами.

| API | Стан в EE2 | Наслідок для `src/app` |
|---|---|---|
| `parseClipboard(string): Result<ParsedItem,string>` | той самий | — |
| `ParsedItem` | **змінено.** Немає: `mapArea`, `areaItemQuantity/Rarity`, `areaPackSize`, `mapCompletionReward`, `mapMore*`, `sockets`, `dustEquivalent`, `isSplit`, `isFoulborn`, `isVestigial`, `heistBlueprint/Contract`, `memoryStrands`, `mercenary*`, `uniqueBase`, `imbuedGem`, `armourWARD`. Нові: `augmentSockets`, `gemSockets`, `isSanctified`, `map*` (pack size, rarity, revives, gold…), `weaponFIRE/COLD/LIGHTNING/CHAOS/SPIRIT/RELOAD`, `armourRW`, `requires`, `unidentifiedTier`, `trials`, `note`, `qualityType` | map check, item-view, item check (dust), price-check (`mapCompletionReward`) |
| `ItemCategory` | змінено: є `Waystone`, `Tablet`; немає `Idol` | `shouldSearchImmediately` |
| `makeIdentifiedUnique` | **немає** | `unidentified.ts` — переписати (EE2 має інший механізм) |
| `getPropQuality` | **немає** | `item-links.ts:5,47` |
| `propAt20Quality(total, refs, bounds, item)` | **без `bounds`**: `(total, refs, item)` | `item-links.ts:48` |
| `QUALITY_STATS` | є, тип `InternalStatGroup` | перевірити ключ `PHYSICAL_DAMAGE` |
| `init(lang)`, `ITEMS_ITERATOR`, `ITEM_BY_REF`, `ITEM_DROP`, `STATS_ITERATOR`, `STAT_BY_MATCH_STR` | є (плюс `TRADE_ITEM_BY_REF`, `TRADE_STAT_BY_MATCH_STR`) | `[port]`-правку джерела даних повторити; `index.ts` тягне `useTradeData` (Vue, runtime-запит `/api/trade2/data/stats|items`) |
| `setDataSource`, `DataSource` | наша `[port]`-правка | повторити |
| `FilterOrGroup`, `FilterGroup` | **немає** (з'явились в APT після розгалуження, 08.2026: Mercenary Warrant, Timeless) | `filter-view.ts`, `trade-search.ts`, `price-check-panel.*` — перейти на `StatFilter[]` |
| `FilterTag` | був `type` + `const` з `ModifierType`; в EE2 — `enum` з `rune`, `added-rune`, `desecrated`, `skill`, `mutated` | `STAT_GROUPS`, чипи, групи |
| `ItemFilters` | змінено: немає `foulborn`, `imbuedGem`, `mapCompletionReward`, `split`, `vestigial`; нові `augmentSockets`, `sanctified`, `requires`, `socketNumber`, `unidentifiedTier`, `ultimatumHint`, `discriminator`… | `item-filter-chips.ts` |
| `createPresets(item, opts)` | опції інші (`listingType`, `defaultAllSelected`, без `merchantOnly`) | `price-check.ts:31-39` |
| `initUiModFilters(item, opts)` | повертає `StatFilter[]`, нова опція `defaultAllSelected`; нашого `noPseudo` немає | пресет Mods — правку `[port]` повторити |
| `createTradeRequest` (trade) | `(filters, stats: StatFilter[], item)` замість `(filters, stats)`; файл 945 → 2 103 рядки, імпортує `usePoeninja` з `Prices` (Vue) | `trade-search.ts`, тести |
| `createTradeRequest` (bulk) | та сама форма | — |
| `CATEGORY_TO_TRADE_ID`, `getTradeEndpoint` (=`poeWebApi`) | є | — |
| `RateLimiter`, `Cache` | API той самий | `[port]`-правку (сигнали) повторити |
| `getDetailsId`, `isValuableBasetype` | є, інші ns (`getCurrencyDetailsId`, `TRADE_TAG_TO_REF`) | `ninja-prices.ts` |
| `MapCheckConfig`, `StatTag`, `StatMatcher` | є, близько | ок |
| `prepareMapStat(calc)` | **немає** → `prepareMapStats(item)` | `map-check.ts:19,92` |
| `ModifierType` | є, розширений | — |

### 2.3 Нові залежності EE2-ядра, яких не було в APT-порті

| Імпорт у файлі EE2 | Що це | Потрібно |
|---|---|---|
| `assets/data/index.ts` → `@/web/background/TradeData` (`useTradeData`) | Vue `createGlobalState` + `Host.proxy` до `/api/trade2/data/*` | шим без Vue або `[port]` |
| `parser/Parser.ts` → `@/web/price-check/item-editor/augment` (`useAugment`) | редактор рун | портувати/шимити |
| `trade/pathofexile-trade.ts` → `@/web/background/Prices` (`usePoeninja`, `CoreCurrency`, `displayRounding`) | Vue-стан цін | шим поверх нашого `ninja-prices.ts` |
| `trade/common.ts` → `vue` (`shallowReactive`) | як в APT | та сама `[port]`-правка |
| `luxon`, `dot-prop`, `@sindresorhus/fnv1a`, `neverthrow` | npm | додати залежності |

**Висновок §2:** з ~30 використаних API 13 змінились або зникли (ParsedItem, ItemCategory, ItemFilters, FilterTag, FilterOrGroup, makeIdentifiedUnique, getPropQuality, propAt20Quality, createPresets, initUiModFilters, createTradeRequest, prepareMapStat, getDetailsId). Виживає вся «рамка» `src/app` (вікна, налаштування, HTTP, ліміти, хоткеї, i18n), а прайс-чек — з помірною переробкою під `StatFilter[]`. poe.ninja, bulk, map check і unidentified — переписати.

---

## 3. Стратегії репозиторію

Обмеження, що визначають вибір:
1. **Updater PoE1** у встановлених копіях захардкоджений на `https://github.com/ArtemNA/price-of-exile/releases/latest/download/latest.json` (`tauri.conf.json:83-84`). Отже «latest»-реліз репо `price-of-exile` назавжди має бути PoE1.
2. GitHub не дає форкнути власний репо в той самий акаунт — «форк» буде копією з історією (mirror push), без зв'язку «fork network».
3. Код APT і EE2 розійшовся з 2024 року, тож `src/lib/*` у двох застосунках спільним не буде ніколи. Спільним може бути тільки хост і оболонка.

| Критерій | A. Форк (копія з історією) + заміна `src/lib/apt` | B. Новий репо, модулі скопійовано | C. Спільне ядро (монорепо або спільний пакет/subtree) |
|---|---|---|---|
| Зусилля на старт | Найменші: все вже є, `git rm src/lib/apt` + EE2 | Малі: копія + чистка (~1 день) | Монорепо: великі (переструктурувати PoE1, Angular workspace, два конфіги Tauri). Спільний крейт: середні |
| Фікси PoE1 → PoE2 | `git merge` з remote PoE1 — конфлікти в `constants.ts`, i18n, price-check-panel щоразу, бо PoE2 їх переписує | Вручну: `git format-patch` / `git am -3` (шляхи однакові) | Rust-хост: автоматично (один код). TS: як у B, або спільна бібліотека |
| PoE2 → PoE1 | cherry-pick, ризик затягнути PoE2-специфіку | так само, вручну | хост: один код |
| Історія git | 61 коміт PoE1 у PoE2 — шум, `git log`/`blame` змішані; «Release 0.1.x» не про PoE2 | чиста; посилання на еталон у README/FINDINGS | монорепо: спільна, теги з префіксами |
| Розділення ідентичності/updater | треба не забути змінити все з §4, інакше PoE2 оновиться PoE1-фідом | природне | монорепо: обидва релізи в одному репо — «latest» конфліктує з (1); потрібен `--latest=false` для PoE2 або фід поза GitHub Releases. Спільний крейт у окремому/PoE1 репо — без проблем |
| Release pipeline | `release.yml` як є | `release.yml` як є | монорепо: два workflow з тегами `poe1-v*`/`poe2-v*`, фільтри шляхів; крихко |
| Ризик зламати PoE1 | нуль (окремий репо) | нуль | монорепо: високий (реструктуризація щойно випущеного 0.1.8). Крейт: середній, один раз, з перевіркою в грі |

### Рекомендація: **B + спільний Rust-крейт хоста (C-lite)**

- **Новий репо `ArtemNA/<назва PoE2>`** з чистою історією. Власний код копіюється з еталона з тими самими шляхами (`src/app/core/...`, `scripts/...`, `tests/...`), `src/lib/ee2/` — порт EE2 за тим самим правилом «byte for byte + `// [port]`» і файлом `UPSTREAM_COMMIT`.
- **Rust-хост виноситься в крейт** `poe-overlay-host` (робоча назва) у `price-of-exile/crates/overlay-host` (публічний репо). Усе з `src-tauri/src` крім `main.rs` і точки входу; ігрове — у структуру:
  ```rust
  pub struct GameProfile {
      pub window_title: &'static str,          // "Path of Exile" | "Path of Exile 2"
      pub trade_hosts: &'static [&'static str],
      pub item_first_lines: &'static [&'static str],
      pub copy_keys: &'static [u16],           // [CONTROL] | [CONTROL, MENU]
      pub copy_release_delay: Duration,        // 0 | 10 ms (EE2)
      pub panel_width_ratio: f64,
      pub browser_title: &'static str,
      pub legacy_shortcuts: Option<LegacyShortcuts>, // F-56, тільки PoE1
  }
  pub fn run(profile: GameProfile, ctx: tauri::Context) { ... }
  ```
  `src-tauri/src/lib.rs` кожного застосунку — ~10 рядків: `overlay_host::run(PROFILE, tauri::generate_context!())`.
- **Механізм доставки фіксу хоста в обидва застосунки:**
  1. Фікс комітиться в `price-of-exile/crates/overlay-host`, тести `cargo test -p overlay-host`; тег `host-v0.2.3`.
  2. PoE1 бере крейт за шляхом (`path = "../crates/overlay-host"`), тож отримує фікс одразу.
  3. PoE2: `overlay-host = { git = "https://github.com/ArtemNA/price-of-exile", tag = "host-v0.2.3" }` → підняти тег, `cargo update -p overlay-host`, реліз. CI тягне публічний git без секретів.
  4. Локальна розробка хоста з боку PoE2: `[patch."https://github.com/ArtemNA/price-of-exile"] overlay-host = { path = "../../poe-trade-overlay/crates/overlay-host" }` у `.cargo/config.toml` (не комітити) — зміни видно одразу, потім PR у PoE1-репо.
- **TS-оболонку не виносимо в пакет**: generic-частина ~1 000 рядків, а найбільші файли (price-check-panel, settings-window) різнитимуться. Перенесення — `git -C poe-trade-overlay format-patch -1 <sha> -- src/app/core scripts | git am -3` (працює, поки файли однакові); кожна знахідка в FINDINGS має тег «PoE1: так/ні» / «PoE2: так/ні». Переглянути рішення, якщо за 2–3 місяці спільних TS-правок стане багато (тоді — npm workspace `@artemna/overlay-shell` в репо PoE1, за тією ж схемою, що й крейт).
- **Порядок:** спершу параметризувати хост **у копії PoE2** (ризику для PoE1 немає), довести в грі, потім перенести вже перевірений крейт у репо PoE1 і перевести PoE1 на нього окремим релізом 0.1.9 з перевіркою в справжній грі (F-52). До цього моменту PoE2 тримає копію хоста.

### Чек-лист першого кроку

1. Власник обирає назву → identifier, productName, назва репо (§4).
2. Створити репо PoE2 (порожній, MIT), `.gitignore` з `_upstream/`, `.gitattributes` з `eol=lf` для `public/data/**` (F-07).
3. Скопіювати з еталона: `src-tauri/` (без `target`, `icons` — нові), `src/app/` (core, shared, settings/hotkey*, toast-window, stash-search, popup-window, apt-shims, constants), `scripts/`, `tests/` (інфраструктурні), `public/i18n/` (власні ключі), `.github/`, конфіги Angular/TS/Vitest/Tailwind, `LICENSE`, `THIRD_PARTY_LICENSES.md` (додати EE2).
4. Змінити все з §4 одним комітом, до першого `npm run dev`; згенерувати новий ключ updater (`tauri signer generate`), секрети в новому репо.
5. `src-tauri`: `GameProfile` (назва вікна, `Ctrl+Alt+C` + 10 мс, хости, перші рядки), прибрати `shortcuts.rs`.
6. Портувати EE2: `parser/`, `assets/data/` (+ `[port]` джерело даних), `filters/`, `trade/`, `trends/getDetailsId`, `map-check/common`; шими `TradeData`, `Prices` (мінімальний), `augment`, `Config` (EE2-поля). `UPSTREAM_COMMIT = cca3066…`.
7. Перевести `price-check` на `StatFilter[]` (без груп), прибрати `dustEquivalent`, `getPropQuality`, `makeIdentifiedUnique`, `prepareMapStat`; вимкнути map check / unidentified / poe.ninja до їх переписування.
8. Тести: перенести інфраструктурні (http, rate-limit, settings, window) зеленими; предметні — на PoE2-фікстурах з EE2 (`renderer/src/parser/*.test.ts`).
9. Записати в нові `docs/FINDINGS.md` розбіжності (у т. ч. UA-версію з §1.4 — з тегом «PoE1: так»).

---

## 4. Що обов'язково різне в кожному застосунку

| Що | PoE1 зараз (де) | PoE2 |
|---|---|---|
| Tauri `identifier` | `com.artemna.poe-trade-overlay` (`tauri.conf.json:5`) | новий, напр. `com.artemna.price-of-exile-2`. Від нього залежать `%APPDATA%`/`%LOCALAPPDATA%` (settings.json, EBWebView, логи) |
| Dev identifier (F-41) | `com.artemna.poe-trade-overlay.dev` (`tauri.dev.conf.json:4`), перевірка суфікса `DEV_IDENTIFIER_SUFFIX` (`constants.rs:17`, `constants.ts:275`) | `<новий>.dev` |
| `productName` | `Price of Exile` / `Price of Exile Dev` (`tauri.conf.json:3`, `tauri.dev.conf.json:3`) | нова назва; з неї — тека інсталяції, ярлики, tooltip трею (`tray.rs:57`), імена файлів релізу (`release.yml:59-67`) |
| Ім'я крейта / exe / npm | `price-of-exile` (`Cargo.toml:2`, `package.json:2`, `release.yml:67`, `frontendDist` `tauri.conf.json:7`) | нове |
| Updater `pubkey` | `tauri.conf.json:81` | **новий ключ**: інакше підписаний PoE1-ключем пакет PoE2 підійшов би PoE1 |
| Updater `endpoints` | `.../ArtemNA/price-of-exile/releases/latest/download/latest.json` (`tauri.conf.json:83-84`) | `.../<новий репо>/releases/latest/download/latest.json` |
| Секрети CI | `TAURI_SIGNING_PRIVATE_KEY[_PASSWORD]` | свої в новому репо |
| Посилання на репо в UI | `RELEASES_URL`, `releaseUrl` (`constants.ts:270-272`), `APP_CONTACT` (`:10`) | новий репо |
| README / Cargo / bundle | `README.md:3-4`, `Cargo.toml:4-7`, `tauri.conf.json:68-69` (`shortDescription`) | нові тексти |
| User-Agent | `PoeTradeOverlay/0.1.0 (+https://github.com/ArtemNA)` (`constants.ts:8-11`) | `<NewName>/<версія з getVersion()> (+<URL репо>)` |
| Ключі сховища | `SETTINGS_FILE`, `SETTINGS_STORE_KEY` (`constants.ts:243-245`) — розділяються identifier'ом; `LEGACY_SETTINGS_STORAGE_KEY = 'poe-trade-overlay.settings'` (`:241`) | legacy-ключ і міграцію v0 прибрати; `SETTINGS_VERSION` почати з 1 |
| Глобал сторінки браузера | `__poeTradeOverlayReplies` (`constants.rs:31`) | можна лишити (різні WebView-дані), краще перейменувати |
| Назви вікон | `"Price of Exile"`, `"… — popup"`, `"… — started"` (`tauri.conf.json:16,24,38`); `"pathofexile.com — Price of Exile"` (`browser.rs:70`) | з новою назвою; `browser.rs:70` — у `GameProfile` |
| Назва вікна гри | `"Path of Exile"` (`constants.rs:8`, `constants.ts:278`, `measure-popup.ps1:20`) | `"Path of Exile 2"` |
| Ярлики / старі exe | `SHORTCUT_FILE`, `OLD_SHORTCUT_FILE`, `OLD_EXE_FILE` (`constants.rs:47-49`) | немає (міграцію вимкнути) |
| Мітки трею | `Settings` / `Built-in browser` / `Quit` через i18n (`app.ts:41`), tooltip = productName | ті самі ключі; tooltip — нова назва |
| Іконки | `src-tauri/icons/*`, `public/favicon.ico`, `installerIcon` | нові (щоб відрізняти в треї й панелі задач, коли запущені обидва) |
| Хоткеї за замовчуванням | `DEFAULT_HOTKEYS` (`constants.ts:285`) | бажано інші типові, бо обидва застосунки можуть бути запущені разом: `RegisterHotKey` активний тільки поки гра на передньому плані (F-03), тож конфлікту немає, але перевірити |
