//! Rigside's Rust side.
//!
//! The UI is plain HTML/CSS/JS in `src/`. Anything that needs Windows lives in here and the UI calls
//! it as a Tauri command. Nothing gets sampled unless a window asks for it.

mod audio;
mod com;
mod game;
mod hwinfo;
mod log;
mod macros;
mod media;
mod stats;
mod viz;

use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};

use serde::Serialize;
use serde_json::{json, Value};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
    WindowEvent,
};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

/// Lock a mutex, and if another thread panicked while holding it just carry on with the data.
/// The panic is already in the log and the data is still the last good value.
pub(crate) fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

const DEFAULT_OVERLAY_HOTKEY: &str = "Ctrl+Shift+O";
const REPO: &str = "https://github.com/Ni-Rou/rigside";

struct AppState {
    settings: Mutex<Value>,
    path: PathBuf,
    /// The overlay hotkey currently registered, so saves that don't change it don't re-register.
    hotkey: Mutex<Option<String>>,
}

// Remember size, position, maximised and full screen. Not visibility, because a window that was
// hidden in the tray when Rigside quit still has to open next time. And not decorations, because the
// main window draws its own title strip.
fn state_flags() -> StateFlags {
    StateFlags::all() - StateFlags::VISIBLE - StateFlags::DECORATIONS
}

fn setting<'a>(s: &'a Value, key: &str) -> Option<&'a Value> {
    s.get(key).filter(|v| !v.is_null())
}

fn close_to_tray(app: &AppHandle) -> bool {
    let st = app.state::<AppState>();
    let s = lock(&st.settings);
    setting(&s, "close_to_tray").and_then(Value::as_bool).unwrap_or(true)
}

// Settings (the front end owns the schema; Rust reads a few keys)

#[tauri::command]
fn get_settings(state: tauri::State<AppState>) -> Value {
    lock(&state.settings).clone()
}

#[tauri::command]
fn save_settings(app: AppHandle, state: tauri::State<AppState>, settings: Value) -> Result<(), String> {
    if !settings.is_object() {
        return Err("settings must be an object".into());
    }
    let mut settings = settings;
    {
        let mut cur = lock(&state.settings);
        // Keys only Rust writes (overlay position) survive saves from the front end.
        if let (Some(new), Some(pos)) = (settings.as_object_mut(), cur.get("overlay_pos").cloned()) {
            new.insert("overlay_pos".into(), pos);
        }
        write_settings(&state.path, &settings)?;
        *cur = settings;
    }
    let result = register_hotkey(&app);
    if result.is_err() {
        // The new hotkey was refused so the old one's still active. Save that one, or we'd try (and
        // fail) the bad one again every time it starts.
        let active = state
            .hotkey
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
            .unwrap_or_default();
        let mut cur = lock(&state.settings);
        if let Some(obj) = cur.as_object_mut() {
            obj.insert("overlay_hotkey".into(), json!(active));
        }
        let _ = write_settings(&state.path, &cur);
    }
    // Other windows (the overlay) pick up the change too.
    let _ = app.emit("settings-changed", ());
    result
}

fn write_settings(path: &PathBuf, settings: &Value) -> Result<(), String> {
    let text = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    // Write to a temp file then rename, so a crash never leaves half a settings file.
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, text).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())
}

/// Read settings.json. Copes with a byte-order mark (Notepad and PowerShell add one). If the file is
/// there but isn't valid, it's kept as settings.json.bad so the next save doesn't quietly wipe it.
fn load_settings(path: &PathBuf) -> Value {
    let Ok(text) = std::fs::read_to_string(path) else {
        return json!({});
    };
    match serde_json::from_str::<Value>(text.trim_start_matches('\u{feff}')) {
        Ok(v) if v.is_object() => v,
        other => {
            let why = other
                .err()
                .map(|e| e.to_string())
                .unwrap_or_else(|| "not an object".into());
            log::write(
                "settings",
                &format!(
                    "couldn't read {}: {why}; keeping a copy as settings.json.bad",
                    path.display()
                ),
            );
            let _ = std::fs::copy(path, path.with_extension("json.bad"));
            json!({})
        }
    }
}

