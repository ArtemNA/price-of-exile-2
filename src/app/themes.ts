import type { Type } from '@angular/core';
import { ADDON_THEMES, DEFAULT_THEME_ID } from './addons';

/**
 * A look of the app. The base theme is ours; addons (addons/<name>, listed in src/app/addons.ts)
 * add more. A theme recolours every window through the CSS tokens of src/styles.css under
 * `html[data-theme="<id>"]`, and may bring its own price check view over the same logic (a
 * subclass of PriceCheckPanel with its own template).
 */
export interface Theme {
  id: string;
  label: string;
  /** Own price check view; the base one otherwise. Inputs `item` and `view`, as PriceCheckPanel. */
  priceCheck?: Type<unknown>;
  /**
   * Width of the price check window, logical px; `fullHeight`: as tall as the game (the host
   * clamps PRICE_CHECK_FULL_HEIGHT to the game), instead of fitting the height to the filters.
   */
  priceCheckSize?: { width: number; fullHeight: boolean };
  /**
   * Own "which unique is it?" view; inputs `baseName`, `variants` and `pick` (a callback: views
   * of a theme are created with NgComponentOutlet, which binds no outputs).
   */
  unidentifiedPicker?: Type<unknown>;
}

export const BASE_THEME: Theme = { id: 'price-of-exile-2', label: 'Price of Exile 2' };

export const THEMES: readonly Theme[] = [BASE_THEME, ...ADDON_THEMES];

/** The theme a fresh install starts with: an addon built in as the default, or ours. */
export const DEFAULT_THEME = DEFAULT_THEME_ID ?? BASE_THEME.id;

/** The theme by its id; '' or an id this build does not have: the build's default. */
export function themeById(id: string): Theme {
  return THEMES.find((theme) => theme.id === id) ?? THEMES.find((theme) => theme.id === DEFAULT_THEME) ?? BASE_THEME;
}
