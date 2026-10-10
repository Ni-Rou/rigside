"use strict";

// Golden Tree: giant glowing tree over ruined plains.
(() => {
  const { Buf, ramp, bayer, H_, mix, css, skyRamp, toner, ridge, glowSprite, sprite, hash, mist, softGlow, motes } =
    RS_PX;
  const { rng } = RS_SCENE;
  const SKY = {
    night: H_(["#060814", "#0c1024", "#141a34", "#1e2440", "#2a2c48"]),
    day: H_(["#7a86a6", "#a0a0a8", "#c4b498", "#dcc48e", "#ecd498"]),
    warm: H_(["#3a2a5a", "#6a3a6a", "#b0606a", "#e89a6a", "#ffd08a"]),
    grey: H_(["#6a6a72", "#7a787c", "#8a8682", "#9a948a", "#aaa292"]),
  };
  const GOLD = [
    [255, 250, 210],
    [255, 230, 140],
    [240, 196, 80],
    [210, 150, 50],
    [150, 96, 36],
  ];

  function build(W, H) {
    const r = rng(1066),
      hy = Math.round(H * 0.6);
    const T = {
      x: Math.round(W * 0.62),
      base: hy + 2,
      top: Math.round(H * 0.08),
      crownW: Math.round(Math.min(W * 0.32, 92)),
      crownH: Math.round(H * 0.22),
    };
    const clusters = [];
    for (let i = 0; i < 420; i++) {
      const a = r() * Math.PI * 2,
        rr = Math.sqrt(r());
      const cx = Math.cos(a) * rr * T.crownW,
        cy = Math.sin(a) * rr * T.crownH * 0.55 - (1 - rr) * T.crownH * 0.35;
      clusters.push({ x: cx, y: cy, R: 2 + r() * 3.5, v: r() });
    }
    clusters.sort((a, b) => a.y - b.y);
    const strands = Array.from({ length: 9 }, (_, i) => ({ ph: r() * 6, amp: 1 + r() * 2, off: (i - 4) * 1.5 }));
    const ranges = [
      ridge(r, W, [
        [70, 1],
        [24, 0.4],
      ]),
      ridge(r, W, [
        [50, 1],
        [16, 0.4],
      ]),
    ];
    const leaves = Array.from({ length: Math.round((W * H) / 260) }, () => [r(), r(), r()]);
    const motes = Array.from({ length: 30 }, () => [r(), r(), r()]);
    const drops = Array.from({ length: Math.round((W * H) / 240) }, () => [r(), r(), 0.7 + r() * 0.6]);
    const grass = Array.from({ length: Math.round(W * 1.1) }, () => [r() * W, r(), r()]);
    return { W, H, hy, T, clusters, strands, ranges, leaves, motes, drops, grass, glows: {} };
  }

  function background(g, w, e) {
    const { W, H, hy, T } = w,
      b = new Buf(g, W, H),
      sky = skyRamp(e, SKY),
      tone = toner(e);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b.px(x, y, ramp(sky, y / hy, x, y, 0.3));
    if (e.day < 0.5) {
      const r = rng(4);
      for (let i = 0; i < (W * H) / 90; i++) b.px(r() * W, r() * H * 0.5, [220, 220, 255], (1 - e.day * 2) * r());
    }
    // the halo where the tree's light bleeds into the sky
    const cy = T.top + T.crownH * 0.4;
    for (let y = 0; y < hy; y++)
      for (let x = 0; x < W; x++) {
        const d = Math.sqrt(((x - T.x) / (T.crownW * 1.8)) ** 2 + ((y - cy) / (T.crownH * 1.9)) ** 2);
        if (d < 1) {
          const k = (1 - d) * (e.night ? 0.8 : 0.55),
            lvl = Math.floor(k * 4 + bayer(x, y) * 0.9) / 4;
          if (lvl > 0) b.px(x, y, [255, 214, 130], lvl * 0.55);
        }
      }
    // two misty ranges
    for (const [i, rr] of w.ranges.entries())
      for (let x = 0; x < W; x++) {
        const top = Math.round(hy - 4 + i * 6 - rr[x] * (24 - i * 10));
        for (let y = top; y < hy + 12; y++)
          b.px(x, y, mix(tone(i ? [110, 90, 120] : [130, 110, 140]), sky[4], i ? 0.35 : 0.55));
      }
    b.put(g);
  }

  function land(g, w, e) {
    const { W, H, hy, T } = w,
      b = new Buf(g, W, H),
      tone = toner(e, 0.8),
      sky = skyRamp(e, SKY);
    const P = (x, y, c) => b.px(x, y, tone(c)),
      haze = (c, k) => mix(tone(c), sky[4], k);
    // plains: golden grassland in bands, mist lying in the folds
    for (let y = hy + 2; y < H; y++)
      for (let x = 0; x < W; x++) {
        const d = (y - hy) / (H - hy),
          band = Math.sin(y * 0.6 + Math.sin(x * 0.03) * 3);
        let c = ramp(
          [
            [150, 120, 70],
            [180, 150, 80],
            [206, 176, 96],
          ],
          0.4 + band * 0.25 + (bayer(x, y) - 0.5) * 0.2,
          x,
          y,
          0.5,
        );
        c = mix(c, [120, 100, 90], (1 - d) * 0.35);
        P(x, y, c);
      }
    // the tree: roots spilling over the land, then the braided trunk
    for (let i = 0; i < 9; i++) {
      const dir = i < 4 ? -1 : 1,
        len = 18 + (i % 4) * 9;
      for (let k = 0; k < len; k++) {
        const x = T.x + dir * (4 + k * (0.9 + (i % 3) * 0.3)),
          y = T.base + Math.round(Math.sin(k * 0.2 + i) * 1.2 + k * 0.08);
        P(x, y, k < len * 0.5 ? [120, 90, 60] : [96, 72, 50]);
        P(x, y - 1, [150, 116, 76]);
      }
    }
    for (let y = T.base; y > T.top + T.crownH * 0.4; y--) {
      const t = (T.base - y) / (T.base - T.top),
        spread = 1 + Math.max(0, 0.25 - t) * 6 + Math.max(0, t - 0.75) * 5;
      for (const st of w.strands) {
        const x = Math.round(T.x + st.off * spread + Math.sin(y * 0.12 + st.ph) * st.amp);
        for (let k = -2; k <= 2; k++)
          P(
            x + k,
            y,
            k === -2
              ? [70, 50, 36]
              : k === -1
                ? [176, 140, 96]
                : k === 2
                  ? [60, 44, 32]
                  : k === 1
                    ? [96, 72, 50]
                    : [136, 104, 72],
          );
      }
    }
    // the crown: hundreds of clusters, lit from above, glowing; drooping branch tips at the edge
    for (const cl of w.clusters) {
      const cx = T.x + cl.x,
        cy = T.top + T.crownH * 0.45 + cl.y;
      for (let y = -cl.R; y <= cl.R; y++)
        for (let x = -cl.R; x <= cl.R; x++) {
          const d = x * x + y * y;
          if (d > cl.R * cl.R) continue;
          const lit = (-y - x * 0.3) / cl.R + (cl.y < 0 ? 0.3 : -0.2) + (cl.v - 0.5) * 0.6;
          b.px(cx + x, cy + y, GOLD[Math.max(0, Math.min(4, Math.round(2 - lit * 1.6 + (bayer(x, y) - 0.5) * 0.6)))]);
        }
    }
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2,
        ex = T.x + Math.cos(a) * T.crownW * 0.95,
        ey = T.top + T.crownH * 0.45 + Math.sin(a) * T.crownH * 0.5;
      if (Math.sin(a) < -0.2) continue;
      for (let k = 0; k < 8 + (i % 4) * 3; k++) b.px(ex + Math.cos(a) * k * 0.4, ey + k, GOLD[2 + (k % 2)]);
    }
    w.crownC = [T.x, T.top + T.crownH * 0.45];
    // ruined castle on a crag (left), hazed with distance
    const cx = Math.round(W * 0.18),
      cb = hy - 4;
    for (let x = cx - 26; x < cx + 26; x++) {
      const top = Math.round(cb + Math.abs(x - cx) * 0.4 + hash(x, 2) * 2);
      for (let y = top; y < hy + 8; y++) b.px(x, y, haze(x < cx ? [120, 104, 100] : [90, 80, 84], 0.3));
    }
    const tw = (tx, th, wd, broken) => {
      for (let y = 0; y < th; y++)
        for (let k = 0; k < wd; k++) {
          if (broken && y > th - 4 && (k + y) % 3 === 0) continue;
          b.px(tx + k, cb - y, haze(k === 0 ? [180, 166, 150] : k === wd - 1 ? [100, 90, 90] : [140, 128, 120], 0.3));
        }
      if (!broken) for (let k = 0; k < wd; k += 2) b.px(tx + k, cb - th - 1, haze([140, 128, 120], 0.3));
    };
    tw(cx - 18, 26, 7, false);
    tw(cx - 10, 16, 18, true);
    tw(cx + 7, 34, 6, false);
    tw(cx + 13, 20, 5, true);
    for (let y = 0; y < 8; y++)
      for (let k = -y * 0.5; k <= y * 0.5; k++) b.px(cx + 10 + k, cb - 42 + y, haze([100, 80, 90], 0.3));
    // broken aqueduct across the plain
    const ay = hy + 10;
    for (let x = Math.round(W * 0.3); x < W * 0.5; x++) {
      if (x > W * 0.44 && x < W * 0.47) continue;
      for (let y = 0; y < 3; y++) b.px(x, ay - 12 + y, haze([190, 176, 156], 0.2));
      const rel = (x - Math.round(W * 0.3)) % 12;
      for (let y = 3; y < 12; y++)
        if (rel < 2 || rel > 9 || y > 3 + Math.sqrt(Math.max(0, 16 - (rel - 5.5) ** 2)) * 2.2)
          b.px(x, ay - 12 + y, haze(rel < 2 ? [190, 176, 156] : [150, 136, 120], 0.2));
    }
    // standing stones and a stone bridge over a stream
    for (const [sx, sh] of [
      [W * 0.86, 10],
      [W * 0.89, 7],
      [W * 0.92, 12],
    ])
      for (let y = 0; y < sh; y++)
        for (let k = 0; k < 3; k++) P(sx + k, hy + 16 - y, k === 0 ? [180, 170, 160] : [120, 112, 108]);
    // foreground: a weathered pillar and a stone archway, grass base
    const fy = Math.round(H * 0.88);
    for (let y = fy; y < H; y++)
      for (let x = 0; x < W; x++) P(x, y, bayer(x, y) < 0.3 ? [110, 92, 50] : [140, 118, 62]);
    for (let y = 0; y < 34; y++)
      for (let k = -4; k <= 4; k++) {
        if (y > 30 && (k * 2 + y) % 3 === 0) continue;
        P(
          W * 0.08 + k,
          H - y,
          k < -2 ? [210, 200, 186] : k > 2 ? [120, 112, 108] : k % 2 ? [170, 160, 148] : [186, 176, 162],
        );
      }
    const ax = Math.round(W * 0.8);
    // a stone archway: two block piers and a voussoir arch
    const STONE = (k, n, y) =>
      y % 5 === 0 ? [110, 102, 96] : k === 0 ? [214, 204, 190] : k === n - 1 ? [112, 106, 102] : [166, 156, 146];
    for (let y = 0; y < 40; y++)
      for (const sx of [ax - 18, ax + 11]) for (let k = 0; k < 8; k++) P(sx + k, H - y, STONE(k, 8, y));
    for (let a = 0; a <= 60; a++) {
      const an = (Math.PI * a) / 60,
        joint = a % 8 === 0;
      for (let k = 0; k < 8; k++) {
        const rr = 14.5 - 0 + k * 0.9,
          x = ax - 3.5 + 0.5 + Math.cos(an) * rr,
          y = H - 40 - Math.sin(an) * rr * 0.9;
        P(x, y, joint ? [110, 102, 96] : k === 7 ? [214, 204, 190] : k === 0 ? [112, 106, 102] : [166, 156, 146]);
      }
    }
    w.campfire = [Math.round(W * 0.3), Math.round(H * 0.93)];
    b.put(g);
  }

  function sky(c, w, e, s) {
    const { W, H, T } = w;
    // shafts of light falling from the crown
    c.fillStyle = e.night ? "rgba(255,220,140,0.08)" : "rgba(255,236,170,0.12)";
    for (let i = 0; i < 4; i++) {
      const x0 = T.x - T.crownW * 0.6 + i * T.crownW * 0.4 + Math.sin(s * 0.2 + i) * 3;
      for (let y = T.top + T.crownH; y < w.hy; y++) {
        const hw = 2 + (y - T.top) * 0.03;
        for (let k = -hw; k <= hw; k++)
          if (bayer(Math.round(x0 + k), y) < 0.45) c.fillRect(Math.round(x0 + k + (y - T.top) * 0.1), y, 1, 1);
      }
    }
    // high thin clouds
    for (let i = 0; i < 2 + Math.round(e.wx.clouds * 5); i++) {
      const x0 = ((i * 113 + s * (1.5 + i * 0.3)) % (W + 100)) - 80,
        y0 = H * (0.08 + (i % 4) * 0.07),
        cw = 40 + (i % 3) * 14;
      c.fillStyle = e.night ? "rgba(80,80,110,0.6)" : "rgba(255,240,220,0.55)";
      for (let x = 0; x < cw; x++)
        for (let y = 0; y < 3; y++)
          if (bayer(x + i, y) < 0.7 - Math.abs(y - 1) * 0.25 - Math.abs(x / cw - 0.5))
            c.fillRect(Math.round(x0 + x), y0 + y, 1, 1);
    }
  }

  const RIDER = [
    [
      "....hh....",
      "....hh....",
      "...cccc...",
      "..ccccc...",
      "..cc.cc...",
      ".bbbbbbbbb",
      "bbbbbbbbb.",
      "bbbbbbbb..",
      ".b..b..b.b",
      "b...b.b..b",
    ],
    [
      "....hh....",
      "....hh....",
      "...cccc...",
      "..ccccc...",
      "..cc.cc...",
      ".bbbbbbbbb",
      "bbbbbbbbb.",
      "bbbbbbbb..",
      "..bb...bb.",
      ".b..b.b...",
    ],
  ];

  const DRAGON = [
    [
      "......kk..........",
      ".....kkk..........",
      "kk..kkkk......kk..",
      ".kkkkkkkkkkkkkkkkk",
      "..kkkkkkkkkk.....k",
      "....k..k..........",
    ],
    [
      "..................",
      "..................",
      "kk...........kk...",
      ".kkkkkkkkkkkkkkkkk",
      "..kkkkkkkkkk.....k",
      "...kkkk.k.........",
      "..kkk.............",
    ],
  ];

  function frame(c, w, e, s) {
    const { W, H, hy } = w,
      night = e.day < 0.45;
    if (!w.glows.mote) {
      w.glows.mote = glowSprite(3, [255, 230, 150], 0.8, 0.5);
      w.glows.wisp = glowSprite(4, [140, 200, 255], 0.8, 0.5);
      w.glows.fire = glowSprite(11, [255, 170, 80], 0.7, 0.4);
      w.glows.crown = glowSprite(30, [255, 220, 130], 0.45, 0.2);
    }
    // the tree's light hanging in the air around the crown, stronger at night
    w.glows.haze ||= softGlow(Math.round(Math.min(W * 0.32, H * 0.6)), [255, 210, 120], 0.3);
    {
      const R = w.glows.haze.width >> 1;
      c.globalAlpha = (night ? 0.9 : 0.5) * (0.75 + 0.25 * Math.sin(s * 0.6));
      c.drawImage(w.glows.haze, Math.round(w.crownC[0]) - R, Math.round(w.crownC[1]) - R);
      c.globalAlpha = 1;
    }
    // mist drifting over the plains
    {
      const M = night ? "night" : "day";
      w.mists ||= {};
      w.mists[M] ||= mist(W, 18, night ? [90, 100, 140] : [250, 230, 180], 0.8, 0.45, 19);
      const ox = -Math.round((s * 2) % W);
      c.globalAlpha = e.wx.fog ? 1 : 0.7;
      c.drawImage(w.mists[M], ox, hy - 4);
      c.drawImage(w.mists[M], ox + W, hy - 4);
      c.globalAlpha = 1;
    }
    // a dragon crossing the far sky now and then, wings beating slowly
    {
      const per = 95,
        t = (s % per) / per;
      if (t < 0.3) {
        const k = t / 0.3,
          dx = Math.round(-30 + k * (W + 60)),
          dy = Math.round(H * 0.2 + Math.sin(k * Math.PI) * -H * 0.06 + Math.sin(s * 1.5) * 1.5);
        sprite(c, DRAGON[Math.floor(s * 2.5) % 2], dx, dy, { k: night ? "#1a1a28" : "#3a3030" });
      }
    }
    // the crown's slow pulse
    c.globalAlpha = 0.4 + 0.3 * Math.sin(s * 0.6);
    c.drawImage(w.glows.crown, Math.round(w.crownC[0]) - 30, Math.round(w.crownC[1]) - 30);
    c.globalAlpha = 1;
    // motes rising toward the crown
    for (const [px, py, p] of w.motes) {
      const t = (py + s * 0.04 * (0.5 + p)) % 1,
        x = Math.round(w.T.x + (px - 0.5) * W * 0.8 * (1 - t) + Math.sin(s + p * 20) * 3),
        y = Math.round(H - t * (H - w.crownC[1]));
      c.fillStyle = "#fff2b0";
      c.fillRect(x, y, 1, 1);
      if (p > 0.7) c.drawImage(w.glows.mote, x - 3, y - 3);
    }
    // a rider crossing the plain
    {
      const per = 80,
        t = (s % per) / per;
      if (t < 0.45) {
        const x = Math.round(-14 + (t / 0.45) * (W + 28)),
          y = hy + 6;
        sprite(c, RIDER[Math.floor(s * 6) % 2], x, y, {
          h: css(toner(e)([60, 50, 50])),
          c: css(toner(e)([120, 40, 40])),
          b: css(toner(e)([70, 56, 46])),
        });
      }
    }
    // crows
    if (!e.wx.rain)
      for (let i = 0; i < 4; i++) {
        const an = s * 0.2 + i * 1.6,
          x = Math.round(W * 0.35 + Math.cos(an) * 34),
          y = Math.round(H * 0.3 + Math.sin(an * 1.3) * 10),
          up = Math.floor(s * 4 + i) % 2;
        c.fillStyle = "#1a1418";
        c.fillRect(x, y, 2, 1);
        c.fillRect(x - 2, y - up, 2, 1);
        c.fillRect(x + 2, y - up, 2, 1);
      }
    // a wanderer's campfire at night, blue wisps drifting nearby
    if (night) {
      const [fx, fy] = w.campfire;
      c.drawImage(w.glows.fire, fx - 11, fy - 13);
      for (let k = -2; k <= 2; k++) {
        const h = 2 + Math.round(Math.abs(Math.sin(s * 9 + k * 2)) * 4 * (1 - Math.abs(k) / 3));
        c.fillStyle = k === 0 ? "#fff0a0" : "#ff9a30";
        c.fillRect(fx + k, fy - h, 1, h);
      }
      c.fillStyle = "#2a2028";
      c.fillRect(fx - 9, fy - 7, 4, 7);
      c.fillRect(fx - 10, fy - 4, 6, 4);
      for (let i = 0; i < 3; i++) {
        const x = Math.round(fx + 20 + Math.sin(s * 0.7 + i * 2) * 14),
          y = Math.round(fy - 14 + Math.cos(s * 0.9 + i) * 6);
        c.drawImage(w.glows.wisp, x - 4, y - 4);
        c.fillStyle = "#d8f0ff";
        c.fillRect(x, y, 1, 1);
      }
    }
    // tall gold grass in front, swaying, flowers among it
    const wind = Math.min(3, (e.wx.wind || 5) / 7);
    for (const [gx, gp, gq] of w.grass) {
      const base = Math.round(H * 0.86 + gq * H * 0.14),
        h = 4 + Math.round(gp * 8),
        sw = Math.sin(s * 1.6 + gx * 0.12) * wind * 0.6 + wind * 0.6;
      c.fillStyle = css(toner(e, 0.8)(gp > 0.66 ? [240, 210, 120] : gp > 0.33 ? [200, 170, 90] : [150, 126, 64]));
      for (let k = 0; k < h; k++) c.fillRect(Math.round(gx + sw * (k / h) ** 1.5), base - k, 1, 1);
      if (gq > 0.92) {
        c.fillStyle = gp > 0.5 ? "#ffffff" : "#f0a0c0";
        c.fillRect(Math.round(gx + sw), base - h - 1, 2, 1);
      }
    }
    // fireflies over the grass at night
    if (night && !e.wx.rain) {
      w.flies ||= Array.from({ length: Math.round(W / 10) }, (_, i) => [hash(i, 4), hash(i, 5), hash(i, 6)]);
      motes(c, w.flies, s, [0, hy + 4, W, H - hy - 8], {
        col: "#fff0a0",
        vx: 1,
        vy: -0.5,
        wob: 4,
        blink: 1.1,
        glow: w.glows.mote,
      });
    }
    // golden leaves drifting on the wind
    for (const [px, py, p] of w.leaves) {
      const x = Math.round(((px * W + s * (6 + wind * 6) * (0.5 + p)) % (W + 10)) - 5),
        y = Math.round((py * H + s * 7 * (0.5 + p)) % H),
        turn = Math.floor(s * 3 + p * 10) % 2;
      c.fillStyle = p > 0.6 ? "#ffe08a" : "#e8b050";
      c.fillRect(x, y, turn ? 2 : 1, 1);
    }
    // weather
    if (e.wx.rain) {
      c.fillStyle = "rgba(200,210,230,0.5)";
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
      c.fillStyle = "rgba(240,226,200,0.42)";
      for (let y = Math.round(hy * 0.8); y < H; y++)
        for (let x = y & 1; x < W; x += 2) if (bayer(x, y) < 0.55) c.fillRect(x, y, 1, 1);
    }
    if (e.wx.thunder && s % 10 < 0.12) {
      c.fillStyle = "rgba(255,250,230,0.45)";
      c.fillRect(0, 0, W, H);
    }
  }

  RS_SCENE.register("goldentree", { build, background, sky, land, frame });
})();
