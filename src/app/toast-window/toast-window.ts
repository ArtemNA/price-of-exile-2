import { Component, computed, signal } from '@angular/core';
import { getName } from '@tauri-apps/api/app';
import { listen } from '@tauri-apps/api/event';
import { TOAST_MESSAGE_EVENT } from '../constants';
import { tr, TrPipe } from '../core/i18n';
import { settings } from '../core/settings';
import { host, type ToastMessage } from '../host';
import { hotkeyLabel } from '../settings/hotkey';

/**
 * The corner message: the overlay runs (its main hotkeys, the tray), or a new version was found.
 * A click opens the settings, where the update banner installs it and links what is new.
 */
@Component({
  selector: 'app-toast-window',
  imports: [TrPipe],
  template: `
    <button class="flex h-full w-full items-center gap-3 border border-frame bg-panel px-3.5 text-left font-sans text-text shadow-[0_0_0_1px_var(--color-frame-shadow)]"
      [class.cursor-default]="installing()" (click)="openSettings()">
      <svg class="flex-none" width="30" height="30" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M6 0l6 6-6 6-6-6z" fill="var(--color-gold)" />
        <path d="M6 3l3 3-3 3-3-3z" fill="var(--color-panel)" />
        <path d="M6 4.3l1.7 1.7L6 7.7 4.3 6z" fill="var(--color-gold-soft)" />
      </svg>
      @if (message(); as m) {
        @if (m.kind === 'update') {
          <span class="flex min-w-0 flex-col gap-0.5">
            <span class="font-display text-[16px] leading-tight text-gold-soft">
              {{ (m.installing ? 'Updating to {0}…' : 'Version {0} is out') | tr: m.version }}
            </span>
            <span class="text-[12px] text-muted">
              {{ (m.installing ? 'The overlay restarts by itself in a few seconds' : 'Click to see what is new and install it') | tr }}
            </span>
          </span>
        } @else {
          <span class="flex min-w-0 flex-col gap-0.5">
            <span class="font-display text-[16px] leading-tight text-bright">{{ '{0} is running' | tr: name() }}</span>
            <span class="truncate text-[12px] text-muted">{{ hotkeys() }}</span>
            <span class="text-[11px] text-muted">{{ 'Settings: the tray icon or click here' | tr }}</span>
          </span>
        }
      }
    </button>
  `,
  host: { class: 'block h-full' },
})
export class ToastWindow {
  protected readonly name = signal('');
  protected readonly message = signal<ToastMessage>({ kind: 'start' });
  protected readonly installing = computed(() => {
    const m = this.message();
    return m.kind === 'update' && m.installing;
  });
  protected readonly hotkeys = computed(() => {
    const { 'price-check': priceCheck, 'item-check': itemCheck } = settings().hotkeys;
    return [priceCheck && tr('{0} price check', hotkeyLabel(priceCheck)), itemCheck && tr('{0} item check', hotkeyLabel(itemCheck))]
      .filter(Boolean)
      .join(' · ');
  });

  constructor() {
    void getName().then((name) => this.name.set(name));
    // The host keeps the latest message: this page may load after it was asked for.
    void host.toastMessage().then((m) => this.message.set(m), () => undefined);
    void listen<ToastMessage>(TOAST_MESSAGE_EVENT, ({ payload }) => this.message.set(payload));
  }

  protected openSettings(): void {
    if (this.installing()) return;
    void host.openSettings();
  }
}
