# PoE2: предмети та функції price-check оверлея (аналіз для порту EE2 → дизайн Price of Exile)

Дата: 28.10.2026. Стан гри: **0.5.0 «Return of the Ancients»**, ліга Runes of Aldur (з 29.05.2026). Це остання ліга раннього доступу; 0.6 не буде, реліз 1.0 оголошено на 11.12.2026 (джерела в кінці).
Джерела коду: EE2 `_upstream/ee2` (далі `ee2/`), APT `_upstream/apt`, еталон PoE1 `poe-trade-overlay`.

Позначки: **[V]** перевірено в коді, даних або тестах EE2 (з посиланням); **[W]** перевірено у вебджерелі; **[I]** висновок, у грі не перевірено.

---

## 1. Формат скопійованого тексту в PoE2

### 1.1 Клавіші копіювання

| Що | Факт | Стан |
|---|---|---|
| Розширене копіювання (заголовки `{ … }`, тіри, діапазони) | **Ctrl + `<show_advanced_item_descriptions>` + C**. За замовчуванням це **Ctrl+Alt+C**. | [V] `main/src/shortcuts/Shortcuts.ts:294-321` (`pressKeysToCopyItemText`: `mergeTwoHotkeys("Ctrl + C", showModsKey)`, модифікатори `keyToggle down`, потім `keyTap C`, відпускання через 10 мс у зворотному порядку) |
| Звідки береться клавіша | `ACTION_KEYS.show_advanced_item_descriptions` з `%APPDATA%/Path of Exile 2/Preferences/poe2_production_Config.ini` (Linux: у префіксі Proton). Якщо ключа немає, береться `"Alt"`. | [V] `main/src/host-files/GameConfig.ts:28-51,87` |
| Звичайний Ctrl+C | Дає текст **без** заголовків модів і тірів. Craft of Exile прямо вимагає Alt+Ctrl+C. **На відміну від PoE1 3.29 (F-06)**, де Ctrl+C завжди копіює розширений формат. | [W] craftofexile.com/faq, форум PoE |
| Модифікатори, які вже затиснуто | На Windows клавіші, які користувач уже тримає (хоткей), не перемикаються (`pressedModKeys`). На macOS перемикаються. | [V] там само |
| Перевірка буфера | `isPoeItem`: текст починається з `Item Class: ` **або** з `Rarity: ` (мета-гем, скопійований з панелі навичок, не має рядка Item Class). Детектор знає 11 мов. Опитування кожні 48 мс до 500 мс. Буфер відновлюється через 120 мс, якщо `restoreClipboard`. На Linux (KDE, Proton 10+) буфер очищується маркером `__EE2_FORCE_EMPTY_<ts>`. | [V] `main/src/shortcuts/HostClipboard.ts` |
| Кінці рядків | Секції розділяє `\r\n--------\r\n`, а рядки всередині групи мода — `\n` (так закодовано приклади CoE у `ee2/docs/item-info.md`). Парсер ділить по `/\r?\n/`. | [V] URL-кодування в docs; [I] для інших місць |

Висновок для Price of Exile: Rust-хоткей має тиснути **Ctrl + showModsKey + C** і читати `poe2_production_Config.ini`, а не просто Ctrl+C, як у PoE1.

### 1.2 Секції (порядок, як у предметах-фікстурах EE2)

