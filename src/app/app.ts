import { Component, effect } from '@angular/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { SettingsWindow } from './settings/settings-window';
import { PopupWindow } from './popup-window/popup-window';
import { ToastWindow } from './toast-window/toast-window';
import { interfaceLanguage, loadUiLanguage, tr } from './core/i18n';
import { host } from './host';
import { poeWebApi } from '@/web/Config';
import { settings } from './core/settings';

/** Both Tauri windows load the same app; the window label picks the view. */
@Component({
  selector: 'app-root',
  imports: [SettingsWindow, PopupWindow, ToastWindow],
  template: `
    @if (label === 'popup') {
      <app-popup-window />
    } @else if (label === 'toast') {
      <app-toast-window />
    } @else {
      <app-settings-window />
    }
  `,
})
export class App {
  protected readonly label = getCurrentWindow().label;

  constructor() {
    if (this.label === 'popup' || this.label === 'toast') {
      document.documentElement.classList.add('popup');
    }
    // Every window follows the setting when it changes in the settings window.
    effect(() => {
      const lang = settings().uiLanguage;
      loadUiLanguage(lang).catch((err) => console.error('Loading the interface language failed', err));
    });
    // The tray belongs to the host: the settings window gives it the labels.
    if (this.label !== 'popup' && this.label !== 'toast') {
      effect(() => {
        interfaceLanguage();
        void host.setTrayLabels({ settings: tr('Settings'), browser: tr('Built-in browser'), quit: tr('Quit') });
      });
      effect(() => {
        settings();
        void host.setTradeHost(poeWebApi());
      });
    }
  }
}
