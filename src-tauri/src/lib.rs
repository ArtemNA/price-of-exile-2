//! Rust host of Price of Exile 2: hotkeys, clipboard, popup windows, built-in browser, tray.
//! Taken from Price of Exile (PoE1) and changed for Path of Exile 2; each app keeps its own copy.

mod browser;
mod chat;
mod clipboard;
mod constants;
mod game_config;
mod hotkeys;
mod platform;
mod popup;
mod stash;
mod state;
mod test_trigger;
mod toast;
mod tray;

use std::collections::HashMap;

use tauri::{AppHandle, Emitter, Manager, WindowEvent};

use constants::{
    BROWSER_HOSTS, BROWSER_WINDOW, DEV_IDENTIFIER_SUFFIX, ENV_TEST_INSTANCE, ENV_TEST_TRIGGER,
    FOREGROUND_WATCHDOG_PERIOD, LOG_MAX_BYTES, MAIN_WINDOW,
};
use platform::ForegroundInfo;
use state::AppState;

pub(crate) fn log_to_ui(app: &AppHandle, message: String) {
    log::info!("{message}");
    let _ = app.emit_to(MAIN_WINDOW, "log", message);
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ForegroundPayload {
    title: String,
    is_game: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Status {
    game_title: String,
    game_active: bool,
}

pub(crate) fn on_foreground(app: &AppHandle, info: ForegroundInfo) {
    let state = app.state::<AppState>();
    if info.is_own_process && info.hwnd == state.popup_hwnd() {
        // Expected only while the user types into the popup; otherwise it is WS_EX_NOACTIVATE.
        // Windows still lets a click activate it right after our own main window was in front
        // (FINDINGS F-44): give the keyboard straight back to the game.
        if !state.popup_focused() {
            log_to_ui(
                app,
                "WARNING: popup became the foreground window, focusing the game".into(),
            );
            if let Some(game) = state.game_hwnd() {
                platform::focus(game);
            }
        }
        // Keep the game state as is.
        return;
    }
    if info.is_own_process && Some(info.hwnd) == browser::hwnd(app) {
        // The built-in browser in front of the game: keep the game as "active" so the browser
        // hotkey can bring the user back (hotkeys check the foreground before acting).
        if state.popup_visible() {
            popup::hide(app, false);
        }
        return;
    }

    let is_game = !info.is_own_process && state.is_game_window(&info.title);
    state.set_game_hwnd(is_game.then_some(info.hwnd));
    if is_game {
        // Clicked back into the game while typing in the popup: popup stops taking focus.
        popup::release_focus(app, false);
    }

    let _ = app.emit_to(
        MAIN_WINDOW,
        "foreground",
        ForegroundPayload {
            title: info.title,
            is_game,
        },
    );
    // Every time, not only when the game state flips: a registration that failed is retried.
    hotkeys::sync_game_hotkeys(app);
    if !is_game && state.popup_visible() && !state.keep_popup_on_blur {
        popup::hide(app, false);
    }
}

/// Whether the game state the app keeps no longer matches the window in front, i.e. a
/// foreground event was missed or handled out of order. The popup and the built-in browser in
/// front keep the game state as it is (see `on_foreground`), so they never count.
fn game_state_is_stale(
    game: Option<platform::RawHwnd>,
    front: &ForegroundInfo,
    front_is_game: bool,
    popup: platform::RawHwnd,
    browser: Option<platform::RawHwnd>,
) -> bool {
    if front.is_own_process && (front.hwnd == popup || Some(front.hwnd) == browser) {
        return false;
    }
    let expected = (front_is_game && !front.is_own_process).then_some(front.hwnd);
    game != expected
}

/// Every `FOREGROUND_WATCHDOG_PERIOD`: put right a game state that disagrees with the window in
/// front, and retry hotkeys another app held. The price check otherwise stayed dead until the
/// next alt-tab.
fn watch_game_state(app: AppHandle) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(FOREGROUND_WATCHDOG_PERIOD);
            let state = app.state::<AppState>();
            let front = platform::current_foreground();
            let front_is_game = state.is_game_window(&front.title);
            let stale = game_state_is_stale(
                state.game_hwnd(),
                &front,
                front_is_game,
                state.popup_hwnd(),
                browser::hwnd(&app),
            );
            if stale {
                log_to_ui(
                    &app,
                    format!(
                        "[focus] game state was out of date (game {}, in front: game {}), fixed",
                        if state.game_hwnd().is_some() {
                            "active"
                        } else {
                            "inactive"
                        },
                        if front_is_game { "yes" } else { "no" },
                    ),
                );
                on_foreground(&app, front);
            } else if state.game_hwnd().is_some() {
                hotkeys::sync_game_hotkeys(&app);
            }
        }
    });
}

