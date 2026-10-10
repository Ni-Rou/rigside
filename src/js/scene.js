"use strict";

/* Runs the animated background behind every tab.
   Scenes are pixel art drawn small and scaled up by CSS without smoothing, so they stay sharp.
   A scene signs up with RS_SCENE.register(id, def):
     short       optional: logical size of the short side in pixels (default 180)
     fps         optional: frames per second in Smooth mode (default 10)
     build(W, H) once per size: generate the world (use RS_SCENE.rng(seed) so it never changes)
     background(g, world, env)  static layers, cached; redrawn when the light or weather changes
     sky(c, world, env, s)      optional: moving parts behind the land (stars, aurora...)
     land(g, world, env)        optional: static layers in front of sky(), cached with transparency
     frame(c, world, env, s)    moving parts in front of everything, s = seconds since start
   The long side follows the window's shape, so the same scene fills a 7" panel, a 4:1 bar or a
   portrait screen. Put things relative to W and H. js/pixel.js has the drawing helpers.
   To go easy on the CPU, frames are drawn at 10 fps (Smooth), 3 fps (Low power) or once a minute
   (Still), not at all while the window's hidden, and slower or paused while a game is full screen. */
const RS_SCENE = (() => {
  const SHORT = 180;
  const scenes = {};
  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");
  const bg = document.createElement("canvas");
  const bctx = bg.getContext("2d");
  const fg = document.createElement("canvas"); // land layer, for scenes with sky()
  const fctx = fg.getContext("2d");
  let cur = null,
    world = null,
    W = 0,
    H = 0,
    bgKey = "",
    timer = null,
    t0 = performance.now();
  let weather = null;

  // ?scene_time=21:30&scene_weather=rain&scene_temp=-3 to preview any conditions
  const q = new URLSearchParams(location.search);
  const fake = { time: q.get("scene_time"), weather: q.get("scene_weather"), temp: q.get("scene_temp") };

  // helpers for scenes
  const rng = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // light: time of day from sunrise/sunset
  const minutes = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  function light() {
    // Sunrise and sunset are in the weather location's time zone, so "now" has to be as well.
    const off = weather?.utc_offset_s;
    let t;
    if (fake.time) t = minutes(fake.time);
    else if (typeof off === "number") {
      const d = new Date(Date.now() + off * 1000);
      t = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
    } else {
      const now = new Date();
      t = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    }
    const rise = minutes(weather?.today?.sunrise || "07:00"),
      set = minutes(weather?.today?.sunset || "19:00");
    const ramp = (a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
    let phase,
      day,
      glow = 0; // glow: 0..1 how golden/red the horizon is
    if (t < rise - 50 || t > set + 50) {
      phase = "night";
      day = 0;
    } else if (t < rise + 30) {
      phase = "dawn";
      day = ramp(rise - 50, rise + 30);
      glow = 1 - Math.abs(day - 0.55) * 1.8;
    } else if (t < set - 30) {
      phase = "day";
      day = 1;
    } else {
      phase = "dusk";
      day = 1 - ramp(set - 30, set + 50);
      glow = 1 - Math.abs(day - 0.55) * 1.8;
    }
    glow = Math.max(0, glow);
    // sun position across the sky 0..1 (rise -> set) and moon opposite
    const sun = Math.max(-0.2, Math.min(1.2, (t - rise) / (set - rise)));
    const nightLen = 1440 - (set - rise);
    const moon = ((t - set + 1440) % 1440) / nightLen;
    return { phase, day, glow, sun, moon, night: day < 0.35, minute: t };
  }

  function sky() {
    const w = fake.weather || weather?.now?.icon || "partly-day";
    const base = w.replace(/-(day|night)$/, "");
    const o = { icon: w, clouds: 0.25, grey: 0, rain: 0, snow: 0, fog: 0, thunder: false };
    if (base === "clear") Object.assign(o, { clouds: 0.08 });
    else if (base === "partly") Object.assign(o, { clouds: 0.4, grey: 0.1 });
    else if (base === "cloud") Object.assign(o, { clouds: 0.85, grey: 0.5 });
    else if (base === "fog") Object.assign(o, { clouds: 0.7, grey: 0.6, fog: 1 });
    else if (base === "drizzle") Object.assign(o, { clouds: 0.85, grey: 0.55, rain: 0.3 });
    else if (base === "rain" || base === "showers") Object.assign(o, { clouds: 0.9, grey: 0.6, rain: 0.6 });
    else if (base === "heavy-rain") Object.assign(o, { clouds: 1, grey: 0.75, rain: 1 });
    else if (base === "sleet") Object.assign(o, { clouds: 0.9, grey: 0.6, rain: 0.4, snow: 0.4 });
    else if (base === "snow") Object.assign(o, { clouds: 0.9, grey: 0.5, snow: 0.8 });
    else if (base === "thunder") Object.assign(o, { clouds: 1, grey: 0.85, rain: 1, thunder: true });
    o.temp = fake.temp != null ? Number(fake.temp) : (weather?.now?.temp ?? 10);
    if (RS.settings().temp_unit === "f" && fake.temp == null) o.temp = ((o.temp - 32) * 5) / 9;
    o.wind = weather?.now?.wind ?? 5;
    return o;
  }

  function env() {
    const L = light(),
      wx = sky();
    const m = window.RS_MOON ? window.RS_MOON() : { phase: 0.5, lit: 100 };
    return { ...L, wx, moonPhase: m.phase };
  }

  // sizing
  function resize() {
    if (!cur || !innerWidth || !innerHeight) return; // minimised or hidden: keep the last size
    const a = innerWidth / innerHeight;
    const short = cur.short || SHORT;
    const nW = a >= 1 ? Math.round(short * a) : short,
      nH = a >= 1 ? short : Math.round(short / a);
    const sizeChanged = nW !== W || nH !== H || !world;
    W = nW;
    H = nH;
    if (sizeChanged) {
      canvas.width = bg.width = fg.width = W;
      canvas.height = bg.height = fg.height = H;
      world = cur.build(W, H);
      bgKey = "";
    }
  }

  // If a scene crashes, fall back to the plain background and log it rather than leave it blank.
  function fail(err) {
    console.error("scene", err);
    try {
      if (window.__TAURI_INTERNALS__) RS.invoke("log_js", { msg: `scene failed: ${err?.stack || err}` });
    } catch {
      /* ignore */
    }
    cur = null;
    world = null;
    clearInterval(timer);
    timer = null;
    canvas.hidden = true;
  }

  function draw() {
    try {
      drawFrame();
    } catch (err) {
      fail(err);
    }
  }

  function drawFrame() {
    if (!cur || !world) return;
    const e = env();
    const key = `${e.phase}|${Math.round(e.day * 20)}|${Math.round(e.glow * 10)}|${Math.round(e.sun * 30)}|${e.wx.icon}|${W}x${H}`;
    if (key !== bgKey) {
      bgKey = key;
      bctx.clearRect(0, 0, W, H);
      cur.background(bctx, world, e);
      if (cur.land) {
        fctx.clearRect(0, 0, W, H);
        cur.land(fctx, world, e);
      }
    }
    const s = (performance.now() - t0) / 1000;
    ctx.drawImage(bg, 0, 0);
    if (cur.sky) cur.sky(ctx, world, e, s);
    if (cur.land) ctx.drawImage(fg, 0, 0);
    cur.frame(ctx, world, e, s);
  }

  function fps() {
    const s = RS.settings();
    let f = s.motion === "off" ? 0 : s.motion === "low" ? 3 : cur?.fps || 10;
    if (RS.gaming() && s.gaming_motion !== "same") f = s.gaming_motion === "pause" ? -1 : Math.min(f, 3);
    return f;
  }

  function schedule() {
    clearInterval(timer);
    timer = null;
    canvas.hidden = !cur;
    if (!cur || document.hidden) return;
    const f = fps();
    if (f < 0) return; // paused while gaming: keep the last frame
    draw();
    timer = setInterval(draw, f === 0 ? 60000 : 1000 / f);
  }

  function setTheme(id) {
    const theme = (window.RS_THEMES || []).find((t) => t.id === id);
    const next = theme?.scene ? scenes[theme.scene] : null;
    if (next !== cur) {
      cur = next;
      world = null;
      W = H = 0;
      canvas.className = cur ? "pixel" : "";
      if (cur) {
        try {
          resize();
        } catch (err) {
          fail(err);
        }
      }
    }
    schedule();
  }

  RS.on("theme", setTheme);
  RS.on("visible", schedule);
  RS.on("gaming", schedule);
  RS.on("settings", schedule);
  RS.on("weather", (snap) => {
    if (snap.data) {
      weather = snap.data;
      bgKey = "";
    }
  });
  addEventListener("resize", () => {
    resize();
    draw();
  });

  // RS_SCENE.preview({time: "22:30", weather: "snow", temp: -3}) in the console shows any time and
  // weather (like the scene_* URL options). preview({}) goes back to the real thing.
  function preview(o = {}) {
    fake.time = o.time ?? null;
    fake.weather = o.weather ?? null;
    fake.temp = o.temp ?? null;
    bgKey = "";
    drawFrame(); // throws, so tests see errors
  }

  // RS_SCENE.bench(60) in the console tells you how many ms a frame of the current scene takes
  function bench(n = 60) {
    if (!cur) return null;
    drawFrame(); // warm the cached layers
    const t = performance.now();
    for (let i = 0; i < n; i++) drawFrame();
    return +((performance.now() - t) / n).toFixed(2);
  }

  return {
    register: (id, def) => {
      scenes[id] = def;
    },
    rng,
    bench,
    preview,
  };
})();
