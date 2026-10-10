"use strict";

/* Playing tab: whatever's playing on the PC (any app Windows knows about), volume, mute, mic, a quick
   switch between your two favourite outputs, and the visualiser. */
(() => {
  const $ = RS.$,
    D = RS_DATA;
  const root = $("np");
  let media = null;
  let base = { pos: 0, at: 0 }; // position and when it was read, for the 1 s ticker
  let holdVolumeUntil = 0; // polls mustn't fight the slider while it moves
  let optimistic = null; // play/pause flipped on tap until Windows agrees
  let audio = null;

  root.querySelectorAll('[data-do="prev"]').forEach((b) => {
    b.innerHTML = RS_ICON("prev");
  });
  root.querySelectorAll('[data-do="next"]').forEach((b) => {
    b.innerHTML = RS_ICON("next");
  });
  root.querySelector(".np-art-ph").innerHTML = RS_ICON("music");

  const pos = () =>
    !media
      ? 0
      : media.state === "playing"
        ? Math.min(media.duration || 0, base.pos + (Date.now() - base.at) / 1000)
        : base.pos;

  function tick() {
    const ok = media && media.duration > 0;
    $("np-bar").style.width = ok ? `${(pos() / media.duration) * 100}%` : "0";
    $("np-pos").textContent = ok ? D.duration(pos()) : "0:00";
    $("np-dur").textContent = ok ? D.duration(media.duration) : "0:00";
  }
  setInterval(() => {
    if (RS.current() === "playing" && !document.hidden) tick();
  }, 1000);

  function renderMedia(m) {
    if (m && optimistic) {
      if (m.state === optimistic.state || Date.now() > optimistic.until) optimistic = null;
      else m = { ...m, state: optimistic.state, position: pos() };
    }
    media = m;
    root.classList.toggle("idle", !m);
    root.querySelectorAll(".np-play").forEach((b) => {
      b.innerHTML = RS_ICON(m && m.state === "playing" ? "pause" : "play");
      b.disabled = !m;
    });
    root.querySelectorAll('[data-do="next"]').forEach((b) => {
      b.disabled = !m || !m.can_next;
    });
    root.querySelectorAll('[data-do="prev"]').forEach((b) => {
      b.disabled = !m || !m.can_prev;
    });
    $("np-app").textContent = m ? m.app : "";
    $("np-title").textContent = m ? m.title || "Untitled" : "Nothing playing";
    $("np-artist").textContent = m ? [m.artist, m.album].filter(Boolean).join(" · ") : "Play something on this PC";
    $("viz-title").textContent = m ? m.title || "Untitled" : "Nothing playing";
    $("viz-artist").textContent = m ? m.artist : "";
    const img = $("np-img"),
      src = m?.art_url || "";
    if ((img.getAttribute("src") || "") !== src) {
      if (src) img.setAttribute("src", src);
      else img.removeAttribute("src");
    }
    base = { pos: m ? m.position : 0, at: Date.now() };
    tick();
  }

  function shortName(n) {
    return (n || "")
      .replace(/\s*\((.*)\)$/, (_, inner) => ` (${inner.replace(/ High Definition Audio| Audio$/, "")})`)
      .replace(/^Speakers \((.*)\)$/, "$1");
  }

  // The quick switch flips between your two favourite outputs (set in Settings), or goes through all
  // of them if you haven't picked any.
  function nextOutput(a) {
    const favs = (RS.settings().outputs || []).filter((id) => a.outputs.some((o) => o.id === id));
    const pool = favs.length >= 2 ? favs : a.outputs.map((o) => o.id);
    const i = pool.indexOf(a.output_id);
    return pool[(i + 1) % pool.length];
  }

  function renderAudio(a) {
    audio = a;
    $("np-mute").innerHTML = RS_ICON(a.muted ? "muted" : "volume");
    $("np-mute").classList.toggle("on", a.muted);
    if (Date.now() > holdVolumeUntil) {
      $("np-vol").value = a.volume;
      $("np-vol-out").textContent = `${a.volume}%`;
      $("np-vol").style.setProperty("--fill", `${a.volume}%`);
    }
    $("np-mic").hidden = a.mic_muted == null;
    $("np-mic").innerHTML = RS_ICON(a.mic_muted ? "micoff" : "mic");
    $("np-mic").classList.toggle("on", !!a.mic_muted);
    $("np-mic").title = a.mic_muted ? "Microphone muted" : "Microphone on";
    const out = $("np-output");
    const headset = a.output_headset || /head(phone|set)|ear(bud|phone)|buds|airpods/i.test(a.output);
    out.querySelector(".ico-slot").innerHTML = RS_ICON(headset ? "headphones" : "speaker");
    $("np-out-label").textContent = shortName(a.output);
    out.title = `Switch output (now ${a.output})`;
    out.disabled = a.outputs.length < 2;
  }

  async function act(cmd, args) {
    try {
      const r = await RS.invoke(cmd, args);
      if (r && r.outputs) renderAudio(r);
    } catch (e) {
      RS.toast(String(e));
    }
  }

  root.addEventListener("click", async (e) => {
    const b = e.target.closest?.("button[data-do]");
    if (!b || b.disabled) return;
    if (b.dataset.do === "play_pause" && media) {
      const state = media.state === "playing" ? "paused" : "playing";
      const p = pos();
      optimistic = null;
      renderMedia({ ...media, state, position: p });
      optimistic = { state, until: Date.now() + 2500 };
    }
    try {
      await RS.invoke("media_control", { cmd: b.dataset.do });
    } catch (err) {
      RS.toast(String(err));
    }
    setTimeout(() => RS.refresh(), 350);
  });
  $("np-mute").addEventListener("click", () => act("toggle_mute"));
  $("np-mic").addEventListener("click", () => act("toggle_mic"));
  $("np-output").addEventListener("click", () => {
    if (audio) act("set_output", { id: nextOutput(audio) });
  });

  let volTimer = null;
  $("np-vol").addEventListener("input", (e) => {
    const v = Number(e.target.value);
    $("np-vol-out").textContent = `${v}%`;
    e.target.style.setProperty("--fill", `${v}%`);
    holdVolumeUntil = Date.now() + 1500;
    if (!volTimer)
      volTimer = setTimeout(() => {
        volTimer = null;
        act("set_volume", { level: Number($("np-vol").value) });
      }, 120);
  });
  $("np-vol").addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const v = Math.max(0, Math.min(100, Number($("np-vol").value) + (e.deltaY < 0 ? 2 : -2)));
      $("np-vol").value = v;
      $("np-vol").dispatchEvent(new Event("input"));
    },
    { passive: false },
  );

  // Visualiser
  let view = "player";
  try {
    view = localStorage.getItem("rs-np-view") === "viz" ? "viz" : "player";
  } catch {
    /* storage unavailable */
  }
  const canvas = $("viz-canvas");
  let vizTimer = null,
    bars = [],
    peaks = [],
    busy = false;

  function setView(v) {
    view = v;
    try {
      localStorage.setItem("rs-np-view", v);
    } catch {
      /* storage unavailable */
    }
    root.querySelectorAll(".np-views button").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
    $("np-viz").hidden = v !== "viz";
    $("np-main").hidden = v === "viz";
    syncViz();
  }
  root.querySelectorAll(".np-views button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

  const vizWanted = () => view === "viz" && RS.current() === "playing" && !document.hidden;
  function syncViz() {
    if (vizWanted() && !vizTimer) vizTimer = setInterval(pollViz, 50); // ~20 fps
    if (!vizWanted() && vizTimer) {
      clearInterval(vizTimer);
      vizTimer = null;
    }
  }
  RS.on("visible", syncViz);

  async function pollViz() {
    if (busy) return;
    busy = true;
    try {
      draw(await RS.invoke("viz_levels"));
    } catch {
      /* ignore */
    } finally {
      busy = false;
    }
  }

  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function draw(d) {
    const dpr = devicePixelRatio || 1;
    const w = Math.round(canvas.clientWidth * dpr),
      h = Math.round(canvas.clientHeight * dpr);
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const c = canvas.getContext("2d");
    c.clearRect(0, 0, w, h);
    const target = d.bands?.length ? d.bands : new Array(24).fill(0),
      n = target.length;
    if (bars.length !== n) {
      bars = new Array(n).fill(0);
      peaks = new Array(n).fill(0);
    }
    const accent = css("--accent"),
      warm = css("--warm"),
      hot = css("--danger"),
      text = css("--text");
    const floor = h * 0.8,
      gap = Math.max(2, (w / n) * 0.18),
      bw = (w - gap * (n - 1)) / n,
      seg = Math.max(3, h / 40),
      segGap = Math.max(1, seg * 0.3);
    for (let i = 0; i < n; i++) {
      bars[i] += (target[i] - bars[i]) * 0.6;
      peaks[i] = Math.max(bars[i], peaks[i] - 0.012);
      const x = i * (bw + gap),
        bh = bars[i] * floor;
      for (let y = 0; y < bh; y += seg + segGap) {
        const f = y / floor;
        c.fillStyle = f > 0.82 ? hot : f > 0.6 ? warm : accent;
        c.fillRect(x, floor - y - seg, bw, seg);
        c.globalAlpha = 0.14;
        c.fillRect(x, floor + 4 + y * 0.3, bw, seg * 0.3);
        c.globalAlpha = 1;
      }
      c.fillStyle = text;
      c.fillRect(x, floor - peaks[i] * floor - 3 * dpr, bw, 2 * dpr);
    }
    $("viz-l").style.width = `${Math.round((d.left || 0) * 100)}%`;
    $("viz-r").style.width = `${Math.round((d.right || 0) * 100)}%`;
  }

  RS.tab("playing", {
    interval: () => (media && media.state === "playing" ? 2000 : 4000),
    onShow: syncViz,
    onHide: syncViz,
    async refresh() {
      const [m, a] = await Promise.allSettled([D.media(), D.audio()]);
      if (m.status === "fulfilled") renderMedia(m.value);
      if (a.status === "fulfilled") renderAudio(a.value);
    },
  });
  setView(view);
})();
