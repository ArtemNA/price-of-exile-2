import { afterRenderEffect, Component, computed, DestroyRef, ElementRef, inject, input } from '@angular/core';
import { testReport } from '../test-fixtures';
import { t } from '../core/i18n';
import { type CardPlace, cardTop, listingCard } from './listing-card';

/** Socket art by what is in it (EE2 `UiDetailedItemImg` `t-<type>-<item>`); an empty ring otherwise. */
const SOCKET_IMAGES = new Set(['rune', 'soulcore', 'sacredtalisman', 'primaltalisman', 'vividtalisman', 'wildtalisman', 'blue', 'red', 'green']);

/**
 * The card of a listed item (EE2 `trade/TooltipItem.vue`): its art with the sockets, and the
 * game's tooltip — the title on the rarity's header, the blocks between rarity separators, each
 * mod's tier on the right. The same look in every theme, as it is the game's look.
 */
@Component({
  selector: 'app-listing-card',
  templateUrl: './listing-card-view.html',
  styleUrl: './listing-card-view.css',
  host: {
    class: 'listing-card',
    '[style.right.px]': "place().side === 'left' ? place().x : null",
    '[style.left.px]': "place().side === 'right' ? place().x : null",
    '[style.max-width.px]': 'place().maxWidth',
    '[style.max-height.px]': 'place().maxHeight',
  },
})
export class ListingCardView {
  /** The listed item and where its card stands (`cardPlace`), beside its row. */
  readonly place = input.required<CardPlace>();
  protected readonly card = computed(() => listingCard(this.place().item, (key) => t(key)));
  /** Sockets in rows as wide as the item (EE2 `socket-cols-N`). */
  protected readonly socketColumns = computed(() => Math.max(1, Math.min(this.card().sockets.length, this.card().icon?.w ?? 1)));

  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  constructor() {
    // Drawn hidden, then centred on the row by its own height and shown (the PoE1 app's way): no
    // frame shows it in the wrong place. Again for another row, and when its height changes (the
    // art loads, a longer item).
    this.host.style.visibility = 'hidden';
    afterRenderEffect({ write: () => this.placeOnRow() });
    const resized = new ResizeObserver(() => this.placeOnRow());
    resized.observe(this.host);
    inject(DestroyRef).onDestroy(() => resized.disconnect());
  }

  private placeOnRow(): void {
    const { rowMiddle, windowHeight, askedAt } = this.place();
    const shown = this.host.style.visibility !== 'hidden';
    this.host.style.top = `${cardTop(rowMiddle, this.host.offsetHeight, windowHeight)}px`;
    this.host.style.visibility = 'visible';
    // Test instance: from the pointer coming onto the row or eye to the frame the card is in.
    if (!shown && askedAt != null) {
      requestAnimationFrame(() => testReport(`[card] drawn in ${Math.round(performance.now() - askedAt)} ms, window ${window.innerWidth} px`));
    }
  }

  protected socketImage(socket: { item?: string }): string {
    return `/images/sockets/${socket.item && SOCKET_IMAGES.has(socket.item) ? socket.item : 'empty-socket'}.png`;
  }

  protected tierClass(tier: string): string {
    return tier.startsWith('S') ? 'tier-suffix' : tier.startsWith('P') ? 'tier-prefix' : '';
  }
}

/**
 * The eye at the start of a listing (our addition to EE2's tooltip): pointing at it shows the
 * listed item's card without a key, so the game keeps its Shift. Pale until the pointer is on it.
 */
@Component({
  selector: 'app-listing-eye',
  template: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
  </svg>`,
  styles: `
    :host { display: inline-flex; opacity: 0.4; cursor: default; }
    :host-context(.listing-eye:hover) { opacity: 1; }
  `,
})
export class ListingEye {}
