import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { USER_AGENT } from '../src/app/constants';
import { setHttpFetch } from '../src/app/core/http';
import { ApiLeague, Leagues, pickLeague, toTradeLeagues } from '../src/app/core/leagues';
import { settings, updateSettings } from '../src/app/core/settings';

/** Real response of /api/leagues?type=main&realm=pc (Allflame league, 26.10.2026). */
const API_LEAGUES: ApiLeague[] = JSON.parse(
  readFileSync(new URL('./fixtures/leagues.json', import.meta.url), 'utf-8'),
);

afterEach(() => updateSettings({ leagueId: undefined }));

describe('toTradeLeagues', () => {
  it('drops permanent HC, SSF and Ruthless leagues', () => {
    expect(toTradeLeagues(API_LEAGUES).map((l) => l.id)).toEqual(['Standard', 'Allflame', 'Hardcore Allflame']);
  });
});

describe('pickLeague', () => {
  const leagues = toTradeLeagues(API_LEAGUES);

  it('defaults to the challenge league', () => {
    expect(pickLeague(leagues, undefined)).toBe('Allflame');
  });

  it('keeps a league that still exists', () => {
    expect(pickLeague(leagues, 'Standard')).toBe('Standard');
  });

  it('replaces a league that ended', () => {
    expect(pickLeague(leagues, 'Mercenaries')).toBe('Allflame');
  });

  it('keeps private leagues, which are not listed', () => {
    expect(pickLeague(leagues, 'My League (PL12345)')).toBe('My League (PL12345)');
  });
});

describe('Leagues.load', () => {
  it('requests leagues with our User-Agent and selects the default league', async () => {
    let request: { url: string; userAgent: string | null } | undefined;
    setHttpFetch(async (input, init) => {
      request = { url: String(input), userAgent: new Headers(init?.headers).get('User-Agent') };
      return new Response(JSON.stringify(API_LEAGUES), { status: 200 });
    });

    const leagues = new Leagues();
    await leagues.load();

    expect(request).toEqual({
      url: 'https://www.pathofexile.com/api/leagues?type=main&realm=pc',
      userAgent: USER_AGENT,
    });
    expect(leagues.error()).toBeNull();
    expect(settings().leagueId).toBe('Allflame');
    expect(leagues.selectedId()).toBe('Allflame');
  });

  it('reports HTTP errors', async () => {
    setHttpFetch(async () => new Response('maintenance', { status: 503 }));
    const leagues = new Leagues();
    await leagues.load();
    expect(leagues.error()).toMatch(/^HTTP 503/);
    expect(leagues.list()).toEqual([]);
  });

  it('reloads the list on a check only when it is old', async () => {
    let calls = 0;
    setHttpFetch(async () => {
      calls += 1;
      return Response.json([{ id: 'Standard', rules: [] }, { id: 'Keepers', rules: [] }]);
    });
    const leagues = new Leagues();
    await leagues.load(0);
    await leagues.refreshIfOld(60 * 60 * 1000);
    expect(calls).toBe(1);
    await leagues.refreshIfOld(3 * 60 * 60 * 1000);
    expect(calls).toBe(2);
  });
});
