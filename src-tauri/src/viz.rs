//! Live audio levels for the visualiser. Grabs whatever Windows is playing through WASAPI loopback on
//! the default output and turns it into BANDS spectrum bands (log spaced) plus left/right levels.
//!
//! It only runs while something's watching: the capture thread starts on the first request and stops
//! IDLE after the last one. It follows the default output if you switch it.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use rustfft::{num_complex::Complex, FftPlanner};
use serde::Serialize;
use windows::Win32::Media::Audio::{
    eConsole, eRender, IAudioCaptureClient, IAudioClient, IMMDeviceEnumerator, MMDeviceEnumerator,
    AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK,
};
use windows::Win32::System::Com::{CoCreateInstance, CoTaskMemFree, CLSCTX_ALL};

use crate::com;

pub const BANDS: usize = 24;
const FFT_N: usize = 2048;
const F_LO: f32 = 40.0;
const F_HI: f32 = 16000.0;
const DB_FLOOR: f32 = -72.0;
const DB_CEIL: f32 = -12.0;
const IDLE: Duration = Duration::from_secs(5);
const DEVICE_CHECK: Duration = Duration::from_secs(2);
const AUDCLNT_BUFFERFLAGS_SILENT: u32 = 0x2;

#[derive(Serialize, Clone)]
pub struct Levels {
    bands: Vec<f32>,
    left: f32,
    right: f32,
    error: Option<String>,
}

impl Levels {
    fn silent() -> Self {
        Levels {
            bands: vec![0.0; BANDS],
            left: 0.0,
            right: 0.0,
            error: None,
        }
    }
}

struct Shared {
    levels: Levels,
    wanted_at: Instant,
}

static SHARED: OnceLock<Mutex<Shared>> = OnceLock::new();
static RUNNING: AtomicBool = AtomicBool::new(false);

fn shared() -> &'static Mutex<Shared> {
    SHARED.get_or_init(|| {
        Mutex::new(Shared {
            levels: Levels::silent(),
            wanted_at: Instant::now(),
        })
    })
}

fn wanted() -> bool {
    shared().lock().map(|s| s.wanted_at.elapsed() < IDLE).unwrap_or(false)
}

fn set_error(e: Option<String>) {
    if let Ok(mut s) = shared().lock() {
        s.levels.error = e;
    }
}

fn to_level(db: f32) -> f32 {
    ((db - DB_FLOOR) / (DB_CEIL - DB_FLOOR)).clamp(0.0, 1.0)
}

pub fn get() -> Levels {
    let out = {
        let mut s = crate::lock(shared());
        s.wanted_at = Instant::now();
        s.levels.clone()
    };
    if !RUNNING.swap(true, Ordering::SeqCst) {
        let spawned = std::thread::Builder::new().name("visualiser".into()).spawn(|| {
            com::init_thread();
            while wanted() {
                if let Err(e) = capture() {
                    set_error(Some(com::err(e)));
                    std::thread::sleep(Duration::from_secs(1));
                }
            }
            if let Ok(mut s) = shared().lock() {
                s.levels = Levels::silent();
            }
            RUNNING.store(false, Ordering::SeqCst);
        });
        if spawned.is_err() {
            RUNNING.store(false, Ordering::SeqCst);
        }
    }
    out
}

struct Analyser {
    fft: std::sync::Arc<dyn rustfft::Fft<f32>>,
    window: Vec<f32>,
    edges: Vec<(usize, usize)>,
    prev: Vec<f32>,
}

impl Analyser {
    fn new(rate: f32) -> Self {
        let fft = FftPlanner::new().plan_fft_forward(FFT_N);
        let window = (0..FFT_N)
            .map(|i| 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / (FFT_N - 1) as f32).cos())
            .collect();
        let bin = |f: f32| ((f / rate * FFT_N as f32).round() as usize).clamp(1, FFT_N / 2 - 1);
        let ratio = (F_HI / F_LO).powf(1.0 / BANDS as f32);
        // Low bands are narrower than one bin: give each at least the bin nearest its centre.
        let edges = (0..BANDS)
            .map(|i| {
                let lo = F_LO * ratio.powi(i as i32);
                let hi = lo * ratio;
                let (a, b) = (bin(lo), bin(hi));
                if b > a {
                    (a, b)
                } else {
                    let c = bin((lo * hi).sqrt());
                    (c, c + 1)
                }
            })
            .collect();
        Analyser {
            fft,
            window,
            edges,
            prev: vec![0.0; BANDS],
        }
    }

    fn run(&mut self, mono: &[f32], left_rms: f32, right_rms: f32) -> Levels {
        let mut buf: Vec<Complex<f32>> = mono
            .iter()
            .zip(&self.window)
            .map(|(s, w)| Complex::new(s * w, 0.0))
            .collect();
        self.fft.process(&mut buf);
        let scale = FFT_N as f32 / 4.0;
        let mut bands = Vec::with_capacity(BANDS);
        for (i, &(a, b)) in self.edges.iter().enumerate() {
            let mag = buf[a..b].iter().map(|c| c.norm() / scale).fold(0.0f32, f32::max);
            let level = to_level(20.0 * (mag + 1e-9).log10());
            // fast attack, slower fall, so it reads as music rather than noise
            let v = if level > self.prev[i] {
                level
            } else {
                self.prev[i] * 0.78 + level * 0.22
            };
            self.prev[i] = v;
            bands.push((v * 1000.0).round() / 1000.0);
        }
        Levels {
            bands,
            left: to_level(20.0 * (left_rms + 1e-9).log10()),
            right: to_level(20.0 * (right_rms + 1e-9).log10()),
            error: None,
        }
    }
}

