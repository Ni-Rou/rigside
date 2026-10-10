//! All the COM stuff runs on one long-lived thread.
//!
//! Core Audio and the media session objects are only ever made and used here, so none of it touches
//! Tauri's main thread (that one belongs to WebView2) and nothing gets passed between threads.
//! Commands send it a closure and wait for the answer.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::Mutex;
use std::time::Duration;

use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};

type Job = Box<dyn FnOnce() + Send>;

// The current worker. Some apps' media sessions can hang a WinRT call forever, so if a call never
// comes back we give up on that thread and start a new one. The generation number lets a call that
// timed out tell whether its worker has already been replaced.
static WORKER: Mutex<Option<(u64, Sender<Job>)>> = Mutex::new(None);
static GENERATION: AtomicU64 = AtomicU64::new(0);

fn spawn_worker() -> Result<Sender<Job>, String> {
    let (tx, rx) = channel::<Job>();
    std::thread::Builder::new()
        .name("com".into())
        .spawn(move || {
            // SAFETY: once per thread, before any COM use on it.
            unsafe {
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            }
            for job in rx {
                job();
            }
        })
        .map_err(|e| format!("couldn't start the COM worker: {e}"))?;
    Ok(tx)
}

fn worker() -> Result<(u64, Sender<Job>), String> {
    let mut w = crate::lock(&WORKER);
    if w.is_none() {
        *w = Some((GENERATION.fetch_add(1, Ordering::Relaxed), spawn_worker()?));
    }
    Ok(w.as_ref().expect("just set").clone())
}

/// Run `f` on the COM thread and wait (up to 5 s) for its result.
pub fn run<T: Send + 'static>(f: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    let (tx, rx) = channel();
    let (generation, sender) = worker()?;
    sender
        .send(Box::new(move || {
            let _ = tx.send(f());
        }))
        .map_err(|_| "COM worker stopped".to_string())?;
    rx.recv_timeout(Duration::from_secs(5)).map_err(|_| {
        // Stuck: start a new worker for the next call (unless another call already did).
        let mut w = crate::lock(&WORKER);
        if w.as_ref().is_some_and(|(g, _)| *g == generation) {
            *w = None;
        }
        crate::log::write("com", "a Windows call timed out; starting a new worker thread");
        "timed out talking to Windows".to_string()
    })?
}

/// Initialise COM (MTA) on the calling thread; for threads other than the worker (visualiser).
pub fn init_thread() {
    // SAFETY: harmless if the thread is already in the MTA.
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
}

pub fn err(e: windows::core::Error) -> String {
    e.message().to_string()
}
