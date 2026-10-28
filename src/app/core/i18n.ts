import { Pipe, PipeTransform, signal } from '@angular/core';
import { DATA_PATH, DEFAULT_LANG, Lang, UI_I18N_PATH, UiLang } from '../constants';

// Two kinds of interface text:
// - APT's keys ("filters.tag_crafted") from APT's public/data/<lang>/app_i18n.json, read with `t`;
// - our own texts, written in English in the templates and read with `tr` ("Search again").
// An interface language other than English is public/i18n/<id>.json: `apt` overrides APT's keys,
// `ui` maps our English texts to the translation. Whatever is missing there stays English.
const dict = signal<Record<string, string>>({});
const ui = signal<{ apt: Record<string, string>; ui: Record<string, string> }>({ apt: {}, ui: {} });
const uiLang = signal<UiLang>('en');

/** The current interface language (the `lang` of the page). */
export const interfaceLanguage = uiLang.asReadonly();

function flatten(obj: Record<string, unknown>, prefix = '', out: Record<string, string> = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flatten(value as Record<string, unknown>, path, out);
    else out[path] = String(value);
  }
  return out;
}

export async function loadI18n(lang: Lang = DEFAULT_LANG): Promise<void> {
  const url = new URL(`${DATA_PATH}/${lang}/app_i18n.json`, document.baseURI).href;
  dict.set(flatten(await (await fetch(url)).json()));
}

/** Switches the interface texts; English needs no file. */
export async function loadUiLanguage(lang: UiLang): Promise<void> {
  if (lang === uiLang() && (lang === 'en' || Object.keys(ui().ui).length)) return;
  if (lang === 'en') {
    ui.set({ apt: {}, ui: {} });
  } else {
    const url = new URL(`${UI_I18N_PATH}/${lang}.json`, document.baseURI).href;
    const file = (await (await fetch(url)).json()) as { apt?: Record<string, unknown>; ui?: Record<string, string> };
    ui.set({ apt: flatten(file.apt ?? {}), ui: file.ui ?? {} });
  }
  uiLang.set(lang);
  document.documentElement.lang = lang;
}

const fill = (text: string, args: Array<string | number>) =>
  args.length ? text.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? '')) : text;

/** Translates APT's `key`, replacing `{0}`, `{1}`… with `args`. Missing keys are returned as is. */
export function t(key: string, ...args: Array<string | number>): string {
  return fill(ui().apt[key] ?? dict()[key] ?? key, args);
}

/** Translates our own English `text` (`{0}`, `{1}`… take `args`); untranslated text stays English. */
export function tr(text: string, ...args: Array<string | number>): string {
  return fill(ui().ui[text] ?? text, args);
}

// Not pure: the result changes when the language does, not only when the key does.
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  transform(key: string, ...args: Array<string | number>): string {
    return t(key, ...args);
  }
}

@Pipe({ name: 'tr', pure: false })
export class TrPipe implements PipeTransform {
  transform(text: string, ...args: Array<string | number>): string {
    return tr(text, ...args);
  }
}
