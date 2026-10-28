/**
 * Stands in for EE2 `@/web/Config`, so ported EE2 code that imports it stays unchanged.
 * Only the parts ported code reads are provided, as plain getters over our settings;
 * extend as more of EE2 is ported.
 */
import type { ItemCheckWidget } from '@/web/item-check/widget';
import type { PriceCheckWidget } from '@/web/overlay/widgets';
import { API_LATENCY_SECONDS, POE_INTL_WEB_API, POE_WEB_API, PRICE_CHECK_DEFAULTS } from '../constants';
import { settings } from '../core/settings';

export interface Config {
  leagueId?: string;
  /** EE2's game languages; ours (`Lang`) are a subset. */
  language: 'en' | 'ru' | 'cmn-Hant' | 'ko' | 'ja' | 'de' | 'es' | 'pt' | 'fr';
  realm: 'pc-ggg';
  /** EE2's replacement of APT `useIntlSite`: "www" forces the international site. */
  preferredTradeSite: 'default' | 'www';
  accountName: string;
}

/**
 * Per-widget settings EE2 reads via `AppConfig('<widget type>')`: ours where we have them, the
 * rest at EE2 defaults. Typed as EE2's widgets, but only the fields ported code reads are real.
 */
function widget(type: string): object | undefined {
  if (type === 'price-check') {
    return {
      ...PRICE_CHECK_DEFAULTS,
      ...settings().priceCheck,
      apiLatencySeconds: API_LATENCY_SECONDS,
      // Runes the item editor puts into empty sockets; the editor comes later (PLAN §1.2).
      savedAugments: {},
    } satisfies Partial<PriceCheckWidget>;
  }
  if (type === 'item-check') {
    // stage 6: item check settings; "both" = stash search by the price note and the name (EE2 default).
    return { maps: settings().mapCheck, samePricedType: 'both' } satisfies Partial<ItemCheckWidget>;
  }
  return undefined;
}

export function AppConfig(): Config;
export function AppConfig<T>(type: string): T | undefined;
export function AppConfig(type?: string) {
  if (type) return widget(type);
  const { leagueId, language, useIntlSite, accountName } = settings();
  return {
    leagueId,
    language,
    realm: 'pc-ggg',
    preferredTradeSite: useIntlSite ? 'www' : 'default',
    accountName,
  } satisfies Config;
}

export function poeWebApi(): string {
  const { language, useIntlSite } = settings();
  return useIntlSite ? POE_INTL_WEB_API : POE_WEB_API[language];
}
