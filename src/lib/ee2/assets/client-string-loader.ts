import { TranslationDict } from "./data/interfaces";
import { getDataSource } from "./data"; // [port]

export async function loadClientStrings(
  lang: string,
): Promise<TranslationDict> {
  // [port] Vite `import(import.meta.env.BASE_URL + ...)` replaced with the data source of ./data.
  return getDataSource().clientStrings(`${lang}/client_strings.js`);
}
