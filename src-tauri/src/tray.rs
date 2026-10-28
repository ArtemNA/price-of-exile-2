//! Tray icon (APT `main/src/tray.ts`): the app lives here; the settings window opens from it.

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

use crate::constants::{MAIN_WINDOW, TRAY_ID};
use crate::{browser, log_to_ui};

/// Shows the settings window (tray, a second launch, the first start).
pub fn show_settings(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// The tray menu with these labels (English until the page sends the interface language's).
fn menu(app: &AppHandle, labels: &TrayLabels) -> tauri::Result<Menu<tauri::Wry>> {
    let settings = MenuItem::with_id(app, "settings", &labels.settings, true, None::<&str>)?;
    let browser = MenuItem::with_id(app, "browser", &labels.browser, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", &labels.quit, true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    Menu::with_items(app, &[&settings, &browser, &separator, &quit])
}

#[derive(serde::Deserialize)]
pub struct TrayLabels {
    pub settings: String,
    pub browser: String,
    pub quit: String,
}

impl Default for TrayLabels {
    fn default() -> Self {
        Self {
            settings: "Settings".into(),
            browser: "Built-in browser".into(),
            quit: "Quit".into(),
        }
    }
}

/// New labels after the interface language changed.
pub fn set_labels(app: &AppHandle, labels: &TrayLabels) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_menu(Some(menu(app, labels)?))?;
    }
    Ok(())
}

pub fn init(app: &AppHandle) -> tauri::Result<()> {
    let menu = menu(app, &TrayLabels::default())?;

    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip(app.package_info().name.clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "settings" => show_settings(app),
            "browser" => {
                if let Err(e) = browser::open(app, None) {
                    log_to_ui(app, format!("Built-in browser: {e}"));
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_settings(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}
