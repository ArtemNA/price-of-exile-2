import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BULK_LISTING_TYPES,
  CLOUDFLARE_CHECK_ERROR,
  DEFAULT_CURRENCY_OPTIONS,
  ERROR_TEMPLATES,
  ITEM_CHIP_SHORT_LABELS,
  LISTING_TYPES,
  MAP_CHECK_NUMBERS,
  MAP_MOD_TYPE_LABELS,
  MODS_PRESET_LABEL,
  STAT_GROUP_OTHER,
  STAT_GROUPS,
  UI_LANGS as LANGUAGES,
} from '../src/app/constants';
import { t } from '../src/app/core/i18n';
import { THEMES } from '../src/app/themes';
import { _INTERNAL_TRADE_IDS, FilterTag } from '../src/lib/ee2/web/price-check/filters/interfaces';
import { loadI18nFromDisk } from './game-data';

// Every interface text has a Ukrainian and a Russian translation (public/i18n/{uk,ru}.json):
// our English texts (`tr`) and the EE2 keys (`t`) the app shows. English needs no file.

const SRC = new URL('../src/app/', import.meta.url);
const json = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf-8'));
const UI_LANGS = ['uk', 'ru'] as const;
const dictionaries = Object.fromEntries(UI_LANGS.map((lang) => [lang, json(`../public/i18n/${lang}.json`)])) as Record<
  (typeof UI_LANGS)[number],
  { apt: Record<string, unknown>; ui: Record<string, string> }
>;

function flatten(obj: Record<string, unknown>, prefix = '', out: Record<string, string> = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flatten(value as Record<string, unknown>, path, out);
    else out[path] = String(value);
  }
  return out;
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : /\.(ts|html)$/.test(name) ? [path] : [];
  });
}

/** Language names are shown as they call themselves, theme names as they are: untranslated. */
const NATIVE_NAMES = new Set([...LANGUAGES.map((lang) => lang.label), ...THEMES.map((theme) => theme.label)]);

const STRING = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g;
/** The texts of the string literals in `code`, skipping those compared with `===` / `!==` (values, not texts). */
function literals(code: string, html: boolean): string[] {
  const texts: string[] = [];
  for (const match of code.matchAll(STRING)) {
    if (/[!=]==\s*$/.test(code.slice(0, match.index))) continue;
    let text = (match[1] ?? match[2]).replace(/\\(.)/g, '$1');
    // Angular decodes entities in attribute values before it reads the expression.
    if (html) text = text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
    if (/[A-Za-z]/.test(text)) texts.push(text);
  }
  return texts;
}

/** A balanced `( … )` group ending at `end` (exclusive), or null. */
function groupBefore(code: string, end: number): string | null {
  let depth = 0;
  for (let i = end - 1; i >= 0; i--) {
    if (code[i] === ')') depth++;
    else if (code[i] === '(' && --depth === 0) return code.slice(i, end);
  }
  return null;
}

/** English texts passed to `tr` as literals: `tr('…')`, `'…' | tr`, `(a ? '…' : '…') | tr`, and the label tables. */
function trTexts(): Map<string, string> {
  const found = new Map<string, string>();
  const add = (text: string, where: string) => found.has(text) || found.set(text, where);
  for (const path of sources(SRC.pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
    const code = readFileSync(path, 'utf-8');
    const html = path.endsWith('.html');
    const where = path.slice(path.indexOf('src'));
    for (const match of code.matchAll(/\btr\(/g)) {
      const start = match.index + 3;
      const args = groupBefore(code, closing(code, start));
      // Only the first argument is the text: the rest fill its {0}, {1}…
      if (args) for (const text of literals(firstArgument(args.slice(1, -1)), html)) add(text, where);
    }
    for (const match of code.matchAll(/\|\s*tr\b/g)) {
      const before = code.slice(0, match.index).trimEnd();
      if (before.endsWith(')')) {
        const group = groupBefore(before, before.length);
        if (group) for (const text of literals(group, html)) add(text, where);
      } else {
        const last = [...before.matchAll(STRING)].at(-1);
        if (last && last.index + last[0].length === before.length) for (const text of literals(last[0], html)) add(text, where);
      }
    }
    // Option tables and ng-template contexts the templates translate: { label: '…', hint: '…' }.
    for (const match of code.matchAll(/\b(?:label|hint|summary|title)\??:\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")/g)) {
      if (!html && match[0].startsWith('title')) continue;
      for (const text of literals(match[1], html)) if (!NATIVE_NAMES.has(text)) add(text, where);
    }
    // Messages the templates show with `message | tr`.
    for (const match of code.matchAll(/\berror\.set\(('(?:[^'\\\n]|\\.)*')\)/g)) {
      for (const text of literals(match[1], html)) add(text, where);
    }
  }
  return found;
}

function closing(code: string, open: number): number {
  let depth = 1;
  let quote: string | null = null;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i + 1;
  }
  return code.length;
}

function firstArgument(args: string): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const c = args[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === "'" || c === '"' || c === '`') quote = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) return args.slice(0, i);
  }
  return args;
}

