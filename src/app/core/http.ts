import { invoke } from '@tauri-apps/api/core';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { CLOUDFLARE_CHECK_ERROR, POE_OFFICIAL_HOSTS, USER_AGENT } from '../constants';
import { settings } from './settings';

type Fetch = typeof globalThis.fetch;

// Requests go through tauri-plugin-http (Rust side): no CORS, response headers such as
// X-Rate-Limit-* are readable. Tests swap in their own fetch.
let impl: Fetch = (input, init) => tauriFetch(input, init);
/** Until when pathofexile.com told us to stop (ms since epoch), see `restrictedSeconds`. */
let restrictedUntil = 0;
let now = () => Date.now();

export function setHttpFetch(fetch: Fetch, clock: () => number = Date.now): void {
  impl = fetch;
  now = clock;
  restrictedUntil = 0;
}

interface BrowserResponse {
  status: number;
  headers: Array<[string, string]>;
  body: string;
}

/**
 * The request made by the built-in browser's page (FINDINGS F-45): its cookies (login,
 * Cloudflare clearance) and its User-Agent, which the clearance is tied to.
 */
async function browserFetch(url: string, init: RequestInit): Promise<Response> {
  if (init.body != null && typeof init.body !== 'string') throw new Error('Only text bodies go through the browser');
  const request = { url, method: init.method ?? 'GET', headers: [...new Headers(init.headers)], body: init.body ?? null };
  const reply = await invoke<BrowserResponse>('browser_fetch', { request });
  const empty = reply.status === 204 || reply.status === 304;
  return new Response(empty ? null : reply.body, { status: reply.status, headers: reply.headers });
}

/** Cloudflare answers with its challenge page instead of the API's JSON. */
export function isCloudflareCheck(response: Response): boolean {
  if (response.headers.get('cf-mitigated') === 'challenge') return true;
  return (response.status === 403 || response.status === 503) && Boolean(response.headers.get('content-type')?.includes('text/html'));
}

/**
 * How long pathofexile.com restricts us, in seconds: `Retry-After`, or the third number of an
 * `X-Rate-Limit-<rule>-State` entry ("hits:period:restricted"). APT ignores it; requests sent
 * while restricted make GGG extend the restriction (FINDINGS F-51).
 */
export function restrictedSeconds(headers: Headers): number {
  let seconds = Number(headers.get('retry-after')) || 0;
  for (const rule of headers.get('x-rate-limit-rules')?.split(',') ?? []) {
    for (const entry of headers.get(`x-rate-limit-${rule}-state`)?.split(',') ?? []) {
      seconds = Math.max(seconds, Number(entry.split(':')[2]) || 0);
    }
  }
  return seconds;
}

/** fetch for PoE and related sites, always with our User-Agent (or the browser's, see `browserFetch`). */
export async function poeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const official = POE_OFFICIAL_HOSTS.includes(new URL(url).hostname);
  if (official && now() < restrictedUntil) {
    // Not even a request: it would only make the restriction longer.
    throw new Error(`pathofexile.com limits requests: retry in ${Math.ceil((restrictedUntil - now()) / 1000)} s`);
  }
  let response: Response;
  if (official && settings().priceCheck.builtinBrowser) {
    response = await browserFetch(url, init);
  } else {
    const headers = new Headers(init.headers);
    headers.set('User-Agent', USER_AGENT);
    response = await impl(url, { ...init, headers });
  }
  if (official && isCloudflareCheck(response)) throw new Error(CLOUDFLARE_CHECK_ERROR);
  if (official) {
    const seconds = restrictedSeconds(response.headers);
    if (seconds > 0 || response.status === 429) {
      restrictedUntil = Math.max(restrictedUntil, now() + Math.max(seconds, 1) * 1000);
      if (response.status === 429) throw new Error(`pathofexile.com limits requests: retry in ${Math.max(seconds, 1)} s`);
    }
  }
  return response;
}
