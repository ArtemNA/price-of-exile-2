# Тема «Exiled Exchange 2» для Price of Exile 2 — порівняння і план

Мета (етап 15, бриф [FEATURE_THEMES_PROMPT.md](../FEATURE_THEMES_PROMPT.md)): друга тема поруч із нашою —
вигляд Exiled Exchange 2 (EE2, форк APT для PoE2). Кольори, шрифти, заокруглення й `cursor: pointer` EE2 —
у всіх вікнах; налаштування, item check, map check, stash search і стартове повідомлення лишаються нашої
розкладки. **Price check — ідентичний EE2 і стилем, і розкладкою**: колонка 460 px на всю висоту гри біля
інвентаря / сховища (або по центру), related items збоку на прозорому ширшому вікні, ціни текстом. Тема дає
лише шаблон над нашою логікою (`Ee2PriceCheck extends PriceCheckPanel`).

Механізм беремо з Price of Exile 0.1.13 (`poe-trade-overlay`, коміти `8f0a8e1`, `b6dca92`, `f9379bd`,
`39bef98`, `9bc1804`, `3b4562b`, F-65), сам вигляд — з коду EE2 (`_upstream/ee2/renderer/src`, коміт
`cca30662`, EE2 0.16.3) і зі знімків EE2 (`docs/screenshots/ee2/`, `STYLE_NOTES.md` — їх саме знімає
інший агент).

## 0. Що EE2 змінив відносно APT (код)

Порівнювалось `_upstream/ee2/renderer/src` з `_upstream/apt/renderer/src` (APT 3.29.108) після
нормалізації лапок і переносів prettier.

**Не змінилось (тема APT лягає 1:1):**
- Палітра — та сама Tailwind v1 (gray-100…900 `#f7fafc`…`#1a202c`, red/orange/yellow/green/teal/blue/
  indigo/purple/pink ті самі). Шрифти — ті самі файли (`Fontin-SmallCaps`, `Fontin`, `Exo2`,
  `FrizQuadrataITC`, побайтно однакові, і однакові з `addons/apt-theme/fonts` PoE1). Глобальний CSS
  `App.vue` (скролбари, `.btn`, spin-кнопки) — без змін.
- `AppTitlebar.vue`, `UiCheckbox`, `UiErrorBox`, `StatRollSlider`, `ItemModifierText` (Exo 2 білим для
  чисел), `FilterBtnLogical/Numeric` (стиль), пресети Pseudo / Base item (стиль), `RelatedItems.vue`,
  `SourceInfo.vue`, `RateLimiterState.vue`, ширина колонки 28.75 rem = 460 px, панель related 24 rem,
  частка бічної панелі гри 986/1600 (`OverlayWindow.vue`) — як в APT.

**Нове в палітрі EE2** (`tailwind.config.js`): `fire #c80000`, `cold #5aadff`, `lightning #ffff00`,
`normal #c8c8c8`, `magic #8888ff`, `rare #ffff77`, `unique #af6025`, шкали `rose`, `fuchsia`, `slate`.

**Змінено в price check:**

