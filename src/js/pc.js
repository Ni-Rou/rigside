"use strict";

/* PC tab: CPU and GPU load rings with their temps, memory, network, drives, uptime and mic mute. */
(() => {
  const $ = RS.$,
    esc = RS.esc,
    D = RS_DATA;
  const C = 2 * Math.PI * 40; // ring circumference (r = 40 in a 100x100 box)

  function ring(el, pct, label, cls = "") {
    if (!el.firstChild) {
      el.innerHTML = `<svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="40"/><circle class="val" cx="50" cy="50" r="40" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg><b></b><small></small>`;
    }
    el.className = `ring ${cls}`;
    el.querySelector(".val").style.strokeDashoffset = C * (1 - Math.max(0, Math.min(100, pct ?? 0)) / 100);
    el.querySelector("b").textContent = pct == null ? "–" : `${Math.round(pct)}%`;
    el.querySelector("small").textContent = label;
  }

  function tempBox(el, c, warm, hot) {
    if (c == null) {
      el.className = "pc-temp none";
      el.innerHTML = "Temperature needs LibreHardwareMonitor or HWiNFO";
      return;
    }
    el.className = `pc-temp ${D.level(c, warm, hot)}`;
    el.innerHTML = `${D.temp(c)}${D.tempUnit()}<small>temp</small>`;
  }

  function uptime(s) {
    const d = Math.floor(s / 86400),
      h = Math.floor((s % 86400) / 3600),
      m = Math.floor((s % 3600) / 60);
    return d ? `${d}<small>d</small> ${h}<small>h</small>` : `${h}<small>h</small> ${m}<small>m</small>`;
  }

  function render(s) {
    $("pc-cpu-name").textContent = s.cpu_name.replace(/\s*\d+-Core Processor$/i, "").replace(/\(R\)|\(TM\)/g, "");
    ring($("pc-cpu-load"), s.cpu_load, "load", D.level(s.cpu_load, 70, 90));
    tempBox($("pc-cpu-temp"), s.cpu_temp, 75, 88);

    const g = s.gpu;
    document.querySelector(".pc-gpu").hidden = !g;
    if (g) {
      $("pc-gpu-name").textContent = g.name;
      ring($("pc-gpu-load"), g.load, "load", D.level(g.load, 80, 95));
      tempBox($("pc-gpu-temp"), g.temp, Math.min(75, (g.temp_max || 90) - 15), Math.min(85, (g.temp_max || 90) - 5));
      const kv = [];
      if (g.vram_total_mb)
        kv.push(`VRAM ${(g.vram_used_mb / 1024).toFixed(1)}/${Math.round(g.vram_total_mb / 1024)} GB`);
      if (g.power_w != null) kv.push(`${Math.round(g.power_w)} W`);
      if (g.fan != null) kv.push(`fan ${g.fan}%`);
      $("pc-gpu-kv").innerHTML = kv.map((k) => `<span>${esc(k)}</span>`).join("");
    }

    const pct = (s.ram_used_gb / s.ram_total_gb) * 100;
    $("pc-ram").innerHTML = `${s.ram_used_gb.toFixed(1)}<small> / ${Math.round(s.ram_total_gb)} GB</small>`;
    $("pc-ram-bar").style.width = `${pct}%`;
    $("pc-ram-bar").parentElement.className = `bar ${D.level(pct, 80, 92)}`;

    $("pc-net").innerHTML =
      `<div><span>Down</span>${D.rate(s.net_down_bps)}</div><div><span>Up</span>${D.rate(s.net_up_bps)}</div>`;

    $("pc-disks").innerHTML = s.disks
      .slice(0, 5)
      .map((d) => {
        const p = (d.used_gb / d.total_gb) * 100;
        const free = d.total_gb - d.used_gb;
        return (
          `<div class="disk"><b>${esc(d.name)}</b><i class="bar ${D.level(p, 85, 95)}"><i style="width:${p}%"></i></i>` +
          `<span>${free >= 1000 ? (free / 1024).toFixed(1) + " TB" : Math.round(free) + " GB"} free</span></div>`
        );
      })
      .join("");

    $("pc-uptime").innerHTML = uptime(s.uptime_s);
    const noTemps = s.cpu_temp == null;
    $("pc-hint").hidden = !noTemps;
    if (noTemps)
      $("pc-hint").innerHTML =
        "For CPU temperature, run LibreHardwareMonitor as administrator (Options → Remote Web Server → Run) or HWiNFO (Settings → Shared Memory Support; the free version turns it off after 12 hours).";
  }

  function renderMic(a) {
    const b = $("pc-mic");
    b.hidden = a.mic_muted == null;
    b.classList.toggle("on", !!a.mic_muted);
    b.querySelector(".ico-slot").innerHTML = RS_ICON(a.mic_muted ? "micoff" : "mic");
    b.lastElementChild.textContent = a.mic_muted ? "Mic muted" : "Mic on";
  }

  $("pc-mic").addEventListener("click", async () => {
    try {
      renderMic(await RS.invoke("toggle_mic"));
    } catch (e) {
      RS.toast(String(e));
    }
  });

  let micCheck = 0;
  RS.tab("pc", {
    interval: 2000,
    async refresh() {
      render(await D.stats());
      if (micCheck++ % 3 === 0)
        D.audio()
          .then(renderMic)
          .catch(() => {});
    },
  });
})();
