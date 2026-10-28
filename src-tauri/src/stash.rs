//! Typing into the game's stash search. Port of APT `text-box.ts` `stashSearch`.

use crate::clipboard;
use crate::constants::STASH_SEARCH_FOCUS_DELAY;
use crate::platform::{self, KeyAction, RawHwnd, vk};

fn tap(key: u16, ctrl: bool) -> Vec<KeyAction> {
    let mut keys = vec![KeyAction::Down(key), KeyAction::Up(key)];
    if ctrl {
        keys.insert(0, KeyAction::Down(vk::CONTROL));
        keys.push(KeyAction::Up(vk::CONTROL));
    }
    keys
}

/// Ctrl+F (focus the search box), Ctrl+V (`text` from the clipboard), Enter.
/// `release`: keys of the hotkey that may still be held (Alt+1 would make Ctrl+F Ctrl+Alt+F).
pub fn search(game: RawHwnd, text: &str, release: &[u16]) -> Result<(), String> {
    // The popup may just have handed the keyboard back: let the game take it first.
    std::thread::sleep(STASH_SEARCH_FOCUS_DELAY);
    if platform::current_foreground().hwnd != game {
        return Err("the game is not the foreground window".into());
    }
    clipboard::paste_text(text, || {
        let released = release.iter().map(|&key| KeyAction::Up(key)).collect();
        let keys = [
            released,
            tap(vk::F, true),
            tap(vk::V, true),
            tap(vk::RETURN, false),
        ]
        .concat();
        platform::send_keys(&keys);
    })
}
