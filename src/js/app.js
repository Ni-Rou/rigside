"use strict";

/* The main bits: settings, tabs (tap, swipe or arrow keys), the theme, fitting the layout to the
   screen, and invoke() for talking to the Rust side.
   A tab signs up with RS.tab(id, {interval, refresh, onShow, onHide}):
     interval  ms between refresh() calls while you're looking at it (number or function), 0 = never
     refresh   async, fetches and draws
   Only the tab on screen refreshes, and nothing polls while the window's hidden or minimised. */
const RS = (() => {
  const invoke = (cmd, args) => window.__TAURI__.core.invoke(cmd, args);

  // Settings
  const TAB_IDS = ["home", "weather", "playing", "pc", "macros"];
  const DEFAULTS = {
    tabs: TAB_IDS.map((id) => ({ id, on: true })),
    theme: "neon",
    location: null, // {name, admin, country, lat, lon}
    temp_unit: "c", // c | f
    wind_unit: "mph", // mph | kmh | ms
    clock_24h: true,
    clock_seconds: false,
    motion: "full", // full | low | off  (scene frame rate)
    gaming_motion: "same", // same | low | pause  (while a game is full screen)
    ui_scale: 1,
    outputs: [], // up to two favourite output device ids for the quick switch
    macros: [],
    overlay_hotkey: "Ctrl+Shift+O",
    overlay_on_start: false,
    overlay_items: { cpu: true, gpu: true, ram: true, clock: true },
    close_to_tray: true,
    always_on_top: false,
    update_check: true, // look for a new release at start-up (once a day at most)
  };
  let settings = structuredClone(DEFAULTS);

  async function loadSettings() {
    let saved = {};
    try {
      saved = (await invoke("get_settings")) || {};
    } catch (e) {
      console.warn(e);
    }
    settings = { ...structuredClone(DEFAULTS), ...saved };
    // If an update adds a tab, add it to the saved list too.
    const known = settings.tabs.filter((t) => TAB_IDS.includes(t.id));
    for (const id of TAB_IDS) if (!known.some((t) => t.id === id)) known.push({ id, on: true });
    settings.tabs = known;
  }

  // Saves wait a moment in case more changes come. set() resolves true once it's saved, or false if
  // Windows refused something (like a hotkey another app already has), after saying why.
  let saveTimer = null,
    waiting = [];
  function set(patch) {
    Object.assign(settings, patch);
    clearTimeout(saveTimer);
    const done = new Promise((resolve) => waiting.push(resolve));
    saveTimer = setTimeout(async () => {
      const resolvers = waiting;
      waiting = [];
      let ok = true;
      try {
        await invoke("save_settings", { settings });
      } catch (e) {
        ok = false;
        toast(String(e), 6000);
        // Rust put the working hotkey back, so use that one or the next save sends the bad one again.
        try {
          const kept = await invoke("get_settings");
          if (kept && "overlay_hotkey" in kept) settings.overlay_hotkey = kept.overlay_hotkey;
        } catch {
          /* not in the app */
        }
      }
      resolvers.forEach((r) => r(ok));
    }, 250);
    emit("settings", settings);
    return done;
  }

  // Tiny event bus
  const handlers = {};
  const on = (name, fn) => (handlers[name] ||= []).push(fn);
  const emit = (name, detail) =>
    (handlers[name] || []).forEach((fn) => {
      try {
        fn(detail);
      } catch (e) {
        console.error(e);
      }
    });

  // Layout: screen shape + scale
  // Everything's sized in rem and the root font size follows the window, so one layout works on a
  // 7" 800x480 panel, a 1920x480 bar or a 4K monitor. The reference sizes are where 1rem = 16px.
  const REF = { land: [819, 480], bar: [1600, 400], tall: [480, 900] };
  function layout() {
    const w = innerWidth,
      h = innerHeight,
      a = w / h;
    const shape = a >= 2.3 ? "bar" : a <= 0.8 ? "tall" : "land";
    const [rw, rh] = REF[shape];
    const px = Math.max(9, Math.min(56, 16 * Math.min(w / rw, h / rh) * (settings.ui_scale || 1)));
    const root = document.documentElement;
    root.style.fontSize = `${px.toFixed(2)}px`;
    if (root.dataset.shape !== shape) {
      root.dataset.shape = shape;
      emit("shape", shape);
    }
  }

  // Theme
  function applyTheme() {
    const id = (window.RS_THEMES || []).some((t) => t.id === settings.theme) ? settings.theme : "neon";
    document.documentElement.dataset.theme = id;
    emit("theme", id);
  }

  // Tabs
  const defs = {};
  let order = [];
  let index = 0;
  let timer = null;
  let gen = 0;

  const tab = (id, def) => {
    defs[id] = { interval: 5000, ...def };
  };
  const current = () => order[index];
  const visible = () => !document.hidden;

  function buildTabs() {
    order = settings.tabs.filter((t) => t.on).map((t) => t.id);
    if (!order.length) order = ["home"];
    const track = document.getElementById("track"),
      bar = document.getElementById("tabbar");
    for (const id of TAB_IDS) {
      const sec = document.getElementById(`tab-${id}`),
        btn = bar.querySelector(`[data-tab="${id}"]`);
      const on = order.includes(id);
      sec.hidden = !on;
      btn.hidden = !on;
    }
    order.forEach((id) => {
      track.appendChild(document.getElementById(`tab-${id}`));
      bar.appendChild(bar.querySelector(`[data-tab="${id}"]`));
    });
    bar.appendChild(document.getElementById("open-settings")); // the gear stays last
    bar.style.setProperty("--tabs", order.length);
    const keep = order.indexOf(current());
    show(keep >= 0 ? keep : Math.min(index, order.length - 1), false);
  }

  function setOffset(px = 0, animate = true) {
    const track = document.getElementById("track");
    track.style.transition = animate ? "" : "none";
    track.style.transform = `translateX(calc(${-index * 100}% + ${px}px))`;
  }

  function show(i, animate = true) {
    i = Math.max(0, Math.min(order.length - 1, i));
    const prev = order[index];
    index = i;
    const id = order[index];
    setOffset(0, animate);
    document.querySelectorAll(".tabbtn").forEach((b) => {
      const sel = b.dataset.tab === id;
      b.classList.toggle("active", sel);
      b.setAttribute("aria-selected", sel);
    });
    const ink = document.getElementById("tab-ink");
    ink.style.setProperty("--i", order.indexOf(id));
    if (prev !== id) defs[prev]?.onHide?.();
    defs[id]?.onShow?.();
    try {
      localStorage.setItem("rs-tab", id);
    } catch {
      /* storage unavailable */
    }
    poll();
  }

  async function poll() {
    clearTimeout(timer);
    const g = ++gen;
    const id = current(),
      def = defs[id];
    if (!def?.refresh || !visible()) return;
    try {
      await def.refresh();
    } catch (e) {
      console.warn(id, e);
    }
    if (g !== gen) return; // the tab changed while waiting; that one has its own loop now
    const ms = typeof def.interval === "function" ? def.interval() : def.interval;
    if (ms > 0) timer = setTimeout(poll, ms);
  }

  function initSwipe() {
    const vp = document.getElementById("viewport");
    let x0 = 0,
      y0 = 0,
      dx = 0,
      axis = null,
      active = false,
      suppress = false;
    vp.addEventListener("pointerdown", (e) => {
      suppress = false;
      // Mouse users click the tab bar; swiping is for touch screens.
      if (e.pointerType === "mouse" || !e.isPrimary || e.target.closest?.("[data-noswipe], input, textarea, select"))
        return;
      active = true;
      axis = null;
      dx = 0;
      x0 = e.clientX;
      y0 = e.clientY;
    });
    vp.addEventListener("pointermove", (e) => {
      if (!active) return;
      const mx = e.clientX - x0,
        my = e.clientY - y0;
      if (axis === null && (Math.abs(mx) > 10 || Math.abs(my) > 10)) {
        axis = Math.abs(mx) > Math.abs(my) * 1.2 ? "x" : "y";
        if (axis === "x") vp.setPointerCapture(e.pointerId);
      }
      if (axis !== "x") return;
      const edge = (mx > 0 && index === 0) || (mx < 0 && index === order.length - 1);
      dx = edge ? mx * 0.25 : mx;
      setOffset(dx, false);
    });
    const end = () => {
      if (!active) return;
      active = false;
      if (axis !== "x") return;
      suppress = true;
      const min = Math.min(80, innerWidth * 0.12);
      if (dx <= -min) show(index + 1);
      else if (dx >= min) show(index - 1);
      else setOffset(0, true);
    };
    vp.addEventListener("pointerup", end);
    vp.addEventListener("pointercancel", end);
    vp.addEventListener(
      "click",
      (e) => {
        if (suppress) {
          e.stopPropagation();
          e.preventDefault();
          suppress = false;
        }
      },
      true,
    );
  }

  // Toast
  let toastTimer = null;
  function toast(msg, ms = 3500) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.hidden = true;
    }, ms);
  }

  // Helpers
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const $ = (id) => document.getElementById(id);

  // Is a game full screen? Checked every 5 s so the scenes can slow down.
  let gaming = false;
  async function checkGaming() {
    if (visible()) {
      try {
        const g = await invoke("gaming");
        if (g !== gaming) {
          gaming = g;
          emit("gaming", g);
        }
      } catch {
        /* ignore */
      }
    }
    setTimeout(checkGaming, 5000);
  }

  // Errors in here get written to rigside.log too, so there's something to look at later.
  function hookErrors() {
    const report = (msg) => {
      try {
        if (window.__TAURI_INTERNALS__) invoke("log_js", { msg: String(msg).slice(0, 2000) });
      } catch {
        /* ignore */
      }
    };
    addEventListener("error", (e) => {
      const where = `${(e.filename || "").split("/").pop()}:${e.lineno}:${e.colno}`;
      report(`${e.message} @ ${where}${e.error?.stack ? ` | ${e.error.stack}` : ""}`);
    });
    addEventListener("unhandledrejection", (e) => report(`unhandled: ${e.reason?.stack || e.reason}`));
  }

  async function start() {
    hookErrors();
    // ?bare hides the UI and just shows the scene (handy for screenshots)
    if (new URLSearchParams(location.search).has("bare")) document.documentElement.classList.add("bare");
    await loadSettings();
    layout();
    applyTheme();
    addEventListener("resize", layout);
    on("settings", () => {
      layout();
      applyTheme();
    });
    document.querySelectorAll(".tabbtn").forEach((b) => {
      b.insertAdjacentHTML("afterbegin", RS_ICON(b.dataset.icon));
      if (b.dataset.tab) b.addEventListener("click", () => show(order.indexOf(b.dataset.tab)));
    });
    initSwipe();
    document.addEventListener("keydown", (e) => {
      if (e.target.closest?.("input, textarea, select") || document.querySelector(".modal:not([hidden])")) return;
      if (e.key === "ArrowRight") show(index + 1);
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "F11") {
        e.preventDefault();
        invoke("is_fullscreen").then((fs) => invoke("set_fullscreen", { on: !fs }));
      }
    });
    // Stop polling while the window's hidden, minimised or covered, and carry on when it's back.
    document.addEventListener("visibilitychange", () => {
      emit("visible", visible());
      if (visible()) poll();
    });
    emit("ready", settings);
    let saved = null;
    try {
      saved = localStorage.getItem("rs-tab");
    } catch {
      /* storage unavailable */
    }
    buildTabs();
    // #weather, #playing etc. in the address opens that tab
    const wanted = location.hash.slice(1);
    show(Math.max(0, order.indexOf(order.includes(wanted) ? wanted : saved)), false);
    on("settings", buildTabs);
    if (settings.always_on_top) invoke("set_always_on_top", { on: true }).catch(() => {});
    checkGaming();
  }

  // Check for updates quietly a few seconds after starting, no more than once a day.
  async function checkForUpdate() {
    if (!settings.update_check) return;
    let last = 0;
    try {
      last = Number(localStorage.getItem("rs.update_checked") || 0);
    } catch {
      /* ignore */
    }
    if (Date.now() - last < 86400000) return;
    try {
      const u = await invoke("update_check");
      try {
        localStorage.setItem("rs.update_checked", String(Date.now()));
      } catch {
        /* ignore */
      }
      if (u) toast(`Rigside ${u.version} is available: Settings → About to update`, 8000);
    } catch {
      /* offline or no release feed yet: try again next start */
    }
  }
  setTimeout(checkForUpdate, 8000);
  setInterval(checkForUpdate, 60 * 60 * 1000); // Rigside can sit in the tray for weeks

  return {
    invoke,
    on,
    emit,
    tab,
    show,
    start,
    toast,
    esc,
    $,
    settings: () => settings,
    set,
    refresh: poll,
    current,
    tabs: () => [...order],
    gaming: () => gaming,
  };
})();
