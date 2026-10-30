//! Pre-created hidden popup window, shown next to the game on demand without taking focus.

use tauri::{AppHandle, Manager};

use crate::constants::{
    DPI_REPOSITION_DELAY, FOCUS_RETRY_DELAY, ITEM_CHECK_HEIGHT_LOGICAL, ITEM_CHECK_WIDTH_LOGICAL,
    POE_PANEL_WIDTH_RATIO, POPUP_HEIGHT_LOGICAL, POPUP_MARGIN_LOGICAL, POPUP_TOP_RATIO,
    POPUP_WIDTH_LOGICAL, POPUP_WINDOW as LABEL, STASH_PANEL_HEIGHT_LOGICAL,
    STASH_PANEL_WIDTH_LOGICAL,
};
use crate::hotkeys::CheckTarget;
use crate::platform::{self, Point, Rect};
use crate::state::AppState;

/// Call once on startup, after the popup window exists.
pub fn init(app: &AppHandle) -> tauri::Result<()> {
    let window = app
        .get_webview_window(LABEL)
        .expect("popup window is declared in tauri.conf.json");
    let raw = window.hwnd()?.0 as platform::RawHwnd;
    platform::make_no_activate(raw);
    app.state::<AppState>().set_popup_hwnd(raw);

    let handle = app.clone();
    platform::watch_escape(move || {
        // Runs inside the keyboard hook: just post the work and return.
        log::info!("[focus] Esc pressed");
        let inner = handle.clone();
        let _ = handle.run_on_main_thread(move || hide(&inner, true));
    });

    let handle = app.clone();
    platform::watch_moves(move || {
        // The game moved or changed size under the popup: it would hang in the wrong place.
        let state = handle.state::<AppState>();
        let Some(placement) = state.placement() else {
            return;
        };
        let now = state.game_hwnd().and_then(platform::client_rect);
        if state.popup_visible() && now.is_some_and(|rect| rect != placement.game) {
            log::info!("[focus] game window moved, hiding the popup");
            let inner = handle.clone();
            let _ = handle.run_on_main_thread(move || hide(&inner, true));
        }
    });

    let handle = app.clone();
    platform::watch_clicks(move |point| {
        // Runs inside the mouse hook: decide fast, post the work.
        let state = handle.state::<AppState>();
        if !clicked_outside_in_game(&state, point) {
            return false;
        }
        log::info!("[focus] click outside the popup");
        let inner = handle.clone();
        let _ = handle.run_on_main_thread(move || hide(&inner, true));
        true
    });
    Ok(())
}

/// A click into the game but not on the popup closes the popup and does not reach the game
/// (no walking to where the user clicked). Clicks on other windows pass as usual.
fn clicked_outside_in_game(state: &AppState, point: Point) -> bool {
    let Some(game) = state.game_hwnd() else {
        return false;
    };
    let inside = |rect: Option<Rect>| {
        rect.is_some_and(|r| {
            point.x >= r.x && point.x < r.x + r.width && point.y >= r.y && point.y < r.y + r.height
        })
    };
    state.popup_visible()
        && platform::current_foreground().hwnd == game
        && inside(platform::client_rect(game))
        && !inside(platform::window_rect(state.popup_hwnd()))
}

/// Horizontally the popup is centred on the game (the default), or, like APT, sits next to the
/// game's side panel the item is in (inventory on the right → popup just left of it, stash on the
/// left → just right of it), within the game. The stash
/// search panel is always centred: the stash and the inventory are both open then. Vertically
/// the price check hangs from near the top, the smaller ones are centred (APT anchors them at 50 %).
/// `size` is in logical pixels: the target's default, or what the page asked for (`fit`).
/// `panel_ratio`: `GameProfile::panel_width_ratio`.
pub fn geometry(
    game: Rect,
    cursor: Point,
    scale: f64,
    target: CheckTarget,
    size: (f64, f64),
    centred: bool,
    panel_ratio: f64,
) -> Rect {
    let px = |logical: f64| (logical * scale).round() as i32;
    let (logical_width, logical_height) = size;
    let margin = px(POPUP_MARGIN_LOGICAL);
    let width = px(logical_width).min(game.width - 2 * margin).max(0);
    // Asked taller than the game (a theme whose price check is as tall as the game): the whole
    // game height, top to bottom, without margins.
    let full_height = target == CheckTarget::PriceCheck && px(logical_height) >= game.height;
    let height = if full_height {
        game.height
    } else {
        px(logical_height).min(game.height - 2 * margin).max(0)
    };

    let cursor_on_right = cursor.x > game.x + game.width / 2;
    let x = if centred || target == CheckTarget::StashSearch {
        game.x + (game.width - width) / 2
    } else {
        let panel = (game.height as f64 * panel_ratio).round() as i32;
        let (min, max) = (game.x + margin, game.x + game.width - margin - width);
        let x = if cursor_on_right {
            game.x + game.width - panel - width
        } else {
            game.x + panel
        };
        x.min(max).max(min)
    };
    let top = match target {
        CheckTarget::PriceCheck => (game.height as f64 * POPUP_TOP_RATIO).round() as i32,
        CheckTarget::ItemCheck | CheckTarget::StashSearch => (game.height - height) / 2,
    };
    let y = if full_height {
        game.y
    } else {
        game.y + top.min(game.height - margin - height).max(margin)
    };
    Rect {
        x,
        y,
        width,
        height,
    }
}

