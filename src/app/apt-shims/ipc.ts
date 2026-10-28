/**
 * Stands in for APT `@/web/background/IPC`. APT sends web requests through a proxy in the
 * Electron main process (`/proxy/<host>/<path>`); here they go through tauri-plugin-http.
 */
import { poeFetch } from '../core/http';

export const Host = {
  /** `url` is host + path without the scheme, e.g. `www.pathofexile.com/api/trade/search/Standard`. */
  proxy: (url: string, init?: RequestInit): Promise<Response> => poeFetch(`https://${url}`, init),
};
