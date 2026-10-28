//! All WinAPI calls live here, so other modules stay platform-agnostic.

use std::path::PathBuf;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicBool, AtomicIsize, AtomicU32, Ordering};

use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
use windows::Win32::Graphics::Gdi::{ClientToScreen, MONITOR_DEFAULTTONEAREST, MonitorFromWindow};
use windows::Win32::System::Com::CoTaskMemFree;
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
use windows::Win32::UI::Accessibility::{HWINEVENTHOOK, SetWinEventHook};
use windows::Win32::UI::HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    INPUT, INPUT_0, INPUT_KEYBOARD, KEYBD_EVENT_FLAGS, KEYBDINPUT, KEYEVENTF_EXTENDEDKEY,
    KEYEVENTF_KEYUP, MAPVK_VK_TO_VSC, MapVirtualKeyW, SendInput, VIRTUAL_KEY, VK_ESCAPE,
};
use windows::Win32::UI::Shell::{
    FOLDERID_Documents, KNOWN_FOLDER_FLAG, QUNS_RUNNING_D3D_FULL_SCREEN, SHGetKnownFolderPath,
    SHQueryUserNotificationState,
};
use windows::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, CallNextHookEx, DispatchMessageW, EVENT_SYSTEM_FOREGROUND, GWL_EXSTYLE,
    GetClientRect, GetCursorPos, GetForegroundWindow, GetMessageW, GetWindowLongPtrW,
    GetWindowRect, GetWindowTextW, GetWindowThreadProcessId, HC_ACTION, HWND_TOPMOST,
    KBDLLHOOKSTRUCT, MSG, MSLLHOOKSTRUCT, SW_HIDE, SWP_NOACTIVATE, SWP_SHOWWINDOW,
    SetForegroundWindow, SetWindowLongPtrW, SetWindowPos, SetWindowsHookExW, ShowWindow,
    TranslateMessage, WH_KEYBOARD_LL, WH_MOUSE_LL, WINEVENT_OUTOFCONTEXT, WM_KEYDOWN,
    WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MBUTTONDOWN, WM_MBUTTONUP, WM_RBUTTONDOWN, WM_RBUTTONUP,
    WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
};

fn run_message_loop() {
    let mut msg = MSG::default();
    unsafe {
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }
}

/// Raw window handle that can be sent between threads.
pub type RawHwnd = isize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Clone, Copy, serde::Serialize)]
pub struct Point {
    pub x: i32,
    pub y: i32,
}

pub struct ForegroundInfo {
    pub hwnd: RawHwnd,
    pub title: String,
    pub is_own_process: bool,
}

fn hwnd(raw: RawHwnd) -> HWND {
    HWND(raw as *mut _)
}

pub fn window_title(raw: RawHwnd) -> String {
    let mut buf = [0u16; 512];
    let len = unsafe { GetWindowTextW(hwnd(raw), &mut buf) };
    String::from_utf16_lossy(&buf[..len.max(0) as usize])
}

fn foreground_info(raw: RawHwnd) -> ForegroundInfo {
    let mut pid = 0u32;
    unsafe { GetWindowThreadProcessId(hwnd(raw), Some(&mut pid)) };
    ForegroundInfo {
        hwnd: raw,
        title: window_title(raw),
        is_own_process: pid == std::process::id(),
    }
}

pub fn current_foreground() -> ForegroundInfo {
    foreground_info(unsafe { GetForegroundWindow() }.0 as RawHwnd)
}

static FOREGROUND_CB: OnceLock<Box<dyn Fn(ForegroundInfo) + Send + Sync>> = OnceLock::new();

unsafe extern "system" fn on_win_event(
    _hook: HWINEVENTHOOK,
    _event: u32,
    hwnd: HWND,
    _id_object: i32,
    _id_child: i32,
    _thread: u32,
    _time: u32,
) {
    if let Some(cb) = FOREGROUND_CB.get() {
        cb(foreground_info(hwnd.0 as RawHwnd));
    }
}

