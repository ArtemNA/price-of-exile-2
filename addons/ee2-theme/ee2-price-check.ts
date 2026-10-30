import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, signal, untracked } from '@angular/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ItemCategory, ItemRarity, itemIsModifiable } from '@/parser';
import { GEM, GRANTS_REAL_SKILL } from '@/parser/meta';
import { ModifierType } from '@/parser/modifiers';
import { applyIncr } from '@/parser/advanced-mod-desc';
import { CLIENT_STRINGS as _$, ITEM_BY_REF } from '@/assets/data';
import {
  FilterTag,
  INTERNAL_TRADE_IDS,
  ItemIsElementalModifier,
  type FilterNumeric,
  type ItemFilters,
  type StatFilter,
} from '../../src/lib/ee2/web/price-check/filters/interfaces';
import { percentRoll, roundRoll } from '../../src/lib/ee2/web/price-check/filters/util';
import { RATE_LIMIT_RULES, RATE_LIMIT_RULES_REVISION } from '../../src/lib/ee2/web/price-check/trade/common';
import { CATEGORY_TO_TRADE_ID } from '../../src/lib/ee2/web/price-check/trade/pathofexile-trade';
import { MODS_PRESET_ID } from '../../src/app/constants';
import { currencyRates, requestNinjaPrices } from '../../src/app/core/currency-rates';
import { autoCurrency } from '../../src/app/core/ninja-prices';
import { displayRounding, usePoeninja } from '../../src/app/ee2-shims/prices';
import { t, tr, TranslatePipe, TrErrorPipe, TrPipe } from '../../src/app/core/i18n';
import { NumInput } from '../../src/app/price-check/num-input';
import { PriceCheckPanel } from '../../src/app/price-check/price-check-panel';
import type { BulkHave } from '../../src/app/price-check/bulk-search';
import { Currency } from '../../src/app/shared/currency';
import { Ee2Icon } from './ee2-icon';
import { Ee2TitleBar } from './ee2-title-bar';

/** EE2's related items panel beside the column: max-width 24 rem. */
const EE2_RELATED_WIDTH = 384;
/** Without related items the window still reaches beside the column for the "Rate limiting" tab (mx-6 px-4). */
const EE2_RATE_TAB_WIDTH = 192;

/** One part of a mod text: the rolled number is drawn in Exo 2 white (EE2 `ItemModifierText`). */
export interface TextPart {
  text: string;
  roll?: boolean;
}

/** A chip of the filter row (EE2 `FilterBtnNumeric` / `FilterBtnLogical`). */
type Chip =
  | { kind: 'numeric'; key: string; name: string; filter: FilterNumeric }
  | { kind: 'logical'; key: string; text: string; active: boolean; toggle?: () => void; collapse?: boolean };

/** An EE2 price: "4.5", "1 / 12", a range "3 ~ 5"; `div` prices are golden. */
interface QuickPrice {
  min: string;
  max: string | null;
  div: boolean;
  /** The currency as EE2 writes it after the amount: "exalted", "div", "chaos". */
  currency: string;
}

/** Rows of EE2's listing tables: always 20, empty ones keep the stripes going. */
const TABLE_ROWS = 20;
/** Bulk tables: at least 8 rows. */
const BULK_TABLE_ROWS = 8;

/** Bulk: EE2's three currencies to pay with, in its order. */
const BULK_CURRENCIES: readonly BulkHave[] = ['exalted', 'chaos', 'divine'];

