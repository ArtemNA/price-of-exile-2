import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { parseClipboard, type ParsedItem } from '@/parser';
import { ModifierType } from '@/parser/modifiers';
import { STAT_BY_MATCH_STR } from '@/assets/data';
import { DEFAULT_MAP_CHECK, DEFAULT_MAP_MARKS } from '../src/app/constants';
import { setHttpFetch } from '../src/app/core/http';
import { itemAction } from '../src/app/core/item-links';
import { allAreaMods, filterAreaMods, mapCheckView, withDecision } from '../src/app/map-check/map-check';
import { poeWebApi } from '../src/app/ee2-shims/web-config';
import { updateSettings } from '../src/app/core/settings';
import { activePreset, createItemPresets } from '../src/app/price-check/price-check';
import { TradeSearch, tradeSiteUrl } from '../src/app/price-check/trade-search';
import { itemFilterChips } from '../src/app/price-check/item-filter-chips';
import { bulkSiteUrl } from '../src/app/price-check/bulk-search';
import { type ApiLeague, leaguesUrl, pickLeague, toTradeLeagues } from '../src/app/core/leagues';
import { loadGameDataInLanguage } from './game-data';

// The Russian game: its data (public/data/ru) and its trade site, ru.pathofexile.com.
// The Russian site must never be used for a game in English (FINDINGS F-60).

beforeAll(() => loadGameDataInLanguage('ru'));
afterEach(() => updateSettings({ language: 'en', useIntlSite: false }));

const parse = (text: string): ParsedItem => parseClipboard(text)._unsafeUnwrap();

// From Price of Exile: a Russian PoE1 text (PoE1 mod headers, "Свойство-префикс"); the mods are in PoE2 too.
const RU_RARE_RING = `Класс предмета: Кольца
Редкость: Редкий
Петля бури
Кольцо с сапфиром
--------
Требования:
Уровень: 52
--------
Уровень предмета: 84
--------
{ Собственное свойство — Стихии, Холод, Сопротивление }
+30(20-30)% к сопротивлению холоду
--------
{ Свойство-префикс "Тучный" (Уровень: 4) — Здоровье }
+68(60-69) к максимуму здоровья
{ Свойство-суффикс "вулкана" (Уровень: 3) — Стихии, Огонь, Сопротивление }
+42(42-45)% к сопротивлению огню
`;

const RU_CHAOS = `Класс предмета: Стопки валюты
Редкость: Валюта
Сфера хаоса
--------
Размер стопки: 15/20
--------
Изменяет редкий предмет, давая ему новые случайные свойства
`;

