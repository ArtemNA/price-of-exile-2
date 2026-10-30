import type { Theme } from './themes';
import { EE2_THEME } from '../../addons/ee2-theme/theme';

// Themes besides ours that the app ships with; each lives in addons/<name> (its theme.ts exports
// the Theme, its theme.css goes to `styles` in angular.json after src/styles.css).
// A "<name>-default" build configuration replaces this file with addons/<name>/addons.default.ts,
// which lists the same themes and sets DEFAULT_THEME_ID to start with that theme instead of ours.
export const ADDON_THEMES: readonly Theme[] = [EE2_THEME];
/** An addon theme to start with instead of ours. */
export const DEFAULT_THEME_ID: string | null = null;