/** Mod text with the rolled value in place of `#` (EE2 splits on `[+-]?#`, dropping the sign). */
export function modTextParts(text: string, roll: number | undefined): TextPart[] {
  const parts: TextPart[] = [];
  const pieces = text.split(/(?<![#])[+-]?[#]/gm);
  pieces.forEach((piece, i) => {
    if (piece !== '') parts.push({ text: piece });
    if (i !== pieces.length - 1) parts.push(roll == null ? { text: '#' } : { text: String(roll), roll: true });
  });
  return parts;
}

/**
 * EE2 `TradeListing.vue` `isLikelyPriceFixed`: a full page of listings of which fewer than five
 * ask for exalted, chaos, divine (or a small amount of the cheap orbs) is most likely priced in odd
 * currencies to look cheap.
 */
export function isLikelyPriceFixed(rows: ReadonlyArray<{ priceCurrency: string; priceAmount: number }>): boolean {
  if (rows.length <= 15) return false;
  const common = rows.filter(
    (row) =>
      /chaos|exalted|divine/i.test(row.priceCurrency) ||
      ((row.priceCurrency === 'aug' || row.priceCurrency === 'regal' || row.priceCurrency === 'transmute') && row.priceAmount < 30),
  );
  return common.length < 5;
}

/**
 * The price check as Exiled Exchange 2 lays it out (one column as tall as the game), over the
 * same logic as ours: everything comes from PriceCheckPanel, the template is EE2's. What EE2
 * shows and the base class does not compute (its chips, tags, tier badges, the mods behind a
 * filter, the trend arrows, "likely price fixed") is computed here.
 */
@Component({
  selector: 'app-ee2-price-check',
  imports: [NgTemplateOutlet, TranslatePipe, TrPipe, TrErrorPipe, NumInput, Currency, Ee2Icon, Ee2TitleBar],
  templateUrl: './ee2-price-check.html',
  host: { class: 'ee2-price-check relative flex min-h-0 flex-1 flex-row', '(mousedown)': 'backdropDown($event)', '(document:mousedown)': 'closeOnline($event)' },
})
export class Ee2PriceCheck extends PriceCheckPanel {
  /** Related items stand beside the column (the window grows by their panel), as in EE2. */
  protected readonly relatedBeside = computed(() => {
    const group = this.related();
    return !!group && ('error' in group || group.related.length > 0 || group.items.length > 0);
  });

  /**
   * Beside the column, on the side facing the screen centre: related items and the "Rate limiting"
   * tab, over the transparent rest of the window. Centred, the window grows on both sides so the
   * column itself stays in the centre of the game.
   */
  protected override themeWindowWidth(width: number): number {
    // The rate limiting panel, once opened, needs about as much room as the related items.
    const beside = this.relatedBeside() || this.showRateLimits() ? EE2_RELATED_WIDTH : EE2_RATE_TAB_WIDTH;
    return this.popupSide() === 'center' ? width + 2 * beside : width + beside;
  }

  protected readonly tableRows = TABLE_ROWS;
  /** "Collapse": the filters fold into the "N of M, stats" chip. */
  protected readonly statsFolded = signal(false);
  protected readonly showRateLimits = signal(false);
  protected readonly onlineOpen = signal(false);

  constructor() {
    super();
    // The oils of an instilment have their own poe.ninja prices.
    effect(() => {
      const oils = (this.active()?.stats ?? []).flatMap((filter) => filter.oils ?? []);
      if (oils.length) requestNinjaPrices(oils.map((name) => `ITEM::${name}`));
    });
    // A new item: filters unfolded, hidden ones not shown (EE2 `FiltersBlock`).
    effect(() => {
      this.item();
      untracked(() => {
        this.statsFolded.set(false);
        this.showHidden.set(false);
        this.onlineOpen.set(false);
      });
    });
  }

  // Name bar (EE2 `FilterName.vue`)

  protected readonly nameLabel = computed(() => {
    const filters = this.active()?.filters;
    if (!filters) return this.item().info.name;
    const search = filters.searchRelaxed && !filters.searchRelaxed.disabled ? filters.searchRelaxed : filters.searchExact;
    if (search.name) return search.name;
    if (search.baseType) return search.baseType;
    if (search.category) {
      const tradeId = CATEGORY_TO_TRADE_ID.get(search.category);
      if (tradeId) return t('item_category.prop', t(`item_category.${tradeId.replace('.', '_')}`));
    }
    return '???';
  });

  /** The name is framed when the search is narrowed from the category to it (EE2 `showAsActive`). */
  protected readonly nameExact = computed(() => this.active()?.filters.searchRelaxed?.disabled === true);

  protected toggleNameAccuracy(): void {
    const relaxed = this.active()?.filters.searchRelaxed;
    if (relaxed) this.setBase(!relaxed.disabled);
  }

  /**
   * EE2 has two states, Corrupted / Not Corrupted: the filter's value, flipped by a click (an
   * "only corrupted" search stays one). Ours: any / not / only corrupted (the same filter object).
   */
  protected readonly isCorrupted = computed(() => this.corrupted() !== 'not');

  protected toggleCorrupted(): void {
    const corrupted = this.active()?.filters.corrupted;
    if (!corrupted) return;
    corrupted.value = !corrupted.value;
    this.markChanged();
  }

  // poe.ninja line (EE2 `PriceTrend.vue` + `ItemQuickPrice.vue`)

  protected toQuick(min: number, max: number, currency: string, fraction: boolean): QuickPrice {
    const a = displayRounding(min, fraction);
    const b = displayRounding(max, fraction);
    return { min: a, max: a === b ? null : b, div: currency === 'div', currency };
  }

  /**
   * EE2 shows poe.ninja's price in its core currency (exalted, the Exalted Orb itself too) or in
   * divines from about one up; the Divine Orb always in exalted (EE2 `PriceTrend.vue`).
   */
  protected readonly ninjaQuick = computed(() => {
    const div = this.ninja()?.price?.primaryValue;
    if (div == null || !currencyRates.rates()) return null;
    const value = usePoeninja().autoCurrency(div, this.item().info.refName === 'Divine Orb');
    return this.toQuick(value.min, value.max, value.currency, this.active()?.filters.stackSize != null);
  });

  /** The currency icon after "N ×" (EE2: divine, chaos or its core currency, exalted). */
  protected quickIcon(price: QuickPrice): string {
    return price.currency === 'div' ? 'divine' : price.currency;
  }

  /** No poe.ninja line: EE2 still shows "icon → ?" for items that are not crafting bases. */
  protected readonly ninjaUnknown = computed(() => this.ninja() != null && !this.ninjaQuick() && !this.ninjaLoading() && !this.item().info.craftable);

  /** EE2 sizes the item picture by its inventory cells: 2 tall, 2 wide or 1×1. */
  protected readonly itemImgSize = computed(() => {
    const info = this.item().info;
    const base = info.unique ? (ITEM_BY_REF('ITEM', info.unique.base)?.[0] ?? info) : info;
    const w = base.w ?? 1;
    const h = base.h ?? 1;
    return h > 1 ? 'w-8 h-10 -my-1' : w > 1 ? 'w-12 h-8' : 'w-8 h-8';
  });

  /** The item picture, or EE2's "not found" picture. */
  protected readonly itemImg = computed(() => this.item().info.icon || '404');

  /**
   * Arrows and the sparkline. The number is ours (the week's change), the look EE2's: ⌃⌃ green
   * when up, ⌄⌄ red when down, ± when flat.
   */
  protected readonly trendView = computed(() => {
    const trend = this.ninja()?.trend;
    if (!trend) return null;
    const rounded = Math.round(Math.abs(trend.change));
    const forecast = rounded === 0 ? 'const' : trend.change > 0 ? 'up' : 'down';
    return { forecast, text: `${rounded} %`, path: this.trendPaths(trend.graph) };
  });

  /** EE2's 3 × 2 rem area chart: smooth line, gray-700 fill below, a little air above and below. */
  private trendPaths(graph: Array<number | null>): { line: string; area: string } {
    const points = graph.filter((p): p is number => p != null);
    if (!points.length) return { line: '', area: '' };
    const mean = points.reduce((a, b) => a + b, 0) / points.length;
    const spread = Math.sqrt(points.map((x) => (x - mean) ** 2).reduce((a, b) => a + b, 0) / Math.max(1, points.length - 1));
    const lo = Math.min(...points) - (spread || 1);
    const hi = Math.max(...points) + (spread || 1);
    const W = 48;
    const H = 32;
    const xy = points.map((p, i) => [points.length > 1 ? (i / (points.length - 1)) * W : 0, H - ((p - lo) / (hi - lo)) * H]);
    const r = (n: number) => Math.round(n * 10) / 10;
    let line = `M${r(xy[0][0])},${r(xy[0][1])}`;
    for (let i = 1; i < xy.length; i++) {
      // Catmull-Rom → Bézier: the "smooth" curve of ApexCharts.
      const p0 = xy[Math.max(0, i - 2)];
      const p1 = xy[i - 1];
      const p2 = xy[i];
      const p3 = xy[Math.min(xy.length - 1, i + 1)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      line += ` C${r(c1[0])},${r(c1[1])} ${r(c2[0])},${r(c2[1])} ${r(p2[0])},${r(p2[1])}`;
    }
    return { line, area: `${line} L${W},${H} L0,${H} Z` };
  }

  protected openNinja(): void {
    const url = this.ninja()?.url;
    if (url) void openUrl(url);
  }

  // Chips (EE2 `FiltersBlock.vue`, in its order)

  protected readonly ee2Chips = computed<Chip[]>(() => {
    const filters = this.active()?.filters;
    if (!filters) return [];
    const chips: Chip[] = [];
    const numeric = (key: string, filter: FilterNumeric | undefined, i18n: string) => {
      if (filter) chips.push({ kind: 'numeric', key, name: t(i18n, ''), filter });
    };
    const readonly = (key: string, text: string) => chips.push({ kind: 'logical', key, text, active: true });
    const logical = (key: string, filter: { disabled: boolean } | undefined, text: string, always = false) => {
      if (filter) {
        chips.push({ kind: 'logical', key, text, active: always || !filter.disabled, toggle: () => (filter.disabled = !filter.disabled) });
      }
    };
    numeric('socketNumber', filters.socketNumber, 'item.gem_sockets');
    numeric('linkedSockets', filters.linkedSockets, 'item.linked_sockets');
    numeric('mapTier', filters.mapTier, 'item.map_tier');
    numeric('awardedAscendancyPoints', filters.awardedAscendancyPoints, 'item.ascendancy_points');
    numeric('areaLevel', filters.areaLevel, 'item.area_level');
    numeric('heistWingsRevealed', filters.heistWingsRevealed, 'item.heist_wings_revealed');
    numeric('sentinelCharge', filters.sentinelCharge, 'item.sentinel_charge');
    if (filters.mapBlighted) readonly('blighted', t(filters.mapBlighted.value));
    if (filters.rarity?.value === 'magic') readonly('magic', t('Magic'));
    if (filters.rarity?.value === 'normal') readonly('normal', tr('Normal'));
    if (filters.discriminator?.value) readonly('discriminator', filters.discriminator.value);
    numeric('itemLevel', filters.itemLevel, 'item.item_level');
    numeric('requiresLevel', filters.requires?.level, 'item.requires_level');
    numeric('stackSize', filters.stackSize, 'item.stock');
    numeric('whiteSockets', filters.whiteSockets, 'item.white_sockets');
    numeric('augmentSockets', filters.augmentSockets, 'item.augment_sockets');
    numeric('gemLevel', filters.gemLevel, 'item.gem_level');
    numeric('quality', filters.quality, 'item.quality');
    if (filters.unidentifiedTier) {
      numeric('unidentifiedTier', filters.unidentifiedTier as FilterNumeric, 'item.unidentified_tier');
    } else {
      logical('unidentified', filters.unidentified, t('item.unidentified'));
    }
    logical('veiled', filters.veiled, t('item.veiled'));
    logical('foil', filters.foil, t('item.foil_unique'));
    if (filters.mirrored) logical('mirrored', filters.mirrored, t(filters.mirrored.disabled ? 'item.not_mirrored' : 'item.mirrored'), true);
    if (filters.sanctified) {
      logical('sanctified', filters.sanctified, t(filters.sanctified.disabled ? 'item.not_sanctified' : 'item.sanctified'), true);
    }
    if (filters.ultimatumHint) logical('ultimatum', filters.ultimatumHint, t(`item.${filters.ultimatumHint.value.toLowerCase()}`));
    if (this.hasStats()) {
      const on = this.counts().on;
      chips.push({
        kind: 'logical',
        key: 'stats',
        text: on > 0 ? t('filters.selected_some', on, this.counts().all) : t('filters.selected_none'),
        active: on > 0,
        toggle: () => this.statsFolded.update((folded) => !folded),
        collapse: this.statsFolded(),
      });
    }
    return chips;
  });

  protected clickChip(chip: Chip): void {
    if (chip.kind !== 'logical' || !chip.toggle) return;
    chip.toggle();
    if (chip.key !== 'stats') this.markChanged();
  }

  protected toggleNumeric(filter: FilterNumeric): void {
    filter.disabled = !filter.disabled;
    this.markChanged();
  }

  /** The chip field grows with its number, like EE2's (`1.2 + digits` ch). */
  protected chipInputWidth(value: number | '' | undefined): string {
    return `${1.2 + Math.max(String(value ?? '').length, 2)}ch`;
  }

  // Stat filters

  /** Unknown mods are listed after the filters (EE2 `UnknownModifier.vue`), except on sentinels and unique maps. */
  protected readonly unknownMods = computed(() => {
    const item = this.item();
    if (item.category === ItemCategory.Sentinel || (item.category === ItemCategory.Map && item.rarity === ItemRarity.Unique)) return [];
    return item.unknownModifiers;
  });

  protected readonly hasStats = computed(
    () =>
      (this.active()?.stats.length ?? 0) > 0 ||
      (this.unknownMods().length > 0 && this.item().rarity === ItemRarity.Unique) ||
      this.ee2Presets().length > 1,
  );

  /** Hidden on: only the hidden filters; off: only the others (EE2 `filteredStats`). */
  protected readonly ee2Stats = computed(() => (this.active()?.stats ?? []).filter((filter) => (filter.hidden != null) === this.showHidden()));

  protected readonly anyHidden = computed(() => (this.active()?.stats ?? []).some((filter) => filter.hidden != null));

  /** "Hidden", or "Explicit" for maps and waystones (EE2 `hiddenLabel`). */
  protected readonly hiddenLabel = computed(() => {
    const category = this.item().category;
    return category === ItemCategory.Map || category === ItemCategory.Waystone ? 'filters.hidden_explicit_toggle' : 'filters.hidden_toggle';
  });

  /** The unrevealed desecrated mods, searched as one filter: a row of its own after the stats. */
  protected readonly unrevealed = computed(() => {
    this.active();
    return this.showHidden() ? null : (this.statView().groups.find((group) => group.unrevealed)?.unrevealed ?? null);
  });

  /** EE2 `showMissingFracturedWarning`: a fractured item on "Base item" without a fractured mod. */
  protected readonly missingFractured = computed(() => {
    const item = this.item();
    return (
      !!item.isFractured &&
      this.presets()?.active === 'filters.preset_base_item' &&
      !item.statsByType.some((calc) => calc.type === ModifierType.Fractured)
    );
  });

  /** Pseudo / Base item like EE2; our extra "Mods" preset is not offered in this theme. */
  protected readonly ee2Presets = computed(() => (this.presets()?.presets ?? []).filter((preset) => preset.id !== MODS_PRESET_ID));

  protected filterText(filter: StatFilter): string {
    return INTERNAL_TRADE_IDS.includes(filter.tradeId[0]) ? t(filter.tradeId[0], '#', '#') : filter.text;
  }

  /** EE2 `showShortText`: "Grants Skill: Level 20 Fireball" shows as "Level 20 Fireball" until hovered. */
  protected shortText(text: string): string {
    return _$.GRANTS_SKILL && text.startsWith(_$.GRANTS_SKILL) ? text.slice(_$.GRANTS_SKILL.length) : text;
  }

  protected parts(text: string, roll?: number): TextPart[] {
    return modTextParts(text, roll);
  }

  /** "Q 20%" next to the defences and DPS of an item that can still take quality. */
  protected q20(filter: StatFilter): string | null {
    const ids = ['item.armour', 'item.evasion_rating', 'item.energy_shield', 'item.total_dps', 'item.physical_dps'];
    return ids.includes(filter.tradeId[0]) && itemIsModifiable(this.item()) ? t('item.prop_quality', Math.max(20, this.item().quality || 0)) : null;
  }

  /** EE2 `showTag`: the kind of the stat, not for properties, the empty-mod filter and plain unique mods. */
  protected tagOf(filter: StatFilter): { cls: string; text: string } | null {
    const item = this.item();
    const show =
      filter.tag !== FilterTag.Property &&
      filter.tradeId[0] !== 'item.has_empty_modifier' &&
      !['Chronicle of Atzoatl', 'Mirrored Tablet', 'Filled Coffin'].includes(item.info.refName) &&
      !(item.rarity === ItemRarity.Unique && (filter.tag === FilterTag.Explicit || filter.tag === FilterTag.Pseudo));
    if (!show) return null;
    const count = filter.sources.length > 1 ? ` x ${filter.sources.length}` : '';
    return { cls: `ee2-tag-${filter.tag}`, text: t(`filters.tag_${filter.tag.replace('-', '_')}`) + count };
  }

  /**
   * Our "search as fractured" switch is EE2's own tag: on a mod the trade site knows both ways, a
   * click on its "explicit" / "fractured" tag switches between them.
   */
  protected fracturedHint(filter: StatFilter): string {
    return this.fracturedState(filter) === 'on'
      ? tr('Searched as a fractured mod: click to search it as a regular one')
      : tr('Click to search it as a fractured mod');
  }

  /** Tier badges (EE2 `FilterModifierTiers.vue`; "tier 3+" only with "Always show tier", off by default). */
  protected tiers(filter: StatFilter): Array<{ cls: string; tier: number }> {
    const category = this.item().category;
    if (category === ItemCategory.Map || category === ItemCategory.Tablet) return [];
    const out: Array<{ cls: string; tier: number }> = [];
    const plainTags: string[] = [FilterTag.Explicit, FilterTag.Desecrated, FilterTag.Fractured, FilterTag.Crafted, FilterTag.Pseudo, FilterTag.Property];
    const jewel = [ItemCategory.Jewel, ItemCategory.ClusterJewel, ItemCategory.MemoryLine].includes(category!);
    for (const source of filter.sources) {
      const tier = source.modifier.info.tier;
      if (!tier) continue;
      if (plainTags.includes(filter.tag) && !jewel) {
        if (tier === 1) out.push({ cls: 'ee2-tier-1', tier });
        else if (tier === 2) out.push({ cls: 'ee2-tier-2', tier });
      } else if (tier >= 2) {
        out.push({ cls: 'ee2-not-tier-1', tier });
      }
    }
    return out.sort((a, b) => a.tier - b.tier);
  }

  private readonly emptyAffixKeys = ['item.has_empty_affix', 'item.has_empty_prefix', 'item.has_empty_suffix'];

  /** Any / Prefix / Suffix, those the item has room for (EE2 `FilterModifierItemHasEmpty.vue`). */
  protected emptyAffixChoices(filter: StatFilter): Array<{ value: number; key: string }> {
    const info = filter.additionalInfo?.emptyModifierInfo as Record<number, number> | undefined;
    return this.emptyAffixKeys.map((key, value) => ({ value, key })).filter((option) => !info || info[option.value]);
  }

  /** "Elemental DPS": Any / Fire / Cold / Lightning (EE2 `FilterModifierItemIsElemental.vue`). */
  protected elementalOptions(filter: StatFilter): Array<{ value: ItemIsElementalModifier; key: string; tag: string; selected: boolean }> {
    const info = filter.additionalInfo?.elementalInfo;
    if (filter.tradeId[0] !== 'item.elemental_dps' || !info || !filter.option) return [];
    const all = [
      [ItemIsElementalModifier.Any, 'any'],
      [ItemIsElementalModifier.Fire, 'fire'],
      [ItemIsElementalModifier.Cold, 'cold'],
      [ItemIsElementalModifier.Lightning, 'lightning'],
    ] as const;
    return all
      .map(([value, tag]) => ({ value, key: INTERNAL_TRADE_IDS[12 + value], tag, selected: filter.option!.value === value }))
      .filter((option) => option.key in info);
  }

  protected selectElemental(filter: StatFilter, value: ItemIsElementalModifier, onlyType = false): void {
    filter.option!.value = value;
    filter.disabled = false;
    const roll = filter.additionalInfo?.elementalInfo?.[INTERNAL_TRADE_IDS[12 + value]];
    if (roll) {
      // A right click: only this element, whatever the amount.
      if (onlyType) {
        roll.min = '';
        roll.max = '';
      }
      filter.roll = roll;
    }
    this.markChanged();
  }

  /** Mods on: the mods behind the filter under it while hovered (EE2 `showSourceInfo`). */
  protected showSourceInfo(filter: StatFilter): boolean {
    if (!this.showSources() || !filter.sources.length) return false;
    if (filter.option != null && filter.tradeId[0] !== 'item.elemental_dps') return false;
    const first = filter.sources[0].modifier.info;
    return filter.tag === FilterTag.Pseudo || filter.sources.length >= 2 || first.name != null || first.tier != null || first.rank != null;
  }

  /** One mod behind a filter (EE2 `SourceInfo.vue`): `Explicit "Rapturous" (Tier: 2)` and its lines. */
  protected sourceInfo(filter: StatFilter, source: StatFilter['sources'][number]) {
    const { info } = source.modifier;
    let title = t(`item.mod_${info.type}`);
    if (info.name != null) title += ` "${info.name}"`;
    if (info.tier != null) title += ` (${t('item.mod_tier', info.tier)})`;
    if (info.rank != null) title += ` (${t('item.mod_rank', info.rank)})`;

    let contribution = source.contributes?.value;
    if (contribution != null && filter.roll) {
      contribution = roundRoll(contribution * (filter.roll.isNegated ? -1 : 1), filter.roll.dp);
    }
    const lines = source.modifier.stats.map((parsed) => {
      if (parsed.stat.ref !== source.stat.stat.ref) {
        return { parts: modTextParts(parsed.translation.string, undefined), contributes: false, contribution: undefined };
      }
      const applied = applyIncr(info, parsed) ?? parsed;
      const roll = applied.roll ? roundRoll(applied.roll.value * (applied.translation.negate ? -1 : 1), applied.roll.dp) : undefined;
      return { parts: modTextParts(applied.translation.string, roll), contributes: true, contribution };
    });
    return { title, lines };
  }

  /**
   * The oils of an instilment ("Allocates Cooked") and what they cost together (EE2
   * `FilterModifierAnointment.vue`); "?" while poe.ninja has no price for one of them.
   */
  protected anointment(filter: StatFilter): { oils: Array<{ icon: string; name: string }>; price: QuickPrice | null } | null {
    if (!filter.oils) return null;
    const oils = filter.oils.map((name) => ITEM_BY_REF('ITEM', name)?.[0]);
    if (oils.some((oil) => !oil)) return null;
    let div: number | undefined = 0;
    for (const oil of oils) {
      const price = usePoeninja().findPriceByQuery({ ns: 'ITEM', name: oil!.refName });
      if (!price) {
        div = undefined;
        break;
      }
      div += price.primaryValue;
    }
    const value = div != null && currencyRates.rates() ? usePoeninja().autoCurrency(div) : null;
    return {
      oils: oils.map((oil) => ({ icon: oil!.icon, name: oil!.name })),
      price: value ? this.toQuick(value.min, value.max, value.currency, false) : null,
    };
  }

  // Roll slider (EE2 `StatRollSlider.vue`)

  protected slider(filter: StatFilter) {
    const roll = filter.roll!;
    const bounds = roll.bounds!;
    const span = bounds.max - bounds.min || 1;
    const min = roll.min;
    const max = roll.max;
    const tick = ((roll.value - bounds.min) / span) * 100;
    if (typeof min === 'number' && typeof max !== 'number') {
      return { mode: 'min', left: ((min - bounds.min) / span) * 100, right: 0, minIn: false, maxIn: true, tick };
    }
    if (typeof min !== 'number' && typeof max === 'number') {
      return { mode: 'max', left: 0, right: ((bounds.max - max) / span) * 100, minIn: true, maxIn: false, tick };
    }
    if (typeof min === 'number' && typeof max === 'number' && min <= max) {
      return {
        mode: 'range',
        left: ((min - bounds.min) / span) * 100,
        right: ((bounds.max - max) / span) * 100,
        minIn: min <= bounds.min,
        maxIn: max >= bounds.max,
        tick,
      };
    }
    return { mode: 'none', left: 0, right: 0, minIn: false, maxIn: false, tick };
  }

  /** Dragging on the slider moves the min (or the max, when only that is set). */
  protected slide(event: MouseEvent, filter: StatFilter, track: HTMLElement): void {
    const mode = this.slider(filter).mode;
    if (mode !== 'min' && mode !== 'max') return;
    event.preventDefault();
    const roll = filter.roll!;
    const bounds = roll.bounds!;
    const move = (e: MouseEvent) => {
      const rect = track.getBoundingClientRect();
      const k = Math.max(0, Math.min((e.clientX - rect.x) / rect.width, 1));
      const value = (bounds.max - bounds.min) * k + bounds.min;
      if (mode === 'min') this.setRoll(filter, 'min', percentRoll(value, -0, Math.floor, roll.dp));
      else this.setRoll(filter, 'max', percentRoll(value, +0, Math.ceil, roll.dp));
    };
    const stop = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', stop);
    };
    move(event);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', stop);
  }

  // Results

  /** After Search (and until a filter changes) the listings take the place of the Search button. */
  protected readonly showResults = computed(() => !this.stale() || this.isSearching());

  /** Always 20 rows once the search answered; empty ones keep the stripes (EE2 `groupedResults`). */
  protected readonly ee2Rows = computed(() => {
    const rows: Array<ReturnType<typeof this.search.rows>[number] | null> = this.search.searchResult() ? [...this.search.rows()] : [];
    while (rows.length < TABLE_ROWS) rows.push(null);
    return rows;
  });

  protected readonly isGem = computed(() => GEM.has(this.item().category!));
  protected readonly grantsSkill = computed(() => GRANTS_REAL_SKILL.has(this.item().category!));
  protected readonly isUncutGem = computed(() => this.item().category === ItemCategory.UncutGem);
  protected readonly showQuality = computed(() => {
    const quality = this.active()?.filters.quality;
    return (quality != null && !quality.disabled) || this.isGem();
  });

  /** "1 regal (0.1 ex)": the core currency's worth next to other currencies (EE2 `TradeItem.vue`). */
  protected listingPrice(row: ReturnType<typeof this.search.rows>[number]): string {
    const normalized =
      row.normalizedPriceCurrency && row.priceCurrency !== row.normalizedPriceCurrency.id && row.priceCurrency !== 'divine' && row.normalizedPrice
        ? ` (${row.normalizedPrice} ${row.normalizedPriceCurrency.abbrev})`
        : '';
    return `${row.priceAmount} ${row.priceCurrency}${normalized}`;
  }

  protected readonly likelyPriceFixed = computed(() => isLikelyPriceFixed(this.search.groupedResults()));

  /** "Filter by Exalt/Divine": EE2 sets the currency to exalted or divine and searches again. */
  protected filterExaltDivine(): void {
    this.setCurrency('exalted_divine');
  }

  /** Bulk: EE2's three currencies; one we do not search with (the item itself) stays "?". */
  protected readonly bulkCurrencies = BULK_CURRENCIES;

  protected bulkCanSelect(have: BulkHave): boolean {
    return this.bulk.haves().includes(have);
  }

  /** Bulk: at least 8 rows (EE2 `selectedResults`); bait offers are left out silently, as EE2 shows none. */
  protected readonly ee2BulkRows = computed(() => {
    const rows: Array<ReturnType<typeof this.bulkPriced>[number] | null> = this.bulk.current()
      ? this.bulkPriced().filter((row) => !(this.hideBait() && row.isBait))
      : [];
    while (rows.length < BULK_TABLE_ROWS) rows.push(null);
    return rows;
  });

  protected readonly floor = Math.floor;

  protected bulkNumber(value: number, digits: number): number {
    return Number(value.toFixed(digits));
  }

  /** "⟲ Instant" / "Online" / "Offline" (EE2 `OnlineFilter.vue`). */
  protected readonly onlineLabel = computed(() => {
    const type = this.active()?.filters.trade.listingType;
    return type === 'securable' ? tr('Instant') : type === 'any' ? tr('Offline') : tr('Online');
  });

  /** Orange when the listings are narrowed by time or currency. */
  protected readonly onlineWarning = computed(() => {
    const trade = this.active()?.filters.trade;
    return Boolean(trade && ((trade.listed && ['1day', '3days', '1week'].includes(trade.listed)) || trade.currency));
  });

  protected readonly tradeListingTypes: Array<{ value: ItemFilters['trade']['listingType']; label: string; ee2Key?: string }> = [
    { value: 'available', label: 'Instant or Online' },
    { value: 'securable', label: 'Instant' },
    { value: 'online', label: 'Online' },
    { value: 'any', label: '', ee2Key: 'online_filter.offline_toggle' },
  ];

  protected readonly bulkListingTypes: Array<{ value: ItemFilters['trade']['listingType']; label: string; ee2Key?: string }> = [
    { value: 'onlineleague', label: '', ee2Key: 'online_filter.in_league_toggle' },
    { value: 'online', label: 'Online' },
    { value: 'any', label: '', ee2Key: 'online_filter.offline_toggle' },
  ];

  protected readonly listedOptions: Array<{ value: string | undefined; key: string }> = [
    { value: undefined, key: 'online_filter.listed_any_time' },
    { value: '1day', key: 'online_filter.listed_1day' },
    { value: '3days', key: 'online_filter.listed_3days' },
    { value: '1week', key: 'online_filter.listed_1week' },
    { value: '2weeks', key: 'online_filter.listed_2weeks' },
    { value: '1month', key: 'online_filter.listed_1month' },
    { value: '2months', key: 'online_filter.listed_2months' },
  ];

  protected readonly ee2CurrencyOptions: Array<{ value: string | null; key: string }> = [
    { value: null, key: 'online_filter.currency_any' },
    { value: 'exalted', key: 'online_filter.currency_only_exalted' },
    { value: 'chaos', key: 'online_filter.currency_only_chaos' },
    { value: 'divine', key: 'online_filter.currency_only_div' },
    { value: 'exalted_divine', key: 'online_filter.currency_exalted_div' },
  ];

  /** A click anywhere but the online filter closes its popover, as tippy does. */
  protected closeOnline(event: MouseEvent): void {
    if (this.onlineOpen() && !(event.target as Element | null)?.closest?.('.ee2-online')) this.onlineOpen.set(false);
  }

  protected setListed(value: string | undefined): void {
    const trade = this.active()!.filters.trade;
    if (trade.listed === value) return;
    trade.listed = value;
    this.markChanged();
    this.runSearchSoon();
  }

  // Stack value (EE2 `StackValue.vue`): in the core currency, or divines from about one up.

  protected readonly stackValue = computed(() => {
    const filters = this.active()?.filters;
    const div = this.ninja()?.price?.primaryValue;
    if (!filters?.stackSize || div == null || !currencyRates.rates()) return null;
    const ninja = usePoeninja();
    const priceFor = (n: number) => {
      const value = ninja.autoCurrency(n * div);
      return `${displayRounding(value.min)} ${value.currency}`;
    };
    const have = filters.stackSize.value;
    const stack = this.item().stackSize?.max;
    return {
      have: { amount: have, price: priceFor(have) },
      stack: stack ? { amount: stack, price: priceFor(stack) } : null,
    };
  });

  // Related items (EE2 `RelatedItems.vue`): "→ 2.3 div" with the currency as text.

  protected relatedQuick(div: number | undefined): QuickPrice | null {
    const rates = currencyRates.rates();
    if (div == null || !rates) return null;
    const value = autoCurrency(div, rates);
    return this.toQuick(value.min, value.max, value.currency, true);
  }

  // Rate limiting tab (EE2 `RateLimiterState.vue`)

  protected readonly rateLimits = computed(() => {
    RATE_LIMIT_RULES_REVISION();
    const policies = [
      { policy: 'trade-search-request-limit', rules: RATE_LIMIT_RULES.SEARCH },
      { policy: 'trade-exchange-request-limit', rules: RATE_LIMIT_RULES.EXCHANGE },
      { policy: 'trade-fetch-request-limit', rules: RATE_LIMIT_RULES.FETCH },
    ];
    return policies.map(({ policy, rules }) => {
      const list = Array.from(rules);
      list.forEach((rule) => rule.revision());
      return {
        policy,
        hasQueue: list.some((rule) => rule.queue()),
        rules: list.map((rule) => ({ max: rule.max, window: rule.window, active: rule.stack.length, queue: rule.queue() })),
      };
    });
  });

  protected readonly isLimited = computed(() => this.rateLimits().some((limit) => limit.hasQueue));
}
