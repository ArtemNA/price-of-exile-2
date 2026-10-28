//! Price of Exile 2: the shared overlay host (`overlay-host`) with the Path of Exile 2 profile.

use std::time::Duration;

use overlay_host::{AdvancedKey, CopyKeys, GameProfile, vk};

const PROFILE: GameProfile = GameProfile {
    window_title: "Path of Exile 2",
    // Uncut gems start with the rarity, not the item class (EE2 `HostClipboard.ts`): EN and RU.
    item_first_lines: &["Item Class: ", "Rarity: ", "Класс предмета: ", "Редкость: "],
    // The game copies the advanced item descriptions only while their key is held
    // (EE2 `GameConfig.ts`, `Shortcuts.ts`): Ctrl+Alt+C unless rebound.
    copy_keys: CopyKeys::CtrlAdvancedC(AdvancedKey {
        config_file: r"My Games\Path of Exile 2\poe2_production_Config.ini",
        section: "ACTION_KEYS",
        action: "show_advanced_item_descriptions",
        default: &[vk::MENU],
    }),
    // EE2: "Game was dropping the release inputs".
    copy_release_delay: Duration::from_millis(10),
    trade_hosts: &["www.pathofexile.com", "ru.pathofexile.com"],
    default_trade_host: "www.pathofexile.com",
    // As in Path of Exile until measured in the game (FINDINGS F-58).
    panel_width_ratio: 986.0 / 1600.0,
    browser_title: "pathofexile.com — Price of Exile 2",
    legacy_shortcuts: None,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    overlay_host::run(PROFILE, tauri::generate_context!());
}
