# Exiled Exchange 2 theme (addon)

The look of Exiled Exchange 2 (EE2, the Awakened PoE Trade fork for Path of Exile 2) for Price of
Exile 2: EE2's colours, fonts, rounded corners and pointer cursors in every window, and EE2's price
check layout (one 460 px column as tall as the game, next to the game's inventory or stash panel,
related items and the "Rate limiting" tab beside it) over our own price check logic
(`Ee2PriceCheck extends PriceCheckPanel`).

Built into every build (`src/app/addons.ts`, `angular.json` styles) and offered in Settings → Overlay →
Theme. `npm run build:ee2-default` builds the front end with it as the default theme for a fresh
install. How themes work and how to make one: [THEMING.md](../../THEMING.md).

Files: `theme.ts` (registration), `theme.css` (palette over our tokens, fonts, global styles),
`ee2-price-check.*` (the price check), `ee2-title-bar.ts`, `ee2-unidentified-picker.ts`,
`ee2-price-check-message.ts` (an item that cannot be read), `ee2-icon.ts` (the Font Awesome glyphs
EE2 uses, drawn as SVG), `images/` and `fonts/`.

Not reproduced (yet): the poe.ninja volume block ("N /hr", "Highest volume"), the Tip and
support boxes, the "Reload fallback data" button (our trade data is built in), leagues in the
online filter (the league menu is in the title bar).

The item editor (runes, soul cores, idols, catalysts) is our `app-item-editor` in EE2's popover: its button
next to the stats chip, the popover beside the column (the window widens for it), level with the button; ExtractionValue shows under the listings when the cheapest one costs less than what is
socketed in it minus the Orb of Extraction, as in EE2.

The listed item's card (EE2's listing tooltip, Settings → Price check: off / eye icon / Shift + hover /
hover) is our `app-listing-card`, shared with our theme: beside the hovered row, centred on it, left of
the column when there is room. The window widens for it while it shows, and the card waits for the
wider window. The eye at the start of each listing (the default) is ours, not EE2's: no key needed.

Credits: the look, `images/404.png`, `images/rune.png`, `images/empty-socket.png`, `images/extractor.png` and the font files (Fontin SmallCaps, Exo 2 SemiBold) come from Exiled Exchange 2,
MIT © 2020 Alexander Drozdov and the Exiled Exchange 2 contributors (fork by Kvan7,
https://github.com/Kvan7/Exiled-Exchange-2; `LICENSE-exiled-exchange-2.txt`). Fonts: Fontin
SmallCaps by Jos Buivenga (exljbris, free font licence), Exo 2 by Natanael Gama (SIL OFL).
EE2's Cyrillic font (FrizQuadrata ITC, a commercial font with no licence in EE2's repository) is not
included: Cyrillic falls back to Alegreya SC.