// PC, media, audio, visualiser, macros

#[tauri::command]
async fn pc_stats() -> stats::Stats {
    tauri::async_runtime::spawn_blocking(stats::get)
        .await
        .unwrap_or_default()
}

#[tauri::command]
async fn media_state(have_art: Option<String>) -> Result<Option<Value>, String> {
    let m = media::get(have_art)?;
    Ok(m.map(|m| serde_json::to_value(m).unwrap_or(Value::Null)))
}

#[tauri::command]
async fn media_control(cmd: String) -> Result<bool, String> {
    media::control(cmd)
}

#[tauri::command]
async fn audio_state() -> Result<audio::Audio, String> {
    audio::get()
}

#[tauri::command]
async fn set_volume(level: u32) -> Result<audio::Audio, String> {
    audio::set_volume(level)
}

#[tauri::command]
async fn toggle_mute() -> Result<audio::Audio, String> {
    audio::toggle_mute()
}

#[tauri::command]
async fn toggle_mic() -> Result<audio::Audio, String> {
    audio::toggle_mic()
}

#[tauri::command]
async fn set_output(id: String) -> Result<audio::Audio, String> {
    audio::set_output(id)
}

#[tauri::command]
fn viz_levels() -> viz::Levels {
    viz::get()
}

#[tauri::command]
async fn run_macro(action: macros::Action) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || macros::run(action))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn gaming(window: WebviewWindow) -> bool {
    let own = window.hwnd().ok().map(|h| windows::Win32::Foundation::HWND(h.0));
    game::fullscreen_foreground(own)
}

// Window placement

#[derive(Serialize)]
struct MonitorInfo {
    index: usize,
    name: String,
    width: u32,
    height: u32,
    current: bool,
}

#[tauri::command]
async fn monitors(window: WebviewWindow) -> Vec<MonitorInfo> {
    let current = window.current_monitor().ok().flatten().map(|m| *m.position());
    window
        .available_monitors()
        .unwrap_or_default()
        .iter()
        .enumerate()
        .map(|(i, m)| MonitorInfo {
            index: i,
            name: m.name().cloned().unwrap_or_else(|| format!("Display {}", i + 1)),
            width: m.size().width,
            height: m.size().height,
            current: Some(*m.position()) == current,
        })
        .collect()
}

