# Third-party code

## Exiled Exchange 2

- Source: https://github.com/Kvan7/Exiled-Exchange-2 (a fork of Awakened PoE Trade)
- License: MIT, © 2020 Alexander Drozdov (full text: [src/lib/ee2/LICENSE](src/lib/ee2/LICENSE))
- Upstream commit: see [src/lib/ee2/UPSTREAM_COMMIT](src/lib/ee2/UPSTREAM_COMMIT)

Used parts (`src/lib/ee2` mirrors EE2 `renderer/src`; changed lines are marked `// [port]`):

- `parser/*`, `web/price-check/item-editor/{augment,item-editor}.ts`: item text parser, copied unchanged.
- `assets/data/*`, `assets/client-string-loader.ts`: game data lookup. Adapted: loading goes through a
  pluggable `DataSource`.
- `web/price-check/filters/**`, `trends/getDetailsId.ts`, `trade/{pathofexile-trade,pathofexile-bulk,Cache}.ts`,
  `web/map-check/*`, `web/item-check/{hotkeyable-actions,widget}.ts`, `web/overlay/widgets.ts`: copied unchanged,
  except `filters/create-stat-filters.ts` (`noPseudo` option for the Mods preset).
- `web/price-check/trade/RateLimiter.ts`, `common.ts`: adapted (Vue reactivity → Angular signals).
- `src/app/ee2-shims/*`: stand-ins for EE2's Vue / Electron modules (`web/Config`, `background/IPC`,
  `TradeData`, `Prices`, `overlay/interfaces`); `prices.ts` contains EE2's `displayRounding` unchanged.
- `tests/ee2/**`: EE2 `renderer/specs`, copied unchanged except for skipped cases in languages without data
  here; `tests/ee2/vitest.setup.ts` is our stand-in for EE2's setup.
- `scripts/make-data-indexes.mjs`: port of `renderer/src/assets/make-index-files.mjs`.
- `public/data/{en,ru}/*`, `public/data/item-drop.json`: game data files and UI strings (`app_i18n.json`)
  from EE2 (derived from Path of Exile 2 game files, which belong to Grinding Gear Games).
- `addons/ee2-theme/**`: the "Exiled Exchange 2" theme, EE2's look (its components' markup and styles
  rewritten as Angular templates), `images/404.png` and the font files Fontin SmallCaps (Jos Buivenga,
  exljbris free font licence) and Exo 2 SemiBold (Natanael Gama, SIL OFL) from EE2; credits and EE2's
  licence in `addons/ee2-theme/README.md` and `LICENSE-exiled-exchange-2.txt`. EE2's Cyrillic font
  (FrizQuadrata ITC, commercial) is not included.

## Awakened PoE Trade

- Source: https://github.com/SnosMe/awakened-poe-trade
- License: MIT, © 2020 Alexander Drozdov (the same text as [src/lib/ee2/LICENSE](src/lib/ee2/LICENSE))

Used parts (ported to our own code through Price of Exile):

- `src/app/price-check/price-check.ts`, `trade-search.ts`: ports of the logic in `CheckedItem.vue` and
  `TradeListing.vue`;
  `src/app/price-check/bulk-search.ts`: port of the logic in `TradeBulk.vue` and `StackValue.vue`.
- `src/app/core/leagues.ts`: port of `renderer/src/web/background/Leagues.ts`.
- `src/app/core/ninja-prices.ts`: port of `background/Prices.ts`, the trend in `trends/PriceTrend.vue`
  and `related-items/RelatedItems.vue`; the poe.ninja tab also shows what `expected-value/DustValue.vue` shows.
- `src/app/core/item-links.ts`, `src/app/item-check/*`: port of `item-check/hotkeyable-actions.ts` and
  `item-check/ItemInfo.vue`; `src-tauri/src/stash.rs` and `clipboard.rs` `paste_text`: port of
  `main/src/shortcuts/text-box.ts` `stashSearch` and `HostClipboard.restoreShortly`.
- `src/app/map-check/*`: port of `MapCheck.vue`, `MapStatButton.vue`, `settings-maps.vue`,
  `SettingsMatcherEntry.vue`, `ui/ItemModifierText.vue` and `isMapLike` of `item-check/WidgetItemCheck.vue`.
- `src/app/settings/*`, `src/app/core/settings.ts`: port of `settings/SettingsWindow.vue`, `settings/HotkeyInput.vue`,
  `price-check/settings-price-check.vue` and the versioned config of `web/Config.ts` (`upgradeConfig`);
  `src-tauri/src/hotkeys.rs`: hotkeys from the settings, as `main/src/shortcuts/Shortcuts.ts`;
  `src-tauri/src/chat.rs`: port of `main/src/shortcuts/text-box.ts` `typeInChat` and `settings/chat.vue` defaults.
- `src/app/stash-search/*` and the Stash search section of the settings: port of `stash-search/WidgetStashSearch.vue`
  and `stash-search/stash-search-editor.vue`.
- `src-tauri/src/browser.rs`, the browser parts of `src/app/core/http.ts`: the idea of `main/src/proxy.ts`
  (requests with the browser's session) and `price-check/trade/TradeLinks.vue`; own implementation.
- `src/app/price-check/unidentified*.ts`: port of `price-check/unidentified-resolver/UnidentifiedResolver.vue`.
- `public/images/maven-witness.png`: APT image (from Path of Exile game art, which belongs to Grinding Gear Games).
