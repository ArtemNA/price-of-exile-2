import { Component, signal } from '@angular/core';
import { TrPipe } from '../core/i18n';
import { settings, updateSettings } from '../core/settings';
import { host } from '../host';
import { hotkeyLabel } from '../settings/hotkey';

/** Stash search presets (APT `WidgetStashSearch.vue`): a click types the text into the stash search. */
@Component({
  selector: 'app-stash-panel',
  imports: [TrPipe],
  templateUrl: './stash-panel.html',
  host: { class: 'flex flex-col gap-2.5 p-2.5' },
})
export class StashPanel {
  protected readonly settings = settings;
  protected readonly error = signal<string | null>(null);

  protected async search(text: string): Promise<void> {
    this.error.set(null);
    try {
      await host.stashSearch(text);
    } catch (e) {
      this.error.set(String(e));
    }
  }

  protected toggleHotkeys(groupId: number, enableHotkeys: boolean): void {
    updateSettings({
      stashSearch: settings().stashSearch.map((group) => (group.id === groupId ? { ...group, enableHotkeys } : group)),
    });
  }

  protected hasHotkeys(group: { entries: Array<{ hotkey: string | null }> }): boolean {
    return group.entries.some((entry) => entry.hotkey);
  }

  protected label(hotkey: string): string {
    return hotkeyLabel(hotkey);
  }
}
