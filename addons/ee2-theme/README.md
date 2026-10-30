# Exiled Exchange 2 theme (addon)

The look of Exiled Exchange 2 (EE2, the Awakened PoE Trade fork for Path of Exile 2) for Price of
Exile 2: EE2's colours, fonts, rounded corners and pointer cursors in every window, and EE2's price
check layout (one 460 px column as tall as the game, next to the game's inventory or stash panel,
related items and the "Rate limiting" tab beside it) over our own price check logic
(`Ee2PriceCheck extends PriceCheckPanel`).

Built into every build (`src/app/addons.ts`, `angular.json` styles) and offered in Settings → Overlay →
Theme. `npm run build:ee2-default` builds the front end with it as the default theme for a fresh
install. How themes work and how to make one: [THEMING.md](../../THEMING.md). EE2 screenshots and
style notes this theme was matched against: `docs/screenshots/ee2/`.

Files: `theme.ts` (registration), `theme.css` (palette over our tokens, fonts, global styles),
`ee2-price-check.*` (the price check), `ee2-title-bar.ts`, `ee2-unidentified-picker.ts`,
`ee2-price-check-message.ts` (an item that cannot be read), `ee2-icon.ts` (the Font Awesome glyphs
EE2 uses, drawn as SVG), `images/` and `fonts/`.

Not reproduced (yet): the poe.ninja volume block ("N /hr", "Highest volume"), the listing tooltip on
Shift + hover, ExtractionValue, the item editor (runes / soul cores / catalysts), the Tip and
support boxes, the "Reload fallback data" button (our trade data is built in), leagues in the
online filter (the league menu is in the title bar).

Credits: the look, `images/404.png` and the font files (Fontin SmallCaps, Exo 2 SemiBold) come from Exiled Exchange 2,
MIT © 2020 Alexander Drozdov and the Exiled Exchange 2 contributors (fork by Kvan7,
https://github.com/Kvan7/Exiled-Exchange-2; `LICENSE-exiled-exchange-2.txt`). Fonts: Fontin
SmallCaps by Jos Buivenga (exljbris, free font licence), Exo 2 by Natanael Gama (SIL OFL).
EE2's Cyrillic font (FrizQuadrata ITC, a commercial font with no licence in EE2's repository) is not
included: Cyrillic falls back to Alegreya SC.