/// Which side of the game the popup went to: "right" when the item is in the inventory (the popup
/// sits just left of that panel, in the right half), "left" for the stash, or "center" (the
/// setting, or the stash search panel). Same decision as `geometry`. A theme whose window is wider
/// than its price check (related items beside the column) lays itself out by it.
pub fn side(game: Rect, cursor: Point, target: CheckTarget, centred: bool) -> &'static str {
    if centred || target == CheckTarget::StashSearch {
        "center"
    } else if cursor.x > game.x + game.width / 2 {
        "right"
    } else {
        "left"
    }
}

pub fn default_size(target: CheckTarget) -> (f64, f64) {
    match target {
        CheckTarget::PriceCheck => (POPUP_WIDTH_LOGICAL, POPUP_HEIGHT_LOGICAL),
        CheckTarget::ItemCheck => (ITEM_CHECK_WIDTH_LOGICAL, ITEM_CHECK_HEIGHT_LOGICAL),
        CheckTarget::StashSearch => (STASH_PANEL_WIDTH_LOGICAL, STASH_PANEL_HEIGHT_LOGICAL),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Path of Exile: 986 px at 1600 px tall, as APT measures it.
    const PANEL: f64 = 986.0 / 1600.0;

    const GAME: Rect = Rect {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
    };

    #[test]
    fn side_of_the_popup() {
        let cursor = |x| Point { x, y: 300 };
        assert_eq!(
            side(GAME, cursor(1700), CheckTarget::PriceCheck, false),
            "right"
        );
        assert_eq!(
            side(GAME, cursor(200), CheckTarget::PriceCheck, false),
            "left"
        );
        assert_eq!(
            side(GAME, cursor(200), CheckTarget::PriceCheck, true),
            "center"
        );
        assert_eq!(
            side(GAME, cursor(1700), CheckTarget::StashSearch, false),
            "center"
        );
        // The side matches where `geometry` put the popup: right of the middle for "right".
        let right = geometry(
            GAME,
            cursor(1700),
            1.0,
            CheckTarget::PriceCheck,
            (460.0, 590.0),
            false,
            PANEL,
        );
        assert_eq!(right.x, 1920 - 666 - 460);
    }

    #[test]
    fn full_height_takes_the_whole_game() {
        for (cursor_x, centred) in [(1700, false), (200, false), (1700, true)] {
            let rect = geometry(
                GAME,
                Point {
                    x: cursor_x,
                    y: 300,
                },
                1.0,
                CheckTarget::PriceCheck,
                (460.0, 100_000.0),
                centred,
                PANEL,
            );
            assert_eq!((rect.y, rect.width, rect.height), (0, 460, 1080));
        }
        let x_of = |cursor_x, centred| {
            geometry(
                GAME,
                Point {
                    x: cursor_x,
                    y: 300,
                },
                1.0,
                CheckTarget::PriceCheck,
                (460.0, 100_000.0),
                centred,
                PANEL,
            )
            .x
        };
        assert_eq!(x_of(1700, false), 1920 - 666 - 460);
        assert_eq!(x_of(200, false), 666);
        assert_eq!(x_of(1700, true), (1920 - 460) / 2);
        // On a game not at the screen origin and with DPI scaling: still exactly the game.
        let moved = Rect {
            x: 100,
            y: 50,
            width: 1600,
            height: 900,
        };
        let rect = geometry(
            moved,
            Point { x: 1500, y: 300 },
            1.25,
            CheckTarget::PriceCheck,
            (460.0, 100_000.0),
            false,
            PANEL,
        );
        assert_eq!((rect.y, rect.height, rect.width), (50, 900, 575));
    }

    #[test]
    fn exactly_the_game_height_is_full_height_but_only_for_the_price_check() {
        let price = geometry(
            GAME,
            Point { x: 1700, y: 300 },
            1.0,
            CheckTarget::PriceCheck,
            (460.0, 1080.0),
            false,
            PANEL,
        );
        assert_eq!((price.y, price.height), (0, 1080));
        // Our own price check asks less than the game: margins and the top anchor as before.
        let ours = geometry(
            GAME,
            Point { x: 1700, y: 300 },
            1.0,
            CheckTarget::PriceCheck,
            (960.0, 1079.0),
            false,
            PANEL,
        );
        assert_eq!((ours.y, ours.height), (24, 1080 - 48));
        // The item / map check keeps its margins even when it asks more than the game.
        let item = geometry(
            GAME,
            Point { x: 1700, y: 300 },
            1.0,
            CheckTarget::ItemCheck,
            (440.0, 100_000.0),
            false,
            PANEL,
        );
        assert_eq!((item.y, item.height), (24, 1080 - 48));
    }

    #[test]
    fn opposite_side_of_cursor() {
        let left = geometry(
            GAME,
            Point { x: 1700, y: 300 },
            1.0,
            CheckTarget::PriceCheck,
            default_size(CheckTarget::PriceCheck),
            false,
            PANEL,
        );
        // Just left of the inventory: 1080 * 986 / 1600 = 666 px wide.
        assert_eq!(
            (left.x, left.y, left.width, left.height),
            (1920 - 666 - 960, 108, 960, 590)
        );
        let right = geometry(
            GAME,
            Point { x: 200, y: 300 },
            1.0,
            CheckTarget::PriceCheck,
            default_size(CheckTarget::PriceCheck),
            false,
            PANEL,
        );
        // Just right of the stash.
        assert_eq!(right.x, 666);
    }

    #[test]
    fn scales_with_dpi_and_fits_small_games() {
        let scaled = geometry(
            GAME,
            Point { x: 1700, y: 0 },
            1.25,
            CheckTarget::PriceCheck,
            default_size(CheckTarget::PriceCheck),
            false,
            PANEL,
        );
        assert_eq!((scaled.width, scaled.height), (1200, 738));
        let small = Rect {
            x: 100,
            y: 50,
            width: 800,
            height: 600,
        };
        let fitted = geometry(
            small,
            Point { x: 700, y: 0 },
            1.0,
            CheckTarget::PriceCheck,
            default_size(CheckTarget::PriceCheck),
            false,
            PANEL,
        );
        assert_eq!(
            (fitted.x, fitted.y, fitted.width, fitted.height),
            (124, 74, 752, 552)
        );
    }

    #[test]
    fn item_check_is_small_and_centred() {
        let rect = geometry(
            GAME,
            Point { x: 1700, y: 300 },
            1.0,
            CheckTarget::ItemCheck,
            default_size(CheckTarget::ItemCheck),
            false,
            PANEL,
        );
        assert_eq!(
            (rect.x, rect.y, rect.width, rect.height),
            (1920 - 666 - 380, (1080 - 330) / 2, 380, 330)
        );
    }

    #[test]
    fn centred_by_default_setting() {
        let rect = geometry(
            GAME,
            Point { x: 1700, y: 300 },
            1.0,
            CheckTarget::PriceCheck,
            default_size(CheckTarget::PriceCheck),
            true,
            PANEL,
        );
        assert_eq!((rect.x, rect.y), ((1920 - 960) / 2, 108));
    }

    #[test]
    fn stash_panel_is_centred() {
        let rect = geometry(
            GAME,
            Point { x: 1700, y: 300 },
            1.0,
            CheckTarget::StashSearch,
            (360.0, 200.0),
            false,
            PANEL,
        );
        assert_eq!(
            (rect.x, rect.y, rect.width, rect.height),
            ((1920 - 360) / 2, (1080 - 200) / 2, 360, 200)
        );
    }

    #[test]
    fn fitted_map_check_stays_centred_and_inside_the_game() {
        let rect = geometry(
            GAME,
            Point { x: 200, y: 300 },
            1.0,
            CheckTarget::ItemCheck,
            (440.0, 600.0),
            false,
            PANEL,
        );
        assert_eq!(
            (rect.x, rect.y, rect.width, rect.height),
            (666, 240, 440, 600)
        );
        let tall = geometry(
            GAME,
            Point { x: 200, y: 300 },
            1.0,
            CheckTarget::ItemCheck,
            (440.0, 2000.0),
            false,
            PANEL,
        );
        assert_eq!((tall.y, tall.height), (24, 1080 - 48));
    }
}

/// Scale of the game's monitor (the popup may still be on another one), FINDINGS F-51.
fn game_scale(state: &AppState) -> f64 {
    state.game_hwnd().map_or(1.0, platform::monitor_scale)
}

/// Places the popup; if it comes from a monitor with another scale, again once Windows has
/// resized it for the new one.
fn place(window: &tauri::WebviewWindow, hwnd: platform::RawHwnd, rect: Rect, scale: f64) {
    let moved_scale = window
        .scale_factor()
        .is_ok_and(|old| (old - scale).abs() > f64::EPSILON);
    platform::show_no_activate(hwnd, rect);
    if moved_scale {
        std::thread::spawn(move || {
            std::thread::sleep(DPI_REPOSITION_DELAY);
            platform::show_no_activate(hwnd, rect);
        });
    }
}

pub fn show(app: &AppHandle, game: Rect, cursor: Point, target: CheckTarget) {
    let Some(window) = app.get_webview_window(LABEL) else {
        return;
    };
    let state = app.state::<AppState>();
    let scale = game_scale(&state);
    let placement = Placement {
        game,
        cursor,
        target,
    };
    state.set_placement(placement);
    place(
        &window,
        state.popup_hwnd(),
        geometry(
            game,
            cursor,
            scale,
            target,
            default_size(target),
            state.popup_centred(),
            POE_PANEL_WIDTH_RATIO,
        ),
        scale,
    );
    state.set_popup_visible(true);
    platform::set_escape_enabled(true);
    platform::set_click_watch_enabled(true);
    platform::set_move_watch(state.game_hwnd());
}

/// The page measured its content (the map check grows with the mods): resize the shown popup to it,
/// keeping its side and anchor. Ignored once the popup is hidden. Returns the side the popup is on
/// (see `side`); "center" when there is nothing to fit.
pub fn fit(app: &AppHandle, width: f64, height: f64) -> &'static str {
    let Some(window) = app.get_webview_window(LABEL) else {
        return "center";
    };
    let state = app.state::<AppState>();
    let Some(Placement {
        game,
        cursor,
        target,
    }) = state.placement()
    else {
        return "center";
    };
    if !state.popup_visible() {
        return "center";
    }
    let scale = game_scale(&state);
    let centred = state.popup_centred();
    place(
        &window,
        state.popup_hwnd(),
        geometry(
            game,
            cursor,
            scale,
            target,
            (width, height),
            centred,
            POE_PANEL_WIDTH_RATIO,
        ),
        scale,
    );
    side(game, cursor, target, centred)
}

