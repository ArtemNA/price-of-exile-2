//! Global hotkeys. Like APT, they are registered only while the game is the foreground
//! window, so RegisterHotKey never steals keys from other applications. Which keys do what
//! comes from the settings (`set_hotkeys`), as APT `Shortcuts.updateActions` gets it from the config.

use std::collections::HashMap;
use std::str::FromStr;
use std::time::Instant;

use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Emitter, Manager, Wry};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::chat::{self, ChatCommand};
use crate::constants::{COPY_RELEASE_DELAY, ITEM_FIRST_LINES, MAIN_WINDOW, POPUP_WINDOW};
use crate::platform::{self, KeyAction, Point, Rect, vk};
use crate::state::AppState;
use crate::{browser, clipboard, log_to_ui, popup, stash};

/// What a hotkey does with the hovered item.
/// Declaration order is the priority when two actions share a hotkey.
#[derive(
    Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Debug, serde::Serialize, serde::Deserialize,
)]
#[serde(rename_all = "kebab-case")]
pub enum HotkeyAction {
    PriceCheck,
    ItemCheck,
    /// Open the item on the game wiki, PoEDB or Craft of Exile, or type it into the stash
    /// search, without showing the popup (APT `wikiKey` and the like).
    Wiki,
    Poedb,
    CraftOfExile,
    StashSearch,
    /// The stash search panel with the presets; copies nothing.
    StashPanel,
    /// Show the built-in browser, or hide it and go back to the game; copies nothing.
    Browser,
}

impl HotkeyAction {
    /// The popup the action shows, if any.
    fn target(self) -> Option<CheckTarget> {
        match self {
            HotkeyAction::PriceCheck => Some(CheckTarget::PriceCheck),
            HotkeyAction::ItemCheck => Some(CheckTarget::ItemCheck),
            HotkeyAction::StashPanel => Some(CheckTarget::StashSearch),
            _ => None,
        }
    }
}

/// What a registered hotkey is bound to.
#[derive(Clone)]
pub enum Binding {
    Item(HotkeyAction),
    Chat(ChatCommand),
    /// A stash search preset: its text goes into the stash search right away.
    Stash(String),
}

/// A chat command as the settings page sends it.
#[derive(serde::Deserialize)]
pub struct ChatHotkey {
    hotkey: Option<String>,
    #[serde(flatten)]
    command: ChatCommand,
}

/// A stash search preset with a hotkey, as the settings page sends it.
#[derive(serde::Deserialize)]
pub struct StashHotkey {
    hotkey: String,
    text: String,
}

/// Which popup a hotkey opens: a check of the hovered item (APT `copy-item` targets) or the
/// stash search panel.
#[derive(Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CheckTarget {
    PriceCheck,
    ItemCheck,
    StashSearch,
}

/// Virtual key of the hotkey's main key, when it is one we can name (letters, digits, F-keys, numpad).
fn code_vk(code: Code) -> Option<u16> {
    let name = code.to_string();
    let suffix = |prefix: &str| name.strip_prefix(prefix).map(str::to_owned);
    if let Some(letter) = suffix("Key").filter(|s| s.len() == 1) {
        return Some(letter.as_bytes()[0] as u16);
    }
    if let Some(digit) = suffix("Digit").and_then(|s| s.parse::<u16>().ok()) {
        return Some(0x30 + digit);
    }
    if let Some(digit) = suffix("Numpad").and_then(|s| s.parse::<u16>().ok()) {
        return Some(0x60 + digit);
    }
    if let Some(n) = suffix("F").and_then(|s| s.parse::<u16>().ok()) {
        return (1..=24).contains(&n).then_some(0x6F + n);
    }
    None
}

