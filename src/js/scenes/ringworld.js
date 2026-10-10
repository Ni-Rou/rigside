"use strict";

// Ringworld: alien valley under an orbital ring.
(() => {
  const {
    Buf,
    ramp,
    bayer,
    H_,
    mix,
    css,
    skyRamp,
    toner,
    ridge,
    glowSprite,
    shade,
    hash,
    mist,
    rays,
    motes,
    shootingStar,
  } = RS_PX;
  const { rng } = RS_SCENE;
  const SKY = {
    night: H_(["#02040e", "#060c22", "#0a1432", "#101c42", "#16264e"]),
    day: H_(["#1e5ea6", "#2c74b8", "#4a92ca", "#78b4da", "#b4dcec"]),
    warm: H_(["#22285e", "#4a3a7a", "#a85a78", "#ee8e66", "#ffc890"]),
    grey: H_(["#56606e", "#646e7a", "#727c86", "#828a92", "#929aa0"]),
  };
  const GLOW = [90, 240, 255];

  function build(W, H) {
    const r = rng(117),
      hy = Math.round(H * 0.56);
    const rangeTops = [
      {
        r: ridge(r, W, [
          [70, 1],
          [26, 0.5],
          [9, 0.15],
        ]),
        lo: H * 0.3,
        hi: H * 0.52,
        col: [120, 150, 190],
        haze: 0.62,
      },
      {
        r: ridge(r, W, [
          [50, 1],
          [18, 0.45],
          [6, 0.15],
        ]),
        lo: H * 0.4,
        hi: H * 0.6,
        col: [90, 120, 150],
        haze: 0.4,
      },
      {
        r: ridge(r, W, [
          [40, 1],
          [14, 0.4],
          [5, 0.15],
        ]),
        lo: H * 0.5,
        hi: H * 0.68,
        col: [70, 96, 110],
        haze: 0.2,
      },
    ];
    const fall = { x: Math.round(W * 0.2), top: Math.round(H * 0.47), pool: Math.round(H * 0.73) };
    const mesa = { x0: Math.round(W * 0.6), x1: Math.round(W * 0.8), top: Math.round(H * 0.63) };
    const fore = ridge(r, W, [
      [60, 1],
      [20, 0.4],
      [6, 0.12],
    ]);
    const S = Math.min(H, W * 0.6);
    const trees = [
      { x: Math.round(W * 0.06), h: S * 0.62, lean: 0.25, seed: 1 },
      { x: Math.round(W * 0.95), h: S * 0.7, lean: -0.3, seed: 2 },
      { x: Math.round(W * 0.88), h: S * 0.42, lean: -0.1, seed: 3 },
      { x: Math.round(W * 0.15), h: S * 0.36, lean: 0.15, seed: 4 },
    ];
    const stars = Array.from({ length: Math.round((W * H) / 90) }, () => [r(), r() * 0.6, r()]);
    const fleet = Array.from({ length: 6 }, (_, i) => ({
      dx: i === 0 ? 0 : (r() - 0.5) * 50,
      dy: i === 0 ? 0 : (r() - 0.5) * 14,
      big: i === 0,
    }));
    const birds = Array.from({ length: 7 }, (_, i) => ({ dx: i * 5 - (i % 2) * 3, dy: Math.abs(i - 3) * 2 }));
    const drops = Array.from({ length: Math.round((W * H) / 240) }, () => [r(), r(), 0.7 + r() * 0.6]);
    const grass = Array.from({ length: Math.round(W / 3) }, () => [r() * W, r()]);
    return { W, H, hy, rangeTops, fall, mesa, fore, trees, stars, fleet, birds, drops, grass, glows: {} };
  }

  // the ring's centre line and thickness at parameter t (0 = left horizon, 1 = right horizon)
  function ringAt(w, t) {
    const { W, hy } = w,
      a = Math.PI * (1 - t);
    return [W * 0.5 + Math.cos(a) * W * 0.56, hy + 4 - Math.sin(a) * hy * 0.92, Math.round(17 - Math.sin(a) * 9)];
  }

  function background(g, w, e) {
    const { W, H, hy } = w,
      b = new Buf(g, W, H),
      sky = skyRamp(e, SKY),
      night = e.night;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b.px(x, y, ramp(sky, y / hy, x, y, 0.3));
    if (e.day < 0.5)
      for (const [px, py, p] of w.stars)
        b.px(px * W, py * H, p > 0.9 ? [255, 255, 255] : [170, 190, 255], (1 - e.day * 2) * (0.4 + p * 0.6));
    // gas giant: bands, a storm, terminator on the right; its moon
    const gx = Math.round(W * 0.8),
      gyy = Math.round(H * 0.17),
      R = 21;
    const bands = [
      [214, 170, 120],
      [236, 210, 170],
      [196, 140, 100],
      [230, 196, 150],
      [180, 120, 90],
      [224, 200, 160],
    ];
    for (let y = -R; y <= R; y++)
      for (let x = -R; x <= R; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d > R) continue;
        const bi = Math.floor(((y + R) / (2 * R)) * 9 + Math.sin(x * 0.2 + y * 0.1) * 0.6),
          storm = ((x + 7) / 5) ** 2 + ((y - 6) / 3) ** 2 < 1;
        let c = storm ? [190, 90, 70] : bands[((bi % 6) + 6) % 6];
        const lightF = (-x * 0.7 - y * 0.4) / R; // lit from the upper left
        c = lightF > 0.35 ? shade(c, 0.15) : lightF < -0.25 ? shade(c, -0.55 - (lightF < -0.6 ? 0.25 : 0)) : c;
        if (d > R - 1.2) c = shade(c, -0.3);
        const a = e.day > 0.6 ? 0.85 : 1;
        if (lightF < -0.25 && lightF > -0.32 && bayer(x, y) < 0.5) c = shade(c, -0.4);
        b.px(gx + x, gyy + y, mix(sky[0], c, a));
      }
    for (let y = -4; y <= 4; y++)
      for (let x = -4; x <= 4; x++)
        if (x * x + y * y <= 16) b.px(gx - 34 + x, gyy - 10 + y, x + y > 2 ? [120, 124, 140] : [210, 212, 224]);
    // the ring: rises from both horizons; inner face continents, seas, clouds; dark outer wall; a shadowed stretch
    const land = [
        [120, 150, 90],
        [150, 140, 100],
        [90, 130, 80],
      ],
      sea = [34, 70, 112];
    for (let i = 0; i <= 2400; i++) {
      const t = i / 2400,
        [cx, cy, th] = ringAt(w, t);
      if (cy > hy + 4 || cy < -12) continue;
      const shadow = t > 0.58 && t < 0.66;
      for (let k = 0; k < th; k++) {
        const across = k / th,
          u = t * 60;
        const cont = Math.sin(u * 0.9) + Math.sin(u * 2.3 + 1) * 0.6 + Math.sin(u * 5.1 + across * 2) * 0.25;
        let c = cont > 0.15 ? land[Math.floor(u * 1.7) % 3] : sea;
        if (cont > 0.15 && cont < 0.3) c = [196, 184, 140]; // coast
        if (Math.sin(t * 170) + Math.sin(t * 410 + across * 1.5) * 0.6 > 1.15) c = [236, 240, 246]; // cloud clumps
        if (k < 1)
          c = [40, 44, 60]; // outer wall edge
        else if (k === th - 1 || across > 0.85) c = shade(c, 0.2);
        if (shadow) c = shade(c, -0.7);
        const haze = 1 - Math.min(1, (hy - cy) / hy) * 0.3;
        c = mix(c, sky[Math.min(4, Math.max(0, Math.round((cy / hy) * 4)))], (e.day > 0.5 ? 0.22 : 0.05) * haze);
        if (e.night && !shadow) c = shade(c, 0.1); // sunlit even at night
        b.px(cx, cy + k, c);
        b.px(cx + 1, cy + k, c);
      }
    }
    // sunlight slanting in from the upper left
    if (e.day > 0.5 && e.wx.clouds < 0.9)
      rays(b, -W * 0.05, -H * 0.1, 0.75, { n: 5, len: H * 1.1, spread: 0.12, width: 0.06, k: 0.22 * e.day });
    // three ranges, hazier with distance; lit from the left, snow on the far peaks
    for (const [ri, R0] of w.rangeTops.entries()) {
      const tone = toner(e),
        skyH = sky[4];
      for (let x = 0; x < W; x++) {
        const hAt = (xx) => R0.hi - R0.r[Math.max(0, Math.min(W - 1, xx))] * (R0.hi - R0.lo);
        const top = Math.round(hAt(x)),
          slope = (hAt(x + 9) - hAt(x - 9)) / 18; // >0: the face turns to the light (from the left)
        const f = Math.max(-1, Math.min(1, slope * 2.5));
        for (let y = top; y < H; y++) {
          const v = 0.5 + f * 0.5 - (y - top) * 0.006;
          let c = ramp([shade(R0.col, -0.3), shade(R0.col, -0.1), R0.col, shade(R0.col, 0.18)], v, x, y, 0.5);
          if (ri === 0 && y - top < 4 && top < R0.hi - (R0.hi - R0.lo) * 0.6) c = [230, 236, 246];
          if (ri < 2 && (x * 7 + y * 3) % 23 === 0) c = shade(c, -0.12);
          b.px(x, y, mix(tone(c), skyH, R0.haze * (e.night ? 0.4 : 1)));
        }
      }
    }
    b.put(g);
  }

  function land(g, w, e) {
    const { W, H, fall: F, mesa: M } = w,
      b = new Buf(g, W, H),
      tone = toner(e),
      night = e.night;
    const P = (x, y, c, a) => b.px(x, y, tone(c), a);
    // the cliff that holds the waterfall: stepped rock, dark crevices
    for (let x = 0; x < W * 0.34; x++) {
      const top = Math.round(F.top - 6 + Math.abs(x - F.x) * 0.15 + Math.sin(x * 0.4) * 2);
      for (let y = top; y < H; y++) {
        const yy = y + Math.sin(x * 0.045) * 4 + Math.sin(x * 0.11) * 1.2,
          layer = Math.floor(yy / 7),
          crack = hash(Math.floor(x / 2), layer) < 0.06,
          lip = yy % 7 < 1;
        const near = Math.abs(x - F.x) < 6 ? -0.25 : 0; // the wet recess behind the falls
        let c = [
          [112, 114, 124],
          [98, 100, 112],
          [120, 118, 126],
        ][((layer % 3) + 3) % 3];
        c = shade(c, near + (lip ? 0.18 : 0) - (crack ? 0.4 : 0) + (x > W * 0.3 ? -0.2 : 0));
        if (y - top > 3 && bayer(x, y) < 0.08) c = [80, 120, 80]; // moss specks
        P(x, y, c);
      }
      if (top < H) {
        P(x, top, [140, 170, 110]);
        P(x, top + 1, [100, 140, 90]);
      }
    }
    // valley floor: forest canopy in rounded blobs, a river winding to the pool
    const vy = Math.round(H * 0.72);
    for (let y = vy - 6; y < H; y++) for (let x = Math.round(W * 0.25); x < W; x++) P(x, y, [40, 80, 70]);
    const r = rng(5);
    for (let i = 0; i < W * 0.9; i++) {
      const cx = W * 0.22 + r() * W * 0.8,
        cy = vy - 4 + r() * (H - vy),
        R = 3 + r() * 3;
      for (let y = -R; y <= R; y++)
        for (let x = -R; x <= R; x++) {
          const d = x * x + y * y;
          if (d > R * R) continue;
          const lit = x + y < -R * 0.4;
          P(
            cx + x,
            cy + y,
            d > (R - 1) * (R - 1)
              ? [26, 56, 52]
              : lit
                ? [80, 150, 110]
                : bayer(x, y) < 0.3
                  ? [46, 100, 84]
                  : [56, 116, 92],
          );
        }
    }
    for (let y = vy - 2; y < H; y++) {
      const t = (y - vy) / (H - vy),
        cx = W * 0.3 + Math.sin(t * 3.2) * W * 0.08 + t * W * 0.2,
        hw = 2 + t * 6;
      for (let x = -hw; x <= hw; x++)
        P(
          cx + x,
          y,
          Math.abs(x) > hw - 1 ? [120, 150, 140] : Math.floor(y * 0.7 + x) % 5 === 0 ? [180, 220, 240] : [90, 150, 200],
        );
    }
    // the pool at the foot of the falls
    for (let y = -4; y <= 4; y++)
      for (let x = -16; x <= 16; x++)
        if ((x / 16) ** 2 + (y / 4) ** 2 < 1)
          P(F.x + x, F.pool + y, (x + y) % 5 === 0 ? [170, 220, 240] : [80, 140, 190]);
    // the mesa and the structure on it
    for (let x = M.x0 - 6; x < M.x1 + 6; x++) {
      const inset = x < M.x0 ? M.x0 - x : x >= M.x1 ? x - M.x1 + 1 : 0,
        top = M.top + inset * 3;
      for (let y = top; y < H; y++) {
        const band = Math.floor((y - M.top + Math.sin(x * 0.06) * 2) / 5),
          rel = (x - M.x0) / (M.x1 - M.x0);
        let c = [
          [184, 146, 112],
          [160, 124, 96],
          [196, 162, 124],
          [150, 112, 88],
        ][((band % 4) + 4) % 4];
        c = shade(c, rel < 0.15 ? 0.15 : rel > 0.7 ? -0.35 : 0);
        if (hash(Math.floor(x / 2), band) < 0.07 && y - top > 2) c = shade(c, -0.45); // vertical cracks
        if (y - top < 2) c = y === top ? [120, 160, 100] : [90, 130, 80];
        P(x, y, c);
      }
    }
    const SIL = [206, 212, 222],
      SIL2 = [150, 156, 170],
      SIL3 = [100, 106, 122];
    const mx = Math.round((M.x0 + M.x1) / 2);
    // gateway arch
    for (let y = 0; y < 30; y++)
      for (const [px, side] of [
        [mx - 12, -1],
        [mx + 9, 1],
      ])
        for (let k = 0; k < 4; k++) P(px + k, M.top - y, k === 0 ? SIL : k === 3 ? SIL3 : SIL2);
    for (let a = 0; a <= 40; a++) {
      const an = (Math.PI * a) / 40,
        x = mx - 1 + Math.cos(an) * 12,
        y = M.top - 30 - Math.sin(an) * 9;
      for (let k = 0; k < 3; k++) P(x, y + k, k === 0 ? SIL : SIL2);
    }
    w.gate = [mx, M.top - 40];
    // pylons, tapered with a fin
    for (const [px, ph] of [
      [M.x0 + 4, 46],
      [M.x1 - 6, 38],
    ])
      for (let y = 0; y < ph; y++) {
        const hw = Math.max(1, Math.round(3 - (y / ph) * 2));
        for (let k = -hw; k <= hw; k++) P(px + k, M.top - y, k < 0 ? SIL : k === hw ? SIL3 : SIL2);
        if (y > ph * 0.6 && y % 3 === 0) P(px + hw + 1, M.top - y, SIL3);
      }
    w.pylons = [
      [M.x0 + 4, M.top - 46],
      [M.x1 - 6, M.top - 38],
    ];
    // the bridge over the chasm, back towards the cliff
    const bx0 = Math.round(W * 0.34),
      by = M.top + 2;
    for (let x = bx0; x < M.x0; x++) {
      const sag = Math.sin(((x - bx0) / (M.x0 - bx0)) * Math.PI) * 2;
      P(x, by + sag, SIL);
      P(x, by + 1 + sag, SIL3);
      if (x % 6 === 0) for (let y = 0; y < 4; y++) P(x, by - 1 - y + sag, SIL2);
    }
    // foreground ridge: dark rock and grass, rocks with a lit edge
    for (let x = 0; x < W; x++) {
      const top = Math.round(H * 0.84 - w.fore[x] * H * 0.08);
      for (let y = top; y < H; y++)
        P(x, y, y - top < 2 ? [90, 130, 80] : y - top < 4 && bayer(x, y) < 0.5 ? [60, 100, 64] : [34, 52, 44]);
    }
    for (const [rx, rr] of [
      [W * 0.32, 6],
      [W * 0.55, 4],
      [W * 0.72, 7],
    ]) {
      const top = Math.round(H * 0.84 - w.fore[Math.round(rx)] * H * 0.08);
      for (let y = -rr; y <= 0; y++)
        for (let x = -rr; x <= rr; x++)
          if (x * x + y * y * 2 < rr * rr) P(rx + x, top + y + 1, x + y < -rr * 0.5 ? [140, 140, 150] : [80, 84, 96]);
    }
    // alien frond trees framing the sides: a curved trunk, a crown of drooping fronds
    for (const T of w.trees) {
      const base = Math.round(H * 0.86),
        rt = rng(T.seed * 99);
      let x = T.x,
        top;
      for (let y = 0; y < T.h; y++) {
        const cx = Math.round(T.x + Math.sin((y / T.h) * 1.4) * T.h * T.lean * 0.4);
        for (let k = -1; k <= 1; k++)
          P(cx + k, base - y, k < 0 ? [140, 110, 150] : k > 0 ? [60, 40, 70] : [100, 74, 110]);
        if (y % 5 === 0) P(cx - 1, base - y, [170, 140, 180]);
        x = cx;
      }
      top = base - T.h;
      for (let f = 0; f < 9; f++) {
        const an = -Math.PI / 2 + (f - 4) * 0.42 + (rt() - 0.5) * 0.2,
          len = T.h * 0.28 + rt() * 8;
        for (let k = 0; k < len; k++) {
          const t = k / len,
            fx = x + Math.cos(an) * k,
            fy = top + Math.sin(an) * k + t * t * len * 0.9;
          P(fx, fy, t < 0.5 ? [60, 170, 160] : [40, 130, 140]);
          P(fx, fy + 1, [24, 80, 96]);
          if (k % 2 === 0) {
            P(fx, fy + 2, [50, 150, 150]);
          }
        }
      }
      for (let k = -2; k <= 2; k++) P(x + k, top, [230, 140, 200]); // a seed pod
      P(x, top - 1, [255, 190, 230]);
    }

    b.put(g);
  }

  function sky(c, w, e, s) {
    const { W, H, hy } = w;
    // cirrus streaks drifting
    c.fillStyle = e.night ? "rgba(140,160,220,0.18)" : "rgba(255,255,255,0.45)";
    for (let i = 0; i < 3 + Math.round(e.wx.clouds * 5); i++) {
      const x0 = ((i * 97 + s * (2 + i * 0.5)) % (W + 80)) - 60,
        y0 = H * (0.08 + (i % 4) * 0.08);
      for (let k = 0; k < 40 + i * 6; k++)
        if (bayer(k, i) < 0.6) c.fillRect(Math.round(x0 + k), Math.round(y0 + Math.sin(k * 0.12 + i) * 1.5), 1, 1);
    }
    // mist lying in the valleys between the ranges
    const M = e.day < 0.4 ? "night" : "day";
    w.mists ||= {};
    w.mists[M] ||= mist(W, 18, M === "night" ? [70, 90, 130] : [226, 236, 246], 0.8, 0.5, 5);
    for (const [y, sp, a] of [
      [H * 0.47, 1.2, 0.7],
      [H * 0.57, 2, 0.85],
    ]) {
      const ox = -Math.round((s * sp) % W);
      c.globalAlpha = a;
      c.drawImage(w.mists[M], ox, Math.round(y));
      c.drawImage(w.mists[M], ox + W, Math.round(y));
    }
    c.globalAlpha = 1;
    if (e.night) shootingStar(c, W, H, s);
    // the fleet: a capital ship with escorts sliding across, in front of the ring
    const per = 140,
      t = (s % per) / per,
      fx = Math.round(-60 + t * (W + 120)),
      fy = Math.round(hy * 0.42);
    for (const f of w.fleet) {
      const x = Math.round(fx + f.dx),
        y = Math.round(fy + f.dy);
      if (f.big) {
        c.fillStyle = e.night ? "#3a4054" : "#5c6478";
        c.fillRect(x - 14, y, 30, 3);
        c.fillRect(x - 8, y - 2, 14, 2);
        c.fillRect(x + 16, y + 1, 4, 1);
        c.fillStyle = e.night ? "#5a6278" : "#8a92a6";
        c.fillRect(x - 14, y, 30, 1);
        c.fillStyle = "#7ae8ff";
        c.fillRect(x - 15, y + 1, 1, 1);
        c.fillRect(x - 15, y + 2, 1, 1);
        if (e.night) {
          c.fillStyle = "#ffd070";
          for (let k = -10; k < 14; k += 4) c.fillRect(x + k, y + 2, 1, 1);
        }
      } else {
        c.fillStyle = e.night ? "#4a5068" : "#6a7288";
        c.fillRect(x, y, 6, 1);
        c.fillRect(x + 2, y - 1, 3, 1);
        c.fillStyle = "#7ae8ff";
        c.fillRect(x - 1, y, 1, 1);
      }
    }
  }

  const BIRD = [
    ["x.....x", ".x...x.", "..xxx.."],
    [".......", "xxxxxxx", "..x.x.."],
  ];

  function frame(c, w, e, s) {
    const { W, H, fall: F, mesa: M } = w,
      night = e.night;
    if (!w.glows.g) {
      w.glows.g = glowSprite(6, GLOW, 0.7, 0.35);
      w.glows.mist = glowSprite(10, [230, 240, 250], 0.6, 0.3);
    }
    // the waterfall: streaks running down, foam at the lip and the foot, mist
    for (let y = F.top; y < F.pool; y++)
      for (let x = -3; x <= 3; x++) {
        const v = (y * 0.6 - s * 22 + x * 5 + (x & 1) * 3) % 7;
        c.fillStyle = night
          ? v < 1.2
            ? "#8aa0c8"
            : v < 3.5
              ? "#4a6094"
              : "#344878"
          : v < 1.2
            ? "#f2faff"
            : v < 3.5
              ? "#9ccae8"
              : "#6aa2d0";
        c.fillRect(F.x + x, y, 1, 1);
      }
    c.fillStyle = night ? "#a0b4d8" : "#ffffff";
    for (let x = -4; x <= 4; x++) if ((x + Math.floor(s * 6)) % 3) c.fillRect(F.x + x, F.top, 1, 1);
    if (!night)
      for (let i = 0; i < 3; i++)
        c.drawImage(
          w.glows.mist,
          F.x - 10 + Math.round(Math.sin(s + i * 2) * 6) + (i - 1) * 6,
          F.pool - 14 + Math.round(Math.cos(s * 0.7 + i) * 2),
        );
    // glowing lines on the structure pulse; at night a beam rises from the gateway
    const pulse = 0.5 + 0.5 * Math.sin(s * 2);
    c.fillStyle = css(GLOW, 0.5 + pulse * 0.5);
    const mx = Math.round((M.x0 + M.x1) / 2);
    for (let y = 2; y < 28; y += 1)
      if ((y + Math.floor(s * 8)) % 6 < 3) {
        c.fillRect(mx - 11, M.top - y, 1, 1);
        c.fillRect(mx + 10, M.top - y, 1, 1);
      }
    for (const [px, py] of w.pylons) {
      c.fillStyle = css(GLOW);
      c.fillRect(px, py - 1, 1, 2);
      c.drawImage(w.glows.g, px - 6, py - 7);
    }
    if (night) {
      const [gx, gy] = w.gate;
      for (let y = gy; y > -2; y--) {
        const hw = 1 + (gy - y) * 0.02;
        c.fillStyle = `rgba(120,240,255,${0.35 + 0.1 * Math.sin(s * 3 + y * 0.2)})`;
        c.fillRect(Math.round(gx - hw), y, Math.round(hw * 2) + 1, 1);
      }
      c.drawImage(w.glows.g, gx - 6, gy - 6);
    }
    // dropships: descend to the mesa, hover, climb away
    for (let i = 0; i < 2; i++) {
      const per = 34,
        t = ((s + i * 17) % per) / per,
        x0 = M.x0 + 12 + i * 22;
      const y =
        t < 0.4 ? -10 + (t / 0.4) * (M.top - 16) : t < 0.6 ? M.top - 6 : M.top - 6 - ((t - 0.6) / 0.4) * (M.top + 10);
      const x = Math.round(x0 + (t > 0.6 ? (t - 0.6) * 60 : 0)),
        yy = Math.round(y);
      c.fillStyle = "#4a5266";
      c.fillRect(x - 4, yy, 9, 2);
      c.fillRect(x - 2, yy - 1, 5, 1);
      c.fillStyle = "#8a92a8";
      c.fillRect(x - 4, yy, 9, 1);
      c.fillStyle = "#ffcf70";
      if (t < 0.4 || t > 0.6) {
        c.fillRect(x - 3, yy + 2, 1, 1);
        c.fillRect(x + 3, yy + 2, 1, 1);
      }
      if (Math.floor(s * 3) % 2) {
        c.fillStyle = "#ff4040";
        c.fillRect(x - 5, yy, 1, 1);
      }
    }
    // a flock of birds drifting across in a V
    if (!e.wx.rain && !night) {
      const per = 60,
        t = (s % per) / per,
        bx = Math.round(W + 20 - t * (W + 80)),
        by = Math.round(H * 0.3 + Math.sin(s * 0.5) * 4);
      for (const b of w.birds)
        RS_PX.sprite(c, BIRD[Math.floor(s * 4 + b.dx) % 2], bx + b.dx * 2, by + b.dy * 2, { x: "#1a2030" });
    }
    // grass blades along the foreground ridge, swaying with the wind
    const wind = Math.min(3, (e.wx.wind || 5) / 8);
    for (const [gx, gp] of w.grass) {
      const top = Math.round(H * 0.84 - w.fore[Math.round(gx)] * H * 0.08),
        hgt = 2 + Math.round(gp * 4),
        lean = Math.sin(s * 2 + gx * 0.3) * wind * 0.5 + wind * 0.4;
      c.fillStyle = css(toner(e)(gp > 0.5 ? [110, 160, 90] : [70, 120, 70]));
      for (let k = 0; k < hgt; k++) c.fillRect(Math.round(gx + lean * (k / hgt)), top - k, 1, 1);
    }
    // haze over the forest floor
    {
      const m = w.mists[e.day < 0.4 ? "night" : "day"];
      if (m) {
        const ox = -Math.round((s * 3) % W);
        c.globalAlpha = e.wx.fog ? 0.9 : 0.45;
        c.drawImage(m, ox, Math.round(H * 0.64));
        c.drawImage(m, ox + W, Math.round(H * 0.64));
        c.globalAlpha = 1;
      }
    }
    // pollen drifting in the light by day; glowing motes over the forest at night
    w.motes ||= Array.from({ length: Math.round(W / 8) }, (_, i) => [hash(i, 1), hash(i, 2), hash(i, 3)]);
    if (!e.wx.rain && !e.wx.snow) {
      if (night) {
        w.glows.mote ||= glowSprite(3, GLOW, 0.8, 0.4);
        motes(c, w.motes, s, [0, H * 0.6, W, H * 0.3], {
          col: "#bff8ff",
          vx: 1,
          vy: -1,
          wob: 3,
          blink: 1.3,
          glow: w.glows.mote,
        });
      } else motes(c, w.motes, s, [0, H * 0.3, W, H * 0.6], { col: "rgba(255,250,215,0.7)", vx: 4, vy: -1.5, wob: 2 });
    }
    // weather
    if (e.wx.rain) {
      c.fillStyle = "rgba(180,200,240,0.55)";
      const n = Math.round(w.drops.length * Math.min(1, e.wx.rain + 0.2));
      for (let i = 0; i < n; i++) {
        const [px, py, sp] = w.drops[i];
        c.fillRect(
          Math.round((px * (W + 20) - ((py * H + s * 120 * sp) % H) * 0.2) % (W + 20)),
          Math.round((py * H + s * 120 * sp) % H),
          1,
          3,
        );
      }
    }
    if (e.wx.snow) {
      c.fillStyle = "#ffffff";
      for (const [px, py, sp] of w.drops)
        c.fillRect(Math.round(px * W + Math.sin(s + py * 20) * 3), Math.round((py * H + s * 14 * sp) % H), 1, 1);
    }
    if (e.wx.fog) {
      c.fillStyle = "rgba(210,220,230,0.4)";
      for (let y = Math.round(H * 0.45); y < H; y++)
        for (let x = y & 1; x < W; x += 2) if (bayer(x, y) < 0.55) c.fillRect(x, y, 1, 1);
    }
    if (e.wx.thunder && s % 10 < 0.12) {
      c.fillStyle = "rgba(255,255,255,0.5)";
      c.fillRect(0, 0, W, H);
    }
  }

  RS_SCENE.register("ringworld", { fps: 12, build, background, sky, land, frame });
})();
