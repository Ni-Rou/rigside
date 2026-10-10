"use strict";

// Our own title strip, since the main window doesn't have the Windows one: the name plus minimise,
// maximise and close, sitting over the scene. Drag it to move the window, double-click to maximise.
// It hides in full screen and in ?bare previews.
(() => {
  const bar = document.getElementById("titlebar");
  const win = window.__TAURI__?.window?.getCurrentWindow?.();
  if (!win || new URLSearchParams(location.search).has("bare")) return;

  const ICON = {
    min: '<svg viewBox="0 0 12 12"><path d="M2 6.5h8"/></svg>',
    max: '<svg viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7"/></svg>',
    restore:
      '<svg viewBox="0 0 12 12"><rect x="2.5" y="4" width="5.5" height="5.5"/><path d="M4 4V2.5h5.5V8H8"/></svg>',
    close: '<svg viewBox="0 0 12 12"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7"/></svg>',
  };
  const btn = (k) => bar.querySelector(`[data-win="${k}"]`);
  btn("min").innerHTML = ICON.min;
  btn("max").innerHTML = ICON.max;
  btn("close").innerHTML = ICON.close;

  bar.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-win]");
    if (!b) return;
    const act = { min: () => win.minimize(), max: () => win.toggleMaximize(), close: () => win.close() }[b.dataset.win];
    act?.().catch?.((err) => console.warn("window", err));
  });

  // show the strip unless we're full screen, and swap maximise for restore when maximised
  async function sync() {
    try {
      const [full, maxed] = await Promise.all([win.isFullscreen(), win.isMaximized()]);
      document.documentElement.classList.toggle("titlebar", !full);
      btn("max").innerHTML = maxed ? ICON.restore : ICON.max;
      btn("max").setAttribute("aria-label", maxed ? "Restore" : "Maximise");
    } catch {
      document.documentElement.classList.add("titlebar");
    }
  }
  sync();
  addEventListener("resize", sync);
})();
