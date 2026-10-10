"use strict";

// Pocket: 4-colour handheld style side-scroller. Layers are pre-rendered strips.
(() => {
  const { bayer, css, hash, mist, motes } = RS_PX;
  const { rng } = RS_SCENE;
  const PAL = [
    [15, 56, 15],
    [48, 98, 48],
    [139, 172, 15],
    [155, 188, 15],
  ];
  const P = PAL.map((c) => css(c));

  function build(W, H) {
    const r = rng(1989);
    const ground = H - 26,
      period = Math.max(W + 64, 320);
    const critters = Array.from({ length: 3 }, (_, i) => ({ x: 120 + i * (period / 3) + r() * 40, sp: 4 + r() * 3 }));
    const coins = [];
    for (let i = 0; i < 10; i++)
      coins.push({ x: Math.round(40 + i * (period / 10) + r() * 10), y: ground - 18 - Math.round(r() * 3) * 6 });
    const plats = Array.from({ length: 2 }, (_, i) => ({
      x: Math.round(period * (0.3 + i * 0.45)),
      y: ground - 34 - i * 6,
      n: 4 + i,
    }));
    for (const pl of plats) for (let k = 0; k < pl.n; k += 2) coins.push({ x: pl.x + k * 8 + 2, y: pl.y - 10 });
    const clouds = Array.from({ length: 5 }, (_, i) => ({
      x: r(),
      y: 8 + ((i * 0.37 + r() * 0.2) % 1) * Math.max(36, ground - 80),
      w: 18 + Math.round(r() * 16),
    }));
    const stars = Array.from({ length: 50 }, () => [r(), r() * 0.65, r()]);
    const drops = Array.from({ length: 90 }, () => [r(), r(), 0.6 + r() * 0.6]);
    return { W, H, ground, period, critters, coins, plats, clouds, stars, drops, strips: null, key: "" };
  }

  // land shade: one darker at night (lights keep their shade)
  const shade = (i, night) => (night ? Math.max(0, i - 1) : i);

  function strip(w, h, draw) {
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const g = cv.getContext("2d"),
      img = g.createImageData(w, h),
      d = img.data;
    const px = (x, y, i) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const o = (y * w + x) * 4,
        c = PAL[i];
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = 255;
    };
    draw(px);
    g.putImageData(img, 0, 0);
    return cv;
  }

  const tri = (x) => Math.abs((((x % 2) + 2) % 2) - 1); // 0..1 triangle wave, period 2

  function makeStrips(w, night) {
    const { H, ground, period } = w;
    const n = (i) => shade(i, night);
    // far mountains: faceted peaks with snow caps
    const far = strip(192, H, (px) => {
      for (let x = 0; x < 192; x++) {
        const h = Math.round(26 + 22 * (1 - tri(x / 48)) + 7 * (1 - tri(x / 16 + 0.3)));
        const hn = Math.round(26 + 22 * (1 - tri((x + 1) / 48)) + 7 * (1 - tri((x + 1) / 16 + 0.3)));
        const top = ground - 8 - h,
          lit = hn > h;
        const hp = Math.round(26 + 22 * (1 - tri((x - 1) / 48)) + 7 * (1 - tri((x - 1) / 16 + 0.3)));
        const edge = Math.max(1, Math.abs(hn - h), Math.abs(hp - h));
        for (let y = top; y < ground; y++) {
          const d = y - top,
            cap = h > 38 && d < (h - 38) * 0.6 + 2;
          let i;
          if (d < edge)
            i = 0; // ridge outline
          else if (cap)
            i = lit ? 3 : 2; // snow, shaded side greyer
          else if (lit)
            i = d < 14 && bayer(x, y) < 0.3 ? 2 : 1; // sunlit face, catching light near the top
          else i = bayer(x, y) < 0.5 ? 0 : 1; // shadow face
          px(x, y, i >= 2 ? (night ? i - 1 : i) : n(i));
        }
      }
    });
    // mid hills: rolling, with trees, a castle and two cottages
    const mid = strip(256, H, (px) => {
      const hill = (x) =>
        Math.round(18 + 9 * Math.sin((x / 256) * Math.PI * 4) + 5 * Math.sin((x / 256) * Math.PI * 6 + 1));
      for (let x = 0; x < 256; x++) {
        const top = ground - hill(x);
        px(x, top, n(1));
        for (let y = top + 1; y < ground; y++)
          px(x, y, y - top < 2 ? n(2) : (x * 3 + y * 5) % 23 === 0 || bayer(x, y) > 0.96 ? n(1) : n(2));
      }
      const tree = (tx) => {
        const ty = ground - hill(tx);
        for (let y = 0; y < 5; y++) {
          px(tx, ty - y, n(0));
          px(tx + 1, ty - y, n(0));
        }
        for (let y = -6; y <= 6; y++)
          for (let x = -6; x <= 6; x++) {
            const d = x * x + y * y;
            if (d > 36) continue;
            px(tx + x, ty - 10 + y, d > 25 ? n(0) : x + y < -3 && bayer(tx + x, y) > 0.4 ? n(2) : n(1));
          }
      };
      for (const tx of [14, 30, 96, 108, 168, 230, 244]) tree(tx);
      // castle on the big hill
      const cx = 60,
        cb = ground - hill(cx) + 2;
      const block = (x0, y0, w0, h0) => {
        for (let y = 0; y < h0; y++)
          for (let x = 0; x < w0; x++)
            px(
              x0 + x,
              y0 + y,
              x === 0 || y === 0 || x === w0 - 1
                ? n(0)
                : y % 4 === 0 && (x + Math.floor(y / 4) * 2) % 4 === 0
                  ? n(0)
                  : n(1),
            );
      };
      block(cx - 14, cb - 18, 28, 18);
      block(cx - 18, cb - 28, 8, 28);
      block(cx + 10, cb - 28, 8, 28);
      block(cx - 4, cb - 34, 8, 16);
      for (const [bx, by, bw] of [
        [cx - 18, cb - 30, 8],
        [cx + 10, cb - 30, 8],
        [cx - 4, cb - 36, 8],
        [cx - 14, cb - 20, 28],
      ])
        for (let x = 0; x < bw; x += 2) {
          px(bx + x, by, n(0));
          px(bx + x, by + 1, n(0));
        }
      for (let y = 0; y < 6; y++) px(cx, cb - 42 + y, n(0));
      for (let y = 0; y < 3; y++) for (let x = 1; x < 5; x++) px(cx + x, cb - 42 + y, 0);
      for (let y = 0; y < 7; y++)
        for (let x = -3; x <= 3; x++) if (y > 2 || x * x + (3 - y) ** 2 <= 9) px(cx + x, cb - 7 + y, 0);
      for (const [wx, wy] of [
        [cx - 15, cb - 22],
        [cx + 13, cb - 22],
        [cx - 1, cb - 28],
        [cx - 9, cb - 12],
        [cx + 7, cb - 12],
      ])
        for (let y = 0; y < 3; y++) {
          px(wx, wy + y, night ? 3 : 0);
          px(wx + 1, wy + y, night ? 3 : 0);
        }
      // cottages
      for (const hx of [130, 196]) {
        const hb = ground - hill(hx) + 1;
        for (let y = 0; y < 9; y++)
          for (let x = 0; x < 14; x++) px(hx + x, hb - 9 + y, x === 0 || x === 13 || y === 8 ? n(0) : night ? 1 : 3);
        for (let y = 0; y < 7; y++)
          for (let x = 5 - y; x <= 8 + y; x++)
            px(hx + x, hb - 16 + y, y === 6 || x === 6 - y - 1 || x === 7 + y + 1 ? n(0) : n(1));
        for (let y = 0; y < 3; y++) {
          px(hx + 3, hb - 6 + y, night ? 3 : 0);
          px(hx + 4, hb - 6 + y, night ? 3 : 0);
        }
        for (let y = 0; y < 5; y++) {
          px(hx + 9, hb - 5 + y, n(0));
          px(hx + 10, hb - 5 + y, n(0));
        }
        for (let y = 0; y < 4; y++) {
          px(hx + 10, hb - 18 + y, n(0));
          px(hx + 11, hb - 18 + y, n(0));
        }
      }
    });
    // ground: grass edge, bricks below; floating brick platforms; bushes, a fence and a signpost
    const near = strip(period, H, (px) => {
      for (let x = 0; x < period; x++) {
        px(x, ground - 1, n(0));
        const tuft = (x * 7) % 11 < 3;
        if (tuft) px(x, ground - 2, n(0));
        for (let y = ground; y < H; y++) {
          const by = y - ground,
            row = Math.floor(by / 6),
            bx = (x + (row % 2) * 6) % 12;
          let i = by < 3 ? 2 : by % 6 === 0 || bx === 0 ? 0 : 1;
          if (by >= 3 && i === 1 && bx < 3 && by % 6 < 3) i = 2;
          px(x, y, i === 2 ? (night ? 1 : 2) : n(i));
        }
      }
      for (const pl of w.plats)
        for (let k = 0; k < pl.n; k++) {
          const x0 = pl.x + k * 8;
          for (let y = 0; y < 8; y++)
            for (let x = 0; x < 8; x++)
              px(
                x0 + x,
                pl.y + y,
                x === 0 || y === 0 || x === 7 || y === 7
                  ? 0
                  : y === 4 || (y < 4 ? x === 4 : x === 2)
                    ? 0
                    : x + y < 5
                      ? night
                        ? 1
                        : 2
                      : n(1),
              );
        }
      const bush = (bx0) => {
        for (let y = -5; y <= 0; y++)
          for (let x = -9; x <= 9; x++) {
            const ok =
              (x + 4) ** 2 + (y * 1.6) ** 2 < 25 ||
              (x - 4) ** 2 + (y * 1.6) ** 2 < 25 ||
              x * x + ((y + 2) * 1.6) ** 2 < 30;
            if (ok) px(bx0 + x, ground - 1 + y, n(1));
          }
      };
      for (const bx0 of [24, Math.round(period * 0.55), Math.round(period * 0.83)]) bush(bx0);
      const fx = Math.round(period * 0.15);
      for (let k = 0; k < 5; k++) {
        for (let y = 0; y < 8; y++) px(fx + k * 5, ground - 2 - y, n(0));
      }
      for (const fy of [ground - 5, ground - 8]) for (let x = 0; x < 21; x++) px(fx + x, fy, n(0));
      const sx = Math.round(period * 0.7);
      for (let y = 0; y < 10; y++) px(sx + 3, ground - 2 - y, n(0));
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 9; x++)
          px(
            sx + x - 1,
            ground - 13 + y,
            x === 0 || y === 0 || x === 8 || y === 4 ? 0 : y === 2 && x > 1 && x < 7 ? 0 : 3,
          );
    });
    // foreground: dark bush silhouettes along the bottom edge, scrolling fastest
    const fore = strip(period, H, (px) => {
      for (let x = 0; x < period; x++) {
        const hgt = Math.round(
          4 +
            Math.abs(Math.sin(x * 0.09)) * 7 +
            Math.abs(Math.sin(x * 0.23 + 1)) * 3 -
            (Math.sin(x * 0.031) > 0.5 ? 9 : 0),
        );
        for (let y = H - hgt; y < H; y++) px(x, y, y === H - hgt ? 1 : 0);
        if (hgt > 6 && x % 7 === 0) px(x, H - hgt + 2, 1);
      }
    });
    return { far, mid, near, fore };
  }

  function background(g, w, e) {
    const { W, H } = w;
    // banded sky in the four shades: light by day, dark at night, banded through dawn and dusk
    let top, bot;
    if (e.day > 0.75) {
      top = 2.4;
      bot = 3.6;
    } else if (e.day < 0.25) {
      top = 0;
      bot = 1.2;
    } else {
      top = 1;
      bot = 3.6;
    }
    if (e.wx.grey > 0.4 && !e.night) {
      top = 2;
      bot = 2.7;
    }
    for (let y = 0; y < H; y++) {
      const v = top + (bot - top) * Math.min(1, y / (w.ground - 10));
      for (let x = 0; x < W; x++) {
        const i = Math.floor(v),
          f = v - i;
        g.fillStyle = P[Math.min(3, f > bayer(x, y) ? i + 1 : i)];
        g.fillRect(x, y, 1, 1);
      }
    }
  }

  const HERO = [
    [
      "....00000...",
      "...0111110..",
      "..011111110.",
      "...0333030..",
      "...0333330..",
      "....03330...",
      "...0111110..",
      "..031111130.",
      "..03111113..",
      "...0222220..",
      "...00...00..",
      "..000...000.",
    ],
    [
      "....00000...",
      "...0111110..",
      "..011111110.",
      "...0333030..",
      "...0333330..",
      "....03330...",
      "...0111110..",
      "...0311130..",
      "...0311130..",
      "...0222220..",
      "....00000...",
      ".....000....",
    ],
  ];
  const JUMP = [
    "..3.00000.3.",
    "..00111110..",
    "..011111110.",
    "...0333030..",
    "...0333330..",
    "....03330...",
    "...0111110..",
    "...0111110..",
    "...0222220..",
    "..000...00..",
    "..00.....00.",
    "............",
  ];
  const CRIT = [
    ["..0000..", ".011110.", "01311310", "01011010", "01111110", ".000000.", ".0....0."],
    ["..0000..", ".011110.", "01311310", "01011010", "01111110", ".000000.", "..0..0.."],
  ];
  const COIN = [
    [".00.", "0230", "0230", "0230", "0230", ".00."],
    [".0.", "023", "023", "023", "023", ".0."],
    ["0", "0", "0", "0", "0", "0"],
    [".0.", "032", "032", "032", "032", ".0."],
  ];
  const pal4 = { 0: P[0], 1: P[1], 2: P[2], 3: P[3] };

  function sky(c, w, e, s) {
    const { W, ground } = w,
      night = e.night;
    // stars twinkle at night
    if (night && e.wx.clouds < 0.8)
      for (const [px, py, p] of w.stars)
        if (Math.sin(s * (0.6 + p) + p * 40) > -0.2) {
          c.fillStyle = p > 0.8 ? P[3] : P[2];
          c.fillRect(Math.round(px * W), Math.round(py * ground), 1, 1);
        }
    // the sun (a ringed disc) or the moon with its real phase
    if (e.wx.clouds < 0.85) {
      const t = night ? e.moon : e.sun,
        x = Math.round(W * (0.1 + 0.8 * Math.max(0, Math.min(1, t)))),
        y = Math.round(ground - 30 - Math.sin(Math.max(0, Math.min(1, t)) * Math.PI) * (ground - 50));
      if (night) {
        const ph = e.moonPhase ?? 0.5;
        for (let yy = -6; yy <= 6; yy++)
          for (let xx = -6; xx <= 6; xx++) {
            if (xx * xx + yy * yy > 36) continue;
            const term = Math.sqrt(36 - yy * yy) * Math.cos(ph * 2 * Math.PI);
            c.fillStyle = (ph < 0.5 ? xx >= term : xx <= -term) || Math.abs(ph - 0.5) < 0.04 ? P[3] : P[1];
            c.fillRect(x + xx, y + yy, 1, 1);
          }
      } else {
        c.fillStyle = P[1];
        for (let a = 0; a < 8; a++) {
          const an = (a * Math.PI) / 4 + s * 0.3;
          for (let k = 10; k < 13; k++)
            c.fillRect(Math.round(x + Math.cos(an) * k), Math.round(y + Math.sin(an) * k), 1, 1);
        }
        for (let yy = -7; yy <= 7; yy++)
          for (let xx = -7; xx <= 7; xx++) {
            const d = xx * xx + yy * yy;
            if (d <= 49) {
              c.fillStyle = d > 36 ? P[1] : P[3];
              c.fillRect(x + xx, y + yy, 1, 1);
            }
          }
      }
    }
    // clouds drift by: puffy, outlined
    const nC = Math.min(w.clouds.length, Math.round(2 + e.wx.clouds * 3.5));
    for (let i = 0; i < nC; i++) {
      const cl = w.clouds[i],
        cw = cl.w * (1 + e.wx.grey * 0.6),
        x0 = Math.round(((cl.x * (W + 60) + s * (1.5 + i * 0.4)) % (W + 60)) - 50),
        y0 = Math.round(cl.y);
      for (let x = 0; x < cw; x++) {
        const hh = Math.round(Math.sin((x / cw) * Math.PI) * cw * 0.25 + Math.sin(x * 0.5) * 1.2);
        for (let y = -hh; y <= 2; y++) {
          c.fillStyle = y === -hh || y === 2 ? P[night ? 0 : 1] : P[night ? 1 : 3];
          c.fillRect(x0 + x, y0 + y, 1, 1);
        }
      }
    }
    // a few birds by day
    if (!night && e.wx.rain === 0)
      for (let i = 0; i < 3; i++) {
        const bx = Math.round(((s * 9 + i * 23) % (W + 40)) - 20),
          by = Math.round(30 + i * 5 + Math.sin(s * 2 + i) * 2),
          fl = Math.floor(s * 4 + i) % 2;
        c.fillStyle = P[0];
        c.fillRect(bx - 1, by - fl, 1, 1);
        c.fillRect(bx, by, 1, 1);
        c.fillRect(bx + 1, by - fl, 1, 1);
      }
  }

  function frame(c, w, e, s) {
    const { W, H, ground, period } = w,
      night = e.night;
    const key = night ? "n" : "d";
    if (w.key !== key) {
      w.strips = makeStrips(w, night);
      w.key = key;
    }
    const { far, mid, near, fore } = w.strips;
    const tile = (img, per, off) => {
      const o = ((off % per) + per) % per;
      for (let x = -o; x < W; x += per) c.drawImage(img, Math.round(x), 0);
    };
    const run = s * 14;
    tile(far, 192, run * 0.12);
    if (e.wx.fog) {
      c.fillStyle = P[night ? 1 : 2];
      for (let y = ground - 40; y < ground - 8; y++)
        for (let x = 0; x < W; x++) if (bayer(x, y) < 0.5) c.fillRect(x, y, 1, 1);
    }
    // a bank of mist between the far mountains and the hills, in dither
    w.mists ||= {};
    const mk = night ? "n" : "d";
    w.mists[mk] ||= mist(W, 14, PAL[night ? 1 : 3], 0.75, 1, 41);
    {
      const ox = -Math.round((run * 0.2) % W);
      c.drawImage(w.mists[mk], ox, ground - 46);
      c.drawImage(w.mists[mk], ox + W, ground - 46);
    }
    tile(mid, 256, run * 0.35);
    tile(near, period, run);
    // leaves blowing past by day, fireflies blinking by night
    w.leaves ||= Array.from({ length: Math.round(W / 14) }, (_, i) => [hash(i, 1), hash(i, 2), hash(i, 3)]);
    if (!e.wx.rain && !e.wx.snow)
      motes(
        c,
        w.leaves,
        s,
        [0, 0, W, ground],
        night ? { col: P[3], vx: -4, vy: -1, wob: 3, blink: 1.2 } : { col: P[1], vx: -18, vy: 6, wob: 3, size: 1 },
      );
    // coins: bob and spin; the hero picks up the ones they pass
    const hx = Math.round(W * 0.28);
    for (const cn of w.coins) {
      const sx = Math.round((((cn.x - run) % period) + period) % period);
      if (sx > W + 4) continue;
      if (sx < hx + 2 && sx > hx - 40) continue;
      const f = COIN[Math.floor(s * 8 + cn.x) % 4];
      RS_PX.sprite(c, f, sx + (4 - f[0].length) / 2, cn.y + Math.round(Math.sin(s * 3 + cn.x) * 1), pal4);
    }
    // critters: walk left a little faster than the ground scrolls; the hero hops over each one
    let jump = 0;
    for (const cr of w.critters) {
      const sx = Math.round((((cr.x - run - s * cr.sp) % period) + period) % period) - 16;
      if (sx < -10 || sx > W + 2) continue;
      RS_PX.sprite(c, CRIT[Math.floor(s * 4 + cr.x) % 2], sx, ground - 8, pal4);
      const d = sx - hx;
      if (d > -12 && d < 18) jump = Math.max(jump, Math.sin((Math.PI * (18 - d)) / 30));
    }
    const hy = ground - 13 - Math.round(jump * 22);
    RS_PX.sprite(c, jump > 0.05 ? JUMP : HERO[Math.floor(s * 8) % 2], hx, hy, pal4);
    if (jump < 0.05 && Math.floor(s * 8) % 4 === 0) {
      c.fillStyle = P[1];
      c.fillRect(hx - 2, ground - 2, 1, 1);
    }
    // a flapping critter crossing the sky now and then
    {
      const per = 24,
        t = (s % per) / per;
      if (t < 0.6) {
        const x = Math.round(W + 10 - (t / 0.6) * (W + 30)),
          y = Math.round(ground - 46 + Math.sin(s * 3) * 4),
          up = Math.floor(s * 6) % 2;
        RS_PX.sprite(
          c,
          up
            ? ["0.....0", "00...00", ".00000.", "..030..", "...0..."]
            : [".......", "0000000", ".00000.", "..030..", "...0..."],
          x,
          y,
          pal4,
        );
      }
    }
    // the foreground bushes sweep past
    {
      const o = (((run * 1.6) % period) + period) % period;
      for (let x = -o; x < W; x += period) c.drawImage(fore, Math.round(x), 0);
    }
    // weather
    if (e.wx.rain) {
      c.fillStyle = P[night ? 2 : 1];
      const n = Math.round(w.drops.length * Math.min(1, e.wx.rain + 0.2));
      for (let i = 0; i < n; i++) {
        const [px, py, sp] = w.drops[i],
          y = Math.round((py * H + s * 90 * sp) % H),
          x = Math.round((px * (W + 30) - y * 0.4) % (W + 30));
        c.fillRect(x, y, 1, 1);
        c.fillRect(x - 1, y + 2, 1, 1);
        c.fillRect(x - 1, y + 3, 1, 1);
      }
    }
    if (e.wx.snow) {
      c.fillStyle = P[3];
      for (const [px, py, sp] of w.drops) {
        const y = Math.round((py * H + s * 12 * sp) % H),
          x = Math.round(px * W + Math.sin(s + py * 20) * 3);
        c.fillRect(x, y, 1, 1);
      }
    }
    if (e.wx.thunder && s % 9 < 0.15) {
      c.fillStyle = P[3];
      c.fillRect(0, 0, W, H);
    }
  }

  RS_SCENE.register("pocket", { short: 144, fps: 12, build, background, sky, frame });
})();