#[tauri::command]
fn get_status(state: tauri::State<AppState>) -> Status {
    Status {
        game_title: state.game_title(),
        game_active: state.game_hwnd().is_some(),
    }
}

/// Settings the host needs (APT `update-host-config`): game window title, hotkeys, chat commands
/// and stash search presets, where the popup goes ("center" or "opposite-cursor"), and the
/// advanced descriptions key that overrides the game config ("Alt", "Shift", "Ctrl"; none: read
/// the config). Returns a message for every hotkey that cannot be used.
#[tauri::command]
fn set_host_config(
    app: AppHandle,
    game_title: String,
    hotkeys: HashMap<hotkeys::HotkeyAction, Option<String>>,
    commands: Vec<hotkeys::ChatHotkey>,
    stash_presets: Vec<hotkeys::StashHotkey>,
    popup_position: String,
    copy_key: Option<String>,
) -> Vec<String> {
    let state = app.state::<AppState>();
    state.set_game_title(game_title.trim().to_string());
    state.set_popup_centred(popup_position != "opposite-cursor");
    let mut errors = Vec::new();
    let copy_key_override = copy_key.and_then(|name| {
        let key = game_config::override_key(&name);
        if key.is_none() {
            errors.push(format!(
                "Copy key {name:?}: unknown, the game config is used"
            ));
        }
        key
    });
    state.set_copy_key_override(copy_key_override);
    // The user may have changed the key in the game since.
    refresh_copy_keys(&app, false);
    errors.extend(hotkeys::set_hotkeys(
        &app,
        &hotkeys,
        &commands,
        &stash_presets,
    ));
    // The title may now match (or no longer match) the window in front.
    on_foreground(&app, platform::current_foreground());
    errors
}

/// Reads the copy keys (the settings' override, else the game config) and logs them on the first
/// read and when they changed. Returns whether the keys changed.
fn refresh_copy_keys(app: &AppHandle, first: bool) -> bool {
    let state = app.state::<AppState>();
    let copy = game_config::copy_keys(state.copy_key_override());
    let description = copy.describe();
    let previous = state.set_copy_keys(copy.clone());
    if previous != copy || first {
        log_to_ui(app, format!("Copy keys: {description}"));
    }
    previous.keys != copy.keys
}

/// The copy keys for the settings page.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CopyKeysStatus {
    /// "Ctrl+Alt+C".
    keys: String,
    source: game_config::CopyKeysSource,
    /// The config file, or why it was not read.
    detail: String,
    /// They differ from the last read: the page sends its hotkeys again, so the new copy keys are
    /// refused as a hotkey and the old ones allowed.
    changed: bool,
}

/// Reads the copy keys again (the user may have rebound the key in the game) and returns them.
#[tauri::command]
fn get_copy_keys(app: AppHandle) -> CopyKeysStatus {
    let changed = refresh_copy_keys(&app, false);
    let copy = app.state::<AppState>().copy_keys_info();
    CopyKeysStatus {
        keys: game_config::describe(&copy.keys),
        source: copy.source,
        detail: copy.detail,
        changed,
    }
}

#[tauri::command]
fn hide_popup(app: AppHandle) {
    popup::hide(&app, true);
}

/// The user clicked an input in the popup: it takes the keyboard.
#[tauri::command]
fn popup_focus_input(app: AppHandle) -> bool {
    let focused = popup::focus_for_input(&app);
    if !focused {
        log_to_ui(&app, "Could not give the popup keyboard focus".into());
    }
    focused
}

