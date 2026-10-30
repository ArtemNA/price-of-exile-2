# Exiled Exchange 2: style notes for an "EE2-like" theme

Raw material read off EE2 0.15.8 (screenshots in this folder, 3440×1440, font size 16, so 1 rem = 16 px)
and its source (`_upstream/ee2/renderer`, version 0.16.3; same look, plus the item editor and Tip box).
EE2's renderer is APT's: Tailwind 3 with the same hand-written Tailwind v1 palette
(`renderer/tailwind.config.js`), the same fonts, the same components for most of the price check. So
the PoE1 project's `docs/screenshots/apt/STYLE_NOTES.md` applies almost as is; this file repeats what
the theme needs and marks **EE2:** where EE2 differs from APT. Flat colours marked ✓ were sampled on
the screenshots and match the palette exactly; text colours come from the source (ClearType makes
single text pixels unreliable).

## Palette (Tailwind v1 names → hex)

| Token | Hex | Where (✓ = sampled) |
|---|---|---|
| gray-900 | `#1a202c` | title bar ✓, name bar ✓, chips ✓, inputs ✓, update box ✓, map check header and 4 px border ✓, item check frame ✓, stash panel ✓, widget menu ✓, settings sidebar ✓, rate-limit tab ✓, related panel border ✓ |
| gray-800 | `#2d3748` | window body ✓, even listing rows ✓, related panel ✓, toast ✓, stash buttons ✓, menu buttons ✓, item check info block ✓, settings content and active menu item ✓, rate-limit panel ✓ |
| striped row | `#353f52` | **odd** rows of the listing table ✓ (first data row is striped) |
| gray-700 | `#4a5568` | row dividers ✓, table header bottom border ✓, buttons (Search, Trade, Collapse, wiki/poedb/CoE, Any/Prefix/Lightning) ✓, pseudo tag ✓, highlighted related entry ✓, selected bulk currency button ✓, hover on stat text / trend / map row / stash button ✓, map "outdated stats" box ✓ |
| gray-600 | `#718096` | title text and ⇄ icon ✓, "Not Corrupted", explicit/implicit tag text, stack-value dashed border |
| gray-500 | `#a0aec0` | active chip / base-name border ✓, "Matched:", "/hr", "Last 7 days", sparkline stroke, unchecked checkbox |
| gray-400 | `#cbd5e0` | button text, toggle labels, related item text |
| gray-300 | `#e2e8f0` | input text |
| gray-200 | `#edf2f7` | default text of the price check; also Tailwind's default `border` colour (support / Tip box dashes) |
| gray-100 | `#f7fafc` | settings text, toast text, stash button text |
| yellow-500 | `#ecc94b` | Tier 1 badge fill ✓, Tier 2 outline and text, "in demand" badge |
| yellow-400 | `#f6e05e` | **fractured** tag fill ✓ (black text) |
| orange-400 | `#f6ad55` | "Not recognized modifier", warning triangle |
| orange-500 | `#ed8936` | afk status dot ✓ |
| orange-600 | `#dd6b20` | map check: warning row ✓ |
| red-500 | `#f56565` | "Corrupted" in the header, close-button hover box ✓ |
| red-600 | `#e53e3e` | trend down arrows, offline dot |
| red-700 | `#c53030` | map check: deadly row ✓, corrupted tag |
| green-500 | `#48bb78` | trend up arrows |
| green-700 | `#2f855a` | map check: good row ✓ |
| green-900 / green-100 | `#22543d` / `#f0fff4` | **EE2: desecrated** tag ✓ |
| blue-600 / blue-100 | `#3182ce` / `#ebf8ff` | crafted, synthesised and **EE2: rune ("Augment")** tag ✓ |
| `#3182ce` / `#1a4773` stripes | 45°, 8 px bands | **EE2: added-rune ("Augment")** tag (only raw hex EE2 adds) |
| purple-600 / purple-100 | `#805ad5` / `#faf5ff` | enchant tag ✓ |
| rose-900 / yellow-100 | `#881337` / `#fffff0` | **EE2: mutated** tag |
| pink-400 | `#f687b3` | **EE2: online** status dot ✓ (APT: none) |
| gold | `#e4c29a` | divine prices (`.golden`), e.g. "2.3 div" in related ✓ |
| fire / cold / lightning | `#c80000` / `#5aadff` / `#ffff00` | **EE2:** text and selected border of the Fire / Cold / Lightning buttons in DPS rows ✓ (lightning) |
| normal / magic / rare / unique | `#c8c8c8` / `#8888ff` / `#ffff77` / `#af6025` | **EE2:** only the listing hover tooltip's title |
| overlay backdrop | `rgba(129,139,149,0.15)` | over the game while the overlay is active (game `#1a130d` → `#292521` ✓) |

