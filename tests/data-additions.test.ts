// Records added to public/data by hand from the PoE2 data generator (poe-data-generator/poe2,
// tools/apply_to_app.py) on 2026-11-20, on top of EE2's data (cca3066). See docs/FINDINGS.md.
import { describe, expect, it } from 'vitest';
import { ITEM_BY_REF, STAT_BY_MATCH_STR } from '@/assets/data';
import { loadGameDataInLanguage } from './game-data';

describe.each(['en', 'ru'])('data added from the generator (%s)', (lang) => {
  it('knows the uniques EE2 shipped without a name', async () => {
    await loadGameDataInLanguage(lang);
    for (const name of ["Safrin's Resolve", "Eshtera's Path", "Zaida's Longevity", 'Reverie']) {
      expect(ITEM_BY_REF('UNIQUE', name)?.[0]?.namespace, name).toBe('UNIQUE');
    }
  });

  it('knows Soul Core of Vizoma', async () => {
    await loadGameDataInLanguage(lang);
    expect(ITEM_BY_REF('ITEM', 'Soul Core of Vizoma')?.[0]?.augment?.length).toBeGreaterThan(0);
  });

  it('knows the new rune stats', async () => {
    await loadGameDataInLanguage('en');
    for (const text of ['# to Level of all Hazard Skill Gems', '#% increased Spirit for each Corrupted Item Equipped']) {
      expect(STAT_BY_MATCH_STR(text)?.stat.trade.ids, text).toBeDefined();
    }
    expect(STAT_BY_MATCH_STR('# to Level of all Mark Skills')?.stat.trade.ids.rune).toEqual(['rune.stat_1992191903']);
  });
});