/// Keys of the hotkey that the user may still hold: released before we press our own,
/// otherwise the game sees e.g. Ctrl+D+C (APT `Shortcuts.register`).
fn held_keys(shortcut: &Shortcut) -> Vec<u16> {
    let modifiers = [
        (Modifiers::CONTROL, vk::CONTROL),
        (Modifiers::ALT, vk::MENU),
        (Modifiers::SHIFT, vk::SHIFT),
        (Modifiers::SUPER, vk::LWIN),
    ];
    code_vk(shortcut.key)
        .into_iter()
        .chain(
            modifiers
                .into_iter()
                .filter(|(modifier, _)| shortcut.mods.contains(*modifier))
                .map(|(_, key)| key),
        )
        .collect()
}

/// Release the hotkey, then press `copy_keys` and C: Ctrl+C, or Ctrl+Alt+C in Path of Exile 2
/// (APT and EE2 `pressKeysToCopyItemText`). Returns the presses and the release of `copy_keys`
/// apart, for `GameProfile::copy_release_delay` between them.
/// The copy keys always go down and up around C, so a pressed Alt is never a lone Alt tap that
/// would open the window menu, and is never left held.
fn copy_sequence(shortcut: &Shortcut, copy_keys: &[u16]) -> (Vec<KeyAction>, Vec<KeyAction>) {
    let press = held_keys(shortcut)
        .into_iter()
        .map(KeyAction::Up)
        .chain(copy_keys.iter().map(|&key| KeyAction::Down(key)))
        .chain([KeyAction::Down(vk::C), KeyAction::Up(vk::C)])
        .collect();
    let release = copy_keys
        .iter()
        .rev()
        .map(|&key| KeyAction::Up(key))
        .collect();
    (press, release)
}

/// The copy keys as a hotkey, when they are modifiers only: such a hotkey would catch the copy
/// itself, so it is reserved (EE2 `Shortcuts.updateActions`).
pub fn copy_shortcut(copy_keys: &[u16]) -> Option<Shortcut> {
    let mut mods = Modifiers::empty();
    for &key in copy_keys {
        mods |= match key {
            vk::CONTROL => Modifiers::CONTROL,
            vk::MENU => Modifiers::ALT,
            vk::SHIFT => Modifiers::SHIFT,
            _ => return None,
        };
    }
    Some(Shortcut::new(Some(mods), Code::KeyC))
}

/// Presses the copy keys, releasing them after `COPY_RELEASE_DELAY` (EE2: "Game was dropping the
/// release inputs").
fn press_copy_keys(app: &AppHandle, shortcut: &Shortcut) {
    let state = app.state::<AppState>();
    let (press, release) = copy_sequence(shortcut, &state.copy_keys());
    platform::send_keys(&press);
    std::thread::sleep(COPY_RELEASE_DELAY);
    platform::send_keys(&release);
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ItemTextPayload {
    target: CheckTarget,
    text: String,
    cursor: Point,
    game_rect: Rect,
    elapsed_ms: u128,
}

/// A hotkey that acts on the item without the popup; the popup page does the work.
#[derive(Clone, serde::Serialize)]
struct ItemActionPayload {
    action: HotkeyAction,
    text: String,
}

pub fn plugin() -> TauriPlugin<Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            let found = app
                .state::<AppState>()
                .hotkeys()
                .into_iter()
                .find(|(s, _)| s == shortcut);
            if let Some((shortcut, binding)) = found {
                warn_if_exclusive_fullscreen(app);
                // While the built-in browser is in front only its own hotkey acts: the others
                // would copy from or type into the page.
                let state = app.state::<AppState>();
                let game_in_front = state
                    .game_hwnd()
                    .is_some_and(|game| platform::current_foreground().hwnd == game);
                if !game_in_front && !matches!(binding, Binding::Item(HotkeyAction::Browser)) {
                    return;
                }
                let app = app.clone();
                // Clipboard polling and typing sleep, keep them off the event loop.
                std::thread::spawn(move || match binding {
                    Binding::Item(HotkeyAction::StashPanel) => open_stash_panel(&app),
                    Binding::Item(HotkeyAction::Browser) => {
                        let game = app.state::<AppState>().game_hwnd();
                        if let Err(e) = browser::toggle(&app, game) {
                            log_to_ui(&app, format!("Built-in browser: {e}"));
                        }
                    }
                    Binding::Item(action) => check_item(&app, &shortcut, action),
                    Binding::Chat(command) => chat_command(&app, &shortcut, &command),
                    Binding::Stash(text) => preset_search(&app, &shortcut, &text),
                });
            }
        })
        .build()
}

