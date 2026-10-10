"use strict";

/* Weather tab: the weather now in detail, sun and moon, air quality, a 24-hour chart (temperature
   over rain bars, night shaded, icons and wind every 3 h) and the week with temperature bars that
   share one scale so the days compare properly. */
(() => {
  const $ = RS.$,
    esc = RS.esc,
    D = RS_DATA;
  let last = null;

  const dayName = (iso, i) =>
    i === 0 ? "Today" : new Date(`${iso}T12:00`).toLocaleDateString(undefined, { weekday: "short" });
  const hm = (s) => `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} m`;

  // Moon phase 0..1 (0 new, 0.5 full) from a known new moon and the synodic month.
  function moon(date = new Date()) {
    const phase = ((((date.getTime() / 86400000 - 10957.76) / 29.530588853) % 1) + 1) % 1; // 2000-01-06 18:14 UTC new moon
    const lit = Math.round((1 - Math.cos(phase * 2 * Math.PI)) * 50);
    const names = [
      "New moon",
      "Waxing crescent",
      "First quarter",
      "Waxing gibbous",
      "Full moon",
      "Waning gibbous",
      "Last quarter",
      "Waning crescent",
    ];
    return { phase, lit, name: names[Math.round(phase * 8) % 8] };
  }
  window.RS_MOON = moon;

  function moonSvg(phase) {
    const r = 9,
      k = Math.cos(phase * 2 * Math.PI),
      waxing = phase < 0.5;
    const rx = Math.abs(k) * r,
      outer = waxing ? 1 : 0,
      inner = k > 0 === waxing ? 0 : 1;
    return (
      `<svg viewBox="-12 -12 24 24" class="wt-moon"><circle r="${r}" class="dark"/>` +
      `<path class="lit" d="M0,${-r} A${r},${r} 0 0 ${outer} 0,${r} A${rx},${r} 0 0 ${inner} 0,${-r} Z"/></svg>`
    );
  }

  function renderNow(w) {
    const n = w.now,
      t = w.today;
    const kv = (k, v) => (v == null || v === "" ? "" : `<div><span>${k}</span><b>${esc(v)}</b></div>`);
    $("wt-now").innerHTML =
      `<div class="wt-top">${D.wxIcon(n.icon)}<b class="wt-temp">${n.temp}°</b>` +
      `<div><div class="wt-desc">${esc(n.desc)}</div><div class="wt-sub">Feels ${n.feels}° · ${t.max ?? "–"}° / ${t.min ?? "–"}°</div></div></div>` +
      `<div class="wt-kv">` +
      kv("Wind", `${n.wind_from} ${n.wind}${n.gust ? `–${n.gust}` : ""} ${D.windUnit()}`) +
      kv("Humidity", n.humidity != null ? `${n.humidity}%` : null) +
      kv("Pressure", n.pressure != null ? `${n.pressure} hPa` : null) +
      kv("UV", n.uv) +
      kv("Visibility", n.visibility_km != null ? `${Math.round(n.visibility_km)} km` : null) +
      kv("Air", aqiText(w.air)) +
      `</div>`;
  }

  function aqiText(a) {
    if (!a || a.eaqi == null) return null;
    const v = a.eaqi;
    return v <= 20 ? "Good" : v <= 40 ? "Fair" : v <= 60 ? "Moderate" : v <= 80 ? "Poor" : "Very poor";
  }

  function renderSky(w) {
    const t = w.today,
      days = w.days,
      m = moon();
    let trend = "";
    if (days[0]?.daylight_s && days[1]?.daylight_s) {
      const diff = days[1].daylight_s - days[0].daylight_s,
        a = Math.abs(diff);
      trend = `<span class="wt-trend ${diff >= 0 ? "up" : "down"}">${diff >= 0 ? "+" : "−"}${Math.floor(a / 60) ? Math.floor(a / 60) + " m " : ""}${a % 60} s tomorrow</span>`;
    }
    const aq = w.air;
    $("wt-sky").innerHTML =
      `<div class="card-h">Sun &amp; moon</div>` +
      `<div class="wt-row"><span>Sunrise</span><b>${esc(t.sunrise || "–")}</b><span>Sunset</span><b>${esc(t.sunset || "–")}</b></div>` +
      (days[0]?.daylight_s
        ? `<div class="wt-row"><span>Daylight</span><b>${hm(days[0].daylight_s)}</b>${trend}</div>`
        : "") +
      `<div class="wt-row">${moonSvg(m.phase)}<b>${m.name}</b><span>${m.lit}% lit</span></div>` +
      (aq
        ? `<div class="wt-row"><span>Air quality</span><b class="aqi-${(aqiText(aq) || "").toLowerCase().replace(" ", "-")}">${esc(aqiText(aq) || "–")}</b>` +
          `<span>PM2.5</span><b>${aq.pm25 ?? "–"}</b></div>`
        : "");
  }

  function renderChart(hours) {
    const box = $("wt-chart");
    const W = Math.max(200, box.clientWidth),
      H = Math.max(100, box.clientHeight),
      n = hours.length;
    if (!n) {
      box.innerHTML = "";
      return;
    }
    const fs = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const top = fs * 2.2,
      bottom = H - fs * 2.2;
    const step = W / n,
      x = (i) => step * (i + 0.5);
    const temps = hours.map((h) => h.temp ?? 0),
      lo = Math.min(...temps) - 1,
      hi = Math.max(...temps) + 1;
    const y = (t) => top + fs * 0.8 + (1 - (t - lo) / Math.max(1, hi - lo)) * (bottom - top - fs * 2.4);
    const maxRain = Math.max(1.5, ...hours.map((h) => h.precip || 0));
    let svg = "";
    hours.forEach((h, i) => {
      if (h.icon.endsWith("-night"))
        svg += `<rect x="${(x(i) - step / 2).toFixed(1)}" y="${top - 4}" width="${(step + 0.6).toFixed(1)}" height="${bottom - top + 4}" class="night"/>`;
      const mm = h.precip || 0;
      if (mm > 0) {
        const bh = Math.max(2, (mm / maxRain) * (bottom - top) * 0.4);
        svg += `<rect x="${(x(i) - step * 0.35).toFixed(1)}" y="${(bottom - bh).toFixed(1)}" width="${(step * 0.7).toFixed(1)}" height="${bh.toFixed(1)}" class="rainbar" style="opacity:${0.3 + 0.6 * ((h.pop ?? 60) / 100)}"/>`;
      }
    });
    svg += `<polyline class="tline" points="${hours.map((h, i) => `${x(i).toFixed(1)},${y(h.temp ?? 0).toFixed(1)}`).join(" ")}"/>`;
    const every = W / n < fs * 1.6 ? 4 : W / n < fs * 2.6 ? 3 : 2;
    const icon = fs * 1.6;
    hours.forEach((h, i) => {
      if (i % every !== 0) return;
      svg += `<circle cx="${x(i)}" cy="${y(h.temp)}" r="${fs * 0.18}" class="tdot"/><text x="${x(i)}" y="${y(h.temp) - fs * 0.5}" font-size="${fs * 0.8}">${h.temp}°</text>`;
      svg += `<text x="${x(i)}" y="${bottom + fs * 0.95}" class="hour" font-size="${fs * 0.75}">${h.time.slice(11, 13)}</text>`;
      svg += `<text x="${x(i)}" y="${bottom + fs * 1.9}" class="wind" font-size="${fs * 0.68}">${h.dir} ${h.wind}</text>`;
      svg += `<svg x="${x(i) - icon / 2}" y="0" width="${icon}" height="${icon}" viewBox="0 0 24 24" class="wi">${D.wxIcon.inner(h.icon)}</svg>`;
    });
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${svg}</svg>`;
  }

  function renderDays(days) {
    $("wt-days").innerHTML = days
      .map(
        (d, i) =>
          `<div class="wt-day"><b class="dn">${dayName(d.date, i)}</b>${D.wxIcon(d.icon)}` +
          `<span class="mx">${d.max ?? "–"}°</span><span class="mn">${d.min ?? "–"}°</span>` +
          `<span class="pop">${d.pop >= 20 ? d.pop + "%" : ""}</span></div>`,
      )
      .join("");
  }

  function render(snap) {
    last = snap;
    const w = snap.data;
    $("wt-empty").hidden = !!w || snap.configured;
    $("wt").classList.toggle("stale", !!snap.stale && !!w);
    for (const id of ["wt-now", "wt-sky", "wt-days"]) $(id).hidden = !w;
    if (!w) {
      $("wt-chart").innerHTML = "";
      return;
    }
    renderNow(w);
    renderSky(w);
    renderDays(w.days);
    $("wt-rainline").textContent = w.rain.text ? `· ${w.rain.text}` : "";
    if (RS.current() === "weather") renderChart(w.hours24);
  }

  RS.on("weather", render);
  new ResizeObserver(() => {
    if (last?.data && RS.current() === "weather") renderChart(last.data.hours24);
  }).observe($("wt-chart"));
  RS.tab("weather", {
    interval: 60000,
    onShow: () => last && render(last),
    async refresh() {
      if (last) render(last);
    },
  });
})();
