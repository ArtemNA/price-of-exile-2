# Знімки станів

Кожен перевірений стан застосунку, обрізаний до вікна. Нумерація — за етапами [PLAN.md](../../PLAN.md).

| Файл | Що видно |
|---|---|
| `00-popup-poe2-ring-stage0.png` | Етап 0: Ctrl+D над фейковою грою, хост натиснув Ctrl+Alt+C, popup показує PoE2-кільце (`tests/fixtures/items/rare-ring.txt`). Розбір і ліга ще від парсера PoE1 (F-04); тіри T3/T7 видно, отже дійшов розширений текст |
| `02-price-check-ee2-ring.png` | Етап 2: те саме кільце, розібране вже парсером EE2; ліга Forbidden Rites вибрана сама з `/api/trade2/data/leagues`. Знак «+» у модах ще губиться (F-08) |
| `02-price-check-ee2-search.png` | Етап 2: після Search — живий trade2-пошук, 20 лістингів, рядок стану «Search 1/5 · Fetch 2/12» з реальних правил лімітів (F-12) |
| `03-rare-ring-pseudo.png` | Етап 3: кільце, вкладка Pseudo; знак «+» повернувся і в модах, і в сумі опорів (F-15); чип «Not unique» |
| `03-trade-options.png` | Етап 3: розгорнуті налаштування пошуку — Listings у 4 стани, Buyout з іконками валют (F-16) |
| `03-rare-ring-search.png` | Етап 3: пошук кільця на живому trade2, ціни в різних валютах |
| `03-weapon-groups.png` | Етап 3: арбалет з `weapon.txt` — групи Properties, Implicit, Explicit, Rune, Enchant, чип «Sockets ≥ 2», вікно виросло під фільтри |
| `03-waystone.png`, `03-waystone-search.png` | Етап 3: вейстоун — «Any Waystone», чип «Waystone tier = 14», без тірів; пошук |
| `03-gem.png` | Етап 3: мета-гем без рядка Item Class — Sockets ≥ 4, Gem level ≥ 14, пошук одразу, колонка Lvl / Q |
| `03-unique.png` | Етап 3: унікальний фокус — пошук одразу, без чипа рідкості |
| `04-exalted-orb.png` | Етап 4: Exalted Orb — курс «div = 711 ex · 10 c» у заголовку, ціна poe.ninja 0,014 c з трендом і графіком, пов'язані Greater і Perfect Exalted; вкладка Bulk ще не доведена (етап 5) |
| `04-rune.png` | Етап 4: Greater Iron Rune — 5,2 ex = 0,075 c, «You have 1 → 5.2 ex · 0.075 c» |
| `04-ring-equivalents.png` | Етап 4: пошук кільця — колонки «≈ ex» і «≈ c», найдешевші зелені (F-19) |
| `05-bulk-rune.png` | Етап 5: Greater Iron Rune — Pay with ex / div / c з кількістю пропозицій, рядок Market ratio, одну приманку сховано |
| `05-bulk-exalted.png` | Етап 5: Exalted Orb — оплата лише divine і chaos, «1 div → 100», «Best real offer 0.01 div» |
| `05-bulk-divine.png` | Етап 5: Divine Orb (текст `tests/fixtures/items/divine-orb.txt`, зібраний вручну) — єдина пропозиція виявилась приманкою |
| `06-item-check-crossbow.png` | Етап 6: item check арбалета — Physical / Elemental / Total DPS, Reload time; зіпсований, тож без Craft of Exile |
| `06-item-check-bow-q20.png` | Етап 6: лук з рунами (зіпсований, тож без значень при Q20) |
| `06-item-check-ring.png` | Етап 6: рідкісне кільце — Wiki, PoEDB, Craft of Exile |
| `06-item-check-rune.png` | Етап 6: руна — без Craft of Exile, ціна poe.ninja з трендом |
| `06-find-in-stash-fake-game.png` | Етап 6: Find in Stash ввів `"Greater Iron Rune"` у пошук сховища фейкової гри |
| `07-map-check-waystone.png` | Етап 7: map check вейстоуна Tier 14 — числа, 4 моди, нерозпізнаний рядок гібридного мода |
| `07-map-check-corrupted.png` | Етап 7: зіпсований вейстоун Tier 16 — 8 чисел, Temporal Chains позначено попередженням (профіль I) |
| `08-settings-copy-keys.png` | Етап 8: Settings → Hotkeys, блок «Item copy keys» — Ctrl + Alt + C з конфігу гри і перемикач From the game / Alt / Shift / Ctrl |
| `09-stash-panel.png` | Етап 9: Alt+F — панель пресетів сховища PoE2 (Map rolling, Dump sorting) |
| `09-chat-and-stash-fake-game.png` | Етап 9: фейкова гра після F5 (`/hideout`) і кліку по пресету «Waystone Tier» |
| `10-search-through-browser.png` | Етап 10: пошук кільця з «Use the built-in browser» — усі запити trade2 пішли через сторінку pathofexile.com у вбудованому браузері |
| `11-unid-single.png` | Етап 11: неідентифікований Felt Cap — Goldrim вибрано сам, пошук неідентифікованих |
| `11-unid-picker.png` | Етап 11: неідентифікований Sapphire Ring — «Which one?» з трьома унікальними |
| `11-unid-picked.png` | Етап 11: після вибору Polcirkeln — пошук, ціна poe.ninja |
| `12-uk-waystone.png` | Етап 12: інтерфейс українською — вейстоун, числа й тір вейстоуна |
| `12-uk-bow.png` | Етап 12: інтерфейс українською — лук з рунами, теги «руна», «імпліцитний» (Corrupted / Fractured англійською, як в еталоні) |
| `12-ru-ring.png` | Етап 12: російська гра й інтерфейс — кільце з `tests/fixtures/items-ru/rare-ring-life-res.txt` |
| `12-ru-ring-search.png` | Етап 12: пошук того кільця на ru.pathofexile.com, вік лістингів російською |
| `12-ru-language-mismatch.png` | Етап 12: англійський предмет при мові гри «Русский» — підказка, що змінити |
| `13-installed-toast.png` | Етап 13: toast після старту встановленої збірки 0.0.1 |
| `13-second-start-settings.png` | Етап 13: другий запуск встановленої збірки відкрив налаштування (один екземпляр) |
| `14-copied-without-mod-details.png` | Етап 14: рідкісне кільце, скопійоване Ctrl+C (клавіша копіювання «Ctrl» у налаштуваннях) — попередження про клавіші копіювання |
| `14-ring-search.png` | Етап 14: те саме кільце з Ctrl+Alt+C після правок — звичайний пошук |
| `16-update-toast-found.png` | Оновлення: знайдено нову версію — повідомлення в куті «Version 0.0.2 is out · Click to see what is new and install it» (тестова версія, показана в dev тимчасовим викликом) |
| `16-update-toast-updating.png` | Оновлення: «Install new versions automatically» увімкнено, знайдено при старті — «Updating to 0.0.2… · The overlay restarts by itself in a few seconds» |
| `16-update-toast-found-ee2.png` | Те саме повідомлення про нову версію в темі Exiled Exchange 2 |
| `16-update-toast-updating-ee2.png` | «Updating to 0.0.2…» у темі Exiled Exchange 2 |
| `16-update-settings-installed.png` | Налаштування, About: «Install new versions automatically» з підказкою (встановлена збірка; у dev показано тимчасовим перемиканням) |
| `16-update-settings-portable.png` | Те саме в портативній збірці (dev теж рахується портативною): вимкнено, з приміткою, що портабл сам не оновлюється |
