# Exiled Exchange 2 vs Awakened PoE Trade: аналіз для порту на Angular + Tauri

> Дата: 28.10.2026. Тільки читання коду, без збірки й без мережі.
> - EE2: `_upstream/ee2`, HEAD `cca30662` (06.09.2026, v0.16.3)
> - APT: `_upstream/apt`, HEAD `3188208` (25.09.2026). Саме цей коміт портував референсний проєкт (`poe-trade-overlay/src/lib/apt/UPSTREAM_COMMIT`)
> - Референс: `C:\Users\Artem\Documents\AI\poe-trade-overlay` (PLAN.md, розділ 3)
>
> **Як рахувались диффи.** EE2 переформатував увесь код Prettier'ом (подвійні лапки, `;`, інші переноси рядків), тому сирий `git diff apt/master HEAD` сильно перебільшує зміни. Приклад: `parser/` дає 4155+/2019− у сирому вигляді і 2246+/907− після нормалізації. Нормалізація: `.ts` файли обох репозиторіїв скопійовано в scratchpad і прогнано через один і той самий Prettier 3.9 з `.prettierrc` EE2, далі `git diff --no-index -w -M --stat`. Цифри для `.ts` нижче саме такі. `.vue` не нормалізувались, тож їхні цифри завищені.
>
> **Побічний ефект.** На прохання додано remote `apt` (`../apt`) у `.git/config` клону EE2 і виконано `git fetch apt` (локальний шлях, разом з тегами `v3.29.x`). Робоче дерево не змінювалось.

---

## 1. Відносини форку

| Факт | Доказ |
|---|---|
| Спільна історія є | `git merge-base HEAD apt/master` = **`73788f07`** (24.11.2024, «migrate renderer to npm, update deps…») |
| Відтоді APT зробив **201** коміт, EE2 — **760** | `git rev-list --count 73788f07..apt/master` / `..HEAD` |
| EE2 **жодного разу не мерджив** APT після розходження | усі 201 коміт APT недосяжні з HEAD EE2 (`rev-list 73788f07..apt/master --not HEAD` = 201). Останній merge «Kvan7/awakened-poe-trade» датований 10.12.2024 і всередині форку |
| Окремі зміни переносяться вручну, cherry-pick'ом | 5 комітів з автором Alexander Drozdov після MB: `d2ffa468` update regex length (06.2025), `456c5db5` refactor hotkeys (03.2026), `f5d2a614` fix results cached 6h #1878 (07.2026), `d72afb83` «fix for captcha, from upstream» (07.2026); ще `95c184a3` «Pull in possible linux workaround from APT» (06.2026) |
| Upstream у форку дзеркалиться | гілка `origin/awakened-upstream` = `ce551eb7` (09.09.2026) = APT master~1 |
| Загальна відстань | `git diff --stat apt/master HEAD`: **606 файлів, +247 209 / −79 430** (більшість — дані й форматування). `renderer/src` (`.ts` нормалізовано, `.vue` ні): 167 файлів, +18 924 / −8 802. Рядків TS+Vue у `renderer/src`: APT 18 177 → EE2 30 155 |
| Автори | kvan7/Kvan7 — 711 з 760 комітів (один мейнтейнер) |

**Висновок.** EE2 — жорсткий форк APT, зроблений у листопаді 2024 року. Код APT він не підтягує, лише зрідка cherry-pick'ає точкові фікси (rate limits, captcha, hotkeys, Linux). Для нас це означає, що `lib/apt` з референсу і майбутній `lib/ee2` — **два окремі upstream'и**. Синхронізація «APT → EE2» нічого не дасть, синхронізувати треба з EE2 напряму.

---

## 2. Модулі, які портував референс: що з ними в EE2

### 2.1 Зведена таблиця (рядки з сирих файлів; Δ для `.ts` нормалізована)

