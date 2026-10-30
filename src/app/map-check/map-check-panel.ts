import { Component, computed, input } from '@angular/core';
import type { ParsedItem } from '@/parser';
import { MAP_CHECK_PROFILES, MAP_MOD_TYPE_LABELS, RARITY_COLORS } from '../constants';
import { TranslatePipe, TrPipe } from '../core/i18n';
import { settings, updateSettings } from '../core/settings';
import type { ItemView } from '../popup-window/item-view';
import { cycleDecision, type Decision, type MapNumber, mapCheckView, modTextParts, toggleSeen } from './map-check';

/** Map check (EE2 `MapCheck.vue` + `MapStatButton.vue`): the waystone's numbers and its mods coloured by the user's marks. */
@Component({
  selector: 'app-map-check',
  imports: [TranslatePipe, TrPipe],
  templateUrl: './map-check-panel.html',
  host: { class: 'flex flex-col' },
})
export class MapCheckPanel {
  readonly item = input.required<ParsedItem>();
  readonly view = input.required<ItemView>();

  protected readonly config = computed(() => settings().mapCheck);
  protected readonly map = computed(() => mapCheckView(this.item(), this.config()));
  protected readonly plate = computed(() => RARITY_COLORS[this.view().rarity] ?? RARITY_COLORS['Normal']);
  protected readonly profiles = MAP_CHECK_PROFILES;
  protected readonly typeLabels = MAP_MOD_TYPE_LABELS;
  /** The name plate shows the rare / magic name; the base ("Waystone (Tier 16)") goes under it. */
  protected readonly baseName = computed(() => (this.view().name !== this.map().name ? this.map().name : null));

  protected numberText({ value, percent }: MapNumber): string {
    return percent ? `${value > 0 ? '+' : ''}${value}%` : String(value);
  }

  protected selectProfile(profile: number): void {
    updateSettings({ mapCheck: { ...this.config(), profile } });
  }

  protected cycle(matcher: string): void {
    updateSettings({ mapCheck: cycleDecision(this.config(), matcher) });
  }

  protected toggleSeen(matcher: string): void {
    updateSettings({ mapCheck: toggleSeen(this.config(), matcher) });
  }

  protected parts(text: string, roll?: number) {
    return modTextParts(text, roll);
  }

  protected rowClass(decision: Decision): string {
    switch (decision) {
      case 'd':
        return 'border-l-[#d0503c] bg-[#3f1813] hover:bg-[#4a1d17]';
      case 'w':
        return 'border-l-warn bg-[#38290f] hover:bg-[#433112]';
      case 'g':
        return 'border-l-good bg-[#16301a] hover:bg-[#1b3a20]';
    }
    return 'border-l-transparent hover:bg-raised';
  }
}
