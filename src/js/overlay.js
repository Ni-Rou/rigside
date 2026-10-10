"use strict";

/* The overlay strip: CPU/GPU load and temps, RAM, the clock and what's playing. It updates every 2 s
   while it's showing and resizes itself to fit. In "Move it" mode you can drag it about, then hit Done. */
(() => {
  const T = window.__TAURI__;
  const invoke = T.core.invoke;
  const win = T.window.getCurrentWindow();
  let settings = {},
    timer = null,
    lastKey = "";

  const level = (v, warm, hot) => (v == null ? "" : v >= hot ? "hot" : v >= warm ? "warm" : "");
  const temp = (c) => (c == null ? "" : `${Math.round(settings.temp_unit === "f" ? (c * 9) / 5 + 32 : c)}°`);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  async function loadSettings() {
    try {
      settings = (await invoke("get_settings")) || {};
    } catch {
      settings = {};
    }
    document.documentElement.dataset.theme = settings.theme || "neon";
  }

  async function fit() {
    const r = document.getElementById("strip").getBoundingClientRect();
    const w = Math.ceil(r.width + 8),
      h = Math.ceil(r.height + 8);
    const key = `${w}x${h}`;
    if (key === lastKey) return;
    lastKey = key;
    try {
      await win.setSize(new T.window.LogicalSize(w, h));
    } catch {
      /* ignore */
    }
  }

  async function tick() {
    const items = settings.overlay_items || { cpu: true, gpu: true, ram: true, clock: true };
    const parts = [];
    try {
      const s = await invoke("pc_stats");
      if (items.cpu)
        parts.push(
          `<span class="it"><b>CPU</b><span>${Math.round(s.cpu_load)}%</span><span class="t ${level(s.cpu_temp, 75, 88)}">${temp(s.cpu_temp)}</span></span>`,
        );
      if (items.gpu && s.gpu)
        parts.push(
          `<span class="it"><b>GPU</b><span>${s.gpu.load ?? "–"}%</span><span class="t ${level(s.gpu.temp, 75, 85)}">${temp(s.gpu.temp)}</span></span>`,
        );
      if (items.ram)
        parts.push(
          `<span class="it"><b>RAM</b><span>${Math.round((s.ram_used_gb / s.ram_total_gb) * 100)}%</span></span>`,
        );
    } catch {
      /* keep going */
    }
    if (items.track) {
      try {
        const m = await invoke("media_state", { haveArt: "-" });
        if (m && m.state === "playing")
          parts.push(`<span class="it track"><b>♪</b><span>${esc(m.title)}</span></span>`);
      } catch {
        /* ignore */
      }
    }
    if (items.clock) {
      const d = new Date();
      const hh = settings.clock_24h === false ? String(d.getHours() % 12 || 12) : String(d.getHours()).padStart(2, "0");
      parts.push(`<span class="it"><span>${hh}:${String(d.getMinutes()).padStart(2, "0")}</span></span>`);
    }
    document.getElementById("items").innerHTML =
      parts.join('<i class="sep"></i>') || '<span class="it"><span>Rigside</span></span>';
    fit();
  }

  function start() {
    if (!timer) {
      tick();
      timer = setInterval(tick, 2000);
    }
  }
  function stop() {
    clearInterval(timer);
    timer = null;
  }

  document.getElementById("done").addEventListener("click", () => invoke("overlay_set", { show: true, edit: false }));
  T.event.listen("overlay-mode", (e) => {
    const { show, edit } = e.payload || {};
    document.body.classList.toggle("edit", !!edit);
    document.getElementById("done").hidden = !edit;
    if (show) start();
    else stop();
    lastKey = "";
    setTimeout(fit, 30);
  });
  T.event.listen("settings-changed", async () => {
    await loadSettings();
    tick();
  });

  // The window's there from the start, just hidden, so only poll while it's actually showing.
  loadSettings().then(async () => {
    try {
      if (await invoke("overlay_visible")) start();
    } catch {
      /* ignore */
    }
  });
})();
