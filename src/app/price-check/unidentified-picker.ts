import { Component, input, output } from '@angular/core';
import type { BaseType } from '@/assets/data';
import { TranslatePipe } from '../core/i18n';

/** "Which unique is it?" for an unidentified unique (APT `UnidentifiedResolver.vue`). */
@Component({
  selector: 'app-unidentified-picker',
  imports: [TranslatePipe],
  template: `
    <p class="mx-3 mt-3 mb-2 border border-line bg-well px-2.5 py-2 text-text">{{ 'item.identification' | t: baseName() }}</p>
    <div class="grid min-h-0 grid-cols-3 gap-2 overflow-y-auto px-3 pb-3">
      @for (unique of variants(); track unique.refName) {
        <button class="flex items-center gap-2.5 border border-line-strong bg-raised p-2 text-left hover:border-gold hover:bg-[#2a2218]"
          (click)="picked.emit(unique)">
          @if (unique.icon) {
            <img class="size-10 flex-none object-contain" [src]="unique.icon" alt="" />
          }
          <span class="font-display text-[14px] leading-tight text-[#d97a3a]">{{ unique.name }}</span>
        </button>
      }
    </div>
  `,
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class UnidentifiedPicker {
  readonly baseName = input.required<string>();
  readonly variants = input.required<BaseType[]>();
  readonly picked = output<BaseType>();
}
