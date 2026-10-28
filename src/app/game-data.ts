import { signal } from '@angular/core';
import { init, setDataSource, type DataSource } from '@/assets/data';
import { DATA_PATH, DEFAULT_LANG, Lang } from './constants';

const dataUrl = (path: string) => new URL(`${DATA_PATH}/${path}`, document.baseURI).href;

async function get(path: string): Promise<Response> {
  const response = await fetch(dataUrl(path));
  if (!response.ok) {
    throw new Error(`Failed to load game data "${path}": HTTP ${response.status}`);
  }
  return response;
}

const browserSource: DataSource = {
  text: async (path) => (await get(path)).text(),
  binary: async (path) => (await get(path)).arrayBuffer(),
  // client_strings.js holds RegExps, so it is a JS module rather than JSON.
  clientStrings: async (path) => (await import(/* @vite-ignore */ dataUrl(path))).default,
};

let loading: { lang: Lang; done: Promise<void> } | undefined;

/** Set once the game data is in: views that look items up (currency icons) wait for it. */
export const gameDataLoaded = signal(false);

/**
 * Loads items, stats and client strings of the game language; parsing items requires it. Once per
 * language: another language (changed in the settings) loads that one's data instead.
 */
export function loadGameData(lang: Lang = DEFAULT_LANG): Promise<void> {
  if (loading?.lang !== lang) {
    setDataSource(browserSource);
    gameDataLoaded.set(false);
    const done = init(lang).then(() => gameDataLoaded.set(true));
    loading = { lang, done };
  }
  return loading.done;
}
