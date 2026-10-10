"use strict";

/* The settings screen. Changes save straight away (RS.set, which Rust writes to settings.json). */
(() => {
  const $ = RS.$,
    esc = RS.esc;
  const panel = $("settings"),
    nav = panel.querySelector(".s-nav"),
    body = panel.querySelector(".s-body");
  const SECTIONS = [
    ["theme", "Theme"],
    ["tabs", "Tabs"],
    ["location", "Weather"],
    ["display", "Display"],
    ["audio", "Audio"],
    ["overlay", "Overlay"],
    ["about", "About"],
  ];
  const TAB_NAMES = { home: "Home", weather: "Weather", playing: "Playing", pc: "PC", macros: "Macros" };
  let section = "theme";

  panel.querySelector(".s-close").innerHTML = RS_ICON("close");
  panel.querySelector(".s-close").addEventListener("click", close);
  $("open-settings").addEventListener("click", () => open());
  RS.on("open-settings", (s) => open(s));
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-open-settings]");
    if (b) open(b.dataset.openSettings);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) close();
  });

  function open(s) {
    if (s) section = s;
    panel.hidden = false;
    draw();
  }
  function close() {
    panel.hidden = true;
  }

  const toggle = (key, label, hint = "") => {
    const on = !!RS.settings()[key];
    return `<button type="button" class="s-toggle ${on ? "on" : ""}" data-toggle="${key}"><span><b>${label}</b>${hint ? `<small>${hint}</small>` : ""}</span><i></i></button>`;
  };
  const choice = (key, label, opts) =>
    `<div class="s-row"><span class="s-lbl">${label}</span><div class="seg">${opts
      .map(
        ([v, t]) =>
          `<button type="button" data-set="${key}" data-val="${esc(JSON.stringify(v))}" class="${RS.settings()[key] === v ? "active" : ""}">${t}</button>`,
      )
      .join("")}</div></div>`;

  // keep the scroll position when something changes, only jump to the top for a new section
  let drawnSection = null;
  async function draw() {
    const keep = drawnSection === section ? body.scrollTop : 0;
    nav.innerHTML = SECTIONS.map(
      ([id, t]) => `<button type="button" data-sec="${id}" class="${id === section ? "active" : ""}">${t}</button>`,
    ).join("");
    body.innerHTML = await (VIEWS[section] || VIEWS.theme)();
    body.scrollTop = keep;
    drawnSection = section;
  }

  const VIEWS = {
    theme() {
      const s = RS.settings();
      const fam = {};
      for (const t of window.RS_THEMES) (fam[t.family] ||= []).push(t);
      return (
        `<h2>Theme</h2>` +
        Object.entries(fam)
          .map(
            ([f, list]) =>
              `<h3>${esc(window.RS_FAMILIES[f] || f)}</h3><div class="swatch-grid">` +
              list
                .map(
                  (t) =>
                    `<button type="button" class="swatch ${s.theme === t.id ? "on" : ""}" data-theme-pick="${t.id}" data-theme="${t.id}">` +
                    `<span class="sw-band"><i></i><i></i><i></i></span><b>${esc(t.name)}</b><small>${esc(t.blurb)}</small></button>`,
                )
                .join("") +
              `</div>`,
          )
          .join("") +
        `<h3>Animation</h3>` +
        choice("motion", "Scene", [
          ["full", "Smooth"],
          ["low", "Low power"],
          ["off", "Still"],
        ]) +
        choice("gaming_motion", "While gaming", [
          ["same", "Keep going"],
          ["low", "Slow down"],
          ["pause", "Pause"],
        ]) +
        `<p class="s-note">"While gaming" applies when any app is full screen. Low power draws a few frames a second.</p>`
      );
    },

    tabs() {
      const tabs = RS.settings().tabs;
      return (
        `<h2>Tabs</h2><p class="s-note">Turn tabs on or off and change their order.</p><div class="s-list">` +
        tabs
          .map(
            (t, i) =>
              `<div class="s-item"><button type="button" class="s-check ${t.on ? "on" : ""}" data-tab-on="${i}">${RS_ICON(t.on ? "check" : "close")}</button>` +
              `<b>${TAB_NAMES[t.id]}</b><span class="grow"></span>` +
              `<button type="button" class="icon-btn" data-tab-move="${i}:-1" ${i === 0 ? "disabled" : ""} aria-label="Move up">${RS_ICON("up")}</button>` +
              `<button type="button" class="icon-btn" data-tab-move="${i}:1" ${i === tabs.length - 1 ? "disabled" : ""} aria-label="Move down">${RS_ICON("down")}</button></div>`,
          )
          .join("") +
        `</div>` +
        `<h3>Clock</h3>` +
        toggle("clock_24h", "24-hour clock") +
        toggle("clock_seconds", "Show seconds")
      );
    },

    location() {
      const s = RS.settings(),
        l = s.location;
      return (
        `<h2>Weather</h2>` +
        `<div class="s-row"><span class="s-lbl">Location</span><b>${l ? esc([l.name, l.admin, l.country].filter(Boolean).join(", ")) : "Not set"}</b></div>` +
        `<form class="s-search" id="s-loc-form"><input id="s-loc" placeholder="Search for a town or city" autocomplete="off"><button class="btn" type="submit">Search</button></form>` +
        `<div class="s-results" id="s-loc-results"></div>` +
        choice("temp_unit", "Temperature", [
          ["c", "°C"],
          ["f", "°F"],
        ]) +
        choice("wind_unit", "Wind", [
          ["mph", "mph"],
          ["kmh", "km/h"],
          ["ms", "m/s"],
        ]) +
        `<p class="s-note">Forecasts from <b>Open-Meteo</b> (free, no account). Only the location you pick is sent to it.</p>`
      );
    },

    async display() {
      let mons = [];
      try {
        mons = await RS.invoke("monitors");
      } catch {
        /* not in the app */
      }
      let auto = false;
      try {
        auto = await RS.invoke("autostart_get");
      } catch {
        /* not in the app */
      }
      const s = RS.settings();
      return (
        `<h2>Display</h2>` +
        `<h3>Put Rigside on a screen</h3><div class="s-mons">${
          mons
            .map(
              (m) =>
                `<div class="s-mon ${m.current ? "on" : ""}"><b>${esc(m.name.replace(/^\\\\\.\\/, ""))}</b><small>${m.width} × ${m.height}${m.current ? " · here now" : ""}</small>` +
                `<span><button type="button" class="btn" data-mon="${m.index}:1">${RS_ICON("fullscreen")}Fill</button>` +
                `<button type="button" class="btn ghost" data-mon="${m.index}:0">Window</button></span></div>`,
            )
            .join("") || "<p class='s-note'>Only available in the app.</p>"
        }</div>` +
        `<p class="s-note">Fill = borderless full screen on that display. F11 toggles full screen; Esc doesn't leave it.</p>` +
        `<div class="s-row"><span class="s-lbl">Text size</span><input type="range" min="70" max="140" step="5" id="s-scale" value="${Math.round((s.ui_scale || 1) * 100)}" style="--fill:${(((s.ui_scale || 1) * 100 - 70) / 70) * 100}%"><b id="s-scale-v">${Math.round((s.ui_scale || 1) * 100)}%</b></div>` +
        toggle("always_on_top", "Keep on top of other windows") +
        toggle("close_to_tray", "Closing the window keeps Rigside in the tray") +
        `<button type="button" class="s-toggle ${auto ? "on" : ""}" data-autostart><span><b>Start with Windows</b></span><i></i></button>`
      );
    },

    async audio() {
      let a = null;
      try {
        a = await RS.invoke("audio_state");
      } catch {
        /* not in the app */
      }
      const favs = RS.settings().outputs || [];
      return (
        `<h2>Audio</h2><p class="s-note">Pick two outputs (say headphones and speakers) for the switch on the Playing tab. With none picked it cycles through all of them.</p><div class="s-list">` +
        (a
          ? a.outputs
              .map(
                (o) =>
                  `<div class="s-item"><button type="button" class="s-check ${favs.includes(o.id) ? "on" : ""}" data-out="${esc(o.id)}">${RS_ICON(favs.includes(o.id) ? "check" : "close")}</button>` +
                  `<b>${esc(o.name)}</b>${o.id === a.output_id ? '<span class="tag">in use</span>' : ""}</div>`,
              )
              .join("")
          : "<p class='s-note'>Only available in the app.</p>") +
        `</div>`
      );
    },

    async overlay() {
      const s = RS.settings();
      let shown = false;
      try {
        shown = await RS.invoke("overlay_visible");
      } catch {
        /* not in the app */
      }
      const items = s.overlay_items || {};
      return (
        `<h2>Overlay</h2><p class="s-note">A small always-on-top strip with your PC stats, for one-screen setups. Mouse clicks pass straight through it to the game.</p>` +
        `<div class="s-row"><button type="button" class="btn" data-overlay="${shown ? "hide" : "show"}">${shown ? "Hide overlay" : "Show overlay"}</button>` +
        `<button type="button" class="btn ghost" data-overlay="edit">Move it</button></div>` +
        `<div class="s-row"><span class="s-lbl">Hotkey</span><input id="s-hotkey" value="${esc(s.overlay_hotkey || "")}" placeholder="e.g. Ctrl+Shift+O" spellcheck="false"><button type="button" class="btn ghost" data-hotkey-save>Set</button></div>` +
        `<p class="s-note">Shows and hides the overlay from anywhere, even in a game. Leave empty for none.</p>` +
        toggle("overlay_on_start", "Show the overlay when Rigside starts") +
        `<h3>Show</h3><div class="s-chips">${[
          ["cpu", "CPU"],
          ["gpu", "GPU"],
          ["ram", "RAM"],
          ["clock", "Clock"],
          ["track", "Track"],
        ]
          .map(
            ([k, t]) => `<button type="button" class="chip ${items[k] ? "on" : ""}" data-ov-item="${k}">${t}</button>`,
          )
          .join("")}</div>`
      );
    },

    about() {
      return (
        `<h2>Rigside</h2><p>A themed second-screen dashboard for gaming PCs. Free and open source (MIT licence).</p>` +
        `<p class="s-note">Weather: Open-Meteo.com (CC BY 4.0). Fonts: SIL Open Font Licence. Theme art is original and not affiliated with any game or publisher.</p>` +
        `<p class="s-note">Temperatures come from LibreHardwareMonitor (run as administrator; Options → Remote Web Server → Run) or HWiNFO (Settings → Shared Memory Support; the free version turns it off after 12 hours) if you run either. Rigside itself installs no drivers. LibreHardwareMonitor's web server is open to your network; block inbound port 8085 in Windows Firewall to keep it local.</p>` +
        `<h3>Help and bug reports</h3>` +
        `<p class="s-note">Something wrong? "Report a problem" opens a short form on GitHub (a free GitHub account is needed). Paste in your system info, and attach rigside.log from the log folder if you can. Questions and ideas go in the project's Discussions.</p>` +
        `<div class="s-row"><button type="button" class="btn" data-help="report">Report a problem</button>` +
        `<button type="button" class="btn ghost" data-help="info">Copy system info</button>` +
        `<button type="button" class="btn ghost" data-help="logs">Open log folder</button></div>` +
        `<p class="s-note">System info lists your hardware, Windows version and audio devices, not what you're playing. Settings and the log are kept in %APPDATA%\\io.github.rigside.</p>` +
        `<h3>Updates</h3>` +
        toggle(
          "update_check",
          "Check for updates at start-up",
          "At most once a day, from the project's GitHub releases",
        ) +
        `<div class="s-row"><button type="button" class="btn" data-update="check">Check now</button><span class="s-note" id="upd-out"></span></div>`
      );
    },
  };

  // updates
  // "Check now" asks GitHub. If there's a newer version the button turns into "Install x.y.z", which
  // downloads the signed installer, runs it and restarts Rigside.
  async function updateClick(btn) {
    const out = body.querySelector("#upd-out"),
      say = (m) => {
        if (out) out.textContent = m;
      };
    const installing = btn.dataset.update === "install";
    btn.disabled = true;
    try {
      if (!installing) {
        say("Checking…");
        const u = await RS.invoke("update_check");
        if (!u) {
          say("You're up to date.");
          return;
        }
        say(`Version ${u.version} is available (you have ${u.current}).${u.notes ? " " + u.notes : ""}`);
        btn.textContent = `Install ${u.version}`;
        btn.dataset.update = "install";
      } else {
        say("Downloading and installing… Rigside will restart.");
        await RS.invoke("update_install");
      }
    } catch (err) {
      say(
        `${installing ? "Couldn't install the update" : "Couldn't check for updates"}: ${String(err?.message || err)}`,
      );
    } finally {
      btn.disabled = false;
    }
  }

  // Help: the GitHub form, system info for the report, and the folder with rigside.log
  async function helpClick(btn) {
    const what = btn.dataset.help;
    btn.disabled = true;
    try {
      if (what === "report") await RS.invoke("report_problem");
      else if (what === "logs") await RS.invoke("open_log_folder");
      else {
        const text = await RS.invoke("copy_system_info");
        await navigator.clipboard.writeText(text);
        RS.toast("System info copied: paste it into the bug report", 3000);
      }
    } catch (err) {
      RS.toast(String(err?.message || err), 5000);
    } finally {
      btn.disabled = false;
    }
  }

  // events
  nav.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-sec]");
    if (b) {
      section = b.dataset.sec;
      draw();
    }
  });

  body.addEventListener("click", async (e) => {
    const t = e.target.closest?.("button");
    if (!t) return;
    const s = RS.settings();
    if (t.dataset.update) {
      updateClick(t);
      return;
    }
    if (t.dataset.help) {
      helpClick(t);
      return;
    }
    if (t.dataset.themePick) RS.set({ theme: t.dataset.themePick });
    else if (t.dataset.set) RS.set({ [t.dataset.set]: JSON.parse(t.dataset.val) });
    else if (t.dataset.toggle) {
      RS.set({ [t.dataset.toggle]: !s[t.dataset.toggle] });
      if (t.dataset.toggle === "always_on_top")
        RS.invoke("set_always_on_top", { on: RS.settings().always_on_top }).catch(() => {});
    } else if (t.dataset.tabOn) {
      const tabs = structuredClone(s.tabs),
        i = Number(t.dataset.tabOn);
      tabs[i].on = !tabs[i].on;
      if (!tabs.some((x) => x.on)) return RS.toast("Keep at least one tab");
      RS.set({ tabs });
    } else if (t.dataset.tabMove) {
      const [i, d] = t.dataset.tabMove.split(":").map(Number),
        tabs = structuredClone(s.tabs);
      [tabs[i], tabs[i + d]] = [tabs[i + d], tabs[i]];
      RS.set({ tabs });
    } else if (t.dataset.loc) {
      RS.set({ location: JSON.parse(t.dataset.loc) });
    } else if (t.dataset.mon) {
      const [index, fill] = t.dataset.mon.split(":").map(Number);
      try {
        await RS.invoke("move_to_monitor", { index, fill: !!fill });
      } catch (er) {
        RS.toast(String(er));
      }
    } else if ("autostart" in t.dataset) {
      try {
        await RS.invoke("autostart_set", { on: !t.classList.contains("on") });
      } catch (er) {
        RS.toast(String(er));
      }
    } else if (t.dataset.out) {
      let favs = (s.outputs || []).filter((x) => x !== t.dataset.out);
      if (!(s.outputs || []).includes(t.dataset.out)) favs = [...favs, t.dataset.out].slice(-2);
      RS.set({ outputs: favs });
    } else if (t.dataset.overlay) {
      const how = t.dataset.overlay;
      try {
        await RS.invoke("overlay_set", { show: how !== "hide", edit: how === "edit" });
      } catch (er) {
        RS.toast(String(er));
      }
    } else if ("hotkeySave" in t.dataset) {
      const combo = $("s-hotkey").value.trim();
      if (await RS.set({ overlay_hotkey: combo })) RS.toast(combo ? "Hotkey saved" : "Hotkey turned off", 1500);
    } else if (t.dataset.ovItem) {
      const items = { ...(s.overlay_items || {}) };
      items[t.dataset.ovItem] = !items[t.dataset.ovItem];
      RS.set({ overlay_items: items });
    } else return;
    setTimeout(draw, 60);
  });

  body.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("s-loc").value.trim(),
      out = $("s-loc-results");
    if (q.length < 2) return;
    out.innerHTML = '<p class="s-note">Searching…</p>';
    try {
      const res = await RS_WEATHER.search(q);
      out.innerHTML = res.length
        ? res
            .map(
              (r) =>
                `<button type="button" class="s-result" data-loc="${esc(JSON.stringify(r))}">${RS_ICON("pin")}<b>${esc(r.name)}</b><small>${esc([r.admin, r.country].filter(Boolean).join(", "))}</small></button>`,
            )
            .join("")
        : '<p class="s-note">Nothing found. Try the nearest town.</p>';
    } catch (er) {
      out.innerHTML = `<p class="s-note">${esc(String(er.message || er))}</p>`;
    }
  });

  body.addEventListener("input", (e) => {
    if (e.target.id === "s-scale") {
      const v = Number(e.target.value);
      $("s-scale-v").textContent = `${v}%`;
      e.target.style.setProperty("--fill", `${((v - 70) / 70) * 100}%`);
      RS.set({ ui_scale: v / 100 });
    }
  });

  // First time running, so there's no location yet: open the weather search.
  RS.on("ready", (s) => {
    if (!s.location) setTimeout(() => open("location"), 400);
  });
})();
