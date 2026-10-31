import { beforeEach, describe, expect, it, vi } from 'vitest';

// The updater's decisions: install at start when allowed, otherwise only a message in the corner,
// once per version; the periodic check never installs; the portable build only announces.

const toasts: unknown[] = [];
const installed = vi.fn(async () => undefined);
const relaunched = vi.fn(async () => undefined);
let portable = false;
let latest: string | null = '0.2.0';

vi.mock('@tauri-apps/api/app', () => ({ getIdentifier: async () => 'com.artemna.price-of-exile-2' }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn(async () => undefined) }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: relaunched }));
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: async () => (latest ? { version: latest, downloadAndInstall: installed } : null),
}));
vi.mock('../src/app/host', () => ({
  host: {
    isPortable: async () => portable,
    showToast: async (message: unknown) => void toasts.push(message),
  },
}));

async function fresh() {
  vi.resetModules();
  const { updates } = await import('../src/app/core/updates');
  const { updateSettings } = await import('../src/app/core/settings');
  return { updates, updateSettings };
}

beforeEach(() => {
  toasts.length = 0;
  installed.mockClear();
  relaunched.mockClear();
  portable = false;
  latest = '0.2.0';
  vi.useFakeTimers();
});

describe('updates', () => {
  it('installs a new version at start when "install automatically" is on', async () => {
    const { updates } = await fresh();
    await updates.checkOnStart();
    expect(toasts).toEqual([{ kind: 'update', version: '0.2.0', installing: true }]);
    expect(installed).toHaveBeenCalledOnce();
    expect(relaunched).toHaveBeenCalledOnce();
  });

  it('only tells about it when automatic install is off, once per version', async () => {
    const { updates, updateSettings } = await fresh();
    updateSettings({ autoUpdate: false });
    await updates.checkOnStart();
    await updates.checkLater();
    expect(toasts).toEqual([{ kind: 'update', version: '0.2.0', installing: false }]);
    expect(installed).not.toHaveBeenCalled();
    latest = '0.2.1';
    await updates.checkLater();
    expect(toasts).toEqual([
      { kind: 'update', version: '0.2.0', installing: false },
      { kind: 'update', version: '0.2.1', installing: false },
    ]);
  });

  it('never installs by itself later in the session', async () => {
    const { updates } = await fresh();
    latest = null;
    await updates.checkOnStart();
    latest = '0.2.0';
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
    expect(toasts).toEqual([{ kind: 'update', version: '0.2.0', installing: false }]);
    expect(installed).not.toHaveBeenCalled();
  });

  it('only tells the portable build, which cannot update itself', async () => {
    portable = true;
    const { updates } = await fresh();
    await updates.checkOnStart();
    expect(toasts).toEqual([{ kind: 'update', version: '0.2.0', installing: false }]);
    expect(installed).not.toHaveBeenCalled();
  });
});
