# Theming Price of Exile 2

Price of Exile 2 ships with two themes: its own and **Exiled Exchange 2** (`addons/ee2-theme`), picked
in Settings → Overlay → Theme. Both are in every build; ours is the default. This page is for anyone
who wants to make another one.

## How a theme works

- **Colours and fonts are CSS variables.** `src/styles.css` declares the design tokens in Tailwind 4's
  `@theme` block (`--color-panel`, `--color-text`, `--color-gold`, `--color-mod`, … and `--font-sans`,
  `--font-display`), plus the rarity colours and item name plates (`--color-rarity-*`,
  `--plate-*-bg/rule`). Every template uses only these (`bg-panel`, `text-muted`, `border-line`); there
  are no hard-coded colours in the templates of `src/app`. A theme gives the variables its own values.
- **The theme is an attribute on `<html>`.** Every window (settings, popup, start message) sets
  `data-theme="<theme id>"` from the `theme` setting, so a theme's CSS is scoped with
  `html[data-theme='<id>'] { --color-panel: …; }` and can add any rule it needs under the same selector
  (rounded corners, `cursor: pointer`, …). A change in the settings reaches every window at once.
- **A theme can bring its own price check.** The price check logic is `PriceCheckPanel`
  (`src/app/price-check/price-check-panel.ts`): parsing, filters, presets, trade search, bulk,
  poe.ninja, related items. A theme may subclass it with its own template (and styles); every signal
  and protected method of the base class is there for the template. The EE2 theme does this
  (`Ee2PriceCheck`). The popup creates the view with `NgComponentOutlet` and passes `item`, `view` and
  `warning` (the "copied without mod details" note, which our view leaves to the popup and a theme's
  view shows inside its own layout).
- **Other views a theme may bring:** `unidentifiedPicker` ("which unique is it?"; inputs `baseName`,
  `variants` and the callback `pick`, since `NgComponentOutlet` binds no outputs) and
  `priceCheckMessage` (a price check without an item: it cannot be read, it was copied in another game
  language; inputs `message` and `tone`). Without them the popup uses ours.
- **Window size and placement.** A theme may set the price check window width and make it as tall as
  the game (`priceCheckSize: { width, fullHeight }`): the host then gives it the whole height of the
  game's client area. The popup position setting ("Centre of the game" / "Opposite the cursor") still
  applies; the side the popup ended up on is in `popupSide()` (`'left'`, `'right'`, `'center'`), and
  `themeWindowWidth()` can ask for a wider window. The EE2 theme puts related items and the "Rate
  limiting" tab beside its column, over the transparent rest of the window (the popup window is
  transparent; the theme makes its section transparent too).
- **Clicks on the transparent part.** They land on our window, not on the game, so the host does not
  see them as a click outside. Bind `backdropDown($event)` to the host's `mousedown` to close the popup
  then, as a click into the game would; let the empty side areas pass clicks through
  (`pointer-events: none`, with `pointer-events: auto` on what is shown there).

## Making a theme

1. **Folder.** `addons/<name>/`, for example by copying `addons/ee2-theme/`.
2. **`theme.css`** with the tokens under your selector. Start from the token list in `src/styles.css`;
   anything you do not set keeps our value.

   ```css
   html[data-theme='my-theme'] {
     --font-sans: 'My Font', sans-serif;
     --color-panel: #202428;
     --color-text: #e6e6e6;
     --color-gold: #4aa3df; /* primary action, focus, active borders */
   }
   ```

   Fonts: put the files in your folder and declare them with `@font-face` (relative `url()`s are
   bundled). Ship only fonts whose licence allows it. Global rules of the theme go under
   `html[data-theme='<id>']`; the styles of its own components may be scoped by a class on their host.
3. **`theme.ts`** registers it:

   ```ts
   import type { Theme } from '../../src/app/themes';

   export const MY_THEME: Theme = {
     id: 'my-theme', // the data-theme value
     label: 'My theme', // shown in Settings → Overlay → Theme (not translated)
     // priceCheck: MyPriceCheck,                          // optional own price check view
     // priceCheckSize: { width: 460, fullHeight: true },  // optional window size
     // unidentifiedPicker: MyPicker, priceCheckMessage: MyMessage,
   };
   ```
4. **Add it to the app:** append the theme to `ADDON_THEMES` in `src/app/addons.ts` and the CSS file to
   `styles` in `angular.json` (after `src/styles.css`). `addons/**/*.ts` is already in
   `tsconfig.app.json`.
5. **Own price check (optional):** `class MyPriceCheck extends PriceCheckPanel` with
   `@Component({ selector: 'app-my-price-check', templateUrl: './my-price-check.html', imports: [...] })`.
   Start from `src/app/price-check/price-check-panel.html` or `addons/ee2-theme/ee2-price-check.html`.
   Keep the element with `#filtersScroll` if you want the window to fit its height to the filters (our
   theme), or use `priceCheckSize.fullHeight`. To hide the popup's own frame and title bar around your
   view, add to your CSS (as the EE2 theme does):

   ```css
   html[data-theme='my-theme'] section:has(> app-my-price-check) > header { display: none; }
   ```
   Keep logic in the base class: when the theme needs something the base class does not offer, add it
   there in a theme-neutral way, or compute it in the subclass from the base class's signals.
6. **Texts:** use `{{ 'English text' | tr }}` for new texts and add their translations to
   `public/i18n/uk.json` and `ru.json` (`ui` section); EE2's keys (`'filters.collapse' | t`) go to the
   `apt` section. `tests/i18n.test.ts` scans `src/app` and `addons/` and fails on a missing one.

A build configuration can make a theme the default for a fresh install: `ee2-default` in
`angular.json` (`npm run build:ee2-default`) replaces `src/app/addons.ts` with
`addons/ee2-theme/addons.default.ts`, which lists the same themes and sets `DEFAULT_THEME_ID`. An
existing install keeps the theme its settings name (`theme: ''` means the build's default).

## Testing

`npm run dev`, pick the theme in Settings → Overlay, and check every window: price check (a rare item,
a unique, currency with related items and bulk offers, a waystone, an unidentified unique), item check,
map check, stash search, settings, the start message, in both popup positions. Without the game:
`scripts/fake-game.ps1` and `POE_GAME_TITLE="PoE Fake Game"` (see `scripts/` and
`docs/screenshots/README.md`). The EE2 theme was matched against EE2 itself shot by shot:
`docs/screenshots/ee2/README.md` (`ee2-*.png` next to `ours-*.png`) and `STYLE_NOTES.md`. Check that
our own theme did not change: the same states in our theme against `docs/screenshots/*.png`, pixel
for pixel where the data is the same.
