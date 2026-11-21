//! Test instance only (`ENV_TEST_INSTANCE`): a test on a hidden desktop drives the app through a
//! command file (`ENV_TEST_TRIGGER`), because real keys and a real foreground window exist only on
//! the user's desktop (FINDINGS F-37). A crutch for tests, never used by a release. One command per line:
//!   front <window title>        that window is now in front, and the app hears of it
//!   front-missed <window title> the same, but the foreground event is lost (the watchdog must notice)
//!   front none | front-missed none
//!   item <path>                 the item text the next check takes instead of copying it
//!   hotkey <shortcut>           the hotkey was pressed (`Ctrl+Alt+Shift+F20`, `Shift+Space`), past
//!                               RegisterHotKey: the same handler as a real press
//!   click <window> <selector>   the page of that window (`popup`, `main`) clicks the element
//!   text <window> <selector>    the page writes the elements' text into the log ("[test] text …")
//!   rect <window> <selector>    the page writes where the element stands ("[test] rect …: left top right bottom")
//!   hover <window> <selector>   the pointer enters the element (`mouseenter` + `mousemove` sent by the page)
//!   hover-shift <window> <sel>  the same with Shift held (`shiftKey` of the mouse events)
//!   unhover <window> <selector> the pointer leaves it (`mouseleave`)
//!   trade <search.json> <fetch.json>  the popup takes these trade site answers instead of asking the site
//!   backdrop <window> <file>    the page draws this picture (a `data:` URL in the file) under itself,
//!                               where a real game would show through its transparent parts (screenshots)
//! Each command is logged as "[test] <command>".

use std::path::PathBuf;
use std::str::FromStr;

use tauri::{AppHandle, Emitter, Manager};
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
        "click" | "text" | "rect" | "hover" | "hover-shift" | "unhover" => {
            let (window, selector) = arg.split_once(' ').ok_or("expected: <window> <selector>")?;
            let event = format!("test-{command}");
            app.emit_to(window, &event, selector).map_err(|e| e.to_string())?;
        }
        "trade" => {
            let (search, fetch) = arg.split_once(' ').ok_or("expected: <search.json> <fetch.json>")?;
            let read = |path: &str| std::fs::read_to_string(path).map_err(|e| format!("{path}: {e}"));
            let payload = serde_json::json!({ "search": read(search)?, "fetch": read(fetch)? });
            app.emit_to(crate::constants::POPUP_WINDOW, "test-trade", payload).map_err(|e| e.to_string())?;
        }
        "backdrop" => {
            let (window, path) = arg.split_once(' ').ok_or("expected: <window> <file>")?;
            let url = std::fs::read_to_string(path).map_err(|e| format!("{path}: {e}"))?;
            app.emit_to(window, "test-backdrop", url.trim()).map_err(|e| e.to_string())?;
        }
        _ => return Err("unknown command".into()),
    }
    Ok(())
}
