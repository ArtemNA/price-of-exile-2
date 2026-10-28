# Зовнішні сервіси для PoE2 price-check оверлея

Дата: 28.10.2026. Еталон PoE1 — Price of Exile (`poe-trade-overlay`, `docs/FINDINGS.md`, `src/app/constants.ts`). Еталон коду PoE2 — Exiled Exchange 2 (`_upstream/ee2`, далі EE2).

Позначки: **[V-код]** — перевірено в коді EE2; **[V-live]** — перевірено живим запитом 28.10.2026; **[V-docs]** — офіційна документація; **[I]** — висновок або вторинне джерело, не перевірено.

Живі запити: 6 GET (ліміт вичерпано), User-Agent `price-of-exile-2-research/0.0 (contact: github.com/ArtemNA)`. POST і пошуків на trade не було. Фікстури лежать у `tests/fixtures/` (тіло `*.json` і заголовки `*.headers.txt`, рядки `Set-Cookie` вирізано).

| # | Запит | Статус | Фікстура |
|---|---|---|---|
| 1 | `GET www.pathofexile.com/api/trade2/data/leagues` | 200, `cf-cache-status: HIT`, **без `X-Rate-Limit-*`** | `leagues-trade2.json` |
| 2 | `GET www.pathofexile.com/api/leagues?realm=poe2` | 200, але повертає ліги **PoE1** (`realm: pc`, Allflame) | `leagues-realm-poe2-returns-pc.json` |
| 3 | `GET poe.ninja/poe2/api/economy/leagues` | 200 | `ninja-poe2-leagues.json` |
| 4 | `GET poe.ninja/poe2/api/economy/exchange/current/overview?league=Forbidden Rites&type=Currency` | 200, 51 рядок | `ninja-poe2-exchange-currency.json` |
| 5 | `GET poe.ninja/poe2/api/economy/stash/current/item/overview?league=Forbidden Rites&type=UniqueAccessories` | 200, 87 рядків (обрізано до 16) | `ninja-poe2-stash-uniqueaccessories.json` |
| 6 | `GET www.pathofexile.com/trade2/search/poe2/Standard` (HTML-сторінка) | **403, `Cf-Mitigated: challenge`** («Just a moment…») | — |

---

## 1. Trade-сайт і API PoE2

### Шляхи

| Призначення | PoE1 (Price of Exile / APT) | PoE2 (EE2) | Де в EE2 |
|---|---|---|---|
| Сторінка пошуку | `/trade/search/<league>` | `/trade2/search/poe2/<league>[/<id>]?q=…` | `price-check/trade/TradeListing.vue:206`, `CheckedItem.vue:356` [V-код] |
| Сторінка bulk | `/trade/exchange/<league>` | `/trade2/exchange/poe2/<league>?q=…` | `TradeBulk.vue:261` [V-код] |
| Пошук | `POST /api/trade/search/<league>` | `POST /api/trade2/search/<league>` | `pathofexile-trade.ts:1272` [V-код] |
| Отримання лістингів | `GET /api/trade/fetch/<ids>?query=<id>` | `GET /api/trade2/fetch/<ids>?query=<id>` | `pathofexile-trade.ts:1316` [V-код] |
| Bulk | `POST /api/trade/exchange/<league>` | `POST /api/trade2/exchange/<league>` | `pathofexile-bulk.ts:79` [V-код] |
| Ліги | `/api/leagues?type=main&realm=pc` | `/api/trade2/data/leagues` | `background/Leagues.ts:53` [V-код] |
| Стати / предмети | `/api/trade/data/stats`, `/items` | `/api/trade2/data/stats`, `/api/trade2/data/items` (завжди `www`, бо потрібні англійські ref-назви) | `background/TradeData.ts:54,104` [V-код] |
| `static`, `filters` | `/api/trade/data/static`, `/filters` | `/api/trade2/data/static`, `/filters` — **EE2 їх не викликає** | [I] (за аналогією, не перевірено) |

- `league` у шляхах API — це просто id ліги, без `poe2/`. Сегмент `poe2` є лише в URL сторінок [V-код].
- Realm: у `trade2/data/leagues` кожна ліга має `"realm":"poe2"` [V-live]. Налаштування `realm` в EE2 (`pc-ggg` | `pc-garena`) — це вибір платформи/сайту, а не realm API (`Config.ts:148`) [V-код].

