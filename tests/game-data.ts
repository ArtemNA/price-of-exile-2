import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { init, setDataSource } from '@/assets/data';

const dataPath = (path: string) => fileURLToPath(new URL(`../public/data/${path}`, import.meta.url));

let loading: Promise<void> | undefined;
let loadedLang: string | undefined;

/** Loads public/data from disk, the way the app loads it over HTTP (each test file has its own module state). */
export function loadGameDataFromDisk(): Promise<void> {
  return loadGameDataInLanguage('en');
}

/** The same in another game language (public/data/<lang>). */
export function loadGameDataInLanguage(lang: string): Promise<void> {
  if (!loading || loadedLang !== lang) {
    loadedLang = lang;
    setDataSource({
      text: (path) => readFile(dataPath(path), 'utf-8'),
      binary: async (path) => {
        const buf = await readFile(dataPath(path));
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      },
      // client_strings.js is an ES module; import it without a package.json "type".
      clientStrings: async (path) => {
        const code = await readFile(dataPath(path), 'utf-8');
        const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
        return (await import(/* @vite-ignore */ url)).default;
      },
    });
    loading = init(lang);
  }
  return loading;
}