No rarity colours in the price check itself: item names are plain white / gray-200. EE2 adds
`rose`, `fuchsia`, `slate` scales to the config but uses only rose-900 (mutated) and slate-800 (an
alphas box in settings).

Tags (`.tag px-1 rounded text-xs leading-none`, lower-case in source, shown in small caps): pseudo
gray-700 / black; explicit / implicit / skill no fill, gray-600 text with `text-shadow 0 0 4px #1a202c`;
corrupted red-700 / red-100; fractured yellow-400 / black; desecrated green-900 / green-100; enchant
purple-600 / purple-100; augment blue-600 / blue-100; variant yellow-700 / yellow-100; scourge
orange-600 / white; sanctum border only. " x 2" is appended for several sources. Tier badges: Tier 1
filled yellow-500 black text; Tier 2 outlined yellow-500; **EE2:** "tier 3+" gray-700 / black only
with "Always show tier"; "not tier 1" gets a black border.

## Fonts

Identical to APT (`renderer/src/assets/font.css`; files in `renderer/src/assets/font/`, in the install
inside `resources\app.asar` with Vite-hashed names, e.g. `Fontin-SmallCaps-Hinted-Cr3shV8E.ttf`):

- Whole UI: **FontinSmallCaps** (`Fontin-SmallCaps-Hinted.ttf`, `.font-poe-sc` on `#app`), `text-sm` =
  0.875 rem / 1.25 rem line (14 / 20 px). Cyrillic falls back to **FrizQuadrataC**
  (`FrizQuadrataITC-Hinted.ttf`, `unicode-range: U+400-4FF`).
- **Fontin** regular / italic / bold (`Fontin-{Regular,Italic,Bold}-Hinted.ttf`, `.font-poe`) for
  inputs and some fields; italic for the source-mod headers.
- **Exo 2** 400 / 500 / 600 (`Exo2-{Regular,Medium,SemiBold}.ttf`): rolled numbers in mod texts are
  `text-white font-exo2 font-semibold` ("**39**% total Elemental Resistance"), the rest gray-200.
- System sans (`font-sans text-xs`) for relative dates ("4 mo. ago"), seller names, "×", the
  rate-limit panel. `font-mono` only in the new Notepad / Timer widgets.
- Icons: Font Awesome Free 6 (solid / regular / brands / v4-compat).
- Size setting = `html { font-size: <fontSize>px }` (default 16); everything is in rem.

## Price check window

