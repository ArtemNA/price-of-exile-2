//! Chat commands: typing a text into the game chat by a hotkey. Port of APT `text-box.ts` `typeInChat`.

use crate::clipboard;
use crate::constants::{CHAT_AUTO_CLEAR, CHAT_PLACEHOLDER_LAST};
use crate::platform::{self, KeyAction, RawHwnd, vk};

/// A chat command from the settings.
#[derive(Clone, serde::Deserialize)]
pub struct ChatCommand {
    pub text: String,
    /// Press Enter after pasting (APT `send`).
    pub send: bool,
}

fn tap(key: u16) -> [KeyAction; 2] {
    [KeyAction::Down(key), KeyAction::Up(key)]
}

fn ctrl_tap(key: u16) -> [KeyAction; 4] {
    [
        KeyAction::Down(vk::CONTROL),
        KeyAction::Down(key),
        KeyAction::Up(key),
        KeyAction::Up(vk::CONTROL),
    ]
}

/// What goes on the clipboard and which keys type it, as APT does:
/// - `@last text`: Ctrl+Enter opens the chat to the last whisper, the text follows;
/// - `text @last`: Ctrl+Enter, then Home and Delete turn "@name " into "name ", the text goes before it
///   (`/invite @last` → `/invite name`);
/// - anything else: Enter opens the chat; Ctrl+A replaces what is already typed there, except when
///   the text starts with a channel or command character, which the game clears by itself.
///
/// With `send`, Enter sends it; then Enter, Up, Up, Esc bring back the last chat the user had.
pub fn chat_keys(text: &str, send: bool) -> (String, Vec<KeyAction>) {
    let mut keys = Vec::new();
    let paste_text = if let Some(rest) = text.strip_prefix(&format!("{CHAT_PLACEHOLDER_LAST} ")) {
        keys.extend(ctrl_tap(vk::RETURN));
        rest.to_owned()
    } else if let Some(rest) = text.strip_suffix(CHAT_PLACEHOLDER_LAST) {
        keys.extend(ctrl_tap(vk::RETURN));
        // Twice: the first Home only focuses the input with a controller.
        keys.extend(tap(vk::HOME));
        keys.extend(tap(vk::HOME));
        keys.extend(tap(vk::DELETE));
        rest.to_owned()
    } else {
        keys.extend(tap(vk::RETURN));
        if !text.starts_with(CHAT_AUTO_CLEAR) {
            keys.extend(ctrl_tap(vk::A));
        }
        text.to_owned()
    };
    keys.extend(ctrl_tap(vk::V));
    if send {
        keys.extend(tap(vk::RETURN));
        keys.extend(tap(vk::RETURN));
        keys.extend(tap(vk::UP));
        keys.extend(tap(vk::UP));
        keys.extend(tap(vk::ESCAPE));
    }
    (paste_text, keys)
}

/// Types `command` into the game chat. `release`: keys of the hotkey that may still be held.
pub fn type_in_chat(game: RawHwnd, command: &ChatCommand, release: &[u16]) -> Result<(), String> {
    if platform::current_foreground().hwnd != game {
        return Err("the game is not the foreground window".into());
    }
    let (text, keys) = chat_keys(&command.text, command.send);
    let released: Vec<KeyAction> = release.iter().map(|&key| KeyAction::Up(key)).collect();
    clipboard::paste_text(&text, || platform::send_keys(&[released, keys].concat()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(keys: &[KeyAction]) -> String {
        keys.iter()
            .filter_map(|key| match key {
                KeyAction::Down(vk) => Some(match *vk {
                    vk::CONTROL => "Ctrl".to_owned(),
                    vk::RETURN => "Enter".to_owned(),
                    vk::HOME => "Home".to_owned(),
                    vk::DELETE => "Del".to_owned(),
                    vk::UP => "Up".to_owned(),
                    vk::ESCAPE => "Esc".to_owned(),
                    other => (other as u8 as char).to_string(),
                }),
                KeyAction::Up(_) => None,
            })
            .collect::<Vec<_>>()
            .join(" ")
    }

    #[test]
    fn command_opens_the_chat_and_sends() {
        let (text, keys) = chat_keys("/hideout", true);
        assert_eq!(text, "/hideout");
        assert_eq!(names(&keys), "Enter Ctrl V Enter Enter Up Up Esc");
    }

    #[test]
    fn plain_text_replaces_what_is_typed() {
        let (text, keys) = chat_keys("thanks", false);
        assert_eq!(text, "thanks");
        assert_eq!(names(&keys), "Enter Ctrl A Ctrl V");
    }

    #[test]
    fn last_whisper_before_and_after() {
        let (text, keys) = chat_keys("@last ty", true);
        assert_eq!(text, "ty");
        assert_eq!(names(&keys), "Ctrl Enter Ctrl V Enter Enter Up Up Esc");
        let (text, keys) = chat_keys("/invite @last", true);
        assert_eq!(text, "/invite ");
        assert_eq!(
            names(&keys),
            "Ctrl Enter Home Home Del Ctrl V Enter Enter Up Up Esc"
        );
    }
}
