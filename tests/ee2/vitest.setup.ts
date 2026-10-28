/**
 * Stands in for EE2 `renderer/specs/vitest.setup.ts` (same path under `@specs/`), so the copied EE2
 * specs stay unchanged. EE2 mocks `@/web/Config`, `@/web/background/IPC`, `fetch` and the client strings
 * loader; here the shims in src/app/ee2-shims serve the config from our settings and the data
 * comes from public/data on disk (tests/game-data.ts).
 *
 * Differences: the trade site data fallback (`TradeData`) is empty, as in the app until stage 2,
 * and only our game languages (en, ru) have data.
 */
import { updateSettings } from '../../src/app/core/settings';
import type { Lang } from '../../src/app/constants';
import { useDataFromDisk } from '../game-data';

/** EE2's `setupTests(configOverrides)`: only `language` is read by the copied code. */
export function setupTests(configOverrides: { language?: Lang } = {}): void {
  updateSettings({ language: configOverrides.language ?? 'en' });
  useDataFromDisk();
}
