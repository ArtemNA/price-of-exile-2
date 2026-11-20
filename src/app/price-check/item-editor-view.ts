import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import type { BaseType } from '@/assets/data';
import type { ParsedItem } from '@/parser';
import type { EditorItem } from '@/parser/ParsedItem';
import { currencyRates } from '../core/currency-rates';
import { TrPipe } from '../core/i18n';
import { autoCurrency, currencyTag, formatAmount } from '../core/ninja-prices';
import { Currency } from '../shared/currency';
import {
  augmentTabsFor,
  canReplace,
  catalystsFor,
  catalystTags,
  currentCatalyst,
  hasEdits,
  type ItemEdits,
  NO_EDITS,
  ninjaDivines,
  qualitySteps,
} from './item-editor';

/**
 * The item editor (EE2 `ItemEditorV2`): other runes, soul cores or idols in the sockets of a
 * weapon or armour, or a catalyst's quality on a ring, amulet or jewel. It only says what to
 * change; the price check applies the edits and makes the filters again (`applyEdits`).
 */
@Component({
  selector: 'app-item-editor',
  imports: [TrPipe, Currency],
  templateUrl: './item-editor-view.html',
  host: { class: 'block' },
})
export class ItemEditorView {
  /** The item as copied. */
  readonly item = input.required<ParsedItem>();
  /** The item with the edits applied (what the filters are made from). */
  readonly checked = input.required<ParsedItem>();
  readonly kind = input.required<'augment' | 'catalyst'>();
  readonly edits = input.required<ItemEdits>();
  /** Open by default (a theme showing it in a popover). */
  readonly startOpen = input(false);
  readonly change = output<ItemEdits>();

  private readonly openChoice = signal<boolean | null>(null);
  protected readonly open = computed(() => this.openChoice() ?? this.startOpen());
  protected readonly edited = computed(() => hasEdits(this.edits()));

  constructor() {
    // Another item: closed, no socket or quality chosen (EE2 resets its pick the same way).
    effect(() => {
      this.item();
      untracked(() => {
        this.openChoice.set(null);
        this.socketChoice.set(null);
        this.qualityChoice.set(null);
      });
    });
  }

  protected toggle(): void {
    this.openChoice.set(!this.open());
  }

  protected reset(): void {
    this.change.emit(NO_EDITS);
  }

  /** A price in divines as the price check shows prices: "4 ex", "1.2 div". */
  protected money(div: number | undefined): { text: string; currency: string } | null {
    const rates = currencyRates.rates();
    if (div == null || !rates) return null;
    const value = autoCurrency(div, rates);
    return { text: formatAmount(value.min), currency: currencyTag(value.currency) };
  }

  protected priceOf(refName: string): number | undefined {
    return ninjaDivines(currencyRates.prices(), refName);
  }

  // Sockets

  protected readonly sockets = computed(() => this.checked().augmentSockets?.augments ?? []);
  private readonly socketChoice = signal<number | null>(null);
  /** The socket the next pick goes into: the chosen one, else the first that can take one. */
  protected readonly socket = computed(() => {
    const chosen = this.socketChoice();
    if (chosen != null && chosen < this.sockets().length) return chosen;
    const free = this.sockets().findIndex((_, index) => canReplace(this.item(), index));
    return free < 0 ? null : free;
  });

  protected canReplace(index: number): boolean {
    return canReplace(this.item(), index);
  }

  protected selectSocket(index: number): void {
    if (!this.canReplace(index)) return;
    this.socketChoice.set(index);
    this.openChoice.set(true);
  }

  /** What the sockets hold now, priced; null without a price for any of them. */
  protected readonly socketsPrice = computed(() => {
    let sum = 0;
    let priced = false;
    for (const augment of this.sockets()) {
      const price = augment && this.priceOf(augment.refName);
      if (price != null) {
        sum += price;
        priced = true;
      }
    }
    return priced ? sum : undefined;
  });

  protected readonly tabs = computed(() => augmentTabsFor(this.item().category!));
  protected readonly tab = signal('rune');
  private readonly subChoice = signal('greater');
  protected readonly activeTab = computed(() => this.tabs().find((tab) => tab.id === this.tab()) ?? this.tabs()[0]);
  protected readonly activeSub = computed(() => {
    const tab = this.activeTab();
    return tab?.sub.find((sub) => sub.id === this.subChoice()) ?? tab?.sub[0];
  });

  protected selectTab(id: string): void {
    this.tab.set(id);
    this.subChoice.set(id === 'rune' ? 'greater' : 'normal');
  }

  protected selectSub(id: string): void {
    this.subChoice.set(id);
  }

  protected isIn(augment: EditorItem): boolean {
    const index = this.socket();
    return index != null && this.sockets()[index]?.refName === augment.refName;
  }

  protected put(augment: EditorItem): void {
    const index = this.socket();
    if (index == null) return;
    const augments = { ...this.edits().augments };
    const original = this.item().augmentSockets?.augments[index];
    if (original?.refName === augment.refName) delete augments[index];
    else augments[index] = augment;
    this.change.emit({ ...this.edits(), augments });
  }

  // Quality

  protected readonly catalysts = computed(() => catalystsFor(this.item()));
  protected readonly steps = computed(() => qualitySteps(this.item()));
  /** The catalyst and quality shown: the edit, else what the item came with. */
  protected readonly catalyst = computed(() => {
    const edit = this.edits().catalyst;
    if (edit) return { refName: edit.refName, quality: edit.quality };
    const own = currentCatalyst(this.item());
    return own ? { refName: own.refName, quality: this.item().quality ?? 0 } : null;
  });
  private readonly qualityChoice = signal<number | null>(null);
  protected readonly quality = computed(() => this.qualityChoice() ?? this.catalyst()?.quality ?? 20);

  protected catalystIcon(refName: string): string | undefined {
    return this.catalysts().find((catalyst) => catalyst.refName === refName)?.icon;
  }

  protected tags(catalyst: BaseType): string {
    return catalystTags(catalyst);
  }

  /** The catalysts the quality takes, priced: a catalyst adds 1 % (EE2 multiplies the same way). */
  protected readonly qualityPrice = computed(() => {
    const catalyst = this.edits().catalyst;
    if (!catalyst) return undefined;
    const price = this.priceOf(catalyst.refName);
    return price == null ? undefined : price * catalyst.quality;
  });

  protected setQuality(quality: number): void {
    this.qualityChoice.set(quality);
    const catalyst = this.edits().catalyst ?? (this.catalyst() ? { refName: this.catalyst()!.refName, quality } : null);
    if (catalyst) this.change.emit({ ...this.edits(), catalyst: { refName: catalyst.refName, quality } });
  }

  protected pickCatalyst(catalyst: BaseType): void {
    this.change.emit({ ...this.edits(), catalyst: { refName: catalyst.refName, quality: this.quality() } });
  }
}
