# Changelog

## Unreleased

- Number fields keep their number when you click into them, and Backspace erases it digit by digit; clear a stat's minimum or maximum to search without that bound.
- A price check opened right after a map check no longer comes up squeezed, and the map check no longer flashes a scrollbar as it opens.
- Thin scrollbars in the theme's colour.

## v0.0.6

- A new look, Graphite, is the default: Exiled Exchange 2's price check layout on a neutral dark gray with an ice-blue accent, so red, orange and green (map check rows, price drops, warnings) stand out. After this update every install starts once on it; the theme you pick afterwards stays, and all other settings are kept. Exiled Exchange 2's look and the earlier two-column look stay in Settings → Overlay → Theme.
- A new app icon: a gold eye with a crimson "2", also in the settings, the price check and the start message.
- Settings → Stash search and Map check: import your stash searches and map marks from Exiled Exchange 2.
- The listed item over its price, as in Exiled Exchange 2: point at the eye next to a listing and its item shows as the game draws it, with mod tiers (P1, S3), centred on the listing. No key needed, so the game keeps its Shift. Settings → Price check: off, eye icon (default), Shift + hover or hover.

## v0.0.5

- Item data from the current game build, ahead of Exiled Exchange 2: Soul Core of Vizoma, seven new stats (rune skill gem levels, Spirit per corrupted item, Expedition chance), rune and fractured trade filters for two more stats, updated Russian wording.
- Five uniques that had no name now price check: Safrin's Resolve, Eshtera's Path, Zaida's Longevity and two Reverie variants (an unidentified Ring now offers all four of its uniques).

## v0.0.4

- Item editor, as in Exiled Exchange 2: put other runes, soul cores or idols into a weapon's or armour's sockets, or a catalyst's quality on a ring, amulet or jewel, and price the item as it would be (Sockets / Quality under the stats; Reset brings the copied item back).
- Extraction value: what is socketed in the item minus the Orb of Extraction, marked when the cheapest listing costs less.

## v0.0.3

- The price check hotkey no longer stays dead until the next alt-tab: the overlay checks the window in front four times a second and registers again a hotkey another app held (e.g. Exiled Exchange 2 with the same key).
- Shift+Space opens the settings from the game (Settings → Hotkeys → Open settings).

## v0.0.2

- Self-update: the installed overlay checks for a new version when it starts and installs it right away (Settings → About → "Install new versions automatically", on by default), so the restart never comes in the middle of a game. A version found later while you play is only announced in the corner of the screen. The portable exe only announces new versions.
- v0.0.1 had no updater: install this version by hand over it once; later versions come by themselves.

## v0.0.1

The first release: a Path of Exile 2 price check overlay built on Exiled Exchange 2's parser and trade logic.

- Price check (Ctrl+D): stat filters grouped by kind with tiers, pseudo totals and the mods behind them, PoE2 item parts (runes, sockets, Spirit, desecrated and unrevealed mods, fractured), search on the trade site with listing types and buyout currency, listings priced in exalted and chaos.
- poe.ninja: divine / exalted / chaos rates in the title, prices with a 7-day trend, related items.
- Bulk exchange for currency, runes and other stackables, paid in exalted, divine or chaos; baits left out.
- Item check and waystone check (Alt+D): wiki, PoE2DB, Craft of Exile, DPS, Find in Stash; waystone numbers and marked mods.
- Unidentified uniques: picked by base, or a choice when the base has several.
- Chat commands, stash search presets, the built-in browser for the trade site.
- Interface in English, Ukrainian and Russian; the English and Russian game.
- Two themes: Price of Exile 2 and Exiled Exchange 2 (Settings → Overlay → Theme).
- No self-update yet: install a new version over the old one.
