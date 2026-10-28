import type { FilterNumeric, ItemFilters } from '../../lib/apt/web/price-check/filters/interfaces';
import { t, tr } from '../core/i18n';

/** One item property filter row (item level, links, quality, corrupted, …). */
export interface ItemFilterChip {
  key: string;
  label: string;
  enabled: boolean;
  toggle(): void;
  /** Numeric filters get min (and max when the filter has one) fields. */
  numeric?: FilterNumeric;
}

/** Numeric ItemFilters keys with the APT i18n key of their label ("Item Level: {0}"). */
const NUMERIC: Array<[keyof ItemFilters, string]> = [
  ['itemLevel', 'item.item_level'],
  ['linkedSockets', 'item.linked_sockets'],
  ['whiteSockets', 'item.white_sockets'],
  ['quality', 'item.quality'],
  ['gemLevel', 'item.gem_level'],
  ['mapTier', 'item.map_tier'],
  ['areaLevel', 'item.area_level'],
  ['stackSize', 'item.stock'],
  ['sentinelCharge', 'item.sentinel_charge'],
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

  const rarity = filters.rarity;
  if (rarity) {
    const label = rarity.value === 'nonunique' ? tr('Not unique') : rarity.value.charAt(0).toUpperCase() + rarity.value.slice(1);
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

  for (const [key, i18nKey] of [['mirrored', 'item.mirrored'], ['split', 'item.split']] as const) {
    const filter = filters[key];
    if (filter && !filter.hidden) {
      chips.push({ key, label: t(i18nKey), enabled: !filter.disabled, toggle: () => (filter.disabled = !filter.disabled) });
    }
  }

  const unidentified = filters.unidentified;
  if (unidentified) {
    chips.push({ key: 'unidentified', label: t('item.unidentified'), enabled: !unidentified.disabled, toggle: () => (unidentified.disabled = !unidentified.disabled) });
  }

  for (const influence of filters.influences ?? []) {
    chips.push({ key: `influence-${influence.value}`, label: t(influence.value), enabled: !influence.disabled, toggle: () => (influence.disabled = !influence.disabled) });
  }

  return chips;
}
