"use strict";

// Neon City: rainy megacity street. The wet street reflects the land layer.
(() => {
  const { Buf, canvas, mist, ramp, bayer, hash, H_, mix, css, skyRamp, toner, ridge, glowSprite, shade, sprite } =
    RS_PX;
  const { rng } = RS_SCENE;
  const PINK = [255, 50, 150],
    CYAN = [40, 225, 255],
    YEL = [255, 220, 60],
    RED = [255, 60, 70],
    VIO = [180, 100, 255],
    ORA = [255, 150, 50],
    GRN = [80, 255, 160];
  const NEON = [PINK, CYAN, YEL, RED, VIO, ORA, GRN];
  const SKY = {
    night: H_(["#06020e", "#10051f", "#220833", "#3c0d42", "#5e1448", "#7c2050"]),
    day: H_(["#4a3a3a", "#6a4a3c", "#8c5c3c", "#a86e40", "#c08048", "#cc9050"]),
    warm: H_(["#24143e", "#4c1e52", "#90305a", "#d0505a", "#f07a4e", "#ffa850"]),
    grey: H_(["#2e2a36", "#3a3440", "#46404a", "#544a52", "#62565a", "#6e6060"]),
  };

  // made-up glyphs: 3x5 bitmaps, random but fixed, so signs read as text in no real language
  const GLYPHS = (() => {
    const r = rng(404),
      out = [];
    for (let i = 0; i < 40; i++) {
      const b = [];
      for (let k = 0; k < 15; k++) b.push(r() < (k % 3 === 1 ? 0.6 : 0.45) ? 1 : 0);
      b[1] = b[13] = 1;
      out.push(b);
    }
    return out;
  })();

  const RAIL_UP = 7; // rows above the rail the maglev takes up

  function build(W, H) {
    const r = rng(2077),
      gy = Math.round(H * 0.84);
    const fgL = Math.round(Math.min(48, W * 0.13)),
      fgR = Math.round(Math.min(52, W * 0.14));
    const far2 = ridge(r, W, [
        [18, 1],
        [7, 0.5],
      ]),
      far1 = [];
    for (let x = 0; x < W;) {
      const w = 6 + Math.floor(r() * 12),
        top = Math.round(gy * (0.24 + r() * 0.3));
      far1.push({ x, w, top, ant: r() < 0.3 });
      x += w + Math.floor(r() * 2);
    }
    const tower = { x: Math.round(W * 0.6), w: 36, top: Math.round(gy * 0.05) };
    // mid buildings, packed between the foreground frames
    const mids = [];
    for (let x = fgL - 6; x < W - fgR + 6;) {
      const w = 18 + Math.floor(r() * 22),
        top = Math.round(gy * (0.36 + r() * 0.3));
      mids.push({
        x,
        w,
        top,
        col: [
          [92, 88, 104],
          [80, 88, 102],
          [104, 94, 96],
          [74, 78, 96],
          [96, 84, 110],
        ][Math.floor(r() * 5)],
        tank: r() < 0.35,
        ac: Math.floor(r() * 3),
        dish: r() < 0.3,
        ant: r() < 0.5,
        seed: r(),
      });
      x += w + Math.floor(r() * 4) - 1;
    }
    // signs: on mid buildings (vertical banners and horizontal boards) and on the foreground frames
    const signs = [];
    for (const m of mids) {
      if (r() < 0.75) {
        const vert = r() < 0.6,
          col = NEON[Math.floor(r() * NEON.length)];
        const n = vert ? 3 + Math.floor(r() * 4) : 2 + Math.floor(r() * 3);
        const sw = vert ? 7 : n * 4 + 3,
          sh = vert ? n * 6 + 3 : 9;
        signs.push({
          x: m.x + (r() < 0.5 ? 2 : m.w - sw - 2),
          y: m.top + 6 + Math.floor(r() * Math.max(1, gy - m.top - sh - 34)),
          w: sw,
          h: sh,
          vert,
          n,
          col,
          g0: Math.floor(r() * 40),
          fl: r() < 0.25 ? r() * 10 : -1,
        });
      }
    }
    signs.push({
      x: W - fgR - 4,
      y: Math.round(gy * 0.16),
      w: 9,
      h: 7 * 6 + 3,
      vert: true,
      n: 7,
      col: PINK,
      g0: 7,
      fl: 3,
      big: true,
      fg: true,
    });
    signs.push({
      x: fgL - 4,
      y: Math.round(gy * 0.42),
      w: 7,
      h: 4 * 6 + 3,
      vert: true,
      n: 4,
      col: CYAN,
      g0: 21,
      fl: -1,
      fg: true,
    });
    signs.push({
      x: W - fgR + 8,
      y: Math.round(gy * 0.62),
      w: 4 * 3 + 3,
      h: 9,
      vert: false,
      n: 3,
      col: YEL,
      g0: 30,
      fl: -1,
      fg: true,
    });
    const bridges = [];
    for (let i = 0; i < mids.length - 1; i++)
      if (r() < 0.22) {
        const a = mids[i],
          b = mids[i + 1];
        const y = Math.max(a.top, b.top) + 10 + Math.floor(r() * 16);
        if (y < gy - 40) bridges.push({ x0: a.x + a.w - 2, x1: b.x + 2, y });
      }
    const hwy = gy - 30,
      rail = Math.round(gy * 0.52);
    const lanes = [
      { y: Math.round(gy * 0.2), sz: 0, sp: 9, n: 7 },
      { y: Math.round(gy * 0.33), sz: 1, sp: 16, n: 5 },
      { y: Math.round(gy * 0.12), sz: 2, sp: 30, n: 3 },
    ];
    const cars = [];
    for (const [li, L] of lanes.entries())
      for (let i = 0; i < L.n; i++)
        cars.push({
          li,
          x: r() * (W + 60),
          dir: r() < 0.5 ? 1 : -1,
          dy: Math.floor(r() * 7) - 3,
          col: [
            [200, 60, 110],
            [60, 110, 200],
            [180, 180, 196],
            [220, 180, 60],
            [90, 70, 160],
          ][Math.floor(r() * 5)],
        });
    const people = Array.from({ length: Math.max(4, Math.round(W / 50)) }, () => ({
      x: r() * W,
      dir: r() < 0.5 ? 1 : -1,
      sp: 2 + r() * 3,
      y: gy + 9 + Math.floor(r() * (H - gy - 14)),
      col: NEON[Math.floor(r() * NEON.length)],
      coat: [
        [40, 36, 50],
        [60, 40, 44],
        [36, 44, 60],
      ][Math.floor(r() * 3)],
    }));
    const vents = [Math.round(W * 0.32), Math.round(W * 0.71)];
    const drops = Array.from({ length: Math.round((W * H) / 220) }, () => [r(), r(), 0.7 + r() * 0.6]);
    const lanterns = Array.from({ length: 7 }, (_, i) => ({ t: (i + 0.5) / 7, col: i % 2 ? RED : ORA }));
    return {
      W,
      H,
      gy,
      fgL,
      fgR,
      far1,
      far2,
      tower,
      mids,
      signs,
      bridges,
      hwy,
      rail,
      lanes,
      cars,
      people,
      vents,
      drops,
      lanterns,
      r,
      glows: {},
    };
  }

  function background(g, w, e) {
    const { W, H, gy } = w,
      b = new Buf(g, W, H),
      sky = skyRamp(e, SKY);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b.px(x, y, ramp(sky, y / gy, x, y, 0.3));
    // the moon, a smudge through the smog
    if (e.night && e.wx.clouds < 0.8) {
      const mx = Math.round(W * 0.3),
        my = Math.round(gy * 0.16);
      for (let y = -7; y <= 7; y++)
        for (let x = -7; x <= 7; x++) {
          const d = x * x + y * y;
          if (d <= 30) b.px(mx + x, my + y, [236, 214, 230], d > 22 ? 0.6 : 0.9);
          else if (d < 70 && bayer(x, y) < 0.3) b.px(mx + x, my + y, [200, 120, 170], 0.4);
        }
    }
    // smog clouds, underlit by the city: banded, pink/orange beneath, dark above
    const r = rng(9),
      n = 4 + Math.round(e.wx.clouds * 6);
    for (let i = 0; i < n; i++) {
      const cx = r() * W,
        cy = gy * (0.08 + r() * 0.38),
        cw = 40 + r() * 70,
        ch = 4 + r() * 6;
      for (let y = -ch; y <= ch; y++)
        for (let x = -cw; x <= cw; x++) {
          const d = (x / cw) ** 2 + (y / ch) ** 2 + Math.sin(x * 0.3 + i) * 0.08;
          if (d > 1) continue;
          const under = (y + ch) / (2 * ch);
          const col =
            e.day > 0.5 ? mix([120, 84, 64], [206, 148, 96], under) : mix([30, 14, 40], [150, 50, 100], under * under);
          if (d < 0.8 || bayer(x, y) > (d - 0.8) * 5) b.px(cx + x, cy + y, col, 0.9);
        }
    }
    b.put(g);
  }

  // window colour for a lit window
  const WIN = [
    [255, 200, 120],
    [120, 230, 255],
    [230, 230, 255],
    [255, 140, 200],
    [255, 230, 160],
  ];

  function land(g, w, e) {
    const { W, H, gy, fgL, fgR, tower: T, rail, hwy } = w,
      b = new Buf(g, W, H),
      tone = toner(e, 0.85),
      night = e.day < 0.5;
    const r = rng(77),
      lit = night ? 0.42 : 0.08;
    const hash = (a, b2) => {
      const v = Math.sin(a * 12.9898 + b2 * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    // a window is lit if its floor is busy enough; each building keeps one or two light colours
    const winCol = (x, y, id = 0, fl = y >> 2, wi = x >> 1) => {
      const occ = hash(id * 7.1, fl * 3.3);
      if (hash(wi + id * 31, fl) > occ * lit * 2.2) return null;
      return WIN[(Math.floor(hash(id, 1) * 5) + (hash(wi, fl * 9) < 0.15 ? 1 : 0)) % WIN.length];
    };
    const dayWin = tone([150, 168, 186]);
    // far skyline 2: a hazy ridge of towers
    const haze = tone(e.day > 0.5 ? [150, 108, 80] : [70, 30, 80]);
    for (let x = 0; x < W; x++) {
      const top = Math.round(gy * 0.42 + (1 - w.far2[x]) * gy * 0.2);
      for (let y = top; y < gy; y++)
        b.px(x, y, (y * 3 + x * 7) % 11 === 0 && night && (x + y) % 4 === 0 ? [200, 120, 160] : haze);
    }
    // far skyline 1: thin towers with window specks and antennae
    for (const t of w.far1) {
      const base = tone([66, 62, 82]);
      for (let y = t.top; y < gy; y++)
        for (let x = t.x; x < t.x + t.w; x++) {
          let c = x === t.x ? shade(base, 0.12) : base;
          if ((x - t.x) % 2 === 1 && (y - t.top) % 3 === 1 && x < t.x + t.w - 1) {
            const wc = winCol(x, y, t.x, ((y - t.top) / 3) | 0, x);
            c = wc ? mix(wc, base, 0.35) : night ? c : mix(c, dayWin, 0.4);
          }
          b.px(x, y, c);
        }
      if (t.ant) for (let y = 0; y < 8; y++) b.px(t.x + (t.w >> 1), t.top - y, tone([50, 50, 60]));
    }
    // the megatower: stepped tiers with light bands and a spire
    const tb = tone([60, 56, 84]);
    const tiers = [
      [T.w + 16, gy * 0.62],
      [T.w + 6, gy * 0.38],
      [T.w, gy * 0.14],
      [T.w - 14, T.top + 4],
    ];
    tiers.forEach(([tw, ty], i) => {
      const x0 = T.x - (tw >> 1),
        y0 = Math.round(ty);
      for (let y = y0; y < gy; y++)
        for (let x = x0; x < x0 + tw; x++) {
          const rel = x - x0;
          let c = rel < 2 ? shade(tb, 0.15) : rel > tw - 4 ? shade(tb, -0.35) : tb;
          if ((y - y0) % 4 === 2 && rel > 2 && rel < tw - 3 && rel % 3) {
            const wc = winCol(x, y, 900 + i, (y - y0) >> 2, (rel / 3) | 0);
            c = wc ? mix(wc, c, 0.25) : night ? shade(c, -0.1) : mix(c, dayWin, 0.5);
          }
          if (y === y0 || y === y0 + 1) c = night ? [255, 80, 170] : shade(c, 0.2); // light band on each step
          b.px(x, y, c);
        }
    });
    for (let y = 0; y < 14; y++) b.px(T.x, T.top - 10 + y, tone([90, 90, 110]));
    w.holo = { x: T.x - 22, y: Math.round(gy * 0.17), w: 44, h: 26 };
    // smog: the far city fades into a lit haze, thicker low down
    const smog = night ? [120, 40, 110] : skyRamp(e, SKY)[5];
    for (let y = 0; y < gy; y++) {
      const a = 0.08 + 0.32 * (y / gy) ** 2;
      for (let x = 0; x < W; x++) if (b.d[(y * W + x) * 4 + 3]) b.px(x, y, smog, a);
    }
    // maglev rail on pylons
    for (let x = 0; x < W; x++) {
      b.px(x, rail, tone([110, 110, 130]));
      b.px(x, rail + 1, tone([50, 50, 66]));
    }
    for (let x = 20; x < W; x += 56)
      for (let y = rail + 2; y < gy; y++) {
        b.px(x, y, tone([56, 56, 72]));
        b.px(x + 1, y, tone([40, 40, 54]));
      }
    // copy the strip the maglev runs along before the nearer buildings get drawn over it
    const band0 = rail - RAIL_UP,
      bandH = RAIL_UP + 2,
      before = b.d.slice(band0 * W * 4, (band0 + bandH) * W * 4);
    // mid buildings
    for (const m of w.mids) {
      const base = tone(m.col),
        rr = rng(Math.floor(m.seed * 1e6));
      const wStep = 3 + (Math.floor(m.seed * 3) % 2),
        hStep = 4;
      for (let y = m.top; y < gy; y++)
        for (let x = m.x; x < m.x + m.w; x++) {
          const rel = x - m.x;
          let c = ramp([shade(base, 0.08), base, shade(base, -0.2)], (y - m.top) / (gy - m.top), x, y, 0.4);
          if (rel === 0) c = shade(base, 0.25);
          else if (rel >= m.w - 2) c = shade(base, -0.4);
          const wx = (rel - 2) % wStep,
            wy = (y - m.top - 4) % hStep;
          if (rel > 1 && rel < m.w - 3 && y > m.top + 3 && y < gy - 6 && wx < wStep - 1 && wy < 2) {
            const wc = winCol(x, y, m.x, ((y - m.top - 4) / hStep) | 0, ((rel - 2) / wStep) | 0);
            c = wc
              ? wy === 0
                ? wc
                : mix(wc, c, 0.35)
              : night
                ? shade(c, -0.35)
                : mix(c, dayWin, wy === 0 ? 0.6 : 0.3);
          }
          // night: neon rim light up the left edge
          if (night && rel === 1) c = mix(c, NEON[(m.x >> 3) % NEON.length], 0.45);
          b.px(x, y, c);
        }
      for (let x = m.x - 1; x <= m.x + m.w; x++) {
        b.px(x, m.top - 1, shade(base, -0.3));
        b.px(x, m.top, shade(base, 0.3));
      } // parapet
      // roof furniture
      if (m.tank) {
        const tx = m.x + 3 + Math.floor(rr() * Math.max(1, m.w - 12));
        for (let y = 0; y < 7; y++)
          for (let x = 0; x < 7; x++)
            b.px(
              tx + x,
              m.top - 9 + y,
              x === 0
                ? tone([120, 90, 70])
                : x === 6
                  ? tone([60, 44, 36])
                  : y === 0
                    ? tone([130, 100, 76])
                    : tone([96, 72, 56]),
            );
        for (const lx of [tx + 1, tx + 5]) {
          b.px(lx, m.top - 2, tone([40, 40, 46]));
          b.px(lx, m.top - 1, tone([40, 40, 46]));
        }
      }
      for (let i = 0; i < m.ac; i++) {
        const ax = m.x + 2 + Math.floor(rr() * Math.max(1, m.w - 7));
        for (let y = 0; y < 3; y++)
          for (let x = 0; x < 5; x++)
            b.px(ax + x, m.top - 4 + y, y === 0 ? tone([150, 150, 160]) : tone([100, 100, 112]));
        b.px(ax + 1, m.top - 3, tone([50, 50, 56]));
        b.px(ax + 2, m.top - 3, tone([50, 50, 56]));
      }
      if (m.dish) {
        const dx = m.x + m.w - 7;
        for (let k = 0; k < 5; k++) b.px(dx + k, m.top - 5 + Math.abs(k - 2) * 0.6, tone([190, 190, 200]));
        b.px(dx + 2, m.top - 3, tone([90, 90, 100]));
        b.px(dx + 2, m.top - 2, tone([90, 90, 100]));
      }
      if (m.ant) {
        const ax = m.x + Math.floor(m.w * 0.3);
        for (let y = 0; y < 12; y++) b.px(ax, m.top - 1 - y, tone([70, 70, 84]));
        m.antTop = [ax, m.top - 13];
      }
    }
    // sky bridges with lit windows
    for (const br of w.bridges)
      for (let x = br.x0; x < br.x1; x++)
        for (let y = 0; y < 5; y++)
          b.px(
            x,
            br.y + y,
            y === 0
              ? tone([150, 150, 170])
              : y === 4
                ? tone([40, 40, 54])
                : x % 3 && y === 2
                  ? night
                    ? [180, 240, 255]
                    : dayWin
                  : tone([80, 80, 100]),
          );
    // signs: dark box, neon border, glyphs, a dithered glow around (lit even by day)
    const drawSign = (s) => {
      const C = s.col,
        gR = s.big ? 10 : 6;
      for (let y = -gR; y < s.h + gR; y++)
        for (let x = -gR; x < s.w + gR; x++) {
          const dx = x < 0 ? -x : x >= s.w ? x - s.w + 1 : 0,
            dy = y < 0 ? -y : y >= s.h ? y - s.h + 1 : 0,
            d = Math.sqrt(dx * dx + dy * dy) / gR;
          if ((dx || dy) && d < 1 && (1 - d) * (night ? 0.55 : 0.25) > bayer(s.x + x, s.y + y))
            b.px(s.x + x, s.y + y, C, 0.35);
        }
      for (let y = 0; y < s.h; y++)
        for (let x = 0; x < s.w; x++)
          b.px(
            s.x + x,
            s.y + y,
            x === 0 || y === 0 || x === s.w - 1 || y === s.h - 1 ? mix(C, [255, 255, 255], 0.3) : [14, 8, 22],
          );
      for (let k = 0; k < s.n; k++) {
        const gb = GLYPHS[(s.g0 + k) % 40],
          gx = s.vert ? s.x + ((s.w - 3) >> 1) : s.x + 2 + k * 4,
          gyy = s.vert ? s.y + 2 + k * 6 : s.y + 2;
        for (let i = 0; i < 15; i++) if (gb[i]) b.px(gx + (i % 3), gyy + Math.floor(i / 3), C);
      }
    };
    for (const sg of w.signs) if (!sg.fg) drawSign(sg);
    // elevated highway: deck, rail, pillars, under-lights
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < 6; y++)
        b.px(
          x,
          hwy + y,
          y === 0
            ? tone([150, 150, 160])
            : y === 1
              ? tone([90, 90, 100])
              : y === 5
                ? tone([30, 30, 40])
                : tone([64, 64, 76]),
        );
      if (x % 4 === 0) b.px(x, hwy - 1, tone([120, 120, 130]));
    }
    for (let x = 30; x < W; x += 64)
      for (let y = hwy + 6; y < gy; y++)
        for (let k = 0; k < 4; k++)
          b.px(x + k, y, k === 0 ? tone([100, 100, 110]) : k === 3 ? tone([36, 36, 46]) : tone([66, 66, 78]));
    if (night)
      for (let x = 12; x < W; x += 24) {
        b.px(x, hwy + 6, [255, 210, 140]);
        for (let y = 7; y < 16; y++)
          if (bayer(x, y) < 0.5 - (y - 7) * 0.05) {
            b.px(x - 1 + (y & 1), hwy + y, [255, 200, 120], 0.25);
          }
      }
    // light from the street hanging in the wet air: pink and cyan at night, amber by day
    const g0 = hwy - 26;
    for (let y = g0; y < gy; y++) {
      const a = (night ? 0.32 : 0.18) * ((y - g0) / (gy - g0)) ** 1.6;
      for (let x = 0; x < W; x++)
        if (b.d[(y * W + x) * 4 + 3])
          b.px(x, y, night ? mix([255, 60, 170], [40, 200, 255], 0.5 + 0.5 * Math.sin(x * 0.025)) : [230, 160, 100], a);
    }
    // foreground frames: dark, big windows, fire escapes
    const fgCol = tone([40, 34, 50]);
    for (const [x0, x1, left] of [
      [0, fgL, true],
      [W - fgR, W, false],
    ]) {
      for (let y = 0; y < gy + 2; y++)
        for (let x = x0; x < x1; x++) {
          const rel = left ? x1 - 1 - x : x - x0;
          let c = rel === 0 ? shade(fgCol, left ? -0.3 : 0.3) : fgCol;
          if ((y + (rel >> 2)) % 3 === 0 && x & 1) c = shade(fgCol, -0.12); // brick courses
          const wy = y % 14,
            wx = rel % 12;
          if (wy < 9 && wy > 1 && wx > 2 && wx < 9 && rel > 2) {
            const on = night && hash(Math.floor(rel / 12) + (left ? 0 : 50), Math.floor(y / 14)) < 0.35;
            if (wx === 3 || wx === 8 || wy === 2)
              c = shade(fgCol, 0.15); // frame
            else if (on)
              c = wy > 6 ? [140, 70, 50] : wy < 4 && hash(rel, y) < 0.5 ? [255, 214, 150] : [240, 170, 100]; // warm room, a lamp, a sill shadow
            else c = night ? [18, 14, 26] : mix(fgCol, dayWin, 0.4);
          }
          if (wy === 9 && wx > 1 && wx < 10 && rel > 2) c = shade(fgCol, 0.3); // sill
          b.px(x, y, c);
        }
      // fire escape: platforms every 14 px with railings and zig-zag ladders
      const ex0 = left ? x1 - 2 : x0 - 14,
        ex1 = left ? x1 + 14 : x0 + 2;
      for (let fy = 20; fy < gy - 10; fy += 28) {
        for (let x = ex0; x < ex1; x++) {
          b.px(x, fy, tone([30, 26, 34]));
          if (x % 2 === 0) b.px(x, fy - 4, tone([30, 26, 34]));
        }
        for (let y = fy - 4; y < fy; y++) b.px(left ? ex1 - 1 : ex0, y, tone([30, 26, 34]));
        for (let k = 0; k < 14; k++)
          b.px(left ? ex0 + 3 + Math.round(k * 0.7) : ex1 - 4 - Math.round(k * 0.7), fy + k, tone([30, 26, 34]));
      }
    }
    for (const sg of w.signs) if (sg.fg) drawSign(sg);
    // the street: wet asphalt mirroring everything above it, a kerb, crossing stripes
    for (let x = 0; x < W; x++) {
      b.px(x, gy, tone([110, 110, 120]));
      b.px(x, gy + 1, tone([60, 60, 70]));
    }
    for (let y = gy + 2; y < H; y++)
      for (let x = 0; x < W; x++) {
        const d = y - gy,
          src = gy - 2 - d * 1.3,
          wob = Math.round(Math.sin(y * 1.7) * 1.5);
        const [rr2, gg, bb, aa] = b.get(x + wob, src);
        const base = tone([28, 26, 36]);
        const lum = (rr2 + gg + bb) / 765,
          k = aa ? Math.min(0.85, (0.35 + lum * 0.8) * (1 - d / (H - gy + 6))) : 0;
        let c = mix(base, [rr2, gg, bb], k);
        if (d > 8 && Math.floor(x / 8) % 2 === 0 && x > W * 0.4 && x < W * 0.6 && d < 16)
          c = mix(c, [200, 200, 210], 0.25);
        b.px(x, y, c);
      }

    // anything drawn over that strip since is a building in front of the rail, so keep just those
    // pixels and draw them over the train, which makes it go behind them
    w.railCover = canvas(W, bandH, (cb) => {
      for (let i = 0; i < before.length; i += 4) {
        const j = band0 * W * 4 + i;
        if (
          b.d[j] !== before[i] ||
          b.d[j + 1] !== before[i + 1] ||
          b.d[j + 2] !== before[i + 2] ||
          b.d[j + 3] !== before[i + 3]
        )
          for (let k = 0; k < 4; k++) cb.d[i + k] = b.d[j + k];
      }
    });
    b.put(g);
    w.mist = mist(W, 26, night ? [190, 80, 170] : [214, 168, 118], 0.8, night ? 0.3 : 0.35, 3);
  }

  function sky(c, w, e, s) {
    const { W, gy } = w;
    // searchlights sweeping from behind the skyline
    for (let i = 0; i < 2; i++) {
      const ox = W * (0.25 + i * 0.5),
        an = -Math.PI / 2 + Math.sin(s * 0.25 + i * 2) * 0.55,
        len = gy * 0.95;
      c.fillStyle = e.night ? "rgba(200,220,255,0.10)" : "rgba(255,250,220,0.07)";
      for (let t = 6; t < len; t += 1) {
        const hw = 1 + t * 0.07,
          cx = ox + Math.cos(an) * t,
          cy = gy * 0.6 + Math.sin(an) * t;
        for (let k = -hw; k <= hw; k++)
          if (bayer(Math.round(cx + k), Math.round(cy)) < 0.55) c.fillRect(Math.round(cx + k), Math.round(cy), 1, 1);
      }
    }
    // a smog bank drifting behind the skyline
    if (w.mist) {
      const ox = -Math.round((s * 1.5) % W),
        y = Math.round(gy * 0.22);
      c.globalAlpha = 0.7;
      c.drawImage(w.mist, ox, y);
      c.drawImage(w.mist, ox + W, y);
      c.globalAlpha = 1;
    }
    // the farthest flying lane passes behind the towers
    drawLane(c, w, e, s, 0);
  }

  // flying cars: size 0 = specks with lights, 1 = small sprite, 2 = near sprite
  function drawLane(c, w, e, s, li) {
    const { W } = w,
      L = w.lanes[li];
    for (const car of w.cars) {
      if (car.li !== li) continue;
      const x = Math.round(((((car.x + s * L.sp * car.dir) % (W + 60)) + W + 60) % (W + 60)) - 30),
        y = L.y + car.dy + Math.round(Math.sin(s * 1.3 + car.x) * 0.6);
      const front = car.dir > 0 ? 1 : 0;
      if (L.sz === 0) {
        c.fillStyle = css(mix(car.col, [0, 0, 0], 0.4));
        c.fillRect(x, y, 3, 1);
        c.fillStyle = "#fff6d0";
        c.fillRect(front ? x + 3 : x - 1, y, 1, 1);
        c.fillStyle = "#ff3040";
        c.fillRect(front ? x - 1 : x + 3, y, 1, 1);
        continue;
      }
      const len = L.sz === 1 ? 7 : 13,
        hh = L.sz === 1 ? 2 : 4;
      c.fillStyle = css(mix(car.col, [0, 0, 0], 0.15));
      c.fillRect(x, y, len, hh);
      c.fillStyle = css(mix(car.col, [255, 255, 255], 0.3));
      c.fillRect(x + 1, y, len - 2, 1);
      c.fillStyle = "#9ad8ff";
      c.fillRect(x + (front ? len - 4 : 1), y - (L.sz === 2 ? 1 : 0), 3, 1);
      if (L.sz === 2) {
        c.fillStyle = "#1a1626";
        c.fillRect(x + 1, y + hh, 3, 1);
        c.fillRect(x + len - 4, y + hh, 3, 1);
        c.fillStyle = css(car.col, 0.35);
        c.fillRect(x + 2, y + hh + 1, len - 4, 1);
      }
      c.fillStyle = "#fff6d0";
      c.fillRect(front ? x + len : x - 1, y + 1, 1, 1);
      c.fillStyle = "#ff3040";
      c.fillRect(front ? x - 1 : x + len, y + 1, 1, 1);
      if (e.night || e.wx.fog) {
        c.fillStyle = "rgba(255,246,208,0.25)";
        for (let k = 1; k < (L.sz === 2 ? 10 : 5); k++)
          if (bayer(x + k, y) < 0.5) c.fillRect(front ? x + len + k : x - 1 - k, y + 1, 1, 1);
      }
    }
  }

  const KOI = [
    "tt....oooooo....",
    "ttt.oooowwoooo..",
    ".ttoooowwwooooo.",
    "..tooooooooooeoo",
    ".ttoooorroooooo.",
    "ttt.oooooooooo..",
    "tt....oooooo....",
    ".......ff.......",
    "......ff........",
  ];

  // the giant street hologram: a woman in a long dress, 2x pixels, drawn as a projection
  const FIG = [
    "......hhhhh.......",
    ".....hhhhhhh......",
    "....hhhhhhhhh.....",
    "....hhsssssshh....",
    "....hhsesseshh....",
    "....hhsssssshh....",
    "....hhhsssshhh....",
    ".....hh.ss.hh.....",
    "........ss........",
    "......dddddd......",
    ".....dddddddd.....",
    "....dddddddddd....",
    "...sdddddddddds...",
    "...sdddldddddds...",
    "...sdddldddddds...",
    "...s.ddlddddd.s...",
    "...s.ddlddddd.s...",
    "..ss.ddlddddd.ss..",
    ".....ddldddddd....",
    ".....ddldddddd....",
    "....dddlddddddd...",
    "....dddlddddddd...",
    "....dddlddddddd...",
    "...ddddldddddddd..",
    "...ddddldddddddd..",
    "...ddddldddddddd..",
    "..dddddldddddddd..",
    "..dddddlddddddddd.",
    "..dddddlddddddddd.",
    ".ddddddlddddddddd.",
    ".dddddddddddddddd.",
    "......ss..ss......",
    "......ss..ss......",
    "......ss..ss......",
    ".....sss..sss.....",
  ];
  function holoFigure(pal, flip) {
    const fw = FIG[0].length;
    return canvas(fw * 2, FIG.length * 2, (b) => {
      FIG.forEach((row, j) => {
        for (let i = 0; i < fw; i++) {
          const at = (ii, jj) => (FIG[jj] || "")[flip ? fw - 1 - ii : ii] || ".",
            ch = at(i, j);
          if (!pal[ch]) continue;
          // a bright rim where the figure meets the air
          const rim = at(i - 1, j) === "." || at(i + 1, j) === "." || at(i, j - 1) === "." || at(i, j + 1) === ".",
            col = rim ? mix(pal[ch], [255, 255, 255], 0.45) : pal[ch];
          for (let k = 0; k < 4; k++) {
            const y = j * 2 + (k >> 1);
            b.px(i * 2 + (k & 1), y, col, y % 3 === 2 ? 0.3 : rim ? 0.95 : 0.75); // scan lines
          }
        }
      });
    });
  }

  function frame(c, w, e, s) {
    const { W, H, gy, hwy, rail, holo: Ho } = w;
    if (!w.glows.pink) {
      w.glows.pink = glowSprite(9, PINK, 0.6, 0.3);
      w.glows.red = glowSprite(6, RED, 0.7, 0.4);
      w.glows.blue = glowSprite(6, [80, 140, 255], 0.7, 0.4);
      w.glows.warm = glowSprite(5, [255, 190, 110], 0.7, 0.35);
      w.glows.holo = glowSprite(28, [60, 190, 255], 0.5, 0.16);
      const cyan = { h: [255, 110, 210], s: [160, 240, 255], d: [60, 190, 255], e: [20, 40, 90], l: [210, 255, 255] };
      w.figs = [
        holoFigure(cyan, false),
        holoFigure(cyan, true),
        holoFigure({ h: PINK, s: PINK, d: PINK, l: PINK }, false),
      ];
    }
    // holo billboard on the megatower: a koi swimming on a shimmering field, scanlines
    if (Ho) {
      const hue = Math.sin(s * 0.3);
      c.fillStyle = "rgba(20,60,90,0.55)";
      c.fillRect(Ho.x, Ho.y, Ho.w, Ho.h);
      c.fillStyle = "rgba(40,225,255,0.8)";
      c.fillRect(Ho.x, Ho.y, Ho.w, 1);
      c.fillRect(Ho.x, Ho.y + Ho.h - 1, Ho.w, 1);
      for (let i = 0; i < 6; i++) {
        c.fillStyle = "rgba(120,240,255,0.35)";
        c.fillRect(Ho.x + 2 + ((i * 7 + Math.floor(s * 6)) % (Ho.w - 4)), Ho.y + 3 + ((i * 5) % (Ho.h - 6)), 1, 1);
      }
      const kx = Ho.x + Math.round(Ho.w / 2 - 8 + Math.sin(s * 0.7) * 11),
        ky = Ho.y + Math.round(Ho.h / 2 - 5 + Math.sin(s * 1.4) * 3);
      sprite(
        c,
        KOI,
        kx,
        ky,
        { o: hue > 0 ? "#ff7a50" : "#ff5aa0", w: "#ffffff", t: "#ffd0a0", e: "#101018", r: "#ffffff", f: "#ffb080" },
        Math.cos(s * 0.7) < 0,
      );
      c.fillStyle = "rgba(0,0,0,0.3)";
      for (let y = Ho.y + 1; y < Ho.y + Ho.h; y += 2) c.fillRect(Ho.x, y, Ho.w, 1);
      if (Math.sin(s * 9) > 0.97) {
        c.fillStyle = "rgba(40,225,255,0.4)";
        c.fillRect(Ho.x - 2, Ho.y + Math.round((s * 40) % Ho.h), Ho.w + 4, 1);
      }
    }
    // blinking antennae and the tower spire
    for (const m of w.mids)
      if (m.antTop && Math.sin(s * 2.5 + m.x) > 0.3) {
        c.fillStyle = "#ff3a4a";
        c.fillRect(m.antTop[0], m.antTop[1], 1, 1);
        c.drawImage(w.glows.red, m.antTop[0] - 6, m.antTop[1] - 6);
      }
    if (Math.sin(s * 1.6) > 0) {
      c.fillStyle = "#ff3a4a";
      c.fillRect(w.tower.x, w.tower.top - 11, 1, 1);
      c.drawImage(w.glows.red, w.tower.x - 6, w.tower.top - 17);
    }
    // flickering signs: a few go dark for a moment now and then
    for (const sg of w.signs)
      if (sg.fl >= 0 && Math.sin(s * 13 + sg.fl * 7) > 0.85 && Math.sin(s * 0.9 + sg.fl) > 0.2) {
        c.fillStyle = "#0e0816";
        c.fillRect(sg.x + 1, sg.y + 1, sg.w - 2, sg.h - 2);
      }
    // the maglev, every ~26 s
    {
      const per = 26,
        t = (s % per) / per,
        len = 90,
        x = Math.round(-len + t * (W + len * 2) * 1.6);
      if (x < W) {
        c.fillStyle = "#c8ccd8";
        c.fillRect(x, rail - 6, len, 5);
        c.fillStyle = "#7a7e90";
        c.fillRect(x, rail - 2, len, 1);
        c.fillStyle = e.night ? "#bff4ff" : "#4a5468";
        for (let k = 4; k < len - 6; k += 4) c.fillRect(x + k, rail - 5, 2, 2);
        c.fillStyle = "#ff3aa0";
        c.fillRect(x, rail - 3, len, 1);
        c.fillStyle = "#e8ecf4";
        c.fillRect(x + len, rail - 5, 2, 3);
        c.fillStyle = "#fff6d0";
        c.fillRect(x + len + 2, rail - 4, 1, 1);
        c.drawImage(w.railCover, 0, rail - RAIL_UP);
      }
    }
    // the hologram: flickers, turns now and then, and glitches into slices every few seconds
    {
      const fw = w.figs[0].width,
        fh = w.figs[0].height,
        hx = Math.round(W * 0.3 - fw / 2),
        hy = gy - fh,
        flip = Math.floor(s / 17) % 2,
        glitch = s % 9 < 0.3 || s % 17 < 0.25;
      c.globalAlpha = 0.6 + 0.15 * Math.sin(s * 1.3);
      c.drawImage(w.glows.holo, hx + fw / 2 - 28, hy + fh / 2 - 34);
      c.globalAlpha = 0.62 + 0.18 * Math.sin(s * 3.1) - (Math.sin(s * 23) > 0.92 ? 0.3 : 0);
      if (!glitch) c.drawImage(w.figs[flip], hx, hy);
      else {
        const seed = Math.floor(s * 10);
        for (let y = 0; y < fh; y += 10) {
          const off = Math.round((hash(seed, y) - 0.5) * 10);
          c.drawImage(w.figs[flip], 0, y, fw, Math.min(10, fh - y), hx + off, hy + y, fw, Math.min(10, fh - y));
        }
        c.globalAlpha = 0.35;
        c.drawImage(w.figs[2], hx + 2, hy);
      }
      c.globalAlpha = 1;
      c.fillStyle = "#9af0ff";
      c.fillRect(hx + fw / 2 - 4, gy, 8, 1);
      c.fillStyle = "rgba(154,240,255,0.35)";
      c.fillRect(hx + fw / 2 - 7, gy + 1, 14, 1);
    }
    drawLane(c, w, e, s, 1);
    // the advertising airship: slow, with a scrolling glyph screen and nav lights
    {
      const per = 70,
        t = (s % per) / per,
        ax = Math.round(W + 30 - t * (W + 90)),
        ay = Math.round(gy * 0.08 + Math.sin(s * 0.4) * 1.5);
      c.fillStyle = "#4a4458";
      for (let y = 0; y < 11; y++) {
        const half = Math.round(Math.sqrt(1 - ((y - 5) / 6) ** 2) * 22);
        c.fillRect(ax - half, ay + y, half * 2, 1);
      }
      c.fillStyle = "#6a6478";
      c.fillRect(ax - 18, ay + 1, 36, 1);
      c.fillStyle = "#0c0814";
      c.fillRect(ax - 12, ay + 3, 24, 5);
      for (let k = 0; k < 5; k++) {
        const gb = GLYPHS[(Math.floor(s * 2) + k) % 40];
        c.fillStyle = css(NEON[(k + Math.floor(s / 3)) % NEON.length]);
        for (let i = 0; i < 15; i++)
          if (gb[i] && i < 12) c.fillRect(ax - 11 + k * 5 + (i % 3), ay + 3 + Math.floor(i / 3), 1, 1);
      }
      c.fillStyle = "#2a2636";
      c.fillRect(ax - 4, ay + 11, 8, 2);
      c.fillRect(ax + 20, ay + 2, 3, 6);
      if (Math.floor(s * 2) % 2) {
        c.fillStyle = "#ff3040";
        c.fillRect(ax - 22, ay + 5, 1, 1);
        c.fillStyle = "#40ff80";
        c.fillRect(ax + 21, ay + 5, 1, 1);
      }
    }
    // highway traffic: headlights one way, tail lights the other
    for (let i = 0; i < 12; i++) {
      const dir = i % 2 ? 1 : -1,
        sp = 22 + (i % 3) * 6,
        x = Math.round(((((i * 53 + s * sp * dir) % (W + 20)) + W + 20) % (W + 20)) - 10),
        y = hwy - 3 + (i % 2);
      c.fillStyle = "#28283a";
      c.fillRect(x, y, 6, 2);
      c.fillStyle = dir > 0 ? "#fff4c0" : "#ff3040";
      c.fillRect(dir > 0 ? x + 6 : x - 1, y + 1, 1, 1);
      c.fillRect(dir > 0 ? x + 6 : x - 1, y, 1, 1);
    }
    // police cruiser now and then on the near lane: light bar alternating red/blue
    {
      const per = 40,
        t = (s % per) / per;
      if (t < 0.4) {
        const px = Math.round(W + 20 - (t / 0.4) * (W + 50)),
          py = w.lanes[2].y + 8,
          ph = Math.floor(s * 6) % 2;
        c.fillStyle = "#e8ecf4";
        c.fillRect(px, py, 14, 4);
        c.fillStyle = "#1a1a24";
        c.fillRect(px, py + 2, 14, 1);
        c.fillRect(px + 2, py + 4, 3, 1);
        c.fillRect(px + 9, py + 4, 3, 1);
        c.fillStyle = "#6ab4ff";
        c.fillRect(px + 2, py, 3, 1);
        c.fillStyle = ph ? "#ff2a3a" : "#2a6aff";
        c.fillRect(px + 6, py - 1, 2, 1);
        c.fillStyle = ph ? "#2a6aff" : "#ff2a3a";
        c.fillRect(px + 8, py - 1, 2, 1);
        c.drawImage(ph ? w.glows.red : w.glows.blue, px + 1, py - 7);
        c.fillStyle = "#fff6d0";
        c.fillRect(px - 1, py + 1, 1, 1);
      }
    }
    // a surveillance drone: flies in, hovers sweeping a searchlight over the street, leaves
    {
      const per = 48,
        t = (s % per) / per,
        hoverX = W * 0.62;
      if (t < 0.82) {
        const dx = Math.round(
            t < 0.12
              ? W + 20 - (t / 0.12) * (W + 20 - hoverX)
              : t < 0.7
                ? hoverX + Math.sin(s * 0.4) * 10
                : hoverX - ((t - 0.7) / 0.12) * (hoverX + 40),
          ),
          dy = Math.round(gy * 0.3 + Math.sin(s * 1.7) * 1.5);
        if (t > 0.13 && t < 0.69) {
          const aim = Math.sin(s * 0.55) * 0.45,
            len = gy + 2 - dy,
            k = e.night ? 0.11 : 0.06;
          for (let y = 3; y < len; y++) {
            const hw = 0.5 + y * 0.15;
            c.fillStyle = `rgba(215,238,255,${k * (1 - (y / len) * 0.5)})`;
            c.fillRect(Math.round(dx + 2 + y * aim - hw), dy + y, Math.round(hw * 2) + 1, 1);
          }
          const sx = Math.round(dx + 2 + len * aim),
            sw = Math.round(len * 0.15);
          c.fillStyle = `rgba(225,242,255,${k * 2})`;
          c.fillRect(sx - sw, gy, sw * 2 + 1, 1);
          c.fillRect(sx - sw + 2, gy + 1, sw * 2 - 3, 1);
        }
        c.fillStyle = "#24222e";
        c.fillRect(dx - 2, dy, 9, 2);
        c.fillRect(dx, dy - 1, 5, 1);
        c.fillRect(dx - 4, dy - 1, 3, 1);
        c.fillRect(dx + 6, dy - 1, 3, 1);
        c.fillStyle = "#eaf6ff";
        c.fillRect(dx + 2, dy + 2, 1, 1);
        c.fillStyle = Math.floor(s * 3) % 2 ? "#ff3040" : "#3a6aff";
        c.fillRect(dx + (Math.floor(s * 3) % 2 ? -4 : 8), dy - 1, 1, 1);
      }
    }
    drawLane(c, w, e, s, 2);
    // exhaust drifting off the rooftops
    w.plumes ||= w.mids
      .filter((m) => m.ac > 0)
      .filter((_, i) => i % 2 === 0)
      .slice(0, 4)
      .map((m) => [m.x + Math.round(m.w * 0.5), m.top - 4]);
    const puff = e.day < 0.5 ? "150,110,170" : "205,180,155";
    for (const [px0, py0] of w.plumes)
      for (let i = 0; i < 6; i++) {
        const t = (s * 0.16 + i / 6 + px0 * 0.013) % 1,
          x = Math.round(px0 + t * 16 + Math.sin(s + i) * 1),
          y = Math.round(py0 - t * 18),
          r = 1 + Math.round(t * 2.5);
        c.fillStyle = `rgba(${puff},${0.3 * (1 - t)})`;
        for (let yy = -r; yy <= r; yy++)
          for (let xx = -r; xx <= r; xx++)
            if (xx * xx + yy * yy <= r * r && bayer(x + xx, y + yy) < 0.6) c.fillRect(x + xx, y + yy, 1, 1);
      }
    // cables between the foreground frames, lanterns swaying on them
    const cy0 = Math.round(gy * 0.26),
      sag = 14;
    c.fillStyle = "#16121e";
    for (let x = w.fgL; x < W - w.fgR; x++) {
      const t = (x - w.fgL) / (W - w.fgR - w.fgL);
      c.fillRect(x, Math.round(cy0 + Math.sin(t * Math.PI) * sag), 1, 1);
      c.fillRect(x, Math.round(cy0 - 9 + Math.sin(t * Math.PI) * sag * 0.6), 1, 1);
    }
    for (const ln of w.lanterns) {
      const lx = Math.round(w.fgL + ln.t * (W - w.fgR - w.fgL)),
        ly = Math.round(cy0 + Math.sin(ln.t * Math.PI) * sag) + 1,
        sw = Math.round(Math.sin(s * 1.2 + ln.t * 9) * 1);
      c.fillStyle = "#16121e";
      c.fillRect(lx, ly, 1, 2);
      c.fillStyle = css(ln.col);
      c.fillRect(lx - 1 + sw, ly + 2, 3, 4);
      c.fillStyle = css(mix(ln.col, [255, 255, 200], 0.5));
      c.fillRect(lx + sw, ly + 3, 1, 2);
      c.fillStyle = "#16121e";
      c.fillRect(lx - 1 + sw, ly + 2, 3, 1);
      c.fillRect(lx + sw, ly + 6, 1, 1);
      if (e.day < 0.6) c.drawImage(w.glows.warm, lx - 5 + sw, ly - 1);
    }
    // steam rising from street vents
    for (const vx of w.vents)
      for (let i = 0; i < 6; i++) {
        const t = (s * 0.35 + i / 6) % 1,
          x = Math.round(vx + Math.sin(s * 1.5 + i) * (2 + t * 5)),
          y = Math.round(gy + 4 - t * 34),
          a = 0.32 * (1 - t);
        c.fillStyle = `rgba(210,200,220,${a})`;
        for (let k = 0; k < 3 + t * 6; k++) if (bayer(x + k, y) < 0.6) c.fillRect(x - 2 + k, y, 1, 2);
      }
    // pedestrians: coats, umbrellas in the rain, a lit phone or two
    const rain = e.wx.rain > 0;
    for (const p of w.people) {
      const x = Math.round(((((p.x + s * p.sp * p.dir) % (W + 10)) + W + 10) % (W + 10)) - 5),
        y = p.y,
        step = Math.floor(s * 4 + p.x) % 2;
      c.fillStyle = css(p.coat);
      c.fillRect(x, y - 5, 3, 4);
      c.fillStyle = "#d8b090";
      c.fillRect(x + 1, y - 7, 1, 2);
      c.fillStyle = "#1a1620";
      c.fillRect(x + step, y - 1, 1, 2);
      c.fillRect(x + 2 - step, y - 1, 1, 2);
      if (rain) {
        c.fillStyle = css(p.col);
        c.fillRect(x - 2, y - 10, 7, 1);
        c.fillRect(x - 1, y - 11, 5, 1);
        c.fillStyle = "#1a1620";
        c.fillRect(x + 1, y - 9, 1, 2);
      } else if (p.sp > 3.5) {
        c.fillStyle = "#9ae8ff";
        c.fillRect(x + (p.dir > 0 ? 3 : -1), y - 5, 1, 1);
      }
      c.fillStyle = css(p.col, 0.25);
      c.fillRect(x - 1, y + 1, 5, 1); // reflection on the wet street
    }
    // mist rolling along the street
    {
      const ox = -Math.round((s * 3) % W),
        y = gy - 22;
      c.drawImage(w.mist, ox, y);
      c.drawImage(w.mist, ox + W, y);
    }
    // weather
    if (rain) {
      const n = Math.round(w.drops.length * Math.min(1, e.wx.rain + 0.25));
      for (let i = 0; i < n; i++) {
        const [px, py, sp] = w.drops[i],
          y = Math.round((py * H + s * 120 * sp) % H),
          x = Math.round((px * (W + 20) - y * 0.25) % (W + 20));
        c.fillStyle = i % 5 === 0 ? "rgba(255,140,200,0.55)" : "rgba(170,200,255,0.5)";
        c.fillRect(x, y, 1, 3);
        if (y > gy + 2 && (Math.floor(s * 10) + i) % 7 === 0) {
          c.fillStyle = "rgba(200,220,255,0.6)";
          c.fillRect(x - 1, y + 2, 1, 1);
          c.fillRect(x + 1, y + 2, 1, 1);
        }
      }
    }
    if (e.wx.snow) {
      c.fillStyle = "#f4f0ff";
      for (const [px, py, sp] of w.drops)
        c.fillRect(Math.round(px * W + Math.sin(s + py * 20) * 3), Math.round((py * H + s * 14 * sp) % H), 1, 1);
    }
    if (e.wx.fog) {
      c.fillStyle = e.night ? "rgba(140,80,140,0.3)" : "rgba(200,190,160,0.35)";
      for (let y = Math.round(gy * 0.3); y < H; y += 1)
        for (let x = y & 1; x < W; x += 2) if (bayer(x, y) < 0.5) c.fillRect(x, y, 1, 1);
    }
    if (e.wx.thunder && s % 9 < 0.12) {
      c.fillStyle = "rgba(255,240,255,0.5)";
      c.fillRect(0, 0, W, H);
    }
  }

  RS_SCENE.register("neon", { fps: 12, build, background, sky, land, frame });
})();
