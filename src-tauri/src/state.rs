use std::sync::Mutex;

use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use tauri_plugin_global_shortcut::Shortcut;

use crate::constants::{DEFAULT_GAME_TITLE, DEFAULT_TRADE_HOST, ENV_GAME_TITLE, ENV_KEEP_POPUP};
use crate::game_config;
use crate::hotkeys::Binding;
use crate::platform::RawHwnd;
use crate::popup::Placement;

pub struct AppState {
    game_title: Mutex<String>,
    /// Set from `ENV_GAME_TITLE`: the settings do not change the title then.
    game_title_fixed: bool,
    /// Hotkeys from the settings and what they do.
    hotkeys: Mutex<Vec<(Shortcut, Binding)>>,
    /// Foreground game window, 0 when the game is not active.
    game_hwnd: AtomicIsize,
    popup_hwnd: AtomicIsize,
    popup_visible: AtomicBool,
    /// The popup temporarily has keyboard focus (the user is typing into it).
    popup_focused: AtomicBool,
    /// Popup centred on the game rather than opposite to the cursor (settings).
    popup_centred: AtomicBool,
    /// Guards against a second price check while the clipboard is still being polled.
    busy: AtomicBool,
    placement: Mutex<Option<Placement>>,
    /// Trade site of the game language, where the built-in browser opens.
    trade_host: Mutex<String>,
    /// Keys held down while C copies the item (`game_config::copy_keys`).
    copy_keys: Mutex<Vec<u16>>,
    /// See `ENV_KEEP_POPUP`.
    pub keep_popup_on_blur: bool,
}

impl AppState {
    pub fn new() -> Self {
        let env_title = std::env::var(ENV_GAME_TITLE).ok();
        Self {
            game_title_fixed: env_title.is_some(),
            game_title: Mutex::new(env_title.unwrap_or_else(|| DEFAULT_GAME_TITLE.into())),
            hotkeys: Mutex::new(Vec::new()),
            game_hwnd: AtomicIsize::new(0),
            popup_hwnd: AtomicIsize::new(0),
            popup_visible: AtomicBool::new(false),
            popup_focused: AtomicBool::new(false),
            popup_centred: AtomicBool::new(true),
            busy: AtomicBool::new(false),
            placement: Mutex::new(None),
            trade_host: Mutex::new(DEFAULT_TRADE_HOST.into()),
            copy_keys: Mutex::new(game_config::default_copy_keys()),
            keep_popup_on_blur: std::env::var(ENV_KEEP_POPUP).is_ok_and(|v| v == "1"),
        }
    }

    pub fn trade_host(&self) -> String {
        self.trade_host.lock().unwrap().clone()
    }
    pub fn set_trade_host(&self, host: String) {
        *self.trade_host.lock().unwrap() = host;
    }

    pub fn copy_keys(&self) -> Vec<u16> {
        self.copy_keys.lock().unwrap().clone()
    }
    /// Returns whether they changed.
    pub fn set_copy_keys(&self, keys: Vec<u16>) -> bool {
        let mut current = self.copy_keys.lock().unwrap();
        let changed = *current != keys;
        *current = keys;
        changed
    }

    pub fn game_title(&self) -> String {
        self.game_title.lock().unwrap().clone()
    }
    /// Ignored when the title comes from `ENV_GAME_TITLE`.
    pub fn set_game_title(&self, title: String) {
        if !self.game_title_fixed {
            *self.game_title.lock().unwrap() = title;
        }
    }

    pub fn hotkeys(&self) -> Vec<(Shortcut, Binding)> {
        self.hotkeys.lock().unwrap().clone()
    }
    /// Returns the previous list.
    pub fn replace_hotkeys(&self, list: Vec<(Shortcut, Binding)>) -> Vec<(Shortcut, Binding)> {
        std::mem::replace(&mut *self.hotkeys.lock().unwrap(), list)
    }
    pub fn is_game_window(&self, title: &str) -> bool {
        *self.game_title.lock().unwrap() == title
    }

    pub fn game_hwnd(&self) -> Option<RawHwnd> {
        Some(self.game_hwnd.load(Ordering::SeqCst)).filter(|h| *h != 0)
    }
    pub fn set_game_hwnd(&self, hwnd: Option<RawHwnd>) {
        self.game_hwnd.store(hwnd.unwrap_or(0), Ordering::SeqCst);
    }

    pub fn popup_hwnd(&self) -> RawHwnd {
        self.popup_hwnd.load(Ordering::SeqCst)
    }
    pub fn set_popup_hwnd(&self, hwnd: RawHwnd) {
        self.popup_hwnd.store(hwnd, Ordering::SeqCst);
    }

    pub fn popup_visible(&self) -> bool {
        self.popup_visible.load(Ordering::SeqCst)
    }
    pub fn set_popup_visible(&self, visible: bool) {
        self.popup_visible.store(visible, Ordering::SeqCst);
    }

    pub fn popup_focused(&self) -> bool {
        self.popup_focused.load(Ordering::SeqCst)
    }
    pub fn set_popup_focused(&self, focused: bool) {
        self.popup_focused.store(focused, Ordering::SeqCst);
    }

    pub fn placement(&self) -> Option<Placement> {
        *self.placement.lock().unwrap()
    }
    pub fn set_placement(&self, placement: Placement) {
        *self.placement.lock().unwrap() = Some(placement);
    }

    pub fn popup_centred(&self) -> bool {
        self.popup_centred.load(Ordering::SeqCst)
    }
    pub fn set_popup_centred(&self, centred: bool) {
        self.popup_centred.store(centred, Ordering::SeqCst);
    }

    /// Returns false if a check is already running.
    pub fn try_begin_check(&self) -> bool {
        !self.busy.swap(true, Ordering::SeqCst)
    }
    pub fn end_check(&self) {
        self.busy.store(false, Ordering::SeqCst);
    }
}
