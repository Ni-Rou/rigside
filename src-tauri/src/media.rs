//! What's playing, from the Windows media session. Works with anything that shows up in the media
//! controls: Spotify, browsers, VLC, games...
//!
//! A session that's actually playing wins, otherwise we take the one Windows calls current. Apps only
//! report their position every so often, so we move it along ourselves from the last update. Album
//! art goes over as a data URL, and only when it changes (the caller tells us which one it has).

use std::cell::RefCell;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;
use serde::Serialize;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession as Session, GlobalSystemMediaTransportControlsSessionManager as Manager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
};
use windows::Storage::Streams::{Buffer, DataReader, InputStreamOptions};

use crate::com;

#[derive(Serialize, Clone)]
pub struct Media {
    title: String,
    artist: String,
    album: String,
    app: String,
    state: &'static str,
    position: f64,
    duration: f64,
    can_next: bool,
    can_prev: bool,
    art_key: Option<String>,
    /// Only filled when the caller doesn't already have `art_key`.
    art: Option<String>,
}

thread_local! {
    // Lives on the COM worker thread only.
    static MANAGER: RefCell<Option<Manager>> = const { RefCell::new(None) };
    static ART: RefCell<Option<(String, String)>> = const { RefCell::new(None) }; // (key, data URL)
}

const TICKS_PER_S: f64 = 10_000_000.0;
// WinRT DateTime: 100 ns ticks since 1601-01-01 UTC.
const EPOCH_1601_TO_1970_S: f64 = 11_644_473_600.0;

fn manager() -> windows::core::Result<Manager> {
    MANAGER.with(|m| {
        if let Some(mgr) = m.borrow().as_ref() {
            return Ok(mgr.clone());
        }
        let mgr = Manager::RequestAsync()?.join()?;
        *m.borrow_mut() = Some(mgr.clone());
        Ok(mgr)
    })
}

fn session() -> windows::core::Result<Option<Session>> {
    let mgr = manager()?;
    for s in mgr.GetSessions()? {
        if s.GetPlaybackInfo()?.PlaybackStatus()? == Status::Playing {
            return Ok(Some(s));
        }
    }
    Ok(mgr.GetCurrentSession().ok())
}

fn app_label(id: &str) -> String {
    let low = id.to_lowercase();
    for (k, v) in [
        ("spotify", "Spotify"),
        ("brave", "Brave"),
        ("chrome", "Chrome"),
        ("msedge", "Edge"),
        ("firefox", "Firefox"),
        ("vlc", "VLC"),
        ("zunemusic", "Media Player"),
        ("discord", "Discord"),
    ] {
        if low.contains(k) {
            return v.to_string();
        }
    }
    let last = id.rsplit('!').next().unwrap_or(id);
    last.trim_end_matches(".exe").trim_end_matches(".EXE").to_string()
}

fn key_for(parts: &[&str]) -> String {
    // FNV-1a: stable, tiny, good enough to notice a new track.
    let mut h: u64 = 0xcbf29ce484222325;
    for p in parts {
        for b in p.bytes().chain(std::iter::once(0)) {
            h ^= b as u64;
            h = h.wrapping_mul(0x100000001b3);
        }
    }
    format!("{h:016x}")
}

fn read_art(
    props: &windows::Media::Control::GlobalSystemMediaTransportControlsSessionMediaProperties,
) -> Option<String> {
    let thumb = props.Thumbnail().ok()?;
    let stream = thumb.OpenReadAsync().ok()?.join().ok()?;
    let size = stream.Size().ok()? as u32;
    if size == 0 || size > 8_000_000 {
        return None;
    }
    let buf = Buffer::Create(size).ok()?;
    let filled = stream
        .ReadAsync(&buf, size, InputStreamOptions::ReadAhead)
        .ok()?
        .join()
        .ok()?;
    let len = filled.Length().ok()? as usize;
    let reader = DataReader::FromBuffer(&filled).ok()?;
    let mut bytes = vec![0u8; len];
    reader.ReadBytes(&mut bytes).ok()?;
    let ctype = stream.ContentType().map(|s| s.to_string()).unwrap_or_default();
    let ctype = if ctype.starts_with("image/") {
        ctype
    } else {
        "image/png".into()
    };
    Some(format!(
        "data:{ctype};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

fn info(have_art: Option<String>) -> windows::core::Result<Option<Media>> {
    let Some(s) = session()? else { return Ok(None) };
    let props = s.TryGetMediaPropertiesAsync()?.join()?;
    let pb = s.GetPlaybackInfo()?;
    let tl = s.GetTimelineProperties()?;
    let status = pb.PlaybackStatus()?;
    let controls = pb.Controls()?;
    let duration = (tl.EndTime()?.Duration - tl.StartTime()?.Duration) as f64 / TICKS_PER_S;
    let mut position = tl.Position()?.Duration as f64 / TICKS_PER_S;
    if status == Status::Playing && duration > 0.0 {
        let updated = tl.LastUpdatedTime()?.UniversalTime as f64 / TICKS_PER_S - EPOCH_1601_TO_1970_S;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs_f64())
            .unwrap_or(0.0);
        if updated > 0.0 && now > updated {
            position = (position + (now - updated)).min(duration);
        }
    }
    let app_id = s.SourceAppUserModelId().map(|h| h.to_string()).unwrap_or_default();
    let title = props.Title().map(|h| h.to_string()).unwrap_or_default();
    let artist = props.Artist().map(|h| h.to_string()).unwrap_or_default();
    let album = props.AlbumTitle().map(|h| h.to_string()).unwrap_or_default();
    let key = key_for(&[&app_id, &title, &artist, &album]);

    // "-" means the caller never wants art (the overlay), so don't even read it.
    let no_art = have_art.as_deref() == Some("-");
    let cached = ART.with(|a| {
        a.borrow()
            .as_ref()
            .filter(|(k, _)| *k == key)
            .map(|(_, url)| url.clone())
    });
    let art_url = match cached {
        Some(url) => Some(url),
        None if no_art => None,
        None => {
            let url = read_art(&props);
            ART.with(|a| *a.borrow_mut() = url.as_ref().map(|u| (key.clone(), u.clone())));
            url
        }
    };
    let art_key = art_url.as_ref().map(|_| key.clone());
    let art = if !no_art && art_key.is_some() && have_art.as_deref() != art_key.as_deref() {
        art_url
    } else {
        None
    };

    Ok(Some(Media {
        title,
        artist,
        album,
        app: app_label(&app_id),
        state: match status {
            Status::Playing => "playing",
            Status::Paused => "paused",
            _ => "stopped",
        },
        position: (position * 10.0).round() / 10.0,
        duration: (duration.max(0.0) * 10.0).round() / 10.0,
        can_next: controls.IsNextEnabled().unwrap_or(false),
        can_prev: controls.IsPreviousEnabled().unwrap_or(false),
        art_key,
        art,
    }))
}

pub fn get(have_art: Option<String>) -> Result<Option<Media>, String> {
    com::run(move || info(have_art).map_err(com::err))
}

pub fn control(cmd: String) -> Result<bool, String> {
    com::run(move || {
        let Some(s) = session().map_err(com::err)? else {
            return Ok(false);
        };
        let op = match cmd.as_str() {
            "play_pause" => s.TryTogglePlayPauseAsync(),
            "next" => s.TrySkipNextAsync(),
            "prev" => s.TrySkipPreviousAsync(),
            _ => return Err(format!("unknown media command {cmd}")),
        };
        op.and_then(|o| o.join()).map_err(com::err)
    })
}
