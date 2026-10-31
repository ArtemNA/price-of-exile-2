import { signal } from '@angular/core';
import { getIdentifier } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { DEV_IDENTIFIER_SUFFIX, RELEASES_URL, UPDATE_CHECK_INTERVAL_MS } from '../constants';
import { host } from '../host';
import { settings } from './settings';

export type UpdateStatus = 'idle' | 'checking' | 'latest' | 'available' | 'installing' | 'error';

const status = signal<UpdateStatus>('idle');
const version = signal<string | null>(null);
const error = signal<string | null>(null);
const portable = signal(false);
let pending: Update | null = null;
/** Versions already announced in the corner during this run: once each. */
const announced = new Set<string>();
const portableKnown = host.isPortable().then(
  (value) => (portable.set(value), value),
  () => false,
);

/**
 * Tells about `found` in the screen corner, unless already told this run (the settings window is
 * hidden in the tray, so its banner alone goes unseen).
 */
function announce(found: string): void {
  if (announced.has(found)) return;
  announced.add(found);
  void host.showToast({ kind: 'update', version: found, installing: false });
}

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

  /**
   * On start of an installed build (dev builds have no releases to compare with): a new version is
   * installed right away when "install automatically" is on — the overlay has only just started,
   * so the restart (the NSIS install closes the app) cannot get in the way of a game — or else
   * announced in the corner. Then the check repeats while the overlay runs, and what it finds then
   * is only announced.
   */
  async checkOnStart(): Promise<void> {
    if ((await getIdentifier()).endsWith(DEV_IDENTIFIER_SUFFIX)) return;
    await this.check();
    const found = version();
    if (found && status() === 'available') {
      if (settings().autoUpdate && !(await portableKnown)) {
        announced.add(found);
        void host.showToast({ kind: 'update', version: found, installing: true });
        await this.install();
      } else {
        announce(found);
      }
    }
    setInterval(() => void this.checkLater(), UPDATE_CHECK_INTERVAL_MS);
  },

  /** The periodic check: never installs by itself in the middle of a session. */
  async checkLater(): Promise<void> {
    if (status() === 'installing' || status() === 'checking') return;
    await this.check();
    const found = version();
    if (found && status() === 'available') announce(found);
  },
};
