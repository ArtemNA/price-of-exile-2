/**
 * Stands in for EE2 `@/web/background/IPC`. EE2 sends web requests through a proxy in the
 * Electron main process (`/proxy/<host>/<path>`); here they go through tauri-plugin-http.
 */
import { poeFetch } from '../core/http';
import { host } from '../host';

/** The only main-process event ported code sends (`item-check/hotkeyable-actions.ts`). */
interface UserActionEvent {
  name: 'CLIENT->MAIN::user-action';
  payload: { action: 'stash-search'; text: string };
}

export const Host = {
  /** `url` is host + path without the scheme, e.g. `www.pathofexile.com/api/trade2/search/Standard`. */
  proxy: (url: string, init?: RequestInit): Promise<Response> => poeFetch(`https://${url}`, init),
  /**
   * EE2 receives item hotkeys from its main process here. Ours come from the Rust host as Tauri
   * events (popup-window.ts), so nothing is ever delivered.
   */
  onEvent: (_name: 'MAIN->CLIENT::item-text', _cb: (e: { target: string; clipboard: string }) => void): void => {},
  sendEvent: (event: UserActionEvent): void => {
    void host.stashSearch(event.payload.text);
  },
};
