import { Component, effect, input } from '@angular/core';
import { PRICE_CHECK_FULL_HEIGHT } from '../../src/app/constants';
import { settings } from '../../src/app/core/settings';
import { host } from '../../src/app/host';
import { themeById } from '../../src/app/themes';
import type { BaseType } from '@/assets/data';
import { TranslatePipe } from '../../src/app/core/i18n';
import { Ee2TitleBar } from './ee2-title-bar';

/** "Which one?" for an unidentified unique, as EE2 asks it (`UnidentifiedResolver.vue`). */
@Component({
  selector: 'app-ee2-unidentified-picker',
  imports: [TranslatePipe, Ee2TitleBar],
  template: `
    <div class="flex min-h-0 w-[460px] flex-none flex-col">
      <ee2-title-bar />
      <div class="flex min-h-0 grow flex-col bg-[#2d3748]">
        <div class="m-4 rounded bg-[#1a202c] px-2 py-1">{{ 'item.identification' | t: baseName() }}</div>
        <div class="grid grid-cols-2 gap-2 overflow-auto px-4 pb-4">
          @for (unique of variants(); track unique.refName) {
            <div class="flex">
              <button class="flex w-full items-center gap-x-3 rounded bg-[#4a5568] p-2" (click)="pick()(unique)">
                @if (unique.icon && unique.icon !== '%NOT_FOUND%') {
                  <img [src]="unique.icon" alt="" class="w-12" />
                } @else {
                  <span class="ee2-img-404 w-12"></span>
                }
                <div class="text-left leading-tight">{{ unique.name }}</div>
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  host: { class: 'ee2-price-check relative flex min-h-0 flex-1 flex-row' },
})
export class Ee2UnidentifiedPicker {
  readonly baseName = input.required<string>();
  readonly variants = input.required<BaseType[]>();
  /** The popup's callback: the theme's picker is created with NgComponentOutlet, which has no outputs. */
  readonly pick = input.required<(unique: BaseType) => void>();

  constructor() {
    // The same column as the price check: 460 px wide, as tall as the game.
    effect(() => {
      this.variants();
      void host.fitPopup(themeById(settings().theme).priceCheckSize?.width ?? 460, PRICE_CHECK_FULL_HEIGHT);
    });
  }
}
