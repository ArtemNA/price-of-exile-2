// Map check: the item's map mods with the user's marks per profile.
// Port of APT `map-check/MapCheck.vue`, `MapStatButton.vue`, `settings-maps.vue` and the `isMapLike`
// check of `item-check/WidgetItemCheck.vue`. Decision strings and their helpers come unchanged
// from `lib/apt/web/map-check/common.ts`; APT mutates the config in place, here every change
// returns a new config for the settings signal.

import { STATS_ITERATOR } from '@/assets/data';
import { ItemCategory, ItemRarity, type ParsedItem } from '@/parser';
import { ModifierType } from '@/parser/modifiers';
import {
  type MapCheckConfig,
  type StatMatcher,
  StatTag,
  decisionCreate,
  decisionHasColor,
  isOutdated,
  nextDecision,
} from '@/web/map-check/common';
import { prepareMapStat } from '@/web/map-check/prepare-map-stats';
import { MEMORY_MAPS } from '../constants';

/** One character of the decision string: d(eadly), w(arning), g(ood), s(een) or - (none). */
export type Decision = 'd' | 'w' | 'g' | 's' | '-';

export interface MapStat {
  matcher: string;
  roll?: number;
  decision: Decision;
}

export interface MapCheckView {
  name: string;
  /** Area screenshot; none for unidentified unique and blighted maps, as in APT. */
  image?: string;
  mavenReminder: boolean;
  stats: MapStat[];
  /** Explicit mod lines the stat data does not know. */
  unknown: string[];
  /** Marked mods whose wording the stat data no longer has. */
  hasOutdated: boolean;
}

/** Maps, contracts, blueprints, invitations, charts and logbooks open the map check instead of the item check. */
export function isMapLike(item: ParsedItem): boolean {
  const { category, rarity, info } = item;
  return (
    (category === ItemCategory.Map && rarity !== ItemRarity.Unique) ||
    category === ItemCategory.HeistContract ||
    category === ItemCategory.HeistBlueprint ||
    category === ItemCategory.Invitation ||
    category === ItemCategory.Chart ||
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
  const blighted = Boolean(item.info.area?.blighted);
  const hideImage = (item.rarity === ItemRarity.Unique && item.isUnidentified) || blighted;
  return {
    name: blighted ? item.info.name : (item.mapArea?.name ?? item.info.name),
    image: hideImage ? undefined : (item.info.area?.screenshot ?? item.mapArea?.area?.screenshot),
    mavenReminder: Boolean(item.mapArea && MEMORY_MAPS.includes(item.mapArea.refName)),
    stats: item.statsByType
      .filter((calc) => calc.type === ModifierType.Explicit)
      .map(prepareMapStat)
      .map((stat) => ({ ...stat, decision: decisionOf(config, stat.matcher) })),
    unknown: item.unknownModifiers.filter((mod) => mod.type === ModifierType.Explicit).map((mod) => mod.text),
    hasOutdated: config.selectedStats.some((entry) => isOutdated(config.profile, entry)),
  };
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
    if (!stat.fromAreaMods) continue;
    const tag =
      stat.fromAreaMods === 'heist_exclusive'
        ? StatTag.HeistExclusive
        : stat.fromAreaMods === 'ubermap_exclusive'
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