### Ліги

- `/api/trade2/data/leagues` → `Forbidden Rites`, `HC Forbidden Rites`, `Runes of Aldur`, `HC Runes of Aldur`, `Standard`, `Hardcore` [V-live].
- Постійні ліги PoE2: `Standard`, `Hardcore`. HC-ліги мають префікс `HC ` (у PoE1 — `Hardcore …`) [V-live].
- `/api/leagues?realm=poe2` **ігнорує realm** і віддає 16 ліг PoE1 (політика `ladder-view`, `X-Rate-Limit-Ip: 5:5:10,10:10:30,15:10:300`, як у F-16) [V-live]. Тому EE2 і перейшов на `trade2/data/leagues` (коментар `TODO: swap back to /api/leagues?realm=poe2 when available`) [V-код]. В офіційному OAuth API `GET /league?realm=poe2` є, але потребує scope `service:leagues` [V-docs].
- **Поточна челендж-ліга.** `Runes of Aldur` (0.5.0, з 29.05.2026) і `Forbidden Rites` (подія з новою економікою, 0.5.5, з 04.09.2026) ідуть паралельно приблизно до 11.12.2026 (вихід 1.0) [I, новини]. poe.ninja ставить `Forbidden Rites` першою, і за його документацією перша ліга — це «поточна челендж-ліга» [V-live/V-docs].
- **Логіка EE2:** усі ліги `isPopular: true`. Якщо ліга зникла, береться `result[2]` (`TMP_CHALLENGE = 2`), тобто зараз `Runes of Aldur`, а не `Forbidden Rites`. Приватні ліги — ті, що містять `Ruthless`, і `(PL\d+)` [V-код + V-live]. Розпізнавання HC за `rules` втрачено, бо trade2 цих даних не дає.

### Ліміти

- EE2: стартові `SEARCH`, `EXCHANGE`, `FETCH` = 1 запит / 5 с, далі підлаштування за `X-Rate-Limit-Rules` / `X-Rate-Limit-<rule>` / `-State` (`trade/common.ts:51-75`). Це той самий механізм, що в APT і F-23 [V-код].
- Реальних значень політик trade2 (search/fetch/exchange) не бачив, бо POST не робив [I: найімовірніше, ті самі `trade-search-request-limit` тощо, що в PoE1]. Відповідь `trade2/data/leagues` прийшла з кешу Cloudflare і **заголовків лімітів не мала** [V-live]. Отже, лімітер не повинен чекати їх на кожній відповіді.
- `Retry-After` і третє число `-State` (restricted) треба поважати, як у F-51. Формат описано в офіційних доках [V-docs].

### Origin, User-Agent, cookies, Cloudflare

- Проксі EE2 (`main/src/proxy.ts`) видаляє `origin`, `host`, `sec-*`, `content-length` і ставить `user-agent: app.userAgentFallback` (UA браузера Electron), `useSessionCookies: true`. З відповідей прибирається атрибут `Partitioned` у `Set-Cookie`, бо інакше cookies Cloudflare не зберігаються для `net.request` [V-код]. Дозволені хости: 9 сайтів GGG, `poe.ninja`, `www.poeprices.info`, `api.exiledexchange2.dev` [V-код].
- `Origin` з `tauri://localhost` для PoE2 не перевірено (потрібен POST) [I: той самий сайт і Cloudflare → як у F-12, не заважає].
- **Cloudflare:** HTML-сторінка `/trade2/...` для curl з не-браузерним UA віддає 403 + `Cf-Mitigated: challenge` [V-live], а JSON `/api/trade2/data/leagues` і `/api/leagues` — 200 [V-live]. Чи вимагає сторінка входу (як PoE1 у F-45), визначити не вдалося: її закрив Cloudflare. Інструкція EE2 `docs/failed-load-leagues.md`: при підозрі на бота — кнопка «Browser», пройти перевірку, «Retry»; капча може повторюватися «кожні ~15 хв» [V-код/док EE2]. Механізм F-45 (fetch зсередини сторінки у вбудованому браузері) для PoE2 потрібен так само [I].

## 2. Bulk exchange і Currency Exchange

