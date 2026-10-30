import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLOUDFLARE_CHECK_ERROR, USER_AGENT } from '../src/app/constants';
import { isCloudflareCheck, poeFetch, restrictedSeconds, setHttpFetch } from '../src/app/core/http';
import { loadUiLanguage, trError } from '../src/app/core/i18n';

const challenge = () =>
  new Response('<html>Just a moment...</html>', { status: 403, headers: { 'content-type': 'text/html; charset=UTF-8', 'cf-mitigated': 'challenge' } });

describe('poe fetch', () => {
  afterEach(() => setHttpFetch(globalThis.fetch));

  it('recognises the Cloudflare check', () => {
    expect(isCloudflareCheck(challenge())).toBe(true);
    expect(isCloudflareCheck(new Response('<html></html>', { status: 503, headers: { 'content-type': 'text/html' } }))).toBe(true);
    expect(isCloudflareCheck(new Response('{"error":{}}', { status: 400, headers: { 'content-type': 'application/json' } }))).toBe(false);
  });

  it('turns a Cloudflare check on pathofexile.com into a clear error, sends our User-Agent', async () => {
    let userAgent: string | null = null;
    setHttpFetch(async (_, init) => {
      userAgent = new Headers(init?.headers).get('User-Agent');
      return challenge();
    });
    await expect(poeFetch('https://www.pathofexile.com/api/trade/search/Standard')).rejects.toThrow(CLOUDFLARE_CHECK_ERROR);
    expect(userAgent).toBe(USER_AGENT);
    // Other sites keep their own answer.
    await expect(poeFetch('https://poe.ninja/api/data/x')).resolves.toBeInstanceOf(Response);
  });

  it('reads how long pathofexile.com restricts us', () => {
    const headers = new Headers({
      'x-rate-limit-rules': 'Ip,Account',
      'x-rate-limit-ip-state': '8:10:0,16:60:0',
      'x-rate-limit-account-state': '3:5:0,30:300:120',
    });
    expect(restrictedSeconds(headers)).toBe(120);
    expect(restrictedSeconds(new Headers({ 'retry-after': '60' }))).toBe(60);
    expect(restrictedSeconds(new Headers())).toBe(0);
  });

  it('after a 429 sends nothing to pathofexile.com until the restriction is over', async () => {
    let clock = 1_000_000;
    let calls = 0;
    setHttpFetch(async () => {
      calls += 1;
      return calls === 1
        ? new Response('{"error":{"code":3,"message":"Rate limit exceeded"}}', { status: 429, headers: { 'retry-after': '60' } })
        : new Response('{}', { status: 200 });
    }, () => clock);
    const url = 'https://www.pathofexile.com/api/trade/search/Standard';
    await expect(poeFetch(url)).rejects.toThrow('retry in 60 s');
    await expect(poeFetch(url)).rejects.toThrow('retry in 60 s');
    clock += 59_000;
    await expect(poeFetch(url)).rejects.toThrow('retry in 1 s');
    expect(calls).toBe(1);
    // poe.ninja is not affected.
    await expect(poeFetch('https://poe.ninja/api/data/x')).resolves.toBeInstanceOf(Response);
    clock += 1_000;
    await expect(poeFetch(url)).resolves.toBeInstanceOf(Response);
    expect(calls).toBe(3);
  });
});

describe('poe fetch when something is off', () => {
  afterEach(() => setHttpFetch(globalThis.fetch));
  const url = 'https://www.pathofexile.com/api/trade2/search/poe2/Standard';

  it('says there is no connection instead of the raw error of tauri-plugin-http', async () => {
    // The plugin rejects with a bare string.
    setHttpFetch(() => Promise.reject('error sending request for url (https://www.pathofexile.com/api/trade2/search/poe2/Standard)'));
    await expect(poeFetch(url)).rejects.toThrow('No connection to www.pathofexile.com. Check the internet connection.');
    setHttpFetch(() => Promise.reject(new TypeError('fetch failed')));
    await expect(poeFetch('https://poe.ninja/poe2/api/economy/x')).rejects.toThrow('No connection to poe.ninja.');
    // A cancelled request stays cancelled (trade data aborts its downloads).
    const controller = new AbortController();
    controller.abort();
    setHttpFetch(() => Promise.reject(new Error('Request cancelled')));
    await expect(poeFetch(url, { signal: controller.signal })).rejects.toThrow('Request cancelled');
  });

  it('turns a web page where the API sends JSON into a clear error, not a JSON parse error', async () => {
    setHttpFetch(async () => new Response('<html>502 Bad gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } }));
    await expect(poeFetch(url)).rejects.toThrow('pathofexile.com sent a web page instead of data (HTTP 502).');
    // The trade site's JSON errors ("Unknown item base type") reach EE2, which shows their message.
    const body = '{"error":{"code":2,"message":"Unknown item base type"}}';
    setHttpFetch(async () => new Response(body, { status: 400, headers: { 'content-type': 'application/json' } }));
    expect((await (await poeFetch(url)).json()).error.message).toBe('Unknown item base type');
  });

  it('counts the long restrictions of the 6 hour window in minutes', async () => {
    // The fetch rule `1000:21600:1800` reached: restricted for half an hour.
    const headers = {
      'x-rate-limit-policy': 'trade-fetch-request-limit',
      'x-rate-limit-rules': 'Ip',
      'x-rate-limit-ip': '12:4:10,16:12:300,50:300:300,1000:21600:1800',
      'x-rate-limit-ip-state': '3:4:0,9:12:0,48:300:0,1001:21600:1800',
    };
    setHttpFetch(async () => new Response('{"error":{"code":3,"message":"Rate limit exceeded"}}', { status: 429, headers }), () => 0);
    await expect(poeFetch(url)).rejects.toThrow('pathofexile.com limits requests: retry in 30 min');
    await expect(poeFetch(url)).rejects.toThrow('retry in 30 min');
  });

  it('translates the errors it builds, with their numbers; other messages stay as they came', async () => {
    const uk = readFileSync(new URL('../public/i18n/uk.json', import.meta.url), 'utf-8');
    vi.stubGlobal('document', { baseURI: 'http://localhost/', documentElement: {} });
    vi.stubGlobal('fetch', async () => new Response(uk));
    try {
      await loadUiLanguage('uk');
      expect(trError('pathofexile.com limits requests: retry in 12 s')).toBe('pathofexile.com обмежує запити: повторіть за 12 с');
      expect(trError('No connection to poe.ninja. Check the internet connection.')).toBe('Немає з’єднання з poe.ninja. Перевірте підключення до інтернету.');
      expect(trError('Retry after 40 seconds')).toBe('Повторіть за 40 с');
      expect(trError('Unknown item base type')).toBe('Unknown item base type');
    } finally {
      await loadUiLanguage('en');
      vi.unstubAllGlobals();
    }
  });
});

describe('User-Agent', () => {
  it('names the app, its released version and the contact', async () => {
    const { readFile } = await import('node:fs/promises');
    const { version } = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf-8'));
    expect(USER_AGENT).toBe(`PriceOfExile2/${version} (+https://github.com/ArtemNA/price-of-exile-2)`);
  });
});
