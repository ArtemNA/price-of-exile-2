// How the price check shows APT's filter objects (design A+B, FINDINGS F-54): stat filters in
// groups by kind with tiers, the mods behind pseudo totals, hidden filters apart, and the item
// header's base / corrupted switches. The filter objects stay APT's; only the view is ours.

import { STAT_GROUP_OTHER, STAT_GROUPS } from '../constants';
import { tr } from '../core/i18n';
import type { FilterOrGroup, ItemFilters, StatFilter } from '../../lib/apt/web/price-check/filters/interfaces';

export type CorruptedState = 'any' | 'not' | 'only';

export interface StatGroup {
  name: string;
  entries: FilterOrGroup[];
}

export interface SourceLine {
  text: string;
  /** "crafted", "implicit", …: the mod's kind when it is not a plain explicit. */
  kind?: string;
  /** What the mod adds to the total when it differs from its own roll ("+18 to Strength" → 9 life). */
  adds?: number;
}


function tagOf(entry: FilterOrGroup): string {
  return entry.group ? entry.meta.tag : entry.tag;
}

function isHidden(entry: FilterOrGroup): boolean {
  return entry.group ? entry.meta.hidden != null : entry.hidden != null;
}

/** Visible filters in groups; hidden ones (APT `hidden`: "rarely moves the price") on their own. */
export function groupStats(stats: FilterOrGroup[]): { groups: StatGroup[]; hidden: FilterOrGroup[] } {
  const groups = new Map<string, FilterOrGroup[]>();
  const hidden: FilterOrGroup[] = [];
  for (const entry of stats) {
    if (isHidden(entry)) {
      hidden.push(entry);
      continue;
    }
    const tag = tagOf(entry);
    const name = STAT_GROUPS.find((group) => group.tags.includes(tag))?.name ?? STAT_GROUP_OTHER;
    groups.set(name, [...(groups.get(name) ?? []), entry]);
  }
  const order = [...STAT_GROUPS.map((group) => group.name), STAT_GROUP_OTHER];
  return {
    groups: order.filter((name) => groups.has(name)).map((name) => ({ name, entries: groups.get(name)! })),
    hidden,
  };
}

/** Best (lowest) tier among the mods behind a filter: T1 is the top roll range. */
export function statTier(filter: StatFilter): number | null {
  const tiers = filter.sources.map((source) => source.modifier.info.tier).filter((tier): tier is number => tier != null);
  return tiers.length ? Math.min(...tiers) : null;
}

/**
 * A stat line with its roll: "+# to maximum Life" and 68 → "+68 to maximum Life". Filter texts drop
 * the leading "+" of the stat ref, so it comes back from the ref.
 */
export function statLine(template: string, ref: string, value: number | undefined): string {
  const text = template.trim();
  const signed = ref.startsWith('+#') && text.startsWith('#') ? `+${text}` : text;
  return value != null && signed.split('#').length === 2 ? signed.replace('#', String(value)) : signed;
}

/** The mods a pseudo total adds up (APT "Mods" toggle, `SourceInfo.vue`). */
export function sourceLines(filter: StatFilter): SourceLine[] {
  if (filter.tag !== 'pseudo') return [];
  return filter.sources.map((source) => {
    const roll = source.stat.roll?.value;
    const text = statLine(source.stat.translation.string, source.stat.stat.ref, roll);
    const type = source.modifier.info.type;
    const adds = source.contributes?.value;
    return {
      text,
      kind: type === 'explicit' ? undefined : type,
      adds: adds != null && adds !== roll ? adds : undefined,
    };
  });
}

/** Number of stat filters that are on, and of all of them (APT "3 of 10, stats"). */
export function statCounts(stats: FilterOrGroup[]): { on: number; all: number } {
  const flat = stats.map((entry) => (entry.group ? entry.meta : entry));
  return { on: flat.filter((filter) => !filter.disabled).length, all: flat.length };
}

/**
 * APT's corrupted filter has three meanings: `value: false` = not corrupted, `value: true` with
 * `exact` = corrupted only, `value: true` without = any (no filter sent).
 */
export function corruptedState(filters: ItemFilters): CorruptedState | null {
  const corrupted = filters.corrupted;
  if (!corrupted) return null;
  if (!corrupted.value) return 'not';
  return corrupted.exact ? 'only' : 'any';
}

export function setCorrupted(filters: ItemFilters, state: CorruptedState): void {
  if (!filters.corrupted) return;
  filters.corrupted.value = state !== 'not';
  filters.corrupted.exact = state === 'only';
}

/** The header's base switch: the whole category or this exact base (APT `FilterName.vue`). */
export function baseSwitch(filters: ItemFilters): { category: string; base: string; exact: boolean } | null {
  const relaxed = filters.searchRelaxed;
  if (!relaxed) return null;
  const base = filters.searchExact.baseType ?? filters.searchExact.name ?? tr('This base');
  // The category is game data and stays as the trade site names it.
  return { category: relaxed.category ? tr('Any {0}', relaxed.category) : tr('Any'), base, exact: relaxed.disabled };
}

export function setExactBase(filters: ItemFilters, exact: boolean): void {
  if (filters.searchRelaxed) filters.searchRelaxed.disabled = exact;
}