- `POST /api/trade2/exchange/<league>` **існує й використовується** EE2 (`pathofexile-bulk.ts`) [V-код]. Тіло запиту: `{ engine: "new", query: { have: [...], want: [tradeTag], status: { option }, minimum? }, sort: { have: "asc" } }`. Відповідь: `{ id, result: Record<id, {listing:{indexed, offers:[{exchange:{currency,amount}, item:{amount,stock}}], account}}>, total }`. Лістинги вже є у відповіді, окремий fetch не потрібен, як у PoE1 [V-код]. `status.option`: `available | securable | online | any` (`pathofexile-trade.ts:266`) [V-код].
- **Внутрішньоігровий Currency Exchange** (ринок в Alva) — окремий механізм гри. Публічного API «стакана» ордерів немає [I].
- **GGG Currency Exchange API** [V-docs, частково]: `GET …/currency-exchange[/<realm>][/<id>]`, `realm` = `xbox` | `sony` | `poe2`. Це **лише історія погодинними зрізами**: `next_change_id`, `markets[]` з `league`, `market_id`, `market_pair`, `volume_traded`, `lowest/highest_stock`, `lowest/highest_ratio`. Поточна година недоступна. Хост і OAuth-scope з доків витягти надійно не вдалося: короткий виклад сторінки називав `web.poecdn.com` і «Public API» [I, перевірити вручну]. Сторонній SDK зазначає, що `service:*` scope недоступні публічним клієнтам. GGG зараз **не приймає реєстрацію нових застосунків** [V-docs]. Для десктопного оверлея цей API практично недоступний, а для ціни «зараз» він і не годиться [I].
- Тому курс валют для PoE2 краще брати з poe.ninja `exchange/...`: він сам побудований на даних Currency Exchange (`lines[].maxVolumeCurrency`, `maxVolumeRate`, `volumePrimaryValue`) [V-live + I].

## 3. poe.ninja для PoE2

### Що робить EE2 [V-код]

- **EE2 не звертається до API poe.ninja напряму.** Він бере дані зі свого проксі автора:
  - `api.exiledexchange2.dev/proxy/<leagueId>/overviewData.json` — один склеєний blob з усіма overview;
  - `api.exiledexchange2.dev/proxy/data/namespaceMap.json` — `{schemaVersion:1, map:[{ns:"ITEM"|"GEM"|"UNIQUE", cx, url, type}]}`;
  - `api.exiledexchange2.dev/proxy/data/item-drop.json`.
- Розбір — пошуком підрядка, як в APT: секції `{"type":"…`, курс `{"rates":…"}`, рядок `{"name":…,"variant":…,"primaryValue":`. Порядок ключів важливий (`Prices.ts:263-283, 456-520`).
- Посилання на сайт: `https://poe.ninja/poe2/economy/<slug>/<url>/<detailsId>`, де slug — це lowercase без пробілів, `hc…` → `…hc`, `standard`, `hardcore` (`Prices.ts:250-262, 287`).
- Оновлення: раз на 31 хв, перевірка кожні 4 хв, лише якщо предмети перевіряли в останні 20 хв. Тільки для `realm === "pc-ggg"` (`Prices.ts:60-62, 160`).
- Основні валюти: `exalted` (за замовчуванням), `chaos`, а також `div`. Ціни в overview — **у divine**. `autoCurrency` переводить через `rates[core]`, а поріг «показати в div» — ≈ 1 div ± 6 % (`Prices.ts:66-110, 300-342`).
- Тип `NinjaDenseExchangeInfo`: `name, variant?, primaryValue, detailsId, id, volumePrimaryValue, maxVolumeCurrency, maxVolumeRate, sparkline{totalChange,data}` [V-код]. У проксі `name` вже доданий: в офіційному exchange-рядку його немає.

### Офіційний API poe.ninja [V-docs + V-live]

| Ендпоінт | Параметри |
|---|---|
| `GET /poe2/api/economy/leagues` | — → `[{id, name}]`, перший запис — поточна челендж-ліга |
| `GET /poe2/api/economy/exchange/current/overview` | `league`, `type` |
| `GET /poe2/api/economy/stash/current/item/overview` | `league`, `type` |

