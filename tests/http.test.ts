import { afterEach, describe, expect, it } from 'vitest';
import { CLOUDFLARE_CHECK_ERROR, USER_AGENT } from '../src/app/constants';
import { isCloudflareCheck, poeFetch, restrictedSeconds, setHttpFetch } from '../src/app/core/http';

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

describe('User-Agent', () => {
  it('names the app, its released version and the contact', async () => {
    const { readFile } = await import('node:fs/promises');
    const { version } = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf-8'));
    expect(USER_AGENT).toBe(`PriceOfExile2/${version} (+https://github.com/ArtemNA/price-of-exile-2)`);
  });
});