| Модуль (шлях APT) | Рядків APT → EE2 | Δ (норм.) | Еквівалент і суть змін в EE2 |
|---|---|---|---|
| `renderer/src/parser/*` | 2 476 → 4 125 | +2246 / −907, 3 нові файли | Той самий конвеєр `parsers[]`, але інший набір секцій (див. 2.2). Нові `augment-builder.ts` (116), `calc-base.ts` (290), `utils.ts` (10) |
| `renderer/src/assets/data/*` | 488 → 975 | +570 / −196 | Нові глобальні структури (`AUGMENT_DATA_BY_*`, `GROUPED_AUGMENTS`, `CATALYST_*`, `TRADE_*`) і fallback на живі дані trade-сайту (див. 2.3) |
| `price-check/filters/*.ts` + `pseudo/` | 3 221 → 4 148 | великий | Нові `create-unique-filters.ts`, `fill-augments.ts`, `common.ts`, `pseudo/missing-fractured-rules.ts`. Видалено PoE1 pseudo: `heist`, `mercenary`, `maps`, `flasks`, `timeless-jewel`, `utils` |
| `price-check/filters/*.vue` | 1 531 → 2 128 | — | Нові `FilterBtnDropdown`, `FilterModifierItemHasEmpty`, `FilterModifierItemIsElemental`, `ItemEditorButton`. Видалено `FilterGroup`, `FilterModifierLinks`, `FilterModifierOptions` |
| `price-check/trade/*.ts` | 1 497 → 2 990 | `pathofexile-trade.ts` переписано майже повністю | `/api/trade2/*`, нові `bulk-api.ts` (116), `trade-api.ts` (132) — composables, винесені з `.vue` |
| `price-check/trade/*.vue` | 984 → 1 821 | — | Нові `TradeItem`, `TooltipItem` (419), `ExtractionValue`. `OnlineFilterCore` злитий в `OnlineFilter` |
| `background/Prices.ts`, `Leagues.ts` | 337 → 877 (з `TradeData.ts`) | Prices +486, новий `TradeData.ts` 207 | poe.ninja **через власний проксі EE2** (див. 2.5); ліги з `/api/trade2/data/leagues` |
| `trends/`, `related-items/`, `expected-value/`, `unidentified-resolver/`, `price-prediction/` | 1 037 → 1 401 | `getDetailsId.ts` +105 | `expected-value/` прибрано: `DustValue` видалено (PoE1), `StackValue` перенесено в `stack-value/`. Інші модулі на місці. `poeprices.ts` лишився, але з `FIXME: if poeprices ever gets poe2 support` |
| `item-check/`, `map-check/` | 899 → 1 115 | `map-check/*.ts` дрібні (+4, +13) | Посилання на `poe2wiki.net`, `poe2db.tw`, `craftofexile.com/?game=poe2`. Нові дії `findSamePricedItems` (і `samePricedKey`), `hotkeyable-actions.ts` +157 |
| `stash-search/`, `settings/` | 1 159 → 1 768 | — | Нові вкладки `help.vue`, `general.vue` +254 (alphas, tips, readClientLog, hideOverlayOnBlur) |
| `main/src/shortcuts/*` | 481 → 613 | +65 | Див. розділ 4.2 |
| `main/src/proxy.ts` | 70 → 92 | +25 | Нові хости: `jp/de/es/br/fr.pathofexile.com`, `api.exiledexchange2.dev`; `try/catch` навколо `writeHead` |
| `main/src/windowing/*` | 361 → 487 | +120 | `hideOverlayOnBlur`, Linux DPI-скейлінг у `WidgetAreaTracker` |
| **нове:** `price-check/item-editor/` | 0 → 836 | — | Редактор рун, soul core і якості: `augment.ts`, `item-editor.ts` (чистий TS) + 5 `.vue` |

### 2.2 Парсер

**Секції (`const parsers`).** Видалено PoE1-специфіку: `parseFoulborn`, `parseVestigial`, `parseMapTier`, `parseVaalGem`, `parseAccessory`, `parseTincture`, `parseImbuedGem`, `parseHeistContract`, `parseChart`, `parseSplit`, `parseScryingOrb`, `parseMercenary`, `parseMercenaryGems×6`, віртуальні `augmentModifiers`, `calcDisenchantDust`.

Додано: `parseExceptional`, `parseRuneforged`, `parseRequirements`, `parseCaster`, `parseJewelery`, `parseCharmSlots`, `parseSpirit`, `parsePriceNote`, `parseTimelostRadius`, `parseWaystone`, `parseAugmentSockets`, `parseTrials`, `parseSanctified`, а також віртуальні `parseBlightedMap`, `applyAugmentSockets`, `applyElementalAdded`. Блоки модифікаторів тепер такі: `enchant, augment(rune), implicit, grantskill, explicit` (в APT: `enchant, scourge, implicit, explicit`).

**`ItemCategory` (`meta.ts`).** Нові значення: `Crossbow`, `Spear`, `Flail`, `Buckler`, `Focus`, `Talisman`, `Waystone`, `Relic`, `Tablet="TowerAugment"`, `MapFragment`, `Augment`, `Wombgift="BrequelFruit"`, `SkillGem`, `SupportGem`, `MetaGem`, `UncutGem="UncutSkillGem"`, `Unknown`. Перейменовано `"One-Handed Axe"` → `"One Hand Axe"` (так само для решти зброї). Видалено `Idol`, `Graft`, `Chart`, `MercenaryWarrant`, `ExpeditionLogbook`. Значення enum тепер збігаються з `craftable.category` у `items.ndjson`.

