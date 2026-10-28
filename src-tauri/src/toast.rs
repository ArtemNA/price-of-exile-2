//! The start message: a small window in the corner of the primary screen's work area, shown
//! without taking focus for a few seconds (APT shows an "overlay is ready" notification).

use std::sync::atomic::{AtomicU64, Ordering};

use tauri::{AppHandle, Manager};

use crate::constants::{
    TOAST_DURATION, TOAST_MARGIN_LOGICAL, TOAST_WAIT, TOAST_WAIT_STEP, TOAST_WINDOW,
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

/// Shows the start message once its window exists (FINDINGS F-57), off the caller's thread.
pub fn show_when_ready(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        let started = std::time::Instant::now();
        while app.get_webview_window(TOAST_WINDOW).is_none() && started.elapsed() < TOAST_WAIT {
            std::thread::sleep(TOAST_WAIT_STEP);
        }
        if let Err(e) = show(&app) {
            log::warn!("Start message not shown: {e}");
        }
    });
}

fn show(app: &AppHandle) -> Result<(), String> {
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
        std::thread::sleep(TOAST_DURATION);
        if SHOWN.load(Ordering::SeqCst) == id {
            platform::hide(hwnd);
        }
    });
    Ok(())
}