| Місце | APT | EE2 |
|---|---|---|
| Заголовок (`PriceCheckWindow.vue`) | «⇄ N» — divine у chaos, підказка «0.1 div ⇒ N c» | divine в **основній валюті ліги** (`xchgRateCurrency`, у PoE2 зазвичай exalted): «⇄ 359», «0.1 div ⇒ 36 ex»; заголовок = ліга або «Exiled Exchange 2» |
| Помилка розбору | текст | текст з параметрами + кнопка «Reload trade data» (`fallback/ReloadTradeData.vue`) |
| `CheckedItem.vue` | poeprices, підказка про складність, DustValue, Patreon | без них; `StackValue` переїхав у `stack-value/`; випадкові поради `help/Tip.vue`; подяка лише poe.ninja; Trade-кнопка в `flex gap-1` |
| `PriceTrend.vue` | ціна + тренд + графік | **блок обсягу** зліва: «N [валюта] /hr», «N [предмет] /hr» (налаштування `volumeSetting`), під трендом «highest volume [валюта]»; запасний рядок «іконка → ?» лише для некрафтових баз |
| `ItemQuickPrice.vue` | іконка divine або chaos | divine / chaos / annul / **exalted**; `UiItemImg` з `404.png`, без стрілки за потреби |
| Чипи (`FiltersBlock.vue`) | linked sockets, map tier, foil reward, area level… | **Gem sockets**, Linked, Map tier, **Ascendancy points**, Area level, Heist wings, Sentinel, Blighted, **Magic / Normal** (лише показ), **discriminator**, Item level, **Requires level**, Stock, White sockets, **Augment (rune) sockets**, Gem level, Quality, influences, **Unidentified tier** (числовий) або Unidentified, Veiled, Foil, Mirrored, **Sanctified**, **Ultimatum hint**, «N of M, stats» |
| Праворуч від чипів | — | **кнопка редактора предмета** 32×32 (руна / порожнє гніздо / каталізатор, поповер `ItemEditorV2`) |
| Рядок стата (`FilterModifier.vue`) | 3.29: чекбокс і текст окремо, групи (`FilterGroup`), «міні»-фільтри, roll tags | старіша розкладка: одна кнопка «☐ текст», праворуч **іконка руни** (`showAugmentNotice`), «(Quality: 20%)» у рамці, min · max; другий рядок: 👁‍🗨 hidden, тег, тіри, **селектор «has empty modifier»**, **селектор «elemental DPS»**, слайдер, якщо є межі; без груп |
| Теги | crafted, enchant, scourge, foulborn… | нові: **rune** (blue-600), **added-rune** (смугастий синій), **desecrated** (green-900 / green-100), **mutated** (rose-900 / yellow-100), sanctum (рамка) |
| Тіри | tier-1, tier-2, not-tier-1, merc-gilded | tier-1 (yellow-500), tier-2 (рамка yellow-500), **tier-3-plus** (gray-700), not-tier-1 (+ чорна рамка) |
| Низ фільтрів | Collapse, Hidden, Mods | те саме; для мап і вейстоунів підпис «hidden explicit»; попередження «Unable to determine fractured stat»; невідомий мод з кнопкою «Reload trade data» |
| Лістинги (`TradeListing` + новий `TradeItem.vue`) | «4 alch», іконка сховища, «You» | ціна + **«(N ex)»** у основній валюті, «?» без нотатки, без іконки сховища; точка статусу: online **pink-400**, offline red-600, afk orange-500, rank-2 blue-600, rank-3 yellow-600; мітки **«in demand»** (yellow-500) і **«Gone»**; колонка **Gem sockets**; **підказка-предмет при наведенні** (`TooltipItem.vue`); блок **«likely price fixed»** з кнопкою «filter exalt/divine»; блок **ExtractionValue** «Σ [руна] − [екстрактор] = прибуток»; без «legacy bulk» плашки |
| Bulk (`TradeBulk.vue`) | кнопки chaos / divine, рядок Market Ratio | кнопки **exalted** / chaos / divine з лічильниками; **без Market Ratio**; кількості без округлення |
| Online-фільтр (`OnlineFilter.vue`) | Online / Offline, Merchant | кнопка «Instant / Online / Offline»; поповер: Instant or Online · Instant · Online · Offline; Listed (any…2 months); **ліги**; валюта any / exalted / chaos / divine / exalted+divine |
| Unidentified | іконка | те саме, `404.png`, якщо іконки немає |

**Інші вікна** (лишаються нашими, лише для довідки): `ItemInfo.vue` — назва на gray-900 по центру, кнопка
«$» (find by price), DPS сіткою; `MapCheck.vue` — без Maven-нагадування; налаштування — вкладка Help.

## 1. Що накладається легко

| Що | Як | Чому легко |
|---|---|---|
| Палітра | `addons/ee2-theme/theme.css` = палітра `addons/apt-theme/theme.css` (усі ~55 токенів тих самих значень) під `html[data-theme='ee2']` + токени для нового в EE2: `--color-rune #3182ce`, `--color-desecrated-bg #22543d`, `--color-mutated-bg #881337`, `--color-fire/cold/lightning`, рідкості `normal/magic/rare/unique #af6025` | EE2 не змінив жодного кольору APT, лише додав |
| Шрифти | `--font-sans` / `--font-display` → `FontinSmallCaps`, числа в модах — `Exo2` SemiBold, дати — системний sans; файли з `_upstream/ee2/renderer/src/assets/font` (= файли PoE1) | Два шрифтові токени в нас уже є |
| Заокруглення, курсор | `border-radius: 0.25rem` для кнопок / полів / select, `cursor: pointer` для клікабельного — правила з `apt-theme/theme.css` | Копія |
| Налаштування, toast, stash search, item check, map check | Наша розкладка + токени EE2 | Лише токени (після кроку 1) |
| Таблички рідкості (item / map check) | Зараз `RARITY_COLORS` у `constants.ts` — інлайн-градієнти. В EE2 назва на gray-900. Винести фон і лінію таблички в токени (`--plate-<rarity>-bg/rule`), колір тексту — у `--color-rarity-*` | Інакше бронзові градієнти лишаться в темі EE2 |
| Положення price check | Уже як в EE2/APT: «Opposite the cursor» біля панелі `висота × 986/1600` (той самий коефіцієнт у EE2), «Centre» | Готово в `popup.rs` |

## 2. Що потрібно в нашому коді спершу (порт механізму PoE1)

### 2.1 Токени замість захардкоджених кольорів (порт `8f0a8e1`, вигляд без змін)

