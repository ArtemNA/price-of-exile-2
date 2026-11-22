import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { setTestLog, setTestTrade } from './test-fixtures';

/**
 * Test instance only (debug builds, POE_TEST_INSTANCE=1, FINDINGS F-37): a test on a hidden desktop
 * cannot click into the page, so the host's command file (`src-tauri/src/test_trigger.rs`) asks the
 * page itself to click an element or to write an element's text into the log. A crutch for tests;
 * a release never listens.
 */
export async function installTestHooks(): Promise<void> {
  if (!(await invoke<boolean>('is_test_instance'))) return;
  const log = (text: string) => invoke<void>('test_log', { text });
  setTestLog((text) => void log(text));
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
  // Where an element stands in the window (CSS px): "[test] rect <selector>: left top right bottom".
  await current.listen<string>('test-rect', ({ payload }) => {
    const element = document.querySelector<HTMLElement>(payload);
    if (!element) return void log(`[test] rect ${payload}: no such element`);
    const { left, top, right, bottom } = element.getBoundingClientRect();
    void log(`[test] rect ${payload}: ${[left, top, right, bottom].map(Math.round).join(' ')}`);
  });
  // A field's own text ("[test] value <selector>: <text>"), focus on it, and an erase as Backspace
  // makes it (`execCommand('delete')` edits the field and fires `input` as a key would): real keys
  // reach a window on a hidden desktop only through PostMessage, which the test tries first.
  const field = (selector: string) => document.querySelector<HTMLInputElement>(selector);
  await current.listen<string>('test-value', ({ payload }) => {
    const element = field(payload);
    void log(`[test] value ${payload}: ${element ? JSON.stringify(element.value) : 'no such element'}`);
  });
  await current.listen<string>('test-focus', ({ payload }) => {
    const element = field(payload);
    if (!element) return void log(`[test] focus ${payload}: no such element`);
    // A window on a hidden desktop never has the system focus, and then Chromium moves the focus
    // without a `focus` event: send the one a click would give, as `hover` sends the mouse's.
    let heard = false;
    element.addEventListener('focus', () => (heard = true), { once: true });
    element.focus();
    if (!heard) element.dispatchEvent(new FocusEvent('focus'));
    element.setSelectionRange(element.value.length, element.value.length);
    void log(`[test] focus ${payload}: ${heard ? 'focus event from the page' : 'no focus event (window not focused), sent one'}`);
  });
  await current.listen<string>('test-erase', ({ payload }) => {
    const element = field(payload);
    if (!element) return void log(`[test] erase ${payload}: no such element`);
    document.execCommand('delete');
  });
  // A mouse press at a point (CSS px, "x y"): the events go to whatever a real click there would hit
  // (`elementFromPoint` skips `pointer-events: none`), and the log names it:
  // "[test] press x y: <tag>.<classes> [data-test]".
  await current.listen<string>('test-press', ({ payload }) => {
    const [x, y] = payload.split(' ').map(Number);
    const element = document.elementFromPoint(x, y);
    if (!element) return void log(`[test] press ${payload}: nothing there`);
    const classes = typeof element.className === 'string' ? element.className.trim().split(/\s+/).filter(Boolean).slice(0, 4) : [];
    const tag = [element.tagName.toLowerCase(), ...classes].join('.');
    const testId = element.closest('[data-test]')?.getAttribute('data-test');
    void log(`[test] press ${payload}: ${tag}${testId ? ` [${testId}]` : ''}`);
    const init = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 };
    for (const type of ['mousedown', 'mouseup', 'click']) element.dispatchEvent(new MouseEvent(type, init));
  });
  // The pointer over an element: what a real one sends, with Shift held or not (the mouse events
  // carry the modifier state, as Windows' own do).
  const pointer = (types: string[], shiftKey: boolean) => (selector: string) => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return void log(`[test] hover ${selector}: no such element`);
    const rect = element.getBoundingClientRect();
    const init = { bubbles: true, shiftKey, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    for (const type of types) element.dispatchEvent(new MouseEvent(type, { ...init, bubbles: type !== 'mouseenter' && type !== 'mouseleave' }));
  };
  const hover = pointer(['mouseenter', 'mousemove'], false);
  const hoverShift = pointer(['mouseenter', 'mousemove'], true);
  const unhover = pointer(['mouseleave'], false);
  await current.listen<string>('test-hover', ({ payload }) => hover(payload));
  await current.listen<string>('test-hover-shift', ({ payload }) => hoverShift(payload));
  await current.listen<string>('test-unhover', ({ payload }) => unhover(payload));
  // The game's picture under the page, for screenshots of a theme with transparent parts.
  await current.listen<string>('test-backdrop', ({ payload }) => {
    document.documentElement.style.background = payload ? `url("${payload}") 0 0 / 100% 100% no-repeat` : '';
    void log(payload ? '[test] backdrop drawn' : '[test] backdrop removed');
  });
  await current.listen<{ search: string; fetch: string }>('test-trade', ({ payload }) => {
    setTestTrade(payload);
    void log('[test] trade answers from files');
  });
}
