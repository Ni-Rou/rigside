//! Is something full screen on any monitor (other than the desktop)? If so we assume it's a game
//! and let the scenes slow down.

use windows::Win32::Foundation::{HWND, RECT};
use windows::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
use windows::Win32::UI::WindowsAndMessaging::{GetClassNameW, GetForegroundWindow, GetWindowRect};

const DESKTOP_CLASSES: [&str; 3] = ["Progman", "WorkerW", "Shell_TrayWnd"];

pub fn fullscreen_foreground(own: Option<HWND>) -> bool {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() || Some(hwnd) == own {
            return false;
        }
        let mut cls = [0u16; 64];
        let n = GetClassNameW(hwnd, &mut cls) as usize;
        let name = String::from_utf16_lossy(&cls[..n]);
        if DESKTOP_CLASSES.contains(&name.as_str()) {
            return false;
        }
        let mut rect = RECT::default();
        if GetWindowRect(hwnd, &mut rect).is_err() {
            return false;
        }
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if !GetMonitorInfoW(MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST), &mut info).as_bool() {
            return false;
        }
        let m = info.rcMonitor;
        rect.left <= m.left && rect.top <= m.top && rect.right >= m.right && rect.bottom >= m.bottom
    }
}
