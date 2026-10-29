import type { FilterNumeric, ItemFilters } from '../../lib/ee2/web/price-check/filters/interfaces';
import { t, tr } from '../core/i18n';
import type { RarityFilter } from './filter-view';

/** One item property filter row (item level, sockets, waystone tier, corrupted, …). */
export interface ItemFilterChip {
  key: string;
  label: string;
  enabled: boolean;
  toggle(): void;
  /** Numeric filters get min (and max when the filter has one) fields. */
  numeric?: FilterNumeric;
}

/**
 * Numeric ItemFilters keys with the EE2 i18n key of their label ("Item Level: {0}"), in EE2's
 * `FiltersBlock.vue` order. Rune sockets (`augmentSockets`) take the place of PoE1's links;
 * `socketNumber` is a gem's support sockets; the unidentified tier (EE2 turns it on from 5 up)
 * replaces the plain "Unidentified" switch for items that show one.
 */
const NUMERIC: Array<[keyof ItemFilters, string]> = [
  ['socketNumber', 'item.gem_sockets'],
  ['mapTier', 'item.map_tier'],
  ['awardedAscendancyPoints', 'item.ascendancy_points'],
  ['areaLevel', 'item.area_level'],
  ['itemLevel', 'item.item_level'],
  ['stackSize', 'item.stock'],
  ['augmentSockets', 'item.augment_sockets'],
  ['gemLevel', 'item.gem_level'],
  ['quality', 'item.quality'],
  ['unidentifiedTier', 'item.unidentified_tier'],
];

/** "Item Level: {0}" → "Item Level". */
const labelOnly = (i18nKey: string) => t(i18nKey, '').replace(/[:\s]+$/, '');

export function itemFilterChips(filters: ItemFilters): ItemFilterChip[] {
  const chips: ItemFilterChip[] = [];

  const relaxed = filters.searchRelaxed;
  if (relaxed) {
    const base = filters.searchExact.baseType ?? filters.searchExact.name ?? tr('base');
    chips.push({
      key: 'base',
      label: tr('Only {0}', base),
      enabled: relaxed.disabled,
      toggle: () => (relaxed.disabled = !relaxed.disabled),
    });
  }

  // EE2 always sends its rarity filter; the off state is our own (`requestFilters`).
  const rarity = filters.rarity as RarityFilter | undefined;
  if (rarity) {
    const label = tr(rarity.value === 'nonunique' ? 'Not unique' : rarity.value === 'magic' ? 'Magic' : 'Normal');
    chips.push({ key: 'rarity', label, enabled: !rarity.disabled, toggle: () => (rarity.disabled = !rarity.disabled) });
  }

  for (const [key, i18nKey] of NUMERIC) {
    const filter = filters[key] as FilterNumeric | undefined;
    if (!filter) continue;
    chips.push({
      key,
      label: labelOnly(i18nKey),
      enabled: !filter.disabled,
      toggle: () => (filter.disabled = !filter.disabled),
      numeric: filter,
    });
  }

  const corrupted = filters.corrupted;
  if (corrupted) {
    chips.push({
      key: 'corrupted',
      label: t(corrupted.value ? 'item.corrupted' : 'item.not_corrupted'),
      enabled: true,
      toggle: () => (corrupted.value = !corrupted.value),
    });
  }

  // Off is "not mirrored" / "not sanctified" on the trade site, as EE2 labels it; on is "any".
  for (const key of ['mirrored', 'sanctified'] as const) {
    const filter = filters[key];
    if (filter) {
      chips.push({
        key,
        label: t(filter.disabled ? `item.not_${key}` : `item.${key}`),
        enabled: !filter.disabled,
        toggle: () => (filter.disabled = !filter.disabled),
      });
    }
  }

  const unidentified = filters.unidentified;
  if (unidentified && !filters.unidentifiedTier) {
    chips.push({ key: 'unidentified', label: t('item.unidentified'), enabled: !unidentified.disabled, toggle: () => (unidentified.disabled = !unidentified.disabled) });
  }

  for (const influence of filters.influences ?? []) {
    chips.push({ key: `influence-${influence.value}`, label: t(influence.value), enabled: !influence.disabled, toggle: () => (influence.disabled = !influence.disabled) });
  }

  return chips;
}