/// Typing is done: keyboard back to the game, popup back to no-activate.
#[tauri::command]
fn popup_release_focus(app: AppHandle) {
    popup::release_focus(&app, true);
}

/// The popup page asks for a size that fits its content, in logical pixels, for the check it
/// measured (`target`); returns the popup's side of the game ("left", "right", "center") for a
/// theme laying things out beside its column.
#[tauri::command]
fn fit_popup(app: AppHandle, target: hotkeys::CheckTarget, width: f64, height: f64) -> &'static str {
    popup::fit(&app, target, width, height)
}

/// Exiled Exchange 2's settings file (`%APPDATA%\exiled-exchange-2\apt-data\config.json`), for the
/// "Import from Exiled Exchange 2" buttons; None when EE2 is not installed. Only read, never written.
#[tauri::command]
fn read_ee2_config() -> Option<String> {
    let dir = std::env::var_os("APPDATA")?;
    let path = std::path::Path::new(&dir).join(constants::EE2_CONFIG_PATH);
    std::fs::read_to_string(path).ok()
}

/// A trade request through the built-in browser's page (its cookies, Cloudflare clearance).
#[tauri::command]
async fn browser_fetch(
    app: AppHandle,
    request: browser::BrowserRequest,
) -> Result<browser::BrowserResponse, String> {
    tauri::async_runtime::spawn_blocking(move || browser::fetch(&app, request))
        .await
        .map_err(|e| e.to_string())?
}

/// The portable build is the bare exe, without the installer's uninstaller next to it:
/// it cannot update itself, so the page only links to the new release.
/// Test instance only (`test_trigger`): the page listens for the test's clicks.
#[tauri::command]
fn is_test_instance() -> bool {
    platform::is_test_instance()
}

/// Test instance only: what the page reports for the test (`test-text`).
#[tauri::command]
fn test_log(app: AppHandle, text: String) {
    if platform::is_test_instance() {
        log_to_ui(&app, text);
    }
}

#[tauri::command]
fn is_portable() -> bool {
    std::env::current_exe()
        .ok()
        .and_then(|exe| {
            exe.parent()
                .map(|dir| dir.join(constants::INSTALLER_UNINSTALLER))
        })
        .is_none_or(|uninstaller| !uninstaller.exists())
}

/// The corner message: the start message, or a new version found (`{ "kind": "update", ... }`).
#[tauri::command]
fn show_toast(app: AppHandle, message: Option<serde_json::Value>) {
    toast::show_when_ready(&app, message.unwrap_or_else(toast::start_message));
}

/// What the toast page shows (it may load after `show_toast` asked for it).
#[tauri::command]
fn toast_message() -> serde_json::Value {
    toast::message()
}

/// The trade site of the game language (www. or ru.pathofexile.com) for the built-in browser.
#[tauri::command]
fn set_trade_host(app: AppHandle, host: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    if !BROWSER_HOSTS.contains(&host.as_str()) {
        return Err(format!("not a trade site: {host}"));
    }
    state.set_trade_host(host);
    Ok(())
}

/// Tray menu labels in the interface language.
#[tauri::command]
fn set_tray_labels(app: AppHandle, labels: tray::TrayLabels) -> Result<(), String> {
    tray::set_labels(&app, &labels).map_err(|e| e.to_string())
}

/// The settings window (a click on the start message).
#[tauri::command]
fn open_settings(app: AppHandle) {
    tray::show_settings(&app);
}

/// Shows the built-in browser, on `url` if given.
#[tauri::command]
async fn browser_open(app: AppHandle, url: Option<String>) -> Result<(), String> {
    browser::open(&app, url.as_deref())
}