/// Where the popup was last shown, for `fit`.
#[derive(Clone, Copy)]
pub struct Placement {
    pub game: Rect,
    pub cursor: Point,
    pub target: CheckTarget,
}

/// `return_focus`: give the keyboard back to the game if the popup had it (Esc, close button).
/// Not when the user switched to another application.
pub fn hide(app: &AppHandle, return_focus: bool) {
    let state = app.state::<AppState>();
    log::info!("[focus] hide popup (return focus: {return_focus})");
    platform::set_escape_enabled(false);
    platform::set_click_watch_enabled(false);
    platform::set_move_watch(None);
    // Hide first, then hand focus back: focusing the game while the popup still shows a
    // focused text field let the Windows text input host grab the foreground instead.
    platform::hide(state.popup_hwnd());
    state.set_popup_visible(false);
    release_focus(app, return_focus);
}

/// The user clicked an input: let the popup take the keyboard until `release_focus`.
/// Returns false when Windows refused: the caller must not start typing, or the keys
/// would go to the game (where digits are flasks and skills).
pub fn focus_for_input(app: &AppHandle) -> bool {
    let state = app.state::<AppState>();
    if !state.popup_visible() {
        return false;
    }
    if state.popup_focused() {
        return true;
    }
    platform::set_no_activate(state.popup_hwnd(), false);
    state.set_popup_focused(true);
    if platform::focus(state.popup_hwnd()) {
        log::info!("[focus] popup took the keyboard");
        return true;
    }
    log::info!("[focus] Windows refused to focus the popup");
    platform::set_no_activate(state.popup_hwnd(), true);
    state.set_popup_focused(false);
    false
}

pub fn release_focus(app: &AppHandle, return_focus: bool) {
    let state = app.state::<AppState>();
    if !state.popup_focused() {
        return;
    }
    platform::set_no_activate(state.popup_hwnd(), true);
    state.set_popup_focused(false);
    log::info!("[focus] popup released the keyboard (return to game: {return_focus})");
    if return_focus {
        if let Some(game) = state.game_hwnd() {
            if !platform::focus(game) {
                log::info!("[focus] game refocus intercepted, retrying");
                // Something (e.g. "Windows Input Experience") took the foreground in between: retry once.
                std::thread::spawn(move || {
                    std::thread::sleep(FOCUS_RETRY_DELAY);
                    platform::focus(game);
                });
            }
        }
    }
}
