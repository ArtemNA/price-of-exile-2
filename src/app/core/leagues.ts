// Trade leagues. Port of APT renderer/src/web/background/Leagues.ts (MIT © 2020 Alexander Drozdov):
// same filtering and default selection, Vue state replaced with Angular signals.

import { computed, Injectable, signal } from '@angular/core';
import { poeWebApi } from '@/web/Config';
import { LEAGUES_REFRESH_AFTER, PERMANENT_HC_LEAGUES, POE_REALM } from '../constants';
import { poeFetch } from './http';
import { settings, updateSettings } from './settings';

/** The league list of the game language's site (www. or ru.pathofexile.com). */
export function leaguesUrl(): string {
  return `https://${poeWebApi()}/api/leagues?type=main&realm=${POE_REALM}`;
}

export interface ApiLeague {
  id: string;
  event?: boolean;
  rules: Array<{ id: string }>;
}

export interface League {
  id: string;
  isPopular: boolean;
}

/** Leagues available for trade: no permanent HC, no SSF, no Ruthless outside events. */
export function toTradeLeagues(leagues: ApiLeague[]): League[] {
  return leagues
    .filter(
      (league) =>
        !PERMANENT_HC_LEAGUES.includes(league.id) &&
        !league.rules.some(
          (rule) => rule.id === 'NoParties' || (rule.id === 'HardMode' && !league.event),
        ),
    )
    .map((league) => ({ id: league.id, isPopular: true }));
}

export function isPrivateLeague(id: string): boolean {
  return id.includes('Ruthless') || /\(PL\d+\)$/.test(id);
}

/**
 * League to select after loading: keep the current one if it still exists (or is private),
 * otherwise the current challenge league (index 1, after Standard), or Standard.
 */
export function pickLeague(leagues: League[], current: string | undefined): string | undefined {
  if (!leagues.length) return current;
  const isAlive = leagues.some((league) => league.id === current);
  if (isAlive || isPrivateLeague(current ?? '')) return current;
  const TMP_CHALLENGE = 1;
  const STANDARD = 0;
  return leagues[leagues.length > 1 ? TMP_CHALLENGE : STANDARD].id;
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
      const leagues = toTradeLeagues((await response.json()) as ApiLeague[]);
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
