import { Component, computed, effect, signal } from '@angular/core';
import type { StatMatcher } from '@/web/map-check/common';
import { MAP_CHECK_PROFILES } from '../constants';
import { TrPipe } from '../core/i18n';
import { settings, updateSettings } from '../core/settings';
import { loadGameData } from '../game-data';
import { allAreaMods, decisionHasColor, decisionOf, filterAreaMods, StatTag, withDecision } from './map-check';

/** Marks the user can set per mod in the editor; the order of APT's columns. `label` is English, the template translates it. */
const COLUMNS = [
  { decision: 'w', label: 'Warning', class: 'accent-[#d9a441]' },
  { decision: 'd', label: 'Deadly', class: 'accent-[#d0503c]' },
  { decision: 'g', label: 'Good', class: 'accent-[#6fbf73]' },
] as const;

/** Settings page of the map check (APT `settings-maps.vue` + `SettingsMatcherEntry.vue`). */
@Component({
  selector: 'app-map-mods-editor',
  imports: [TrPipe],
  templateUrl: './map-mods-editor.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-2' },
})
export class MapModsEditor {
  protected readonly columns = COLUMNS;
  protected readonly profiles = MAP_CHECK_PROFILES;
  protected readonly tags = StatTag;
  protected readonly config = computed(() => settings().mapCheck);
  protected readonly search = signal('');
  protected readonly onlySelected = signal(false);
  private readonly all = signal<StatMatcher[]>([]);
  /** Apart from the rest of the settings, so a new mark does not list the mods again. */
  private readonly language = computed(() => settings().language);
  protected readonly error = signal<string | null>(null);
  protected readonly list = computed(() => filterAreaMods(this.all(), this.config(), this.search(), this.onlySelected()));

  constructor() {
    // Marks are kept by the mod text of the game language: list the mods in that language, again
    // when it changes in the settings.
    effect(() => {
      const lang = this.language();
      this.all.set([]);
      loadGameData(lang).then(
        () => this.language() === lang && this.all.set(allAreaMods()),
        (e) => this.error.set(String(e)),
      );
    });
  }

  protected decision(matcher: string): string {
    return decisionOf(this.config(), matcher);
  }

  protected marked(matcher: string): boolean {
    return decisionHasColor(this.config().selectedStats.find((s) => s.matcher === matcher)?.decision ?? '---', this.config().profile);
  }

  protected set(matcher: string, decision: string): void {
    updateSettings({ mapCheck: withDecision(this.config(), matcher, decision) });
  }

  protected selectProfile(profile: number): void {
    updateSettings({ mapCheck: { ...this.config(), profile } });
  }

  protected setShowNewStats(showNewStats: boolean): void {
    updateSettings({ mapCheck: { ...this.config(), showNewStats } });
  }
}