```
Item Class: <клас>            ← може не бути (мета-гем з панелі навичок)
Rarity: Normal|Magic|Rare|Unique|Currency|Gem|Quest
<Ім'я>                         ← у Rare/Unique; у Magic ім'я = афікси + база
<База>
--------
Properties: Quality: +20% (augmented) / Armour / Evasion Rating / Energy Shield / Runic Ward /
  Block chance / Physical Damage / Elemental Damage: 27-36 (fire), 9-13 (cold) / Lightning Damage: x-y (lightning) /
  Critical Hit Chance / Attacks per Second / Reload Time / Spirit: 152 (augmented) /
  waystone: Revives Available, Pack Size, Magic|Rare Monsters, Waystone Drop Chance, Item Rarity, Monster Rarity, Monster Effectiveness
--------
Requires: Level 79, 89 (unmet) Str, 89 Dex       ← ОДИН рядок (у PoE1 3.29 — блок "Requirements:\nLevel: 52")
--------
Sockets: S S                   ← гнізда аугментів (рун), лише "S" через пробіл (буває пробіл у кінці); у гемів "Sockets: G G G G"
--------
Item Level: 82
--------
45% increased … (enchant)      ← секція енчанту (зачарування)
--------
18% increased Physical Damage (rune)   ← секція рун/аугментів; також "(added rune)"
--------
{ Implicit Modifier — Attack }
Loads an additional bolt
--------
Grants Skill: Level 18 Cackling Companions
--------
{ Prefix Modifier "Merciless" (Tier: 1) — Damage, Physical, Attack }
173(170-179)% increased Physical Damage
…
--------
<флейвор / help text>
--------
Corrupted | Twice Corrupted | Unmodifiable | Mirrored | Sanctified | Unidentified | Unidentified (Tier 4)
--------
Note: ~b/o 10 divine
--------
Fractured Item
```
[V] `ee2/renderer/specs/Parser/items.ts`, `client_strings.js`, `Parser.ts` (`parsers[]`, `parseRequirements`, `parseAugmentSockets`, `parseCorrupted`, `parseSanctified`, `parseUnidentified`).

Особливості:
- Рядок `You cannot use this item. Its stats will be ignored` стоїть у першій секції; парсер його прибирає. [V] `Parser.ts:193`
- Значення в дужках бувають «перевернуті»: `48(50-46)% reduced …`, `14(15-10)% reduced Charm Charges used`. [V] фікстури
- Значення поза діапазоном теж трапляються (`Map has 16(25-70)%`), бо їх змінює corruption або якість. [V] `tablet.txt`
- Рядки з ` — Unscalable Value` у кінці (waystone, tablet, charm). [V]

### 1.3 Заголовок мода

Регулярний вираз: `MODIFIER_LINE = /^(?<type>[^"]+)(?:\s+"(?<name>[^"]*)")?(?:\s*\(Tier: (?<tier>\d+)\))?(?:\s*\(Rank: (?<rank>\d+)\))?$/`. Після `—` ідуть теги, після другого `—` — `NN% Increased`. [V] `client_strings.js`, `advanced-mod-desc.ts:parseModInfoLine`

