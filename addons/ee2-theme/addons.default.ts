import type { Theme } from '../../src/app/themes';
import { EE2_THEME } from './theme';

// Replaces src/app/addons.ts in the "ee2-default" configuration: the EE2 theme is also the default.
export const ADDON_THEMES: readonly Theme[] = [EE2_THEME];
export const DEFAULT_THEME_ID: string | null = EE2_THEME.id;
