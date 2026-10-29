// Trade leagues. Port of EE2 renderer/src/web/background/Leagues.ts (MIT © 2020 Alexander Drozdov,
// Exiled Exchange 2 authors): the trade2 league list, Vue state replaced with Angular signals.

import { computed, Injectable, signal } from '@angular/core';
import { poeWebApi } from '@/web/Config';
import { HC_LEAGUE_PREFIX, LEAGUES_REFRESH_AFTER, PERMANENT_HC_LEAGUES, PERMANENT_SC_LEAGUES } from '../constants';
import { poeFetch } from './http';
import { settings, updateSettings } from './settings';

/**
 * The trade league list of the game language's site (www. or ru.pathofexile.com). PoE2 leagues
 * are only there: `/api/leagues?realm=poe2` ignores the realm and lists PoE1 leagues (EE2 TODO).
 */
export function leaguesUrl(): string {
  return `https://${poeWebApi()}/api/trade2/data/leagues`;
}

/** An entry of `/api/trade2/data/leagues` `result`. */
export interface ApiLeague {
  id: string;
  realm?: string;
  text: string;
}

export interface League {
  id: string;
  isPopular: boolean;
}

/** Leagues to choose from: the trade list (it has no SSF leagues) without permanent Hardcore. */
export function toTradeLeagues(leagues: ApiLeague[]): League[] {
  return leagues
    .filter((league) => !PERMANENT_HC_LEAGUES.includes(league.id))
    .map((league) => ({ id: league.id, isPopular: true }));
}

/** A league of the current season: not permanent and not its Hardcore twin ("HC <name>"). */
function isChallengeLeague(id: string): boolean {
  return !PERMANENT_SC_LEAGUES.includes(id) && !PERMANENT_HC_LEAGUES.includes(id) && !id.startsWith(HC_LEAGUE_PREFIX);
}

export function isPrivateLeague(id: string): boolean {
  return id.includes('Ruthless') || /\(PL\d+\)$/.test(id);
}

/**
 * League to select after loading: keep the current one if it still exists (or is private),
 * otherwise the first challenge league of the list (the newest: the API lists them first), or
 * Standard. EE2 takes index 2, which is the older of two parallel leagues (0.5: Runes of Aldur
 * and the fresh Forbidden Rites).
 */
export function pickLeague(leagues: League[], current: string | undefined): string | undefined {
  if (!leagues.length) return current;
  const isAlive = leagues.some((league) => league.id === current);
  if (isAlive || isPrivateLeague(current ?? '')) return current;
  const challenge = leagues.find((league) => isChallengeLeague(league.id));
  return (challenge ?? leagues.find((league) => PERMANENT_SC_LEAGUES.includes(league.id)) ?? leagues[0]).id;
}

@Injectable({ providedIn: 'root' })
export class Leagues {
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly list = signal<League[]>([]);

  readonly selectedId = computed(() => (this.list().length ? settings().leagueId : undefined));
  private loadedAt = 0;

  /**
   * The app may sit in the tray for weeks: on a check, reload the list if it is old, so an
   * ended league gets replaced (one request per LEAGUES_REFRESH_AFTER at most).
   */
  async refreshIfOld(now = Date.now()): Promise<void> {
    if (this.isLoading() || now - this.loadedAt < LEAGUES_REFRESH_AFTER) return;
    await this.load(now);
  }

  async load(now = Date.now()): Promise<void> {
    this.loadedAt = now;
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const response = await poeFetch(leaguesUrl());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(Object.fromEntries(response.headers))}`);
      }
      const leagues = toTradeLeagues(((await response.json()) as { result: ApiLeague[] }).result);
      this.list.set(leagues);

      const leagueId = pickLeague(leagues, settings().leagueId);
      if (leagueId !== settings().leagueId) updateSettings({ leagueId });
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.isLoading.set(false);
    }
  }

  select(leagueId: string): void {
    updateSettings({ leagueId });
  }
}
