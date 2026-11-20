//! Test instance only (`ENV_TEST_INSTANCE`): a test on a hidden desktop drives the app through a
//! command file (`ENV_TEST_TRIGGER`), because real keys and a real foreground window exist only on
//! the user's desktop (FINDINGS F-37). A crutch for tests, never used by a release. One command per line:
//!   front <window title>        that window is now in front, and the app hears of it
//!   front-missed <window title> the same, but the foreground event is lost (the watchdog must notice)
//!   front none | front-missed none
//!   item <path>                 the item text the next check takes instead of copying it
//!   hotkey <shortcut>           the hotkey was pressed (`Ctrl+Alt+Shift+F20`, `Shift+Space`), past
//!                               RegisterHotKey: the same handler as a real press
//! Each command is logged as "[test] <command>".

use std::path::PathBuf;
use std::str::FromStr;

use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::Shortcut;

use crate::constants::TEST_TRIGGER_PERIOD;
use crate::state::AppState;
use crate::{hotkeys, log_to_ui, on_foreground, platform};

pub fn watch(app: AppHandle, path: PathBuf) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(TEST_TRIGGER_PERIOD);
            let Ok(text) = std::fs::read_to_string(&path) else {
                continue;
            };
            let _ = std::fs::remove_file(&path);
            for line in text.lines().map(str::trim).filter(|l| !l.is_empty()) {
                log_to_ui(&app, format!("[test] {line}"));
                if let Err(e) = run(&app, line) {
                    log_to_ui(&app, format!("[test] {line}: {e}"));
                }
            }
        }
    });
}

fn run(app: &AppHandle, line: &str) -> Result<(), String> {
    let (command, arg) = line.split_once(' ').unwrap_or((line, ""));
    match command {
        "front" | "front-missed" => {
            let hwnd = if arg == "none" {
                0
            } else {
                platform::find_window(arg).ok_or("no such window")?
            };
            platform::set_test_foreground(hwnd);
            if command == "front" {
                on_foreground(app, platform::current_foreground());
            }
        }
        "item" => {
            let text = std::fs::read_to_string(arg).map_err(|e| e.to_string())?;
            app.state::<AppState>().set_test_item_text(text);
        }
        "hotkey" => {
            let shortcut = Shortcut::from_str(arg).map_err(|e| e.to_string())?;
            hotkeys::on_hotkey(app, &shortcut);
        }
        _ => return Err("unknown command".into()),
    }
    Ok(())
}
