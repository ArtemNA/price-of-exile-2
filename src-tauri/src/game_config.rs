//! The keys that make the game copy the hovered item. Path of Exile 2 copies the advanced item
//! descriptions only while their key is held, so that key is read from the game's config file
//! like EE2 `host-files/GameConfig.ts` reads it, and pressed with Ctrl+C
//! (EE2 `Shortcuts.ts` `pressKeysToCopyItemText`).

use std::path::Path;

use crate::constants::{
    ADVANCED_DESCRIPTIONS_ACTION, DEFAULT_ADVANCED_DESCRIPTIONS_KEYS, GAME_CONFIG_FILE,
    GAME_CONFIG_SECTION,
};
use crate::platform::{self, vk};

/// Virtual keys EE2 knows by name (`ipc/KeyToCode.ts` `KeyToCode`); others in the config are
/// refused, as EE2 refuses them.
fn is_known_key(key: u16) -> bool {
    matches!(
        key,
        8 | 9
            | 13
            | 16..=18
            | 20
            | 27
            | 32..=40
            | 45
            | 46
            | 48..=57
            | 65..=90
            | 96..=107
            | 109..=135
            | 186..=192
            | 219..=222
    )
}

/// Value of `key` in `[section]` of an ini file (the last one, as the `ini` package EE2 uses).
fn ini_value<'a>(contents: &'a str, section: &str, key: &str) -> Option<&'a str> {
    let mut current = "";
    let mut found = None;
    // The file may start with a BOM (EE2 `trimStart`).
    for line in contents.trim_start_matches('\u{feff}').lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with([';', '#']) {
            continue;
        }
        if let Some(name) = line.strip_prefix('[').and_then(|l| l.strip_suffix(']')) {
            current = name.trim();
            continue;
        }
        if current != section {
            continue;
        }
        if let Some((name, value)) = line.split_once('=')
            && name.trim() == key
        {
            found = Some(value.trim().trim_matches('"'));
        }
    }
    found
}

/// The keys of an action in the game config: `<virtual key>` or `<virtual key> <modifier>`, the
/// modifier being 1 Shift, 2 Ctrl, 3 Alt (EE2 `GameConfig.parseConfigHotkey`). The modifier comes
/// first in the result.
pub fn parse_action_key(contents: &str, section: &str, action: &str) -> Result<Vec<u16>, String> {
    let value = ini_value(contents, section, action)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("no {action} in [{section}]"))?;
    let mut parts = value.split(' ');
    let main = parts
        .next()
        .and_then(|key| key.parse::<u16>().ok())
        .filter(|key| is_known_key(*key))
        .ok_or_else(|| format!("unknown key {value:?}"))?;
    let modifier = match parts.next().unwrap_or_default() {
        "" => None,
        "1" => Some(vk::SHIFT),
        "2" => Some(vk::CONTROL),
        "3" => Some(vk::MENU),
        _ => return Err(format!("unknown modifier {value:?}")),
    };
    Ok(modifier.into_iter().chain([main]).collect())
}

/// Keys held while C is pressed: Ctrl and `advanced`, without repeats, modifiers first in the
/// order Ctrl, Shift, Alt (EE2 `mergeTwoHotkeys("Ctrl + C", showModsKey)` without the C).
pub fn copy_chord(advanced: &[u16]) -> Vec<u16> {
    let all: Vec<u16> = [vk::CONTROL].iter().chain(advanced).copied().collect();
    let modifiers = [vk::CONTROL, vk::SHIFT, vk::MENU]
        .into_iter()
        .filter(|key| all.contains(key));
    let mut keys: Vec<u16> = modifiers.collect();
    for key in all {
        if key != vk::C && !keys.contains(&key) {
            keys.push(key);
        }
    }
    keys
}

/// The copy keys before the game config is read.
pub fn default_copy_keys() -> Vec<u16> {
    copy_chord(DEFAULT_ADVANCED_DESCRIPTIONS_KEYS)
}

/// Reads the advanced descriptions key from the game config under `documents`.
/// Returns the copy keys and where they came from, for the log.
pub fn read_copy_keys(documents: Option<&Path>) -> (Vec<u16>, String) {
    let path = documents.map(|dir| dir.join(GAME_CONFIG_FILE));
    let read = path
        .as_ref()
        .ok_or_else(|| "no Documents folder".to_string())
        .and_then(|path| std::fs::read_to_string(path).map_err(|e| e.to_string()))
        .and_then(|contents| {
            parse_action_key(&contents, GAME_CONFIG_SECTION, ADVANCED_DESCRIPTIONS_ACTION)
        });
    let file = path.unwrap_or_default();
    match read {
        Ok(keys) => (
            copy_chord(&keys),
            format!("{ADVANCED_DESCRIPTIONS_ACTION} from {}", file.display()),
        ),
        Err(e) => (
            default_copy_keys(),
            format!("default, {} not read: {e}", file.display()),
        ),
    }
}