fn capture() -> windows::core::Result<()> {
    unsafe {
        let en: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let dev = en.GetDefaultAudioEndpoint(eRender, eConsole)?;
        let dev_id = crate::audio::device_id(&dev)?;
        let client: IAudioClient = dev.Activate(CLSCTX_ALL, None)?;
        let fmt = client.GetMixFormat()?;
        // Shared-mode mix formats are 32-bit float on every supported Windows version.
        let channels = (*fmt).nChannels.max(1) as usize;
        let rate = (*fmt).nSamplesPerSec as f32;
        let bits = (*fmt).wBitsPerSample;
        let init = client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK,
            2_000_000,
            0,
            fmt,
            None,
        );
        CoTaskMemFree(Some(fmt as *const _));
        init?;
        if bits != 32 {
            set_error(Some("Unsupported audio format".into()));
            std::thread::sleep(Duration::from_secs(2));
            return Ok(());
        }
        let cap: IAudioCaptureClient = client.GetService()?;
        client.Start()?;
        set_error(None);

        let mut analyser = Analyser::new(rate);
        let mut ring = vec![0.0f32; FFT_N];
        let mut pos = 0usize; // next write index: ring[pos..] then ring[..pos] is oldest to newest
        let mut linear = vec![0.0f32; FFT_N];
        let (mut sum_l, mut sum_r, mut count) = (0.0f32, 0.0f32, 0usize);
        let mut checked = Instant::now();
        let mut last_packet = Instant::now();
        let mut last_frame = Instant::now();
        while wanted() {
            std::thread::sleep(Duration::from_millis(15));
            while cap.GetNextPacketSize()? > 0 {
                let mut data = std::ptr::null_mut();
                let mut frames = 0u32;
                let mut flags = 0u32;
                cap.GetBuffer(&mut data, &mut frames, &mut flags, None, None)?;
                // Shared-mode buffers are float32 and always 4-byte aligned in practice. If one ever
                // isn't, treat it as silence rather than read it unaligned.
                let silent =
                    flags & AUDCLNT_BUFFERFLAGS_SILENT != 0 || data.is_null() || !(data as usize).is_multiple_of(4);
                let samples: &[f32] = if silent {
                    &[]
                } else {
                    std::slice::from_raw_parts(data.cast::<f32>(), frames as usize * channels)
                };
                for f in 0..frames as usize {
                    let (l, r) = if silent {
                        (0.0, 0.0)
                    } else {
                        let l = samples[f * channels];
                        (l, if channels > 1 { samples[f * channels + 1] } else { l })
                    };
                    ring[pos] = (l + r) * 0.5;
                    pos = (pos + 1) % FFT_N;
                    sum_l += l * l;
                    sum_r += r * r;
                    count += 1;
                }
                cap.ReleaseBuffer(frames)?;
                last_packet = Instant::now();
            }
            // Loopback sends nothing when nothing's playing, so fade out rather than freeze.
            if last_packet.elapsed() > Duration::from_millis(150) {
                ring.iter_mut().for_each(|s| *s = 0.0);
            }
            if last_frame.elapsed() >= Duration::from_millis(30) {
                last_frame = Instant::now();
                linear[..FFT_N - pos].copy_from_slice(&ring[pos..]);
                linear[FFT_N - pos..].copy_from_slice(&ring[..pos]);
                let n = count.max(1) as f32;
                let levels = analyser.run(&linear, (sum_l / n).sqrt(), (sum_r / n).sqrt());
                (sum_l, sum_r, count) = (0.0, 0.0, 0);
                if let Ok(mut s) = shared().lock() {
                    s.levels = levels;
                }
            }
            if checked.elapsed() > DEVICE_CHECK {
                checked = Instant::now();
                if crate::audio::device_id(&en.GetDefaultAudioEndpoint(eRender, eConsole)?)? != dev_id {
                    break; // output switched: reopen on the new device
                }
            }
        }
        client.Stop()?;
        Ok(())
    }
}