- **Width 28.75 rem = 460 px**, **full game height** (y 0–1440), `bg-gray-800`, text gray-200. Glued
  to the game's side panel, never to the cursor. Panel width = game height × 986 / 1600 = 887 px at
  1440 (**EE2 kept APT's ratio**). Cursor in the right half → column on the right, x 2093–2553
  (right edge = screen right − panel); left half → x 887–1347. Measured on `ee2-position-cursor-*.png`.
  **No centred mode.** The window is a flex row: a `width: var(--game-panel)` spacer, the column,
  then the related items / rate-limit tab on the side facing the screen centre (`flex-row-reverse` on
  the inventory side).
- Remembered cursor: a 5 rem circle `rgba(255,255,255,.35)` with a 1.25 rem dot `.5`, only while the
  overlay is active and "Show memorized cursor position" is on.
- Related items (`ee2-price-check-currency-related.png`): outside the column, `bg-gray-800 text-gray-400
  mt-6`, 0.25 rem gray-900 border except on the column side, `rounded-l-lg` when on the left, inset
  shadow `rgb(0 0 0 / 70%)`, max width min(100 %, 24 rem); entries `rounded px-1` with 32 px icon →
  price, name under it in gray-600; the checked item itself highlighted gray-700.
- "Rate limiting" tab: bottom edge, outside the column (left of it when on the right),
  `mx-6 px-4 bg-gray-900 text-gray-600 rounded-t leading-6`; limited = red-700 / red-200 + shake.
  Panel `font-sans p-4 bg-gray-800 text-gray-400`, 0.25 rem gray-900 border.

Top to bottom, measured on `ee2-price-check-rare-ring.png` (y in px; the update box is only there
while an update is pending):

1. **Title bar** 0–24, gray-900, gray-600 text: left `fa-exchange-alt` + divine rate in the **core
   currency** ("⇄ 573" = exalted; APT: chaos) — a click opens a white tippy popover "div → 573 × [ex]"
   and 0.1…0.9 div ⇒ N ex; centre the league ("Runes of Aldur", or "Exiled Exchange 2" without one;
   a click opens the league settings); right `fa-window-close`. Buttons `px-2`, hover gray-400 text on a
   gradient gray-900 → gray-700; close hover red-200 text on red-500 (`ee2-title-close-hover.png`).
2. Body padding **p-4 (16 px)**.
3. (Update box 32–80: gray-900, rounded, two lines; not part of the theme.)
4. **Name bar** 96–118: gray-900 `rounded mb-2`, line 1.25 rem; left category "Category: Ring" or the
   base name framed (`px-2 rounded border`, gray-500 when exact base); right "Not Corrupted" gray-600 /
   "Corrupted" red-500 (two states, click toggles).
5. **poe.ninja line** (`pb-4`, min height 3 rem; only when poe.ninja knows the item): **EE2:** left
   volume block "71 [24 px div] /hr" / "40.8k [24 px ex] /hr" (`/hr` text-xs gray-500, `rounded px-1`,
   hover gray-700, cursor pointer); centre "icon → N × [core currency icon]" (`text-base`, 32 px
   icons, arrow gray-600, divine amounts in gold); right trend button: ⌃⌃ green / ⌄⌄ red / ± grey +
   "N %", "Last 7 days" `text-xs` gray-500, sparkline 3 × 2 rem (stroke `#a0aec0`, fill `#4a5568`),
   hover gray-700 box; **EE2:** under it "Highest volume: [24 px icon]". PoePrices prediction hidden.
6. **Chips row** 126–148 (`flex-wrap gap-2 pb-3`): gray-900 `rounded`, 1 px border transparent /
   gray-500 when active, line 1.25 rem; numeric chips with an inline number (Item Level, Sockets, Map
   Tier, Stock, Level, Quality); logical chips "Unidentified", "Normal", "Stats ignored"; "N of M,
   stats" folds the filters (chevron ▾ when folded). **EE2 0.16:** an item-editor button (2 rem
   square, gray-900, gray-500 border, rune / catalyst icon) on the right of this row.
7. Optional **preset tabs** "Pseudo / Base item" 164–184: tabs with gray-700 borders, active =
   gradient gray-900 → gray-800, min width 3 rem.
8. **Stat rows**, 52 px apart with a tag line (dividers at 184, 236, 288…), `py-2 border-b
   border-gray-700`:
   - line 1: 20 px checkbox column (`far fa-square` gray-500 / `fas fa-check-square`), text (one
     line, truncated; hover = gray-700 box with the full text), optional "Q 20%" label (gray-500 text,
     gray-700 border, `rounded px-2`), min / max inputs **48 px each, 1 px apart, 22 px tall** (193–215),
     gray-900, gray-300 text centred, placeholder "min" / "max" gray-700 at 13 px.
   - line 2: eye-slash (hidden) in the checkbox column, tags, tier badges, roll slider 12.5 rem
     (gray-700 track, gradient fill to white, black tick), **EE2:** Any / Prefix / Suffix buttons for
     empty modifiers and Any / Fire / Cold / Lightning buttons for elemental DPS (`bg-gray-700 rounded
     px-2`, selected border gray-500 or the element colour).
   - unknown mod: orange triangle, text, sub-line "explicit — Not recognized modifier" (gray-600 /
     orange-400, text-xs); **EE2:** "Reload fallback data" `.btn` at the right.
   - Mods on + hover: source panel under the row, gradient gray-800 → gray-900, 4 px gray-500 bottom
     border, italic gray-500 headers (`Explicit "of the Penguin" (Tier: 7)`), contribution box
     `w-12 rounded border-gray-700`.