**`ModifierType` (`modifiers.ts`).** Додано `Augment="rune"`, `AddedAugment="added-rune"`, `Sanctum`, `Desecrated`, `Skill`.

**`ParsedItem`.** Додано `weaponFIRE/COLD/LIGHTNING/CHAOS/RELOAD/SPIRIT`, `armourRW` (Runic Ward замість `armourWARD`), `map*` для waystone (`mapPackSize`, `mapRevives`, `mapDropChance`, `mapMonsterRarity`, `mapEffectiveness`…), `augmentSockets {empty,current,normal,augments: EditorItem[]}`, `gemSockets`, `requires {level,str,dex,int}`, `unidentifiedTier`, `trials`, `isSanctified`, `note`, `qualityType`. Прибрано `heistContract`, `mercenary*`, `sockets/links`, `isSplit`, `isFoulborn`, `dustEquivalent`, `uniqueBase`, `memoryStrands`.

**`advanced-mod-desc.ts`.** `parseModInfoLine(line, type)` тепер отримує тип блоку ззовні. Префікси `Fractured / Desecrated / Crafted` розбираються як модифікатори заголовка (окрема гілка `type2` для іспанського порядку слів). `generation` розширено значеннями `"corrupted" | "eldritch" | "mutated"`. Суфікси рядків ` (rune)`, ` (added rune)`, ` (desecrated)`, ` (crafted)`, ` (fractured)`.

**Руни й аугменти.** `items.ndjson` містить `augment: [{categories[], string, values[], tradeId[], socketBound}]` для рун, soul core, idol тощо. `assets/data.loadUltraLateItems()` будує з цього індекси. `augment-builder.ts` будує `EditorItem` під категорію предмета, `Parser.applyAugmentSockets` + `item-editor/augment.useAugment` «вставляють» руни у вільні сокети (з `savedAugments` у конфігу), `calc-base.ts` перераховує AR/EV/ES/DPS. Фільтри доповнює `filters/fill-augments.ts`.

**Fallback на trade-дані.** Якщо мода або бази немає в `stats.ndjson` / `items.ndjson`, `stat-translations.ts` і `Parser.ts` / `magic-name.ts` питають `TRADE_STAT_BY_MATCH_STR` / `TRADE_ITEM_BY_REF`. Вони працюють на живих `/api/trade2/data/{stats,items}`, які завантажує `background/TradeData.ts`; у UI для цього є `fallback/ReloadTradeData.vue`.

**Мови в парсері.** `LANGUAGE_DETECTOR` визначає мову за `itemClassLine` або `rarityLine` (у неогранених гемів немає рядка «Item Class»). Мови: en, ru, fr, de, pt, es, th, ko, cmn-Hant, cmn-Hans, ja.

### 2.3 Формат даних (`assets/data/interfaces.ts`)

- `Stat`: прибрано `StatGroup` / резолвери, `modFamily`, `mercenary`, `jewelleryQuality`. `fromAreaMods` тепер `true`, а не enum; додано `fromUberAreaMods`, `fromHeistAreaMods`, `trade.count`, `matcher.oils`. У ndjson є поле `id` (внутрішній id гри, у 1 860 з 2 526 записів).
- `BaseType`: `namespace` без `AREA` / `MERCENARY_BUILD`; `area` → `map {screenshot,tier}`; прибрано `exchangeable`, `disenchantValue`, `armour.ward`; додано обов'язкове `tags: string[]` і `augment?: AugmentLineData[]`.
- `TranslationDict` (`client_strings.js`): прибрано ~40 ключів PoE1 (heist jobs, mercenary, foulborn, vestigial, eater/exarch, map quantity, `*_PREFIX`/`*_SUFFIX`). Додано ~60: `CRAFTED/FRACTURED/DESECRATED_MODIFIER`, `RUNIC_WARD`, `ITEM_EXCEPTIONAL`, `REQUIREMENTS`, `CHARM_SLOTS`, `BASE_SPIRIT`, 15 `*_TAG` (для каталізаторів), `WAYSTONE_*`, `TIMELESS_*`, `GRANTS_SKILL`, `RELOAD_SPEED`, `SANCTIFIED`, `LOG_LEVEL_UP`, `LOG_ZONE_GEN`, `TRIAL_COUNT`, `ULTIMATUM_*`, `UNIDENTIFIED` (став RegExp).
- Завантаження таке саме, як в APT: `fetch(BASE_URL+'data/<lang>/items.ndjson')` + `items-name.index.bin`, `items-ref.index.bin`, `stats-ref.index.bin`, `stats-matcher.index.bin`. Але індекси тепер генерує окремий скрипт `npm run make-index-files` (`src/assets/make-index-files.mjs`, у `.gitignore` стоїть `*.bin`), а Vite-плагін `vite-plugin-make-indexes.ts` видалено. `client_strings.js` завантажує `assets/client-string-loader.ts` через `import()`. Наш `// [port] DataSource` з референсу лягає сюди так само.