/// Move the main window to a monitor and fill it (borderless full screen), or just centre it.
#[tauri::command]
async fn move_to_monitor(window: WebviewWindow, index: usize, fill: bool) -> Result<(), String> {
    let mons = window.available_monitors().map_err(|e| e.to_string())?;
    let m = mons.get(index).ok_or("no such monitor")?;
    let _ = window.set_fullscreen(false);
    let (pos, size) = (*m.position(), *m.size());
    let w = (size.width as f64 * 0.7) as u32;
    let h = (size.height as f64 * 0.7) as u32;
    window
        .set_position(PhysicalPosition::new(
            pos.x + (size.width - w) as i32 / 2,
            pos.y + (size.height - h) as i32 / 2,
        ))
        .map_err(|e| e.to_string())?;
    window.set_size(PhysicalSize::new(w, h)).map_err(|e| e.to_string())?;
    if fill {
        window.set_fullscreen(true).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn set_fullscreen(window: WebviewWindow, on: bool) -> Result<(), String> {
    window.set_fullscreen(on).map_err(|e| e.to_string())
}

#[tauri::command]
async fn is_fullscreen(window: WebviewWindow) -> bool {
    window.is_fullscreen().unwrap_or(false)
}

#[tauri::command]
async fn set_always_on_top(window: WebviewWindow, on: bool) -> Result<(), String> {
    window.set_always_on_top(on).map_err(|e| e.to_string())
}

// Overlay
//
// The overlay window is made once at startup and kept hidden. Making a webview window later from a
// command or the hotkey handler deadlocks the main thread on Windows.
// Its position lives in settings.json (overlay_pos) rather than the window-state plugin, so the
// plugin can never bring it back visible.

fn create_overlay(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let w = WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("overlay.html".into()))
        .title("Rigside overlay")
        .inner_size(420.0, 44.0)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .visible(false)
        .build()?;
    let pos = {
        let st = app.state::<AppState>();
        let s = lock(&st.settings);
        setting(&s, "overlay_pos").and_then(|p| Some((p.get("x")?.as_i64()?, p.get("y")?.as_i64()?)))
    };
    let on_screen = pos.filter(|&(x, y)| {
        w.available_monitors().unwrap_or_default().iter().any(|m| {
            let (mp, ms) = (m.position(), m.size());
            x >= mp.x as i64
                && y >= mp.y as i64
                && x < mp.x as i64 + ms.width as i64 - 40
                && y < mp.y as i64 + ms.height as i64 - 20
        })
    });
    let (x, y) = on_screen.unwrap_or_else(|| {
        let m = w.primary_monitor().ok().flatten();
        m.map(|m| (m.position().x as i64 + 24, m.position().y as i64 + 24))
            .unwrap_or((24, 24))
    });
    let _ = w.set_position(PhysicalPosition::new(x as i32, y as i32));
    let _ = w.set_ignore_cursor_events(true);
    Ok(w)
}

/// Remember where the overlay is (after it has been moved).
fn save_overlay_pos(app: &AppHandle, w: &WebviewWindow) {
    let Ok(p) = w.outer_position() else { return };
    let st = app.state::<AppState>();
    let mut s = lock(&st.settings);
    if let Some(obj) = s.as_object_mut() {
        obj.insert("overlay_pos".into(), json!({ "x": p.x, "y": p.y }));
    }
    let _ = write_settings(&st.path, &s);
}

fn set_overlay(app: &AppHandle, show: bool, edit: bool) -> Result<bool, String> {
    let w = app.get_webview_window("overlay").ok_or("overlay not ready")?;
    if show {
        w.set_ignore_cursor_events(!edit).map_err(|e| e.to_string())?;
        w.show().map_err(|e| e.to_string())?;
        w.set_always_on_top(true).map_err(|e| e.to_string())?;
        if !edit {
            save_overlay_pos(app, &w);
        }
    } else {
        save_overlay_pos(app, &w);
        w.hide().map_err(|e| e.to_string())?;
    }
    let _ = app.emit("overlay-mode", json!({ "show": show, "edit": edit }));
    Ok(show)
}

/// Show/hide the overlay. Shown overlays ignore the mouse unless being moved (`edit`).
#[tauri::command]
async fn overlay_set(app: AppHandle, show: bool, edit: Option<bool>) -> Result<bool, String> {
    set_overlay(&app, show, edit.unwrap_or(false))
}

#[tauri::command]
async fn overlay_visible(app: AppHandle) -> bool {
    overlay_is_visible(&app)
}

fn overlay_is_visible(app: &AppHandle) -> bool {
    app.get_webview_window("overlay")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false)
}

fn toggle_overlay(app: &AppHandle) {
    let visible = overlay_is_visible(app);
    let _ = set_overlay(app, !visible, false);
}

/// (Re)register the overlay hotkey from settings. If it fails (a typo, or another app already has
/// that combo) the error goes back to the UI so you can see why.
fn register_hotkey(app: &AppHandle) -> Result<(), String> {
    let st = app.state::<AppState>();
    let combo = {
        let s = lock(&st.settings);
        setting(&s, "overlay_hotkey")
            .and_then(Value::as_str)
            .unwrap_or(DEFAULT_OVERLAY_HOTKEY)
            .trim()
            .to_string()
    };
    let mut current = lock(&st.hotkey);
    if current.as_deref() == Some(combo.as_str()) {
        return Ok(());
    }
    let gs = app.global_shortcut();
    let previous = current.clone();
    let _ = gs.unregister_all();
    if combo.is_empty() {
        *current = Some(combo);
        return Ok(());
    }
    match gs.on_shortcut(combo.as_str(), on_hotkey) {
        Ok(()) => {
            *current = Some(combo);
            Ok(())
        }
        Err(e) => {
            log::write("hotkey", &format!("{combo}: {e}"));
            // Put the old hotkey back so a typo doesn't leave you without one.
            *current = previous
                .filter(|p| !p.is_empty())
                .filter(|p| gs.on_shortcut(p.as_str(), on_hotkey).is_ok());
            let e = e.to_string();
            Err(if e.contains("recognize") || e.contains("parse") {
                format!("\"{combo}\" isn't a valid hotkey. Use something like Ctrl+Shift+O.")
            } else {
                format!("\"{combo}\" couldn't be set as the overlay hotkey. Another app may already use it.")
            })
        }
    }
}

