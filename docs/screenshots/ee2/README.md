# Exiled Exchange 2 screenshots

The original PoE2 overlay (EE2, the APT fork for PoE2), for building the "Exiled Exchange 2" theme and
comparing designs and behaviour. Style facts read off these shots and EE2's source are in
[STYLE_NOTES.md](STYLE_NOTES.md).

## How they were taken (30.10.2026)

EE2 **0.15.8** (the installed build, `%LOCALAPPDATA%\Programs\Exiled Exchange 2\Exiled Exchange 2.exe`)
driven by PowerShell (no computer-use tools) against a copy of `scripts/fake-game.ps1` in TEMP: window
title `Path of Exile 2` (EE2's default `windowTitle`, `renderer/src/web/Config.ts`), borderless, 3440×1440
at 0,0 on the main screen, the same item texts as ours (`tests/fixtures/items/*.txt`, copied into the
fake game's item file before each check). EE2 copies with Ctrl + Alt + C (its default "show advanced
mod descriptions" key is Alt), which the fake game answers with the advanced text. Our app was not
running. Keys and clicks were sent with `keybd_event` / `mouse_event`, shots taken with
`Graphics.CopyFromScreen` and cropped to the EE2 window (the price check column is cropped below its
content; it really runs the full game height). Font size 16, so 1 rem = 16 px.

EE2's config (`%APPDATA%\exiled-exchange-2\apt-data\config.json`) was copied aside first and restored
byte for byte afterwards (SHA-256 `5F627A7C…7359D6` before and after). The owner's settings were used
(league **Runes of Aldur**, core currency Exalted, volume "Both", tooltip on Shift + hover), except
for these changes in the working copy:

- price check: automatic search off for both hotkeys (`smartInitialSearch`, `lockedInitialSearch`
  false), so each live search was a deliberate click;
- item check / map check hotkey: Alt + D (unset in the owner's config).

Price checks were opened with **"Open without auto-hide" (Ctrl + Shift + D)**, which keeps the window
open and clickable; item and map checks with Alt + D; overlay mode with Shift + Space. Clicking a map
mod and switching to profile II changed the map-check profile in the working config only (restored).
EE2 was stopped with a forced kill, not "Quit": EE2 0.15.8 had already downloaded **0.16.3** and
installs it on a normal exit, so the owner's install was left at 0.15.8. That pending update is why
every price check shows an "Update available: 0.16.3 / It will be installed automatically on exit"
box under the title bar (not part of the normal layout; it pushes everything 64 px down).

**Version note.** The source in `_upstream/ee2` is 0.16.3, newer than the build shot here. What the
source has and these shots lack: the item-editor button (runes / soul cores / catalysts) to the right
of the chips, the Tip box under the results (0.15.8 shows the poe.ninja support box instead). Everything
else seen here matches the source.

Live searches: 2 trade2 searches (rare ring, The Eternal Spark) and 2 Currency Exchange queries (bulk
Exalted Orb, bulk Greater Iron Rune). poe.ninja prices came in as usual. The rate-limit panel
(`ee2-rate-limiting-panel.png`) showed 20 / 600 searches over 6 h at that moment (the others were
the owner's/our app's earlier).

Unless the name says left, every window was opened with the cursor on the right half of the game
(inventory side).

| File | What it shows | Ours |
|---|---|---|
| `ee2-position-cursor-right.png` | Whole screen, cursor at 3000,600 (grey ring = remembered cursor, 5 rem): the price check column x 2093–2553 = screen width − 887 (panel = height × 986 / 1600) − 460, full height. Backdrop rgba(129,139,149,.15) over the game, "Rate limiting" tab on the left of the column's bottom. | — (ours: popup next to the cursor) |
| `ee2-position-cursor-left.png` | The same with the cursor on the left: the column starts right after the stash panel (x 887–1347). | — |
| `ee2-price-check-rare-ring.png` | Rare ring before Search: title bar (⇄ 573 = divine in exalted, league), update box, "Category: Ring" / "Not Corrupted", Item Level and "1 of 8, stats" chips, Pseudo / Base item tabs, pseudo totals with "pseudo x 2" tags, min/max inputs, Collapse / Hidden / Mods, Search / Trade. | `03-rare-ring-pseudo.png`, `02-price-check-ee2-ring.png` |
| `ee2-price-check-rare-ring-base-item.png` | The ring on the "Base item" tab: base name chip "Prismatic Ring" framed, each mod, "2 Empty Modifier" with Any / Prefix buttons. | `03-rare-ring-pseudo.png` (our Mods tab) |
| `ee2-price-check-hidden-filters.png` | Hidden on: only hidden filters (eye-slash, single resistances, the empty modifier). | — |
| `ee2-price-check-hover-row.png` | Hover over a stat text: gray-700 box behind the text (the full text when truncated). | — |
| `ee2-price-check-mods-sources.png` | Mods on, hovering "39% total Elemental Resistance": source mods (italic "Implicit", "Explicit "of the Penguin" (Tier: 7)") with their contribution, gradient panel with a 4 px gray-500 bottom border. | — |
| `ee2-price-check-mods-sources-explicit.png` | Mods on, hovering an explicit mod: its own source line. | — |
| `ee2-price-check-header-switches-clicked.png` | After clicks on the category (→ base "Prismatic Ring" framed), "Not Corrupted" (→ red "Corrupted"). | — |
| `ee2-price-check-rare-ring-results.png` | After Search (1 search): "Matched: 10000+", "⟲ Instant", Trade; table Price / iLvl / Listed, 20 striped rows, prices as text "1 regal (0.1 ex)". | `03-rare-ring-search.png`, `04-ring-equivalents.png` |
| `ee2-price-check-collapsed-results.png` | After "Collapse": filters folded into the "1 of 8, stats ▾" chip, listings right under the chips. | — |
| `ee2-price-check-listing-tooltip.png` | Shift held over a listing: PoE-style item tooltip to the left (black body, rarity-coloured header art, mod tiers P6 / S4). | — |
| `ee2-title-divine-fractions.png` | Title popover "⇄ 573": divine → 573 × exalted, 0.1–0.9 div in ex (white tippy box). | `04-exalted-orb.png` (rate in the header) |
| `ee2-title-close-hover.png` | Title bar with the close button hovered (red-500 box). | — |
| `ee2-price-check-unique.png` | The Eternal Spark (focus): poe.ninja line (icon → 0.1 × exalted, "± 68 %" grey, "Last 7 days", sparkline), "2 of 5, stats", roll sliders 50–70 / 20–30. No related items for it. | `03-unique.png` |
| `ee2-price-check-unique-results.png` | The unique after Search (1 search): Matched 2338, Price / Listed. | `03-unique.png` |
| `ee2-price-trend-hover.png` | The trend button hovered (gray-700 rounded box). | — |
| `ee2-price-check-currency-related.png` | Exalted Orb (stack 7/20): volume block "71 [div] /hr · 40.8k [ex] /hr", "→ 1 ×", trend red ⌄⌄ 3 %, "Highest volume: [icon]", Stock chip, Search, "You have × 7 → 7 exalted · Stack × 20 → 20 exalted"; related items panel on the left (Exalted / Greater / Perfect, "2.3 div" in gold, the item itself highlighted). | `04-exalted-orb.png` |
| `ee2-price-check-currency-bulk.png` | Exalted Orb after Search (bulk): Matched with three currency buttons (exalted "?", chaos 0, divine 2, selected = gray-700 box), "⟲ Online", Price · div / bulk · Stock · Fulfill · Listed, status dots. No Market Ratio row. | `05-bulk-exalted.png` |
| `ee2-price-check-divine-orb.png` | Divine Orb: 573 × exalted, volumes, You have / Stack in div. | `05-bulk-divine.png` |
| `ee2-price-check-rune.png` | Greater Iron Rune: 8.7 × exalted, trend green ⌃⌃ 312 %. | `04-rune.png` |
| `ee2-price-check-rune-bulk.png` | The rune after Search (bulk): 5 offers, pink online dots, orange afk dots. | `05-bulk-rune.png` |
| `ee2-price-check-gem.png` | Mirage Archer (gem without Item Class): Sockets 4 and Level 14 chips, no filters, Search / Trade. | `03-gem.png` |
| `ee2-price-check-uncut-gem.png` | Uncut Skill Gem (Level 19): poe.ninja price, volumes, Stock. | — |
| `ee2-price-check-waystone.png` | Waystone T14: "Category: Map", "Map Tier: 14", "Stats ignored", pseudo map stats, unknown hybrid mod with orange triangle, "Not recognized modifier" and a "Reload fallback data" button; footer toggle "Explicit" instead of Hidden. | `03-waystone.png`, `12-uk-waystone.png` |
| `ee2-price-check-waystone-corrupted.png` | Corrupted waystone T16: eight map stats (no "Corrupted" mark in the header). | — |
| `ee2-price-check-bow-runes.png` | Corrupted bow with runes: red "Corrupted", Sockets 3 chip, DPS filters, "Augment" tag (blue) on the rune mod, tier badges; the whole-height column with the poe.ninja support box at the bottom. | `12-uk-bow.png`, `06-item-check-bow-q20.png` |
| `ee2-price-check-weapon-crossbow.png` | Corrupted crossbow: Elemental DPS with Any / Lightning buttons (lightning text yellow), Enchant tag (purple), Augment tag, "Tier 1/2" badges, Reload Time with a max input. | `03-weapon-groups.png` |
| `ee2-price-check-amulet-fractured-desecrated.png` | Amulet on the Pseudo tab: pseudo rows with "Tier 1 / Tier 2" badges, Spirit, implicit / explicit tags. | — |
| `ee2-price-check-amulet-base-item-tab.png` | The amulet on "Base item": "Allocates Cooked" (enchant tag, three soul icons → 147 exalted), **fractured** tag (yellow-400) and **desecrated** tag (green-900). | — |
| `ee2-price-check-belt-two-implicits.png` | Belt with two implicits: pseudo totals, implicit rows. | — |
| `ee2-price-check-sceptre-spirit.png` | Sceptre: "Spirit: 152" property filter, Sockets 1. | — |
| `ee2-price-check-charm.png` | Charm: Quality 14, "Stats ignored". | — |
| `ee2-price-check-jewel.png` | Jewel: "Stats ignored", Pseudo / Base item. | — |
| `ee2-price-check-magic-mace.png` | Magic two-handed mace: "Q 20%" labels next to DPS inputs, Any / Lightning. | — |
| `ee2-price-check-normal-helmet.png` | Normal helmet: base name, "Normal" and Item Level chips, Search / Trade only. | — |
| `ee2-price-check-rare-unidentified.png` | Unidentified rare wand: "Unidentified" chip, one skill filter. | — |
| `ee2-price-check-unknown-item-error.png` | Tablet that 0.15.8 cannot parse: red-bordered "Unknown item" error box with "Reload fallback data", the raw item text in a gray-900 box. | — |
| `ee2-price-check-unidentified-unique-single.png` | Unidentified Felt Cap: Goldrim picked without asking, "Unidentified" chip, poe.ninja price. | `11-unid-single.png` |
| `ee2-price-check-unidentified-unique-picker.png` | Unidentified Sapphire Ring: "Which one?" prompt and a 2-column grid of three uniques. | `11-unid-picker.png` |
| `ee2-price-check-unidentified-unique-picked.png` | After picking Polcirkeln: Unidentified chip, implicit filter with slider. | `11-unid-picked.png` |
| `ee2-rate-limiting-tab.png` | The "Rate limiting" tab at the bottom edge, left of the column. | `02-price-check-ee2-search.png` (our status line) |
| `ee2-rate-limiting-panel.png` | The tab clicked: policies and counters in system sans. | — |
| `ee2-item-check-rare-ring.png` | Item check, ring: name, wiki · poedb · CoE · ⋮ · Find in Stash. | `06-item-check-ring.png` |
| `ee2-item-check-bow-runes.png` | Item check, bow: Physical / Elemental / Total DPS (no CoE: corrupted). | `06-item-check-bow-q20.png` |
| `ee2-item-check-crossbow.png` | Item check, crossbow. | `06-item-check-crossbow.png` |
| `ee2-item-check-unique.png`, `-rune.png`, `-currency.png`, `-gem.png`, `-amulet.png` | Item check for those items (no CoE for the unique). | `06-item-check-rune.png` |
| `ee2-item-check-left.png` | Item check with the cursor on the left: next to the stash panel (x 888). | — |
| `ee2-find-in-stash-fake-game.png` | The fake game after "Find in Stash": `"Prismatic Ring"` searched. | `06-find-in-stash-fake-game.png` |
| `ee2-map-check-waystone.png` | Map check, waystone T14: header with Profile I II III, mods, unknown mod in orange, "Wording of some stats has been changed" box (from the owner's old PoE1-era marks). | `07-map-check-waystone.png` |
| `ee2-map-check-marked-deadly.png`, `-warning.png`, `-good.png` | One mod clicked once / twice / three times: red skull, orange triangle, green check. | `07-map-check-corrupted.png` |
| `ee2-map-check-hover.png` | Hover over a mod: gray-700 row and the "Hide / Edit" side menu. | — |
| `ee2-map-check-profile-2.png` | Profile II. | — |
| `ee2-map-check-waystone-corrupted.png` | Corrupted waystone T16 (profile II). | `07-map-check-corrupted.png` |
| `ee2-map-check-left.png` | The same with the cursor on the left (next to the stash). | — |
| `ee2-overlay-mode-full.png` | Whole screen in overlay mode: widget menu at 5 % / 5 %. | — |
| `ee2-overlay-menu.png` | Widget menu: cog, search, "Map rolling", "Dump sorting", "Cheat sheets", ⋯, "Price check (Ctrl + V)". | — |
| `ee2-overlay-mode-widgets.png` | Overlay mode with the "Map rolling" panel and "Cheat sheets" open. | — |
| `ee2-stash-search-panel.png` | Stash search panel "Map rolling" (the owner's presets). | `09-stash-panel.png` |
| `ee2-stash-search-panel-hover.png` | A preset hovered (gray-700) with the Hide / Edit / Move / Delete side menu. | — |
| `ee2-stash-panel-click-fake-game.png` | After a click on "Increased Pack Size": typed into the fake game's stash search. | `09-chat-and-stash-fake-game.png` |
| `ee2-settings-hotkeys.png` | Settings, Hotkeys (Map check / Item info on Alt + D: our temporary change). | `08-settings-copy-keys.png` |
| `ee2-settings-chat.png` | Settings, Chat: the owner's commands. | — |
| `ee2-settings-general.png` | Settings, General: language, font size, log / config paths (placeholders), overlay background, window title. | — |
| `ee2-settings-price-check.png`, `-2.png`, `-3.png` | Settings, Price check: league radio list, account name (empty), show seller, fill stat values, primary base currency (Exalted / Chaos), volume, prediction, cursor, augment sockets, tooltip, tier, built-in browser, auto search, initial delay. | — |
| `ee2-settings-map-check.png` | Settings, Map check: search, "Only selected", 177 stats, warning / deadly / good icons. | — |
| `ee2-settings-item-info.png` | Settings, Item info: wiki / PoEDB / CoE / Find in stash / "Filter by" hotkeys. | — |
| `ee2-settings-leveling.png` | Settings, Leveling (XP tracker, needs Client.txt). | — |
| `ee2-settings-help.png` | Settings, Help: tip frequency and the tip carousel. | — |
| `ee2-settings-about.png` | Settings, About: version 0.15.8, "Update available: 0.16.3 · Install now" (not clicked). | `13-installed-toast.png` (our version) |
| `ee2-settings-with-patrons.png` | Settings with the patrons strip under the window. | — |
| `ee2-start-message.png` | "Exiled Exchange 2 · Is ready and running in background" toast with the jeweller's orb picture, bottom centre (bottom edge 20 % from the bottom), seen in three frames 0.5 s apart (≈ 1.5 s). | `13-installed-toast.png` |

Kept out of git (in TEMP only): `ee2-settings-debug.png` (log lines with the Windows version) and the
raw full-screen intermediates.

Not captured, or EE2 does not have it:

- **Centred price check**: EE2 has no such option; the column is always next to the inventory or
  stash panel.
- **Item editor** (rune / soul core / catalyst popover) and the **Tip box**: only in 0.16.x (the source),
  not in the installed 0.15.8; updating the owner's install was not ours to do.
- **Unrevealed / desecrated-unrevealed mods**: none of our fixtures has an unrevealed mod.
- **Online / Instant popover**: a click on "⟲ Instant" did not open it (as with APT).
- Hotkey field waiting for keys, chat commands sent into the game (the owner's F9 is `/exit`), the
  built-in browser, other languages, update toasts.
- **What EE2 lacks compared with ours**: the bulk Market Ratio row and the "Pay with" ex / div / c
  choice beyond its three toggle buttons, "≈ ex / ≈ c" equivalent columns, a Mods preset tab (EE2 has
  "Base item"), a league menu in the title (EE2: Settings → Price check), the popup next to the
  cursor and a centred popup, a disenchant/dust line (PoE2 has none).