/// "Find in stash": hide the popup and type `text` into the game's stash search.
#[tauri::command]
fn stash_search(app: AppHandle, text: String) -> Result<(), String> {
    let Some(game) = app.state::<AppState>().game_hwnd() else {
        return Err("The game is not active".into());
    };
    popup::hide(&app, true);
    // Waits for the keyboard and the clipboard: keep it off the event loop.
    std::thread::spawn(move || {
        if let Err(e) = stash::search(game, &text, &[]) {
            log_to_ui(&app, format!("Stash search failed: {e}"));
        }
    });
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if cfg!(debug_assertions) && std::env::var(ENV_TEST_INSTANCE).is_ok_and(|v| v == "1") {
        platform::set_test_instance();
    }
    let context = tauri::generate_context!();
    let mut builder = tauri::Builder::default()
        // First: a second launch only brings up the settings of the running one.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            tray::show_settings(app);
        }))
        .plugin(tauri_plugin_opener::init());
    // The updater fails to start without its config (`plugins.updater` in tauri.conf.json).
    if context.config().plugins.0.contains_key("updater") {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }
    builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AppState::new())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .max_file_size(LOG_MAX_BYTES)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
                .build(),
        )
        .plugin(hotkeys::plugin())
        .invoke_handler(tauri::generate_handler![
            get_status,
            get_copy_keys,
            set_host_config,
            show_toast,
            toast_message,
            set_tray_labels,
            set_trade_host,
            is_portable,
            is_test_instance,
            test_log,
            open_settings,
            browser_fetch,
            browser_open,
            read_ee2_config,
            hide_popup,
            popup_focus_input,
            popup_release_focus,
            stash_search,
            fit_popup
        ])
        .setup(|app| {
            let identifier = &app.config().identifier;
            if cfg!(debug_assertions) && !identifier.ends_with(DEV_IDENTIFIER_SUFFIX) {
                return Err(format!(
                    "debug build with the release identifier {identifier}: start it with `npm run dev`, so it does not use the settings of an installed release"
                )
                .into());
            }
            let handle = app.handle().clone();
            refresh_copy_keys(&handle, true);
            popup::init(&handle)?;
            // A tray icon of a test instance would show on the user's taskbar.
            if !platform::is_test_instance() {
                tray::init(&handle)?;
            }
            toast::init(&handle)?;
            // The settings window starts hidden (the app lives in the tray); the page shows it on
            // the first start. Dev builds show it right away.
            if cfg!(debug_assertions) {
                tray::show_settings(&handle);
            }

            let watcher_handle = handle.clone();
            platform::watch_foreground(move |info| on_foreground(&watcher_handle, info));
            on_foreground(&handle, platform::current_foreground());
            watch_game_state(handle.clone());
            if platform::is_test_instance()
                && let Ok(path) = std::env::var(ENV_TEST_TRIGGER)
            {
                test_trigger::watch(handle.clone(), path.into());
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the settings window keeps the app running in the tray; Quit is in its menu.
            if window.label() == MAIN_WINDOW {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            // Closing the built-in browser only hides it: its page keeps serving trade requests.
            if window.label() == BROWSER_WINDOW {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(context)
        .expect("error while building tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn front(hwnd: platform::RawHwnd, own: bool) -> ForegroundInfo {
        ForegroundInfo {
            hwnd,
            title: String::new(),
            is_own_process: own,
        }
    }

    #[test]
    fn game_in_front_but_believed_inactive_is_stale() {
        // The price check hotkey is registered but ignored: the state says the game is not active.
        assert!(game_state_is_stale(None, &front(7, false), true, 1, None));
    }

    #[test]
    fn other_window_in_front_but_believed_game_is_stale() {
        assert!(game_state_is_stale(
            Some(7),
            &front(9, false),
            false,
            1,
            None
        ));
    }

    #[test]
    fn matching_state_is_not_stale() {
        assert!(!game_state_is_stale(
            Some(7),
            &front(7, false),
            true,
            1,
            None
        ));
        assert!(!game_state_is_stale(None, &front(9, false), false, 1, None));
    }

    #[test]
    fn popup_or_browser_in_front_keep_the_game_state() {
        assert!(!game_state_is_stale(
            Some(7),
            &front(1, true),
            false,
            1,
            Some(2)
        ));
        assert!(!game_state_is_stale(
            Some(7),
            &front(2, true),
            false,
            1,
            Some(2)
        ));
    }

    #[test]
    fn own_settings_window_in_front_is_not_the_game() {
        assert!(game_state_is_stale(
            Some(7),
            &front(3, true),
            false,
            1,
            Some(2)
        ));
    }
}
