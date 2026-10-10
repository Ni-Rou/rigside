"use strict";

/* Home tab: the clock, the weather now and for the next few hours, what's playing and CPU/GPU/RAM. */
(() => {
  const $ = RS.$,
    esc = RS.esc,
    D = RS_DATA;

  $("h-wx-setup").addEventListener("click", () => RS.emit("open-settings", "location"));
  $("h-np").addEventListener("click", (e) => {
    if (e.target.closest?.("#h-np-play")) return;
    RS.show(RS.tabs().indexOf("playing"));
  });
  $("h-pc").addEventListener("click", () => RS.show(RS.tabs().indexOf("pc")));
  $("h-np-play").addEventListener("click", async () => {
    try {
      await RS.invoke("media_control", { cmd: "play_pause" });
    } catch (e) {
      RS.toast(String(e));
    }
    setTimeout(() => RS.refresh(), 400);
  });

  // Clock
  function tick() {
    const s = RS.settings(),
      now = new Date();
    const h = now.getHours(),
      m = String(now.getMinutes()).padStart(2, "0");
    const hh = s.clock_24h ? String(h).padStart(2, "0") : String(h % 12 || 12);
    const secs = s.clock_seconds ? String(now.getSeconds()).padStart(2, "0") : "";
    const tail = [secs, s.clock_24h ? "" : h < 12 ? "am" : "pm"].filter(Boolean).join(" ");
    const clock = $("h-clock");
    if (clock.dataset.hm !== hh + m) {
      clock.dataset.hm = hh + m;
      clock.querySelector(".hh").textContent = hh;
      clock.querySelector(".mm").textContent = m;
    }
    if ($("h-secs").textContent !== tail) $("h-secs").textContent = tail;
    const d = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    if ($("h-date").textContent !== d) $("h-date").textContent = d;
  }
  tick();
  setInterval(() => {
    if (!document.hidden) tick();
  }, 1000);
  RS.on("settings", tick);

  // Weather
  function renderWeather(snap) {
    const w = snap.data;
    $("h-wx-setup").hidden = snap.configured;
    $("h-wx").classList.toggle("stale", !!snap.stale && !!w);
    if (!w) {
      $("h-wx-icon").innerHTML = "";
      $("h-wx-temp").textContent = "--°";
      $("h-wx-desc").textContent = !snap.configured
        ? "No location set"
        : snap.error
          ? "Weather unavailable"
          : "Loading weather…";
      $("h-wx-meta").textContent = "";
      $("h-wx-rain").innerHTML = "";
      $("h-wx-hours").innerHTML = "";
      return;
    }
    const n = w.now;
    $("h-wx-icon").innerHTML = D.wxIcon(n.icon);
    $("h-wx-temp").textContent = `${n.temp}°`;
    $("h-wx-desc").textContent = w.today.max != null ? `${n.desc} · ${w.today.max}° / ${w.today.min}°` : n.desc;
    const gust = n.gust && n.gust > n.wind + 5 ? `, gusts ${n.gust}` : "";
    $("h-wx-meta").textContent = `Feels ${n.feels}° · ${n.wind_from} ${n.wind} ${D.windUnit()}${gust}`;
    const rain = $("h-wx-rain");
    rain.classList.toggle("wet", w.rain.wet_now || w.rain.text.startsWith("Rain"));
    rain.innerHTML = w.rain.text ? `${RS_ICON("drop")}<span>${esc(w.rain.text)}</span>` : "";
    $("h-wx-hours").innerHTML = w.hours
      .map(
        (h) =>
          `<div class="wx-hour"><span class="t">${h.time.slice(11, 13)}</span>` +
          `${D.wxIcon(h.icon)}<span class="v">${h.temp ?? "–"}°</span><span class="p">${h.pop >= 20 ? h.pop + "%" : ""}</span></div>`,
      )
      .join("");
  }
  RS.on("weather", renderWeather);

  // Now playing + PC
  function renderMedia(m) {
    $("h-np-title").textContent = m ? m.title || "Untitled" : "Nothing playing";
    $("h-np-artist").textContent = m ? [m.artist, m.app].filter(Boolean).join(" · ") : "";
    const art = $("h-np-art");
    art.style.backgroundImage = m?.art_url ? `url("${m.art_url}")` : "";
    art.innerHTML = m?.art_url ? "" : RS_ICON("music");
    $("h-np-play").innerHTML = RS_ICON(m && m.state === "playing" ? "pause" : "play");
    $("h-np-play").disabled = !m;
  }

  function stat(k, value, pct, extra, cls = "") {
    const el = document.querySelector(`.mini-stat[data-k="${k}"]`);
    el.querySelector(".v").textContent = value;
    const bar = el.querySelector(".bar");
    bar.className = `bar ${cls}`;
    bar.firstElementChild.style.width = `${Math.max(0, Math.min(100, pct || 0))}%`;
    el.querySelector(".t").textContent = extra || "";
  }

  function renderStats(s) {
    const t = (c) => (c == null ? "" : `${D.temp(c)}°`);
    stat("cpu", `${Math.round(s.cpu_load)}%`, s.cpu_load, t(s.cpu_temp), D.level(s.cpu_temp, 75, 88));
    if (s.gpu)
      stat("gpu", s.gpu.load != null ? `${s.gpu.load}%` : "–", s.gpu.load, t(s.gpu.temp), D.level(s.gpu.temp, 75, 85));
    document.querySelector('.mini-stat[data-k="gpu"]').hidden = !s.gpu;
    stat(
      "ram",
      `${Math.round((s.ram_used_gb / s.ram_total_gb) * 100)}%`,
      (s.ram_used_gb / s.ram_total_gb) * 100,
      `${Math.round(s.ram_used_gb)} GB`,
    );
  }

  RS.tab("home", {
    interval: 3000,
    async refresh() {
      const [m, s] = await Promise.allSettled([D.media(), D.stats()]);
      if (m.status === "fulfilled") renderMedia(m.value);
      if (s.status === "fulfilled") renderStats(s.value);
    },
  });
})();
