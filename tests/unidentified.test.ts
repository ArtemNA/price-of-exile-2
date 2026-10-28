import { beforeAll, describe, expect, it } from 'vitest';
import { parseClipboard, type ParsedItem } from '@/parser';
import { identifiedVariants, identifyAs, needsIdentification } from '../src/app/price-check/unidentified';
import { loadGameDataFromDisk } from './game-data';
import * as items from './items';

beforeAll(loadGameDataFromDisk);

function parse(text: string): ParsedItem {
  return parseClipboard(text)._unsafeUnwrap();
}

describe('unidentified uniques', () => {
  it('lists the uniques the base can be', () => {
    const robe = parse(items.UNIDENTIFIED_UNIQUE_ROBE);
    expect(needsIdentification(robe)).toBe(true);
    expect(identifiedVariants(robe).map((u) => u.refName)).toEqual([
      'Skin of the Lords',
      'Skin of the Loyal',
      'Tabula Rasa',
      'Thousand Ribbons',
    ]);
  });

  it('has a single choice for a base with one unique', () => {
    const vestment = parse(items.UNIDENTIFIED_UNIQUE_ROBE.replace('Simple Robe', "Occultist's Vestment"));
    expect(identifiedVariants(vestment).map((u) => u.refName)).toEqual(["Shavronne's Wrappings"]);
  });

  it('identifies as the picked unique, keeping the base', () => {
    const robe = parse(items.UNIDENTIFIED_UNIQUE_ROBE);
    const tabula = identifyAs(robe, identifiedVariants(robe).find((u) => u.refName === 'Tabula Rasa')!);
    expect(tabula.info.refName).toBe('Tabula Rasa');
    expect(tabula.uniqueBase?.refName).toBe('Simple Robe');
    expect(tabula.isUnidentified).toBe(true);
    expect(needsIdentification(tabula)).toBe(false);
    expect(needsIdentification(parse(items.UNIQUE_TABULA))).toBe(false);
    expect(needsIdentification(parse(items.UNIDENTIFIED_CORRUPTED))).toBe(false);
  });
});