fn on_hotkey(app: &AppHandle, _shortcut: &Shortcut, event: ShortcutEvent) {
    if event.state == ShortcutState::Pressed {
        toggle_overlay(app);
    }
}

/// Front-end errors (window.onerror / unhandled rejections) end up in rigside.log.
#[tauri::command]
fn log_js(msg: String) {
    log::js(&msg);
}

#[tauri::command]
fn log_path() -> String {
    log::location()
}

// Start with Windows

#[tauri::command]
async fn autostart_get(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
async fn autostart_set(app: AppHandle, on: bool) -> Result<bool, String> {
    let al = app.autolaunch();
    if on { al.enable() } else { al.disable() }.map_err(|e| e.to_string())?;
    Ok(al.is_enabled().unwrap_or(on))
}

// Updates (GitHub releases, signed)

/// Look for a newer release. None if we're up to date, an error if we're offline or there's no feed.
#[tauri::command]
async fn update_check(app: AppHandle) -> Result<Option<Value>, String> {
    use tauri_plugin_updater::UpdaterExt;
    let update = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;
    Ok(update.map(|u| json!({ "version": u.version, "current": u.current_version, "notes": u.body, "date": u.date.map(|d| d.to_string()) })))
}

/// Download and run the new installer. It closes Rigside, updates it and starts it again.
#[tauri::command]
async fn update_install(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    let update = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Already up to date")?;
    let _ = app.save_window_state(state_flags());
    update.download_and_install(|_, _| {}, || {}).await.map_err(|e| {
        log::write("update", &e.to_string());
        e.to_string()
    })?;
    app.restart();
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// `rigside --probe`: print what every data source returns, for bug reports.
fn probe() {
    println!(
        "{}",
        serde_json::to_string_pretty(&system_info(false)).unwrap_or_default()
    );
}

/// Everything Rigside reads from the PC, for bug reports. `private` leaves out what's playing (for
/// "Copy system info") so nobody ends up pasting their music into a public issue.
fn system_info(private: bool) -> Value {
    let _ = stats::get();
    viz::get();
    std::thread::sleep(std::time::Duration::from_millis(1000));
    let levels = viz::get();
    json!({
        "version": env!("CARGO_PKG_VERSION"),
        "windows": sysinfo::System::long_os_version(),
        "stats": stats::get(),
        "media": media::get(None).map(|m| m.map(|m| {
            let mut v = serde_json::to_value(m).unwrap_or_default();
            if let Some(a) = v.get_mut("art").filter(|a| a.is_string()) {
                *a = json!("<data url>");
            }
            if private {
                for k in ["title", "artist", "album"] {
                    if let Some(f) = v.get_mut(k).filter(|f| f.as_str().is_some_and(|s| !s.is_empty())) {
                        *f = json!("<hidden>");
                    }
                }
            }
            v
        })),
        "audio": audio::get(),
        "gaming": game::fullscreen_foreground(None),
        "viz": levels,
        "log": log::location(),
    })
}

// Bug reports

/// System info as text for the clipboard (Settings -> About).
#[tauri::command]
async fn copy_system_info() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| serde_json::to_string_pretty(&system_info(true)).unwrap_or_default())
        .await
        .map_err(|e| e.to_string())
}

/// Open the GitHub bug report form with the version and Windows version filled in.
#[tauri::command]
async fn report_problem() -> Result<(), String> {
    let enc = |s: &str| -> String {
        s.bytes()
            .map(|b| match b {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' => (b as char).to_string(),
                _ => format!("%{b:02X}"),
            })
            .collect()
    };
    let windows = sysinfo::System::long_os_version().unwrap_or_default();
    let url = format!(
        "{REPO}/issues/new?template=bug_report.yml&version={}&windows={}",
        enc(env!("CARGO_PKG_VERSION")),
        enc(&windows)
    );
    tauri::async_runtime::spawn_blocking(move || macros::open(&url, ""))
        .await
        .map_err(|e| e.to_string())?
}

