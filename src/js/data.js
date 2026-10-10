"use strict";

/* Data a few tabs share: PC stats, what's playing (album art is cached by key so it only comes over
   once per track), audio, and the weather icons. */
const RS_DATA = (() => {
  let art = { key: null, url: null };

  async function media() {
    const m = await RS.invoke("media_state", { haveArt: art.key });
    if (m && m.art_key && m.art) art = { key: m.art_key, url: m.art };
    if (m) m.art_url = m.art_key && m.art_key === art.key ? art.url : null;
    return m;
  }

  async function stats() {
    return RS.invoke("pc_stats");
  }

  async function audio() {
    return RS.invoke("audio_state");
  }

  // formatting
  const rate = (bps) => {
    if (bps == null) return "–";
    const b = bps * 8; // bits per second, like the Task Manager
    if (b >= 1e9) return `${(b / 1e9).toFixed(1)} Gb/s`;
    if (b >= 1e6) return `${(b / 1e6).toFixed(1)} Mb/s`;
    if (b >= 1e3) return `${Math.round(b / 1e3)} kb/s`;
    return `${Math.round(b)} b/s`;
  };
  const temp = (c) =>
    c == null ? null : RS.settings().temp_unit === "f" ? Math.round((c * 9) / 5 + 32) : Math.round(c);
  const tempUnit = () => (RS.settings().temp_unit === "f" ? "°F" : "°C");
  const level = (v, warm, hot) => (v == null ? "" : v >= hot ? "hot" : v >= warm ? "warm" : "");
  const duration = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60),
      sec = String(s % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
  };
  const windUnit = () => ({ kmh: "km/h", ms: "m/s" })[RS.settings().wind_unit] || "mph";

  // weather icons (24x24 SVG)
  const CLOUD = '<path class="cloud" d="M7 18h10.5a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.6 1.2A3 3 0 0 0 7 18z"/>';
  const CLOUD_HI = '<path class="cloud" d="M7 15h10.5a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.6 1.2A3 3 0 0 0 7 15z"/>';
  const SUN = (cx, cy, r) => {
    let rays = "";
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      rays += `M${(cx + Math.cos(a) * (r + 2)).toFixed(1)} ${(cy + Math.sin(a) * (r + 2)).toFixed(1)}L${(cx + Math.cos(a) * (r + 4)).toFixed(1)} ${(cy + Math.sin(a) * (r + 4)).toFixed(1)}`;
    }
    return `<circle class="sun sun-fill" cx="${cx}" cy="${cy}" r="${r}"/><path class="sun" d="${rays}"/>`;
  };
  const MOON = (cx, cy, r) =>
    `<path class="moon" d="M${cx + r * 0.3} ${cy - r}a${r} ${r} 0 1 0 ${r * 0.7} ${r * 1.4}a${r * 0.8} ${r * 0.8} 0 0 1 ${-r * 0.7} ${-r * 1.4}z"/>`;
  const RAIN = (n) =>
    ['<path class="rain" d="', ...[8, 12, 16].slice(0, n).map((x) => `M${x} 17l-1 4`), '"/>'].join("");
  const WX = {
    "clear-day": SUN(12, 12, 4.5),
    "clear-night": MOON(11, 12, 6),
    "partly-day": SUN(8, 8, 3.2) + CLOUD,
    "partly-night": MOON(8, 7, 4) + CLOUD,
    cloud: CLOUD,
    fog: CLOUD_HI + '<path class="fog" d="M5 18h14M7 21h10"/>',
    drizzle: CLOUD_HI + '<path class="rain" d="M9 18v1M13 18v1M11 21v1M15 21v1"/>',
    rain: CLOUD_HI + RAIN(3),
    "heavy-rain": CLOUD_HI + '<path class="rain" d="M7 17l-1.5 5M11 17l-1.5 5M15 17l-1.5 5M19 17l-1.5 5"/>',
    "showers-day": SUN(7, 6, 2.6) + CLOUD_HI + RAIN(2),
    "showers-night": MOON(7, 6, 3.5) + CLOUD_HI + RAIN(2),
    sleet: CLOUD_HI + '<path class="rain" d="M8 17l-1 4M16 17l-1 4"/><path class="snow" d="M12 18v3M10.6 19.5h2.8"/>',
    snow: CLOUD_HI + '<path class="snow" d="M8 18v3M6.6 19.5h2.8M12 18v3M10.6 19.5h2.8M16 18v3M14.6 19.5h2.8"/>',
    thunder: CLOUD_HI + '<path class="bolt" d="M12 15l-2 4h3l-2 4"/>',
  };
  const wxIcon = (name) => `<svg class="wi" viewBox="0 0 24 24">${WX[name] || WX.cloud}</svg>`;
  wxIcon.inner = (name) => WX[name] || WX.cloud;

  return {
    media,
    stats,
    audio,
    rate,
    temp,
    tempUnit,
    level,
    duration,
    windUnit,
    wxIcon,
  };
})();