/// Calls `cb` every time the foreground window changes.
/// The hook needs a message loop, so it runs on its own thread.
pub fn watch_foreground(cb: impl Fn(ForegroundInfo) + Send + Sync + 'static) {
    if FOREGROUND_CB.set(Box::new(cb)).is_err() {
        return;
    }
    std::thread::spawn(|| {
        let _hook = unsafe {
            SetWinEventHook(
                EVENT_SYSTEM_FOREGROUND,
                EVENT_SYSTEM_FOREGROUND,
                None,
                Some(on_win_event),
                0,
                0,
                WINEVENT_OUTOFCONTEXT,
            )
        };
        run_message_loop();
    });
}

static MOVE_CB: OnceLock<Box<dyn Fn() + Send + Sync>> = OnceLock::new();
/// Window whose moves and resizes are reported (0: none).
static MOVE_WATCHED: AtomicIsize = AtomicIsize::new(0);
const EVENT_OBJECT_LOCATIONCHANGE: u32 = 0x800B;

unsafe extern "system" fn on_location_change(
    _hook: HWINEVENTHOOK,
    _event: u32,
    window: HWND,
    id_object: i32,
    id_child: i32,
    _thread: u32,
    _time: u32,
) {
    // Fires for every moving thing (the cursor too): only the watched window itself counts.
    let watched = MOVE_WATCHED.load(Ordering::SeqCst);
    if watched == 0 || id_object != 0 || id_child != 0 || window.0 as RawHwnd != watched {
        return;
    }
    if let Some(cb) = MOVE_CB.get() {
        cb();
    }
}

/// Calls `cb` when the window set with `set_move_watch` moves or changes size. `cb` must return quickly.
pub fn watch_moves(cb: impl Fn() + Send + Sync + 'static) {
    if MOVE_CB.set(Box::new(cb)).is_err() {
        return;
    }
    std::thread::spawn(|| {
        let _hook = unsafe {
            SetWinEventHook(
                EVENT_OBJECT_LOCATIONCHANGE,
                EVENT_OBJECT_LOCATIONCHANGE,
                None,
                Some(on_location_change),
                0,
                0,
                WINEVENT_OUTOFCONTEXT,
            )
        };
        run_message_loop();
    });
}

pub fn set_move_watch(raw: Option<RawHwnd>) {
    MOVE_WATCHED.store(raw.unwrap_or(0), Ordering::SeqCst);
}

/// A Direct3D game in exclusive fullscreen: nothing can be drawn over it, the overlay included.
pub fn exclusive_fullscreen() -> bool {
    unsafe { SHQueryUserNotificationState() }
        .is_ok_and(|state| state == QUNS_RUNNING_D3D_FULL_SCREEN)
}

static ESCAPE_CB: OnceLock<Box<dyn Fn() + Send + Sync>> = OnceLock::new();
static ESCAPE_ENABLED: AtomicBool = AtomicBool::new(false);

unsafe extern "system" fn on_keyboard(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code == HC_ACTION as i32 && ESCAPE_ENABLED.load(Ordering::SeqCst) {
        let kb = unsafe { &*(lparam.0 as *const KBDLLHOOKSTRUCT) };
        if kb.vkCode == VK_ESCAPE.0 as u32 && wparam.0 as u32 == WM_KEYDOWN {
            if let Some(cb) = ESCAPE_CB.get() {
                cb();
            }
            // Swallow: Esc closes the popup, not game panels.
            return LRESULT(1);
        }
    }
    unsafe { CallNextHookEx(None, code, wparam, lparam) }
}

/// Esc via a low-level keyboard hook rather than RegisterHotKey: such a common key
/// is often already taken by other software. `cb` must return quickly.
pub fn watch_escape(cb: impl Fn() + Send + Sync + 'static) {
    if ESCAPE_CB.set(Box::new(cb)).is_err() {
        return;
    }
    std::thread::spawn(|| {
        let _hook = unsafe {
            let module = GetModuleHandleW(None).ok();
            SetWindowsHookExW(WH_KEYBOARD_LL, Some(on_keyboard), module.map(Into::into), 0)
        };
        run_message_loop();
    });
}

pub fn set_escape_enabled(enabled: bool) {
    ESCAPE_ENABLED.store(enabled, Ordering::SeqCst);
}

type ClickCb = Box<dyn Fn(Point) -> bool + Send + Sync>;
static CLICK_CB: OnceLock<ClickCb> = OnceLock::new();
static CLICK_ENABLED: AtomicBool = AtomicBool::new(false);
/// Button-up message to swallow after a swallowed button-down, so the game never sees half a click.
static SWALLOW_UP: AtomicU32 = AtomicU32::new(0);

