//! The keys that make the game copy the hovered item. Path of Exile 2 copies the advanced item
//! descriptions only while their key is held, so that key is read from the game's config file
//! like EE2 `host-files/GameConfig.ts` reads it, and pressed with Ctrl+C
//! (EE2 `Shortcuts.ts` `pressKeysToCopyItemText`).

use std::path::Path;

use crate::constants::{
    ADVANCED_DESCRIPTIONS_ACTION, COPY_KEY_OVERRIDES, DEFAULT_ADVANCED_DESCRIPTIONS_KEYS,
    GAME_CONFIG_FILE, GAME_CONFIG_SECTION,
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

/// Where the advanced descriptions key came from.
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CopyKeysSource {
    /// The overlay settings override the game config.
    Settings,
    /// The game config file.
    GameConfig,
    /// The game's default (Alt): the config could not be read.
    Default,
}

/// The keys held while C copies the item, where they came from, and the config file or the reason
/// it was not read.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CopyKeys {
    pub keys: Vec<u16>,
    pub source: CopyKeysSource,
    pub detail: String,
}

impl CopyKeys {
    pub fn initial() -> Self {
        Self {
            keys: default_copy_keys(),
            source: CopyKeysSource::Default,
            detail: "game config not read yet".into(),
        }
    }

    /// "Ctrl+Alt+C (show_advanced_item_descriptions from …)" for the log.
    pub fn describe(&self) -> String {
        let source = match self.source {
            CopyKeysSource::Settings => "set in the settings".to_string(),
            CopyKeysSource::GameConfig => {
                format!("{ADVANCED_DESCRIPTIONS_ACTION} from {}", self.detail)
            }
            CopyKeysSource::Default => format!("default, {}", self.detail),
        };
        format!("{} ({source})", describe(&self.keys))
    }
}

/// The virtual key of an override the settings name ("Alt", "Shift", "Ctrl").
pub fn override_key(name: &str) -> Option<u16> {
    COPY_KEY_OVERRIDES
        .iter()
        .find(|(known, _)| *known == name)
        .map(|(_, key)| *key)
}

/// The copy keys: the settings' `override_key` when set, else the advanced descriptions key from
/// the game config under `documents`, else the default.
pub fn read_copy_keys(override_key: Option<u16>, documents: Option<&Path>) -> CopyKeys {
    if let Some(key) = override_key {
        return CopyKeys {
            keys: copy_chord(&[key]),
            source: CopyKeysSource::Settings,
            detail: String::new(),
        };
    }
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
        Ok(keys) => CopyKeys {
            keys: copy_chord(&keys),
            source: CopyKeysSource::GameConfig,
            detail: file.display().to_string(),
        },
        Err(e) => CopyKeys {
            keys: default_copy_keys(),
            source: CopyKeysSource::Default,
            detail: format!("{} not read: {e}", file.display()),
        },
    }
}

/// The copy keys with the settings' override, else from the game config in the user's Documents.
pub fn copy_keys(override_key: Option<u16>) -> CopyKeys {
    read_copy_keys(override_key, platform::documents_dir().as_deref())
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
        let copy = read_copy_keys(None, None);
        assert_eq!(copy.keys, vec![vk::CONTROL, vk::MENU]);
        assert_eq!(copy.source, CopyKeysSource::Default);
        assert!(
            copy.describe().starts_with("Ctrl+Alt+C (default"),
            "{copy:?}"
        );

        let root = temp_root("default");
        let copy = read_copy_keys(None, Some(&root));
        assert_eq!(copy.keys, vec![vk::CONTROL, vk::MENU]);
        assert_eq!(copy.source, CopyKeysSource::Default);
        assert!(copy.detail.contains("not read"), "{copy:?}");

        write_config(&root, "90");
        let copy = read_copy_keys(None, Some(&root));
        assert_eq!(copy.keys, vec![vk::CONTROL, 0x5A]);
        assert_eq!(copy.source, CopyKeysSource::GameConfig);
        assert_eq!(
            copy.detail,
            root.join(GAME_CONFIG_FILE).display().to_string()
        );
        assert!(
            copy.describe()
                .starts_with(&format!("Ctrl+Z+C ({ADVANCED_DESCRIPTIONS_ACTION} from")),
            "{copy:?}"
        );
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn the_settings_override_the_game_config() {
        assert_eq!(override_key("Alt"), Some(vk::MENU));
        assert_eq!(override_key("Shift"), Some(vk::SHIFT));
        assert_eq!(override_key("Ctrl"), Some(vk::CONTROL));
        assert_eq!(override_key("alt"), None);
        assert_eq!(override_key("Z"), None);

        let root = temp_root("override");
        write_config(&root, "18");
        let copy = read_copy_keys(Some(vk::SHIFT), Some(&root));
        assert_eq!(copy.keys, vec![vk::CONTROL, vk::SHIFT]);
        assert_eq!(copy.source, CopyKeysSource::Settings);
        assert_eq!(copy.describe(), "Ctrl+Shift+C (set in the settings)");
        // Ctrl alone is a plain Ctrl+C, for a game bound to Ctrl.
        assert_eq!(
            read_copy_keys(Some(vk::CONTROL), None).keys,
            vec![vk::CONTROL]
        );
        // Without the override, the game config again.
        let copy = read_copy_keys(None, Some(&root));
        assert_eq!(copy.keys, vec![vk::CONTROL, vk::MENU]);
        assert_eq!(copy.source, CopyKeysSource::GameConfig);
        let _ = std::fs::remove_dir_all(&root);
    }

    fn temp_root(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!("poe-config-{name}-{}", std::process::id()))
    }

    fn write_config(root: &Path, value: &str) {
        let file = root.join(GAME_CONFIG_FILE);
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(
            &file,
            format!(
                "[ACTION_KEYS]
show_advanced_item_descriptions={value}
"
            ),
        )
        .unwrap();
    }
}
