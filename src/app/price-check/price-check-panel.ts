import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, effect, ElementRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ItemCategory, type ParsedItem } from '@/parser';
import type { FilterNumeric, FilterOrGroup, FilterTag, StatFilter } from '../../lib/apt/web/price-check/filters/interfaces';
import {
  apiToSatisfySearch,
  RATE_LIMIT_RULES,
  RATE_LIMIT_RULES_REVISION,
  tradeTag,
} from '../../lib/apt/web/price-check/trade/common';
import {
  CLOUDFLARE_CHECK_ERROR,
  CURRENCY_COLOR_OTHER,
  CURRENCY_COLORS,
  ITEM_CHIP_SHORT_LABELS,
  MODS_PRESET_ID,
  MODS_PRESET_LABEL,
  PRICE_CHECK_MAX_HEIGHT,
  PRICE_CHECK_MIN_HEIGHT,
  PRICE_CHECK_WIDTH,
  RARITY_COLORS,
} from '../constants';
import { currencyRates, toChaos } from '../core/currency-rates';
import {
  autoCurrency,
  CurrencyValue,
  formatPercent,
  formatValue,
  itemQuote,
  queryId,
  relatedItems,
  sparkline,
} from '../core/ninja-prices';
import { t, tr, TranslatePipe, TrPipe } from '../core/i18n';
import { settings, updateSettings } from '../core/settings';
import { host } from '../host';
import type { ItemView } from '../popup-window/item-view';
import {
  bestOffer,
  BulkHave,
  BulkRow,
  BulkSearch,
  bulkSiteUrl,
  MarketRatio,
  marketRatio,
  priceOffers,
  stackWorth,
} from './bulk-search';
import { ItemFilterChip, itemFilterChips } from './item-filter-chips';
import { formatChaos, limiterUsage, summarizeListings } from './listing-summary';
import { ItemCheckPanel } from '../item-check/item-check-panel';
import { Currency } from '../shared/currency';
import {
  baseSwitch,
  corruptedState,
  type CorruptedState,
  groupStats,
  setCorrupted,
  setExactBase,
  sourceLines,
  statCounts,
  statLine,
  statTier,
} from './filter-view';
import { NumInput } from './num-input';
import { activePreset, createItemPresets, Presets, shouldSearchImmediately } from './price-check';
import { GroupedResult, TradeSearch, tradeSiteUrl } from './trade-search';

type Group = Extract<FilterOrGroup, { group: string }>;
type Tab = 'trade' | 'bulk' | 'ninja' | 'wiki';

/** Tabs about the item itself rather than a search: switching to them keeps the search results. */
const INFO_TABS: readonly string[] = ['ninja', 'wiki'];
type BulkLine = { kind: 'offer'; row: BulkRow } | { kind: 'ratio'; ratio: MarketRatio };

/** Tabs of the results pane. Wiki: item check links, find in stash, weapon DPS. */
const TABS = [
  { id: 'trade', label: 'Trade' },
  { id: 'bulk', label: 'Bulk' },
  { id: 'ninja', label: 'poe.ninja' },
  { id: 'wiki', label: 'Wiki' },
] as const;

/**
 * The price check window body: filters on the left, trade listings on the right, status bar.
 * APT filter objects are mutable by design: edits change them in place and bump `revision`.
 */