110 входжень `*-[#…]` в 11 файлах (той самий набір файлів, що в PoE1):

| Файл | Входжень |
|---|---|
| `src/app/price-check/price-check-panel.html` | 45 |
| `src/app/settings/settings-window.html` | 30 (з них 8 × `accent-[#c9a15a]`) |
| `src/app/map-check/map-check-panel.ts` | 7 (класи позначок deadly / warning / good) |
| `src/app/map-check/map-mods-editor.html` | 6 |
| `src/app/popup-window/popup-window.html` | 6 |
| `src/app/item-check/item-check-panel.html` | 4 |
| `src/app/map-check/map-check-panel.html` | 3 |
| `src/app/map-check/map-mods-editor.ts` | 3 (`accent-[#d9a441/#d0503c/#6fbf73]`) |
| `src/app/price-check/unidentified-picker.ts` | 2 |
| `src/app/settings/hotkey-input.ts` | 2 |
| `src/app/stash-search/stash-panel.html` | 2 |

Плюс тіні з кольором: `shadow-[0_0_0_1px_#000]` (popup-window, toast-window), `shadow-[0_12px_30px_rgba(0,0,0,0.8)]`
(два меню в заголовку), `focus:shadow-[…rgba(201,161,90,0.25)]` у `num-input.ts` (це золото — потрібен
`--color-focus-ring`). І дані-кольори в `constants.ts`: `RARITY_COLORS` (див. §1), `CURRENCY_COLORS`
(крапки біля цін — у шаблоні EE2 не потрібні, можна лишити).

Усі 37 різних значень — ті самі, що були в PoE1, тож блок токенів `8f0a8e1` (`--color-selected`,
`--color-error-bg`, `--color-warn-bg/line`, `--color-row-line`, `--color-primary-from/to/text`, `--color-ink`,
`--color-deadly*`, `--color-menu`, `--color-bait-*`, `--color-unique`, `--color-positive*`,
`--color-corrupted-bg`, `--color-heist`, `--color-good-*`, `--color-tier1/2*`, `--color-fractured*`)
переноситься як є. Відмінності: у нас є `#2a2219` (11 разів) поруч із `#2a2218` (15) — обидва в
`--color-selected`; `text-[#c9a15a]`, `[#f0d48a]`, `[#d9a441]`, `[#6fbf73]`, `[#7a5f36]` — це вже наші
токени `gold`, `gold-soft`, `warn`, `good`, `bronze`. `--color-heist` у PoE2 — це мітка `HeistExclusive` у
map-mods-editor; назва лишається.

### 2.2 Реєстр тем і налаштування (порт `b6dca92` + `3b4562b`)

