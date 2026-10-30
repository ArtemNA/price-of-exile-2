import { Component, input } from '@angular/core';

export type Ee2IconName =
  | 'exchange'
  | 'window-close'
  | 'square'
  | 'check-square'
  | 'eye-slash'
  | 'warning'
  | 'chevron-up'
  | 'chevron-down'
  | 'toggle-on'
  | 'toggle-off'
  | 'arrow-right'
  | 'external-link'
  | 'history'
  | 'angle-double-up'
  | 'angle-double-down'
  | 'question';

/**
 * The Font Awesome glyphs EE2 uses (as APT) (fas / far), drawn as small SVGs: 1 em tall, current colour,
 * on the text baseline like an `<i class="fas …">`.
 */
@Component({
  selector: 'ee2-icon',
  template: `
    <svg [attr.viewBox]="'0 0 ' + width() + ' 16'" [attr.width]="width() / 16 + 'em'" height="1em" aria-hidden="true" class="inline-block align-[-0.125em]">
      @switch (name()) {
        @case ('exchange') {
          <path fill="currentColor" d="M1 4.2h10.4V2l3.6 3.2-3.6 3.2V6.2H1zM15 11.8H4.6V14L1 10.8l3.6-3.2v2.2H15z" />
        }
        @case ('window-close') {
          <path fill="currentColor" fill-rule="evenodd"
            d="M2.5 1.5h11a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13V3a1.5 1.5 0 0 1 1.5-1.5zM5.4 4.3 4.3 5.4 6.9 8l-2.6 2.6 1.1 1.1L8 9.1l2.6 2.6 1.1-1.1L9.1 8l2.6-2.6-1.1-1.1L8 6.9z" />
        }
        @case ('square') {
          <rect x="1" y="1.8" width="12.4" height="12.4" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.7" />
        }
        @case ('check-square') {
          <path fill="currentColor" fill-rule="evenodd"
            d="M2.3 1h9.8A2 2 0 0 1 14 3v10a2 2 0 0 1-2 2H2.3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2zm9.3 4.2L10.3 3.9 5.7 8.5 4 6.8 2.7 8.1l3 3z" />
        }
        @case ('eye-slash') {
          <path fill="currentColor"
            d="M1.2 1.4.2 2.6l15 11.9 1-1.2-2.6-2a8.6 8.6 0 0 0 2.2-2.9C14.5 5.3 11.6 3.3 8.3 3.3c-1.2 0-2.3.3-3.4.7zm5 4a3 3 0 0 1 5 2.6zM8.3 12.7c-3.3 0-6.2-2-7.6-4.9a8.7 8.7 0 0 1 1.9-2.5l2.6 2a3 3 0 0 0 4.4 3.4l1.3 1.1a8 8 0 0 1-2.6.9z" />
        }
        @case ('warning') {
          <path fill="currentColor" fill-rule="evenodd"
            d="M8 .9c.5 0 1 .3 1.2.7l6.5 11.3c.5.9-.1 2-1.2 2H1.5c-1 0-1.7-1.1-1.2-2L6.8 1.6C7 1.2 7.5.9 8 .9zM7 5v4.5h2V5zm0 5.8v1.9h2v-1.9z" />
        }
        @case ('chevron-up') {
          <path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M2.5 11 8 5.5l5.5 5.5" />
        }
        @case ('chevron-down') {
          <path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M2.5 5.5 8 11l5.5-5.5" />
        }
        @case ('toggle-on') {
          <path fill="currentColor" fill-rule="evenodd" d="M6 3h8a5 5 0 0 1 0 10H6A5 5 0 0 1 6 3zm8 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z" />
        }
        @case ('toggle-off') {
          <path fill="currentColor" fill-rule="evenodd" d="M6 3h8a5 5 0 0 1 0 10H6A5 5 0 0 1 6 3zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z" />
        }
        @case ('arrow-right') {
          <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M2 8h11M8.5 3.5 13 8l-4.5 4.5" />
        }
        @case ('external-link') {
          <path fill="currentColor" fill-rule="evenodd"
            d="M9.5 1H15v5.5l-2-2-4.6 4.6-1.5-1.5L11.5 3zM2.5 3H7v2H3v8h8V9h2v4.5c0 .8-.7 1.5-1.5 1.5h-9C1.7 15 1 14.3 1 13.5v-9C1 3.7 1.7 3 2.5 3z" />
        }
        @case ('history') {
          <path fill="currentColor"
            d="M8.5 1A7 7 0 0 0 2.6 4.2L1 2.6V7h4.4L3.8 5.4a5.2 5.2 0 1 1-.4 4.6l-1.7.6A7 7 0 1 0 8.5 1zM7.6 4.3v4.4l3.3 2 .8-1.3-2.6-1.6V4.3z" />
        }
        @case ('angle-double-up') {
          <path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M2 8.5 6 4.5l4 4M2 13.5l4-4 4 4" />
        }
        @case ('angle-double-down') {
          <path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M2 2.5l4 4 4-4M2 7.5l4 4 4-4" />
        }
        @case ('question') {
          <path fill="currentColor" d="M5 3.1C5.7 2.3 6.7 2 7.9 2 10 2 11.5 3.2 11.5 5c0 1.3-.8 2-1.7 2.6-.7.4-.9.7-.9 1.3v.4H6.6v-.6c0-1.1.5-1.7 1.4-2.3.6-.4.9-.7.9-1.2 0-.6-.4-.9-1.1-.9-.6 0-1.1.3-1.5.8zM6.5 11h2.6v2.6H6.5z" />
        }
      }
    </svg>
  `,
  host: { class: 'inline-flex' },
})
export class Ee2Icon {
  readonly name = input.required<Ee2IconName>();

  /** Narrow glyphs (Font Awesome draws them narrower than 1 em). */
  protected width(): number {
    const name = this.name();
    if (name === 'angle-double-up' || name === 'angle-double-down') return 12;
    if (name === 'square' || name === 'check-square') return 14;
    if (name === 'toggle-on' || name === 'toggle-off') return 20;
    if (name === 'question') return 16;
    return 16;
  }
}