### 2.4 Trade-запити

| Аспект | APT | EE2 |
|---|---|---|
| Пошук | `POST {host}/api/trade/search/{league}` | `POST {host}/api/trade2/search/{league}` (`pathofexile-trade.ts:1272`) |
| Fetch | `/api/trade/fetch/{ids}?query=` | `/api/trade2/fetch/{ids}?query=` (`:1316`) |
| Bulk | `/api/trade/exchange/{league}` | `/api/trade2/exchange/{league}` (`pathofexile-bulk.ts:79`), тіло `{engine:"new", query:{status,have,want,minimum?}, sort:{have:"asc"}}` |
| Лінки на сайт | `/trade/search/{league}` | `/trade2/search/poe2/{league}`, `/trade2/exchange/poe2/{league}` |
| Ліги | `/api/leagues?realm=…` (у Leagues.ts APT) | `/api/trade2/data/leagues`. TODO повернутись до `/api/leagues?realm=poe2`; челендж-ліга вибирається як `result[2]` |
| Realm | `pc-ggg` / `pc-garena`, `useIntlSite` | `pc-ggg` / `pc-garena`; `useIntlSite` замінено на `preferredTradeSite: "default"\|"www"`. `cmn-Hant` → `pathofexile.tw` тільки для garena. Нові хости: ja → `jp.`, de → `de.`, es → `es.`, pt → `br.`, fr → `fr.pathofexile.com` |
| `status.option` | з `filters.trade.offline` | `filters.trade.listingType: "any"\|"online"\|"securable"\|"available"` (`"onlineleague"` тільки для bulk) |
| Нові фільтри запиту | — | `trade_filters.price.option` (валюта), `collapse`, `indexed`; `equipment_filters.{rune_sockets, spirit, reload_time, edps, …}`; `map_filters.{map_tier, map_revives, map_packsize, map_iir, map_gold, map_bonus, ultimatum_hint}`; `misc_filters.{unidentified_tier, sanctified, fractured_item, area_level}`; `req_filters.lvl` |
| Rate limit | `RateLimiter`, `common.ts` (Vue `shallowReactive`) | Ті самі файли, `RateLimiter.ts` майже 1:1 (−4 рядки). `Cache.purgeIfDifferentCurrency` (+7) |
| Ціна в лістингах | — | `requestResults` конвертує ціну через `usePoeninja().cachedCurrencyByQuery` → trade залежить від Prices |

### 2.5 poe.ninja і ціни

- `Prices.ts` (`usePoeninja`) **не ходить на poe.ninja напряму.** Він бере `api.exiledexchange2.dev/proxy/data/item-drop.json`, `…/proxy/data/namespaceMap.json` і `…/proxy/{league}/overviewData.json` (`Prices.ts:173–200`) — це сервер автора EE2. На poe.ninja ведуть тільки посилання для UI: `https://poe.ninja/poe2/economy/{league}/{url}/{detailsId}`.
- Базова валюта — exalted або chaos (`coreCurrency`), div як «велика»; функції `autoCurrency`, `addPrice`, `subtractPrice`, `comparePrice`; схема `NinjaDenseExchangeInfo` з `volumePrimaryValue`, `maxVolumeCurrency`.
- **Для нас:** або домовлятися з автором про використання його проксі (сторонній, неконтрольований сервіс), або писати власний адаптер до PoE2 API poe.ninja і самим формувати аналог `overviewData.json`. Формат `NinjaSchemaV1` описаний у `Prices.ts:9–60`.

### 2.6 Нова зв'язаність з Vue/Electron (потрібні нові shim'и)

