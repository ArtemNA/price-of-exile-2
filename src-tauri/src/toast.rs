//! The corner message: a small window in the corner of the primary screen's work area, shown
//! without taking focus for a few seconds (APT shows an "overlay is ready" notification). It tells
//! that the overlay started, or that a new version is out or being installed.

use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};

use crate::constants::{
    TOAST_DURATION, TOAST_MARGIN_LOGICAL, TOAST_MESSAGE_EVENT, TOAST_UPDATE_DURATION, TOAST_WAIT,
    TOAST_WAIT_STEP, TOAST_WINDOW,
};
use crate::platform::{self, Rect};

/// Each show restarts the timer; only the latest one hides the toast.
static SHOWN: AtomicU64 = AtomicU64::new(0);

pub fn init(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(TOAST_WINDOW) {
        platform::make_no_activate(window.hwnd()?.0 as platform::RawHwnd);
    }
    Ok(())
}

/// What the toast shows: `{ "kind": "start" }` or `{ "kind": "update", "version", "installing" }`.
/// Kept here, so the page can take it even if it loads after the request (the start message's
/// race, Price of Exile FINDINGS F-57 and F-62).
static MESSAGE: Mutex<Option<serde_json::Value>> = Mutex::new(None);

/// The message the toast shows unless asked for another one.
pub fn start_message() -> serde_json::Value {
    serde_json::json!({ "kind": "start" })
}

/// The message the toast page should show now.
pub fn message() -> serde_json::Value {
    MESSAGE
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
        .unwrap_or_else(start_message)
}

/// How long `message` stays: a found update asks for a click, so it stays longer.
fn duration(message: &serde_json::Value) -> Duration {
    if message["kind"] == "update" {
        TOAST_UPDATE_DURATION
    } else {
        TOAST_DURATION
    }
}

/// Shows `message` once the toast window exists (Price of Exile F-57), off the caller's thread.
pub fn show_when_ready(app: &AppHandle, message: serde_json::Value) {
    let duration = duration(&message);
    *MESSAGE.lock().unwrap_or_else(|e| e.into_inner()) = Some(message.clone());
    let app = app.clone();
    std::thread::spawn(move || {
        let started = std::time::Instant::now();
        while app.get_webview_window(TOAST_WINDOW).is_none() && started.elapsed() < TOAST_WAIT {
            std::thread::sleep(TOAST_WAIT_STEP);
        }
        if let Err(e) = app.emit_to(TOAST_WINDOW, TOAST_MESSAGE_EVENT, message) {
            log::warn!("Corner message not sent: {e}");
        }
        if let Err(e) = show(&app, duration) {
            log::warn!("Corner message not shown: {e}");
        }
    });
}

fn show(app: &AppHandle, duration: Duration) -> Result<(), String> {
    let window = app
        .get_webview_window(TOAST_WINDOW)
        .ok_or("no toast window")?;
    let monitor = window
        .primary_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("no primary monitor")?;
    let area = monitor.work_area();
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let margin = (TOAST_MARGIN_LOGICAL * monitor.scale_factor()).round() as i32;
    let rect = Rect {
        x: area.position.x + area.size.width as i32 - size.width as i32 - margin,
        y: area.position.y + area.size.height as i32 - size.height as i32 - margin,
        width: size.width as i32,
        height: size.height as i32,
    };
    let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as platform::RawHwnd;
    platform::show_no_activate(hwnd, rect);

    let id = SHOWN.fetch_add(1, Ordering::SeqCst) + 1;
    std::thread::spawn(move || {
        std::thread::sleep(duration);
        if SHOWN.load(Ordering::SeqCst) == id {
            platform::hide(hwnd);
        }
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_update_stays_longer_than_the_start_message() {
        assert_eq!(duration(&start_message()), TOAST_DURATION);
        let found = serde_json::json!({ "kind": "update", "version": "0.0.2", "installing": false });
        assert_eq!(duration(&found), TOAST_UPDATE_DURATION);
    }
}
