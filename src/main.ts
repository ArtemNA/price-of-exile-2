import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { loadUiLanguage } from './app/core/i18n';
import { initSettings, settings } from './app/core/settings';

// Settings first: the hotkeys, the league and the price check options depend on them.
initSettings()
  .catch((err) => console.error('Loading settings failed, using the defaults', err))
  // The interface language before the first render, so no English flashes first.
  .then(() => loadUiLanguage(settings().uiLanguage).catch((err) => console.error('Loading the interface language failed', err)))
  .then(() => bootstrapApplication(App, appConfig))
  .catch((err) => console.error(err));
