# Price of Exile 2 — план реалізації (Angular + Tauri)

> Робоча назва (остаточну обирає власник). Основа — [Exiled Exchange 2](https://github.com/Kvan7/Exiled-Exchange-2) (EE2, MIT), коміт `cca30662` (06.09.2026), і власний [Price of Exile](https://github.com/ArtemNA/price-of-exile) 0.1.8 для PoE1 як еталон.
> Мета: те саме, що Price of Exile для PoE1 — той самий стек, дизайн, поведінка й планка якості — але для **Path of Exile 2**.
> Аналіз, на якому стоїть план: [docs/ANALYSIS.md](docs/ANALYSIS.md) і звіти в [docs/analysis](docs/analysis/).

---

## 1. Обсяг

### 1.1 Беремо

| # | Функція | Що робить для користувача | Джерело |
|---|---|---|---|
| F1 | **Прайс-чек (ядро)** | Хоткей над предметом → popup у дизайні A+B: шапка (назва, база, іконка, «Any <категорія> \| This base», чипи iLvl / Sockets / Waystone tier / Gem level, corrupted у 3 стани, ціна poe.ninja з трендом), ліва колонка (Pseudo / Mods, групи модів з T1/T2, Fractured, Σ Mods behind totals, Hidden, Any / Prefix / Suffix), права (Trade / Bulk / poe.ninja / Wiki) | EE2 `parser/*`, `filters/*`, `trade/*`; UI еталона |
| F2 | Онлайн-фільтри | `listingType` у 4 стани (Instant / Instant or Online / Online / Any), «listed N днів тому», валюта викупу | EE2 `trade/*` |
| F3 | Rate limit | Черга з урахуванням `X-Rate-Limit-*`, пауза після 429 (F-51), індикатор | еталон + EE2 `RateLimiter.ts` |
| F4 | **Bulk** | `/api/trade2/exchange`: валюта, руни, soul cores, omens, essences, фрагменти, catalysts…; приманки (F-26); «You have × N» | EE2 `pathofexile-bulk.ts`, еталон `bulk-search.ts` |
| F5 | **poe.ninja** | Ціна без запиту до trade, 7-денний тренд, related items (`item-drop.jsonc` EE2). Курс: «1 div = N ex · M c»; колонка «≈» у лістингах — **і в exalted, і в chaos** | **власний адаптер** до офіційного API poe.ninja PoE2 |
| F7 | Вбудований браузер | Вхід на pathofexile.com і Cloudflare; запити зсередини сторінки (F-45) | еталон |
| F8 | Unidentified uniques | Вибір унікального предмета за базою | EE2 `unidentified-resolver`, свій `makeIdentifiedUnique` |
| F9 | Item check | Alt+D: poe2wiki.net, poe2db.tw, Craft of Exile (`game=poe2`), Find in Stash, DPS / EDPS | еталон + EE2 `hotkeyable-actions.ts` |
| F10 | Map check | Waystones (і logbook): тір, revives, pack size, drop chance, rarity, позначки модів; tablets → item check | EE2 `map-check/*`, UI еталона |
| F11 | Stash search | Alt+F, пресети EE2 (Map rolling, Dump sorting) | еталон + дефолти EE2 |
| F12 | Chat-команди | `/hideout`, `/exit`, `@last`… | еталон |
| F13 | Налаштування | Як в еталоні + клавіша розширеного копіювання + налаштування валют | еталон |
| F14 | Системне | Трей, single instance, лог, toast, інсталятор NSIS і портабл | еталон (без updater, див. 1.2) |

### 1.2 Не беремо (зараз)

| Що | Чому |
|---|---|
| Автооновлення (`tauri-plugin-updater`) | Рішення власника: пізніше. Репо приватне, ключ підпису поки не потрібен. Конфіг лишаємо готовим до ввімкнення |
| Редактор рун / soul cores / якості каталізатором і Extraction value (EE2 item editor) | Рішення власника: пізніше, потрібен окремий дизайн. Парсер EE2 переносимо разом з `augment-builder` / `calc-base`, щоб додати це без переробки |
| poeprices | Закритий, для PoE2 не було (F-46) |
| XP tracker, notepad, library, tips з EE2 | Поза ідеєю price-check оверлея |
| Мови гри de / fr / es / pt / ja / ko / cmn-Hant | Рішення власника: мови як у Price of Exile (гра en / ru, інтерфейс en / uk / ru). Дані EE2 для інших мов є — додавання пізніше коштує даних, хостів і тестів |
| Режим віджетів, Linux / macOS | Як в еталоні |
| Проксі EE2 `api.exiledexchange2.dev` | Чужий приватний сервіс; лише з дозволу автора |

---

## 2. Архітектура

### 2.1 Стек

Як в еталоні: Angular 22 (standalone, signals) + Tailwind 4, Tauri 2, Vitest, `neverthrow`. Плагіни Tauri ті самі, крім `updater` (вимкнено до рішення). TS-логіка EE2 — у `src/lib/ee2/`.

### 2.2 Модель вікон

Без змін від еталона (PLAN еталона §2.2, F-01…F-03, F-27, F-44, F-51, F-58): приховані наперед popup-вікна, `WS_EX_NOACTIVATE`, хоткеї лише поки активна гра, Esc і клік повз вікно через LL-хуки, масштаб монітора гри, клавіатура в popup — лише на час введення чисел.

Відмінності PoE2:
- вікно гри — `Path of Exile 2`;
- копіювання — **Ctrl + клавіша «show advanced item descriptions» + C** (за замовчуванням Ctrl+Alt+C). Клавішу читаємо з `Documents\My Games\Path of Exile 2\poe2_production_Config.ini` (як EE2), з ручним перевизначенням у налаштуваннях. Модифікатори відпускаються через 10 мс після C (EE2: гра губила відпускання);
- текст предмета в буфері розпізнається за `Item Class:` **або** `Rarity:` (неогранені / мета-геми), обома мовами;
- ширина панелей інвентаря / сховища для «Opposite the cursor» (F-58) — виміряти в PoE2.

### 2.3 Спільний Rust-хост (рішення власника)

Rust-хост виноситься в **окремий крейт `overlay-host`** в окремому репозиторії `ArtemNA/poe-overlay-host`: hotkeys, clipboard, popup, platform, browser, chat, stash, toast, tray, state. Ігрові відмінності — у структурі `GameProfile`:

```rust
pub struct GameProfile {
    pub window_title: &'static str,            // "Path of Exile" | "Path of Exile 2"
    pub item_first_lines: &'static [&'static str],
    pub copy_keys: CopyKeys,                   // Ctrl+C | Ctrl+<showModsKey>+C
    pub copy_release_delay: Duration,          // 0 | 10 ms
    pub trade_hosts: &'static [&'static str],
    pub panel_width_ratio: f64,
    pub browser_title: &'static str,
    pub legacy_shortcuts: Option<LegacyShortcuts>, // F-56, лише PoE1
}
```

`src-tauri/src/lib.rs` застосунку — кілька рядків: профіль + `overlay_host::run(...)`. Застосунки підключають крейт як git-залежність за тегом (`host-vX.Y.Z`); для локальної розробки — `[patch]` на шлях у `.cargo/config.toml` (поза git). Фікс хоста: коміт і тег у `poe-overlay-host` → підняти тег в обох застосунках.

Порядок: крейт створюється з хоста Price of Exile на етапі 0 і перевіряється в PoE2. PoE1 переходить на нього **окремим етапом** (H) з релізом і перевіркою в грі — лише з дозволу власника на зміни в репо PoE1.

Відкрите: видимість репо крейта. Раджу **публічний** (MIT): код уже публічний у Price of Exile, а CI публічного PoE1 тоді тягне крейт без токенів. Якщо приватний — потрібен deploy key для CI обох застосунків.

### 2.4 Структура проєкту

```
price-of-exile-2/
├─ src-tauri/              # тонка обгортка: GameProfile + overlay_host::run, tauri.conf, іконки
├─ src/
│  ├─ app/                 # Angular, з еталона (ті самі шляхи — для git am -3)
│  │  ├─ core/  price-check/  item-check/  map-check/  stash-search/  settings/
│  │  ├─ popup-window/  toast-window/  shared/
│  │  ├─ ee2-shims/        # @/web/Config, IPC, TradeData, Prices (signals)
│  │  └─ constants.ts      # усі статичні значення TS
│  └─ lib/ee2/             # EE2 byte for byte, правки `// [port]`, UPSTREAM_COMMIT, LICENSE
├─ public/data/{en,ru}/    # дані EE2 (LF, -text)
├─ public/i18n/{uk,ru}.json
├─ scripts/                # fake-game (Ctrl+Alt+C), press-hotkey, screenshot, measure-popup, sync-ee2, make-data-indexes
├─ tests/                  # vitest; fixtures/items — тексти PoE2
└─ _upstream/              # клони EE2 і APT, поза git
```

Статичні значення — лише в `src/app/constants.ts` і `GameProfile` / `constants.rs` застосунку (правило еталона, F-17).

---

## 3. Перенесення коду EE2

| Модуль EE2 | Рядків | Як переносимо | Зусилля |
|---|---|---|---|
| `parser/*` + `item-editor/{augment,item-editor}.ts` | ~4 300 | Копія + `[port]` (Config через shim). Тести — корпус EE2 `renderer/specs` + `tests/fixtures/items` | середні |
| `assets/data/*` | 975 | Копія + `[port]` `DataSource` (F-09); `TradeData` — shim | середні |
| `background/TradeData.ts` | 207 | Сервіс на signals, запити через `poeFetch` | низькі–середні |
| `filters/*.ts` + `pseudo/` | 4 148 | Копія 1:1 (`fill-augments.ts` — shim) | низькі |
| `filters/*.vue` | 2 128 | Angular у дизайні A+B; **групи модів пишемо самі в `src/app`** (в EE2 немає `FilterGroup` з APT) | високі |
| `trade/*.ts` | 2 990 | Копія; `[port]` Vue → signals у `RateLimiter`, `common`, `bulk-api`, `trade-api` | середні |
| `trade/*.vue` | 1 821 | Angular: лістинги, bulk, онлайн-фільтр; tooltip предмета — пізніше | високі |
| `background/Prices.ts` | ~460 | Власний адаптер poe.ninja PoE2 з тим самим інтерфейсом (`findPriceByQuery`, `autoCurrency`…) | середні–високі |
| `background/Leagues.ts` | ~210 | Сервіс; челендж-ліга — перша не-постійна, не `result[2]` | низькі |
| `trends/getDetailsId.ts`, `related-items`, `stack-value`, `unidentified-resolver` | ~1 100 | TS — копія, UI — Angular | середні |
| `item-check/hotkeyable-actions.ts`, `map-check/{common,prepare-map-stats}.ts` | ~600 | Копія + shim | середні |
| `main/src/shortcuts/*` | 613 | Ідеї → `overlay-host` (копіювання, 10 мс, `Rarity:`) | середні |

Код еталона (`src/app`, ~5 300 рядків): 18 % як є, 63 % з правками, 19 % переписати (курси й poe.ninja, bulk, unidentified, map check) — [code-reuse.md](docs/analysis/code-reuse.md).

---

## 4. Мови

Як у Price of Exile: інтерфейс **en / uk / ru** (`public/i18n`, F-59; англійські ігрові терміни в uk), гра **en / ru** (дані EE2 `en`, `ru`; ru.pathofexile.com і www з `useIntlSite`, F-60). Архітектура мов з еталона дозволяє додати решту 7 мов EE2 пізніше: дані, хост trade-сайту з `poeWebApi()`, перший рядок предмета, тести.

---

## 5. Дані гри

- Джерело — EE2 `renderer/public/data/{en,ru}/` (`items.ndjson`, `stats.ndjson`, `client_strings.js`, `app_i18n.json`) і `item-drop.jsonc`, за комітом EE2. Генератор EE2 (`dataParser/`, Python, читає файли гри) не відтворюваний — не використовуємо.
- `scripts/sync-ee2.mjs`: копіює дані з `_upstream/ee2` за комітом, пише `UPSTREAM_COMMIT`, показує diff `src/lib/ee2` з upstream. Клон — лише `git clone -c core.autocrlf=false`; `public/data/**` у `.gitattributes` без `text` (F-07).
- `make-data-indexes.mjs` з еталона — індекси при `start` / `build` / `test`.
- Trade-дані (`/api/trade2/data/stats`, `items`) — як fallback EE2 для невідомих модів, з кешем.
- Нова ліга або патч гри = sync даних EE2 + тести парсера на нових предметах. **1.0 виходить 11.12.2026**: план — MVP на даних 0.5, оновлення даних після виходу EE2 під 1.0.

---

## 6. Етапи

Обсяг: S (до дня), M (кілька днів), L (тиждень+). Кожен етап закінчується: тести зелені (vitest, cargo test), перевірка на фейковій грі з PoE2-текстами, знімки станів у `docs/screenshots` з описом у README, записи в `docs/FINDINGS.md` (з тегом «PoE1: так / ні»), коміт і пуш.

| Етап | Зміст | Критерій «готово» | Обсяг |
|---|---|---|---|
| **0. Скелет і хост** | Новий проєкт з модулів еталона (identifier `com.artemna.price-of-exile-2`, `.dev`, productName, іконки, User-Agent з версією). Репо `poe-overlay-host`: хост еталона як крейт з `GameProfile`; PoE2-профіль (Ctrl+Alt+C, 10 мс, `Rarity:`, конфіг гри). Fake game відповідає на Ctrl+Alt+C | Хоткей над fake game показує сирий текст PoE2-предмета в popup без втрати фокусу; `measure-popup.ps1` дає час; cargo test крейта зелений | M |
| **1. Дані + парсер** | `sync-ee2.mjs`, дані en/ru, `src/lib/ee2/parser`, `assets/data`, shim'и Config / TradeData; тести EE2 + 22 фікстури | Усі фікстури розбираються; тести парсера EE2 зелені | M |
| **2. HTTP-шар** | trade2-шляхи в `constants.ts`, ліги з `/api/trade2/data/leagues`, лімітер (порт еталона), Cloudflare-помилка, TradeData з кешем | Ліги в popup; перший живий trade2-пошук з реальними заголовками лімітів (F-12, F-23 закрито) | S–M |
| **3. Прайс-чек ядро** | Фільтри EE2, UI A+B під PoE2: групи (без Eldritch; Rune, Enchant, Skill, Desecrated, Mutated), тіри, Fractured, Σ totals, Hidden, Any / Prefix / Suffix, Mods-вкладка, Sockets ≥ N, нові чипи, `listingType`, лістинги з колонкою «≈ ex · c» | **MVP:** рідкісний, унікальний, gem, waystone — пошук і лістинги на живому API; знімки станів | L |
| **4. poe.ninja** | Адаптер: курси divine ↔ exalted / chaos, поступове завантаження типів, ETag, фільтр за кількістю лістингів; шапка «1 div = N ex · M c», тренд, related items | Ціни й тренд для валюти, унікального, гема; курс у заголовку; ≤ 23 запитів на лігу на годину | M |
| **5. Bulk** | trade2 exchange, divine + exalted / chaos, приманки, «You have × N» | Bulk відкривається сам для валюти й рун; приманки позначено | S–M |
| **6. Item check** | poe2wiki / PoE2DB / CoE, Find in Stash, DPS / EDPS, окремі хоткеї посилань | Відкриває правильні сторінки для 5 типів предметів | S |
| **7. Map check** | Waystones і logbook; дефолтні позначки під PoE2 | Waystone з модами показує тір і позначки | M |
| **8. Налаштування** | Вікно еталона + клавіша копіювання + валюти; без legacy-міграцій | Хоткеї записуються, налаштування переживають рестарт | S–M |
| **9. Чат і stash search** | Команди й пресети (дефолти EE2) | Працюють на fake game | S |
| **10. Вбудований браузер** | www і ru, trade2 | Пошук через браузер на живому API | S |
| **11. Unidentified uniques** | Вибір за базою | Неідентифікований унікальний предмет → вибір → пошук | S |
| **12. Мови** | uk / ru інтерфейс (словники еталона + нові рядки), ru гра, ru.pathofexile.com | Знімки ru-гри й uk / ru інтерфейсу | S–M |
| **13. Системне** | Трей, single instance, лог, toast, NSIS і портабл через GitHub Actions (артефакти збірки, без підписаного фіду) | Встановлена збірка стартує, toast показується | S–M |
| **14. Стабілізація і гра** | Крайові випадки; **список сценаріїв для власника** в справжній PoE2; швидкість проти ~65 мс еталона (F-53) | Сценарії пройдено власником; заміри записано | M |
| **H. PoE1 на спільному крейті** | Price of Exile переходить на `overlay-host` | Реліз PoE1 з перевіркою в грі (F-52). Лише з дозволу власника | S–M |
| **Пізніше** | Автооновлення; редактор рун і Extraction value (з дизайном); tooltip предмета в лістингах; інші мови гри; власні групи предметів (етап 16 еталона) | — | — |

Порядок: 0 → 1 → 2 → 3 (**MVP**) → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14; H — коли хост перевірено в PoE2.
Незалежні шматки (наприклад, 6, 9 і 11, або адаптер poe.ninja паралельно з UI етапу 3) делегуються субагентам з вузьким брифом і перевіряються мною перед прийняттям.

---

## 7. Ризики

| ID | Ризик | Ймовірність | Що робимо |
|---|---|---|---|
| R-1 | **PoE2 1.0 (11.12.2026)** змінює дані, класи предметів, можливо формат тексту | висока | MVP на 0.5; парсер близько до EE2, щоб підтягнути їхні зміни під 1.0; фікстури з гри після патчу |
| R-2 | API EE2 не збігаються з тими, на яких стоїть UI еталона (групи модів, `ParsedItem`) | висока | Групи — власний код у `src/app`; правки EE2 лише через `[port]`; етап 3 найбільший |
| R-3 | Ядро EE2 зв'язане з Vue (Config, Prices, TradeData) | середня | Shim'и-сервіси на signals до копіювання парсера й trade (етап 1) |
| R-4 | poe.ninja: немає dense-ендпоінта, порада ходити через бекенд, викиди цін | середня | Поступове завантаження, ETag, кеш, фільтр за кількістю лістингів; власний проксі — запасний варіант |
| R-5 | Cloudflare на trade2 (сторінка дала challenge для curl) | середня | Вбудований браузер з етапу 10; зрозуміла помилка з «Open browser» (F-45) |
| R-6 | Спільний крейт ламає PoE1 | низька–середня | PoE1 переходить окремим етапом H з перевіркою в грі; теги крейта |
| R-7 | Ctrl+Alt+C і затримки буфера змінюють швидкість (F-53) | низька | Заміри на етапі 0 і 14 |
| R-8 | Ліміти GGG / бан | низька | Лімітер еталона, власний User-Agent, тести на фікстурах, мало живих запитів |
| R-9 | Ширина панелей PoE2 інша (F-58) | низька | Виміряти в грі на етапі 14 |

---

## 8. Ліцензія та правила

- Код EE2 і APT — MIT © 2020 Alexander Drozdov (+ автори EE2). `src/lib/ee2/LICENSE`, `THIRD_PARTY_LICENSES.md`, коментар джерела в шапках файлів.
- `AI_POLICY.md` EE2 стосується внесків у EE2: PR з AI-кодом туди не надсилаємо.
- Дані гри — похідні від даних GGG, як в еталоні.
- Trade API: власний User-Agent з контактом, дотримання лімітів; нічого не впроваджуємо в процес гри.

---

## 9. Відкриті питання

1. **Назва застосунку** і identifier. Робочі: «Price of Exile 2», `com.artemna.price-of-exile-2`. Перейменувати теку й репо під назву?
2. **Видимість репо крейта `poe-overlay-host`**: раджу публічний (див. 2.3).
3. Дозвіл на етап H (зміни в репо Price of Exile) — коли до нього дійде.
