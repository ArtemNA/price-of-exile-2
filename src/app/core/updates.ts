import { signal } from '@angular/core';
import { getIdentifier } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { DEV_IDENTIFIER_SUFFIX, RELEASES_URL } from '../constants';
import { host } from '../host';

export type UpdateStatus = 'idle' | 'checking' | 'latest' | 'available' | 'installing' | 'error';

const status = signal<UpdateStatus>('idle');
const version = signal<string | null>(null);
const error = signal<string | null>(null);
const portable = signal(false);
let pending: Update | null = null;
void host.isPortable().then(portable.set, () => undefined);

/** App updates from GitHub Releases (tauri-plugin-updater; APT uses electron-updater the same way). */
export const updates = {
  status: status.asReadonly(),
  /** Version of the update found. */
  version: version.asReadonly(),
  error: error.asReadonly(),
  /** The portable exe does not update itself: "install" opens the release page. */
  portable: portable.asReadonly(),

  async check(): Promise<void> {
    status.set('checking');
    error.set(null);
    try {
      pending = await check();
      version.set(pending?.version ?? null);
      status.set(pending ? 'available' : 'latest');
    } catch (e) {
      error.set(String(e));
      status.set('error');
    }
  },

  /** Downloads and installs the update found, then restarts the app; the portable build opens the release page. */
  async install(): Promise<void> {
    if (portable()) {
      await openUrl(RELEASES_URL);
      return;
    }
    if (!pending) return;
    status.set('installing');
    try {
      await pending.downloadAndInstall();
      await relaunch();
    } catch (e) {
      error.set(String(e));
      status.set('error');
    }
  },

  /** On start of an installed build; dev builds have no releases to compare with. */
  async checkOnStart(): Promise<void> {
    if ((await getIdentifier()).endsWith(DEV_IDENTIFIER_SUFFIX)) return;
    await this.check();
  },
};
