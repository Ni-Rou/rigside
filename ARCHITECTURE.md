# How it's put together

Rigside is a Tauri 2 app. The Rust side reads everything from the PC, and the front end in `src/` is plain
HTML, CSS and JS. There's no framework and no bundler, so you can open any file and just read it.

## The Rust side (`src-tauri/src`)

| File | What's in it |
| --- | --- |
| `lib.rs` | The commands the UI calls, the settings file, tray icon, overlay window, hotkey, start with Windows and updates |
| `com.rs` | A single worker thread that every COM/WinRT call goes through |
| `stats.rs` | CPU, RAM, drives and network (sysinfo), the GPU (NVML) and temperatures |
| `hwinfo.rs` | Reading HWiNFO's shared memory, if it's running |
| `media.rs` | What's playing in Windows, album art, play/pause/skip |
| `audio.rs` | Volume, mute, mic mute and switching the output device |
| `viz.rs` | Grabs what's playing through WASAPI loopback and runs an FFT for the visualiser |
| `macros.rs` | Opening apps, links and files, and pressing key combos |
| `game.rs` | Notices when a game is full screen so the scene can calm down |
| `log.rs` | Writes `rigside.log` to `%APPDATA%\io.github.rigside` |

Temperatures come from LibreHardwareMonitor's web server (its `data.json`) or HWiNFO's shared memory.
Rigside never installs a driver of its own.

`rigside.exe --probe` dumps everything it can read as JSON, which is the quickest way to see what's going on
on someone's PC.

## The front end (`src`)

- `js/app.js` does settings, the layout (everything is in rem, so it scales to any screen shape), the tabs,
  a small event bus and the little toast messages.
- Each tab has its own file: `home.js`, `weathertab.js`, `playing.js`, `pc.js`, `macros.js` and
  `settings.js`.
- `js/weather.js` talks to Open-Meteo for the forecast, air quality and place search.
- `js/mock.js` pretends to be the Rust side, so the whole UI works in a normal browser. Run
  `python tools/devserver.py` and open http://localhost:5173 to try it.
- `overlay.html` and `js/overlay.js` are the small always-on-top stats strip.

## Scenes

`js/scene.js` runs the animated background. A scene registers itself with
`RS_SCENE.register(id, { build, background, sky, land, frame })`. It can also set `short` (its height in
pixels, 180 by default) and `fps` (10 by default).

- `build(W, H)` makes the world once for each screen size. Use `RS_SCENE.rng(seed)` for anything random so
  it comes out the same every time.
- `background` and `land` are drawn once and cached until the light or the weather changes.
- `sky` goes behind the land and `frame` goes in front. Both are drawn every frame, so keep them cheap.

Everything is drawn small (180 px tall, or 144 for Pocket) and scaled up without smoothing, which keeps the
pixels sharp. `js/pixel.js` has the shared bits: a pixel buffer, dithered colour ramps, sky colours, night
tinting, ridgelines, sprites from strings and a tiny font, plus the atmosphere helpers (mist, soft glows,
smoke, light shafts, drifting specks, shooting stars, aurora and darker corners).

Scenes run at 10 or 12 fps (3 in Low power mode), stop when the window's hidden and can slow down or pause
while a game is full screen. In the browser, `?theme=<id>&bare&scene_time=22:30&scene_weather=snow` shows
any time and weather, and `RS_SCENE.bench(30)` in the console tells you how many milliseconds a frame takes.

## Releases

Push a `vX.Y.Z` tag and `.github/workflows/release.yml` builds the installer, signs the update files and
makes a draft release with `latest.json`. Nothing updates until you publish the draft. Make sure the version
in `tauri.conf.json`, `Cargo.toml` and `package.json` matches the tag first.