/// RegisterHotKey binds to a window owned by the main thread, so (un)register there.
fn set_registered(app: &AppHandle, shortcut: Shortcut, enabled: bool) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let gs = handle.global_shortcut();
        if enabled {
            if !gs.is_registered(shortcut) {
                if let Err(e) = gs.register(shortcut) {
                    log_to_ui(
                        &handle,
                        format!("Failed to register hotkey {shortcut}: {e}"),
                    );
                }
            }
        } else if gs.is_registered(shortcut) {
            let _ = gs.unregister(shortcut);
        }
    });
}

pub fn set_game_hotkeys(app: &AppHandle, enabled: bool) {
    for (shortcut, _) in app.state::<AppState>().hotkeys() {
        set_registered(app, shortcut, enabled);
    }
}

/// Parses the hotkeys from the settings. Returns the usable ones and a message for each
/// that does not parse or is `reserved`. A hotkey set twice works for the first use only (item
/// actions in declaration order, then chat commands, then stash presets); the settings page marks
/// such pairs itself.
pub fn parse_hotkeys(
    config: &HashMap<HotkeyAction, Option<String>>,
    commands: &[ChatHotkey],
    stash_presets: &[StashHotkey],
    reserved: Option<Shortcut>,
) -> (Vec<(Shortcut, Binding)>, Vec<String>) {
    let mut list: Vec<(Shortcut, Binding)> = Vec::new();
    let mut errors = Vec::new();
    let mut entries: Vec<_> = config
        .iter()
        .filter_map(|(action, text)| Some((*action, text.as_deref()?)))
        .collect();
    entries.sort_by_key(|(action, _)| *action);
    let bindings = entries
        .into_iter()
        .map(|(action, text)| (text, Binding::Item(action)))
        .chain(commands.iter().filter_map(|command| {
            Some((
                command.hotkey.as_deref()?,
                Binding::Chat(command.command.clone()),
            ))
        }))
        .chain(
            stash_presets
                .iter()
                .map(|preset| (preset.hotkey.as_str(), Binding::Stash(preset.text.clone()))),
        );
    for (text, binding) in bindings {
        match Shortcut::from_str(text) {
            Err(e) => errors.push(format!("{text}: {e}")),
            Ok(shortcut) if Some(shortcut) == reserved => {
                errors.push(format!("{text}: the game copies the item with it"));
            }
            Ok(shortcut) if list.iter().any(|(s, _)| *s == shortcut) => {}
            Ok(shortcut) => list.push((shortcut, binding)),
        }
    }
    (list, errors)
}

/// New hotkeys from the settings: unregister the old ones, register the new ones if the game is active.
pub fn set_hotkeys(
    app: &AppHandle,
    config: &HashMap<HotkeyAction, Option<String>>,
    commands: &[ChatHotkey],
    stash_presets: &[StashHotkey],
) -> Vec<String> {
    let state = app.state::<AppState>();
    let reserved = copy_shortcut(&state.copy_keys());
    let (list, errors) = parse_hotkeys(config, commands, stash_presets, reserved);
    let game_active = state.game_hwnd().is_some();
    for (shortcut, _) in state.replace_hotkeys(list.clone()) {
        set_registered(app, shortcut, false);
    }
    for (shortcut, _) in list {
        set_registered(app, shortcut, game_active);
    }
    errors
}

/// Exclusive fullscreen hides the overlay behind the game (APT warns the same way): say so in the
/// log and on the settings window.
fn warn_if_exclusive_fullscreen(app: &AppHandle) {
    let fullscreen = platform::exclusive_fullscreen();
    let _ = app.emit_to(MAIN_WINDOW, "exclusive-fullscreen", fullscreen);
    if fullscreen {
        log_to_ui(
            app,
            "The game runs in exclusive fullscreen: the overlay cannot show over it. Switch the game to Windowed Fullscreen.".into(),
        );
    }
}