/// The copy keys from the game config in the user's Documents folder, and where they came from.
pub fn copy_keys() -> (Vec<u16>, String) {
    read_copy_keys(platform::documents_dir().as_deref())
}

/// "Ctrl+Alt+C" for the log.
pub fn describe(keys: &[u16]) -> String {
    keys.iter()
        .chain([&vk::C])
        .map(|&key| match key {
            vk::CONTROL => "Ctrl".to_string(),
            vk::SHIFT => "Shift".to_string(),
            vk::MENU => "Alt".to_string(),
            0x30..=0x39 | 0x41..=0x5A => (key as u8 as char).to_string(),
            0x70..=0x87 => format!("F{}", key - 0x6F),
            other => format!("VK {other}"),
        })
        .collect::<Vec<_>>()
        .join("+")
}

#[cfg(test)]
mod tests {
    use super::*;

    const CONFIG: &str = "\u{feff}[GENERAL]\r\nshow_advanced_item_descriptions=90\r\n\
        [ACTION_KEYS]\r\nmove_up=0\r\nshow_advanced_item_descriptions=18\r\n\
        compare_item_descriptions=16\r\n[WASD_ACTION_KEYS]\r\nshow_advanced_item_descriptions=17\r\n";

    #[test]
    fn reads_the_action_from_its_section() {
        let action = ADVANCED_DESCRIPTIONS_ACTION;
        assert_eq!(
            parse_action_key(CONFIG, "ACTION_KEYS", action),
            Ok(vec![vk::MENU])
        );
        let with_modifier = "[ACTION_KEYS]\nshow_advanced_item_descriptions=90 1\n";
        assert_eq!(
            parse_action_key(with_modifier, "ACTION_KEYS", action),
            Ok(vec![vk::SHIFT, 0x5A])
        );
        let ctrl = "[ACTION_KEYS]\nshow_advanced_item_descriptions = 112 2\n";
        assert_eq!(
            parse_action_key(ctrl, "ACTION_KEYS", action),
            Ok(vec![vk::CONTROL, 0x70])
        );
    }

    #[test]
    fn refuses_what_ee2_refuses() {
        let action = ADVANCED_DESCRIPTIONS_ACTION;
        for value in ["", "0", "1000", "abc", "18 4", "18 0"] {
            let config = format!("[ACTION_KEYS]\nshow_advanced_item_descriptions={value}\n");
            assert!(
                parse_action_key(&config, "ACTION_KEYS", action).is_err(),
                "{value:?}"
            );
        }
        assert!(parse_action_key("[ACTION_KEYS]\nmove_up=0\n", "ACTION_KEYS", action).is_err());
    }

    #[test]
    fn copy_chord_like_ee2() {
        assert_eq!(copy_chord(&[vk::MENU]), vec![vk::CONTROL, vk::MENU]);
        assert_eq!(copy_chord(&[vk::CONTROL]), vec![vk::CONTROL]);
        assert_eq!(
            copy_chord(&[vk::SHIFT, 0x5A]),
            vec![vk::CONTROL, vk::SHIFT, 0x5A]
        );
        assert_eq!(
            copy_chord(&[vk::MENU, vk::SHIFT]),
            vec![vk::CONTROL, vk::SHIFT, vk::MENU]
        );
        assert_eq!(copy_chord(&[vk::C]), vec![vk::CONTROL]);
        assert_eq!(describe(&copy_chord(&[vk::MENU])), "Ctrl+Alt+C");
        assert_eq!(describe(&[vk::CONTROL, 0x70]), "Ctrl+F1+C");
    }

    #[test]
    fn falls_back_to_the_default() {
        assert_eq!(default_copy_keys(), vec![vk::CONTROL, vk::MENU]);
        let (keys, source) = read_copy_keys(None);
        assert_eq!(keys, vec![vk::CONTROL, vk::MENU]);
        assert!(source.starts_with("default"), "{source}");

        let root = std::env::temp_dir().join(format!("poe-config-{}", std::process::id()));
        let (keys, source) = read_copy_keys(Some(&root));
        assert_eq!(keys, vec![vk::CONTROL, vk::MENU]);
        assert!(source.starts_with("default"), "{source}");

        let file = root.join(GAME_CONFIG_FILE);
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(&file, "[ACTION_KEYS]\nshow_advanced_item_descriptions=90\n").unwrap();
        let (keys, source) = read_copy_keys(Some(&root));
        assert_eq!(keys, vec![vk::CONTROL, 0x5A]);
        assert!(source.starts_with(ADVANCED_DESCRIPTIONS_ACTION), "{source}");
        let _ = std::fs::remove_dir_all(&root);
    }
}
