//! Macros: open something (a program, file, folder, URL, steam:// link...) or press a key combo.
//!
//! Keys go through SendInput with hardware scan codes, so apps that look at scan codes (Discord, OBS,
//! games) see what looks like a real key press. Global shortcuts like Discord mute or OBS record work
//! whatever has focus. Windows won't let injected keys reach apps running as admin unless Rigside is
//! running as admin too (UIPI).

use serde::Deserialize;
use windows::core::{HSTRING, PCWSTR};
use windows::Win32::System::Com::{CoInitializeEx, COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    MapVirtualKeyW, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_EXTENDEDKEY,
    KEYEVENTF_KEYUP, MAPVK_VK_TO_VSC, VIRTUAL_KEY,
};
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Action {
    /// Program, file, folder or URL; `args` only for programs.
    Run {
        target: String,
        #[serde(default)]
        args: String,
    },
    /// Virtual-key codes, modifiers first (as recorded by the editor).
    Keys { vks: Vec<u16> },
}

// Navigation cluster, right-hand modifiers, Win, media keys: need KEYEVENTF_EXTENDEDKEY.
const EXTENDED: [u16; 23] = [
    0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2D, 0x2E, 0x2C, 0x5B, 0x5C, 0x5D, 0xA3, 0xA5, 0x90, 0xAD, 0xAE,
    0xAF, 0xB0, 0xB1, 0xB3,
];

fn key(vk: u16, up: bool) -> INPUT {
    let scan = unsafe { MapVirtualKeyW(vk as u32, MAPVK_VK_TO_VSC) } as u16;
    let mut flags = KEYBD_EVENT_FLAGS(0);
    if EXTENDED.contains(&vk) {
        flags |= KEYEVENTF_EXTENDEDKEY;
    }
    if up {
        flags |= KEYEVENTF_KEYUP;
    }
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
}

fn send_keys(vks: &[u16]) -> Result<(), String> {
    if vks.is_empty() || vks.len() > 5 {
        return Err("a key combination needs 1 to 5 keys".into());
    }
    // Press in order, then release in reverse, with small gaps (some apps poll key state).
    for &vk in vks {
        unsafe { SendInput(&[key(vk, false)], std::mem::size_of::<INPUT>() as i32) };
        std::thread::sleep(std::time::Duration::from_millis(20));
    }
    std::thread::sleep(std::time::Duration::from_millis(40));
    for &vk in vks.iter().rev() {
        unsafe { SendInput(&[key(vk, true)], std::mem::size_of::<INPUT>() as i32) };
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    Ok(())
}

pub(crate) fn open(target: &str, args: &str) -> Result<(), String> {
    let target = target.trim();
    if target.is_empty() {
        return Err("nothing to open".into());
    }
    let file = HSTRING::from(target);
    let params = HSTRING::from(args);
    let result = unsafe {
        // Microsoft says to set up COM (single-threaded) before ShellExecute. If this thread already
        // has it, the error doesn't matter.
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
        ShellExecuteW(
            None,
            &HSTRING::from("open"),
            &file,
            if args.is_empty() {
                PCWSTR::null()
            } else {
                PCWSTR(params.as_ptr())
            },
            PCWSTR::null(),
            SW_SHOWNORMAL,
        )
    };
    // ShellExecute returns a value > 32 on success.
    if result.0 as isize > 32 {
        Ok(())
    } else {
        Err(format!("Windows couldn't open {target}"))
    }
}

pub fn run(action: Action) -> Result<(), String> {
    match action {
        Action::Run { target, args } => open(&target, &args),
        Action::Keys { vks } => send_keys(&vks),
    }
}
