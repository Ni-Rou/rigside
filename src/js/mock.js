"use strict";

/* Fakes the Rust side so the UI works in a normal browser, for working on it and taking screenshots.
   The app itself never loads this. The weather is still real, since Open-Meteo is happy with browsers. */
(() => {
  const KEY = "rs-mock-settings";
  const q = new URLSearchParams(location.search);
  let settings = {};
  try {
    settings = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    /* storage unavailable */
  }
  if (q.has("noloc"))
    delete settings.location; // first-run state
  else if (!settings.location)
    settings.location = { name: "Glasgow", admin: "Scotland", country: "United Kingdom", lat: 55.8642, lon: -4.2518 };
  if (q.get("theme")) settings.theme = q.get("theme");
  if (!settings.macros) {
    settings.macros = [
      {
        id: "a",
        label: "Discord mute",
        icon: "micoff",
        colour: "#a78bfa",
        action: { kind: "keys", vks: [0x11, 0x10, 0x4d] },
      },
      {
        id: "b",
        label: "Record that",
        icon: "record",
        colour: "#ff5c6c",
        action: { kind: "keys", vks: [0x5b, 0x12, 0x47] },
      },
      { id: "c", label: "Steam", icon: "game", colour: "", action: { kind: "run", target: "steam://open/main" } },
      {
        id: "d",
        label: "Screenshot",
        icon: "screenshot",
        colour: "#2ee6c5",
        action: { kind: "keys", vks: [0x5b, 0x10, 0x53] },
      },
      {
        id: "e",
        label: "Downloads",
        icon: "folder",
        colour: "#ffb547",
        action: { kind: "run", target: "shell:Downloads" },
      },
      { id: "f", label: "Task Manager", icon: "gauge", colour: "", action: { kind: "keys", vks: [0x11, 0x10, 0x1b] } },
    ];
  }
  const ART =
    "data:image/svg+xml;base64," +
    btoa(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff2a6d"/><stop offset="1" stop-color="#05d9e8"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><circle cx="50" cy="50" r="28" fill="none" stroke="#fff" stroke-width="3" opacity=".8"/><circle cx="50" cy="50" r="6" fill="#fff"/></svg>`,
    );
  const TRACKS = [
    { title: "Midnight Overdrive", artist: "Synthwave Collective", album: "Neon Nights", duration: 241 },
    { title: "Harbour Lights", artist: "The Low Tides", album: "Coastline", duration: 198 },
  ];
  const state = {
    media: {
      title: "Midnight Overdrive",
      artist: "Synthwave Collective",
      album: "Neon Nights",
      app: "Spotify",
      state: "playing",
      position: 64,
      duration: 241,
      can_next: true,
      can_prev: true,
      art_key: "m1",
      started: Date.now(),
    },
    audio: {
      volume: 42,
      muted: false,
      mic_muted: false,
      output_id: "b",
      output: "Headphones (USB Audio)",
      output_headset: true,
      outputs: [
        { id: "a", name: "Speakers (Realtek(R) Audio)", headset: false },
        { id: "b", name: "Headphones (USB Audio)", headset: true },
        { id: "c", name: "LG ULTRAGEAR (NVIDIA High Definition Audio)", headset: false },
      ],
    },
  };
  const wobble = (base, amp, speed) =>
    base + Math.sin(Date.now() / 1000 / speed) * amp + (Math.random() - 0.5) * amp * 0.3;

  const CMDS = {
    get_settings: () => settings,
    save_settings: ({ settings: s }) => {
      settings = s;
      try {
        localStorage.setItem(KEY, JSON.stringify(s));
      } catch {
        /* ignore */
      }
    },
    pc_stats: () => ({
      cpu_name: "AMD Ryzen 7 9800X3D 8-Core Processor",
      cpu_load: wobble(23, 12, 7),
      cpu_temp: q.has("notemp") ? null : wobble(61, 6, 11),
      cores: 16,
      ram_used_gb: 16.8,
      ram_total_gb: 31.2,
      gpu: {
        name: "GeForce RTX 4070",
        load: Math.round(wobble(48, 25, 5)),
        temp: Math.round(wobble(57, 5, 13)),
        temp_max: 94,
        vram_used_mb: 5120,
        vram_total_mb: 12282,
        power_w: wobble(120, 40, 6),
        fan: 38,
      },
      disks: [
        { name: "C:", used_gb: 828.8, total_gb: 952.8 },
        { name: "D:", used_gb: 2451, total_gb: 3726 },
        { name: "E:", used_gb: 687.1, total_gb: 931.5 },
      ],
      net_down_bps: Math.max(0, wobble(2_400_000, 2_000_000, 3)),
      net_up_bps: Math.max(0, wobble(180_000, 120_000, 4)),
      uptime_s: 1757061,
      sensors: q.has("notemp") ? null : "lhm",
    }),
    media_state: ({ haveArt }) => {
      if (q.has("nomedia")) return null;
      const m = state.media,
        pos = m.state === "playing" ? (m.position + (Date.now() - m.started) / 1000) % m.duration : m.position;
      return { ...m, position: pos, art: haveArt === m.art_key ? null : ART };
    },
    media_control: ({ cmd }) => {
      const m = state.media;
      if (cmd === "play_pause") {
        m.position = CMDS.media_state({ haveArt: "m1" }).position;
        m.started = Date.now();
        m.state = m.state === "playing" ? "paused" : "playing";
      } else if (cmd === "next" || cmd === "prev") {
        const t =
          TRACKS[
            (TRACKS.findIndex((x) => x.title === m.title) + (cmd === "next" ? 1 : TRACKS.length - 1)) % TRACKS.length
          ];
        Object.assign(m, t, { position: 0, started: Date.now(), state: "playing" });
      }
      return true;
    },
    audio_state: () => state.audio,
    set_volume: ({ level }) => {
      state.audio.volume = level;
      return state.audio;
    },
    toggle_mute: () => {
      state.audio.muted = !state.audio.muted;
      return state.audio;
    },
    toggle_mic: () => {
      state.audio.mic_muted = !state.audio.mic_muted;
      return state.audio;
    },
    set_output: ({ id }) => {
      const o = state.audio.outputs.find((x) => x.id === id);
      Object.assign(state.audio, { output_id: id, output: o.name, output_headset: o.headset });
      return state.audio;
    },
    viz_levels: () => {
      const t = Date.now() / 1000;
      return {
        bands: Array.from({ length: 24 }, (_, i) =>
          Math.max(
            0,
            Math.min(
              1,
              0.75 - i * 0.022 + Math.sin(t * (3 + i * 0.4) + i) * 0.22 + (i < 4 && Math.sin(t * 8.3) > 0.4 ? 0.2 : 0),
            ),
          ),
        ),
        left: 0.7 + Math.sin(t * 6) * 0.15,
        right: 0.68 + Math.sin(t * 5.3) * 0.15,
      };
    },
    run_macro: ({ action }) => {
      console.log("macro", action);
    },
    gaming: () => q.has("gaming"),
    monitors: () => [
      { index: 0, name: "\\\\.\\DISPLAY1", width: 2560, height: 1440, current: false },
      { index: 1, name: "\\\\.\\DISPLAY2", width: 1024, height: 600, current: true },
    ],
    move_to_monitor: () => {},
    set_fullscreen: () => {},
    is_fullscreen: () => q.has("full"),
    set_always_on_top: () => {},
    overlay_set: ({ show }) => show,
    overlay_visible: () => location.pathname.endsWith("overlay.html"),
    autostart_get: () => false,
    autostart_set: ({ on }) => on,
    log_js: () => {},
    log_path: () => "(mock)",
    update_check: () =>
      new URLSearchParams(location.search).has("update")
        ? { version: "0.2.0", current: "0.1.0", notes: "New themes and fixes.", date: null }
        : null,
    update_install: () => new Promise((r) => setTimeout(r, 1500)),
    report_problem: () => {
      window.open("https://github.com/Ni-Rou/rigside/issues/new?template=bug_report.yml&version=0.1.0", "_blank");
    },
    open_log_folder: () => null,
    copy_system_info: () => JSON.stringify({ version: "0.1.0", windows: "Windows 11 (mock)" }, null, 2),
  };

  window.__TAURI__ = {
    core: {
      invoke: async (cmd, args = {}) => {
        if (!CMDS[cmd]) throw new Error(`mock: no command ${cmd}`);
        return structuredClone(CMDS[cmd](args) ?? null);
      },
    },
    event: { listen: async () => () => {} },
    // just enough of the window API for overlay.html
    window: {
      getCurrentWindow: () => ({
        setSize: async () => {},
        startDragging: async () => {},
        minimize: async () => console.info("mock: minimise"),
        toggleMaximize: async () => console.info("mock: maximise"),
        close: async () => console.info("mock: close"),
        isFullscreen: async () => q.has("full"), // ?full: as if full screen (no title strip)
        isMaximized: async () => false,
      }),
      LogicalSize: class {
        constructor(width, height) {
          Object.assign(this, { width, height });
        }
      },
    },
  };
})();
