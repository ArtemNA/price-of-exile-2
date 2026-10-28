/**
 * Stands in for APT `@/web/Config`, so ported APT code that imports it stays unchanged.
 * Only the parts used by ported code are provided; extend as more of APT is ported.
 */
import { API_LATENCY_SECONDS, POE_INTL_WEB_API, POE_WEB_API, PRICE_CHECK_DEFAULTS } from '../constants';
import { settings } from '../core/settings';

export interface Config {
  leagueId?: string;
  language: ReturnType<typeof settings>['language'];
  realm: 'pc-ggg';
  useIntlSite: boolean;
  accountName: string;
}

/** Per-widget settings APT reads via `AppConfig('<widget type>')`. */
function widget(type: string): object | undefined {
  if (type === 'price-check') {
    return { ...PRICE_CHECK_DEFAULTS, ...settings().priceCheck, apiLatencySeconds: API_LATENCY_SECONDS };
  }
  return undefined;
}

export function AppConfig(): Config;
export function AppConfig<T>(type: string): T | undefined;
export function AppConfig(type?: string) {
  if (type) return widget(type);
  const { leagueId, language, useIntlSite, accountName } = settings();
  return { leagueId, language, realm: 'pc-ggg', useIntlSite, accountName } satisfies Config;
}

export function poeWebApi(): string {
  const { language, useIntlSite } = settings();
  return useIntlSite ? POE_INTL_WEB_API : POE_WEB_API[language];
}
