import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { parseClipboard, type ParsedItem } from '@/parser';
import { poeWebApi } from '../src/app/apt-shims/web-config';
import { updateSettings } from '../src/app/core/settings';
import { activePreset, createItemPresets } from '../src/app/price-check/price-check';
import { tradeSiteUrl } from '../src/app/price-check/trade-search';
import { bulkSiteUrl } from '../src/app/price-check/bulk-search';
import { leaguesUrl } from '../src/app/core/leagues';
import type { StatFilter } from '../src/lib/apt/web/price-check/filters/interfaces';
import { loadGameDataInLanguage } from './game-data';

// The Russian game: its data (public/data/ru) and its trade site, ru.pathofexile.com.
// The Russian site must never be used for a game in English (FINDINGS F-60).

beforeAll(() => loadGameDataInLanguage('ru'));
afterEach(() => updateSettings({ language: 'en', useIntlSite: false }));

const parse = (text: string): ParsedItem => parseClipboard(text)._unsafeUnwrap();

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
    const { filters, stats } = activePreset(createItemPresets(item, 'Mercenaries'));
    expect(tradeSiteUrl(filters, stats, 'Q1')).toBe('https://ru.pathofexile.com/trade/search/Mercenaries/Q1');
    expect(bulkSiteUrl(item, filters, 'divine')).toMatch(/^https:\/\/ru\.pathofexile\.com\/trade\/exchange\//);
    updateSettings({ language: 'en' });
    expect(tradeSiteUrl(filters, stats, 'Q1')).toBe('https://www.pathofexile.com/trade/search/Mercenaries/Q1');
    expect(bulkSiteUrl(item, filters, 'divine')).toMatch(/^https:\/\/www\.pathofexile\.com\//);
  });
});

describe('Russian item text', () => {
  it('parses a rare ring with its mods into pseudo filters', () => {
    const item = parse(RU_RARE_RING);
    expect(item.info.refName).toBe('Sapphire Ring');
    expect(item.info.name).toBe('Кольцо с сапфиром');
    expect(item.itemLevel).toBe(84);
    const stats = activePreset(createItemPresets(item, 'Mercenaries')).stats as StatFilter[];
    const life = stats.find((s) => s.statRef === '+# total maximum Life');
    expect(life).toMatchObject({ disabled: false, roll: { value: 68 } });
    expect(stats.find((s) => s.statRef === '+#% total Elemental Resistance')).toMatchObject({ roll: { value: 72 } });
  });

  it('parses currency by its Russian name, with the English refName for poe.ninja', () => {
    const item = parse(RU_CHAOS);
    expect(item.info.refName).toBe('Chaos Orb');
    expect(item.stackSize?.value).toBe(15);
  });
});