| Ланцюжок імпорту | Що це означає для порту |
|---|---|
| `parser/Parser.ts`, `parser/magic-name.ts`, `parser/augment-builder.ts` → `@/web/Config` (`AppConfig().language`, `savedAugments`) | Парсер **більше не чистий**. Shim `web-config.ts` з референсу треба розширити (`language`, `price-check.savedAugments`) |
| `parser/Parser.ts` → `@/web/price-check/item-editor/augment` (чистий TS) | Копіювати разом з парсером |
| `assets/data/index.ts` → `@/web/background/TradeData` (`createGlobalState`, `shallowRef` з Vue / @vueuse) | Новий shim або `[port]`-переписування на signals |
| `trade/pathofexile-trade.ts` → `@/web/background/Prices` (`usePoeninja`, Vue + @vueuse) | Trade тягне за собою Prices. Prices треба портувати як сервіс із signals раніше за trade |
| `trade/bulk-api.ts`, `trade/trade-api.ts` → `vue` (`shallowRef`, `computed`, `shallowReactive`) | Переписати на signals (`[port]`) |
| `trade/common.ts`, `RateLimiter.ts`, `artificial-slowdown.ts` → `vue` | Як у референсі (вже є `[port]`-версії) |
| `filters/fill-augments.ts` → `@/web/Config`, `@/web/overlay/widgets` | Shim `overlay-interfaces.ts` розширити полями `PriceCheckWidget` EE2 (`coreCurrency`, `savedAugments`, `alwaysShowTier`, …) |
| `filters/*` більше **не** імпортують `background/Leagues` (`PERMANENT_SC`) | Shim `Leagues.ts` з референсу не потрібен |

**Runtime-залежності renderer.** Ті самі, що в APT (`neverthrow`, `@sindresorhus/fnv1a`, `luxon`, `dot-prop`, `object-hash`, `fastest-levenshtein`, `@vueuse/core`, `vue-i18n`, `apexcharts`…). Нові для порту: тільки `fast-deep-equal`; `@vueuse/core` тепер потрібен самій логіці (`createGlobalState`). Dev: `vitest` + `vitest-mock-extended`.

---

## 3. Дані гри

### 3.1 Де лежать і що є

`renderer/public/data/` (розкладка як в APT) + спільні `item-drop.json` (+ `.jsonc`-джерело), `patrons.json`, `remnants.json` (рецепти, у `src` не використовується; ймовірно для гілки `features/CvRemnants`).

| Мова | items | stats | Перекладено items / stats | Примітка |
|---|---|---|---|---|
| en | 4 063 | 2 526 | — | 223 stats мають matcher ≠ ref (варіанти формулювань) |
| ru | 4 063 | 2 524 | 4 052 / 2 523 | повна |
| de | 4 063 | 2 523 | 3 919 / 2 522 | повна |
| fr | 4 063 | 2 524 | 3 942 / 2 490 | ~34 стати не перекладено |
| es | 4 063 | 2 524 | 3 944 / 2 523 | повна |
| pt | 4 063 | 2 524 | 3 978 / 2 523 | повна |
| ja | 4 063 | 2 522 | 4 052 / 2 521 | повна |
| ko | 4 063 | 2 517 | 4 052 / 2 516 | повна |
| cmn-Hant | 4 063 | 2 431 | 4 052 / 2 431 | ~95 стат менше |
| th | — | — | — | тільки `app_i18n.json` (переклад UI, гра англійською) |

У кожній мовній папці лежать `app_i18n.json`, `client_strings.js`, `items.ndjson`, `stats.ndjson`. В APT мов 4 (en, ru, ko, cmn-Hant), там ~4 980 items і ~9 170 stats: APT включає всі стати гри, EE2 — тільки ті, що мапляться на trade-сайт.

**Формат.** Той самий ndjson (один JSON на рядок), але EE2 пише його Python'ом `json.dumps` (з пробілами після `:`), APT — компактно. Приклади:
```json
{"name": "Iron Rune", "refName": "Iron Rune", "namespace": "ITEM", "tags": ["rune","rune_normal"], "tradeTag": "iron-rune",
 "craftable": {"category": "SoulCore"}, "augment": [{"categories": ["Bow", …], "string": "#% increased Physical Damage",
 "values": [16], "tradeId": ["rune.stat_1509134228"], "socketBound": false}, …]}
{"ref": "# to # Fire Thorns damage per 100 maximum Life", "better": 1, "matchers": [{"string": "…"}],
 "trade": {"ids": {"explicit": ["explicit.stat_287294012"], "desecrated": ["desecrated.stat_287294012"]}}, "id": "thorns_maximum_fire_damage_per_100_life"}
```
Типи trade id в en stats: explicit 1 790, desecrated 738, fractured 588, rune 582, crafted 203, implicit 177, sanctum 164, skill 128, enchant 122, pseudo 36.

### 3.2 Конвеєр генерації (`dataParser/`, Python, ~4 600 рядків)