/// Open the folder with rigside.log and settings.json in Explorer.
#[tauri::command]
async fn open_log_folder() -> Result<(), String> {
    let log = log::location();
    let dir = std::path::Path::new(&log)
        .parent()
        .map(|d| d.to_path_buf())
        .ok_or("log folder unknown")?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let dir = dir.display().to_string();
    tauri::async_runtime::spawn_blocking(move || macros::open(&dir, ""))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    log::install_panic_hook();
    if std::env::args().any(|a| a == "--probe") {
        probe();
        return;
    }
    tauri::Builder::default()
        // Has to be first: launching it again just brings the running one to the front.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(state_flags())
                .with_denylist(&["overlay"])
                .build(),
        )
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let path = app.path().app_config_dir()?.join("settings.json");
            let settings = load_settings(&path);
            app.manage(AppState {
                settings: Mutex::new(settings),
                path,
                hotkey: Mutex::new(None),
            });
            if let Err(e) = register_hotkey(app.handle()) {
                log::write("startup", &e);
            }

            let show = MenuItem::with_id(app, "show", "Show Rigside", true, None::<&str>)?;
            let ov = MenuItem::with_id(app, "overlay", "Toggle overlay", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &ov, &quit])?;
            TrayIconBuilder::with_id("tray")
                .icon(app.default_window_icon().cloned().ok_or("no icon")?)
                .tooltip("Rigside")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, e| match e.id.as_ref() {
                    "show" => show_main(app),
                    "overlay" => toggle_overlay(app),
                    "quit" => {
                        let _ = app.save_window_state(state_flags());
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, e| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = e
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;

            let ov_on = {
                let st = app.state::<AppState>();
                let s = lock(&st.settings);
                setting(&s, "overlay_on_start")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
            };
            create_overlay(app.handle())?;
            if ov_on {
                let _ = set_overlay(app.handle(), true, false);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" && close_to_tray(window.app_handle()) {
                    api.prevent_close();
                    let _ = window.app_handle().save_window_state(state_flags());
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            update_check,
            update_install,
            copy_system_info,
            report_problem,
            open_log_folder,
            get_settings,
            save_settings,
            pc_stats,
            media_state,
            media_control,
            audio_state,
            set_volume,
            toggle_mute,
            toggle_mic,
            set_output,
            viz_levels,
            run_macro,
            gaming,
            monitors,
            move_to_monitor,
            set_fullscreen,
            is_fullscreen,
            set_always_on_top,
            overlay_set,
            overlay_visible,
            autostart_get,
            autostart_set,
            log_js,
            log_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Rigside");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("rigside-test-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir.join("settings.json")
    }

    #[test]
    fn settings_round_trip() {
        let p = temp("round");
        write_settings(&p, &json!({ "theme": "neon", "tabs": [1, 2] })).unwrap();
        assert_eq!(load_settings(&p), json!({ "theme": "neon", "tabs": [1, 2] }));
        assert!(!p.with_extension("json.tmp").exists(), "temp file renamed away");
    }

    #[test]
    fn settings_missing_file_is_empty() {
        assert_eq!(load_settings(&temp("missing")), json!({}));
    }

    #[test]
    fn settings_tolerate_byte_order_mark() {
        let p = temp("bom");
        std::fs::write(&p, "\u{feff}{\"theme\":\"deep\"}").unwrap();
        assert_eq!(load_settings(&p)["theme"], "deep");
    }

    #[test]
    fn broken_settings_are_kept_as_bad() {
        for (name, text) in [("broken", "{ not json"), ("array", "[1,2]")] {
            let p = temp(name);
            std::fs::write(&p, text).unwrap();
            assert_eq!(load_settings(&p), json!({}));
            assert_eq!(std::fs::read_to_string(p.with_extension("json.bad")).unwrap(), text);
        }
    }
}