| Заголовок | Тип у EE2 | Приклад |
|---|---|---|
| `{ Prefix Modifier "Name" (Tier: N) — Tags }` / `Suffix …` | explicit, prefix/suffix | усі рідкісні |
| `{ Fractured Prefix/Suffix Modifier … }` | fractured | `amulet-fractured-desecrated.txt` |
| `{ Desecrated Prefix/Suffix Modifier … }` | desecrated | там само, `weapon.txt` |
| `{ Crafted Suffix Modifier … }` | crafted | `bow-runes-crafted.txt` |
| `{ Implicit Modifier — Tags }` (теги необов'язкові) | implicit | `belt-two-implicits.txt` (дві implicit) |
| `{ Unique Modifier — Tags }` | explicit (unique) | `unique.txt` |
| `{ Vaal Unique Modifier }` | generation `mutated` | [V] рядок у client_strings, фікстури немає |
| `{ Corruption Enhancement }`, `{ Enhancement }` | enchant (corrupted) | [V] client_strings |
| Тір відсутній | `{ Suffix Modifier "of Infamy" — Attack, Speed }` | `HighDamageRareItem` |
| Хвіст рядка стату | ` (rune)`, ` (added rune)`, ` (enchant)`, ` (implicit)`, ` (desecrated)`, ` (fractured)`, ` (crafted)`, ` (scourge)` | [V] `advanced-mod-desc.ts:6-13` |
| Нерозкритий desecrated | рядок `Desecrated Prefix` / `Desecrated Suffix` → `ModifierType.Veiled`, `isVeiled` | [V] `VEILED_PREFIX/SUFFIX`, `parseModType` |

- **Тіри є**: T1 — найкращий (Merciless T1 170-179 %, Radiance T1). [V] Tier badges у PoE2 працюють так само, як у PoE1.
- Eldritch-заголовки (`Eater of Worlds Implicit Modifier`) лишилися в коді від APT, але в PoE2 таких модів немає. [V]/[I]

---

## 2. Категорії предметів (дані EE2 `items.ndjson`: 870 GEM, 2358 ITEM, 835 UNIQUE)

| Категорія (`craftable.category` / `ItemCategory`) | Що це в PoE2 | Що в тексті і що має обробляти UI | Стан |
|---|---|---|---|
| **SoulCore** (300): руни (`rune_lesser/normal/greater/perfect`, іменні «Countess Seske's Rune of Archery»), soul cores (tier1–4, vaal), **idols** (`primal/vivid/wild/sacred/corrupted_idol`), `abyssal_eye`, talisman-сокетовані | Аугменти. Вставляються в гнізда `S`. Поле `augment[]`: категорії предметів → стат → `rune.stat_*` | Як валюта. Ефекти рядками `Martial Weapon: …`, `Armour: …`, `Bonded: …`. На предметі: секція `(rune)`, «Bonded» стати | [V] дані; формат рун [W] poe2db, клас `Augment` [I] |
| Сокети на спорядженні | `Sockets: S S` — гнізда аугментів **без лінків і кольорів**. Норма за категорією: 2 (тіло, 2H, лук, арбалет, посох, квотерстаф, талісман) або 1 (решта зброї/броні); унікальні мають власні винятки; Vaal-corruption дає +1 понад норму | `augmentSockets {empty,current,normal,augments[]}`; фільтр `equipment_filters.rune_sockets` | [V] `Parser.ts:getMaxSockets`, `parseAugmentSockets` |
| **Gems**: Active Skill Gem (255), Support Skill Gem (595), MetaSkillGem (20), **UncutSkillGem** (47: Uncut Skill/Spirit/Support Gem (Level N)), лінійні підтримки (Lineage) | Гем = `Rarity: Gem`, рядок тегів, `Level: N`, `Sockets: G G G` (гнізда для підтримок у мета-гемів). Uncut — `Rarity: Currency`, рівень у назві | Мета-гем з панелі може прийти **без Item Class** | [V] фікстури, `parseGem`, `createUncutGemFilters` (рівень ±1 до 18-го) |
| Якість гемів | Фільтр quality у `createGemFilters` є (вимкнений < 16) | Чи є якість гемів у 0.5 — не перевірено | [I] |
| **Map** = Waystones (16: `Waystone (Tier 1..16)`) | База містить тір. Секція властивостей: Revives Available, Pack Size, Magic/Rare Monsters, Waystone Drop Chance, Item Rarity, Monster Rarity, Monster Effectiveness. За коментарем EE2 у 0.5.2 Magic/Rare Monsters і gold **немає** | Чип тіра, фільтри map_* | [V] `parseWaystone`, `ParsedItem.ts:61-71` |
| Делірій на waystone | Окремої властивості делірію в парсері немає (лише tablet «Mirror of Delirium») | — | [I] |
| **Tablet** (`TowerAugment`, 8): Abyss, Breach, Delirium, Expedition, Irradiated, Overseer, Ritual, Temple Tablet | Замість sextant/мап-модів PoE1. Implicit «Adds … to a Map» + «N uses remaining», префікси й суфікси (бувають з тіром). У 0.5 перейменовано `X Precursor Tablet` → `X Tablet` | Тіри **не** показувати (EE2 ховає); implicit не фільтрувати; усі експліцити ввімкнено; `# uses remaining` як pseudo (мін = значення) | [V] дані, `create-stat-filters.ts:136-158`; перейменування [W] poe2wiki |
| **Relic** (7: Urn, Amphora, Vase, Seal, Coffer, Tapestry, Incense) | Реліквії Sanctum (Trial of the Sekhemas) | explicit → `Sanctum` | [V] `parseModifiers` |
| **Charm** (12) | Слоти в поясі (`Has N Charm Slots` — implicit поясу) | Властивості `Lasts`, `Consumes N of M Charges`, якість | [V] `charm.txt`, `parseCharmSlots` |
| **Flask** (18) | Лише Life/Mana | — | [V] |
| **Jewel** (9): Ruby, Emerald, Sapphire, Diamond, Time-Lost ×4, Timeless | Якість від Refined Catalysts | Тіри EE2 для jewel не фарбує | [V] `FilterModifierTiers.vue`, `parseQualityNested` |
| Зброя/офхенд | Quiver (11), Focus (45), Sceptre (8, `Spirit:`), Crossbow (29, `Reload Time`, «Loads N bolts»), Spear (36), Flail, Warstaff (= Quarterstaff), Talisman (28, 2H, Druid 0.4), Bow, Wand/Staff (`Grants Skill:`), Buckler (49), Dagger, Claw, 1H/2H Axe/Mace/Sword | `Grants Skill` — окрема секція (`ModifierType.Skill`) | [V] `meta.ts`, фікстури |
| Броня `Runeforged …` / `Runemastered …` (тег `runeforged`, ~1000 баз) | 0.5: Verisium Anvil, Runic Ward | Нові бази й нова властивість `Runic Ward:` | [V] дані, `Parser.ts:972`; [W] |
| **Currency** (259) | Orbs (Exalted, Greater/Perfect Exalted, Chaos, Divine, Regal, Alchemy, Annulment, Fracturing, Vaal, Vaal Cultivation, Mirror, Hinekora's Lock), shards, **Essences** (Lesser/—/Greater/Perfect), **Catalysts** (+ Refined), **Liquid Emotions** (Diluted/—/Concentrated/Potent/Ancient — аналог Distilled), **Splinters** (Breach, Simulacrum, Petition, Runic), Artifacts (Expedition), Kalguur Alloys/Flux/Verisium/Starlit Ore, Vaal Infusers, Abyss bones (Gnawed/Preserved/Ancient Rib…), Thaumaturgic Flux (Level N), Orbs of Sacrifice | `Stack Size: x/y` | [V] дані |
| **Omen** (50) | Модифікатори крафту | Bulk | [V] |
| MapFragment / PinnacleKey / VaultKey / QuestItem | Simulacrum, Breachlord Sac, Cowardly/Deadly/Victorious Fate, Crisis/Calamity Fragments, Origin Core/Cradle/Spark, Reliquary Keys, Kulemak's Invitation | Bulk + related items | [V] |
| MiscMapItem: **Djinn Barya**, **Inscribed Ultimatum** | Trials: `Area Level`, `Number of Trials`, Victorious/Cowardly/Deadly | Окремі фільтри (ascendancy points ↔ area level) | [V] `parseTrials`, `createTrialsFilters` |
| **Expedition Logbook** | Є (MapFragment). Area Level і фракції; мультизонні пресети вимкнено («logbooks aren't real anymore») | Map check показує його як мапу | [V] |
| BrequelFruit (**Wombgift**, 5), Breachstone, Incubator «Vaal Siphoner» | Ліга Breach / Vaal | Wombgift — лише exact preset | [V] |
| Unidentified | `Unidentified` або `Unidentified (Tier N)` (тір мода в неідентифікованому стані). Фільтр `unidentified_tier` вмикається з T5 | Unique unid → вибір унікального за базою (EE2 `UnidentifiedResolver`) | [V] |
| Corruption / Vaal | `Corrupted`, `Twice Corrupted`, `Unmodifiable`. Наслідки: `{ Corruption Enhancement }`, `{ Vaal Unique Modifier }` (mutated), додатковий сокет | Corrupted у три стани | [V] рядки; «Twice Corrupted» у грі [I] |
| Sanctified | Окрема секція `Sanctified`, предмет не модифікується | Фільтр `sanctified` | [V] |
| Fractured / Desecrated | Заголовок + `Fractured Item` у кінці | Fractured switch, група Desecrated | [V] |
| Quality types | Броня/зброя: `Quality`; біжутерія: якість від каталізатора, тип із рядка (`qualityType`); jewel: Refined catalysts; flask/charm: якість | Показувати тип якості в чипі | [V] `parseQualityNested` |

### Чого в PoE2 немає (перевірено за даними EE2 `items.ndjson` en 0.5)

| PoE1 | PoE2 | Стан |
|---|---|---|
| Influences (Shaper/Elder/Conqueror), Eldritch implicits, Synthesised, Delve/Incursion mods | Немає баз і даних. Код у парсері лишився від APT | [V] |
| Veiled (Betrayal) | Немає; `Veiled` у коді означає **нерозкритий desecrated** | [V] |
| Heist (contracts, blueprints, gear) | Немає категорій у даних | [V] |
| Divination cards | Немає категорії в даних (рядок `RARITY_DIVCARD` лишився) | [V] |
| Links (`R-G-B`), білі сокети на спорядженні | Немає; лише `S` (аугменти). Лінки й колір не застосовні. `Sockets: G` лише в гемів | [V] |
| Maven, Voidstones, Blight, Metamorph, Sentinel, Tinctures, Cluster jewels, Abyss jewels, Memory lines | Немає в даних (код лишився) | [V] |
| Crafting bench «Master Crafted» | Заголовок `Crafted … Modifier` є (фікстура EE2) | [V]; джерело в грі [I] |
| Мапи `Map (Tier N)` / `Map Tier:` | Waystones. `MAP_TIER` лишився для сумісності | [V] |

---

## 3. Фільтри EE2: що нового порівняно з APT

| Фільтр / механізм | EE2 | Стан |
|---|---|---|
| `augmentSockets` → `equipment_filters.rune_sockets.min` | Чип «Sockets ≥ N» замість Links | [V] `pathofexile-trade.ts:695` |
| `itemEditorSelection` + **Item editor** (`item-editor/AugmentEditor.vue`, `fill-augments.ts`) | «Що якщо»: заповнити порожні сокети рунами або замінити наявні; стати рун ідуть під `rune.stat_*`. Автозаповнення поки закоментоване | [V] |
| **Extraction value** (`ExtractionValue.vue`) | Σ ціни рун − ціна Orb of Extraction = вигода від витягання рун | [V] |
| `gemLevel` (+max для uncut), `quality` для гемів, `socketNumber` (гнізда гема) | — | [V] |
| `mapTier` (тір waystone), `map_revives/packsize/magic/rare/bonus(drop)/iir/gold` | — | [V] `pathofexile-trade.ts:1110-1152` |
| `unidentifiedTier` (≥5 вмикається) | — | [V] |
| `sanctified`, `mirrored`, `fractured` (item), `corrupted` (3 стани) | — | [V] |
| `requires` (level/str/dex/int) | — | [V] |
| `areaLevel`, `awardedAscendancyPoints`, `ultimatumHint` | Trials | [V] |
| Внутрішні трейд-ID | `item.spirit`, `item.reload_time`, `item.runic_ward`, `item.rarity_magic`, `item.has_elemental_*_affix` (будь-який ел. афікс), `item.duplicates` + DPS/AR/EV/ES/block/crit/aps | [V] `interfaces.ts:156-188` |
| **Empty modifier** | `item.has_empty_modifier`, Any/Prefix/Suffix (`ItemHasEmptyModifier` 0/1/2), лише Magic/Rare, модифікований, не Map | [V] `create-stat-filters.ts:845` |
| Tier badges | `tier-1`, `tier-2`, `tier-3-plus` (налаштування `alwaysShowTier`), `not-tier-1`. Не для Map/Tablet/Jewel | [V] `FilterModifierTiers.vue` |
| Вмикання за замовчуванням | Explicit вмикається, якщо є джерело з тіром ≤ 2; fractured item — лише fractured | [V] |
| Pseudo | Total ele res, total fire/cold/lightning/chaos res, total all ele res (hidden), +total attributes/Str/Dex/Int, total max Life/Mana, total ES (flat і %), Movement Speed, `# uses remaining`. Решту pseudo APT (attack/cast speed, damage, spirit) **закоментовано** | [V] `pseudo/index.ts` |
| Hidden-причини | `hide_crafted_chaos` (chaos res лише з руни), `hide_ele_res`, `hide_total_all_res`, `hide_const_roll`, `hide_for_crafting`, `hide_for_map`, `hide_not_max_level`, `hide_anointment` | [V] |
| Теги фільтрів (`FilterTag`) | Нові: `rune`, `added-rune`, `desecrated`, `skill`, `mutated` | [V] |
| Пресети | Exact (unid, normal, flask, relic, tablet, wombgift, trials), Pseudo, Base item (якщо предмет під крафт); `PRESET_UNIQUES` — варіанти унікальних | [V] `create-presets.ts` |
| Listing type | `available` (Instant or Online), `securable` (Instant buyout), `online`, `any`. Bulk: `onlineleague`, `online`, `any` | [V] `OnlineFilter.vue` |
| Валюта ціни | exalted / chaos / divine | [V] |

---

## 4. Функції еталона → PoE2

| Функція Price of Exile | У PoE2 (EE2) | Що робити |
|---|---|---|
| **Price check** (`/api/trade2/search`, `/fetch`) | `trade2`-ендпоїнти, realm `poe2`. Спосіб продажу Instant buyout (`securable`) | Порт, плюс перемикач Instant / Online / Any [V] |
| **Bulk** (`/api/trade2/exchange`) | Валюта, руни, soul cores, omens, essences, fragments, splinters, liquid emotions, catalysts, uncut gems. Ціни в exalted / divine / chaos | Порт; «Pay with» exalted / divine [V] |
| **poe.ninja** | `poe.ninja/poe2/economy/<league>/<type>/<detailsId>`. Дані йдуть через проксі `api.exiledexchange2.dev/proxy/<league>/overviewData.json` (+`namespaceMap.json`). Головна валюта — divine; дрібні торгові — exalted і chaos (обидві) | Беремо пряме API poe2 (фікстура `ninja-poe2-exchange-currency.raw.json` уже є) або проксі EE2 [V] |
| **Related items** | `public/data/item-drop.jsonc` (116 груп: Fragments, Boss Drops, Lineage gem groups, Reliquary Keys, League currency, Uniques, Tiered Currencies, Crafting items used together, Trials, Legacy of the * augments). Онлайн-копія — `…/proxy/data/item-drop.json` | Порт як у PoE1 (ліва колонка) [V] |
| **Item check** | poe2wiki: `https://www.poe2wiki.net/wiki/<refName>`; PoEDB: `https://poe2db.tw/<us/ru/tw/kr/jp/de/sp/pt/fr>/<шлях за категорією>`; Craft of Exile: `https://craftofexile.com/?game=poe2&eimport=<rawText>`. Ще «search similar» (stash за назвою) і «same priced» (за `Note:`) | Порт; CoE лише для модифікованих [V] `hotkeyable-actions.ts` |
| **Map check** | `isMapLike`: Waystone (не unique), Logbook (+ legacy Heist / Invitation). **Tablet іде в item check**. Позначки тих самих 3 профілів; стати з `statsByType` | Map check для waystones. Для tablets — розглянути власний вигляд. Скриншота локації немає: waystone не має області [V]/[I] |
| **Stash search presets** | Map rolling: `"Increased Pack Size"`, `"Additional Packs"`, `"Burning Ground"`, `"Less Recovery Rate"`. Dump sorting: `Currency`, `"Martial Weapon"`, `Jewel`, `"Waystone Tier"`, `"Rarity: Normal"`, `Trials:` | Взяти ці дефолти [V] `WidgetStashSearch.vue:41-89` |
| **Chat commands** | Дефолти EE2 = APT: `/hideout` F5, `/exit` F9, `@last ty`, `/invite @last`, `/tradewith @last`, `/hideout @last`. У PoE2 є також `/leave`, `/afk`, `/dnd`, `/autoreply`, `/played`, `/deaths`, `/remaining`, `/itemlevel`, `/whois`, `/guild`, `/kills`, `/reset_xp`, `/help` | Порт без змін. `/exit` і `/kick` взято з дефолтів EE2 і вебом не підтверджено [V] код, [W] Game8, [I] `/kick` |
| **Unidentified uniques** | `UnidentifiedResolver.vue` той самий механізм. Бази з `Runeforged/Runemastered` дають варіанти (Goldrim: Felt Cap і Runemastered Felt Cap) | Порт [V] |
| **Мови гри** | en, ru, cmn-Hant, ko, ja, de, es, pt, fr (дані). Сайти: www, ru., pathofexile.tw (Garena), poe.kakaogames.com, jp., de., es., br., fr. Детектор ще знає th і cmn-Hans (даних немає) | Розширити вибір «Game language» до 9 мов [V] `Config.ts:94-114`, `general.vue` |
| **Мови інтерфейсу** | EE2 має одне налаштування `language` для гри й UI (app_i18n у 10 теках, включно з th) | Лишити наш окремий `uiLanguage` (en/uk/ru, F-59) і взяти ключі app_i18n EE2 [V] |
| Дрібне | `Note:` → «same priced»; `Requires` чип; Spirit і Reload у властивостях; `Grants Skill` | [V] |

---

## 5. Що змінити в дизайні A+B (F-54) для PoE2

| Елемент A+B | PoE2 |
|---|---|
| Групи стат-фільтрів `Properties, Totals, Implicit, Eldritch implicits, Explicit, Crafted` | **Прибрати Eldritch.** Нові групи: **Rune** (`rune` і `added-rune`, як «Augments»), **Enchant** (зокрема Corruption Enhancement), **Skill** (Grants Skill), **Desecrated**, **Mutated** (Vaal Unique). Unrevealed desecrated — окремий рядок «Unrevealed prefix/suffix» (EE2 `veiled`) |
| Тір-бейджі T1/T2 | Лишаються: у PoE2 є `(Tier: N)`, T1 найкращий. Не показувати для Waystone, Tablet, Jewel (як EE2) |
| Перемикач **Fractured** | Лишається: трейд має `fractured.stat_*`, а EE2 при fractured item лишає лише fractured-фільтри. Desecrated має свої `desecrated.stat_*` — можна дати такий самий перемикач «Desecrated» [V] `stats.ndjson` |
| Σ Mods behind totals, Hidden, Any/Prefix/Suffix | Лишаються (empty modifier той самий; причини Hidden — ключі EE2) |
| Чип **Links ≥ 6** | Замінити на **Sockets ≥ N** (`rune_sockets`), а в слотах показувати руни (іконки). Додати кнопку **Item editor** (аугменти) і рядок **Extraction value** |
| Чип iLvl / база «Any <cat> / This base» | Лишаються. Нові чипи: **Waystone Tier**, **Gem level** (Uncut ±1), **Unid Tier ≥**, **Spirit**, **Area level** (trials / logbook), **Requires** |
| Corrupted у 3 стани, Mirrored | Лишаються; додати **Sanctified** |
| «Not unique» | Лишається |
| Іконки валют | divine (головна), exalted і chaos (дві дрібні торгові) — з `icon` / `tradeTag` у `items.ndjson` EE2. Курс у заголовку: «1 div = N ex · M c» замість «div = N chaos» (виправлено за словами власника 28.10.2026) |
| Правий бік: Trade / Bulk / poe.ninja / Wiki | Лишається; Wiki → poe2wiki + PoE2DB + CoE `game=poe2` |
| Online-підсумок «online · instant buyout» | 4 стани: Instant / Instant or Online / Online / Any |
| Related items | Те саме місце; дані з `item-drop.jsonc` EE2 |
| Map check (скриншот локації, Maven) | Без скриншота й Maven. Waystone: тір, Revives, Pack Size, Drop Chance, Rarity |
| F-58 (ширина панелі `h×986/1600`) | Для PoE2 не перевірено [I] |
| F-11 (`+` у тексті фільтрів, назва rare з `rawText`) | Те саме в EE2 (`matcher` без знака) [I] |

---

## 6. Фікстури `tests/fixtures/items/` (LF)

| Файл | Що | Походження |
|---|---|---|
| `rare-ring.txt` | Rare Prismatic Ring: implicit, 1P/3S, мод на 2 рядки | дослівно EE2 `specs/Parser/items.ts` `RareWithImplicit` |
| `waystone.txt` | Rare Waystone T14: властивості, Unscalable | EE2 `RareMap` |
| `waystone-corrupted.txt` | Waystone T16, усі властивості, Corrupted | EE2 `RareMapFakeAllProps` (EE2 позначає ці значення як штучні, «Fake») |
| `tablet.txt` | Rare Delirium **Precursor** Tablet, uses remaining, Corrupted, Note | EE2 `TwoLineOneImplicitItem`. Стара назва бази; у 0.5 — `Delirium Tablet` |
| `uncut-gem.txt`, `uncut-spirit-gem.txt` | Uncut Skill/Spirit Gem (Level N) | EE2 `UncutSkillGem`, `UncutSpiritGem` |
| `meta-gem-no-item-class.txt` | Mirage Archer, без рядка Item Class, `Sockets: G G G G` | EE2 `MetaSkillGem` |
| `weapon.txt` | Rare Crossbow: enchant, 2 руни, implicit, Grants Skill, fractured + desecrated, Corrupted, Fractured Item | EE2 `ItemAllTheModifierTypes` |
| `bow-runes-crafted.txt` | Rare Bow: 3 сокети (Vaal), руни, Crafted-суфікс | EE2 `BowThreeAugments` |
| `amulet-fractured-desecrated.txt` | Enchant `Allocates …`, Fractured/Desecrated Suffix | EE2 `NewExplicitTypeDefinitions` |
| `unique.txt` | The Eternal Spark (Focus), Unique Modifier | EE2 `UniqueItem` |
| `rare-unid.txt`, `magic-unid-tier.txt` | Unidentified; `Unidentified (Tier 4)` | EE2 `UnidentifiedBase`, `UnidentifiedTier` |
| `charm.txt`, `belt-two-implicits.txt`, `sceptre-spirit.txt`, `magic-mace.txt`, `normal-helmet.txt` | Charm з якістю; пояс з Charm Slots; Sceptre зі Spirit; Magic; Normal Superior | EE2 `CharmQuality`, `TwoImplicitItem`, `SpectreIncSpirit`, `MagicItem`, `NormalItem` |
| `rune.txt` | Greater Iron Rune | **побудовано**: ефекти й help text за poe2db.tw/us/Greater_Iron_Rune; рядок `Item Class: Augment` і порядок секцій — [I] |
| `currency.txt` | Exalted Orb, Stack Size | **побудовано** за форматом валют EE2 (`Rarity: Currency`, `Stack Size:`); тексти опису — [I] |
| `unique-unid.txt` | Unid Goldrim (Felt Cap, EV 58 з даних EE2; варіант Runemastered Felt Cap) | **побудовано** за `UnidentifiedBase`; рядок Requires пропущено, iLvl умовний [I] |
| `jewel.txt` | Rare Ruby: 2P/2S | **побудовано**: стати є в `stats.ndjson` EE2; назви афіксів, діапазони й відсутність `(Tier)` — [I] |

---

## Джерела (веб)

- Craft of Exile FAQ (Alt+Ctrl+C): https://www.craftofexile.com/faq
- Форум PoE про Ctrl+Alt+C: https://pathofexile.com/forum/view-thread/3545023
- EE2 quick start: https://kvan7.github.io/Exiled-Exchange-2/quick-start
- 0.5 Return of the Ancients: https://www.poe2wiki.net/wiki/Path_of_Exile_2:_Return_of_the_Ancients , https://wccftech.com/path-of-exile-2-return-of-the-ancients-patch-may-2026/
- 1.0 11.12.2026, без 0.6: https://www.playnews.gg/en/release-dates/path-of-exile-2-launches-in-1-0-on-december-11-and-goes-fully-free-to-play , https://www.mmobomb.com/news/gamescom-2026-grinding-gear-games-announces-path-of-exile-2-full-1-0-release
- 0.4 Last of the Druids (Talismans, Fate of the Vaal): https://www.poe2wiki.net/wiki/0.4.0
- Tablets (перейменування в 0.5): https://www.poe2wiki.net/wiki/Irradiated_Tablet , https://poe2db.tw/us/Tablet
- Руна: https://poe2db.tw/us/Greater_Iron_Rune
- Чат-команди PoE2: https://game8.co/games/Path-of-Exile-2/archives/496264