9. **Footer of the filters** (446–468, `flex gap-x-4 mb-4`): "Collapse ⌃" `bg-gray-700 rounded-b w-40
   leading-none`, toggles "Hidden" ("Explicit" for waystones) and "Mods" (`fa-toggle-on` gray-300 /
   `fa-toggle-off` gray-600, label gray-400).
10. **Search / Trade** row 486–506: `.btn` gray-700, gray-400 text, `px-2 py-1 rounded leading-none`,
    Search min width 5 rem in a `w-40` box; "Trade ↗" right.
11. **Results** (replace the Search row): top bar `mb-2 pl-2` "Matched: 10000+" (gray-500 label),
    "⟲ Instant" (**EE2:** listing type Instant (default) / Online / Offline; gray-500), "Trade ↗" right.
    Table `w-full`, sticky header gray-800 with a gray-700 bottom border (533); columns Price · (Stock)
    · iLvl · (Level / Sockets for gems) · (Quality, blue-400) · Listed · (Seller). Rows **22 px**,
    odd rows `#353f52`. Price as **text**: "1 regal (0.1 ex)" — amount, currency, and the core-currency
    equivalent in brackets when the currency is neither core nor divine; no icons, no strike-through.
    Listed: 6 px status dot (online pink-400, afk orange-500, offline red-600, instant buyout none) +
    system-sans `text-xs` date; badges "You", "in demand" (yellow-500), "Gone" (red-500 outline).
    **EE2:** Shift + hover over a row shows a PoE-style item tooltip on the left
    (`ee2-price-check-listing-tooltip.png`): icon box gray-600/50, black body, centred text,
    rarity-coloured title with header art, prefix/suffix tier marks P6 red-300 / S4 blue-300.
    Bulk: "Matched:" with **three** currency buttons (exalted / chaos / divine; icons 1.75 rem
    greyscale, selected = gray-700 box), columns Price · "div / bulk" · Stock · Fulfill · Listed;
    **EE2 has no Market Ratio row and no Currency Exchange note** (APT has both).
12. **Stack value**: `p-2 border border-dashed border-gray-600 rounded mt-2`, "You have × 7 → 7
    exalted · Stack × 20 → 20 exalted" gray-400 (core currency; div in div). No disenchant line.
13. Bottom of the column (`mt-auto`): support box "This tool relies on poe.ninja, consider supporting
    them!" (`border border-dashed p-2`, default border colour) in 0.15.8; **EE2 0.16:** a "Tip #N"
    box in the same frame.

Errors: a red-bordered box "Unknown item … Reload fallback data", then the raw text in `pre
bg-gray-900 rounded m-4 p-2` (`ee2-price-check-unknown-item-error.png`).

Unidentified unique picker: prompt `m-4 py-1 px-2 bg-gray-900 rounded`, then `grid grid-cols-2 gap-2
px-4 pb-4` of `bg-gray-700 rounded p-2` buttons with a 3 rem image (as APT).

## Other windows

- **Item check**: anchored at the game panel's edge (right edge x 2553 / left edge x 888), vertically
  centred (687–753 at 1440); min 20 rem (here 320 px), max min(100vw − panel, 30 rem). gray-900 frame
  4 px, name `py-1 px-4` centred, row `flex gap-1 py-1 bg-gray-900` of `.btn flex-1` wiki · poedb · CoE
  · ⋮ · Find in Stash (**EE2:** `fa-dollar` "same price" button when the item has a note), info block
  gray-800 with a 2-column DPS grid.
- **Map check** (waystones are routed here): 30 rem incl. border (480 px), same anchors, vertically
  centred; `bg-gray-800 border-4 border-gray-900`; header gray-900 `py-1 px-8` with centred name and
  "Profile I II III" (24 px gray-800 buttons, active `border gray-600`); rows `p-2 leading-none`:
  deadly red-700 + skull, warning orange-600 + triangle, good green-700 + check, hover gray-700 with a
  "Hide / Edit" side menu; unknown mod "Not recognized modifier —" orange-400; "wording changed" box
  gray-700.