1. **Експорт з гри:** `providers/game_api.py` запускає `pathofexile-dat` (npm-пакет SnosMe) у `data/vendor` з `config.json`: `"steam": "C:\\…\\Path of Exile 2"`, 23 файли `StatDescriptions/*.csd`, 9 мов, таблиці `BaseItemTypes`, `ArmourTypes`… → `data/vendor/tables/*.json`, `data/vendor/files/*.csd`. **Потрібна локально встановлена PoE2 (Steam).** Наскільки мені відомо, `pathofexile-dat` вміє тягнути файли й з patch-CDN за версією (`"patch"` замість `"steam"`), але це треба перевірити.
2. **Trade API:** `providers/trade_api.py` через `cloudscraper` (з `interpreter="nodejs"`, тобто для обходу Cloudflare потрібен Node) качає `/api/trade2/data/{filters,stats,items,static}` для 9 локальних сайтів → `data/json/<lang>/*.json`.
3. **Збірка:** `services/nd_builder_service.py` (pandas) з'єднує trade stats (ref en + мова) з описами `.csd` → `stats.ndjson`; trade items/static + таблиці гри + `augment_builder.py` → `items.ndjson`; `client_strings_builder.py` за правилами з `constants/client_string_data.py` → `client_strings.js`. Іконки — `image_provider.py` (режими `noLookup|missing|new|all`, бере з trade search/fetch).
4. **Публікація:** `python src/main.py --pull --push --main-repo-path …` копіює файли в `renderer/public/data/<lang>/`. Далі `npm run make-index-files` генерує `.bin`.
5. `app_i18n.json` (UI) перекладається спільнотою: `crowdin.yml` + бейдж Weblate на translate.codeberg.org. `item-drop.json` пишеться вручну (`.jsonc`), але в рантаймі перекривається копією з `api.exiledexchange2.dev`.

