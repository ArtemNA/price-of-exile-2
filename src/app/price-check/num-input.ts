import { Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { host } from '../host';

/**
 * Number field of the price check window. The popup normally never takes focus, so a click
 * first asks the host to give it the keyboard. It goes back to the game on a click elsewhere
 * in the popup (PopupWindow), a click into the game, Esc or when the popup hides (host side) —
 * not on blur: WebView2 fires blur events of its own while the window activates.
 * ↑ ↓ step by 1 (0.1 for decimals), Shift ×10; Enter searches; the mouse wheel also steps.
 */
@Component({
  selector: 'app-num-input',
  template: `
    <input
      #field
      type="text"
      inputmode="decimal"
      [attr.aria-label]="label()"
      [placeholder]="placeholder()"
      [value]="shown()"
      class="h-5 w-10 border border-line-strong bg-well px-1 text-right text-xs text-bright tabular-nums outline-none placeholder:text-muted/70 focus:border-gold focus:shadow-[0_0_0_2px_rgba(201,161,90,0.25)]"
      (mousedown)="takeFocus($event)"
      (focus)="editing.set(true)"
      (input)="typed(field.value)"
      (keydown)="key($event)"
      (wheel)="wheel($event)"
      (blur)="editing.set(false)"
    />
  `,
})
export class NumInput {
  readonly value = input<number | '' | undefined>();
  readonly decimals = input(false);
  readonly label = input('');
  readonly placeholder = input('');
  readonly valueChange = output<number | ''>();
  readonly submit = output<void>();
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  /** While typing, show the raw text ("0." stays "0."), not the parsed number. */
  protected readonly editing = signal(false);
  private readonly text = signal('');
  protected readonly shown = computed(() => {
    if (this.editing()) return this.text();
    const value = this.value();
    return typeof value === 'number' ? String(value) : '';
  });

  protected takeFocus(event: MouseEvent): void {
    event.preventDefault();
    // Focus the field only once the window really has the keyboard: otherwise typing
    // would reach the game. If refused, the mouse wheel still works.
    void host.popupFocusInput().then((focused) => {
      if (!focused) return;
      const field = this.field().nativeElement;
      field.focus();
      // WebView2 moves focus around while the window activates: put it back once settled.
      setTimeout(() => document.activeElement !== field && field.focus(), 50);
    });
  }

  protected typed(raw: string): void {
    this.text.set(raw);
    const trimmed = raw.trim().replace(',', '.');
    if (trimmed === '') return this.valueChange.emit('');
    const number = Number(trimmed);
    if (Number.isFinite(number)) this.valueChange.emit(number);
  }

  private step(direction: 1 | -1, big: boolean): void {
    const value = this.value();
    const base = this.decimals() ? 0.1 : 1;
    const current = typeof value === 'number' ? value : 0;
    const raw = current + direction * base * (big ? 10 : 1);
    const next = this.decimals() ? Math.round(raw * 10) / 10 : raw;
    this.text.set(String(next));
    this.valueChange.emit(next);
  }

  protected key(event: KeyboardEvent): void {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.step(event.key === 'ArrowUp' ? 1 : -1, event.shiftKey);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.submit.emit();
    }
  }

  protected wheel(event: WheelEvent): void {
    event.preventDefault();
    this.step(event.deltaY < 0 ? 1 : -1, event.shiftKey);
  }
}
