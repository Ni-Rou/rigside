"use strict";

// Frostpeak: winter valley with a frozen lake, watchtower and cabin. Aurora on clear nights.
(() => {
  const { Buf, ramp, bayer, H_, mix, css, skyRamp, toner, ridge, glowSprite, shade, sprite, hash, mist, puffs, smoke } =
    RS_PX;
  const { rng } = RS_SCENE;
  const SKY = {
    night: H_(["#040818", "#08102a", "#0e1a3c", "#16264c", "#20325c"]),
    day: H_(["#2e66b4", "#4880c4", "#6a9cd2", "#94bce0", "#c4dcec"]),
    warm: H_(["#28285a", "#54407a", "#a8607e", "#ea9478", "#ffcc96"]),
    grey: H_(["#6a7484", "#788292", "#86909e", "#96a0ac", "#a8b0ba"]),
  };

  function build(W, H) {
    const r = rng(1111),
      lake = Math.round(H * 0.66),
      shore = Math.round(H * 0.8);
    // peaks: apex x, apex y, half-width; back range then front range
    const far = [],
      near = [];
    for (let x = -20; x < W + 40; x += 34 + r() * 26)
      far.push({ x, y: H * (0.12 + r() * 0.16), hw: 34 + r() * 22, seed: r() });
    for (let x = -10; x < W + 40; x += 46 + r() * 30)
      near.push({ x, y: H * (0.3 + r() * 0.12), hw: 40 + r() * 24, seed: r() });
    const forest = [
      ridge(r, W, [
        [40, 1],
        [12, 0.4],
      ]),
      ridge(r, W, [
        [30, 1],
        [9, 0.4],
      ]),
    ];
    const tower = { x: Math.round(W * 0.72), y: Math.round(H * 0.46) };
    const fall = { x: Math.round(W * 0.2), top: Math.round(H * 0.38), bot: lake };
    const cabin = { x: Math.round(W * 0.3), y: shore + 6 };
    const S = Math.min(H, W * 0.6),
      pines = [
        { x: W * 0.04, h: S * 0.62 },
        { x: W * 0.13, h: S * 0.4 },
        { x: W * 0.9, h: S * 0.56 },
        { x: W * 0.97, h: S * 0.7 },
        { x: W * 0.5, h: S * 0.2 },
        { x: W * 0.58, h: S * 0.26 },
      ];
    const stars = Array.from({ length: Math.round((W * H) / 60) }, () => [r(), r() * 0.6, r()]);
    const flakes = Array.from({ length: Math.round((W * H) / 120) }, () => [r(), r(), 0.5 + r() * 0.8]);
    const deer = Array.from({ length: 3 }, (_, i) => ({ dx: i * 13 + (i % 2) * 4, ph: r() * 6 }));
    return { W, H, lake, shore, far, near, forest, tower, fall, cabin, pines, stars, flakes, deer, glows: {} };
  }

  // draw one faceted peak into a Buf: snow above a jagged snowline, rock below; lit left, shadow right,
  // with spur ridges splitting each side into facets
  function peak(b, pk, bottom, tone, sky, haze, H) {
    const { x: px, y: py, hw, seed } = pk,
      spurs = [0.35, 0.7].map((k) => k + (hash(seed * 99, k) - 0.5) * 0.2);
    for (let x = Math.floor(px - hw * 1.6); x <= px + hw * 1.6; x++) {
      const t = (x - px) / hw,
        jag = (hash(Math.floor(x / 2), seed * 50) - 0.5) * 3 + Math.sin(x * 0.4 + seed * 9) * 1.5;
      const slope = t < 0 ? 0.5 + hash(seed, 1) * 0.35 : 0.5 + hash(seed, 2) * 0.35,
        top = Math.round(py + Math.abs(t) * (bottom - py) * slope + jag * Math.min(1, Math.abs(t) * 2));
      for (let y = Math.max(0, top); y < bottom; y++) {
        const depth = (y - py) / (bottom - py),
          side = x < px ? -1 : 1;
        // which facet: compare against spur lines leaving the apex at different slopes
        const rel = Math.abs(x - px) / Math.max(1, y - py + 1);
        const facet = rel < spurs[0] ? 0 : rel < spurs[1] ? 1 : 2;
        const lit = side < 0 ? [0.25, 0.12, 0.0][facet] : [-0.15, -0.3, -0.42][facet];
        const snowline =
          0.42 + Math.sin(x * 0.13 + seed * 20) * 0.07 + Math.sin(x * 0.41 + seed * 5) * 0.03 + (side > 0 ? 0.05 : 0);
        let c;
        if (depth < snowline) c = lit > 0.05 ? [252, 252, 255] : lit > -0.2 ? [206, 218, 238] : [156, 174, 210];
        else {
          const gx = x + Math.sin(y * 0.18 + seed * 9) * 2.5,
            gully =
              Math.sin(gx * 0.8) > 0.8 &&
              hash(Math.floor(gx / 8), Math.floor(seed * 99)) < 0.45 &&
              depth < snowline + 0.12 + hash(Math.floor(gx / 8), 3) * 0.25;
          c = shade(bayer(x, y) < 0.35 ? [96, 98, 110] : [110, 112, 122], lit * 0.9);
          if (gully) c = lit > 0.05 ? [236, 240, 250] : [160, 176, 210];
        }
        if (y === top) c = shade(c, 0.15);
        b.px(x, y, mix(tone(c), sky[Math.min(4, Math.round((y / H) * 6))], haze));
      }
    }
  }

  function background(g, w, e) {
    const { W, H, lake } = w,
      b = new Buf(g, W, H),
      sky = skyRamp(e, SKY),
      tone = toner(e);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b.px(x, y, ramp(sky, y / lake, x, y, 0.3));
    if (e.day < 0.5)
      for (const [px, py, p] of w.stars)
        b.px(px * W, py * H, p > 0.92 ? [255, 255, 255] : [180, 200, 255], (1 - e.day * 2) * (0.3 + p * 0.7));
    if (e.night)
      for (const [mx, my, R, col] of [
        [0.2, 0.12, 6, [236, 236, 240]],
        [0.27, 0.07, 3, [220, 190, 170]],
      ])
        for (let y = -R; y <= R; y++)
          for (let x = -R; x <= R; x++)
            if (x * x + y * y <= R * R) b.px(W * mx + x, H * my + y, x + y > R * 0.6 ? shade(col, -0.4) : col);
    for (const pk of w.far) peak(b, pk, lake, tone, sky, 0.38, H);
    b.put(g);
  }

  function land(g, w, e) {
    const { W, H, lake, shore, tower: T, fall: F, cabin: C } = w,
      b = new Buf(g, W, H),
      tone = toner(e),
      sky = skyRamp(e, SKY),
      night = e.day < 0.45;
    const P = (x, y, c) => b.px(x, y, tone(c));
    for (const pk of w.near) peak(b, pk, lake, tone, sky, 0.12, H);
    // the cliff with the frozen waterfall
    for (let x = Math.round(F.x - 26); x < F.x + 22; x++) {
      const top = Math.round(F.top + Math.abs(x - F.x) * 0.3 + hash(x, 3) * 2);
      for (let y = top; y < lake; y++)
        P(
          x,
          y,
          y - top < 2
            ? [240, 244, 252]
            : Math.sin(x * 0.9 + Math.sin(y * 0.2) * 2) > 0.85 && hash(Math.floor(x / 7), 5) < 0.4 && y - top < 14
              ? [200, 212, 232]
              : shade(bayer(x, y) < 0.35 ? [100, 102, 114] : [114, 116, 126], x < F.x ? 0.1 : -0.25),
        );
    }
    for (let y = F.top + 2; y < lake; y++) {
      const hw = 3 + Math.round((y - F.top) * 0.08);
      for (let k = -hw; k <= hw; k++) {
        const icicle = (y - F.top) % 5 < 2 && hash(k, y) < 0.3;
        P(
          F.x + k,
          y,
          icicle
            ? [255, 255, 255]
            : k < -hw * 0.3
              ? [214, 240, 255]
              : k > hw * 0.4
                ? [120, 170, 214]
                : hash(k, Math.floor(y / 3)) < 0.5
                  ? [170, 214, 244]
                  : [150, 200, 236],
        );
      }
    }
    // the crag and the watchtower: stone courses, crenellations, a slit window, a pointed roof
    for (let x = T.x - 24; x < T.x + 26; x++) {
      const top = Math.round(T.y + 4 + Math.abs(x - T.x) * 0.55 + hash(x, 1) * 2);
      for (let y = top; y < lake; y++)
        P(x, y, y - top < 2 ? [240, 244, 252] : x < T.x - 4 ? [116, 118, 128] : [80, 82, 96]);
    }
    for (let y = 0; y < 30; y++)
      for (let x = -6; x <= 6; x++) {
        const course = y % 4 === 0 || (x + (Math.floor(y / 4) % 2) * 3) % 6 === 0;
        P(
          T.x + x,
          T.y - y,
          x < -4 ? [170, 166, 160] : x > 4 ? [90, 88, 92] : course ? [100, 98, 100] : [140, 136, 132],
        );
      }
    for (let x = -8; x <= 8; x++)
      for (let y = 0; y < 3; y++)
        if (y < 2 || x % 3 !== 0) P(T.x + x, T.y - 30 - y, x < -5 ? [170, 166, 160] : [130, 126, 124]);
    for (let y = 0; y < 10; y++)
      for (let x = -y; x <= y; x++)
        if (Math.abs(x) <= 7) P(T.x + Math.round(x * 0.7), T.y - 42 + y, x < 0 ? [90, 60, 50] : [60, 40, 36]);
    for (let y = 0; y < 8; y++) P(T.x, T.y - 52 + y, [60, 50, 40]);
    w.towerWins = [
      [T.x - 1, T.y - 22],
      [T.x - 1, T.y - 12],
    ];
    for (const [wx, wy] of w.towerWins)
      for (let y = 0; y < 3; y++) {
        P(wx, wy + y, [30, 26, 30]);
        P(wx + 1, wy + y, [30, 26, 30]);
      }
    w.flag = [T.x + 1, T.y - 52];
    // pine forest bands along the far shore: rows of little spruces, snow on their shoulders
    for (const [i, rr] of w.forest.entries()) {
      const baseY = lake - 1 + i * 2;
      for (let x = 0; x < W; x += 2 + i) {
        const h = Math.round(6 + rr[x] * 7 + i * 3 + hash(x, i) * 3);
        for (let y = 0; y < h; y++) {
          const hw = Math.round((y / h) * (2 + i));
          for (let k = -hw; k <= hw; k++) {
            const snow = (h - y) % 3 === 0 && k < 0;
            P(x + k, baseY - h + y, snow ? [220, 232, 246] : k < 0 ? [44, 76, 70] : [24, 46, 48]);
          }
        }
      }
    }
    // the frozen lake: mirrors what's above it, blue ice, cracks, snow drifts
    for (let y = lake + 2; y < shore; y++)
      for (let x = 0; x < W; x++) {
        const d = y - lake,
          [rr2, gg, bb, aa] = b.get(x, lake - d * 1.8 - 2);
        let c = aa
          ? mix([rr2, gg, bb], tone([160, 196, 224]), 0.45 + (d / (shore - lake)) * 0.3)
          : tone([170, 200, 228]);
        if (Math.abs(Math.sin(x * 0.07 + y * 0.6) + Math.sin(x * 0.023 - y * 0.3)) < 0.03) c = tone([240, 248, 255]);
        if (hash(Math.floor(x / 6), y) < 0.04) c = mix(c, tone([250, 252, 255]), 0.7);
        b.px(x, y, c);
      }
    // the near shore: snow banks, rocks, the cabin, woodpile, lantern post
    for (let y = shore; y < H; y++)
      for (let x = 0; x < W; x++) {
        const n = Math.sin(x * 0.08 + y * 0.2) + Math.sin(x * 0.21);
        const drift = Math.sin(x * 0.045 + Math.sin(y * 0.3) * 0.5) * 6 + y;
        P(
          x,
          y,
          y === shore
            ? [255, 255, 255]
            : Math.round(drift) % 9 === 0
              ? [214, 226, 244]
              : n > 1.5 && bayer(x, y) < 0.3
                ? [226, 236, 250]
                : [246, 249, 255],
        );
      }
    for (const [rx, ry, R] of [
      [W * 0.18, shore + 8, 5],
      [W * 0.66, shore + 14, 7],
      [W * 0.8, shore + 6, 4],
    ])
      for (let y = -R; y <= 0; y++)
        for (let x = -R; x <= R; x++)
          if (x * x + y * y * 2 < R * R)
            P(rx + x, ry + y, y < -R * 0.5 ? [250, 252, 255] : x < 0 ? [120, 120, 130] : [80, 82, 96]);
    const L1 = [120, 80, 50],
      L2 = [90, 58, 36],
      L3 = [60, 38, 24];
    for (let y = 0; y < 14; y++)
      for (let x = 0; x < 30; x++) P(C.x + x, C.y - y, y % 3 === 2 ? L3 : x < 2 || x > 27 ? L3 : y % 3 === 0 ? L1 : L2);
    for (let y = 0; y < 10; y++)
      for (let x = -2 - y * 1.7; x <= 32 + y * 1.7 - y * 3.4; x++) {
        const xx = Math.round(x + y * 1.7);
        if (xx >= -3 && xx <= 33) P(C.x + xx, C.y - 14 - (10 - y) + 1, y < 3 ? [250, 252, 255] : [200, 210, 228]);
      }
    for (let y = 0; y < 10; y++)
      for (let x = 0; x < 3; x++) P(C.x + 22 + x, C.y - 24 - y, x === 0 ? [150, 140, 136] : [100, 96, 96]);
    w.chimney = [C.x + 23, C.y - 34];
    w.cabinWins = [
      [C.x + 5, C.y - 9],
      [C.x + 20, C.y - 9],
    ];
    for (let y = 0; y < 7; y++) for (let x = 0; x < 4; x++) P(C.x + 12 + x, C.y - 7 + y, [50, 30, 20]);
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 10; x++) P(C.x + 32 + x, C.y - y, (x + y) % 3 === 0 ? [160, 120, 80] : [110, 80, 50]);
    w.lantern = [C.x - 8, C.y - 14];
    for (let y = 0; y < 14; y++) P(C.x - 8, C.y - y, [60, 44, 30]);
    // big snow-laden pines framing the sides
    for (const pn of w.pines) {
      const base = H + 2,
        top = base - pn.h,
        tiers = Math.max(4, Math.round(pn.h / 9));
      for (let y = 0; y < pn.h * 0.12; y++) {
        P(pn.x, base - y, L3);
        P(pn.x + 1, base - y, L3);
      }
      for (let t = 0; t < tiers; t++) {
        const ty = top + t * ((pn.h * 0.86) / tiers),
          th = (pn.h * 0.86) / tiers + 4,
          tw = 3 + t * (pn.h / tiers) * 0.55;
        for (let y = 0; y < th; y++) {
          const hw = Math.round(tw * (y / th));
          for (let k = -hw; k <= hw; k++) {
            const snow = y < 2 + (k < 0 ? 1 : 0) || (y === Math.round(th) - 1 && hash(k, t) < 0.6);
            P(
              pn.x + k,
              ty + y,
              snow
                ? k < 0
                  ? [252, 252, 255]
                  : [200, 214, 238]
                : k < -hw * 0.3
                  ? [46, 90, 72]
                  : k > hw * 0.4
                    ? [18, 44, 40]
                    : [30, 66, 56],
            );
          }
        }
      }
    }

    b.put(g);
  }

  function sky(c, w, e, s) {
    const { W, H, lake } = w;
    // aurora: shimmering curtains behind the peaks on clear nights
    if (e.day < 0.3 && e.wx.clouds < 0.6) {
      for (let x = 0; x < W; x += 1) {
        const base = H * 0.18 + Math.sin(x * 0.02 + s * 0.15) * 14 + Math.sin(x * 0.05 - s * 0.3) * 6,
          len = 26 + Math.sin(x * 0.04 + s * 0.2) * 12,
          bright = 0.5 + 0.5 * Math.sin(x * 0.11 + s * 0.8);
        for (let k = 0; k < len; k++) {
          const t = k / len,
            a = bright * (1 - t) * 0.55;
          if (a > bayer(x, Math.round(base + k))) {
            c.fillStyle =
              t < 0.3 && bright > 0.7
                ? "rgba(200,255,220,0.8)"
                : k > len * 0.75
                  ? "rgba(200,90,220,0.6)"
                  : "rgba(80,255,160,0.55)";
            c.fillRect(x, Math.round(base + k), 1, 1);
          }
        }
      }
    }
    // clouds drifting
    for (let i = 0; i < 2 + Math.round(e.wx.clouds * 5); i++) {
      const x0 = ((i * 97 + s * (2 + i * 0.4)) % (W + 90)) - 70,
        y0 = 12 + (i % 4) * 9,
        cw = 28 + (i % 3) * 10;
      const top = e.night ? [70, 80, 110] : [255, 255, 255],
        und = e.night ? [40, 46, 70] : [190, 200, 220];
      for (let x = 0; x < cw; x++) {
        const hh = Math.round(Math.sin((x / cw) * Math.PI) * 4 + Math.sin(x * 0.7 + i) * 0.8);
        for (let y = -hh; y <= 1; y++) {
          c.fillStyle = css(y > 0 ? und : top);
          c.fillRect(Math.round(x0 + x), y0 + y, 1, 1);
        }
      }
    }
    // the dragon crossing the far sky every ~5 minutes, in front of the far range
    const per = 300,
      t = ((s + 120) % per) / per;
    if (t < 0.12) {
      const k = t / 0.12,
        x = Math.round(-30 + k * (W + 60)),
        y = Math.round(H * 0.2 + Math.sin(k * 6) * 4),
        flap = Math.sin(s * 5);
      c.fillStyle = e.night ? "#0a0e18" : "#2a2a34";
      c.fillRect(x - 8, y, 16, 2);
      c.fillRect(x + 8, y - 1, 4, 2);
      c.fillRect(x + 12, y - 2, 2, 1);
      for (let j = 0; j < 8; j++) c.fillRect(x - 8 - j, y + 1 + Math.round(Math.sin(j * 0.6 + s * 3)), 1, 1);
      for (let j = 0; j < 10; j++) {
        const wy = Math.round(-flap * j * 0.9);
        c.fillRect(x - 2 + Math.round(j * 0.3), y + wy - 1, 2, 1);
        c.fillRect(x - 4 - Math.round(j * 0.3), y + wy - 1, 2, 1);
      }
    }
    // snow streaming off the highest peaks in the wind
    w.drift ||= puffs([240, 246, 255], 6, 0.7);
    w.tops ||= [...w.far].sort((a, b) => a.y - b.y).slice(0, 3);
    const gust = 0.6 + 0.4 * Math.sin(s * 0.3);
    for (const [i, pk] of w.tops.entries())
      smoke(c, w.drift, pk.x + 1, pk.y + 2, s + i * 7, {
        n: 9,
        h: 5,
        lean: 34 * gust,
        speed: 0.12,
        alpha: e.day < 0.4 ? 0.3 : 0.55,
      });
  }

  const DEER = [
    ["......aa.", ".......a.", "......ss.", "bbbbbbbs.", "bbbbbbb..", "b.b..b.b.", "b.b..b.b."],
    ["......aa.", ".......a.", "......ss.", "bbbbbbbs.", "bbbbbbb..", ".b.bb.b..", ".b.bb.b.."],
  ];

  function frame(c, w, e, s) {
    const { W, H, lake, shore } = w,
      night = e.day < 0.45;
    if (!w.glows.win) {
      w.glows.win = glowSprite(6, [255, 200, 110], 0.7, 0.4);
      w.glows.lamp = glowSprite(9, [255, 200, 110], 0.6, 0.35);
    }
    // windows: warm at night (tower and cabin), the lantern's pool of light
    if (night) {
      for (const [wx, wy] of [...w.towerWins, ...w.cabinWins]) {
        c.fillStyle = "#ffd27a";
        c.fillRect(wx, wy, 2, 3);
        c.drawImage(w.glows.win, wx - 5, wy - 5);
      }
      const [lx, ly] = w.lantern;
      c.fillStyle = Math.sin(s * 8) > -0.6 ? "#ffe08a" : "#ffb050";
      c.fillRect(lx - 1, ly - 3, 3, 3);
      c.drawImage(w.glows.lamp, lx - 9, ly - 10);
    } else
      for (const [wx, wy] of w.cabinWins) {
        c.fillStyle = "#9ab8d8";
        c.fillRect(wx, wy, 3, 3);
        c.fillStyle = "#e8f4ff";
        c.fillRect(wx, wy, 1, 1);
      }
    // banner on the tower
    {
      const [fx, fy] = w.flag;
      for (let k = 0; k < 7; k++) {
        const off = Math.round(Math.sin(s * 3 + k * 0.7) * (k / 7) * 1.5);
        for (let y = 0; y < 4 - (k > 4 ? k - 4 : 0); y++) {
          c.fillStyle = css(toner(e)(y === 0 ? [200, 160, 60] : [40, 70, 140]));
          c.fillRect(fx + k, fy + y + off, 1, 1);
        }
      }
    }
    // smoke from the chimney, leaning with the wind
    const wind = Math.min(3, (e.wx.wind || 5) / 6);
    for (let i = 0; i < 9; i++) {
      const t = (s * 0.18 + i / 9) % 1,
        x = Math.round(w.chimney[0] + t * 16 * wind + Math.sin(s * 0.8 + i) * 2),
        y = Math.round(w.chimney[1] - t * 34),
        R = 1 + t * 4;
      c.fillStyle = night ? `rgba(120,130,150,${0.5 * (1 - t)})` : `rgba(240,240,244,${0.7 * (1 - t)})`;
      for (let k = -R; k <= R; k++) if (bayer(x + k, y) < 0.75) c.fillRect(x + Math.round(k), y, 1, 2);
    }
    // deer crossing the ice now and then
    {
      const per = 90,
        t = (s % per) / per;
      if (t < 0.4) {
        const k = t / 0.4,
          bx = Math.round(W + 20 - k * (W + 60)),
          by = Math.round(lake + (shore - lake) * 0.45);
        for (const d of w.deer)
          sprite(
            c,
            DEER[Math.floor(s * 3 + d.ph) % 2],
            bx + d.dx,
            by - 6 + (d.dx % 3),
            { a: css(toner(e)([120, 90, 60])), b: css(toner(e)([150, 104, 66])), s: css(toner(e)([170, 130, 90])) },
            true,
          );
      }
    }
    // a fox trotting along the shore
    {
      const per = 110,
        t = ((s + 40) % per) / per;
      if (t < 0.3) {
        const x = Math.round(-10 + (t / 0.3) * (W + 20)),
          y = shore + 18;
        c.fillStyle = css(toner(e)([220, 110, 40]));
        c.fillRect(x, y, 6, 2);
        c.fillRect(x + 5, y - 2, 2, 2);
        c.fillRect(x - 4, y - 1, 4, 1);
        c.fillStyle = "#fff";
        c.fillRect(x - 5, y - 1, 1, 1);
        c.fillStyle = "#2a1a10";
        const st = Math.floor(s * 8) % 2;
        c.fillRect(x + st, y + 2, 1, 1);
        c.fillRect(x + 4 - st, y + 2, 1, 1);
      }
    }
    // ravens over the valley
    if (!e.wx.snow || e.wx.snow < 0.5)
      for (let i = 0; i < 3; i++) {
        const an = s * 0.25 + i * 2.1,
          x = Math.round(W * 0.6 + Math.cos(an) * 30),
          y = Math.round(H * 0.3 + Math.sin(an) * 8),
          up = Math.floor(s * 4 + i) % 2;
        c.fillStyle = "#14141c";
        c.fillRect(x, y, 2, 1);
        c.fillRect(x - 2, y - up, 2, 1);
        c.fillRect(x + 2, y - up, 2, 1);
      }
    // snow glints in the sun
    if (e.day > 0.6 && !e.wx.snow)
      for (let i = 0; i < 8; i++)
        if (Math.sin(s * 3 + i * 7.3) > 0.85) {
          c.fillStyle = "#ffffff";
          c.fillRect(Math.round(hash(i, 1) * W), Math.round(shore + 2 + hash(i, 2) * (H - shore - 4)), 1, 1);
        }
    // weather: snow (a blizzard when heavy), rain, fog, thunder
    if (e.wx.snow || (e.wx.temp <= 0 && e.wx.rain)) {
      const heavy = e.wx.snow > 0.7,
        n = Math.round(w.flakes.length * Math.min(1, (e.wx.snow || 0.5) + 0.2));
      c.fillStyle = "#ffffff";
      for (let i = 0; i < n; i++) {
        const [px, py, sp] = w.flakes[i],
          y = Math.round((py * H + s * (heavy ? 30 : 12) * sp) % H),
          x = Math.round((((px * W + (heavy ? s * 30 * sp : Math.sin(s + py * 20) * 3)) % W) + W) % W);
        c.fillRect(x, y, sp > 1 ? 2 : 1, sp > 1 ? 2 : 1);
      }
    } else if (e.wx.rain) {
      c.fillStyle = "rgba(200,215,240,0.55)";
      const n = Math.round(w.flakes.length * Math.min(1, e.wx.rain + 0.2));
      for (let i = 0; i < n; i++) {
        const [px, py, sp] = w.flakes[i];
        c.fillRect(Math.round(px * W), Math.round((py * H + s * 120 * sp) % H), 1, 3);
      }
    }
    if (e.wx.fog) {
      c.fillStyle = "rgba(230,236,244,0.45)";
      for (let y = Math.round(H * 0.35); y < H; y++)
        for (let x = y & 1; x < W; x += 2) if (bayer(x, y) < 0.55) c.fillRect(x, y, 1, 1);
    }
    if (e.wx.thunder && s % 10 < 0.12) {
      c.fillStyle = "rgba(255,255,255,0.45)";
      c.fillRect(0, 0, W, H);
    }
    // mist lying on the frozen lake
    {
      const M = night ? "night" : "day";
      w.mists ||= {};
      w.mists[M] ||= mist(W, 14, night ? [110, 130, 180] : [236, 244, 255], 0.8, 0.5, 29);
      const ox = -Math.round((s * 1.5) % W);
      c.globalAlpha = e.wx.fog ? 1 : 0.7;
      c.drawImage(w.mists[M], ox, lake - 8);
      c.drawImage(w.mists[M], ox + W, lake - 8);
      c.globalAlpha = 1;
    }
  }

  RS_SCENE.register("frostpeak", { build, background, sky, land, frame });
})();
