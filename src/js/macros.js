"use strict";

/* Macros tab: a grid of big buttons that open something (an app, game, file, folder, website,
   steam:// link...) or press a key combo (Discord mute, OBS record, screenshots...). The pencil
   switches to edit mode, and then tapping a button opens the editor. They're saved in settings.macros. */
(() => {
  const $ = RS.$,
    esc = RS.esc;
  const MAX = 24;
  const COLOURS = [
    "",
    "#ff5c6c",
    "#ffb547",
    "#fcee0a",
    "#4dff6a",
    "#2ee6c5",
    "#5eb3ff",
    "#a78bfa",
    "#ff4fd8",
    "#ffffff",
  ];
  const ICONS = [
    "app",
    "game",
    "chat",
    "mic",
    "micoff",
    "deafen",
    "record",
    "stream",
    "screenshot",
    "camera",
    "music",
    "web",
    "folder",
    "terminal",
    "keyboard",
    "timer",
    "star",
    "bolt",
    "sword",
    "shield",
    "heart",
    "rocket",
    "eye",
    "bulb",
    "lock",
    "power",
    "layers",
    "gear",
  ];
  // Ready-made ones. Discord and OBS hotkeys are whatever you've set in those apps, these are just
  // the usual defaults.
  const PRESETS = [
    { label: "Discord mute", icon: "micoff", action: { kind: "keys", vks: [0x11, 0x10, 0x4d] } },
    { label: "Discord deafen", icon: "deafen", action: { kind: "keys", vks: [0x11, 0x10, 0x44] } },
    { label: "Record that", icon: "record", action: { kind: "keys", vks: [0x5b, 0x12, 0x47] } },
    { label: "Start/stop recording", icon: "record", action: { kind: "keys", vks: [0x5b, 0x12, 0x52] } },
    { label: "Screenshot", icon: "screenshot", action: { kind: "keys", vks: [0x5b, 0x10, 0x53] } },
    { label: "Task Manager", icon: "gauge", action: { kind: "keys", vks: [0x11, 0x10, 0x1b] } },
    { label: "Show desktop", icon: "layers", action: { kind: "keys", vks: [0x5b, 0x44] } },
    { label: "Steam", icon: "game", action: { kind: "run", target: "steam://open/main", args: "" } },
    { label: "Discord", icon: "chat", action: { kind: "run", target: "discord://", args: "" } },
    { label: "Downloads", icon: "folder", action: { kind: "run", target: "shell:Downloads", args: "" } },
    { label: "Calculator", icon: "calc", action: { kind: "run", target: "calc.exe", args: "" } },
  ];

  // Key names for showing combos and for the recorder (keyCode is the Windows VK code).
  const MOD = { 0x11: "Ctrl", 0x10: "Shift", 0x12: "Alt", 0x5b: "Win" };
  const NAMES = {
    0x08: "Backspace",
    0x09: "Tab",
    0x0d: "Enter",
    0x13: "Pause",
    0x14: "Caps Lock",
    0x1b: "Esc",
    0x20: "Space",
    0x21: "Page Up",
    0x22: "Page Down",
    0x23: "End",
    0x24: "Home",
    0x25: "←",
    0x26: "↑",
    0x27: "→",
    0x28: "↓",
    0x2c: "Print Screen",
    0x2d: "Insert",
    0x2e: "Delete",
    0x90: "Num Lock",
    0x91: "Scroll Lock",
    0xad: "Mute",
    0xae: "Volume down",
    0xaf: "Volume up",
    0xb0: "Next track",
    0xb1: "Previous track",
    0xb3: "Play/pause",
    0xba: ";",
    0xbb: "=",
    0xbc: ",",
    0xbd: "-",
    0xbe: ".",
    0xbf: "/",
    0xc0: "`",
    0xdb: "[",
    0xdc: "\\",
    0xdd: "]",
    0xde: "'",
  };
  const keyName = (vk) =>
    MOD[vk] ||
    NAMES[vk] ||
    (vk >= 0x70 && vk <= 0x87
      ? `F${vk - 0x6f}`
      : vk >= 0x60 && vk <= 0x69
        ? `Num ${vk - 0x60}`
        : String.fromCharCode(vk));
  const comboText = (vks) => (vks || []).map(keyName).join(" + ");

  let editing = false;
  const macros = () => RS.settings().macros || [];
  const uid = () => Math.random().toString(36).slice(2, 10);

  function cols(n) {
    const shape = document.documentElement.dataset.shape;
    const max = shape === "bar" ? 8 : shape === "tall" ? 3 : 4;
    const rowsWanted = shape === "bar" ? 2 : shape === "tall" ? 5 : 3;
    return Math.max(1, Math.min(max, Math.ceil(n / rowsWanted) + (n > 2 ? 1 : 0), n));
  }

  function render() {
    const list = macros(),
      grid = $("mc-grid");
    const items = list.map(
      (m, i) =>
        `<button type="button" class="card mc-btn" data-i="${i}" style="--mc-colour:${esc(m.colour || "")}">` +
        `${RS_ICON(m.icon || "app")}<span>${esc(m.label || "Untitled")}</span></button>`,
    );
    if (editing && list.length < MAX)
      items.push(
        `<button type="button" class="card mc-btn mc-add" data-add>${RS_ICON("plus")}<span>Add</span></button>`,
      );
    grid.innerHTML = items.join("");
    grid.style.setProperty("--cols", cols(items.length));
    $("mc-empty").hidden = list.length > 0 || editing;
    $("mc").classList.toggle("editing", editing);
    $("mc-edit").innerHTML = RS_ICON(editing ? "check" : "edit");
    $("mc-edit").title = editing ? "Done" : "Edit macros";
  }

  async function fire(btn, m) {
    btn.classList.add("fired");
    setTimeout(() => btn.classList.remove("fired"), 180);
    try {
      await RS.invoke("run_macro", { action: m.action });
    } catch (e) {
      btn.classList.add("fail");
      setTimeout(() => btn.classList.remove("fail"), 1500);
      RS.toast(String(e));
    }
  }

  $("mc-grid").addEventListener("click", (e) => {
    const b = e.target.closest?.(".mc-btn");
    if (!b) return;
    if (b.hasAttribute("data-add")) return openEditor(null);
    const i = Number(b.dataset.i),
      m = macros()[i];
    if (editing) openEditor(i);
    else if (m) fire(b, m);
  });
  $("mc-edit").addEventListener("click", () => {
    editing = !editing;
    render();
  });
  $("mc-add-first").addEventListener("click", () => {
    editing = true;
    render();
    openEditor(null);
  });
  RS.on("shape", render);
  RS.on("ready", render);

  // Editor
  const modal = $("mc-editor");
  RS.on("settings", () => {
    if (modal.hidden) render();
  }); // the list can change from elsewhere
  let draft = null,
    index = null,
    recording = false;

  function openEditor(i) {
    index = i;
    draft =
      i == null
        ? { id: uid(), label: "", icon: "app", colour: "", action: { kind: "run", target: "", args: "" } }
        : structuredClone(macros()[i]);
    recording = false;
    drawEditor();
    modal.hidden = false;
    setTimeout(() => modal.querySelector("#me-label")?.focus(), 30);
  }

  function close() {
    modal.hidden = true;
    recording = false;
  }

  function drawEditor() {
    const a = draft.action,
      keys = a.kind === "keys";
    const mods = [0x11, 0x10, 0x12, 0x5b];
    const main = keys ? (a.vks || []).find((v) => !mods.includes(v)) : null;
    modal.innerHTML = `
      <div class="m-box">
        <header class="m-head"><b>${index == null ? "New macro" : "Edit macro"}</b>
          <button type="button" class="icon-btn" data-x aria-label="Close">${RS_ICON("close")}</button></header>
        <div class="m-body">
          <div class="m-row presets"><span class="m-lbl">Quick start</span><div class="chips">${PRESETS.map(
            (p, k) =>
              `<button type="button" class="chip" data-preset="${k}">${RS_ICON(p.icon)}${esc(p.label)}</button>`,
          ).join("")}</div></div>
          <label class="m-row"><span class="m-lbl">Label</span><input id="me-label" maxlength="28" value="${esc(draft.label)}" placeholder="e.g. Mute Discord"></label>
          <div class="m-row"><span class="m-lbl">Does</span><div class="seg" id="me-kind">
            <button type="button" data-kind="run" class="${keys ? "" : "active"}">Open something</button>
            <button type="button" data-kind="keys" class="${keys ? "active" : ""}">Press keys</button></div></div>
          ${
            keys
              ? `
          <div class="m-row"><span class="m-lbl">Keys</span><div class="keys">
            ${mods.map((v) => `<button type="button" class="chip mod ${(a.vks || []).includes(v) ? "on" : ""}" data-mod="${v}">${MOD[v]}</button>`).join("")}
            <span class="plus">+</span>
            <button type="button" class="keycap ${recording ? "rec" : ""}" id="me-key">${recording ? "Press a key…" : main ? esc(keyName(main)) : "Choose key"}</button>
          </div></div>
          <p class="m-note">Tick the modifiers, then click the key box and press the key. Sends <b>${esc(comboText(a.vks) || "nothing yet")}</b>. Keys can't reach programs running as administrator.</p>`
              : `
          <label class="m-row"><span class="m-lbl">Open</span><input id="me-target" value="${esc(a.target)}" placeholder="C:\\Games\\game.exe, https://…, steam://rungameid/730, a folder…"></label>
          <label class="m-row"><span class="m-lbl">Arguments</span><input id="me-args" value="${esc(a.args || "")}" placeholder="optional, programs only"></label>
          <p class="m-note">Tip: shift + right-click a program or shortcut in Explorer → <b>Copy as path</b>, then paste here. Steam games: <b>steam://rungameid/&lt;app id&gt;</b>.</p>`
          }
          <div class="m-row"><span class="m-lbl">Icon</span><div class="icons">${ICONS.map(
            (ic) =>
              `<button type="button" class="ic ${draft.icon === ic ? "on" : ""}" data-icon="${ic}" aria-label="${ic}">${RS_ICON(ic)}</button>`,
          ).join("")}</div></div>
          <div class="m-row"><span class="m-lbl">Colour</span><div class="swatches">${COLOURS.map(
            (c) =>
              `<button type="button" class="sw ${draft.colour === c ? "on" : ""}" data-colour="${c}" style="--c:${c || "var(--accent)"}" aria-label="${c || "theme"}"></button>`,
          ).join("")}</div></div>
        </div>
        <footer class="m-foot">
          ${
            index != null
              ? `<button type="button" class="btn danger" data-del>${RS_ICON("trash")}Delete</button>
            <button type="button" class="icon-btn" data-move="-1" aria-label="Move earlier">${RS_ICON("left")}</button>
            <button type="button" class="icon-btn" data-move="1" aria-label="Move later">${RS_ICON("right")}</button>`
              : ""
          }
          <span class="grow"></span>
          <button type="button" class="btn" data-test>Test</button>
          <button type="button" class="btn primary" data-save>Save</button>
        </footer>
      </div>`;
  }

  function readInputs() {
    const v = (id) => modal.querySelector(id)?.value ?? null;
    if (v("#me-label") != null) draft.label = v("#me-label").trim();
    if (draft.action.kind === "run") {
      if (v("#me-target") != null)
        draft.action.target = v("#me-target")
          .trim()
          .replace(/^"(.*)"$/, "$1");
      if (v("#me-args") != null) draft.action.args = v("#me-args").trim();
    }
  }

  function valid() {
    const a = draft.action;
    if (a.kind === "run" && !a.target) return "Say what to open";
    if (a.kind === "keys" && !(a.vks || []).length) return "Choose the keys to press";
    return null;
  }

  modal.addEventListener("click", async (e) => {
    const t = e.target.closest?.("button");
    if (e.target === modal) return close();
    if (!t) return;
    readInputs();
    if (t.hasAttribute("data-x")) return close();
    if (t.dataset.preset) {
      const p = PRESETS[Number(t.dataset.preset)];
      Object.assign(draft, { label: p.label, icon: p.icon, action: structuredClone(p.action) });
    } else if (t.dataset.kind) {
      draft.action = t.dataset.kind === "keys" ? { kind: "keys", vks: [] } : { kind: "run", target: "", args: "" };
    } else if (t.dataset.mod) {
      const vk = Number(t.dataset.mod),
        vks = draft.action.vks || [];
      const mods = [0x11, 0x10, 0x12, 0x5b];
      const has = vks.includes(vk);
      const newMods = mods.filter((m) => (m === vk ? !has : vks.includes(m)));
      draft.action.vks = [...newMods, ...vks.filter((x) => !mods.includes(x))];
    } else if (t.id === "me-key") {
      recording = !recording;
    } else if (t.dataset.icon) {
      draft.icon = t.dataset.icon;
    } else if ("colour" in t.dataset) {
      draft.colour = t.dataset.colour;
    } else if (t.hasAttribute("data-test")) {
      const err = valid();
      if (err) return RS.toast(err);
      try {
        await RS.invoke("run_macro", { action: draft.action });
      } catch (er) {
        RS.toast(String(er));
      }
      return;
    } else if (t.hasAttribute("data-save")) {
      const err = valid();
      if (err) return RS.toast(err);
      if (!draft.label)
        draft.label =
          draft.action.kind === "keys" ? comboText(draft.action.vks) : draft.action.target.split(/[\\/]/).pop();
      const list = [...macros()];
      if (index == null) list.push(draft);
      else list[index] = draft;
      RS.set({ macros: list });
      close();
      render();
      return;
    } else if (t.hasAttribute("data-del")) {
      const list = macros().filter((_, k) => k !== index);
      RS.set({ macros: list });
      close();
      render();
      return;
    } else if (t.dataset.move) {
      const list = [...macros()],
        j = index + Number(t.dataset.move);
      if (j < 0 || j >= list.length) return;
      [list[index], list[j]] = [list[j], list[index]];
      list[j] = draft;
      index = j;
      RS.set({ macros: list });
      render();
    }
    drawEditor();
  });

  // Recording a combo: the first key that isn't Ctrl/Shift/Alt/Win becomes the main key.
  document.addEventListener(
    "keydown",
    (e) => {
      if (modal.hidden) return;
      if (e.key === "Escape" && !recording) return close();
      if (!recording) return;
      e.preventDefault();
      const vk = e.keyCode;
      if ([0x10, 0x11, 0x12, 0x5b, 0x5c].includes(vk)) return; // modifiers are the chips
      readInputs();
      const mods = [];
      if (e.ctrlKey) mods.push(0x11);
      if (e.shiftKey) mods.push(0x10);
      if (e.altKey) mods.push(0x12);
      const chips = (draft.action.vks || []).filter((v) => [0x11, 0x10, 0x12, 0x5b].includes(v));
      const all = [...new Set([...chips, ...mods])].sort(
        (a, b) => [0x11, 0x10, 0x12, 0x5b].indexOf(a) - [0x11, 0x10, 0x12, 0x5b].indexOf(b),
      );
      draft.action.vks = [...all, vk];
      recording = false;
      drawEditor();
    },
    true,
  );
})();
