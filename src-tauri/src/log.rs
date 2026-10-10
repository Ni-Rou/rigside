//! A small error log in %APPDATA%\io.github.rigside\rigside.log: Rust panics, errors from the UI and
//! anything else worth knowing later, since the release build has no console. Once it gets past MAX
//! bytes it rolls over to rigside.log.old.

use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

const MAX: u64 = 512 * 1024;
const MAX_JS_PER_RUN: u32 = 200;

static PATH: OnceLock<Option<PathBuf>> = OnceLock::new();
static JS_COUNT: AtomicU32 = AtomicU32::new(0);

fn path() -> Option<&'static PathBuf> {
    PATH.get_or_init(|| {
        std::env::var_os("APPDATA").map(|d| PathBuf::from(d).join("io.github.rigside").join("rigside.log"))
    })
    .as_ref()
}

/// UTC time as "YYYY-MM-DD HH:MM:SS", without pulling in a whole date crate.
fn stamp() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (days, rem) = (secs / 86_400, secs % 86_400);
    // civil-from-days (Howard Hinnant)
    let z = days as i64 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!(
        "{y:04}-{m:02}-{d:02} {:02}:{:02}:{:02}",
        rem / 3600,
        (rem % 3600) / 60,
        rem % 60
    )
}

pub fn write(kind: &str, msg: &str) {
    let Some(p) = path() else { return };
    if let Some(dir) = p.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    if std::fs::metadata(p).map(|m| m.len() > MAX).unwrap_or(false) {
        let _ = std::fs::rename(p, p.with_extension("log.old"));
    }
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(p) {
        let msg: String = msg.chars().take(4000).collect();
        let _ = writeln!(f, "{} [{kind}] {}", stamp(), msg.replace('\n', "\n    "));
    }
}

/// Front-end errors, capped per run so a broken loop can't fill the disk.
pub fn js(msg: &str) {
    if JS_COUNT.fetch_add(1, Ordering::Relaxed) < MAX_JS_PER_RUN {
        write("js", msg);
    }
}

pub fn install_panic_hook() {
    let default = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        write("panic", &format!("{info}"));
        default(info);
    }));
}

pub fn location() -> String {
    path().map(|p| p.display().to_string()).unwrap_or_default()
}