@Component({
  selector: 'app-price-check',
  imports: [NgTemplateOutlet, TranslatePipe, TrPipe, NumInput, ItemCheckPanel, Currency],
  templateUrl: './price-check-panel.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class PriceCheckPanel {
  readonly item = input.required<ParsedItem>();
  readonly view = input.required<ItemView>();

  protected readonly cloudflareError = CLOUDFLARE_CHECK_ERROR;
  protected readonly presets = signal<Presets | null>(null);
  protected readonly error = signal<string | null>(null);
  /** Filters changed since the last search: the user starts the next one. */
  protected readonly stale = signal(true);
  protected readonly search = new TradeSearch();
  protected readonly bulk = new BulkSearch();
  protected readonly tabs = TABS;
  /** Bait offers (far below poe.ninja) are hidden unless the user asks to see them. */
  protected readonly hideBait = signal(true);
  private readonly tabChoice = signal<Tab | null>(null);
  protected readonly open = signal({ stats: true, item: true, trade: false });
  private readonly revision = signal(0);
  private previous?: { item: ParsedItem; presets: Presets };

  /**
   * The same preset object after an edit, so it never counts as equal: everything read from it
   * (corrupted, base, chips, stat groups) has to be read again on each `revision`.
   */
  protected readonly active = computed(
    () => {
      this.revision();
      const presets = this.presets();
      return presets ? activePreset(presets) : null;
    },
    { equal: () => false },
  );

  protected readonly chips = computed(() => {
    const active = this.active();
    return active ? itemFilterChips(active.filters) : [];
  });

  protected readonly plate = computed(() => RARITY_COLORS[this.view().rarity] ?? RARITY_COLORS['Normal']);

  // Header (design A+B): the item, its base and status switches, the poe.ninja answer.

  /** Stackables, fragments, divination cards, gems and maps show their icon, as in APT. */
  protected readonly itemIcon = computed(() => {
    const item = this.item();
    const iconic =
      tradeTag(item) != null ||
      [ItemCategory.DivinationCard, ItemCategory.Gem, ItemCategory.Map, ItemCategory.CapturedBeast].includes(item.category!);
    return iconic ? item.info.icon || null : null;
  });

  protected readonly base = computed(() => {
    const active = this.active();
    return active ? baseSwitch(active.filters) : null;
  });

  protected readonly corrupted = computed(() => {
    const active = this.active();
    return active ? corruptedState(active.filters) : null;
  });

  protected readonly corruptedOptions: Array<{ value: CorruptedState; label: string }> = [
    { value: 'any', label: 'Any' },
    { value: 'not', label: 'Not corrupted' },
    { value: 'only', label: 'Corrupted' },
  ];

  /** Item filters shown as chips in the header; the base, rarity and corrupted have their own controls. */
  protected readonly headerChips = computed(() => this.chips().filter((chip) => !['base', 'rarity', 'corrupted'].includes(chip.key)));
  protected readonly rarityChip = computed(() => this.chips().find((chip) => chip.key === 'rarity') ?? null);

  protected chipLabel(chip: ItemFilterChip): string {
    const short = ITEM_CHIP_SHORT_LABELS[chip.key];
    return short ? tr(short) : chip.label;
  }

  /** A unique the trade site prices by name: links and corruption decide, no stat filters. */
  protected readonly uniqueWithoutStats = computed(() => this.view().rarity === 'Unique' && !this.active()?.stats.length);

  protected readonly searchedOnce = computed(() => !!(this.search.searchResult() || this.bulk.current()));

  protected setBase(exact: boolean): void {
    setExactBase(this.active()!.filters, exact);
    this.markChanged();
  }

  protected setCorruptedState(state: CorruptedState): void {
    setCorrupted(this.active()!.filters, state);
    this.markChanged();
  }

  // Stat filters (design A+B): groups, tiers, hidden ones, the mods behind totals.

  protected readonly showHidden = signal(false);
  protected readonly showSources = signal(false);

  protected readonly statView = computed(() => {
    const active = this.active();
    return active ? groupStats(active.stats) : { groups: [], hidden: [] };
  });

  protected readonly counts = computed(() => {
    const active = this.active();
    return active ? statCounts(active.stats) : { on: 0, all: 0 };
  });

  protected tier(filter: StatFilter): number | null {
    return statTier(filter);
  }

  protected sources(filter: StatFilter) {
    return this.showSources() ? sourceLines(filter) : [];
  }

  /** "1 Empty or Crafted Modifier": which affix has to be free (APT `ItemHasEmptyModifier`). */
  protected emptyAffix(filter: StatFilter): number | null {
    return filter.tradeId[0] === 'item.has_empty_modifier' && filter.option ? filter.option.value : null;
  }

  protected readonly emptyAffixOptions = [
    { value: 0, label: 'Any' },
    { value: 1, label: 'Prefix' },
    { value: 2, label: 'Suffix' },
  ];

  protected setEmptyAffix(filter: StatFilter, value: number): void {
    filter.option!.value = value;
    filter.disabled = false;
    this.markChanged();
  }

  protected hiddenReason(filter: FilterOrGroup): string {
    const reason = filter.group ? filter.meta.hidden : filter.hidden;
    return reason ? t(reason) : '';
  }

  protected readonly summary = computed(() => summarizeListings(this.search.groupedResults(), currencyRates.rates()));

  /** "30 chaos" → { amount: "30", currency: "chaos" }, for the price with its icon. */
  protected splitPrice(price: string): { amount: string; currency: string } {
    const at = price.lastIndexOf(' ');
    return at < 0 ? { amount: price, currency: '' } : { amount: price.slice(0, at), currency: price.slice(at + 1) };
  }

  /** The "≈ chaos" column only when some listing is in another currency. */
  protected readonly mixedCurrencies = computed(() => this.search.rows().some((row) => row.priceCurrency !== 'chaos'));

  protected readonly limits = computed(() => {
    RATE_LIMIT_RULES_REVISION();
    const format = (usage?: { used: number; max: number }) => (usage ? `${usage.used}/${usage.max}` : '—');
    return this.activeTab() === 'bulk'
      ? tr('Exchange {0}', format(limiterUsage(RATE_LIMIT_RULES.EXCHANGE)))
      : tr('Search {0} · Fetch {1}', format(limiterUsage(RATE_LIMIT_RULES.SEARCH)), format(limiterUsage(RATE_LIMIT_RULES.FETCH)));
  });

  // Tabs

  /** Bulk exchange exists only for items with a trade tag (currency, fragments, essences, …). */
  protected readonly canBulk = computed(() => tradeTag(this.item()) != null);

  /** Like APT: bulk when no stat filter is on and the item can be exchanged; the user may switch. */
  protected readonly activeTab = computed<Tab>(() => {
    const choice = this.tabChoice();
    if (choice) return choice;
    const active = this.active();
    return active ? apiToSatisfySearch(this.item(), active.stats, active.filters) : 'trade';
  });

  protected tabReady(id: string): boolean {
    return id !== 'bulk' || this.canBulk();
  }

  protected selectTab(id: string): void {
    if (!this.tabReady(id) || id === this.activeTab()) return;
    const searchTab = !INFO_TABS.includes(this.activeTab()) && !INFO_TABS.includes(id);
    this.tabChoice.set(id as Tab);
    // poe.ninja and Wiki show the same item: switching to them and back keeps the search results.
    if (searchTab) this.stale.set(true);
  }

  protected readonly isSearching = computed(() => this.search.isSearching() || this.bulk.isSearching());
  protected readonly searchError = computed(() => (this.activeTab() === 'bulk' ? this.bulk.error() : this.search.error()));

  // poe.ninja

  /** poe.ninja entry for the item (null: it has no poe.ninja id). */
  protected readonly ninja = computed(() =>
    itemQuote(currencyRates.prices(), this.item(), settings().leagueId, currencyRates.divine()),
  );

  protected updatedAgo(): string {
    const date = currencyRates.updatedAt();
    if (!date) return '';
    const minutes = Math.round((Date.now() - date.getTime()) / 60000);
    return minutes < 1 ? tr('updated just now') : tr('updated {0} min ago', minutes);
  }

  protected readonly ninjaLoading = computed(() => currencyRates.updatedAt() == null && !currencyRates.error());
  protected readonly ninjaError = currencyRates.error;
  protected readonly ninjaBaseOnly = computed(() => this.ninja()?.baseOnly ?? false);
  protected readonly ninjaValue = computed(() => this.ninja()?.value ?? null);

  protected readonly ninjaSpark = computed(() => {
    const trend = this.ninja()?.trend;
    return trend ? sparkline(trend.graph, 300, 64) : null;
  });

  /** The small trend line next to the price in the header. */
  protected readonly headerSpark = computed(() => {
    const trend = this.ninja()?.trend;
    return trend ? sparkline(trend.graph, 64, 34) : null;
  });

  /** poe.ninja value as a number and a currency id for its icon ("div" → "divine"). */
  protected readonly ninjaAmount = computed(() => {
    const value = this.ninjaValue();
    if (!value) return null;
    const text = formatValue(value, value.currency === 'div');
    return { text: text.replace(/\s*(c|div)$/, ''), currency: value.currency === 'div' ? 'divine' : 'chaos' };
  });

  protected readonly related = computed(() => {
    const query = this.ninja()?.query;
    return query ? relatedItems(queryId(query), currencyRates.prices()) : null;
  });

  protected price(value: CurrencyValue | null | undefined, fraction = false): string {
    return formatValue(value, fraction);
  }

  /** The set the item belongs to, shown next to the filters whenever there is one (as APT does). */
  protected readonly relatedGroup = computed(() => {
    const group = this.related();
    return group && !('error' in group) && group.related.length ? group : null;
  });

  /** The related list is open; for items with mods it can be folded into one line by its heading. */
  protected readonly relatedOpen = signal(true);
  protected readonly relatedFoldable = computed(() => {
    const view = this.statView();
    return view.groups.length > 0 || view.hidden.length > 0;
  });
  protected readonly relatedFolded = computed(() => this.relatedFoldable() && !this.relatedOpen());
  protected readonly relatedCount = computed(() => {
    const group = this.relatedGroup();
    return group ? group.related.length + group.items.length : 0;
  });

  /** A related item's price as an amount and a currency id for its icon. */
  protected relatedPrice(chaos: number | undefined): { text: string; currency: string } | null {
    if (chaos == null) return null;
    const value = autoCurrency(chaos, currencyRates.divine());
    return { text: formatValue(value, true).replace(/\s*(c|div)$/, ''), currency: value.currency === 'div' ? 'divine' : 'chaos' };
  }

  /** A translated sentence split around its `{0}`, for a value shown with its own style. */
  protected around(text: string): [string, string] {
    const at = text.indexOf('{0}');
    return at < 0 ? [text, ''] : [text.slice(0, at), text.slice(at + 3)];
  }

  protected percent(value: number): string {
    return formatPercent(value);
  }

  // Bulk

  /** poe.ninja chaos price of the item being priced (currency, fragment, essence, …). */
  protected readonly ninjaChaos = computed(() => currencyRates.rates().get(this.item().info.refName));

  private readonly bulkPriced = computed(() =>
    priceOffers(this.bulk.current()?.listed ?? [], this.bulk.selected(), this.ninjaChaos(), currencyRates.divine()),
  );

  protected readonly bulkBest = computed(() => bestOffer(this.bulkPriced()));
  protected readonly bulkBaitCount = computed(() => this.bulkPriced().filter((row) => row.isBait).length);

  /** Offers with poe.ninja's price slotted in where it belongs (APT "Market Ratio" row). */
  protected readonly bulkLines = computed<BulkLine[]>(() => {
    const rows = this.bulkPriced().filter((row) => !(this.hideBait() && row.isBait));
    const lines: BulkLine[] = rows.map((row) => ({ kind: 'offer', row }));
    const ninja = this.ninjaChaos();
    const ratio = ninja != null ? marketRatio(this.bulk.selected(), ninja, currencyRates.divine()) : undefined;
    if (ratio) {
      const perItem = ratio.exchangeAmount / ratio.itemAmount;
      const at = rows.findIndex((row) => row.exchangeAmount / row.itemAmount >= perItem);
      lines.splice(at === -1 ? lines.length : at, 0, { kind: 'ratio', ratio });
    }
    return lines;
  });

  /** "You have × 12 → 4,111 chaos" from the stock filter or the copied stack (APT StackValue). */
  protected readonly youHave = computed(() => {
    const ninja = this.ninjaChaos();
    const amount = this.active()?.filters.stackSize?.value ?? this.item().stackSize?.value;
    if (ninja == null || !amount) return null;
    const isDivine = this.item().info.refName === 'Divine Orb';
    return { amount, worth: stackWorth(amount, ninja, currencyRates.divine(), isDivine) };
  });

  protected selectHave(have: BulkHave): void {
    void this.bulk.select(have);
  }

  protected toggleHideBait(): void {
    this.hideBait.update((hide) => !hide);
  }

  protected amount(value: number): string {
    return formatChaos(value);
  }

  protected readonly tradeSummary = computed(() => {
    const trade = this.active()?.filters.trade;
    if (!trade) return '';
    return [tr(trade.offline ? 'online & offline' : 'online'), tr(trade.merchantOnly ? 'instant buyout' : 'any listing')].join(' · ');
  });

  private readonly filtersScroll = viewChild<ElementRef<HTMLElement>>('filtersScroll');

  constructor() {
    effect(() => {
      const item = this.item();
      untracked(() => this.start(item));
    });
    this.fitHeightToFilters();
  }

  /**
   * The window is as tall as the filters need (within PRICE_CHECK_MIN/MAX_HEIGHT and the game),
   * so items with many mods do not scroll. Watches the filter list for any change.
   */
  private fitHeightToFilters(): void {
    let frame = 0;
    let lastHeight = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const scroller = this.filtersScroll()?.nativeElement;
        if (!scroller) return;
        const content = Array.from(scroller.children).reduce((sum, child) => {
          const style = getComputedStyle(child);
          return sum + child.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
        }, 0);
        const wanted = window.innerHeight - scroller.clientHeight + Math.ceil(content);
        const height = Math.min(PRICE_CHECK_MAX_HEIGHT, Math.max(PRICE_CHECK_MIN_HEIGHT, wanted));
        if (height === lastHeight) return;
        lastHeight = height;
        void host.fitPopup(PRICE_CHECK_WIDTH, height);
      });
    };
    const observer = new MutationObserver(fit);
    effect(() => {
      observer.disconnect();
      this.item(); // a new item: fit again even if the list looks the same
      lastHeight = 0;
      const scroller = this.filtersScroll()?.nativeElement;
      if (scroller) {
        observer.observe(scroller, { childList: true, subtree: true, attributes: true, characterData: true });
        fit();
      }
    });
    inject(DestroyRef).onDestroy(() => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    });
  }

  private start(item: ParsedItem): void {
    this.search.reset();
    this.bulk.reset();
    this.tabChoice.set(null);
    this.error.set(null);
    this.relatedOpen.set(true);
    const leagueId = settings().leagueId;
    if (!leagueId) {
      this.presets.set(null);
      this.error.set('No league selected: choose one in the title bar.');
      return;
    }
    const presets = createItemPresets(item, leagueId, this.previous);
    this.previous = { item, presets };
    this.presets.set(presets);
    this.stale.set(true);
    if (shouldSearchImmediately(item, presets)) this.runSearch();
  }

  protected runSearch(): void {
    const active = this.active();
    if (!active || this.isSearching()) return;
    if (INFO_TABS.includes(this.activeTab())) this.tabChoice.set(null); // Search goes to trade or bulk
    this.stale.set(false);
    if (this.activeTab() === 'bulk') void this.bulk.search(this.item(), active.filters);
    else void this.search.search(active.filters, active.stats);
  }

  protected selectPreset(id: string): void {
    this.presets.update((presets) => presets && { ...presets, active: id });
    this.markChanged();
  }

  protected presetLabel(id: string): string {
    return id === MODS_PRESET_ID ? tr(MODS_PRESET_LABEL) : t(id);
  }

  protected isOpen(key: string): boolean {
    return this.open()[key as 'stats' | 'item' | 'trade'];
  }

  protected toggleSection(key: 'stats' | 'item' | 'trade'): void {
    this.open.update((open) => ({ ...open, [key]: !open[key] }));
  }

  /** Stat and item filter edits wait for the Search button, like in APT. */
  private markChanged(): void {
    this.revision.update((n) => n + 1);
    this.stale.set(true);
  }

  // Item filters

  protected toggleChip(chip: ItemFilterChip): void {
    chip.toggle();
    this.markChanged();
  }

  protected setNumeric(filter: FilterNumeric, which: 'value' | 'max', value: number | ''): void {
    if (which === 'value') {
      if (value === '') return;
      filter.value = value;
    } else {
      filter.max = value === '' ? undefined : value;
    }
    filter.disabled = false;
    this.markChanged();
  }

  // Online filters change the search right away (as in APT).

  protected toggleOffline(): void {
    const trade = this.active()!.filters.trade;
    trade.offline = !trade.offline;
    this.revision.update((n) => n + 1);
    this.runSearchSoon();
  }

  protected toggleMerchantOnly(): void {
    const trade = this.active()!.filters.trade;
    trade.merchantOnly = !trade.merchantOnly;
    this.revision.update((n) => n + 1);
    this.runSearchSoon();
  }

  private runSearchSoon(): void {
    this.stale.set(true);
    if (!this.isSearching()) this.runSearch();
  }

  // Stat filters

  protected isGroup(filter: FilterOrGroup): filter is Group {
    return Boolean(filter.group);
  }

  protected asStat(filter: FilterOrGroup): StatFilter {
    return filter as StatFilter;
  }

  protected toggleStat(filter: StatFilter): void {
    filter.disabled = !filter.disabled;
    this.markChanged();
  }

  protected toggleGroup(group: Group): void {
    group.expanded = !group.expanded;
    this.revision.update((n) => n + 1);
  }

  protected statText(filter: StatFilter): string {
    return statLine(filter.text, filter.statRef, filter.roll?.value);
  }

  /** Short tag before non-explicit stats ("implicit", "crafted", …); none for item properties (APT `showTag`). */
  protected statTag(filter: StatFilter): string {
    const untagged = ['explicit', 'pseudo', 'property', 'mercenary-support'];
    if (untagged.includes(filter.tag) || this.fracturedState(filter)) return ''; // the F button shows fractured
    return t(`filters.tag_${filter.tag.replace('-', '_')}`);
  }

  /** A mod the trade site knows both as explicit and as fractured: 'on' while searched as fractured. */
  protected fracturedState(filter: StatFilter): 'on' | 'off' | null {
    if (filter.tag !== 'explicit' && filter.tag !== 'fractured') return null;
    const ids = filter.sources[0]?.stat.stat.trade.ids;
    if (!ids?.explicit || !ids?.fractured) return null;
    return filter.tag === 'fractured' ? 'on' : 'off';
  }

  protected toggleFractured(filter: StatFilter): void {
    const type = filter.tag === 'fractured' ? 'explicit' : 'fractured';
    const ids = filter.sources[0].stat.stat.trade.ids;
    filter.tag = type as FilterTag;
    filter.tradeId = ids[type];
    this.markChanged();
  }

  protected rollValue(filter: StatFilter, which: 'min' | 'max'): number | '' | undefined {
    return filter.roll?.[which];
  }

  protected setRoll(filter: StatFilter, which: 'min' | 'max', value: number | ''): void {
    if (!filter.roll) return;
    filter.roll[which] = value;
    filter.disabled = false;
    this.markChanged();
  }

  // Listings

  protected dot(row: GroupedResult): string {
    return CURRENCY_COLORS[row.priceCurrency] ?? CURRENCY_COLOR_OTHER;
  }

  /** "≈ 3.8" for listings not priced in chaos. */
  protected equivalent(row: GroupedResult): string {
    if (row.priceCurrency === 'chaos') return '';
    const chaos = toChaos(row.priceAmount, row.priceCurrency, currencyRates.rates());
    return chaos != null ? `≈ ${formatChaos(chaos)}` : '';
  }

  protected isCheapest(row: GroupedResult): boolean {
    return `${row.priceAmount} ${row.priceCurrency}` === this.summary().cheapest?.price;
  }

  protected detailHeader(rows: GroupedResult[]): string {
    if (rows.some((r) => r.stackSize != null)) return tr('Stack');
    if (rows.some((r) => r.level != null)) return tr('Lvl / Q');
    return 'iLvl';
  }

  protected detail(row: GroupedResult): string {
    if (row.stackSize != null) return String(row.stackSize);
    if (row.level != null) return [row.level, row.quality].filter(Boolean).join(' / ');
    return row.itemLevel ?? '';
  }

  protected openTradeSite(): void {
    if (this.activeTab() === 'ninja') {
      const url = this.ninja()?.url;
      if (url) void openUrl(url);
      return;
    }
    const active = this.active();
    if (!active) return;
    const url =
      this.activeTab() === 'bulk'
        ? bulkSiteUrl(this.item(), active.filters, this.bulk.selected())
        : tradeSiteUrl(active.filters, active.stats, this.stale() ? undefined : this.search.searchResult()?.id);
    // With the built-in browser on, the trade site opens there, logged in (APT `TradeLinks.vue`).
    if (settings().priceCheck.builtinBrowser) void host.browserOpen(url);
    else void openUrl(url);
  }

  /** Cloudflare blocked the request: the built-in browser takes over the requests and shows the check. */
  protected openBrowserForCheck(): void {
    updateSettings({ priceCheck: { ...settings().priceCheck, builtinBrowser: true } });
    void host.browserOpen();
  }
}
