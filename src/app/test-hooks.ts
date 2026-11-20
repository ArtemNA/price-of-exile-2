import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Test instance only (debug builds, POE_TEST_INSTANCE=1, FINDINGS F-37): a test on a hidden desktop
 * cannot click into the page, so the host's command file (`src-tauri/src/test_trigger.rs`) asks the
 * page itself to click an element or to write an element's text into the log. A crutch for tests;
 * a release never listens.
 */
export async function installTestHooks(): Promise<void> {
  if (!(await invoke<boolean>('is_test_instance'))) return;
  const log = (text: string) => invoke<void>('test_log', { text });
  // This window's events only: a plain `listen` hears the events sent to every window.
  const current = getCurrentWindow();
  await current.listen<string>('test-click', ({ payload }) => {
    const element = document.querySelector<HTMLElement>(payload);
    if (element) element.click();
    else void log(`[test] click ${payload}: no such element`);
  });
  await current.listen<string>('test-text', ({ payload }) => {
    const elements = [...document.querySelectorAll<HTMLElement>(payload)];
    const texts = elements.map((element) => element.innerText.replace(/\s+/g, ' ').trim());
    void log(`[test] text ${payload}: ${elements.length ? texts.join(' | ') : 'no such element'}`);
  });
}