/** String values of the object literal `const <name> … = { … };` in a source file. */
function objectValues(file: string, name: string): string[] {
  const code = readFileSync(new URL(file, SRC), 'utf-8');
  const start = code.indexOf(`const ${name}`);
  const body = code.slice(code.indexOf('{', code.indexOf('=', start)), code.indexOf('};', start));
  return [...body.matchAll(/:\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")/g)].flatMap((m) => literals(m[1], false));
}

/** Texts that reach `tr` through variables: the constants and tables the scan cannot follow. */
const VARIABLE_TEXTS = [
  ...STAT_GROUPS.map((group) => group.name),
  STAT_GROUP_OTHER,
  MODS_PRESET_LABEL,
  CLOUDFLARE_CHECK_ERROR,
  ...ERROR_TEMPLATES,
  ...Object.values(ITEM_CHIP_SHORT_LABELS),
  ...Object.values(MAP_MOD_TYPE_LABELS),
  ...MAP_CHECK_NUMBERS.map((number) => number.label),
  ...[...LISTING_TYPES, ...BULK_LISTING_TYPES].flatMap((type) => [type.label, type.summary, type.hint]),
  ...DEFAULT_CURRENCY_OPTIONS.map((option) => option.label),
  ...objectValues('settings/settings-window.ts', 'COPY_KEYS_SOURCES'),
  // Seller status of a listing (trade2 `account.online`), `line.row.accountStatus | tr`.
  'online',
  'offline',
  'afk',
  // Item check flags (`tr(flag)`).
  'Corrupted',
  'Mirrored',
  'Unidentified',
];

/**
 * EE2 keys the app reads with `t`: literal ones in the templates and code, the item property
 * labels of filter rows (`INTERNAL_TRADE_IDS`), header chips and stat tags.
 */
function tKeys(): string[] {
  const keys = new Set<string>();
  for (const path of sources(SRC.pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
    const code = readFileSync(path, 'utf-8');
    for (const match of code.matchAll(/'([a-z_]+\.[a-z_.]+)'\s*\|\s*t\b|\bt\('([a-z_]+\.[a-z_.]+)'/g)) keys.add(match[1] ?? match[2]);
    for (const match of code.matchAll(/\['\w+', '(item\.[a-z_]+)'\]/g)) keys.add(match[1]);
  }
  for (const id of _INTERNAL_TRADE_IDS) keys.add(id);
  for (const key of ['corrupted', 'mirrored', 'sanctified']) keys.add(`item.${key}`).add(`item.not_${key}`);
  keys.add('item.unidentified').add('item.parse_error').add('item.unknown');
  keys.add('filters.preset_pseudo').add('filters.preset_base_item');
  // statTag: explicit, pseudo and property rows have no tag.
  for (const tag of Object.values(FilterTag)) {
    if (!['explicit', 'pseudo', 'property'].includes(tag)) keys.add(`filters.tag_${tag.replace('-', '_')}`);
  }
  return [...keys].sort();
}

describe('interface translations', () => {
  const texts = trTexts();
  for (const text of VARIABLE_TEXTS) if (!texts.has(text)) texts.set(text, 'constants');

  it('finds the texts it checks', () => {
    // A scan that broke would pass with nothing to check.
    expect(texts.size).toBeGreaterThan(300);
    expect(texts.has('Search again')).toBe(true);
    expect(texts.has('Install and restart')).toBe(true);
    expect(texts.has('Search text, e.g. "Waystone Tier"')).toBe(true);
    expect(texts.has("The presets' own hotkeys")).toBe(true);
    expect(texts.has('No league selected: choose one in the title bar.')).toBe(true);
  });

  it.each(UI_LANGS)('has every tr() text in %s.json', (lang) => {
    const ui = dictionaries[lang].ui;
    const missing = [...texts].filter(([text]) => !ui[text]).map(([text, where]) => `${where}: ${text}`);
    expect(missing).toEqual([]);
  });

  it.each(UI_LANGS)('keeps the {0} placeholders of every text in %s.json', (lang) => {
    const ui = dictionaries[lang].ui;
    const placeholders = (text: string) => [...text.matchAll(/\{\d\}/g)].map((m) => m[0]).sort();
    const broken = Object.entries(ui).filter(([en, tr]) => placeholders(en).join() !== placeholders(tr).join());
    expect(broken).toEqual([]);
  });

  it.each(UI_LANGS)('has every EE2 key the app shows in %s.json', (lang) => {
    const en = flatten(json('../public/data/en/app_i18n.json'));
    const apt = flatten(dictionaries[lang].apt);
    const keys = tKeys();
    expect(keys.length).toBeGreaterThan(50);
    expect(keys.filter((key) => !en[key])).toEqual([]);
    expect(keys.filter((key) => !apt[key])).toEqual([]);
  });

  it("puts the game's words in place of the wrong English texts of EE2", async () => {
    await loadI18nFromDisk();
    expect(t('item.map_magic_monsters', 12)).toBe('Magic Monsters: +12%');
    expect(t('item.map_rare_monsters', 30)).toBe('Rare Monsters: +30%');
    expect(t('item.map_pack_size', 9)).toBe('Monster Pack Size: +9%');
  });
});