fn chat_command(app: &AppHandle, shortcut: &Shortcut, command: &ChatCommand) {
    let Some(game) = app.state::<AppState>().game_hwnd() else {
        return;
    };
    if let Err(e) = chat::type_in_chat(game, command, &held_keys(shortcut)) {
        log_to_ui(app, format!("Chat command failed: {e}"));
    }
}

fn preset_search(app: &AppHandle, shortcut: &Shortcut, text: &str) {
    let Some(game) = app.state::<AppState>().game_hwnd() else {
        return;
    };
    if let Err(e) = stash::search(game, text, &held_keys(shortcut)) {
        log_to_ui(app, format!("Stash search failed: {e}"));
    }
}

/// The stash search panel: the popup with the presets, nothing is copied.
fn open_stash_panel(app: &AppHandle) {
    let Some(game) = app.state::<AppState>().game_hwnd() else {
        return;
    };
    let Some(game_rect) = platform::client_rect(game) else {
        return;
    };
    let cursor = platform::cursor_pos();
    let payload = ItemTextPayload {
        target: CheckTarget::StashSearch,
        text: String::new(),
        cursor,
        game_rect,
        elapsed_ms: 0,
    };
    let _ = app.emit_to(POPUP_WINDOW, "item-text", payload);
    popup::show(app, game_rect, cursor, CheckTarget::StashSearch);
}

