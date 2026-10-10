"use strict";

// Deep: coral reef with a research habitat. Everything glows at night.
(() => {
  const { Buf, ramp, bayer, H_, mix, css, blendRamp, ridge, glowSprite, shade, sprite, mist, vignette } = RS_PX;
  const { rng } = RS_SCENE;
  const WATER = {
    day: H_(["#5ee0f0", "#2cbadc", "#1894c8", "#0e70ae", "#0a5290", "#083a70"]),
    night: H_(["#0a2034", "#06182a", "#041222", "#030e1a", "#020a14", "#01060e"]),
    warm: H_(["#e0b080", "#7aa8b8", "#3a84a8", "#1e6496", "#124a7c", "#0a3462"]),
    grey: H_(["#5a8c98", "#3e7488", "#2a5c76", "#1e4864", "#163852", "#0e2840"]),
  };
  const CORAL = [
    [255, 110, 140],
    [255, 160, 80],
    [190, 110, 255],
    [255, 220, 120],
    [120, 230, 200],
    [255, 90, 90],
  ];

  function waterRamp(e) {
    let r = blendRamp(WATER.night, WATER.day, RS_PX.smooth(e.day));
    if (e.glow > 0) r = blendRamp(r, WATER.warm, e.glow * 0.5);
    if (e.wx.grey > 0.4)
      r = blendRamp(r, e.night ? WATER.night : WATER.grey, (e.wx.grey - 0.3) * (e.wx.rain ? 1.1 : 0.7));
    return r;
  }

  function build(W, H) {
    const r = rng(4096),
      sand = Math.round(H * 0.84);
    const sandLine = ridge(r, W, [
      [80, 1],
      [25, 0.3],
    ]);
    const reefs = [
      { x0: W * 0.0, x1: W * 0.42, h: H * 0.24 },
      { x0: W * 0.66, x1: W * 0.76, h: H * 0.07 },
    ];
    const corals = [];
    for (const rf of reefs)
      for (let i = 0; i < (rf.x1 - rf.x0) / 2.2; i++)
        corals.push({
          x: rf.x0 + r() * (rf.x1 - rf.x0),
          dy: r() < 0.55 ? 0 : r(),
          kind: Math.floor(r() * 6),
          col: CORAL[Math.floor(r() * CORAL.length)],
          s: 3 + r() * 5,
          rf,
        });
    corals.sort((a, b) => a.dy - b.dy);
    const hab = { x: Math.round(W * 0.86), y: sand - 2 };
    const nk = Math.max(3, Math.round(W / 70)),
      kelp = Array.from({ length: nk }, (_, i) => ({
        x: Math.round(((i + 0.2 + r() * 0.6) * W) / nk),
        h: H * (0.22 + r() * 0.42),
        ph: r() * 6,
      }));
    const school = Array.from({ length: 24 }, () => [r() * 2 - 1, r() * 2 - 1, r()]);
    const plankton = Array.from({ length: Math.round((W * H) / 160) }, () => [r(), r(), r()]);
    const jellies = Array.from({ length: 3 }, (_, i) => ({
      x: r(),
      y: 0.2 + r() * 0.4,
      ph: r() * 6,
      col: [
        [255, 160, 220],
        [160, 220, 255],
        [220, 180, 255],
      ][i],
    }));
    const angels = Array.from({ length: 4 }, () => ({
      x: r(),
      y: 0.45 + r() * 0.3,
      sp: 4 + r() * 4,
      dir: r() < 0.5 ? 1 : -1,
      col: CORAL[Math.floor(r() * CORAL.length)],
    }));
    const bubbles = Array.from({ length: 20 }, () => [r(), r(), r()]);
    return { W, H, sand, sandLine, reefs, corals, hab, kelp, school, plankton, jellies, angels, bubbles, glows: {} };
  }

  const surfaceY = (w) => Math.round(w.H * 0.07);

  function background(g, w, e) {
    const { W, H } = w,
      b = new Buf(g, W, H),
      wr = waterRamp(e),
      sy = surfaceY(w);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b.px(x, y, ramp(wr, y / H, x, y, 0.35));
    // far silhouettes: rock arches and kelp forest, two depths of haze
    const r = rng(31),
      far = (y) => wr[Math.min(5, Math.round((y / H) * 5 + 0.5))];
    for (const [depth, haze] of [
      [0, 0.75],
      [1, 0.55],
    ]) {
      const top = ridge(r, W, [
        [50, 1],
        [17, 0.35],
      ]);
      for (let x = 0; x < W; x++) {
        const t = Math.round(H * (0.52 + depth * 0.1) - top[x] * H * 0.18);
        for (let y = t; y < H; y++) b.px(x, y, mix(mix([30, 60, 70], far(y), 0.2), far(y), haze));
      }
      // an arch in the far rock
      const ax = W * (depth ? 0.62 : 0.3),
        ay = H * (0.5 + depth * 0.08),
        aw = 22 - depth * 6;
      for (let y = -aw * 0.9; y < aw * 0.4; y++)
        for (let x = -aw; x <= aw; x++) {
          const out = (x / aw) ** 2 + (y / (aw * 0.9)) ** 2,
            inn = (x / (aw * 0.6)) ** 2 + ((y - 4) / (aw * 0.65)) ** 2;
          if (out < 1 && (inn > 1 || y < -aw * 0.3))
            b.px(ax + x, ay + y, mix(mix([30, 60, 70], far(ay + y), 0.2), far(ay + y), haze));
        }
      for (let i = 0; i < W / 14; i++) {
        const kx = r() * W,
          kh = H * (0.3 + r() * 0.3);
        for (let y = 0; y < kh; y++)
          b.px(kx + Math.sin(y * 0.1 + i) * 2, H * 0.75 - y, mix([30, 80, 60], far(H * 0.75 - y), haze + 0.05));
      }
    }
    // the surface: brighter band and a light glow from the sun above
    for (let y = 0; y < sy; y++)
      for (let x = 0; x < W; x++)
        b.px(x, y, mix(wr[0], e.night ? [40, 70, 100] : [220, 250, 255], (1 - y / sy) * (e.night ? 0.3 : 0.55)));
    b.put(g);
  }

  function land(g, w, e) {
    const { W, H, sand } = w,
      b = new Buf(g, W, H),
      wr = waterRamp(e),
      night = e.day < 0.4;
    const dark = night ? 0.72 : 0.08;
    const tone = (c, y) =>
      mix(mix(c, wr[Math.min(5, Math.round((y / H) * 5))], 0.18 + (y < H * 0.6 ? 0.15 : 0)), [2, 6, 14], dark);
    const P = (x, y, c) => b.px(x, y, tone(c, y));
    // sand: ripples, shells, a slope down to the reef
    for (let x = 0; x < W; x++) {
      const top = Math.round(sand - w.sandLine[x] * 6);
      for (let y = top; y < H; y++) {
        const rip = Math.sin(x * 0.35 + y * 1.4 + Math.sin(x * 0.05) * 3) > 0.7;
        P(
          x,
          y,
          y === top
            ? [236, 222, 176]
            : rip
              ? [210, 194, 150]
              : (x * 3 + y * 7) % 31 === 0
                ? [170, 150, 120]
                : [226, 210, 166],
        );
      }
    }
    for (let i = 0; i < W / 20; i++) {
      const sx = (i * 37) % W,
        sy2 = sand + 5 + ((i * 13) % (H - sand - 6));
      P(sx, sy2, [250, 230, 220]);
      P(sx + 1, sy2, [230, 170, 160]);
      P(sx, sy2 - 1, [250, 240, 230]);
    }
    // the wreck settled in the sand: a tilted hull with portholes, a broken mast, weed
    const wx0 = Math.round(W * 0.44),
      wy = Math.round(sand - 9);
    for (let x = 0; x < 64; x++) {
      const tilt = Math.round(x * 0.18),
        deck = wy - 8 + tilt,
        keel = wy + 6 + tilt - Math.round(Math.abs(x - 32) * 0.12);
      if (x > 54 && x % 3 === 0) continue; // a broken stern
      for (let y = deck; y < keel; y++)
        P(
          wx0 + x,
          y,
          y === deck ? [120, 110, 90] : (x + y) % 9 === 0 ? [70, 60, 50] : y - deck < 3 ? [100, 84, 66] : [80, 66, 54],
        );
      if (x % 8 === 4 && x < 52) {
        P(wx0 + x, deck + 3, [30, 30, 30]);
        P(wx0 + x + 1, deck + 3, [30, 30, 30]);
      }
    }
    for (let y = 0; y < 26; y++) P(wx0 + 22 + Math.round(y * 0.25), wy - 8 + 4 - y, [90, 76, 60]);
    for (let x = -6; x < 7; x++) P(wx0 + 22 + 5 + x, wy - 26, [90, 76, 60]);
    // reef ridges: rock mounds covered in coral
    for (const rf of w.reefs)
      for (let x = Math.floor(rf.x0); x < rf.x1; x++) {
        const t = (x - rf.x0) / (rf.x1 - rf.x0),
          top = Math.round(sand - Math.sin(t * Math.PI) * rf.h - Math.sin(x * 0.3) * 2);
        for (let y = top; y < sand + 2; y++) {
          const n = Math.sin(x * 0.9 + y * 0.4) + Math.sin(x * 0.31 - y * 0.7);
          P(x, y, y - top < 2 ? [150, 120, 130] : n > 1.2 ? [70, 56, 76] : n > 0.3 ? [116, 92, 108] : [96, 76, 94]);
        }
        rf[x] = top;
      }
    for (const c of w.corals) {
      const x = Math.round(c.x),
        surf = c.rf[x] ?? sand,
        top = Math.round(surf + c.dy * (sand - surf) * 0.85),
        col = c.col,
        S = Math.round(c.s);
      if (c.kind === 0) {
        // brain coral: a dome with grooves
        for (let y = -S; y <= 0; y++)
          for (let xx = -S; xx <= S; xx++)
            if (xx * xx + y * y * 2.2 <= S * S)
              P(
                x + xx,
                top + y,
                Math.sin(xx * 1.5 + y * 2) > 0.4 ? shade(col, -0.35) : xx + y < -S * 0.5 ? shade(col, 0.2) : col,
              );
      } else if (c.kind === 1) {
        // tube sponges
        for (let k = 0; k < 3; k++) {
          const tx = x + (k - 1) * 3,
            th = S + 2 + k * 2;
          for (let y = 0; y < th; y++) {
            P(tx, top - y, shade(col, -0.2));
            P(tx + 1, top - y, col);
          }
          P(tx, top - th, shade(col, -0.6));
          P(tx + 1, top - th, shade(col, 0.3));
        }
      } else if (c.kind === 2) {
        // sea fan: branching
        const br = (bx, by, an, len, d) => {
          for (let k = 0; k < len; k++) P(bx + Math.cos(an) * k, by + Math.sin(an) * k, d > 1 ? col : shade(col, -0.2));
          if (d < 3) {
            const ex = bx + Math.cos(an) * len,
              ey = by + Math.sin(an) * len;
            br(ex, ey, an - 0.5, len * 0.7, d + 1);
            br(ex, ey, an + 0.5, len * 0.7, d + 1);
          }
        };
        br(x, top, -Math.PI / 2, S + 1, 0);
      } else if (c.kind === 4) {
        // staghorn: antler branches
        for (let k = -2; k <= 2; k++) {
          const len = S + 2 - Math.abs(k);
          for (let j = 0; j < len; j++)
            P(x + k * 2 + Math.round(k * j * 0.3), top - j, j === len - 1 ? shade(col, 0.4) : col);
        }
      } else if (c.kind === 5) {
        // plate coral: stacked shelves
        for (let k = 0; k < 3; k++)
          for (let xx = -S + k; xx <= S - k; xx++) {
            P(x + xx, top - k * 3, shade(col, 0.15));
            P(x + xx, top - k * 3 + 1, shade(col, -0.35));
          }
      } else c.anem = [x, top]; // anemone base, tentacles move in frame
      c.top = top;
    }
    // the habitat: domes on legs, a tube, portholes, a moon pool hatch, floodlight mounts
    const H0 = w.hab,
      MET = [176, 184, 196];
    const dome = (cx, cy, R) => {
      for (let y = -R; y <= 0; y++)
        for (let x = -R; x <= R; x++) {
          const d = x * x + y * y;
          if (d <= R * R)
            P(
              cx + x,
              cy + y,
              d > (R - 1) * (R - 1)
                ? [90, 96, 110]
                : x + y < -R * 0.6
                  ? [230, 236, 244]
                  : x > R * 0.4
                    ? [130, 138, 152]
                    : MET,
            );
        }
      for (let x = -R; x <= R; x++) P(cx + x, cy + 1, [70, 74, 88]);
    };
    dome(H0.x, H0.y - 12, 18);
    dome(H0.x - 32, H0.y - 7, 10);
    for (let x = H0.x - 22; x < H0.x - 17; x++)
      for (let y = H0.y - 14; y < H0.y - 8; y++) P(x, y, y === H0.y - 12 ? [220, 226, 236] : [140, 148, 160]);
    for (const lx of [H0.x - 14, H0.x + 13, H0.x - 38, H0.x - 26])
      for (let y = H0.y - 10; y < H0.y + 2; y++) P(lx, y, [80, 84, 96]);
    w.ports = [
      [H0.x - 9, H0.y - 20],
      [H0.x - 1, H0.y - 23],
      [H0.x + 7, H0.y - 20],
      [H0.x - 34, H0.y - 11],
      [H0.x - 28, H0.y - 11],
    ];
    for (const [px, py] of w.ports)
      for (let y = -1; y <= 1; y++)
        for (let x = -1; x <= 1; x++) P(px + x, py + y, Math.abs(x) + Math.abs(y) === 2 ? [90, 96, 110] : [40, 60, 80]);
    for (let y = 0; y < 12; y++) P(H0.x + 2, H0.y - 30 - y, [120, 126, 140]);
    w.lamps = [
      [H0.x - 16, H0.y - 26],
      [H0.x + 16, H0.y - 18],
    ];
    w.antTop = [H0.x + 2, H0.y - 42];
    // rock overhangs framing the top corners, weed hanging from them
    for (const [x0, x1, left] of [
      [0, W * 0.2, true],
      [W * 0.84, W, false],
    ])
      for (let x = Math.floor(x0); x < x1; x++) {
        const t = left ? 1 - x / x1 : (x - x0) / (x1 - x0),
          bot = Math.round(H * (0.05 + t * t * 0.2) + Math.sin(x * 0.4) * 2);
        for (let y = 0; y < bot; y++)
          P(x, y, y > bot - 2 ? [60, 70, 80] : (x + y) % 6 === 0 ? [40, 46, 56] : [52, 58, 70]);
        if (x % 3 === 0)
          for (let y = 0; y < 4 + ((x * 7) % 9); y++) P(x + Math.round(Math.sin(y * 0.5) * 1), bot + y, [50, 120, 70]);
      }
    w.landNight = night;
    b.put(g);
  }

  function sky(c, w, e, s) {
    const { W, H } = w,
      sy = surfaceY(w),
      night = e.day < 0.4;
    // caustic web on the underside of the surface
    c.fillStyle = night ? "rgba(120,170,220,0.18)" : "rgba(255,255,255,0.5)";
    for (let y = 0; y < sy; y++)
      for (let x = 0; x < W; x++) {
        const v = Math.sin(x * 0.35 + s * 1.3 + Math.sin(y * 0.8 + s) * 2) + Math.sin(x * 0.17 - s * 0.9 + y * 0.5);
        if (v > 1.4) c.fillRect(x, y, 1, 1);
      }
    if (e.wx.rain) {
      c.fillStyle = "rgba(255,255,255,0.6)";
      for (let i = 0; i < 18; i++) {
        const x = Math.round((i * 47 + s * 13 * ((i % 3) + 1)) % W);
        c.fillRect(x, sy - 1 - (i % 2), 2, 1);
      }
    }
    // sun shafts swaying down through the blue
    if (!night)
      for (let i = 0; i < 5; i++) {
        const x0 = W * (0.12 + i * 0.2) + Math.sin(s * 0.3 + i) * 8,
          a = 0.12 * (1 - e.wx.grey * 0.7);
        c.fillStyle = `rgba(220,250,255,${a})`;
        for (let y = sy; y < H * 0.85; y++) {
          const hw = 3 + (y - sy) * 0.05,
            x = x0 + (y - sy) * 0.25;
          for (let k = -hw; k <= hw; k++)
            if (bayer(Math.round(x + k), y) < 0.5 - (y / H) * 0.4) c.fillRect(Math.round(x + k), y, 1, 1);
        }
      }
    // something enormous out in the blue, every few minutes
    const per = 150,
      t = (s % per) / per;
    if (t < 0.45) {
      const wx = Math.round(W + 60 - (t / 0.45) * (W + 160)),
        wy = Math.round(H * 0.3 + Math.sin(s * 0.3) * 3),
        col = night ? "rgba(10,20,30,0.6)" : "rgba(20,60,100,0.45)";
      c.fillStyle = col;
      for (let x = 0; x < 70; x++) {
        const hh = Math.round(Math.sin((x / 70) * Math.PI) ** 0.7 * 9 * (x < 10 ? x / 10 : 1));
        c.fillRect(wx + x, wy - hh * 0.4, 1, hh);
      }
      for (let k = 0; k < 10; k++)
        c.fillRect(wx + 70 + k, wy - 2 + Math.round(Math.sin(s * 1.2) * k * 0.4) - (k > 6 ? k - 6 : 0), 1, 3);
      c.fillRect(wx + 22, wy + 4, 8, 3);
    }
    // the water thickening with distance: a drifting band of haze in the mid-water
    {
      const M = night ? "night" : "day";
      w.mists ||= {};
      w.mists[M] ||= mist(W, 26, night ? [20, 50, 80] : [110, 190, 220], 0.85, 0.45, 31);
      const ox = -Math.round((s * 1.2) % W);
      c.drawImage(w.mists[M], ox, Math.round(H * 0.5));
      c.drawImage(w.mists[M], ox + W, Math.round(H * 0.5));
    }
  }

  const ANGEL = ["..x...", ".xxx..", "xxxxxe", "xxxxxx", ".xxx..", "..x..."];
  const TURTLE = [
    ["....gg......", "...ggggg....", ".hhGgGgGgg..", "hhhGGGGGGgg.", ".hhggggggg..", "..ff....ff..", ".ff......ff."],
    ["....gg......", "...ggggg....", ".hhGgGgGgg..", "hhhGGGGGGgg.", ".hhggggggg..", "...ff..ff...", "....f..f...."],
  ];
  const SEAHORSE = [".hh.", "hhhe", ".hh.", "..hh", ".hhh", ".hh.", "..h.", ".hh.", "h..."];

  function frame(c, w, e, s) {
    const { W, H, sand, hab: H0 } = w,
      night = e.day < 0.4;
    if (!w.glows.lamp) {
      w.glows.lamp = glowSprite(6, [255, 240, 200], 0.8, 0.45);
      w.glows.port = glowSprite(4, [255, 210, 120], 0.8, 0.4);
    }
    // caustics dancing on the sand by day
    if (!night) {
      c.fillStyle = `rgba(255,255,240,${0.28 * (1 - e.wx.grey * 0.6)})`;
      for (let y = sand; y < H; y++)
        for (let x = 0; x < W; x++) {
          const v = Math.sin(x * 0.4 + s * 1.5 + Math.sin(y * 0.7 - s) * 2) + Math.sin(x * 0.21 - s + y * 0.6);
          if (v > 1.45) c.fillRect(x, y, 1, 1);
        }
    }
    // floodlight cones at night, portholes lit, antenna blink
    if (night)
      for (const [lx, ly] of w.lamps) {
        c.fillStyle = "rgba(220,240,255,0.14)";
        const dir = lx < H0.x ? -1 : 1;
        for (let k = 2; k < 60; k++) {
          const hw = k * 0.35;
          for (let j = -hw; j <= hw; j++)
            if (bayer(lx + dir * k, Math.round(ly + k * 0.5 + j)) < 0.6 - k / 120)
              c.fillRect(lx + dir * k, Math.round(ly + k * 0.5 + j), 1, 1);
        }
        c.drawImage(w.glows.lamp, lx - 6, ly - 6);
      }
    for (const [px, py] of w.ports) {
      c.fillStyle = night ? "#ffd27a" : "#9ad8ff";
      c.fillRect(px, py, 1, 1);
      if (night) c.drawImage(w.glows.port, px - 4, py - 4);
    }
    if (Math.sin(s * 2) > 0.6) {
      c.fillStyle = "#ff4040";
      c.fillRect(w.antTop[0], w.antTop[1], 1, 1);
    }
    // the reef glows at night: coral tips pulse with their own colours
    if (night)
      for (const cr of w.corals) {
        const p = 0.5 + 0.5 * Math.sin(s * 1.3 + cr.x);
        c.fillStyle = css(cr.col, 0.3 + p * 0.5);
        c.fillRect(Math.round(cr.x), (cr.top ?? sand) - Math.round(cr.s), 1, 1);
        if (cr.kind === 1) c.fillRect(Math.round(cr.x) - 3, (cr.top ?? sand) - Math.round(cr.s) - 1, 1, 1);
      }
    // anemones: tentacles waving
    for (const cr of w.corals)
      if (cr.anem) {
        const [ax, ay] = cr.anem;
        for (let k = -3; k <= 3; k++) {
          const sw = Math.sin(s * 2 + k + ax) * 1.2;
          c.fillStyle = css(night ? mix(cr.col, [255, 255, 255], 0.2) : cr.col, night ? 0.8 : 1);
          for (let y = 0; y < 4; y++) c.fillRect(Math.round(ax + k + sw * (y / 4)), ay - y, 1, 1);
        }
      }
    // kelp in front of the reef, swaying
    for (const k of w.kelp) {
      for (let y = 0; y < k.h; y++) {
        const x = Math.round(k.x + Math.sin(s * 0.8 + k.ph + y * 0.06) * (y / k.h) * 6);
        c.fillStyle = night ? "#0a2a20" : y % 9 < 2 ? "#6ab040" : "#3a8a3a";
        c.fillRect(x, H - y, 2, 1);
        if (y % 6 < 3) {
          c.fillStyle = night ? "#0c3226" : y % 6 === 1 ? "#7ac050" : "#4aa040";
          const side = ((y / 6) | 0) % 2 ? 2 : -3;
          c.fillRect(x + side, H - y, 3, 1);
        }
      }
    }
    // the school: two dozen fish that drift as one and turn together
    const per = 50,
      t = (s % per) / per,
      dir = t < 0.5 ? 1 : -1,
      sx = W * (0.2 + (t < 0.5 ? t * 1.2 : (1 - t) * 1.2)),
      sy = H * 0.38 + Math.sin(s * 0.4) * 8;
    for (const [fx, fy, p] of w.school) {
      const x = Math.round(sx + fx * 22 + Math.sin(s * 2 + p * 9) * 1.5),
        y = Math.round(sy + fy * 10 + Math.cos(s * 1.7 + p * 7) * 1);
      c.fillStyle = night ? "#2a4a5a" : p > 0.5 ? "#e8f0f8" : "#a8c0d4";
      c.fillRect(x, y, 3, 1);
      c.fillRect(dir > 0 ? x - 1 : x + 3, y - (Math.floor(s * 6 + p * 9) % 2), 1, 1);
      if (!night) {
        c.fillStyle = "#fff";
        c.fillRect(dir > 0 ? x + 2 : x, y, 1, 1);
      }
    }
    // angelfish
    for (const a of w.angels) {
      const x = Math.round(((((a.x * (W + 20) + s * a.sp * a.dir) % (W + 20)) + W + 20) % (W + 20)) - 10),
        y = Math.round(a.y * H + Math.sin(s + a.x * 9) * 2);
      sprite(c, ANGEL, x, y, { x: css(night ? mix(a.col, [0, 0, 0], 0.6) : a.col), e: "#111" }, a.dir < 0);
    }
    // a manta gliding high, slow wingbeats
    {
      const per2 = 80,
        t2 = (s % per2) / per2,
        mx = Math.round(-30 + t2 * (W + 60)),
        my = Math.round(H * 0.2 + Math.sin(s * 0.5) * 4),
        fl = Math.sin(s * 1.5) * 3;
      c.fillStyle = night ? "#0a1622" : "#1a2a3c";
      for (let k = -12; k <= 12; k++) {
        const yy = my + Math.round(Math.abs(k) * 0.2 - (Math.abs(k) > 6 ? (fl * (Math.abs(k) - 6)) / 6 : 0));
        c.fillRect(mx + Math.round(Math.abs(k) * 0.4), yy, 1, Math.max(1, 3 - Math.floor(Math.abs(k) / 5)));
        if (k === 0) c.fillRect(mx - 1, yy, 2, 2);
      }
      c.fillRect(mx - 8, my + 1, 8, 1);
    }
    // a turtle paddling along
    {
      const per3 = 64,
        t3 = ((s + 20) % per3) / per3,
        tx = Math.round(W + 14 - t3 * (W + 30)),
        ty = Math.round(H * 0.55 + Math.sin(s * 0.6) * 3);
      sprite(
        c,
        TURTLE[Math.floor(s * 2) % 2],
        tx,
        ty,
        {
          g: night ? "#1a2a1a" : "#5a7a3a",
          G: night ? "#24361e" : "#8aa050",
          h: night ? "#2a3a2a" : "#9ab070",
          f: night ? "#1a2a1a" : "#6a8a4a",
        },
        false,
      );
    }
    // jellyfish pulsing upward slowly, glowing at night
    for (const j of w.jellies) {
      const pulse = (Math.sin(s * 2 + j.ph) + 1) / 2,
        x = Math.round(j.x * W + Math.sin(s * 0.3 + j.ph) * 6),
        y = Math.round(((((j.y * H - s * 1.5) % (H * 0.7)) + H * 0.7) % (H * 0.7)) + H * 0.1);
      const bw = 3 + Math.round(pulse);
      c.fillStyle = css(j.col, night ? 0.9 : 0.6);
      for (let k = -bw; k <= bw; k++)
        c.fillRect(x + k, y + Math.round(Math.abs(k) * 0.5), 1, 2 - (Math.abs(k) === bw ? 1 : 0));
      c.fillRect(x - bw + 1, y - 1, bw * 2 - 1, 1);
      c.fillStyle = css(j.col, night ? 0.6 : 0.35);
      for (let k = -2; k <= 2; k += 2)
        for (let yy = 2; yy < 8; yy++)
          c.fillRect(x + k + Math.round(Math.sin(s * 3 + yy * 0.7 + k) * 0.8), y + yy, 1, 1);
    }
    // a seahorse by the reef, bobbing
    sprite(c, SEAHORSE, Math.round(W * 0.48), Math.round(H * 0.66 + Math.sin(s * 1.3) * 2), {
      h: night ? "#4a3a1a" : "#f0b040",
      e: "#111",
    });
    // the sub: leaves the moon pool, tours, comes home
    {
      const per4 = 90,
        t4 = (s % per4) / per4;
      if (t4 > 0.1 && t4 < 0.9) {
        const u = (t4 - 0.1) / 0.8,
          px = Math.round(H0.x - Math.sin(u * Math.PI) * W * 0.55),
          py = Math.round(H0.y - 8 - Math.sin(u * Math.PI) * H * 0.3),
          fwd = u < 0.5 ? -1 : 1;
        c.fillStyle = "#f0c020";
        c.fillRect(px - 5, py, 10, 4);
        c.fillRect(px - 2, py - 2, 4, 2);
        c.fillStyle = "#c09010";
        c.fillRect(px - 5, py + 3, 10, 1);
        c.fillStyle = "#8ae0ff";
        c.fillRect(px + (fwd > 0 ? 3 : -5), py + 1, 2, 2);
        c.fillStyle = "#555";
        c.fillRect(px + (fwd > 0 ? -6 : 5), py + 1, 1, 2);
        if (night) {
          c.fillStyle = "rgba(255,250,210,0.18)";
          for (let k = 1; k < 24; k++)
            for (let j = -k * 0.3; j <= k * 0.3; j++)
              if (bayer(px + fwd * (5 + k), py + 2 + j) < 0.5)
                c.fillRect(px + fwd * (5 + k), Math.round(py + 2 + j), 1, 1);
        }
      }
    }
    // bubbles from the habitat and the reef, plankton drifting
    for (const [bx, by, p] of w.bubbles) {
      const y = Math.round(H - ((by * H + s * (8 + p * 8)) % H)),
        x = Math.round((p < 0.5 ? H0.x + 2 : bx * W) + Math.sin(s * 3 + p * 9) * 1.5);
      c.fillStyle = night ? "rgba(150,190,220,0.5)" : "rgba(230,250,255,0.8)";
      c.fillRect(x, y, 1, 1);
      if (p > 0.8) {
        c.fillRect(x + 1, y - 1, 1, 1);
      }
    }
    for (const [px, py, p] of w.plankton) {
      c.fillStyle = night ? (p > 0.7 ? "rgba(120,255,220,0.8)" : "rgba(80,160,200,0.4)") : "rgba(230,250,255,0.35)";
      c.fillRect(
        Math.round(px * W + Math.sin(s * 0.3 + p * 20) * 4),
        Math.round(py * H + Math.cos(s * 0.2 + p * 10) * 3),
        1,
        1,
      );
    }
    if (e.wx.thunder && s % 10 < 0.12) {
      c.fillStyle = "rgba(220,240,255,0.35)";
      c.fillRect(0, 0, W, H * 0.5);
    }
    w.vig ||= vignette(W, H, [2, 14, 30], 0.6);
    c.drawImage(w.vig, 0, 0);
  }

  RS_SCENE.register("deep", { fps: 12, build, background, sky, land, frame });
})();