describe('trade site per game language', () => {
  it('uses www for the English game, whatever the other options', () => {
    updateSettings({ language: 'en', useIntlSite: false });
    expect(poeWebApi()).toBe('www.pathofexile.com');
    updateSettings({ language: 'en', useIntlSite: true });
    expect(poeWebApi()).toBe('www.pathofexile.com');
    expect(leaguesUrl()).toMatch(/^https:\/\/www\.pathofexile\.com\//);
  });

  it('uses ru for the Russian game, www with the international site option', () => {
    updateSettings({ language: 'ru', useIntlSite: false });
    expect(poeWebApi()).toBe('ru.pathofexile.com');
    expect(leaguesUrl()).toMatch(/^https:\/\/ru\.pathofexile\.com\//);
    updateSettings({ language: 'ru', useIntlSite: true });
    expect(poeWebApi()).toBe('www.pathofexile.com');
  });

  it('links the trade site and bulk exchange of the game language', () => {
    updateSettings({ language: 'ru' });
    const item = parse(RU_CHAOS);
    const { filters, stats } = activePreset(createItemPresets(item, 'Standard'));
    expect(tradeSiteUrl(filters, stats, item, 'Q1')).toBe('https://ru.pathofexile.com/trade2/search/poe2/Standard/Q1');
    expect(bulkSiteUrl(item, filters, 'divine')).toMatch(/^https:\/\/ru\.pathofexile\.com\/trade2\/exchange\/poe2\//);
    updateSettings({ language: 'en' });
    expect(tradeSiteUrl(filters, stats, item, 'Q1')).toBe('https://www.pathofexile.com/trade2/search/poe2/Standard/Q1');
    expect(bulkSiteUrl(item, filters, 'divine')).toMatch(/^https:\/\/www\.pathofexile\.com\//);
  });
});

describe('Russian item text', () => {
  it('parses a rare ring with its mods into pseudo filters', () => {
    const item = parse(RU_RARE_RING);
    expect(item.info.refName).toBe('Sapphire Ring');
    expect(item.info.name).toBe('Кольцо с сапфиром');
    expect(item.itemLevel).toBe(84);
    const stats = activePreset(createItemPresets(item, 'Standard')).stats;
    const life = stats.find((s) => s.statRef === '+# total maximum Life');
    expect(life).toMatchObject({ disabled: false, roll: { value: 68 } });
    expect(stats.find((s) => s.statRef === '#% total Elemental Resistance')).toMatchObject({ roll: { value: 72 } });
  });

  it('parses currency by its Russian name, with the English refName for poe.ninja', () => {
    const item = parse(RU_CHAOS);
    expect(item.info.refName).toBe('Chaos Orb');
    expect(item.stackSize?.value).toBe(15);
  });
});

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf-8');

// No Russian PoE2 item text is copied from the game yet (EE2 has none either). These are put
// together from the ru.pathofexile.com trade2 answer (tests/fixtures/trade2-fetch-ru-prismatic-ring.json,
// 30.10.2026): names, mod texts with ranges, affix names and tiers as GGG sends them, laid out as
// the English Ctrl+Alt+C text with the headers of EE2's ru client strings; mod tags are left out.
describe('Russian item texts from the trade site', () => {
  const FIXTURES = new URL('./fixtures/items-ru/', import.meta.url);
  const files = readdirSync(FIXTURES).filter((file) => file.endsWith('.txt'));

  it.each(files)('knows every mod line of %s', (file) => {
    const item = parse(readFileSync(new URL(file, FIXTURES), 'utf-8'));
    expect(item.info.refName).toBe('Prismatic Ring');
    expect(item.info.name).toBe('Радужное кольцо');
    expect(item.unknownModifiers).toEqual([]);
  });

  it('reads tiers, affix names and the pseudo totals', () => {
    const item = parse(fixture('items-ru/rare-ring-life-res.txt'));
    expect(item.itemLevel).toBe(79);
    expect(item.requires?.level).toBe(56);
    const explicits = item.newMods.filter((mod) => mod.info.type === ModifierType.Explicit);
    expect(explicits.map((mod) => [mod.info.generation, mod.info.tier, mod.info.name])).toEqual([
      ['prefix', 1, 'Прыткий'],
      ['prefix', 5, 'Стойкий'],
      ['suffix', 5, 'кристалла'],
      ['suffix', 2, 'магмы'],
    ]);
    const stats = activePreset(createItemPresets(item, 'Standard')).stats;
    expect(stats.find((s) => s.statRef === '+# total maximum Life')).toMatchObject({ roll: { value: 43 } });
    // 8 + 4 to all, three times, and 37 fire.
    expect(stats.find((s) => s.statRef === '#% total Elemental Resistance')).toMatchObject({ roll: { value: 73 } });
  });
});

describe('ru.pathofexile.com answers', () => {
  it('lists the same league ids as www, with Russian texts', () => {
    const ru: ApiLeague[] = JSON.parse(fixture('leagues-trade2-ru.json')).result;
    const en: ApiLeague[] = JSON.parse(fixture('leagues-trade2.json')).result;
    expect(ru.find((league) => league.id === 'Forbidden Rites')?.text).toBe('Запретные ритуалы');
    expect(toTradeLeagues(ru)).toEqual(toTradeLeagues(en));
    expect(pickLeague(toTradeLeagues(ru), undefined)).toBe('Forbidden Rites');
  });

  it('searches ru.pathofexile.com by the Russian base name and reads its listings', async () => {
    const search = JSON.parse(fixture('trade2-search-ru-prismatic-ring.json')) as { id: string; result: string[] };
    const fetched = JSON.parse(fixture('trade2-fetch-ru-prismatic-ring.json'));
    const requests: Array<{ url: string; body?: { query: { type?: string } } }> = [];
    setHttpFetch(async (input, init) => {
      const url = String(input);
      requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.includes('/api/trade2/search/')) return Response.json({ ...search, result: search.result.slice(0, 2) });
      return Response.json({ result: fetched.result.slice(0, 2) });
    });
    updateSettings({ language: 'ru' });
    const item = parse(fixture('items-ru/rare-ring-life-res.txt'));
    const preset = activePreset(createItemPresets(item, 'Forbidden Rites'));
    itemFilterChips(preset.filters).find((chip) => chip.key === 'base')!.toggle();
    const trade = new TradeSearch();
    await trade.search(preset.filters, preset.stats, item);

    expect(trade.error()).toBeNull();
    expect(requests[0].url).toBe('https://ru.pathofexile.com/api/trade2/search/Forbidden Rites');
    // The ru site knows only Russian base names: "Prismatic Ring" there is "Unknown item base type".
    expect(requests[0].body?.query.type).toBe('Радужное кольцо');
    expect(requests[1].url).toMatch(/^https:\/\/ru\.pathofexile\.com\/api\/trade2\/fetch\//);
    expect(trade.rows().map((row) => `${row.priceAmount} ${row.priceCurrency}`)).toEqual(['1 aug', '1 transmute']);
  });

  it('searches www by the English base name with the international site option', () => {
    updateSettings({ language: 'ru', useIntlSite: true });
    const item = parse(fixture('items-ru/rare-ring-life-res.txt'));
    const { filters } = activePreset(createItemPresets(item, 'Standard'));
    expect(filters.searchExact.baseTypeTrade).toBe('Prismatic Ring');
  });
});

describe('map check in the Russian game', () => {
  it('has Russian default marks that are waystone mods of the ru data', () => {
    const areaMods = new Set(allAreaMods().map((m) => m.matchStr));
    for (const { matcher } of DEFAULT_MAP_MARKS.ru) {
      expect(STAT_BY_MATCH_STR(matcher), matcher).toBeDefined();
      expect(areaMods.has(matcher), matcher).toBe(true);
    }
    const all = allAreaMods();
    const selected = filterAreaMods(all, DEFAULT_MAP_CHECK, '', true).map((m) => m.matchStr);
    expect(selected.toSorted()).toEqual(DEFAULT_MAP_MARKS.ru.map((m) => m.matcher).toSorted());
    expect(filterAreaMods(all, DEFAULT_MAP_CHECK, 'путами', false).map((m) => m.matchStr)).toEqual(['Область проклята Путами времени']);
  });

  it('does not take the English marks for outdated Russian ones', () => {
    const item = parse(fixture('items-ru/rare-ring-life-res.txt'));
    expect(mapCheckView(item, DEFAULT_MAP_CHECK).hasOutdated).toBe(false);
    const outdated = withDecision(DEFAULT_MAP_CHECK, 'Монстры отражают #% физического урона', 'd');
    expect(mapCheckView(item, outdated).hasOutdated).toBe(true);
  });
});

describe('item links in the Russian game', () => {
  it('opens PoE2DB in Russian, the wiki by the English name and searches the stash by the Russian one', () => {
    const ring = parse(fixture('items-ru/rare-ring-life-res.txt'));
    expect(itemAction('poedb', ring, 'ru')).toEqual({ open: 'https://poe2db.tw/ru/Rings#ModifiersCalc' });
    expect(itemAction('wiki', ring, 'ru')).toEqual({ open: 'https://www.poe2wiki.net/wiki/Prismatic_Ring' });
    expect(itemAction('stash-search', ring, 'ru')).toEqual({ stashSearch: '"Радужное кольцо"' });
  });
});
