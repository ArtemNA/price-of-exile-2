You are the orchestrator for a new project: a **Path of Exile 2** price check overlay that is to PoE2 what
**Price of Exile** is to PoE1 — the same stack, the same design and behaviour, the same quality bar —
built on **Exiled Exchange 2** (EE2, Kvan7's fork of Awakened PoE Trade for PoE2) instead of APT.
You plan first, get the plan approved, and only then build it, delegating to subagents.

The new project lives in `C:\Users\Artem\Documents\AI\price-of-exile-2` (this file is its first file; the folder name is provisional until
the owner picks the app's name). Paths below that start with `C:\` point to the reference project;
relative paths (`PLAN.md`, `docs/FINDINGS.md`) are in the new project.

Talk to the owner in Ukrainian. Documents (plan, findings) in Ukrainian like the reference project;
code, comments, commit messages and UI texts in English (the UI is then translated, see below).

## The reference: Price of Exile (PoE1)

Everything there was learned the hard way and most of it applies to PoE2 too. Treat it as the
template, not just as inspiration.

- Local repo: `C:\Users\Artem\Documents\AI\poe-trade-overlay` (GitHub: https://github.com/ArtemNA/price-of-exile,
  public, MIT). Angular 22 + Tauri 2 + Tailwind 4, Windows only. Read it for real, do not skim:
  - `C:\Users\Artem\Documents\AI\poe-trade-overlay\PLAN.md` — the original plan for PoE1 from the APT analysis: scope (what was taken and dropped from
    APT and why), window model, architecture, stage order. Your PoE2 plan should have the same shape.
  - `C:\Users\Artem\Documents\AI\poe-trade-overlay\docs\FINDINGS.md` — **60 findings** (F-01…F-60) made while porting APT and testing in the real game.
    Every entry has a tag: **PoE2: так** (41: carries over as is), **PoE2: перевірити** (17: probably
    differs, check against the game or EE2), **PoE2: ні** (2: PoE1 only). Many of these are about Windows,
    WebView2, Tauri, focus, hotkeys, DPI, the trade API, Cloudflare, rate limits, i18n, the installer and
    the updater, and are not about PoE1 at all — they are your checklist of traps. Go through all 60 and
    decide for each what it means for PoE2; the 17 "перевірити" ones need an explicit answer from the EE2
    analysis.
  - `C:\Users\Artem\Documents\AI\poe-trade-overlay\CHANGELOG.md` — what each release added; a good map of user-visible features and fixes.
  - `C:\Users\Artem\Documents\AI\poe-trade-overlay\docs\design\REDESIGN_BRIEF.md` and the approved price check design (canvas "A+B mix", Claude Design
    artifact https://claude.ai/artifact/QtRoNPN8nSAwTHYv47HMGb): the full-width item header (name, base,
    item icon, "Any <category> | This base", iLvl ≥, corrupted in three states, poe.ninja price with icon,
    7 day trend and sparkline), the left column (Pseudo / Mods, grouped mods with T1/T2 tier badges, the
    "Fractured" switch, "Σ Mods behind totals", "Hidden" with reasons, Any / Prefix / Suffix for an empty
    affix, related items next to the price), the right column (Trade / Bulk / poe.ninja / Wiki, currency
    icons everywhere). PoE2 keeps this design; adapt only what PoE2 items really need.
  - `C:\Users\Artem\Documents\AI\poe-trade-overlay\docs\screenshots\` with `README.md` describing every state, and
    `C:\Users\Artem\Documents\AI\poe-trade-overlay\docs\screenshots\apt\` with the original APT for comparison;
    `C:\Users\Artem\Documents\AI\poe-trade-overlay\docs\readme\` holds the GitHub README images. Open the PNG files: they are the visual
    reference. The newest states are `16-*` (the A+B design: header, tiers, hidden filters, related
    items, bulk, currency icons), `17-*` (popup next to the inventory), `18-*` (Ukrainian and Russian
    interface), `19-*` (Russian game, ru.pathofexile.com, the version link).
  - The code (in `C:\Users\Artem\Documents\AI\poe-trade-overlay`): `src/lib/apt/` is APT ported byte for byte (changes marked `// [port]`, upstream commit in
    `UPSTREAM_COMMIT`), `src/app/apt-shims/` replaces APT's Electron/Vue pieces, `src/app/` is our own
    code, `src-tauri/` the Rust host (popup without focus, hotkeys, clipboard, built-in browser, tray,
    toast, shortcuts, updater), `scripts/` the test tools (fake game, hotkey presser, screenshots,
    speed measuring, data indexes), `tests/` (vitest), `public/i18n/` (uk, ru interface), `public/data/`
    (en, ru game data), `.github/workflows/release.yml` (installer, portable exe, signed updater feed).
- The owner's notes for this kind of work (follow them):
  - Static values only in one place: `src/app/constants.ts` and `src-tauri/src/constants.rs`, as in the
    reference.
  - Record every finding or deviation in the new project's `docs/FINDINGS.md`, same format, with a tag
    whether it also applies back to PoE1 (so the two projects can learn from each other).
  - Testing on the desktop without computer-use (it hides windows and steals focus): own PowerShell
    scripts and the fake game window, like `C:\Users\Artem\Documents\AI\poe-trade-overlay\scripts\` (fake-game.ps1, press-hotkey.ps1,
    screenshot.ps1, measure-popup.ps1): copy and adapt them.
  - While testing, save cropped screenshots of every app state to the new project's `docs/screenshots/`
    and describe each in its `README.md`, like the reference does.
  - Careful with the trade API rate limits: unit tests and fixtures first, only a few live requests.
  - Close the app, the dev server and consoles when done. "стоп" means stop at once.
- Its git history (`git -C C:\Users\Artem\Documents\AI\poe-trade-overlay log`, about 60 commits) tells the order in which things were built and why.

## The bases

- **Exiled Exchange 2**: https://github.com/Kvan7/Exiled-Exchange-2 — the APT fork for PoE2. This is the
  source of the parser, filters, trade queries and game data for PoE2, the way APT was for PoE1.
- **Awakened PoE Trade**: https://github.com/SnosMe/awakened-poe-trade — EE2's upstream; also what the
  reference project ported, so diffing EE2 against it shows exactly what PoE2 changed.
- Clone them into `C:\Users\Artem\Documents\AI\price-of-exile-2\_upstream\` (keep that folder out of the new repo's git), with
  `git clone -c core.autocrlf=false` (the owner has `autocrlf=true`; game data files are
  indexed by character offsets and must keep LF, see F-07). Ask before downloading anything else.

## Phase 1 — analysis (no code yet)

Analyse EE2 against APT and against the reference, and write what you find. At least:
- What EE2 changed in the parser, client strings, stats/items data, filters, pseudo stats and trade
  queries; how its game data is produced and updated per patch; which game languages it ships.
- The PoE2 trade site and API (paths, realms, league ids, rate limits), bulk exchange (if any), the
  built-in browser / Cloudflare situation (F-45), poe.ninja for PoE2 (what it has, its API).
- PoE2 item specifics the UI must handle: runes / socketed items, uncut gems, waystones and tablets
  (instead of maps), quality types, corruption, the "advanced copy" text format, item classes, what does
  not exist in PoE2 (influences? fractured? heist? divination cards? — check).
- Which reference features make sense in PoE2 and how: price check, bulk, poe.ninja tab and related
  items, item check (wiki / PoEDB / Craft of Exile equivalents for PoE2), map check (waystones?), stash
  search, chat commands, unidentified uniques, built-in browser, interface languages (uk, ru), game
  languages (EE2's; ru.pathofexile.com equivalent for PoE2 if any).
- The 60 findings: for each "так" whether it still holds, for each "перевірити" the answer, for "ні" what
  replaces it in PoE2.
- Code reuse: how much of the reference's own code (`src/app`, `src-tauri`, scripts, workflow) can be
  taken as is. Propose how: a fork of the price-of-exile repo with `src/lib/apt` swapped for EE2's
  code, a fresh repo copying modules, or a shared core — with trade-offs, and recommend one.

## Phase 2 — the plan, for approval

Write `PLAN.md` for the new project in the shape of the reference's `PLAN.md`: scope table (take / drop,
with reasons), window model, architecture, data pipeline, stage order with what "done" means per stage,
risks, and the open decisions. Then stop and ask the owner to approve it. Decisions that are the owner's:
- the app's name, the repository (name, public or not), the Tauri identifier (must differ from
  `com.artemna.poe-trade-overlay`, and the dev build must use `<identifier>.dev`, F-41);
- the updater signing key: a new one for the new app, kept out of the repo (the owner sets the repo
  secret themselves; never commit a key, never write secrets);
- whether the project stays in `C:\Users\Artem\Documents\AI\price-of-exile-2` (rename the folder to match the name).

## Phase 3 — building it

Only after approval. Work stage by stage like the reference did; delegate independent pieces to
subagents with clear, narrow briefs (files they own, rules above, what done looks like) and review their
results yourself before accepting them. Keep the design and behaviour of Price of Exile unless the plan
says otherwise. Verify every stage: unit tests (vitest, cargo test), the fake game with PoE2 item texts,
screenshots of each state, then a short in-game test list for the owner (they play PoE2 and will check;
write exact scenarios). Speed matters: the reference opens the popup in ~65 ms (F-53); measure yours the
same way (`C:\Users\Artem\Documents\AI\poe-trade-overlay\scripts\measure-popup.ps1`).

Git: ask the owner before the first commit and the first push in the new repo (their global rule is no
commits and no pushes without an explicit request; for the reference repo they allowed both, ask
whether the same holds here). Author: `ArtemNA <55134134+ArtemNA@users.noreply.github.com>`. Releases
only when the owner says so; versions are semver (0.1.x for fixes), Tauri accepts nothing else.

Start now with Phase 1: read the reference project, clone the two bases, write the analysis to
`docs/ANALYSIS.md` in the new project, and report it to the owner.
