# Price of Exile 2 — аналіз (фаза 1)

> Стан на 28.10.2026. Основа: [Exiled Exchange 2](https://github.com/Kvan7/Exiled-Exchange-2) (EE2) `cca30662` (06.09.2026), [Awakened PoE Trade](https://github.com/SnosMe/awakened-poe-trade) (APT) `3188208` (той самий коміт, що портував еталон), еталон — [Price of Exile](https://github.com/ArtemNA/price-of-exile) 0.1.8.
> Обидві бази склоновано в `_upstream/` (поза git) з `core.autocrlf=false`.
> Коду ще немає. Наступний крок — `PLAN.md` на затвердження.

Детальні звіти, на яких стоїть цей документ:

| Звіт | Про що |
|---|---|
| [analysis/ee2-vs-apt.md](analysis/ee2-vs-apt.md) | Форк EE2 від APT: модулі, парсер, дані, trade, poe.ninja, main-процес, ліцензії, оцінка порту |
| [analysis/poe2-services.md](analysis/poe2-services.md) | trade2 API, ліги, ліміти, Cloudflare, bulk, poe.ninja PoE2, wiki / PoE2DB / CoE, мовні сайти, політика GGG |
| [analysis/poe2-items-features.md](analysis/poe2-items-features.md) | Формат копіювання PoE2, категорії предметів, нові фільтри, функції еталона → PoE2, зміни дизайну A+B |
| [analysis/code-reuse.md](analysis/code-reuse.md) | Що з власного коду еталона переходить, стик з EE2, стратегія репозиторію |

Позначки в звітах: перевірено кодом EE2, живою відповіддю чи документацією, або «виведено» (inferred). Живих запитів було 6 (GET; жодного пошуку на trade). Відповіді збережено в [tests/fixtures/](../tests/fixtures/).

---

## 1. Коротко

1. **EE2 — окремий upstream, а не «APT + PoE2».** Спільний предок з APT — `73788f07` (24.11.2024). Відтоді в APT 201 коміт, в EE2 760, і EE2 жодного разу не мерджив APT. Синхронізуємося з EE2 напряму, `UPSTREAM_COMMIT` = коміт EE2.
2. **Ліцензія — MIT** (той самий текст, © 2020 Alexander Drozdov). `AI_POLICY.md` EE2 забороняє AI-код **у внесках до EE2**; на використання коду за MIT це не впливає. Висновок: не надсилати в EE2 PR з AI-кодом; джерело чесно вказати в `THIRD_PARTY_LICENSES.md`.
3. **Логіка EE2 менш ізольована, ніж в APT.** Парсер імпортує `@/web/Config`, дані — `TradeData`, trade — `usePoeninja`. Config, TradeData і Prices треба зробити сервісами на signals (shim'ами) **до** копіювання парсера й trade. TS-логіки в ~1,6 раза більше.
4. **Головний ризик для перевикористання нашого UI:** API, на яких стоїть дизайн A+B, з'явились в APT **після** форку EE2. 13 із ~30 використовуваних `src/app` API змінились або зникли; зокрема немає `FilterGroup` / `FilterOrGroup` (групи модів), `makeIdentifiedUnique`, `getPropQuality`. `ParsedItem` інший (руни, вейстоуни, `requires`, без `sockets/links`, `influences`, `dustEquivalent`).
5. **Trade:** `/api/trade2/{search,fetch,exchange}/<league>`, сторінки `/trade2/{search,exchange}/poe2/<league>`, ліги — `/api/trade2/data/leagues` (`/api/leagues?realm=poe2` повертає ліги PoE1). Ліміти — ті самі заголовки `X-Rate-Limit-*`. Bulk exchange існує.
6. **poe.ninja: EE2 не ходить на poe.ninja.** Ціни йдуть із приватного проксі автора EE2 (`api.exiledexchange2.dev`). Офіційний API PoE2 є, але без «dense» ендпоінта: повне оновлення — ~23 запити на лігу, ціни в divine. poe.ninja радить десктоп-застосункам ходити через власний бекенд. **Це рішення власника** (розділ 7).
7. **Копіювання предмета:** розширений текст дає **Ctrl+Alt+C** (Ctrl + «show advanced item descriptions» з `poe2_production_Config.ini` + C); звичайний Ctrl+C у PoE2 — без заголовків модів. Формат заголовків той самий (`{ Prefix Modifier "Name" (Tier: N) — Tags }`), тож тіри T1/T2 лишаються.
8. **Дані гри** — `renderer/public/data/<lang>/`, той самий формат ndjson. Повні дані для 9 мов (en, ru, de, fr, es, pt, ja, ko, cmn-Hant), th — лише UI. Генератор є (`dataParser/`, Python, читає файли гри зі Steam + trade2 data), але не відтворюваний (не зафіксовані залежності, публічна копія відстає). Як і в еталоні — беремо готові дані з EE2 за комітом.
9. **Гра зараз — 0.5 «Return of the Ancients»**, ліги Runes of Aldur і Forbidden Rites (до ~11.12). **1.0 оголошено на 11.12.2026** — дані й, можливо, формат зміняться саме посеред нашої розробки (ризик R-1).
10. **Код еталона:** Rust-хост (~2 660 рядків) переходить на ~90 % як є; Angular (~5 300) — 18 % як є, 63 % з правками, 19 % переписати. Рекомендація — **новий репо з копією модулів + у майбутньому спільний Rust-крейт хоста** (розділ 6).

---

## 2. EE2 проти APT

Деталі — [ee2-vs-apt.md](analysis/ee2-vs-apt.md). Головне для порту:

| Модуль | Що змінив EE2 | Як переносимо |
|---|---|---|
| `parser/` (4 125 + 171 рядків) | +2 246 / −907 після нормалізації Prettier. Нові `augment-builder.ts`, `calc-base.ts`, `item-editor/`. `ItemCategory`, `ModifierType`, секції, `TranslationDict` під PoE2: руни, waystone, gems із сокетами, `requires`, `unidentifiedTier`, `isSanctified`, `trials`. Прибрано heist, mercenary, links, influences, dust, foulborn | Копія + `[port]` (shim Config), **середні** зусилля (в еталоні були низькі). Тести — з `renderer/specs/Parser` EE2 (~120 тестів) |
| `assets/data/` | Той самий ndjson; у items нові поля `augment`, `tags`. stats ~2 520 (APT ~9 170: EE2 бере лише стати trade-сайту). Залежить від `TradeData` | Копія + `[port]` `DataSource`, як F-09 |
| `filters/*.ts` + `pseudo/` | Нові фільтри: руни / сокети, spirit, reload, waystone, gem level (uncut ±1), unidentified tier, sanctified, Runic Ward. Pseudo коротший | Копія 1:1 (крім `fill-augments.ts`) |
| `trade/*.ts` | `trade2`, `listingType` (Instant / Instant or Online / Online / Any) замість online-статусу, нові `equipment_filters` / `map_filters` / `misc_filters`. Realm `pc-ggg` / `pc-garena` | Копія; `[port]` для Vue-реактивності (як F-14) |
| `background/Prices.ts`, `Leagues.ts`, `TradeData.ts` (новий) | Prices — проксі EE2; Leagues — trade2 | **Свій адаптер poe.ninja PoE2**, Leagues і TradeData — сервіси |
| UI (`*.vue`) | Нові item editor (руни / soul cores), Extraction value, тултип предмета в лістингах | Переписуємо на Angular у дизайні A+B |
| `main/src/shortcuts` | Ctrl+`showModsKey`+C з конфігу гри, відпускання модифікаторів із затримкою 10 мс, текст може починатися з `Rarity:` (uncut gems без `Item Class:`), вікно «Path of Exile 2», `hideOverlayOnBlur`, `initialDelay` опитування буфера | Ідеї → Rust |
| Нове в EE2 поза обсягом | XP tracker, notepad, library (alpha), tips | Не беремо (можна пізніше) |

---

## 3. Сервіси PoE2

Деталі — [poe2-services.md](analysis/poe2-services.md).

| Що | PoE2 | Відмінність від еталона |
|---|---|---|
| Пошук / лістинги | `POST /api/trade2/search/<league>`, `GET /api/trade2/fetch/...` | лише шляхи й поля запиту |
| Bulk | `POST /api/trade2/exchange/<league>` (`engine: "new"`) | EE2 використовує; приманки (F-26) імовірно ті самі |
| Currency Exchange гри | API GGG дає лише погодинну історію, потребує OAuth, нові застосунки не реєструють | не використовуємо |
| Ліги | `/api/trade2/data/leagues`: Forbidden Rites, HC Forbidden Rites, Runes of Aldur, HC Runes of Aldur, Standard, Hardcore | постійні — `Standard` / `Hardcore`; челендж-лігу вибирати не за індексом (EE2 бере `result[2]`) |
| Ліміти | ті самі `X-Rate-Limit-*`; відповідь ліг прийшла з кешу Cloudflare без них | F-51 переноситься; відсутність заголовків — норма |
| Cloudflare | сторінка `/trade2` віддала curl'у 403 `cf-mitigated: challenge` | вбудований браузер (F-45) потрібен так само або більше |
| Валюти | головна — **divine**; дрібних торгових **дві**, exalted і chaos, обидві ходять паралельно (poe.ninja дає курси `rates: {exalted, chaos}` до divine; EE2 має перемикач `coreCurrency`) | у заголовку — divine в обох: «1 div = N ex · M c»; «≈» у лістингах — у валюті, яку обрав користувач (exalted або chaos) |
| poe.ninja | `/poe2/api/economy/{leagues, exchange/current/overview (14 типів), stash/current/item/overview (9 типів)}`, ціни в divine, `sparkline` / `sparkLine` (7-денна накопичена зміна, як F-34), ETag, оновлення ~щогодини | немає dense: 23 запити; викиди → фільтр за кількістю лістингів |
| Wiki / PoEDB / CoE | `poe2wiki.net/wiki/<refName>`, `poe2db.tw/<us,ru,tw,kr,jp,de,sp,pt,fr>/...`, `craftofexile.com/?game=poe2&eimport=<текст>` | лише URL |
| ML-ціни | немає (poeprices закритий) | — |
| Мовні сайти | ru., jp., de., es., br., fr.pathofexile.com, poe.kakaogames.com, pathofexile.tw | у еталоні був лише ru (F-60) |
| Політика GGG | User-Agent із контактом; trade2 не описаний в офіційному API — сіра зона, як і для всіх інструментів | так само, як в еталоні |

---

## 4. Предмети PoE2 і функції

Деталі — [poe2-items-features.md](analysis/poe2-items-features.md); 22 тексти предметів — у [tests/fixtures/items/](../tests/fixtures/items/) (18 дослівно з тестів EE2, 4 реконструйовані й позначені).

**Формат тексту.** Один рядок вимог (`Requires: Level 79, 89 (unmet) Str, 89 Dex`); сокети — `Sockets: S S` (руни, без лінків і кольорів); хвости рядків `(rune)`, `(added rune)`, `(enchant)`, `(desecrated)`, `(fractured)`; окремі секції `Grants Skill:`, `Sanctified`, `Unidentified (Tier N)`, `Twice Corrupted`, `Fractured Item`. Мета-гем з панелі навичок копіюється без `Item Class:`.

**Чого в PoE2 немає** (за даними EE2 0.5): influences, eldritch implicits, synthesised, heist, divination cards, links, Maven, blight, cluster jewels. «Veiled» в EE2 тепер — нерозкритий desecrated-мод.

**Нове для UI:** руни / soul cores / idols / abyssal eyes, uncut gems, waystones (тір у назві бази, revives, pack size, drop chance) і tablets, relics, charms, нові класи зброї, omens, essences, liquid emotions, catalysts, Trials, logbook.

**Функції еталона → PoE2:**

| Функція еталона | PoE2 |
|---|---|
| Price check | trade2; групи: без Eldritch, нові Rune, Enchant, Skill, Desecrated, Mutated; «Sockets ≥ N» замість «Links ≥ 6»; чипи Waystone tier, Gem level, Unid tier, Spirit, Sanctified; онлайн-фільтр у 4 стани |
| Bulk | trade2 exchange; оптимістичний пошук за divine і дрібною валютою (exalted або chaos), як F-30 |
| poe.ninja + related items | свій адаптер; related — `item-drop.jsonc` EE2 (116 груп); dust прибрано |
| Item check | poe2wiki / PoE2DB / CoE `game=poe2`; Find in Stash |
| Map check | для waystones (і logbook): тір, revives, pack size, drop chance, rarity; без скриншота локації й Maven; tablets — item check |
| Stash search | дефолтні пресети EE2 (Map rolling: `"Increased Pack Size"`, `"Additional Packs"`…; Dump sorting: `Currency`, `"Waystone Tier"`, `Trials:`…) |
| Chat-команди | дефолти EE2 = APT (`/hideout`, `/exit`, `@last`…) |
| Unidentified uniques | механізм є в EE2, API інший |
| Item editor (руни), Extraction value | **нове** з EE2 |
| Вбудований браузер | так само |
| Мови інтерфейсу | uk, ru — наші словники + `app_i18n.json` EE2 |
| Мови гри | 9 (дані EE2 є для всіх) |

---

## 5. 60 знахідок еталона для PoE2

Еталон має 42 «так», 17 «перевірити» і 1 «ні» (не 41 / 17 / 2, як у брифі: F-56 позначено «так, якщо форк змінить `productName`»).
Позначка «відповідь» — з цього аналізу; «ще перевірити» — потрібна гра або живий запит, вирішується на відповідному етапі.

| № | Тема | Еталон | Висновок для PoE2 |
|---|---|---|---|
| F-01 | Esc через LL-хук | так | Тримається (хост той самий) |
| F-02 | Popup `NOACTIVATE` + WebView2 | так | Тримається |
| F-03 | `RegisterHotKey` з головного потоку | так | Тримається |
| F-04 | `POE_GAME_TITLE`, `POE_KEEP_POPUP` | так | Тримається; вікно гри — `Path of Exile 2` |
| F-05 | Системні вікна забирають фокус | так | Тримається (відкрите питання те саме) |
| F-06 | Розширений формат копіювання | перевірити | **Відповідь:** Ctrl+Alt+C (Ctrl + клавіша «advanced descriptions» з `poe2_production_Config.ini` + C); звичайний Ctrl+C — без заголовків. Заголовки й тіри як у 3.29; маркери типу мода — хвостами рядка (`(rune)`, `(enchant)`, `(desecrated)`, `(fractured)`). Rust: інша комбінація, затримка 10 мс перед C, текст може починатися з `Rarity:` |
| F-07 | Індекси даних, LF | так / перевірити | **Відповідь:** дані з EE2 `renderer/public/data/<lang>/` за комітом; генератор EE2 не відтворюваний. LF — `.gitattributes` уже є. Додатково `item-drop.jsonc` (JSONC) |
| F-08 | `paths` у tsconfig, код upstream без змін | так | Тримається, але shim'ів більше (Config, TradeData, Prices, augment) |
| F-09 | Підключуване джерело даних | так | Тримається |
| F-10 | Vitest напряму | так | Тримається; плюс ~120 тестів EE2 з корпусом PoE2-предметів |
| F-11 | `+` у фільтрах, назва rare з `rawText` | перевірити | **Відповідь (з коду, не з гри):** matcher EE2 так само без знака; назва — так само з першої секції |
| F-12 | `Origin` не заважає API | перевірити | **Ще перевірити:** проксі EE2 прибирає `Origin`; trade2 POST живцем не пробували. Перший живий пошук етапу 2 |
| F-13 | Запити з Rust без cookies | так | Тримається |
| F-14 | Shim'и замість конфігу APT | так | Тримається, обсяг більший (див. F-08) |
| F-15 | Синхронізація налаштувань між вікнами | так | Тримається (у еталоні вже `settings-changed`, F-40) |
| F-16 | Ліги | перевірити | **Відповідь:** `/api/trade2/data/leagues`, 6 ліг, `Standard` / `Hardcore` + 2 челендж-ліги з HC; `/api/leagues?realm=poe2` не підходить. Фікстура — `tests/fixtures/` |
| F-17 | Статичні значення в одному місці | так | Тримається |
| F-18 | Структура папок як upstream | так | Тримається (`src/lib/ee2/web/...`) |
| F-19 | `t()` над `app_i18n.json` | так | Тримається; `app_i18n.json` EE2 є для 10 мов |
| F-20 | `revision`-сигнал на мутабельні фільтри | так | Тримається |
| F-21 | Колесо миші замість клавіатури | так | Тримається (вже замінено F-27) |
| F-22 | Групування лістингів не обрізати | так | Тримається |
| F-23 | Перевірка на живому trade API | перевірити | **Відповідь (код):** `/api/trade2/search|fetch`, `listingType` у 4 стани, нові групи фільтрів, сортування за еквівалентом (валюти змішані: divine, exalted, chaos). **Ще перевірити:** живий пошук |
| F-24 | «Відкрити на сайті» | так | Тримається; `/trade2/search/poe2/<league>` |
| F-25 | Вікно на дві колонки | так | Тримається |
| F-26 | Bulk-приманки | так | Тримається (перевірити на trade2 exchange) |
| F-27 | Три пастки фокусу | так | Тримається |
| F-28 | Фейкова гра замість Блокнота | так | Тримається; фейкова гра має відповідати на **Ctrl+Alt+C** |
| F-29 | Курс divine у заголовку | перевірити | **Відповідь:** головна валюта, як і в PoE1, divine, але дрібних торгових дві — exalted і chaos. Заголовок «1 div = N ex · M c», тултип 0.1…1 div в обох; poe.ninja PoE2 віддає ціни в divine з курсами exalted і chaos в одній відповіді |
| F-30 | Bulk: порт APT + приманки | перевірити | **Відповідь:** `/api/trade2/exchange` є, EE2 використовує; типи poe.ninja для стеків — 14 exchange-типів |
| F-31 | Тести без computer-use | так | Тримається |
| F-32 | Esc під час вводу | так | Тримається |
| F-33 | Один запит poe.ninja на все | перевірити | **Відповідь:** dense-ендпоінта немає; або 23 запити на лігу раз на годину з ETag, або проксі. **Рішення власника** |
| F-34 | Графік — накопичена зміна | перевірити | **Відповідь:** той самий зміст; ключ `sparkline` (exchange) або `sparkLine` (stash) |
| F-35 | Власний SVG-графік | так | Тримається |
| F-36 | Каталог станів і скрипти | так | Тримається |
| F-37 | Item check, посилання | перевірити | **Відповідь:** poe2wiki.net, poe2db.tw (9 мов), CoE `game=poe2&eimport=` |
| F-38 | DPS при Q20 | так | Тримається; фільтри EE2 мають ще EDPS і reload |
| F-39 | Map check | перевірити | **Відповідь:** для waystones (і logbook); показники — tier, revives, pack size, drop chance, rarity; без скриншота локації й Maven; tablets → item check. Дефолтні позначки — нові |
| F-40 | Налаштування, хоткеї | так | Тримається; нове поле — клавіша розширеного копіювання |
| F-41 | Dev-збірка окремо | так | Тримається: `<identifier>.dev` |
| F-42 | Чат-команди | перевірити | **Відповідь (код):** дефолти EE2 ті самі. **Ще перевірити в грі:** Ctrl+Enter, Ctrl+A, `/kick` |
| F-43 | Stash search | так | Тримається; дефолтні пресети EE2 |
| F-44 | Фокус, закриття кліком, розміщення | так | Тримається |
| F-45 | Запити зсередини сторінки | так | Тримається; для 8 мовних хостів |
| F-46 | poeprices.info | ні | Замінника немає; натомість EE2 дає Extraction value (руни) |
| F-47 | Unidentified uniques | перевірити | **Відповідь:** механізм в EE2 є, `makeIdentifiedUnique` немає — пишемо свій на даних EE2 |
| F-48 | Трей, updater, інсталятор | так | Тримається; новий ключ, новий репо, новий endpoint |
| F-49 | Після першої версії | так | Тримається |
| F-50 | Mods-вкладка, Fractured, розмір | так | **Тримається з умовою:** `noPseudo` і групи модів — на API APT, якого в EE2 немає (див. 1.4) |
| F-51 | Монітори, fullscreen, ліміти, ліги | так | Тримається |
| F-52 | Перевірка в грі | так | Тримається; новий список сценаріїв під PoE2 |
| F-53 | Швидкість ~65 мс | так | Ціль та сама; копіювання Ctrl+Alt+C з 10 мс затримкою — виміряти |
| F-54 | Дизайн A+B | перевірити | **Відповідь:** див. розділ 4 і [таблицю дизайну](analysis/poe2-items-features.md#5-що-змінити-в-дизайні-ab-f-54-для-poe2) |
| F-55 | `equal: () => false` | так | Тримається |
| F-56 | Ярлики після перейменування | так* | Код міграції не беремо: у PoE2 старих назв ще немає |
| F-57 | Toast у release | так | Тримається |
| F-58 | Ширина панелі `h×986/1600` | перевірити | **Ще перевірити в грі:** у PoE2 інший інтерфейс інвентаря / сховища |
| F-59 | Мова інтерфейсу окремо | так | Тримається |
| F-60 | Російська гра, мовний сайт | перевірити | **Відповідь:** 9 мов гри з даними EE2, хости ru / jp / de / es / br / fr / kakao / tw; перший рядок предмета («Item Class» або `Rarity:`) потрібен усіма мовами |

**Нові знахідки для еталона** (тег «PoE1: так» піде у FINDINGS нового проєкту): User-Agent еталона досі `PoeTradeOverlay/0.1.0` (`constants.ts`), хоча реліз 0.1.8 і назва інша — варто брати версію з `getVersion()`.

---

## 6. Перевикористання коду і стратегія репозиторію

Деталі — [code-reuse.md](analysis/code-reuse.md).

| Частина еталона | Рядків | Як є | З правками | Переписати |
|---|---|---|---|---|
| Rust-хост `src-tauri/src` | 2 660 | ~90 % | `constants.rs`, `hotkeys.rs` (Ctrl+Alt+C, 10 мс), `browser.rs` (назва вікна) | `shortcuts.rs` не потрібен |
| Angular `src/app` | 5 324 | 18 % (core, shared, toast, settings-інфраструктура) | 63 % (price check, item check, stash, settings, i18n) | 19 % (курси й poe.ninja, bulk, unidentified, map check) |
| `scripts/`, `tests/` інфраструктура, `.github/workflows`, конфіги | — | майже все | fake game (Ctrl+Alt+C), тексти предметів | — |

**Варіанти:**
- **A. Форк price-of-exile з заміною `src/lib/apt`.** Найшвидший старт, але змішана історія й постійні конфлікти в `constants.ts`, i18n, price check. GitHub не форкає власний репо в той самий акаунт.
- **B. Новий репо, модулі скопійовано.** Чиста історія, ті самі шляхи файлів — фікси переносяться `git format-patch | git am -3`.
- **C. Спільне ядро (монорепо).** Не підходить: updater встановлених PoE1 дивиться на `price-of-exile/releases/latest`, два застосунки в одному репо з ним конфліктують; реструктуризація ризикує зламати 0.1.8.

**Рекомендація: B, а згодом — спільний Rust-крейт хоста.** Новий репо (вже є: приватний `ArtemNA/price-of-exile-2`), код еталона копіюється з тими самими шляхами, EE2 — у `src/lib/ee2/` за правилом «byte for byte + `// [port]`». Хост спершу параметризується `GameProfile` у копії PoE2 (назва вікна, клавіші копіювання, хости, перші рядки, ширина панелі). Коли він доведений у грі, той самий крейт переїжджає в репо PoE1 і PoE2 підключає його за git-тегом — тоді фікс хоста потрапляє в обидва застосунки. TS-оболонку в пакет поки не виносимо.

**Обов'язково окреме для PoE2:** identifier (і `.dev`), productName, ім'я exe / npm-пакета / крейта, ключ і endpoint updater, секрети CI, посилання на репо, User-Agent, заголовки вікон і трею, іконки, ключ сховища налаштувань.

---

## 7. Рішення власника (для фази 2)

**Прийнято 28.10.2026:**
- Валюти: головна divine, дрібних торгових дві — exalted і chaos; враховувати обидві (заголовок, «≈», bulk, poe.ninja).
- Автооновлення відкладаємо на пізніше: репо лишається приватним, ключ підпису поки не потрібен.
- Мови — як у Price of Exile: інтерфейс en / uk / ru, гра en / ru.
- poe.ninja — прямі запити до офіційного API з поступовим завантаженням (3а).
- Решта рекомендацій аналізу прийнята (новий репо з копією модулів, MVP на 0.5, оновлення даних після 1.0).

**Відкрите:** назва й identifier (пункт 1), спільний Rust-крейт (4), редактор рун і Extraction value (5).

Початковий список:

1. **Назва застосунку**, назва репо (зараз `price-of-exile-2`, приватний) і Tauri identifier (не `com.artemna.poe-trade-overlay`; dev — `<identifier>.dev`). Перейменувати теку під назву?
2. **Ключ підпису updater** — новий; генеруєш і кладеш у секрет репо сам. Для автооновлення з приватного репо релізи недоступні без токена (F-48) — тож або репо стане публічним до першого релізу, або оновлення без автооновлення.
3. **Джерело цін poe.ninja:** (а) прямі запити до офіційного API (~23 на лігу раз на годину з ETag) — просто, але суперечить пораді poe.ninja; (б) власний маленький кешуючий проксі — потрібен хостинг; (в) проксі EE2 — лише з дозволу автора. Рекомендую (а) з лінивим завантаженням: курси валют одразу, решта типів — при першому предметі цього типу.
4. **Спільний Rust-крейт** з PoE1 — так / пізніше / ні.
5. **Обсяг:** беремо item editor (руни) і Extraction value з EE2? XP tracker, notepad, library — не беремо?
6. **Мови гри на старті:** лише en (+ ru, як в еталоні) чи всі 9 одразу (дані є, коштує тестів і хостів)?
7. **Терміни відносно 1.0 (11.12.2026):** дані й, можливо, формат зміняться. Планувати MVP на 0.5 і оновлення даних після 1.0.
