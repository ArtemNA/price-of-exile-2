// Price check session logic. Port of the non-UI parts of EE2 CheckedItem.vue
// (MIT © 2020 Alexander Drozdov and EE2 contributors): preset creation and the "search right away" decision.

import { ItemCategory, ItemRarity, type ParsedItem } from '@/parser';
import { createPresets } from '../../lib/ee2/web/price-check/filters/create-presets';
import { initUiModFilters } from '../../lib/ee2/web/price-check/filters/create-stat-filters';
import { MODS_PRESET_ID } from '../constants';
import type { FilterPreset } from '../../lib/ee2/web/price-check/filters/interfaces';
import { CATEGORY_TO_TRADE_ID } from '../../lib/ee2/web/price-check/trade/pathofexile-trade';
import { settings } from '../core/settings';

export interface Presets {
  active: string;
  presets: FilterPreset[];
}

export function activePreset(presets: Presets): FilterPreset {
  return presets.presets.find((preset) => preset.id === presets.active)!;
}

/**
 * Filter presets for an item. The buyout currency filter carries over when the same item
 * is checked again (as in APT).
 */
export function createItemPresets(item: ParsedItem, leagueId: string, previous?: { item: ParsedItem; presets: Presets }): Presets {
  const sameItem =
    previous &&
    item.info.namespace === previous.item.info.namespace &&
    item.info.refName === previous.item.info.refName;
  const options = settings().priceCheck;
  const presets = createPresets(item, {
    league: leagueId,
    // stage 3: the four listing types in the settings (PLAN F2); APT's "instant buyout" maps to EE2's default.
    listingType: options.merchantOnly ? 'securable' : 'online',
    defaultAllSelected: false,
    collapseListings: options.collapseListings,
    activateStockFilter: options.activateStockFilter,
    searchStatRange: options.searchStatRange,
    useEn: settings().useIntlSite,
    currency: sameItem ? activePreset(previous.presets).filters.trade.currency : (options.defaultCurrency ?? undefined),
  });
  return withModsPreset(item, presets, options.searchStatRange);
}

/**
 * Next to "Pseudo", a "Mods" preset with every mod on its own (APT has none): "+70 to maximum
 * Life" and "+18 to Strength" instead of "+79 total maximum Life". Only when pseudo totals exist.
 */
function withModsPreset(item: ParsedItem, presets: Presets, searchStatRange: number): Presets {
  const index = presets.presets.findIndex((preset) => preset.id === 'filters.preset_pseudo');
  if (index < 0) return presets;
  const pseudo = presets.presets[index];
  const hasTotals = pseudo.stats.some((filter) => filter.tag === 'pseudo');
  if (!hasTotals) return presets;
  const mods: FilterPreset = {
    id: MODS_PRESET_ID,
    filters: structuredClone(pseudo.filters),
    stats: initUiModFilters(item, { searchStatRange, defaultAllSelected: false, noPseudo: true }),
  };
  const list = [...presets.presets];
  list.splice(index + 1, 0, mods);
  return { ...presets, presets: list };
}

/** Items whose price rarely depends on filter tweaks are searched right away (EE2 `CheckedItem.vue`). */
export function shouldSearchImmediately(item: ParsedItem, presets: Presets): boolean {
  if (!settings().priceCheck.smartInitialSearch) return false;
  return Boolean(
    item.rarity === ItemRarity.Unique ||
      presets.active === 'filters.preset_bulk' ||
      item.category === ItemCategory.HeistBlueprint ||
      item.category === ItemCategory.SanctumRelic ||
      item.category === ItemCategory.Charm ||
      !CATEGORY_TO_TRADE_ID.has(item.category!) ||
      item.isUnidentified ||
      item.isVeiled,
  );
}
