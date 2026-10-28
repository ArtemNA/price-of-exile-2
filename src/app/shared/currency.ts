import { Component, computed, input } from '@angular/core';
import { currencyIcon, currencyName } from '../core/currency-rates';
import { gameDataLoaded } from '../game-data';

/** A currency as the game shows it: its icon (by trade id: "chaos", "divine", …), the id when none. */
@Component({
  selector: 'app-currency',
  template: `
    @if (icon(); as src) {
      <img [src]="src" [alt]="name()" [title]="name()" class="inline-block object-contain align-[-0.2em]" [style.width.px]="size()" [style.height.px]="size()" />
    } @else {
      <span class="text-muted">{{ tag() }}</span>
    }
  `,
  host: { class: 'inline-flex flex-none' },
})
export class Currency {
  /** Trade currency id; poe.ninja's "div" means "divine". */
  readonly tag = input.required<string>();
  readonly size = input(16);
  private readonly id = computed(() => (this.tag() === 'div' ? 'divine' : this.tag()));
  protected readonly icon = computed(() => (gameDataLoaded() ? currencyIcon(this.id()) : undefined));
  protected readonly name = computed(() => (gameDataLoaded() ? currencyName(this.id()) : undefined) ?? this.id());
}
