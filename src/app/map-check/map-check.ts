// Map check: the item's map mods with the user's marks per profile.
// Port of EE2 `map-check/MapCheck.vue`, `MapStatButton.vue`, `settings-maps.vue` and the `isMapLike`
// check of `item-check/WidgetItemCheck.vue`. Decision strings and their helpers come unchanged
// from EE2 `web/map-check/common.ts`; EE2 mutates the config in place, here every change
// returns a new config for the settings signal.
// PoE2 waystones have no fixed area (no screenshot in the item data) and there is no Maven; the
// header shows the waystone's own numbers instead. Tablets open the item check.

import { STATS_ITERATOR } from '@/assets/data';
import { ItemCategory, ItemRarity, type ParsedItem } from '@/parser';
import { MAP_CHECK_NUMBERS } from '../constants';
import {
  type MapCheckConfig,
  type StatMatcher,
  StatTag,
  decisionCreate,
  decisionHasColor,
  isOutdated,
  nextDecision,
} from '@/web/map-check/common';
import { prepareMapStats } from '@/web/map-check/prepare-map-stats';

/** One character of the decision string: d(eadly), w(arning), g(ood), s(een) or - (none). */
export type Decision = 'd' | 'w' | 'g' | 's' | '-';

export interface MapStat {
  matcher: string;
  roll?: number;
  /** Modifier type (`explicit`, `enchant`…), as EE2 `prepareMapStats` gives it. */
  type?: string;
  decision: Decision;
}

/** One of the waystone's own numbers; `label` is English, the panel translates it. */
export interface MapNumber {
  label: string;
  value: number;
  percent: boolean;
}

export interface MapCheckView {
  name: string;
  tier?: number;
  corrupted: boolean;
  unidentified: boolean;
  /** Revives, pack size, rarity… the item shows; 0 revives is shown too. */
  numbers: MapNumber[];
  stats: MapStat[];
  /**
   * Mod lines the stat data does not know (EE2 shows them all), roll ranges removed. Such a line can
   * be the second line of a hybrid mod whose first line is known (FINDINGS F-09).
   */
  unknown: string[];
  /** Marked mods whose wording the stat data no longer has. */
  hasOutdated: boolean;
}

/** Waystones and logbooks open the map check instead of the item check. */
export function isMapLike(item: ParsedItem): boolean {
  const { category, rarity, info } = item;
  return (
    ((category === ItemCategory.Waystone || category === ItemCategory.Map) && rarity !== ItemRarity.Unique) ||
    info.refName === 'Expedition Logbook'
  );
}

export function decisionOf(config: MapCheckConfig, matcher: string, profile = config.profile): Decision {
  const entry = config.selectedStats.find((stat) => stat.matcher === matcher);
  return (entry?.decision[profile - 1] ?? '-') as Decision;
}

export function withDecision(config: MapCheckConfig, matcher: string, value: string): MapCheckConfig {
  const entry = config.selectedStats.find((stat) => stat.matcher === matcher);
  // An entry without marks in any profile is dropped; APT keeps it.
  const decision = decisionCreate(value, config.profile, entry?.decision);
  const rest = config.selectedStats.filter((stat) => stat !== entry);
  return {
    ...config,
    selectedStats: decision.replaceAll('-', '') ? [...rest, { matcher, decision }] : rest,
  };
}

/** Click on a mod: none → deadly → warning → good → seen → none. */
export function cycleDecision(config: MapCheckConfig, matcher: string): MapCheckConfig {
  return withDecision(config, matcher, nextDecision(decisionOf(config, matcher)));
}

/** The eye button with "show icon for new mods" on: mark as seen, or back to new. */
export function toggleSeen(config: MapCheckConfig, matcher: string): MapCheckConfig {
  if (!config.showNewStats) return config;
  return withDecision(config, matcher, decisionOf(config, matcher) === '-' ? 's' : '-');
}

export function mapCheckView(item: ParsedItem, config: MapCheckConfig): MapCheckView {
  const numbers: MapNumber[] = [];
  for (const { field, label, percent } of MAP_CHECK_NUMBERS) {
    const value = item[field];
    if (value != null && !Number.isNaN(value)) numbers.push({ label, value, percent });
  }
  return {
    name: item.info.name,
    tier: item.mapTier,
    corrupted: item.isCorrupted,
    unidentified: item.isUnidentified,
    numbers,
    stats: prepareMapStats(item).map(({ matcher, roll, type }) => ({ matcher, roll, type, decision: decisionOf(config, matcher) })),
    unknown: item.unknownModifiers.map((mod) => withoutRollRange(mod.text)),
    hasOutdated: config.selectedStats.some((entry) => isOutdated(config.profile, entry)),
  };
}

/** "+26(26-30)% to…" → "+26% to…": the game's advanced mod text puts the tier range after the roll. */
export function withoutRollRange(text: string): string {
  return text.replace(/(\d)\(-?[\d.]+--?[\d.]+\)/g, '$1');
}

/** Matcher text split around `#`, with the roll in its place (APT `ItemModifierText.vue`). */
export function modTextParts(text: string, roll?: number): Array<{ text: string; value?: boolean }> {
  const parts: Array<{ text: string; value?: boolean }> = [];
  const pieces = text.split(/(?<![#])[+-]?[#]/gm);
  pieces.forEach((piece, idx) => {
    if (piece !== '') parts.push({ text: piece });
    if (idx !== pieces.length - 1) parts.push(roll == null ? { text: '#' } : { text: String(roll), value: true });
  });
  return parts;
}

function tagToShowOrder(tag?: StatTag): number {
  switch (tag) {
    case StatTag.UberMapExclusive:
      return 1;
    case StatTag.HeistExclusive:
      return 2;
  }
  return 0;
}

/** Every map mod the editor can mark: ordinary first, then uber map and heist exclusive. */
export function allAreaMods(): StatMatcher[] {
  const out: StatMatcher[] = [];
  for (const stat of STATS_ITERATOR('AreaMods')) {
    // EE2 `settings-maps.vue findAllAreaMods`.
    if (!stat.fromAreaMods && !stat.fromUberAreaMods && !stat.fromHeistAreaMods) continue;
    const tag =
      stat.fromHeistAreaMods && !stat.fromAreaMods
        ? StatTag.HeistExclusive
        : stat.fromUberAreaMods && !stat.fromAreaMods
          ? StatTag.UberMapExclusive
          : undefined;
    for (const matcher of stat.matchers) out.push({ matchStr: matcher.string, tag });
  }
  out.sort((a, b) => tagToShowOrder(a.tag) - tagToShowOrder(b.tag) || a.matchStr.localeCompare(b.matchStr));
  return out;
}

/** Settings list (APT `settings-maps.vue filteredStats`): outdated marks first, then the search result. */
export function filterAreaMods(
  all: StatMatcher[],
  config: MapCheckConfig,
  search: string,
  onlySelected: boolean,
): StatMatcher[] {
  const words = search.toLowerCase().split(' ');
  const selected = new Set(
    config.selectedStats.filter((entry) => decisionHasColor(entry.decision, config.profile)).map((entry) => entry.matcher),
  );
  const outdated = config.selectedStats
    .filter((entry) => isOutdated(config.profile, entry))
    .map((entry) => ({ matchStr: entry.matcher, tag: StatTag.Outdated }));
  const found = all.filter((stat) => {
    const text = stat.matchStr.toLowerCase();
    if (!words.every((word) => text.includes(word))) return false;
    return !onlySelected || selected.has(stat.matchStr);
  });
  return [...outdated, ...found];
}

export { decisionHasColor, StatTag };
