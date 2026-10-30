Add a step to the PoE2 app's plan (`PLAN.md`): **themes**, done the way Price of Exile (PoE1) did them in
v0.1.13. There the app has two themes, its own and one that reproduces Awakened PoE Trade's look; here it
is ours and one that reproduces **Exiled Exchange 2**'s look (EE2, the APT fork for PoE2). Plan it first
and show the owner the plan step; build it after approval. Talk to the owner in Ukrainian.

## What it is (keep the behaviour)
- Settings → Overlay → Theme: ours, and "Exiled Exchange 2". Both ship in every build; ours is the
  default (a build configuration can make the other one the default).
- The EE2 theme: EE2's colours, fonts, rounded corners and pointer cursors in every window; the windows
  keep our layouts (settings, item check, map/waystone check, stash search, start message), except the
  **price check, which must be identical to EE2's in style and layout**: one column as tall as the game
  (top to bottom of the game window, no margins), next to the game's inventory or stash panel (or centred
  with "Centre of the game", the column itself in the centre), related items beside the column on the
  side facing the screen centre over a transparent, wider window, prices as text in listings, etc.
- Over our own price check logic: the theme only brings a template.

## Use what the PoE1 project already has
Everything is in `C:\Users\Artem\Documents\AI\poe-trade-overlay` (GitHub ArtemNA/price-of-exile). Read
it, take it over, and adapt it rather than inventing again:
- `THEMING.md`: how themes work and how to make one. Write the same file for this app.
- `docs/APT_THEME_PLAN.md`: the comparison and plan (what maps easily onto our code and what needs its
  own layout). Make the same comparison for EE2 vs our PoE2 design.
- `docs/screenshots/apt/` + `STYLE_NOTES.md`: how APT was screenshotted for every scenario and its exact
  palette, fonts and sizes. `addons/apt-theme/`: the theme itself (`theme.css` palette over the tokens,
  `theme.ts`, `apt-price-check.*` = `AptPriceCheck extends PriceCheckPanel`, `apt-title-bar.ts`,
  `apt-unidentified-picker.ts`, `apt-icon.ts`, `images/`, `fonts/`, README with credits).
- The commits, in order (`git -C C:\Users\Artem\Documents\AI\poe-trade-overlay show <sha>`):
  `8f0a8e1` colour tokens instead of hard-coded colours (same look), `b6dca92` theme registry
  (`src/app/themes.ts`, `src/app/addons.ts`), `theme` setting, `html[data-theme]`, the theme's own price
  check view via `NgComponentOutlet`, `f9379bd` addon skeleton and build configurations, `39bef98` APT's
  price check layout, `9bc1804` related items beside the column (`fit_popup` returns the popup side,
  `themeWindowWidth()`, transparent window, a click on the transparent part closes), `5312602` APT
  screenshots and style notes, `3b4562b` both themes in every build, the theme follows the popup
  position setting, full game height (`popup.rs`: a price check asked taller than the game takes the
  whole game height), `cursor: pointer`, THEMING.md.
- Findings: `docs/FINDINGS.md` F-65 (the theme addon) in the PoE1 repo.

EE2's UI is a fork of APT's, so most of the APT theme carries over. **What it does not cover, take from
EE2**: its source is in `C:\Users\Artem\Documents\AI\price-of-exile-2\_upstream\ee2\renderer\src\`
(compare with `_upstream\apt\` to see exactly what EE2 changed in the price check: PoE2 item parts such as
runes and sockets, waystones, its own filters, colours or texts). EE2 is installed at
`C:\Program Files\Exiled Exchange 2\` for screenshots.

## Screenshots and checks
- Screenshot EE2 for every scenario of our app, as the PoE1 project did for APT (its process: a copy of the
  fake game titled as the game window EE2 attaches to, EE2's config backed up first and restored at the
  end, only a few live trade searches; no computer-use). Save them to `docs/screenshots/ee2/` with a
  README mapping each to ours, plus STYLE_NOTES.md (palette, fonts, sizes). Screenshots that show the
  owner's account or system stay out of git.
- Then compare our EE2 theme with them state by state until they match by eye; save ours next to them.
- Unit tests, both builds, our own theme unchanged (check with screenshots), the normal fake-game tests.
- Ask the owner before committing or releasing.