- `src/app/themes.ts` — інтерфейс `Theme` у фінальному вигляді PoE1: `id`, `label`, `priceCheck?`,
  `priceCheckSize?: { width, fullHeight }`, `unidentifiedPicker?` (`popupPosition?` не переносити — у 0.1.13
  тема вже не нав'язує положення). `BASE_THEME = { id: 'price-of-exile-2', label: 'Price of Exile 2' }`.
- `src/app/addons.ts` — `ADDON_THEMES = [EE2_THEME]`, `DEFAULT_THEME_ID = null`; конфігурація
  `ee2-default` в `angular.json` підміняє його на `addons/ee2-theme/addons.default.ts`.
- Налаштування `theme: string` (`''` = типова тема збірки). **Версію налаштувань не піднімати**:
  `upgradeSettings` уже дає нові поля зі значень за замовчуванням (`copyKey` так само), але треба додати
  перевірку: не рядок → `''` (як для `copyKey`). Тест у `tests/settings.test.ts`.
- `data-theme` на `<html>` — ефект в `App` (діє в усіх трьох вікнах: main, popup, toast).
- Settings → Overlay → Theme — кнопки над «Popup position» (як у PoE1), тексти `Theme` у `public/i18n/uk.json`,
  `ru.json`.
- `popup-window`: `NgComponentOutlet` для price check (`priceCheckView()`) і для picker теми (`themePicker()`
  з колбеком `pick`, бо `NgComponentOutlet` не зв'язує outputs).
- `PriceCheckPanel` (`price-check-panel.ts`): `popupSide` (signal), `themeWindowWidth(width)`, у
  `fitHeightToFilters` гілка `priceCheckSize.fullHeight` → `host.fitPopup(themeWindowWidth(460),
  PRICE_CHECK_FULL_HEIGHT).then(side => popupSide.set(side))`; `markChanged`, `runSearchSoon`,
  `toDivine`, `bulkPriced`, `fitListing` — з `private` у `protected` (шаблон теми ними користується).
  `PRICE_CHECK_FULL_HEIGHT = 100_000` у `constants.ts`.

### 2.3 Rust (`src-tauri`) — порт `9bc1804` + `3b4562b` на нашу копію

Наша `popup.rs` пішла від PoE1 до тем, тож порт не дослівний:
- `geometry(...)` у нас має ще параметр `panel_ratio` (PoE1 брав `POE_PANEL_WIDTH_RATIO` всередині) —
  гілку «повна висота» вставити, не чіпаючи його: `full_height = target == PriceCheck &&
  px(logical_height) >= game.height` → `height = game.height`, `y = game.y` (без `POPUP_MARGIN_LOGICAL` і
  `POPUP_TOP_RATIO`).
- `fit(...)` у нас нічого не повертає, а `fit_popup` у `lib.rs` (рядок ~207) — `fn ... { popup::fit(...) }`:
  обидва мають повертати `&'static str`; нова `pub fn side(game, cursor, target, centred)`.
- Назва боку: у нас `PopupPosition = 'center' | 'opposite-cursor'` (американське написання), у PoE1 —
  `'centre'`. Для `PopupSide` взяти `'left' | 'right' | 'center'`, щоб не мати двох написань в одному коді.
- `popup_centred` у нас виставляється в `lib.rs:119` з `popup_position != "opposite-cursor"` — так само, як
  у PoE1; правка в `settings-window.ts` з `themeById(...).popupPosition` не потрібна.
- Тести PoE1 (`side_of_the_popup`, `full_height_takes_the_whole_game`, `centred_is_centred`) — з додатковим
  аргументом `panel_ratio`.
- Прозорість: вікно `popup` у `tauri.conf.json` уже `transparent: true, shadow: false`, `html.popup` без
  фону — додаткових змін не треба. Клік у прозору частину — це клік у наше вікно (хук
  `clicked_outside_in_game` його не бачить), тож закриває сторінка (`backdropDown`), як у PoE1.
- `host.ts`: `fitPopup` → `invoke<PopupSide>`.

### 2.4 Збірка

`angular.json`: `addons/ee2-theme/theme.css` у `styles` після `src/styles.css`; конфігурація `ee2-default`
(лише `fileReplacements`); `tsconfig.app.json` `include` + `addons/**/*.ts` (і vitest, якщо там свій
`include`); `package.json` `build:ee2-default`. Релізний workflow (етап 13) не міняється — тема в кожній
збірці.

## 3. Price check EE2 блок за блоком

`Ee2PriceCheck extends PriceCheckPanel` з власним шаблоном, згори донизу (`PriceCheckWindow.vue` →
`CheckedItem.vue`). Основа — `addons/apt-theme/apt-price-check.*` PoE1, бо EE2 форкнув APT ще до груп і
«міні»-фільтрів 3.29, і рядок стата PoE1-теми вже збігається з EE2.

| # | Блок EE2 (компонент) | Наше джерело | Що робити |
|---|---|---|---|
| 1 | Заголовок 24 px: «⇄ 359» (divine в exalted), ліга по центру, ✕ (`AppTitlebar` + поповер) | `currencyRates.divine()` / наші курси (у нас «div = N ex · M c»), `Leagues` | `ee2-title-bar.ts` з `apt-title-bar.ts`: число й рядки «0.1 div ⇒ N ex» в exalted, а не chaos; клік по лізі — наше меню ліг (як у PoE1) |
| 2 | Помилка розбору: червона плашка + «Reload trade data» + сирий текст | `error()` панелі; помилки до панелі — у `popup-window` | Плашка — так; кнопку «Reload trade data» **не показувати** (у нас дані вбудовані, перезавантажувати нічого) |
| 3 | Назва (`FilterName`): кнопка «Category: Rings» / база (рамка gray-500, коли точна) і «Corrupted / Not corrupted» | `base()`, `setBase()`, `corrupted()`, `setCorruptedState()` | З PoE1 як є. Наш третій стан «any» в EE2 не показано — 2 стани, як у PoE1 |
| 4 | poe.ninja (`PriceTrend`): **обсяг /hr** зліва, «іконка → 5 × [валюта]» по центру, тренд ⌃⌃/⌄⌄ %, «Last 7 days», графік, «highest volume [валюта]» | `ninja()`, `ninjaValue()`, `trend`, `ninjaTraded()` (у нас лише «~N traded per hour» або «from N listings») | З PoE1 + новий блок обсягу: «N [предмет] /hr» з наших даних; «N [валюта] /hr» і «highest volume» — лише якщо `ninja-prices.ts` віддає `volumePrimaryValue` / `maxVolumeCurrency` (поля в типі вже є) — дописати це в логіку (мала зміна в `core`, не в темі). Іконки валют: exalted / chaos / divine / annul |
| 5 | Чипи (`FiltersBlock`) у порядку EE2 | `active().filters` (у нас той самий `ItemFilters` EE2: `socketNumber`, `augmentSockets`, `unidentifiedTier`, `sanctified`, `requires.level`, `ultimatumHint`, `discriminator`…) | `ee2Chips` з `aptChips`: порядок і набір EE2 (див. §0); `rarity` Magic/Normal — лише показ; influences у PoE2 не буває — прибрати разом із картинками |
| 6 | Кнопка редактора предмета (руни / каталізатори) 32×32 | **немає в нашій логіці** | Питання 1. Пропозиція: **не показувати** (це функція, а не вигляд) |
| 7 | Пресети Pseudo / Base item (вкладки з рамкою) | `presets()`; наш додатковий пресет «Mods» (`MODS_PRESET_ID`) | Як у PoE1: «Mods» у темі не показувати; джерела модів — перемикач «Mods» унизу |
| 8 | Рядки статів (`FilterModifier`): «☐ текст» · іконка руни · «(Quality: 20%)» · min max; під ним 👁‍🗨, тег, тіри, селектори, слайдер; при наведенні з «Mods» — джерела | `statView()`, `toggleStat`, `setRoll`, `rollValue`, `tier()`, `statTag()`, `sources()`, `hiddenReason()`, `emptyAffix()` | З PoE1 + нове EE2: теги rune / added-rune / desecrated / mutated / sanctum, тір `tier-3-plus`, іконка руни для статів руни (`/images/augments/rune.png`), слайдер не лише для унікальних (EE2 показує завжди, коли є межі); `showShortText` (грант навички — короткий текст) |
| 8a | — (у нас) групи статів з заголовками (Totals, Explicit…, F-54), «Σ Mods behind totals» | `statView().groups` | У темі — **плоский список** без заголовків, як EE2; Σ → перемикач «Mods» |
| 8b | — (у нас) перемикач «Fractured» на моді | `fracturedState()`, `toggleFractured()` | EE2 його не має, але це наша логіка пошуку: показати як **тег «fractured»** EE2 (yellow-400), клікабельний. Питання 2 |
| 8c | — (у нас) рядок «N unrevealed desecrated modifiers» | `group.unrevealed` | Звичайний рядок стата EE2 з тегом desecrated |
| 8d | «has empty modifier» (Empty affix / prefix / suffix) | `emptyAffix()`, `setEmptyAffix()` | Кнопки в стилі EE2 (`FilterModifierItemHasEmpty`) |
| 8e | «elemental DPS» селектор (`FilterModifierItemIsElemental`) | `item.elemental_dps` є серед внутрішніх trade id lib EE2 (`interfaces.ts`); чи наш вид фільтра дає його опції — перевірити | Якщо дає — показати; ні — пропустити |
| 9 | Unknown modifiers + «Reload trade data»; попередження «Unable to determine fractured stat» | `item().unknownModifiers`; умова EE2 (`isFractured` + Base item + немає fractured-моду) | Рядки — так, без кнопки Reload; попередження — обчислити в темі (3 рядки логіки) |
| 10 | Низ: «Collapse ⌃», «Hidden» / «Hidden explicit» (мапи, вейстоуни), «Mods» | `showHidden`, `showSources` | З PoE1 + підпис для вейстоунів |
| 11 | Search · Trade ↗ (до пошуку) | `runSearch()`, `openTradeSite()` | З PoE1 |
| 12 | Online-фільтр: «Instant / Online / Offline» + поповер (типи, Listed, ліги, валюта) | `setListingType`, `listingOptions()`, `setCurrency`, наш `listed`? | Типи й валюти в нас ті самі, що в EE2. **Listed (час)** у нас немає в UI, але lib EE2 його вже шле в запит (`pathofexile-trade.ts`, `filters.trade.listed`) — лише радіокнопки в шаблоні; ліги — наше меню ліг |
| 13 | Таблиця лістингів (`TradeItem`): «Price · [Stock] · [iLvl] · [Lvl] · [Gem sockets] · [Q] · Listed», ціна текстом «12 chaos (3.4 ex)», ×N, «?», точка статусу, «You», «in demand», «Gone»; 20 рядків смугами | `search.rows()` (рядки з lib EE2: `normalizedPrice`, `isInstantBuyout`, `inDemand`, `gemSockets`, `displayItem` вже є в типі) | З PoE1 (`TradeListing`) + стовпець Gem sockets, «(N ex)», мітки; **наші** зведення «cheapest / most listed» і колонки «≈ ex / ≈ c» **сховати** |
| 14 | Підказка-предмет при наведенні на лістинг (`TooltipItem`) | `row.displayItem` | Окремий підкрок (М): шаблон підказки EE2 (назва за рідкістю, моди, тіри S/P). Питання 3 |
| 15 | «Likely price fixed» + кнопка «filter exalt/divine» | **немає** | Обчислити в темі за правилом EE2 (`isLikelyPriceFixed` у `TradeListing.vue`), кнопка = `setCurrency('exalted_divine')` + пошук. Або не робити — питання 3 |
| 16 | ExtractionValue «Σ руни − екстрактор = прибуток» | **немає**; ціни рун і Extraction Orb є в poe.ninja | Питання 3; пропозиція — пізніше |
| 17 | Bulk (`TradeBulk`): кнопки exalted / chaos / divine з кількістю пропозицій, «Price · ex/bulk · Stock · Fulfill · Listed», без Market Ratio | `bulk.haves()`, `bulkLines()`, `bulkBest()` | З PoE1, кнопки з `bulk.haves()`; рядок `kind === 'ratio'` **не показувати**; приманки — логіка лишається (ховаємо, як у нашій темі), позначку «bait?» і примітку не показувати — питання 4 |
| 18 | StackValue «You have × 1 → … · Stack × 10 → …» (пунктирна рамка) | `youHave()` (у PoE1 — власний `stackValue`) | З PoE1, валюта exalted/divine за `autoCurrency` |
| 19 | Поради (`help/Tip`), подяка poe.ninja | — | Не робити (не наш вміст) |
| 20 | Related items поза колонкою, на прозорому тлі, бік до центру екрана | `related()`, `relatedGroup()`; у нас — у лівій колонці | Як у PoE1 (`9bc1804`, `3b4562b`): `relatedBeside`, `themeWindowWidth` (+384 px, по центру +2×384), `backdropDown` |
| 21 | Вкладка «Rate limiting» унизу | `RATE_LIMIT_RULES` lib EE2 | З PoE1 |
| — | Наші вкладки poe.ninja / Wiki, футер з підказками й лімітами, «Search again» | — | Сховати (в EE2 немає; poe.ninja відкривається кліком по тренду) |
| — | Попередження «скопійовано без деталей модів» (`noModDetails`) і «мова гри не та» | рендеряться в `popup-window` над панеллю | **Конфлікт**: у темі EE2 заголовок секції схований і вікно прозоре, тож `<p>` над колонкою ляже на всю ширину вікна. Передати їх у шаблон теми (input `warning`) і показати плашкою EE2 (`UiErrorBox`) усередині колонки |

Unidentified picker — `ee2-unidentified-picker.ts` з `apt-unidentified-picker.ts` (+ `404.png`).

## 4. Що переноситься з `addons/apt-theme`

| Файл PoE1 | У `addons/ee2-theme/` | Як |
|---|---|---|
| `theme.css` | `theme.css` | Правки: селектор `ee2`, нові токени EE2 (§1), селектор секції `app-ee2-*` |
| `theme.ts` | `theme.ts` | Правки: `EE2_THEME`, id `ee2`, label «Exiled Exchange 2» |
| `addons.default.ts` | `addons.default.ts` | Як є (інший імпорт) |
| `apt-price-check.ts` (573 рядки) | `ee2-price-check.ts` | ~70 % як є (назва, тренд, графік, слайдер, джерела, тіри, rate limits, related, online-фільтр); правки: чипи EE2, теги й тіри EE2, без influences / foulborn / merc, обсяг poe.ninja, exalted як основна валюта, `PopupSide 'center'`; нове: fractured-тег, unrevealed, price-fixed, попередження fractured, warning-input |
| `apt-price-check.html` (657) | `ee2-price-check.html` | ~60 % як є; переписати bulk (без ratio, 3 кнопки), лістинг (`TradeItem`), чипи, online-поповер, обсяг; нове: підказка-предмет (опційно) |
| `apt-price-check.css` (525) | `ee2-price-check.css` | ~85 % як є (класи `apt-*` → `ee2-*`); нове: теги rune / added-rune / desecrated / mutated / sanctum, `tier-3-plus`, статуси online pink-400 / rank-2 / rank-3, «in demand», «Gone»; видалити influences, stash-listing, market-ratio, dust |
| `apt-title-bar.ts` | `ee2-title-bar.ts` | Правки: exalted замість chaos |
| `apt-unidentified-picker.ts` | `ee2-unidentified-picker.ts` | Як є + `404.png` |
| `apt-icon.ts` (17 гліфів Font Awesome) | `ee2-icon.ts` | Як є + `question-circle`, `info-circle`, `minus`, `equals`, `check-circle`, `circle` |
| `images/` (influences, delve, incursion, veiled, stash, dust) | `images/` | **Не переносити**; нові з `_upstream/ee2/renderer/public/images`: `exa.png`, `annul.png`, `404.png`, `augments/rune.png`, `augments/empty-socket.png`, `extractor.png` (якщо робимо §3.16) |
| `fonts/` (3 файли) | `fonts/` | Як є (файли побайтно ті самі, що в EE2) |
| `LICENSE-awakened-poe-trade.txt`, README | `LICENSE-exiled-exchange-2.txt`, `README.md` | Нове: MIT EE2 (© Alexander Drozdov, форк Kvan7), шрифти — як у PoE1, FrizQuadrata не беремо |

Тека:

```
addons/ee2-theme/
  README.md                     credits, файли, як збирається
  LICENSE-exiled-exchange-2.txt
  theme.ts                      EE2_THEME (реєстрація)
  addons.default.ts             для конфігурації ee2-default
  theme.css                     токени, шрифти, заокруглення, cursor, секція без рамки
  ee2-price-check.ts/.html/.css Ee2PriceCheck extends PriceCheckPanel
  ee2-title-bar.ts
  ee2-unidentified-picker.ts
  ee2-icon.ts
  fonts/   Fontin-SmallCaps-Hinted.ttf, Fontin-Regular-Hinted.ttf, Exo2-SemiBold.ttf
  images/  exa.png, annul.png, 404.png, augments/rune.png, augments/empty-socket.png
```

## 5. Порядок робіт

| # | Крок | Розмір | Перевірка |
|---|---|---|---|
| 0 | Знімки EE2 на всі сценарії, `docs/screenshots/ee2/README.md`, `STYLE_NOTES.md` (інший агент) | — | Відповідність кожного знімка нашому стану |
| 1 | Токени замість 110 кольорів у 11 файлах, тіні, `--color-focus-ring`, таблички рідкості в токени | S, 2 год | Наша тема **без змін**: знімки нашої теми до / після на ті самі стани (`03-rare-ring-pseudo`, `05-bulk-rune`, `06-item-check-ring`, `07-map-check-corrupted`, `08-settings-copy-keys`, `09-stash-panel`, `11-unid-picker`, `13-installed-toast`) — попіксельно; `rg '\-\[#' src/app` порожній |
| 2 | Механізм: `themes.ts`, `addons.ts`, `theme` у налаштуваннях (без нової версії), `data-theme`, Overlay → Theme, `NgComponentOutlet` (price check, picker), `popupSide`, `themeWindowWidth`, повна висота; Rust `side` + `full_height` + тести; `host.fitPopup` → бік | M, 3–4 год | `cargo test`, `npm test`; наша тема без змін; перемикання теми одразу в усіх вікнах |
| 3 | Аддон-скелет: `theme.css`, шрифти, `theme.ts`, `angular.json`, `tsconfig`, `ee2-default`; поки що `Ee2PriceCheck` = наш шаблон | S, 1–2 год | Усі вікна в кольорах EE2: налаштування, item check, map check, stash search, toast — проти знімків EE2 тих самих станів (кольори піпеткою) |
| 4 | `Ee2PriceCheck`: заголовок, назва, poe.ninja + обсяг, чипи, пресети, рядки статів (теги, тіри, руни, fractured, unrevealed, empty affix), низ фільтрів, Search / Trade, online-фільтр, лістинги, bulk, stack value, rate limiting, picker, попередження в колонці | L, 1–1,5 дня | Кожен блок — проти знімка EE2 того самого предмета |
| 5 | Related поруч із колонкою, прозоре вікно, «по центру», клік у прозору частину закриває | S, 1–2 год (копія PoE1) | Exalted Orb з related ліворуч / праворуч / по центру |
| 6 | Опційні блоки EE2 за відповідями на питання: підказка-предмет, price fixed, extraction value, обсяг у валюті | M, 0,5 дня | Відповідні знімки EE2 |
| 7 | Порівняння стан за станом, доки не збігається на око; знімки нашої теми поруч (`docs/screenshots/ee2-theme-*.png`) | M, 0,5 дня | Див. нижче |
| 8 | `THEMING.md` (з PoE1, назви наші), README аддона, F-нотатка в `FINDINGS.md`, рядок у `CHANGELOG`, README знімків; збірки звичайна й `ee2-default`; фейкова гра | S, 2 год | `npm test`, `cargo test`, `npm run build`, `npm run build:ee2-default`; наші сценарії з `docs/GAME_SCENARIOS.md` на фейковій грі в обох темах |

Разом ≈ 3–4 робочі дні (PoE1 зробив те саме за день, але там APT 1:1, а тут ще PoE2-блоки EE2).

**Що звіряти зі знімками EE2** (імена — як у `docs/screenshots/ee2/README.md`; відповідники наших):
- рідкісне кільце: пресети Pseudo / Base item, теги й тіри, «N of M, stats», Collapse (`03-rare-ring-pseudo`),
  пошук із лістингами, «(N ex)», статуси (`03-rare-ring-search`, `14-ring-search`);
- арбалет / лук з рунами: Augment sockets, теги rune / added-rune, іконка руни, Q20 у рамці
  (`03-weapon-groups`, `12-uk-bow`);
- вейстоун: Map tier, «hidden explicit», desecrated / unrevealed (`03-waystone`, `03-waystone-search`);
- гем: Gem sockets / level / quality, колонки Lvl · Gem sockets · Q (`03-gem`);
- унікальний предмет: слайдер, без тегів explicit (`03-unique`), unidentified picker і вибір
  (`11-unid-picker`, `11-unid-picked`, `11-unid-single`);
- валюта: Exalted Orb — тренд, графік, обсяг /hr, related поруч, ⇄ у заголовку і його поповер
  (`04-exalted-orb`), руна (`04-rune`), bulk exalted / chaos / divine (`05-bulk-rune`, `05-bulk-exalted`,
  `05-bulk-divine`), stack value;
- online-поповер, rate limiting, помилка розбору;
- положення: інвентар (праворуч), сховище (ліворуч), «Centre», повна висота гри;
- інші вікна в кольорах EE2 при нашій розкладці: item check (`06-*`), map check (`07-*`), налаштування
  (`08-*`, `13-second-start-settings`), stash panel (`09-stash-panel`), toast (`13-installed-toast`),
  попередження (`14-copied-without-mod-details`, `12-ru-language-mismatch`);
- кирилиця: `12-ru-ring`, `12-uk-waystone` (Alegreya SC замість FrizQuadrata — свідома відмінність).

## 6. Ризики

1. **Логіки, якої в нас немає.** Редактор предмета (руни, каталізатори), «likely price fixed»,
   ExtractionValue, підказка-предмет, обсяг у валюті. Бриф: тема дає лише шаблон. Без них price check не буде
   «ідентичним» буквально — треба рішення власника (питання 1, 3).
2. **Наші функції, яких EE2 не має** (вкладки poe.ninja / Wiki, зведення cheapest / most listed, колонки
   «≈ ex / ≈ c», групи статів, Σ, перемикач Fractured, приманки bulk, третій стан Corrupted, футер із
   підказками). Ховаємо в темі EE2 — частина користі нашої логіки в цій темі не видна.
3. **Попередження поза панеллю** (`noModDetails`, мова гри) у прозорому вікні — див. §3, останній рядок.
4. **Rust не дослівно з PoE1** (`panel_ratio`, `center`/`centre`) — легко зламати «по центру» або вейстоун /
   item check, які теж ідуть через `geometry`. Тести на всі три цілі.
5. **Повна висота** = клієнтська область гри; у вікні з рамкою й на другому моніторі з іншим масштабом
   (F-51) — перевірити.
6. **Прозора частина вікна** перехоплює кліки в гру (закриває popup, як в APT/EE2) — очікувано, але варто
   сказати в THEMING.md.
7. **Кирилиця**: FrizQuadrata комерційний; російська гра в нас підтримана, тож різниця з EE2 помітна саме
   там (Alegreya SC).
8. **Знімки ще не готові**: план посилається на сценарії за назвою; якщо якийсь стан EE2 не вдасться зняти
   (наприклад, price fixed чи extraction рідкісні), звіряємо з кодом EE2.
9. **Вендорований lib EE2** (`src/lib/ee2`, той самий коміт `cca30662`) — дані для більшості нових блоків
   (`augmentSockets`, `displayItem`, `inDemand`, `normalizedPrice`, ключі i18n `tag_rune`, `tag_desecrated`,
   `likely_price_fixed`, `highest_volume`, `hidden_explicit_toggle`) уже є; оновлення EE2 пізніше може
   розійтися з шаблоном теми.

## 7. Питання до власника

1. Редактор предмета EE2 (кнопка з руною біля чипів): не показувати в темі (пропоную) чи робити як нову
   функцію для обох тем?
2. Перемикач «Fractured» на моді (наш): показати як тег EE2, що клікається (пропоную), чи сховати?
3. Блоки EE2 без нашої логіки — підказка-предмет при наведенні, «likely price fixed», ExtractionValue,
   обсяг у валюті /hr: робити в цьому етапі (крок 6) чи пізніше?
4. Bulk: приманки далі ховати мовчки (як EE2, без позначки) чи лишити рядок «N offers hidden as bait»?
5. Наші вкладки poe.ninja / Wiki і зведення cheapest / most listed у темі EE2 — сховати повністю (як EE2)?
6. Ліга: в EE2 вона ще й у online-поповері (радіокнопки). Лишити лише меню в заголовку, як у PoE1?

### Рішення власника (30.10.2026)
1. Редактор предмета — у темі не показувати.
2. «Fractured» — клікабельний тег EE2 «fractured».
3. Підказка-предмет, ExtractionValue, обсяг /hr — «Пізніше»; «likely price fixed» — у цьому етапі.
4. Приманки в bulk — ховати мовчки, як EE2.
5. Вкладки poe.ninja / Wiki, cheapest / most listed, «≈ ex / ≈ c» — у темі EE2 сховати; ціна й тренд poe.ninja — у шапці.
6. Ліга — лише меню в заголовку, як у PoE1.
