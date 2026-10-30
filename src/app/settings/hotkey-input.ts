import { Component, input, output, signal } from '@angular/core';
import { TrPipe } from '../core/i18n';
import { hotkeyLabel, recordHotkey } from './hotkey';

/** Hotkey field (APT `HotkeyInput.vue`): click, press the keys; Backspace clears, Esc cancels. */
@Component({
  selector: 'app-hotkey-input',
  imports: [TrPipe],
  template: `
    <button
      class="h-7 w-44 border px-2 text-center tabular-nums outline-none"
      [class]="
        recording()
          ? 'border-gold bg-selected text-gold-soft'
          : invalid()
            ? 'border-bad-line bg-well text-bad'
            : 'border-line-strong bg-well text-bright hover:border-gold'
      "
      [attr.aria-label]="'{0} hotkey' | tr: label()"
      (click)="recording.set(true)"
      (blur)="recording.set(false)"
      (keydown)="keydown($event)"
    >
      @if (recording()) {
        {{ 'Press keys…' | tr }}
      } @else if (value(); as hotkey) {
        {{ format(hotkey) }}
      } @else {
        <span class="text-muted">{{ 'None' | tr }}</span>
      }
    </button>
  `,
})
export class HotkeyInput {
  readonly value = input<string | null>(null);
  readonly label = input('');
  readonly invalid = input(false);
  readonly changed = output<string | null>();
  protected readonly recording = signal(false);

  protected keydown(event: KeyboardEvent): void {
    if (!this.recording()) return;
    event.preventDefault();
    event.stopPropagation();
    const result = recordHotkey(event);
    if (result === 'wait') return;
    this.recording.set(false);
    if (result === 'clear') this.changed.emit(null);
    else if (result !== 'cancel') this.changed.emit(result.hotkey);
  }

  protected format(hotkey: string): string {
    return hotkeyLabel(hotkey);
  }
}
