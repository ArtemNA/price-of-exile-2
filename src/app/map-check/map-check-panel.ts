import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import type { ParsedItem } from '@/parser';
import { MAP_CHECK_PROFILES, RARITY_COLORS } from '../constants';
import { tr, TranslatePipe, TrPipe } from '../core/i18n';
import { settings, updateSettings } from '../core/settings';
import type { ItemView } from '../popup-window/item-view';
import { cycleDecision, type Decision, mapCheckView, modTextParts, toggleSeen } from './map-check';

/** Map check (APT `MapCheck.vue` + `MapStatButton.vue`): the map's mods coloured by the user's marks. */
@Component({
  selector: 'app-map-check',
  imports: [NgTemplateOutlet, TranslatePipe, TrPipe],
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
  /** Quantity, rarity and pack size of the map, when it has them. */
  protected readonly areaProps = computed(() => {
    const item = this.item();
    return [
      item.areaItemQuantity && { label: tr('Quantity'), value: item.areaItemQuantity },
      item.areaItemRarity && { label: tr('Rarity'), value: item.areaItemRarity },
      item.areaPackSize && { label: tr('Pack size'), value: item.areaPackSize },
    ].filter((prop): prop is { label: string; value: number } => Boolean(prop));
  });

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
