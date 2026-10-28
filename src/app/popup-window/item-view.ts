import type { ParsedItem } from '@/parser';

/** Display-ready view of a parsed item. Stage 1 debug UI; the real design comes later. */
export interface ItemView {
  name: string;
  baseType?: string;
  rarity: string;
  category?: string;
  itemLevel?: number;
  flags: string[];
  mods: ModView[];
  unknown: string[];
}

export interface ModView {
  header: string;
  lines: string[];
}

function statLine(text: string, roll?: { value: number; min: number; max: number }): string {
  // Only single-value stats get the roll inlined; "Adds # to # ..." keeps its placeholders.
  if (!roll || text.split('#').length !== 2) return text;
  const range = roll.min === roll.max ? '' : ` (${roll.min}–${roll.max})`;
  return text.replace('#', String(roll.value)) + range;
}

export function toItemView(item: ParsedItem): ItemView {
  const flags = [
    item.isUnidentified && 'Unidentified',
    item.isCorrupted && 'Corrupted',
    item.isMirrored && 'Mirrored',
    item.isFractured && 'Fractured',
    item.isSynthesised && 'Synthesised',
    item.quality && `Quality ${item.quality}%`,
    item.gemLevel && `Level ${item.gemLevel}`,
    item.stackSize && `Stack ${item.stackSize.value}/${item.stackSize.max}`,
    item.sockets?.linked && `${item.sockets.linked}-link`,
    ...item.influences,
  ].filter((flag): flag is string => Boolean(flag));

  const mods = item.newMods.map((mod) => {
    const { info } = mod;
    const header = [
      info.type,
      info.generation,
      info.name && `"${info.name}"`,
      info.tier && `T${info.tier}`,
      info.rank && `R${info.rank}`,
    ]
      .filter(Boolean)
      .join(' · ');
    return { header, lines: mod.stats.map((s) => statLine(s.translation.string, s.roll)) };
  });

  // ParsedItem keeps the base, not the rare/unique name, so read the name plate:
  // "Item Class", "Rarity", then the name and, for rares and uniques, the base type.
  const namePlate = item.rawText.split(/\r?\n--------\r?\n/)[0].split(/\r?\n/).slice(2);
  const [name, baseType] = namePlate.length >= 2 ? namePlate : [item.info.name];
  return {
    name,
    baseType,
    rarity: item.rarity ?? item.category ?? 'Item',
    category: item.category,
    itemLevel: item.itemLevel,
    flags,
    mods,
    unknown: item.unknownModifiers.map((m) => `${m.type}: ${m.text}`),
  };
}
