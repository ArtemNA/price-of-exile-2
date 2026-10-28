import { Component, computed, input, signal } from '@angular/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { ParsedItem } from '@/parser';
import { RARITY_COLORS } from '../constants';
import { currencyRates } from '../core/currency-rates';
import { tr, TranslatePipe, TrPipe } from '../core/i18n';
import { canCraftOfExile, craftOfExileUrl, poedbUrl, stashSearchText, weaponDps, wikiUrl } from '../core/item-links';
import { formatPercent, formatValue, itemQuote } from '../core/ninja-prices';
import { settings } from '../core/settings';
import { host } from '../host';
import type { ItemView } from '../popup-window/item-view';

/** Item check (APT `ItemInfo.vue`): links to item databases, find in stash, weapon DPS, dust, poe.ninja. */
@Component({
  selector: 'app-item-check',
  imports: [TranslatePipe, TrPipe],
  templateUrl: './item-check-panel.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class ItemCheckPanel {
  readonly item = input.required<ParsedItem>();
  readonly view = input.required<ItemView>();
  /** Inside the price check (Wiki tab): no name plate and no poe.ninja row, the window has them. */
  readonly compact = input(false);

  protected readonly plate = computed(() => RARITY_COLORS[this.view().rarity] ?? RARITY_COLORS['Normal']);
  protected readonly flags = computed(() =>
    [this.item().isCorrupted && 'Corrupted', this.item().isMirrored && 'Mirrored', this.item().isUnidentified && 'Unidentified']
      .filter((flag): flag is string => Boolean(flag))
      .map((flag) => tr(flag)),
  );
  protected readonly showCoE = computed(() => canCraftOfExile(this.item()));
  protected readonly dps = computed(() => weaponDps(this.item()));
  protected readonly ninja = computed(() =>
    itemQuote(currencyRates.prices(), this.item(), settings().leagueId, currencyRates.divine()),
  );
  protected readonly stashError = signal<string | null>(null);

  protected openWiki(): void {
    void openUrl(wikiUrl(this.item()));
  }

  protected openPoedb(): void {
    void openUrl(poedbUrl(this.item()));
  }

  protected openCoE(): void {
    void openUrl(craftOfExileUrl(this.item()));
  }

  protected openNinja(): void {
    const url = this.ninja()?.url;
    if (url) void openUrl(url);
  }

  protected async findInStash(): Promise<void> {
    this.stashError.set(null);
    try {
      await host.stashSearch(stashSearchText(this.item()));
    } catch (e) {
      this.stashError.set(String(e));
    }
  }

  protected price = formatValue;
  protected percent = formatPercent;
}