fn check_item(app: &AppHandle, shortcut: &Shortcut, action: HotkeyAction) {
    let state = app.state::<AppState>();
    let Some(game) = state.game_hwnd() else {
        return;
    };
    if !state.try_begin_check() {
        return;
    }

    let cursor = platform::cursor_pos();
    let started = Instant::now();
    let result = clipboard::read_item_text(ITEM_FIRST_LINES, || press_copy_keys(app, shortcut));
    let elapsed_ms = started.elapsed().as_millis();
    state.end_check();

    let text = match result {
        Ok(text) => text,
        Err(e) => {
            log_to_ui(app, format!("{e} (after {elapsed_ms} ms)"));
            return;
        }
    };
    log_to_ui(app, format!("Item text read in {elapsed_ms} ms"));

    let Some(target) = action.target() else {
        let _ = app.emit_to(
            POPUP_WINDOW,
            "item-action",
            ItemActionPayload { action, text },
        );
        return;
    };
    let Some(game_rect) = platform::client_rect(game) else {
        log_to_ui(app, "Game window is gone".into());
        return;
    };
    let payload = ItemTextPayload {
        target,
        text,
        cursor,
        game_rect,
        elapsed_ms,
    };
    let _ = app.emit_to(POPUP_WINDOW, "item-text", payload);
    popup::show(app, game_rect, cursor, target);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(entries: &[(HotkeyAction, Option<&str>)]) -> HashMap<HotkeyAction, Option<String>> {
        entries
            .iter()
            .map(|(action, text)| (*action, text.map(str::to_owned)))
            .collect()
    }

    fn chat(hotkey: Option<&str>, text: &str) -> ChatHotkey {
        ChatHotkey {
            hotkey: hotkey.map(str::to_owned),
            command: ChatCommand {
                text: text.to_owned(),
                send: true,
            },
        }
    }

    #[test]
    fn parses_the_settings_format() {
        let (list, errors) = parse_hotkeys(
            &config(&[
                (HotkeyAction::PriceCheck, Some("Ctrl+KeyD")),
                (HotkeyAction::Wiki, Some("Alt+Shift+Digit1")),
                (HotkeyAction::Poedb, None),
            ]),
            &[chat(Some("F5"), "/hideout"), chat(None, "@last ty")],
            &[StashHotkey {
                hotkey: "Alt+Digit1".into(),
                text: "\"Map Tier\"".into(),
            }],
            None,
        );
        assert!(errors.is_empty(), "{errors:?}");
        assert_eq!(list.len(), 4);
        assert!(matches!(&list[3].1, Binding::Stash(text) if text == "\"Map Tier\""));
        let wiki = list
            .iter()
            .find(|(_, b)| matches!(b, Binding::Item(HotkeyAction::Wiki)))
            .unwrap()
            .0;
        assert_eq!(
            wiki,
            Shortcut::new(Some(Modifiers::ALT | Modifiers::SHIFT), Code::Digit1)
        );
        assert!(matches!(&list[2],
            (s, Binding::Chat(c)) if *s == Shortcut::new(None, Code::F5) && c.text == "/hideout"));
    }

    #[test]
    fn skips_bad_and_repeated_hotkeys() {
        let (list, errors) = parse_hotkeys(
            &config(&[
                (HotkeyAction::PriceCheck, Some("Ctrl+KeyD")),
                (HotkeyAction::ItemCheck, Some("Ctrl+KeyD")),
                (HotkeyAction::Wiki, Some("Ctrl+Nonsense")),
            ]),
            &[chat(Some("Ctrl+KeyD"), "/hideout")],
            &[],
            None,
        );
        assert_eq!(list.len(), 1);
        assert!(matches!(list[0].1, Binding::Item(HotkeyAction::PriceCheck)));
        assert_eq!(errors.len(), 1, "{errors:?}");
    }

    #[test]
    fn releases_every_held_key() {
        let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyD);
        assert_eq!(held_keys(&shortcut), vec![0x44, 0x11, 0x12]);
        assert_eq!(code_vk(Code::Digit7), Some(0x37));
        assert_eq!(code_vk(Code::F5), Some(0x74));
        assert_eq!(code_vk(Code::Numpad3), Some(0x63));
        assert_eq!(code_vk(Code::Space), None);
    }

    #[test]
    fn copy_sequence_poe1_is_ctrl_c() {
        use KeyAction::{Down, Up};
        let shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyD);
        let (press, release) = copy_sequence(&shortcut, &[vk::CONTROL]);
        assert_eq!(
            [press, release].concat(),
            vec![
                Up(0x44),
                Up(vk::CONTROL),
                Down(vk::CONTROL),
                Down(vk::C),
                Up(vk::C),
                Up(vk::CONTROL)
            ]
        );
    }

    #[test]
    fn copy_sequence_poe2_holds_the_advanced_key() {
        use KeyAction::{Down, Up};
        let shortcut = Shortcut::new(Some(Modifiers::ALT), Code::KeyD);
        let (press, release) = copy_sequence(&shortcut, &[vk::CONTROL, vk::MENU]);
        assert_eq!(
            press,
            vec![
                Up(0x44),
                Up(vk::MENU),
                Down(vk::CONTROL),
                Down(vk::MENU),
                Down(vk::C),
                Up(vk::C)
            ]
        );
        assert_eq!(release, vec![Up(vk::MENU), Up(vk::CONTROL)]);
    }

    #[test]
    fn the_copy_keys_are_reserved() {
        let ctrl_alt_c = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyC);
        assert_eq!(copy_shortcut(&[vk::CONTROL, vk::MENU]), Some(ctrl_alt_c));
        assert_eq!(
            copy_shortcut(&[vk::CONTROL]),
            Some(Shortcut::new(Some(Modifiers::CONTROL), Code::KeyC))
        );
        assert_eq!(copy_shortcut(&[vk::CONTROL, 0x5A]), None);

        let (list, errors) = parse_hotkeys(
            &config(&[
                (HotkeyAction::PriceCheck, Some("Ctrl+Alt+KeyC")),
                (HotkeyAction::ItemCheck, Some("Ctrl+KeyC")),
            ]),
            &[],
            &[],
            Some(ctrl_alt_c),
        );
        assert_eq!(list.len(), 1);
        assert!(matches!(list[0].1, Binding::Item(HotkeyAction::ItemCheck)));
        assert_eq!(errors.len(), 1, "{errors:?}");
    }
}
