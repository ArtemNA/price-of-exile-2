import { Component, effect, input } from '@angular/core';
import { PRICE_CHECK_FULL_HEIGHT } from '../../src/app/constants';
import { settings } from '../../src/app/core/settings';
import { host } from '../../src/app/host';
import { themeById } from '../../src/app/themes';
import { TranslatePipe, TrPipe } from '../../src/app/core/i18n';
import { Ee2TitleBar } from './ee2-title-bar';

/**
 * A price check without an item (it cannot be read, it was copied in another game language), as
 * EE2 shows a parse error: its column with a red-bordered error box (`UiErrorBox.vue`).
 */
@Component({
  selector: 'app-ee2-price-check-message',
  imports: [TranslatePipe, TrPipe, Ee2TitleBar],
  template: `
    <div class="flex min-h-0 w-[460px] flex-none flex-col">
      <ee2-title-bar />
      <div class="flex min-h-0 grow flex-col bg-[#2d3748]">
        @if (tone() === 'info') {
          <div class="m-4 rounded bg-[#1a202c] px-2 py-1">{{ message() }}</div>
        } @else {
          <div class="ee2-error-box m-4">
            <h4 class="text-[#fc8181]">{{ tone() === 'error' ? ('item.parse_error' | t) : ('Wrong game language' | tr) }}</h4>
            <p>{{ message() }}</p>
          </div>
        }
      </div>
    </div>
  `,
  host: { class: 'ee2-price-check relative flex min-h-0 flex-1 flex-row justify-center' },
})
export class Ee2PriceCheckMessage {
  readonly message = input.required<string>();
  readonly tone = input<'error' | 'warning' | 'info'>('error');

  constructor() {
    // The same column as the price check: 460 px wide, as tall as the game.
    effect(() => {
      this.message();
      void host.fitPopup(themeById(settings().theme).priceCheckSize?.width ?? 460, PRICE_CHECK_FULL_HEIGHT);
    });
  }
}
