/**
 * Stands in for APT `@/web/overlay/interfaces`: only the widget settings ported code reads.
 * Values come from `AppConfig('<widget type>')` in ./web-config.ts.
 */
import type { PRICE_CHECK_DEFAULTS } from '../constants';

export type PriceCheckWidget = typeof PRICE_CHECK_DEFAULTS & {
  apiLatencySeconds: number;
};
