import { Component, computed } from '@angular/core';
import { getName } from '@tauri-apps/api/app';
import { signal } from '@angular/core';
import { tr, TrPipe } from '../core/i18n';
import { settings } from '../core/settings';
import { host } from '../host';
import { hotkeyLabel } from '../settings/hotkey';

/** The start message: the overlay runs, its main hotkeys, the tray. A click opens the settings. */
@Component({
  selector: 'app-toast-window',
  imports: [TrPipe],
  template: `
    <button class="flex h-full w-full items-center gap-3 border border-frame bg-panel px-3.5 text-left font-sans text-text shadow-[0_0_0_1px_#000]"
      (click)="openSettings()">
      <svg class="flex-none" width="30" height="30" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M6 0l6 6-6 6-6-6z" fill="var(--color-gold)" />
        <path d="M6 3l3 3-3 3-3-3z" fill="var(--color-panel)" />
        <path d="M6 4.3l1.7 1.7L6 7.7 4.3 6z" fill="var(--color-gold-soft)" />
      </svg>
      <span class="flex min-w-0 flex-col gap-0.5">
        <span class="font-display text-[16px] leading-tight text-bright">{{ '{0} is running' | tr: name() }}</span>
        <span class="truncate text-[12px] text-muted">{{ hotkeys() }}</span>
        <span class="text-[11px] text-muted">{{ 'Settings: the tray icon or click here' | tr }}</span>
      </span>
    </button>
  `,
  host: { class: 'block h-full' },
})
export class ToastWindow {
  protected readonly name = signal('');
  protected readonly hotkeys = computed(() => {
    const { 'price-check': priceCheck, 'item-check': itemCheck } = settings().hotkeys;
    return [priceCheck && tr('{0} price check', hotkeyLabel(priceCheck)), itemCheck && tr('{0} item check', hotkeyLabel(itemCheck))]
      .filter(Boolean)
      .join(' · ');
  });

  constructor() {
    void getName().then((name) => this.name.set(name));
  }

  protected openSettings(): void {
    void host.openSettings();
  }
}