unsafe extern "system" fn on_mouse(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code == HC_ACTION as i32 {
        let message = wparam.0 as u32;
        let up = match message {
            WM_LBUTTONDOWN => Some(WM_LBUTTONUP),
            WM_RBUTTONDOWN => Some(WM_RBUTTONUP),
            WM_MBUTTONDOWN => Some(WM_MBUTTONUP),
            _ => None,
        };
        if let Some(up) = up {
            if CLICK_ENABLED.load(Ordering::SeqCst) {
                let info = unsafe { &*(lparam.0 as *const MSLLHOOKSTRUCT) };
                let point = Point {
                    x: info.pt.x,
                    y: info.pt.y,
                };
                if CLICK_CB.get().is_some_and(|cb| cb(point)) {
                    SWALLOW_UP.store(up, Ordering::SeqCst);
                    return LRESULT(1);
                }
            }
        } else if message != 0
            && SWALLOW_UP
                .compare_exchange(message, 0, Ordering::SeqCst, Ordering::SeqCst)
                .is_ok()
        {
            return LRESULT(1);
        }
    }
    unsafe { CallNextHookEx(None, code, wparam, lparam) }
}

/// Mouse button presses while enabled (`set_click_watch_enabled`): `cb` gets the screen point and
/// returns true to swallow the click (press and release). `cb` must return quickly.
pub fn watch_clicks(cb: impl Fn(Point) -> bool + Send + Sync + 'static) {
    if CLICK_CB.set(Box::new(cb)).is_err() {
        return;
    }
    std::thread::spawn(|| {
        let _hook = unsafe {
            let module = GetModuleHandleW(None).ok();
            SetWindowsHookExW(WH_MOUSE_LL, Some(on_mouse), module.map(Into::into), 0)
        };
        run_message_loop();
    });
}

pub fn set_click_watch_enabled(enabled: bool) {
    CLICK_ENABLED.store(enabled, Ordering::SeqCst);
}

/// Whole window in screen coordinates (physical pixels).
pub fn window_rect(raw: RawHwnd) -> Option<Rect> {
    let mut rc = RECT::default();
    unsafe { GetWindowRect(hwnd(raw), &mut rc).ok()? };
    Some(Rect {
        x: rc.left,
        y: rc.top,
        width: rc.right - rc.left,
        height: rc.bottom - rc.top,
    })
}

/// Display scale of the monitor a window is on (1.0 = 96 DPI). Read from the monitor, not the
/// window: a DPI-unaware game would always report 96.
pub fn monitor_scale(raw: RawHwnd) -> f64 {
    unsafe {
        let monitor = MonitorFromWindow(hwnd(raw), MONITOR_DEFAULTTONEAREST);
        let (mut x, mut y) = (0u32, 0u32);
        if GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, &mut x, &mut y).is_ok() && x > 0 {
            x as f64 / 96.0
        } else {
            1.0
        }
    }
}

/// Client area of a window in screen coordinates (physical pixels).
pub fn client_rect(raw: RawHwnd) -> Option<Rect> {
    let mut rc = RECT::default();
    let mut origin = POINT::default();
    unsafe {
        GetClientRect(hwnd(raw), &mut rc).ok()?;
        if !ClientToScreen(hwnd(raw), &mut origin).as_bool() {
            return None;
        }
    }
    Some(Rect {
        x: origin.x,
        y: origin.y,
        width: rc.right - rc.left,
        height: rc.bottom - rc.top,
    })
}

/// The user's Documents folder, wherever it is redirected (game configs live under it).
pub fn documents_dir() -> Option<PathBuf> {
    unsafe {
        let path = SHGetKnownFolderPath(&FOLDERID_Documents, KNOWN_FOLDER_FLAG(0), None).ok()?;
        let dir = path.to_string().ok();
        CoTaskMemFree(Some(path.0 as _));
        dir.map(PathBuf::from)
    }
}

pub fn cursor_pos() -> Point {
    let mut p = POINT::default();
    let _ = unsafe { GetCursorPos(&mut p) };
    Point { x: p.x, y: p.y }
}