**Стан у публічному репо.** README прямо каже, що розробка `dataParser` іде в **приватному** репо (`copymain.sh` rsync'ить звідти). Останній коміт у `dataParser/` датований 08.05.2026, а дані оновлювались 03.09 і 05.09.2026, тобто публічна копія може відставати. Залежності Python ніде не зафіксовані (`pyproject.toml` містить лише налаштування pytest): pandas, numpy, tqdm, cloudscraper, murmurhash2, requests. Тести є: `dataParser/tests/*.csd`.

**`versionCheck.py`** до даних стосунку не має: він лише звіряє версію застосунку в README, bug-report шаблоні, `docs/.vitepress/config.js`, `main/package.json` і lock-файлі. **Workflows:** `main.yml` (build + package на Windows, Ubuntu, macOS), `test.yml` (pre-commit, `make-index-files`, `vitest`), `pages.yml` (документація). Генерації даних у CI немає.

**Чи можемо запустити самі?** Технічно так: Python 3.12+ (використовується `typing.override`), Node (для `pathofexile-dat` і cloudscraper), PoE2 у Steam, ручне встановлення залежностей. Але ризики реальні: публічна версія відстає, конвеєр залежить від Cloudflare на trade-сайті. Практичніше повторити стратегію референсу: **синхронізувати готові `renderer/public/data/*` з EE2 за тегом**, а `dataParser` тримати як запасний варіант.

---

## 4. Функції та main-процес

### 4.1 Є в EE2, немає в APT

| Функція | Файли |
|---|---|
| Item editor: руни, soul core, idol, якість, «що буде з рунами» | `price-check/item-editor/*`, `parser/augment-builder.ts`, `calc-base.ts`, `filters/fill-augments.ts`; налаштування `autoFillEmptyRuneSockets`, `openItemEditorAbove`, `savedAugments` |
| Extraction value (прибутковість вилучення рун) | `trade/ExtractionValue.vue` |
| Tooltip предмета в лістингах | `trade/TooltipItem.vue`, `TradeItem.vue`, `itemHoverTooltip: off\|keybind\|always` |
| Сума цін і базова валюта exalted/chaos, обсяги торгів | `ui/ItemSumPrice.vue`, `CoreCurrencyImg.vue`, `coreCurrency`, `currencyVolume` |
| Fallback на живі trade-дані для невідомих модів і баз | `background/TradeData.ts`, `fallback/ReloadTradeData.vue` |
| XP tracker (за `Client.txt`, opt-in `readClientLog`) | `leveling/*`, `client-log/client-log-parser.ts` (308) |
| Notepad-віджет | `notepad/WidgetNotepad.vue` |
| Library (alpha): запис CSV з лога на диск | `library/*`, `main/src/host-files/FileWriter.ts` (192) |
| Підказки (tips) і вкладка Help | `help/*`, `settings/help.vue`, `tipsFrequency` |
| Нові фільтри | «має порожній афікс» (`FilterModifierItemHasEmpty`), «елементальна зброя» (`FilterModifierItemIsElemental`), Trials/Ultimatum, uncut gems, `unique`-пресети (`create-unique-filters.ts`) |
| Мови гри: ja, de, es, pt, fr (+ th тільки для UI) | `public/data/*`, `Config.language` |
| Налаштування | `hideOverlayOnBlur`, `overlayAlwaysClose`, `preferredTradeSite`, `rememberCurrency`, `rememberListingType`, `defaultAllSelected`, `alwaysShowTier`, `initialDelay` (затримка опитування буфера, 48 мс). `configVersion` 18 → 35 |
| Тести | `renderer/specs/` — 32 файли, ~120 `it/test` (Parser: advanced-mod-desc, augment, fractures, magic-name, map, skill gem, stat-translation; filters; trade). **Готовий корпус текстів предметів PoE2** (`specs/Parser/items.ts`, `mods.ts`) |

### 4.2 Немає в EE2 (прибрано або вимкнено)

PoE1-механіки в парсері й фільтрах (heist, mercenary, foulborn, vestigial, sockets/links, cluster-специфіка частково, timeless pseudo, dust/`DustValue`), `filter-generator` (видалений міграцією `configVersion < 26`), `merchantOnly` / `defaultCurrency` (замінені на `rememberCurrency`). poeprices фактично не працює (FIXME). Віджети Delve grid, image strip, timer, item search з OCR формально лишились у коді.

### 4.3 Main-процес (Electron), важливе для Rust-порту

| Що | APT | EE2 |
|---|---|---|
| Заголовок вікна гри | `"Path of Exile"` | `windowTitle: "Path of Exile 2"` (`Config.ts`) |
| Конфіг гри | `My Games\Path of Exile\production_Config.ini` | `My Games\Path of Exile 2\poe2_production_Config.ini` (Steam appid 2694490 для Proton) |
| Клавіша копіювання | 3.29: **примусово `Ctrl`** (`showModsKey = "Ctrl"`) → `Ctrl+C` | Рядок з примусом відсутній: `mergeTwoHotkeys("Ctrl + C", gameConfig.showModsKey)`, де `showModsKey` з `ACTION_KEYS.show_advanced_item_descriptions`, за замовчуванням `"Alt"` → **`Ctrl+Alt+C`** (advanced-копія з тирами й тегами) |
| Резервування клавіш | фіксований набір | + сама комбінація копіювання (`Ctrl+Alt+C`) як `test-only`, щоб її не можна було призначити |
| Відпускання модифікаторів | одразу після `C` | **через `setTimeout(…, 10)`** («Game was dropping the release inputs») |
| Розпізнавання тексту предмета в буфері | `startsWith("Item Class: ")` | `firstLine` **або** `uncutSkillGemLine` (`"Rarity: "` і локалізовані) — у неогранених гемів немає рядка Item Class; + ja |
| Затримка опитування буфера | `POLL_DELAY` 48 мс | налаштовувана `initialDelay` (IPC `update-host-config.initialDelay`) |
| Маркер «порожнього» буфера (KDE/Proton) | `__APT_FORCE_EMPTY_…` | `__EE2_FORCE_EMPTY_…` |
| Оверлей | — | `hideOverlayOnBlur`: ховати вікно, коли гра неактивна (`syncWindowVisibility`, подія `OVERLAY->MAIN::render-state`) |
| Client.txt | завжди | opt-in `readClientLog`, `re-parse-log`, шляхи `Path of Exile 2\logs\Client.txt` |
| Інше | — | macOS accessibility-prompt, Vue devtools у dev, логування `uncaughtException`, текст помилки адмін-прав «PoE2» |

`text-box.ts` (chat, stash search) — без змін по суті (+1 порожній рядок). Логіка PLAN.md §3 «Важливі деталі з `main/src/shortcuts`» лишається в силі з трьома поправками: **Ctrl+Alt+C**, **затримка 10 мс перед відпусканням**, **альтернативний перший рядок `Rarity:`**.

---

## 5. Ліцензії та AI_POLICY

- **Код EE2:** `LICENSE` — MIT, «Copyright (c) 2020 Alexander Drozdov» (файл не змінювався з першого коміту APT `31dfcfd5`). Окремого копірайту Kvan7 немає. Отже, перевикористання коду EE2 юридично таке саме, як APT: зберегти MIT-текст і атрибуцію (бажано додати «Exiled Exchange 2 contributors»).
- **Дані:** окремої ліцензії немає ні в `renderer/public/data`, ні в `dataParser`. Це похідні від файлів гри й trade API (власність GGG), MIT на них фактично не поширюється. Те саме зазначено в PLAN.md референсу, §8. `app_i18n.json` — переклади спільноти (Crowdin / Weblate) під ліцензією репо.
- **`AI_POLICY.md`** (додано 13.06.2026, коміт `7ee00559` «llms and agents can pound sand»), повний текст одним рядком: *«Maximum generally allowed is end of line completion. Please do not use agents or copy-paste blocks of code from llms.»* Це правило **для внесків у репозиторій EE2**, а не умова ліцензії: MIT не обмежує, як ми використовуємо код. Але наш порт робиться саме агентами, тому (а) у сам EE2 нічого не контрибутимо (PR, issues з AI-кодом), (б) у README чесно вказуємо джерело й MIT. Варто врахувати й репутаційний ризик у спільноті.
- **Сторонній сервіс:** `api.exiledexchange2.dev` — приватний проксі автора, умов використання не опубліковано. Без його згоди не підключати.

---

## 6. Оцінка порту (за зразком PLAN.md §3)

| Модуль EE2 | Рядків EE2 | Як переносимо | Зусилля |
|---|---|---|---|
| `parser/*` (+ `item-editor/augment.ts`, `item-editor.ts`) | 4 125 + 171 | Копія + `[port]`: прибрати / зашимити `AppConfig` (`language`, `savedAugments`). Тести беремо з `renderer/specs/Parser` | **середні** (в APT — низькі) |
| `assets/data/*` | 975 | Копія + `[port]`: `DataSource` як у референсі; `useTradeData` → сервіс із signals через shim | середні |
| `background/TradeData.ts` (нове) | 207 | Переписати як Angular-сервіс (signals); запити через `poeFetch` | низькі–середні |
| `filters/*.ts` + `pseudo/` | 4 148 | Копія 1:1, крім `fill-augments.ts` (shim Config / widgets) | низькі |
| `filters/*.vue` | 2 128 | Переписати на Angular (+ нові Dropdown, HasEmpty, IsElemental, ItemEditorButton) | **високі** |
| `item-editor/*.vue` (нове) | 665 | Переписати (AugmentEditor 336, QualityEditor 206…) | високі |
| `trade/*.ts` | 2 990 | Копія; `[port]` для `RateLimiter`, `common`, `artificial-slowdown` (є з референсу), а також `bulk-api.ts` і `trade-api.ts` (Vue → signals) | середні |
| `trade/*.vue` | 1 821 | Переписати (TradeListing, TradeBulk, TradeItem, TooltipItem, ExtractionValue, OnlineFilter…) | **високі** |
| `background/Prices.ts`, `Leagues.ts` | 670 | Сервіси з signals. **Prices — новий бекенд цін** (власний адаптер poe.ninja PoE2 замість `api.exiledexchange2.dev`) | **середні–високі / ризик** |
| `trends/`, `related-items/`, `stack-value/`, `unidentified-resolver/` | ~1 100 | `getDetailsId.ts` — копія; `.vue` переписати. `price-prediction` не беремо (poeprices без PoE2) | середні |
| `item-check/`, `map-check/` | 1 115 | `map-check/{common,prepare-map-stats}.ts` — копія; `hotkeyable-actions.ts` — копія + shim; UI на Angular | середні |
| `stash-search/`, `settings/` | 1 768 | UI переписати; конфіг спрощуємо (нові поля див. 4.1) | середні |
| `main/src/shortcuts/*` | 613 | Ідеї → Rust: Ctrl+`showModsKey`+C з `poe2_production_Config.ini`, затримка 10 мс, детектор `Rarity:` | середні |
| `main/src/proxy.ts` | 92 | `tauri-plugin-http` + cookies (ризик R1 з PLAN). Додати хости jp/de/es/br/fr | середні / ризик |
| `main/src/windowing/*` | 487 | Не переносимо (popup-модель); ідея `hideOverlayOnBlur` вже є в popup-моделі | — |
| Leveling, Notepad, Library, Tips | ~1 300 | Поза обсягом (за потреби — окремо) | — |
| Дані `public/data/*` | — | `sync-ee2.mjs` за тегом EE2 + свій `make-index-files` | низькі |

**Загалом.** Обсяг «чистої» TS-логіки зріс приблизно в 1,6 раза (parser + data + filters + trade: ~7,7 тис. → ~12,2 тис. сирих рядків, частину приросту дає форматування). Головне ускладнення порівняно з референсом: логіка більше не ізольована від Vue і Config. Ланцюжок `parser → Config`, `assets/data → TradeData`, `trade → Prices` вимагає портувати Config / Prices / TradeData як сервіси **до** копіювання парсера й trade. Друга велика частина — новий UI item editor. Третя — власне джерело цін poe.ninja.
