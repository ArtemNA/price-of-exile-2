Add to the PoE2 app what Price of Exile (PoE1) got in v0.1.10: a new version announced in the corner of
the screen, and automatic install on start, on by default. Talk to the owner in Ukrainian.

Why: the settings window lives hidden in the tray, so an update banner there goes unseen; the user opens
the overlay, plays, and never learns about a new version.

What it does (keep the behaviour exactly):
- On start of an installed build (not the dev build, which has no releases to compare with), check for
  an update with tauri-plugin-updater.
- Found, and the setting "Install new versions automatically" is on (default **on**), and the build is
  not portable: show the corner message "Updating to {version}… · The overlay restarts by itself in a few
  seconds" and install right away (downloadAndInstall, then relaunch). This happens only at start: the
  NSIS install closes the app, so it must never happen in the middle of a game.
- Found otherwise (setting off, or the portable build): show the corner message "Version {version} is out ·
  Click to see what is new and install it" for about 12 s. A click opens the settings, where the update
  banner has the install (or download, for portable) button and a "What's new" link to the version's
  release page.
- While the overlay runs, check again every 6 hours; what it finds then is only announced, never
  installed. Each version is announced once per run.
- The setting sits next to the version in the settings, with its hint; in the portable build it is
  disabled with a note that the portable version does not update itself.

How the reference does it (read the code, take it over, adapt names): commit `23f5d48` in
`C:\Users\Artem\Documents\AI\poe-trade-overlay` (`git -C C:\Users\Artem\Documents\AI\poe-trade-overlay show 23f5d48`).
- `src/app/core/updates.ts`: `checkOnStart` (install at start or announce), `checkLater` (the periodic
  check, announce only), `announce` (once per version per run). `UPDATE_CHECK_INTERVAL_MS` in
  `src/app/constants.ts`, the `autoUpdate` setting in `src/app/core/settings.ts`.
- The corner message is the same small window as the start message (`src/app/toast-window/toast-window.ts`,
  `src-tauri/src/toast.rs`). The host keeps the message to show (`toast::MESSAGE`); the page takes it with
  the `toast_message` command and listens to the `toast-message` event, because it may load after it was
  asked (the start-message race in the reference's `docs/FINDINGS.md` F-57; this feature is F-62). An
  update message stays longer (`TOAST_UPDATE_DURATION`).
- Tests: `tests/updates.test.ts` mocks the updater, the host and Tauri's app/process plugins and checks the
  four cases (install at start; announce once when off; never install later; portable only announces).
- Translations: the new texts in `public/i18n/uk.json` and `ru.json` (keys are the English texts).

Check it: the unit tests; the look of both messages and of the setting in the dev build (show them with
a temporary call, take screenshots into `docs/screenshots/` with README entries, then remove the call);
record it in your `docs/FINDINGS.md`. Ask the owner before committing or releasing.