pub mod vk {
    pub const CONTROL: u16 = 0x11;
    pub const MENU: u16 = 0x12; // Alt
    pub const SHIFT: u16 = 0x10;
    pub const LWIN: u16 = 0x5B;
    pub const RETURN: u16 = 0x0D;
    pub const ESCAPE: u16 = 0x1B;
    pub const HOME: u16 = 0x24;
    pub const UP: u16 = 0x26;
    pub const DELETE: u16 = 0x2E;
    pub const A: u16 = 0x41;
    pub const C: u16 = 0x43;
    pub const F: u16 = 0x46;
    pub const V: u16 = 0x56;
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum KeyAction {
    Down(u16),
    Up(u16),
}

/// Page Up/Down, End, Home, the arrows, Insert, Delete.
const EXTENDED_KEYS: [u16; 10] = [0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2D, 0x2E];

pub fn send_keys(actions: &[KeyAction]) {
    let inputs: Vec<INPUT> = actions
        .iter()
        .map(|action| {
            let (vk, mut flags) = match *action {
                KeyAction::Down(vk) => (vk, KEYBD_EVENT_FLAGS(0)),
                KeyAction::Up(vk) => (vk, KEYEVENTF_KEYUP),
            };
            // Without the flag, the scan codes of Home, Delete and the arrows are the numpad
            // ones: with Num Lock on a game reading scan codes would get digits.
            if EXTENDED_KEYS.contains(&vk) {
                flags |= KEYEVENTF_EXTENDEDKEY;
            }
            // Some games read scan codes rather than virtual keys, so send both.
            let scan = unsafe { MapVirtualKeyW(vk as u32, MAPVK_VK_TO_VSC) } as u16;
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VIRTUAL_KEY(vk),
                        wScan: scan,
                        dwFlags: flags,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            }
        })
        .collect();
    unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
}

/// Popup must never take focus away from the game: clicks still work,
/// but the window does not become foreground.
pub fn make_no_activate(raw: RawHwnd) {
    unsafe {
        let ex = GetWindowLongPtrW(hwnd(raw), GWL_EXSTYLE);
        SetWindowLongPtrW(
            hwnd(raw),
            GWL_EXSTYLE,
            ex | (WS_EX_NOACTIVATE.0 | WS_EX_TOOLWINDOW.0) as isize,
        );
    }
}

/// The popup takes keyboard focus only while the user types into it, then goes back to no-activate.
pub fn set_no_activate(raw: RawHwnd, enabled: bool) {
    unsafe {
        let ex = GetWindowLongPtrW(hwnd(raw), GWL_EXSTYLE);
        let flag = WS_EX_NOACTIVATE.0 as isize;
        SetWindowLongPtrW(
            hwnd(raw),
            GWL_EXSTYLE,
            if enabled { ex | flag } else { ex & !flag },
        );
    }
}

/// Makes `raw` the foreground window and reports whether it actually is now.
/// Windows refuses SetForegroundWindow to a background process (a click on a WS_EX_NOACTIVATE
/// window does not count), so our thread briefly shares input with the current foreground
/// window's thread, which lifts that restriction.
pub fn focus(raw: RawHwnd) -> bool {
    unsafe {
        let target = hwnd(raw);
        let foreground = GetForegroundWindow();
        if foreground == target {
            return true;
        }
        let ours = GetCurrentThreadId();
        let theirs = GetWindowThreadProcessId(foreground, None);
        let attached =
            theirs != 0 && theirs != ours && AttachThreadInput(ours, theirs, true).as_bool();
        let _ = SetForegroundWindow(target);
        let _ = BringWindowToTop(target);
        if attached {
            let _ = AttachThreadInput(ours, theirs, false);
        }
        GetForegroundWindow() == target
    }
}

pub fn show_no_activate(raw: RawHwnd, rect: Rect) {
    unsafe {
        let _ = SetWindowPos(
            hwnd(raw),
            Some(HWND_TOPMOST),
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            SWP_NOACTIVATE | SWP_SHOWWINDOW,
        );
    }
}

pub fn hide(raw: RawHwnd) {
    unsafe {
        let _ = ShowWindow(hwnd(raw), SW_HIDE);
    }
}