- **Exchange `type`:** `Currency, Fragments, Abyss, UncutGems, LineageSupportGems, Essences, SoulCores, Idols, Runes, Ritual (Omens), Expedition, Delirium, Breach, Verisium` (14) [V-docs].
- **Stash `type`:** `UniqueWeapons, UniqueArmours, UniqueAccessories, UniqueFlasks, UniqueCharms, UniqueJewels, UniqueSanctumRelics, UniqueTablets, PrecursorTablets` (9) [V-docs]. Stash-currency overview є лише в PoE1 [V-docs].
- **Exchange-відповідь:** `{ core:{items[3], rates:{exalted:672.9, chaos:10.2}, primary:"divine", secondary:"chaos"}, lines:[{id, primaryValue, volumePrimaryValue, maxVolumeCurrency, maxVolumeRate, sparkline:{totalChange, data[7]}}], items:[{id, name, image, category, detailsId}] }`. Назви — **лише в `items[]`** (зв'язок `lines[].id` ↔ `items[].id`, напр. `exalted` → «Exalted Orb», `detailsId` → `divine-orb`) [V-live].
- **Stash-відповідь:** `{core, lines:[{id(int), itemId, detailsId, name, baseType, variant?, category, primaryValue, listingCount, corrupted, levelRequired, …modifiers, icon, sparkLine}]}`. Зверніть увагу на регістр: **`sparkLine`** проти `sparkline` в exchange [V-live]. Базова валюта теж `divine` [V-live]. Є викиди: `The Gnashing Sash` = 5060 div при `listingCount: 6`, тож треба фільтрувати за `listingCount` [V-live].
- **Графік:** 7 точок, останнє значення дорівнює `totalChange` (напр. `[…, 1.5, 2.79]`, `totalChange: 2.79`). Отже, це накопичена зміна за 7 днів, як у PoE1 (F-34). `null` означає день без даних [V-live].
- **Оновлення:** PoE2 приблизно раз на годину (PoE1 — 15 хв). Відповідь кешується ~5 хв, `ETag` (у живих відповідях `cache-control: no-cache`, `etag: W/…`), тож варто слати `If-None-Match` [V-docs + V-live]. Числових лімітів немає, «надмірних» клієнтів блокують [V-docs].
- **Порівняння з PoE1:** у PoE1 один `GET /poe1/api/economy/current/dense/overviews` (F-33) дає все. Для PoE2 щільного ендпоінта в документації немає: «все» — це 14 + 9 = 23 запити на лігу. Чи є недокументований `/poe2/api/economy/current/dense/overviews`, не перевірено (вичерпано ліміт запитів) [I]. Саме тому EE2 і тримає свій проксі.
- **Політика poe.ninja:** описовий UA з контактом; **десктопним застосункам радять ходити через свій бекенд**, а не з машин користувачів; не дублювати сайт; не-economy ендпоінти заборонені третім сторонам; без версіонування і SLA [V-docs].

## 4. Сайти з інформацією про предмети

| Сервіс | URL у EE2 | Мови | Джерело |
|---|---|---|---|
| Wiki | `https://www.poe2wiki.net/wiki/<refName>` | лише англ. | `item-check/hotkeyable-actions.ts:116` [V-код] |
| poe2db | `https://poe2db.tw/<lang>/<path>`, де `path` будує `getPoe2dbPath` (+ мапа `POE2DB_CONVERSIONS`) | `en→us, ru→ru, cmn-Hant→tw, ko→kr, ja→jp, de→de, es→sp, pt→pt, fr→fr` | там само, `:7-17, 120` [V-код] |
| Craft of Exile | `https://craftofexile.com/?game=poe2&eimport=<encodeURIComponent(rawText)>` | — | там само, `:125` [V-код] |
| poe.ninja | `https://poe.ninja/poe2/economy/<slug>/<url>/<detailsId>` | — | `Prices.ts:287` [V-код] |

- **ML-оцінка цін:** код `price-prediction/poeprices.ts` в EE2 лишився, але з коментарем `FIXME: check this if poeprices ever gets poe2 support`, а ціни в exalted відкидає [V-код]. Сам poeprices.info закрито (F-46). Аналога для PoE2 не знайдено [I].

## 5. Локалізовані сайти й мови клієнта

| Мова EE2 (`language`) | Trade-хост (`poeWebApi`) | Джерело |
|---|---|---|
| en | `www.pathofexile.com` | `Config.ts:91-115` [V-код] |
| ru | `ru.pathofexile.com` | [V-код] |
| cmn-Hant | `pathofexile.tw` (лише `pc-garena`), інакше `www` з англ. назвами (`useEn`) | [V-код] |
| ko | `poe.kakaogames.com` | [V-код] |
| ja | `jp.pathofexile.com` | [V-код] |
| de / es / pt / fr | `de.` / `es.` / `br.` / `fr.pathofexile.com` | [V-код] |

- Налаштування `preferredTradeSite === "www"` примусово ставить `www` і англійські назви, як `useIntlSite` у F-60 [V-код].
- Чи відкривається `/trade2` на кожному мовному хості, живими запитами **не перевірено** [I: EE2 будує ці URL і проксіює ці хости, тож, найімовірніше, так].
- Мови клієнта PoE2, які покриває EE2: 9 вище. Є також папка даних `renderer/public/data/th` (тайська), але в `language` її немає, тому тайського сайту EE2 не знає [V-код]. Для порту з F-60 (`en`, `ru`) дані — `renderer/public/data/{en,ru}` [V-код].

## 6. Політика GGG для сторонніх інструментів [V-docs]

- UA для **офіційного API**: `OAuth {clientId}/{version} (contact: {contact}) …`. Trade-сайт не є частиною документованого API. APT/EE2 шлють UA браузера через Electron [V-код]. Для нас — свій описовий UA, як у PoE1 (`PoeTradeOverlay/0.1.0 (+…)`) [I].
- OAuth 2.1. Виконувані застосунки мають бути публічними клієнтами. **Нові реєстрації зараз не обробляються.** Багато 4xx може призвести до обмеження доступу.
- Standalone-програми «дозволені, але не рекомендуються». Автоматизація вводу: одна дія на одне ручне натискання. Взаємодія з процесом або файлами гри заборонена (ToS 7b, 7c, 7i). Читати лог-файл можна.
- «Only use resources in the API Reference or Data Exports»: trade2 API туди не входить. Формально це сіра зона (7i), але на ній тримаються всі оверлеї (APT, EE2, Sidekick) [I].
- Обов'язкова примітка: «This product isn't affiliated with or endorsed by Grinding Gear Games in any way.»

## Висновки для Price of Exile 2

1. У `constants.ts` замінити шляхи на `/api/trade2/*` і `/trade2/{search,exchange}/poe2/<league>`. Ліги брати з `/api/trade2/data/leagues`; постійні ліги — `Standard`/`Hardcore`, HC має префікс `HC `. Челендж-лігу вибирати не за індексом (як EE2), а за першою не-постійною лігою або з poe.ninja `leagues[0]`.
2. Лімітер і Cloudflare (F-45, F-51) перенести без змін. Відповіді без `X-Rate-Limit-*` (кеш CF) є нормою.
3. poe.ninja: або свій кешуючий проксі (рекомендація poe.ninja; так робить EE2), або 23 запити `exchange`/`stash` на лігу раз на годину з `If-None-Match`. Ціни в **divine**, назви exchange — з `items[]`, `sparkline`/`sparkLine`, фільтр за `listingCount`.
4. Вкладки Wiki / poe2db / CoE — за URL з таблиці розділу 4. poeprices не переносити.

## Джерела

- poe.ninja API docs: https://poe.ninja/docs/api
- GGG developer docs: https://www.pathofexile.com/developer/docs, https://www.pathofexile.com/developer/docs/reference
- Ліги (новини, [I]): https://www.pcgamesn.com/path-of-exile-2/update-forbidden-rites-league, https://www.poe2wiki.net/wiki/Runes_of_Aldur, https://mobalytics.gg/poe-2/guides/runes-of-aldur
- SDK про `service:*` scope ([I]): https://app.unpkg.com/poe-js-sdk@1.6.1/files/README.md
- Код EE2: `_upstream/ee2/renderer/src/web/{Config.ts, background/{Leagues,Prices,TradeData}.ts, price-check/trade/*.ts, item-check/hotkeyable-actions.ts}`, `main/src/proxy.ts`, `docs/failed-load-leagues.md`
- PoE1: `poe-trade-overlay/docs/FINDINGS.md` (F-12, F-16, F-23, F-33, F-34, F-45, F-46, F-51, F-60)
