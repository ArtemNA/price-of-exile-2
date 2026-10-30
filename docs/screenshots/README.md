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
