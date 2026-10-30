// PoE2 item texts for tests: the fixtures copied from the game (tests/fixtures/items) and a few
// built the same way.

import { readFileSync } from 'node:fs';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/items/${name}.txt`, import.meta.url), 'utf-8');

/** Rare Prismatic Ring: all-res implicit, evasion, strength, mana regen + light radius, cold res. */
export const RARE_RING = fixture('rare-ring');
/** Rare Ornate Belt: two implicits, life, fire res and strength (strength adds to the life total). */
export const RARE_BELT = fixture('belt-two-implicits');
/** Rare Gemini Crossbow, 20 % quality, corrupted. */
export const RARE_CROSSBOW = fixture('weapon');
/** Rare Obliterator Bow, 20 % quality, three runes. */
export const RARE_BOW = fixture('bow-runes-crafted');
/** The Eternal Spark, Crystal Focus. */
export const UNIQUE_FOCUS = fixture('unique');
/** Rare Gold Amulet: anointment, fractured cold res, desecrated fire and chaos res. */
export const AMULET_FRACTURED = fixture('amulet-fractured-desecrated');
/** Rare Shrine Sceptre: 152 Spirit, a granted skill, rune socket. */
export const RARE_SCEPTRE = fixture('sceptre-spirit');
/** Rare Waystone (Tier 14) and a corrupted Tier 16 one. */
export const WAYSTONE = fixture('waystone');
export const WAYSTONE_CORRUPTED = fixture('waystone-corrupted');
/** Rare jewel. */
export const JEWEL = fixture('jewel');
/** Magic Sapphire Ring, unidentified (Tier 4). */
export const MAGIC_UNID_TIER = fixture('magic-unid-tier');
/** Normal Helmet. */
export const NORMAL_HELMET = fixture('normal-helmet');
/** Uncut Skill Gem (Level 19). */
export const UNCUT_GEM = fixture('uncut-gem');
/** Unidentified unique Felt Cap: Goldrim is the only unique on it. */
export const UNIQUE_UNIDENTIFIED = fixture('unique-unid');
/** Unidentified unique Sapphire Ring: Dream Fragments, Polcirkeln or Whisper of the Brotherhood. */
export const UNIQUE_UNIDENTIFIED_SEVERAL = fixture('unique-unid-several');
/** Unidentified rare Volatile Wand. */
export const RARE_UNIDENTIFIED = fixture('rare-unid');
/** Mirage Archer, level 14, without the Item Class line. */
export const META_GEM = fixture('meta-gem-no-item-class');
/** 7 Exalted Orbs. */
export const CURRENCY_EXALTED = fixture('currency');

export const CURRENCY_CHAOS = `Item Class: Stackable Currency
Rarity: Currency
Chaos Orb
--------
Stack Size: 15/20
--------
Removes a random modifier and augments a Rare item with a new random modifier
--------
Right click this item then left click a Rare item to apply it.
Shift click to unstack.
`;
