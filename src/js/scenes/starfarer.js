"use strict";

// Starfarer: alien landing site with a ringed gas giant.
(() => {
  const { Buf, ramp, bayer, H_, mix, css, skyRamp, toner, ridge, glowSprite, shade, sprite, mist, shootingStar } =
    RS_PX;
  const { auroraStrip, aurora } = RS_PX;
  const { rng } = RS_SCENE;
  const SKY = {
    night: H_(["#0a0828", "#140e3a", "#1e164c", "#2a1e5e", "#3a2870"]),
    day: H_(["#18a0b8", "#2ab8c4", "#52ccc8", "#8adcc4", "#c4ecc0"]),
    warm: H_(["#3a1a6a", "#7a2a8a", "#c8448e", "#ff7a9a", "#ffb8a0"]),
    grey: H_(["#4a6a7a", "#5a7a86", "#6a8a92", "#7a989e", "#8aa6aa"]),
  };
  const CAPS = [
    [255, 90, 160],
    [255, 170, 60],
    [120, 220, 255],
    [190, 120, 255],
  ];

  function build(W, H) {
    const r = rng(1701),
      hy = Math.round(H * 0.64);
    const hills = [
      ridge(r, W, [
        [90, 1],
        [30, 0.3],
      ]),
      ridge(r, W, [
        [70, 1],
        [22, 0.3],
      ]),
      ridge(r, W, [
        [55, 1],
        [18, 0.3],
      ]),
    ];
    const islands = [
      { x: W * 0.62, y: H * 0.26, w: 30 },
      { x: W * 0.86, y: H * 0.4, w: 18 },
      { x: W * 0.44, y: H * 0.42, w: 12 },
    ];
    const S = Math.min(H, W * 0.6),
      shrooms = [
        { x: W * 0.08, h: S * 0.5, R: 22, col: 0 },
        { x: W * 0.22, h: S * 0.3, R: 13, col: 1 },
        { x: W * 0.93, h: S * 0.42, R: 18, col: 3 },
        { x: W * 0.36, h: S * 0.18, R: 8, col: 2 },
      ];
    const crystals = [
      { x: W * 0.3, n: 5, col: [120, 230, 255] },
      { x: W * 0.76, n: 4, col: [255, 120, 220] },
      { x: W * 0.52, n: 3, col: [160, 255, 180] },
    ];
    const ship = { x: Math.round(W * 0.6), y: Math.round(H * 0.84) };
    const grazers = [
      { x: W * 0.15, dir: 1, ph: 0 },
      { x: W * 0.2, dir: 1, ph: 2.5 },
      { x: W * 0.83, dir: -1, ph: 1.2 },
    ];
    const spores = Array.from({ length: Math.round((W * H) / 400) }, () => [r(), r(), r()]);
    const stars = Array.from({ length: Math.round((W * H) / 70) }, () => [r(), r() * 0.7, r()]);
    const drops = Array.from({ length: Math.round((W * H) / 240) }, () => [r(), r(), 0.7 + r() * 0.6]);
    const grass = Array.from({ length: Math.round(W / 2.5) }, () => [r() * W, r()]);
    return { W, H, hy, hills, islands, shrooms, crystals, ship, grazers, spores, stars, drops, grass, glows: {} };
  }

  function background(g, w, e) {
    const { W, H, hy } = w,
      b = new Buf(g, W, H),
      sky = skyRamp(e, SKY);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b.px(x, y, ramp(sky, y / hy, x, y, 0.3));
    if (e.day < 0.55)
      for (const [px, py, p] of w.stars)
        b.px(px * W, py * H, p > 0.9 ? [255, 240, 255] : [200, 180, 255], (1 - e.day * 1.8) * (0.3 + p * 0.7));
    // the ringed giant: bands in pinks and creams, shadowed lower right, rings crossing in front and behind
    const gx = Math.round(W * 0.24),
      gy = Math.round(H * 0.24),
      R = 30;
    const ring = (front) => {
      for (let a = 0; a < 600; a++) {
        const an = (a / 600) * Math.PI * 2,
          isFront = Math.sin(an) > 0;
        if (isFront !== front) continue;
        for (let k = 0; k < 7; k++) {
          const rr = R * 1.45 + k * 2.2,
            x = gx + Math.cos(an) * rr,
            y = gy + Math.sin(an) * rr * 0.22 - Math.cos(an) * rr * 0.12;
          b.px(x, y, k === 3 ? [120, 90, 110] : k % 2 ? [236, 200, 210] : [210, 170, 190], e.day > 0.6 ? 0.75 : 0.9);
        }
      }
    };
    ring(false);
    for (let y = -R; y <= R; y++)
      for (let x = -R; x <= R; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d > R) continue;
        const band = Math.floor((y + R + Math.sin(x * 0.15) * 2) / 5);
        let c = [
          [250, 200, 210],
          [230, 150, 180],
          [255, 220, 200],
          [200, 120, 170],
          [250, 190, 170],
          [220, 160, 200],
        ][((band % 6) + 6) % 6];
        const lit = (-x * 0.6 - y * 0.6) / R;
        c = lit < -0.3 ? shade(c, -0.55) : lit < 0 ? shade(c, -0.2) : lit > 0.5 ? shade(c, 0.15) : c;
        if (d > R - 1) c = shade(c, -0.3);
        b.px(gx + x, gy + y, c, e.day > 0.6 ? 0.85 : 1);
      }
    ring(true);
    for (const [mx, my, mr, col] of [
      [0.74, 0.1, 5, [200, 230, 255]],
      [0.82, 0.18, 3, [255, 210, 160]],
    ])
      for (let y = -mr; y <= mr; y++)
        for (let x = -mr; x <= mr; x++)
          if (x * x + y * y <= mr * mr) b.px(W * mx + x, H * my + y, x + y > mr * 0.4 ? shade(col, -0.45) : col);
    // far hill bands, hazy
    for (let x = 0; x < W; x++) {
      const top = Math.round(hy - 14 - w.hills[0][x] * 20);
      for (let y = top; y < hy + 10; y++) b.px(x, y, mix(toner(e)([150, 110, 190]), sky[4], 0.45));
    }
    b.put(g);
  }

  function land(g, w, e) {
    const { W, H, hy } = w,
      b = new Buf(g, W, H),
      tone = toner(e, 0.85);
    const P = (x, y, c) => b.px(x, y, tone(c));
    // floating islands: grassy tops, dangling rock, a waterfall trailing off
    w.falls = [];
    for (const I of w.islands) {
      for (let x = -I.w; x <= I.w; x++) {
        const t = Math.abs(x) / I.w,
          depth = Math.round((1 - t * t) * I.w * 0.9 + Math.sin(x * 0.9) * 2);
        for (let y = 0; y < depth; y++)
          P(
            I.x + x,
            I.y + y,
            y < 2
              ? y === 0
                ? [130, 240, 160]
                : [80, 200, 140]
              : y < 5
                ? [170, 110, 160]
                : x < -I.w * 0.3
                  ? bayer(x, y) < 0.15
                    ? [120, 80, 130]
                    : [150, 100, 150]
                  : Math.sin(x * 1.3 + y * 0.4) * Math.sin(y * 0.9) > 0.55
                    ? [80, 50, 90]
                    : x > I.w * 0.4
                      ? [96, 62, 106]
                      : [116, 76, 124],
          );
      }
      w.falls.push([Math.round(I.x + I.w * 0.5), Math.round(I.y + 1), Math.round(I.w * 0.5 + 6)]);
    }
    // three bands of rolling hills in alien colours
    const bands = [
      [
        [230, 120, 160],
        [200, 90, 150],
      ],
      [
        [120, 200, 170],
        [80, 170, 150],
      ],
      [
        [250, 180, 110],
        [220, 140, 90],
      ],
    ];
    for (let i = 0; i < 3; i++)
      for (let x = 0; x < W; x++) {
        const top = Math.round(hy - 4 + i * 9 - w.hills[i][x] * (16 - i * 3));
        const slope = w.hills[i][Math.min(W - 1, x + 5)] - w.hills[i][Math.max(0, x - 5)];
        for (let y = top; y < H; y++) {
          const [a, c2] = bands[i];
          let col = y - top < 1 ? shade(a, 0.3) : slope > 0.02 ? a : slope < -0.02 ? c2 : mix(a, c2, 0.5);
          if ((y - top) % 7 === 3 && bayer(x, y) < 0.4) col = shade(col, -0.15);
          P(x, y, col);
        }
      }
    // ground strip in front
    const gy = Math.round(H * 0.86);
    for (let y = gy; y < H; y++)
      for (let x = 0; x < W; x++)
        P(x, y, y === gy ? [150, 250, 180] : (x * 3 + y * 5) % 13 === 0 ? [60, 130, 110] : [80, 160, 130]);
    // crystal clusters: faceted shards, light face and dark face
    for (const C of w.crystals) {
      const r = rng(Math.floor(C.x));
      for (let k = 0; k < C.n; k++) {
        const cx = C.x + (k - C.n / 2) * 3,
          h = 6 + Math.floor(r() * 10),
          lean = (r() - 0.5) * 0.6;
        for (let y = 0; y < h; y++) {
          const hw = Math.max(0, Math.round(2 - (y > h - 3 ? y - (h - 3) : 0)));
          for (let j = -hw; j <= hw; j++)
            P(
              cx + j + y * lean,
              gy - y,
              j < 0 ? mix(C.col, [255, 255, 255], 0.5) : j === 0 ? C.col : shade(C.col, -0.4),
            );
        }
      }
      C.top = gy - 10;
    }
    // giant mushrooms: pale stalk with rings, a domed cap with spots and gills underneath
    for (const M of w.shrooms) {
      const col = CAPS[M.col],
        base = gy + 2,
        top = Math.round(base - M.h);
      for (let y = top; y < base; y++) {
        const hw = Math.round(2 + M.R * 0.12 + (base - y < 6 ? (6 - (base - y)) * 0.5 : 0));
        for (let k = -hw; k <= hw; k++)
          P(
            M.x + k + Math.sin((y - top) * 0.05) * 2,
            y,
            k < -hw * 0.3 ? [250, 240, 230] : k > hw * 0.4 ? [190, 170, 180] : [230, 220, 216],
          );
        if ((y - top) % 9 === 4) P(M.x - hw, y, [200, 180, 190]);
      }
      for (let y = -M.R * 0.6; y <= 0; y++)
        for (let x = -M.R; x <= M.R; x++) {
          if ((x / M.R) ** 2 + (y / (M.R * 0.6)) ** 2 > 1) continue;
          const spot = Math.sin(x * 0.7) * Math.sin(y * 1.1 + x * 0.3) > 0.6,
            lit = (-x - y * 1.5) / M.R;
          P(
            M.x + x,
            top + y,
            spot ? [255, 240, 230] : lit > 0.4 ? shade(col, 0.25) : lit < -0.4 ? shade(col, -0.35) : col,
          );
        }
      for (let x = -M.R + 2; x <= M.R - 2; x++) {
        P(M.x + x, top + 1, shade(col, -0.5));
        if (x % 2) P(M.x + x, top + 2, shade(col, -0.6));
      }
      M.capY = top - Math.round(M.R * 0.3);
    }
    // the landed ship: a sleek hull on landing legs, cockpit glass, engine nacelles
    const S = w.ship,
      HULL = [226, 230, 236],
      HULL2 = [150, 156, 170],
      ACC = [240, 120, 60];
    for (let x = -22; x <= 22; x++) {
      const t = Math.abs(x) / 22,
        top = Math.round(S.y - 12 + t * t * 6 + (x > 10 ? (x - 10) * 0.3 : 0)),
        bot = Math.round(S.y - 4 - t * 2);
      for (let y = top; y <= bot; y++)
        P(S.x + x, y, y === top ? [250, 250, 252] : y > bot - 1 ? HULL2 : x > 14 ? ACC : HULL);
    }
    for (let x = -14; x < -4; x++)
      for (let y = 0; y < 3; y++)
        P(S.x + x, S.y - 13 + y + (x < -10 ? 1 : 0), y === 0 ? [180, 240, 255] : [60, 140, 200]);
    for (const nx of [-18, 12])
      for (let y = 0; y < 4; y++)
        for (let k = 0; k < 8; k++) P(S.x + nx + k, S.y - 5 + y, y === 0 ? HULL : k === 0 ? [40, 40, 50] : HULL2);
    for (const lx of [-14, 0, 14]) {
      for (let y = 0; y < 5; y++)
        P(S.x + lx + Math.round(y * (lx ? Math.sign(lx) * 0.4 : 0)), S.y - 3 + y, [100, 104, 116]);
      P(S.x + lx + (lx ? Math.sign(lx) * 2 : 0) - 1, S.y + 2, [80, 84, 96]);
      P(S.x + lx + (lx ? Math.sign(lx) * 2 : 0) + 1, S.y + 2, [80, 84, 96]);
    }
    w.shipLights = [
      [S.x - 22, S.y - 8],
      [S.x + 22, S.y - 6],
      [S.x, S.y - 13],
    ];
    b.put(g);
  }

  function sky(c, w, e, s) {
    const { W, H, hy } = w;
    // aurora in pastel curtains, and shooting stars, at night
    if (e.day < 0.4) {
      w.aurora ||= auroraStrip(W, Math.round(H * 0.22), [
        [140, 255, 200],
        [255, 150, 230],
        [150, 200, 255],
      ]);
      aurora(c, w.aurora, Math.round(H * 0.06), s, (0.4 - e.day) * 2);
      shootingStar(c, W, H, s, 19, [255, 220, 250]);
    }
    // pastel mist lying between the far hills
    const M = e.day < 0.4 ? "night" : "day";
    w.mists ||= {};
    w.mists[M] ||= mist(W, 16, M === "night" ? [120, 90, 170] : [255, 220, 236], 0.8, 0.5, 7);
    {
      const ox = -Math.round((s * 1.5) % W);
      c.drawImage(w.mists[M], ox, hy - 16);
      c.drawImage(w.mists[M], ox + W, hy - 16);
    }
    // the orbital station glinting as it turns
    const sx = Math.round(W * 0.58 + Math.sin(s * 0.02) * 10),
      sy = 12;
    c.fillStyle = e.day > 0.6 ? "#e8ecf4" : "#b8c0d8";
    c.fillRect(sx - 3, sy, 7, 1);
    c.fillRect(sx, sy - 2, 1, 5);
    if (Math.sin(s * 0.7) > 0.95) {
      c.fillStyle = "#ffffff";
      c.fillRect(sx - 1, sy - 1, 3, 3);
    }
    // slow pastel clouds
    for (let i = 0; i < 2 + Math.round(e.wx.clouds * 5); i++) {
      const x0 = ((i * 107 + s * (1 + i * 0.3)) % (W + 80)) - 60,
        y0 = 30 + i * 9,
        cw = 24 + (i % 3) * 8;
      for (let x = 0; x < cw; x++) {
        const hh = Math.round(Math.sin((x / cw) * Math.PI) * 3 + Math.sin(x * 0.8) * 0.6);
        for (let y = -hh; y <= 0; y++) {
          c.fillStyle = e.night ? "rgba(90,70,140,0.8)" : y === 0 ? "rgba(240,180,220,0.9)" : "rgba(255,240,250,0.9)";
          c.fillRect(Math.round(x0 + x), y0 + y, 1, 1);
        }
      }
    }
  }

  const EXPLORER = [
    ["..www..", ".wbbbw.", ".wbcbw.", "..www..", ".oowoo.", "oowwwoo", "o.www.o", "..w.w..", "..w.w..", ".kk.kk."],
    ["..www..", ".wbbbw.", ".wbcbw.", "..www..", ".oowoo.", "oowwwoo", "o.www.o", "..w.w..", "..w..w.", ".kk..kk"],
  ];

  function frame(c, w, e, s) {
    const { W, H, hy } = w,
      night = e.day < 0.45,
      gy = Math.round(H * 0.86);
    if (!w.glows.cap) {
      w.glows.cap = CAPS.map((col) => glowSprite(16, col, 0.6, 0.3));
      w.glows.cry = w.crystals.map((C) => glowSprite(9, C.col, 0.7, 0.35));
      w.glows.warp = glowSprite(9, [255, 255, 255], 0.9, 0.6);
      w.glows.small = glowSprite(3, [255, 220, 120], 0.8, 0.5);
    }
    // waterfalls off the floating islands, dissolving into spray
    for (const [fx, fy, len] of w.falls)
      for (let y = 0; y < len * 2.4; y++) {
        const fade = y / (len * 2.4);
        if (bayer(fx, fy + y) < fade * 0.9) continue;
        const v = (y * 0.5 - s * 14) % 5;
        c.fillStyle = v < 1 ? "#ffffff" : night ? "#7a8ac8" : "#9ae8ff";
        c.fillRect(fx + Math.round(Math.sin(y * 0.2) * fade * 2), fy + y, 2, 1);
      }
    // mushroom caps and crystals glow at night (crystals pulse by day too)
    if (night)
      for (const M of w.shrooms)
        c.drawImage(w.glows.cap[M.col], Math.round(M.x) - 16, M.capY - 16 + Math.round(M.R * 0.3));
    for (const [i, C] of w.crystals.entries()) {
      const p = 0.5 + 0.5 * Math.sin(s * 1.4 + i * 2);
      if (night || p > 0.7) {
        c.globalAlpha = night ? 0.6 + p * 0.4 : (p - 0.7) * 2;
        c.drawImage(w.glows.cry[i], Math.round(C.x) - 9, C.top - 6);
        c.globalAlpha = 1;
      }
    }
    // ship lights blink, and a little ramp light
    for (const [i, [lx, ly]] of w.shipLights.entries())
      if (Math.floor(s * 2 + i) % 3 === 0) {
        c.fillStyle = i === 2 ? "#40ff90" : i ? "#40ff60" : "#ff4040";
        c.fillRect(lx, ly, 1, 1);
        if (night) c.drawImage(w.glows.small, lx - 3, ly - 3);
      }
    // the explorer pacing beside the ship, helmet visor catching the light
    {
      const ex = Math.round(w.ship.x - 34 + Math.sin(s * 0.25) * 10),
        dir = Math.cos(s * 0.25) > 0;
      sprite(
        c,
        EXPLORER[Math.abs(Math.cos(s * 0.25)) > 0.2 ? Math.floor(s * 4) % 2 : 0],
        ex,
        gy - 10,
        { w: "#f0f0f4", b: "#40c8ff", c: "#c8f4ff", o: "#ff8a30", k: "#4a4a5a" },
        !dir,
      );
    }
    // long-necked grazers: bodies sway, necks dip to graze and rise again
    for (const G of w.grazers) {
      const x = Math.round(G.x + Math.sin(s * 0.06 + G.ph) * 8),
        graze = (Math.sin(s * 0.5 + G.ph) + 1) / 2,
        body = night ? "#4a3a6a" : "#c88a5a",
        belly = night ? "#6a5a8a" : "#f0c090";
      c.fillStyle = body;
      c.fillRect(x - 6, gy - 9, 12, 5);
      c.fillStyle = belly;
      c.fillRect(x - 5, gy - 5, 10, 1);
      c.fillStyle = body;
      for (const lx of [-5, -2, 2, 5])
        c.fillRect(x + lx, gy - 4, 1, 4 - (Math.floor(s * 2 + lx) % 2 && graze < 0.3 ? 1 : 0));
      for (let k = 0; k < 12; k++) {
        const t = k / 12,
          nx = x + G.dir * (5 + t * 6),
          ny = gy - 9 - (1 - graze) * t * 14 + graze * t * 6;
        c.fillRect(Math.round(nx), Math.round(ny), 2, 1);
      }
      const hx = Math.round(x + G.dir * 12),
        hyy = Math.round(gy - 9 - (1 - graze) * 14 + graze * 6);
      c.fillRect(hx - (G.dir < 0 ? 2 : 0), hyy - 1, 3, 2);
      c.fillStyle = "#1a1a1a";
      c.fillRect(hx + (G.dir > 0 ? 1 : -1), hyy - 1, 1, 1);
      c.fillStyle = belly;
      c.fillRect(x - 6 - G.dir * 2, gy - 8, 2, 1);
    }
    // ships warping in: a flash, a streak, then flying off over the hills
    for (let i = 0; i < 2; i++) {
      const per = 22 + i * 9,
        t = ((s + i * 11) % per) / per,
        wx = W * (0.35 + i * 0.3),
        wy = H * (0.18 + i * 0.12);
      if (t < 0.05) {
        c.drawImage(w.glows.warp, Math.round(wx) - 9, Math.round(wy) - 9);
        c.fillStyle = "#ffffff";
        for (let k = 0; k < 30; k++) c.fillRect(Math.round(wx - 30 + k), Math.round(wy), 1, 1);
      } else if (t < 0.5) {
        const k = (t - 0.05) / 0.45,
          x = Math.round(wx + k * W * 0.6 * (i ? -1 : 1)),
          y = Math.round(wy + k * k * (hy - wy) * 0.6);
        c.fillStyle = "#e8ecf4";
        c.fillRect(x - 3, y, 7, 2);
        c.fillStyle = "#ff8a30";
        c.fillRect(i ? x + 4 : x - 4, y, 1, 1);
        c.fillStyle = "rgba(255,180,120,0.5)";
        c.fillRect(i ? x + 5 : x - 7, y, 3, 1);
      }
    }
    // curling grass along the front, swaying
    for (const [gx, gp] of w.grass) {
      const h = 2 + Math.round(gp * 5),
        sw = Math.sin(s * 1.5 + gx * 0.2) * 1.2;
      c.fillStyle = css(toner(e, 0.85)(gp > 0.6 ? [150, 255, 190] : gp > 0.3 ? [100, 220, 170] : [255, 160, 220]));
      for (let k = 0; k < h; k++)
        c.fillRect(Math.round(gx + sw * (k / h) + (k === h - 1 ? (gp > 0.5 ? 1 : -1) : 0)), gy + 1 - k, 1, 1);
    }
    // spores by day, fireflies by night
    for (const [px, py, p] of w.spores) {
      const x = Math.round((px * W + Math.sin(s * 0.4 + p * 30) * 8 + s * 2) % W),
        y = Math.round(py * H * 0.8 + H * 0.15 + Math.cos(s * 0.5 + p * 20) * 5);
      if (night) {
        if (Math.sin(s * 2 + p * 40) > 0.2) {
          c.fillStyle = p > 0.5 ? "#d0ff70" : "#70ffd0";
          c.fillRect(x, y, 1, 1);
        }
      } else {
        c.fillStyle = "rgba(255,255,240,0.6)";
        c.fillRect(x, y, 1, 1);
      }
    }
    // a low haze drifting over the meadow
    {
      const m = w.mists[e.day < 0.4 ? "night" : "day"];
      if (m) {
        const ox = -Math.round((s * 2.5) % W);
        c.globalAlpha = e.wx.fog ? 0.9 : 0.4;
        c.drawImage(m, ox, hy + 2);
        c.drawImage(m, ox + W, hy + 2);
        c.globalAlpha = 1;
      }
    }
    // weather
    if (e.wx.rain) {
      c.fillStyle = "rgba(200,220,255,0.55)";
      const n = Math.round(w.drops.length * Math.min(1, e.wx.rain + 0.2));
      for (let i = 0; i < n; i++) {
        const [px, py, sp] = w.drops[i];
        c.fillRect(Math.round(px * W), Math.round((py * H + s * 120 * sp) % H), 1, 3);
      }
    }
    if (e.wx.snow) {
      c.fillStyle = "#ffffff";
      for (const [px, py, sp] of w.drops)
        c.fillRect(Math.round(px * W + Math.sin(s + py * 20) * 3), Math.round((py * H + s * 14 * sp) % H), 1, 1);
    }
    if (e.wx.fog) {
      c.fillStyle = "rgba(230,210,240,0.4)";
      for (let y = Math.round(hy * 0.7); y < H; y++)
        for (let x = y & 1; x < W; x += 2) if (bayer(x, y) < 0.55) c.fillRect(x, y, 1, 1);
    }
    if (e.wx.thunder && s % 10 < 0.12) {
      c.fillStyle = "rgba(255,240,255,0.45)";
      c.fillRect(0, 0, W, H);
    }
  }

  RS_SCENE.register("starfarer", { fps: 12, build, background, sky, land, frame });
})();