- **Stash search panel**: positioned by anchor (here tl 35 % / 46 %), `rounded bg-gray-900 p-1`, title
  gray-100, buttons `rounded p-2 bg-gray-800 text-gray-100 leading-4`, 4 px apart, hover gray-700 with
  a Hide / Edit / Move / Delete side menu.
- **Widget menu** (overlay mode, tl 5 % / 5 %): gray-900 box `p-1 gap-1 text-base`, buttons gray-800
  `rounded p-2`, hidden widgets listed, shown ones drop out of the row; "Price check (Ctrl + V)" under it.
- **Settings**: centred, top 0, max 50 × 38 rem (800 × 608 px), slides in from the top. Title bar like
  the price check ("Settings - Exiled Exchange 2"). Sidebar gray-900 `min-w 10rem pl-2 pt-2`, items
  `p-2 leading-none text-gray-600 rounded-l`, active gray-400 on gray-800 (tab joined to the content),
  separators gray-800, Quit outlined. **EE2 pages:** Hotkeys, Chat | General | Price check, Map check,
  Item info | Leveling | Help, Debug, About. Content gray-800 `rounded-tl`; footer gray-900 with a
  gray-600 top border, "Save" (`bg-gray-800 px-3 rounded`) and "Cancel". Patrons strip under the window.
- **Start toast**: bottom centre, bottom edge 20 % from the bottom (y 1154 at 1440), fade in,
  "back out down" out, seen for ≈ 1.5 s; `bg-gray-800 rounded`, ring `0 0 1px 2px rgb(255 255 255 /
  20%)`, `py-2 px-4`, **EE2:** jeweller's orb picture (`/images/jeweler.png`, max 78 px, drop shadow)
  left of the box; "Exiled Exchange 2" (`text-base`) / "Is ready and running in background".

## Cursor and hover

- `cursor: pointer` on every `<button>` (Tailwind preflight) — title bar, chips, tabs, toggles,
  Search / Trade, related entries, stash presets, settings menu — plus explicit `cursor-pointer` on
  the volume block, trend button and eye-slash icon. Focused number inputs hide the cursor; the
  unknown-mod full text has `cursor-default`.
- Hover = gray-700 background almost everywhere (stat text, trend, volume block, map rows, stash
  buttons, related entries); title buttons: gray-400 text on a gray-900 → gray-700 gradient; close:
  red-500 box.

## Sizes at a glance (font size 16)

| What | Value |
|---|---|
| price check width | 460 px (28.75 rem), full game height |
| title bar | 24 px |
| body padding | 16 px |
| name bar | 22 px (20 + border) |
| chip height | 22 px |
| stat row (row to row) | 52 px with a tag line |
| min / max input | 48 × 22 px each, 1 px gap |
| checkbox column | 20 px |
| table row | 22 px |
| item / currency icons | 32 px; volume / "highest volume" icons 24 px |
| related panel | max 24 rem |
| item check width | 20–30 rem (320 px here) |
| map check width | 30 rem incl. 4 px border (480 px) |
| settings | 800 × 608 px max |
| panel offset | game height × 986 / 1600 (887 px at 1440) |

## Where EE2 differs from APT, in short

Core currency Exalted everywhere (title rate, prices, stack value, bulk); poe.ninja volume block and
"Highest volume"; prices as text with "(N ex)" equivalents; pink online dot, Instant / Online / Offline
listing type; three bulk currencies and no Market Ratio row; new tags (desecrated, augment, added
rune, mutated, sanctum), Any / Prefix / Suffix and elemental buttons in rows; Shift-hover item tooltip;
jeweller's orb in the toast; Leveling and Help settings pages; the item editor and Tip box (0.16).
Unchanged: palette, fonts, 460 px column glued to the panel by 986 / 1600, title bar, chips, inputs,
stat rows, related panel, rate-limit tab, item / map check, stash panel, settings chrome, backdrop.
