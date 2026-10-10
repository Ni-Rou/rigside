"use strict";

// Wasteland: ruined city in green phosphor. Every colour comes from the 9-step ramp G.
(() => {
  const { Buf, bayer, ridge, sprite, hash, mist, softGlow } = RS_PX;
  const { rng } = RS_SCENE;
  const G = ["#020a04", "#05160a", "#0a2410", "#113818", "#1a5224", "#2a7434", "#46a452", "#84e488", "#ccffcc"].map(
    RS_PX.hex,
  );
  const g = (i) => G[Math.max(0, Math.min(8, Math.round(i)))];
  const C = (i) => RS_PX.css(g(i));

  function build(W, H) {
    const r = rng(2077),
      hy = Math.round(H * 0.62);
    const towers = [];
    for (let x = 4; x < W - 4;) {
      const tw = 8 + Math.floor(r() * 14);
      const nearMoon = Math.abs(x - W * 0.3) < 26;
      towers.push({
        x,
        w: tw,
        h: Math.round(H * (nearMoon ? 0.08 + r() * 0.06 : 0.1 + r() * 0.24)),
        broken: r() < 0.6,
        skel: r() < 0.5,
        lean: r() < 0.1 ? (r() < 0.5 ? -1 : 1) : 0,
        seed: r(),
      });
      x += tw + 4 + Math.floor(r() * 12);
    }
    const debris = ridge(r, W, [
      [30, 1],
      [8, 0.5],
    ]);
    const shanty = { x: Math.round(W * 0.7), y: Math.round(H * 0.8) };
    const dust = Array.from({ length: Math.round((W * H) / 150) }, () => [r(), r(), r()]);
    return { W, H, hy, towers, debris, shanty, dust, glows: {} };
  }

  function background(c, w, e) {
    const { W, H, hy } = w,
      b = new Buf(c, W, H);
    // sky: dark at the top, the horizon glowing; dust clouds in bands
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const v = y / hy,
          lvl = 0.3 + v * v * (e.night ? 2.6 : 3.4) + (bayer(x, y) - 0.5) * 0.7;
        b.px(x, y, g(Math.min(e.night ? 3 : 4, lvl)));
      }
    const r = rng(9);
    for (let i = 0; i < 10; i++) {
      const cy = hy * (0.08 + r() * 0.55),
        cx = r() * W,
        cw = 40 + r() * 70,
        ch = 2 + r() * 4;
      for (let y = -ch; y <= ch; y++)
        for (let x = -cw; x <= cw; x++) {
          const d = (x / cw) ** 2 + (y / ch) ** 2;
          if (d < 1 && (d < 0.7 || bayer(x, y) > 0.5)) b.px(cx + x, cy + y, g(y > ch * 0.3 ? 3 : 1));
        }
    }
    // the moon: big, pitted, a lit rim; by day a pale ringed sun
    const mx = Math.round(W * 0.3),
      my = Math.round(H * 0.2),
      R = e.night ? 15 : 9;
    for (let y = -R - 3; y <= R + 3; y++)
      for (let x = -R - 3; x <= R + 3; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d > R) {
          if (d < R + 3 && bayer(x, y) < 0.4) b.px(mx + x, my + y, g(4));
          continue;
        }
        const crater =
          e.night &&
          [
            [-5, -3, 4],
            [4, 5, 3],
            [6, -6, 2],
            [-3, 7, 2],
          ].some(([cx, cy, cr]) => (x - cx) ** 2 + (y - cy) ** 2 < cr * cr);
        b.px(mx + x, my + y, g(crater ? 6 : d > R - 1.5 ? 8 : x + y > R * 0.8 ? 6 : 7));
      }
    // far city: skyscraper skeletons, window grids, girders where the walls are gone, a leaning tower
    for (const T of w.towers) {
      for (let y = 0; y < T.h; y++) {
        const lean = T.lean * Math.round(y * 0.25),
          brokeTop = T.broken ? Math.round(hash(T.seed * 99, 1) * 8) : 0;
        for (let x = 0; x < T.w; x++) {
          if (T.broken && y > T.h - brokeTop - ((x * 3 + 7) % 6)) continue;
          const px = T.x + x + lean,
            py = hy - y,
            skeleton = T.skel && y > T.h * 0.55;
          if (skeleton) {
            if (x % 4 === 0 || y % 5 === 0 || x === T.w - 1) b.px(px, py, g(2));
            continue;
          }
          let v = x === 0 ? 3 : 2;
          if (x > 0 && x < T.w - 1 && y % 4 === 2 && x % 3 !== 0) v = hash(px, py) < (e.night ? 0.08 : 0.02) ? 6 : 1;
          b.px(px, py, g(v));
        }
      }
    }
    // the collapsed suspension bridge: towers, a sagging cable, a deck that drops into the water
    const bx0 = Math.round(W * 0.05),
      bx1 = Math.round(W * 0.38);
    for (const tx of [bx0 + 10, bx1 - 14])
      for (let y = 0; y < 34; y++) {
        b.px(tx, hy - y, g(3));
        b.px(tx + 3, hy - y, g(3));
        if (y % 8 === 0) for (let k = 0; k < 4; k++) b.px(tx + k, hy - y, g(3));
      }
    for (let x = bx0; x < bx1; x++) {
      const t = (x - bx0 - 10) / (bx1 - bx0 - 24);
      if (t < -0.3 || t > 1.3) continue;
      b.px(x, Math.round(hy - 33 + 24 * (1 - (2 * t - 1) ** 2)), g(3));
      if (t < 0.45 || t > 0.7) b.px(x, Math.round(hy - 10 + (t > 0.4 && t < 0.5 ? (t - 0.4) * 100 : 0)), g(3));
    }
    b.put(c);
  }

  function land(c, w, e) {
    const { W, H, hy, shanty: S } = w,
      b = new Buf(c, W, H);
    // mid-ground rubble field and the broken overpass with wrecks and a tattered billboard
    for (let x = 0; x < W; x++) {
      const top = Math.round(hy - w.debris[x] * 5);
      for (let y = top; y < H; y++) b.px(x, y, g(y === top ? 4 : 2 + ((x * 7 + y * 3) % 9 === 0 ? 1 : 0)));
    }
    const oy = Math.round(H * 0.66);
    for (let x = 0; x < W * 0.55; x++) {
      if (x > W * 0.33 && x < W * 0.4) continue;
      for (let y = 0; y < 5; y++)
        b.px(x, oy + y + (x > W * 0.4 ? Math.round((x - W * 0.4) * 0.15) : 0), g(y === 0 ? 5 : y === 4 ? 1 : 3));
    }
    for (const px of [W * 0.08, W * 0.24, W * 0.48])
      for (let y = oy + 5; y < H * 0.8; y++) for (let k = 0; k < 4; k++) b.px(px + k, y, g(k === 0 ? 4 : 2));
    for (const [cx, len] of [
      [W * 0.12, 9],
      [W * 0.27, 8],
    ]) {
      for (let y = 0; y < 3; y++) for (let x = 0; x < len; x++) b.px(cx + x, oy - 3 + y, g(y === 0 ? 5 : 3));
      b.px(cx + 1, oy - 1, g(1));
      b.px(cx + len - 2, oy - 1, g(1));
    }
    const bbx = Math.round(W * 0.16),
      bby = oy - 26;
    for (let y = 0; y < 15; y++)
      for (let x = 0; x < 30; x++) {
        if (y > 9 && x > 18 && (x + y) % 3) continue;
        b.px(
          bbx + x,
          bby + y,
          g(x === 0 || y === 0 || x === 29 ? 5 : y > 3 && y < 8 && x > 3 && x < 26 && x % 5 < 3 ? 6 : 3),
        );
      }
    for (const lx of [bbx + 6, bbx + 22]) for (let y = bby + 15; y < oy; y++) b.px(lx, y, g(3));
    // water tower, radio mast, the turbine's tower (blades turn in frame)
    const wx = Math.round(W * 0.56),
      wy = Math.round(H * 0.5);
    for (let y = 0; y < 9; y++)
      for (let x = -7; x <= 7; x++) b.px(wx + x, wy + y, g(x < -4 ? 5 : x > 4 ? 2 : y % 3 === 0 ? 3 : 4));
    for (let y = 0; y < 3; y++) for (let x = -7 + y * 2; x <= 7 - y * 2; x++) b.px(wx + x, wy - 1 - y, g(4));
    for (const lx of [-6, -2, 2, 6])
      for (let y = wy + 9; y < hy + 4; y++) b.px(wx + lx + Math.round((y - wy) * (lx > 0 ? 0.05 : -0.05)), y, g(3));
    for (let y = wy + 12; y < hy; y += 6)
      for (let x = -6; x <= 6; x++) b.px(wx + x + ((y / 6) % 2 ? x * 0 : 0), y + Math.round(x * 0.4), g(2));
    const mx = Math.round(W * 0.86);
    for (let y = 0; y < 60; y++) {
      const hw = Math.round(4 - y / 16);
      b.px(mx - hw, hy - y, g(4));
      b.px(mx + hw, hy - y, g(3));
      if (y % 4 === 0) for (let k = -hw; k <= hw; k++) b.px(mx + k, hy - y - ((k + hw) % 2), g(3));
    }
    w.mastTop = [mx, hy - 61];
    const tx = Math.round(W * 0.44);
    for (let y = 0; y < 44; y++) {
      b.px(tx, hy - y, g(5));
      b.px(tx + 1, hy - y, g(3));
    }
    w.hub = [tx, hy - 45];
    // the shanty town: stacked scrap shacks with lit windows, a lookout
    for (const [dx, dy, sw, sh] of [
      [-22, 0, 16, 10],
      [-8, 0, 14, 13],
      [5, 0, 18, 9],
      [-14, -10, 12, 8],
      [2, -9, 10, 9],
      [18, -16, 4, 25],
    ]) {
      for (let y = 0; y < sh; y++)
        for (let x = 0; x < sw; x++)
          b.px(
            S.x + dx + x,
            S.y + dy - y,
            g(y === sh - 1 ? 5 : x === 0 ? 4 : (x * 5 + y * 3) % 7 === 0 ? 2 : (x >> 2) % 2 ? 3 : 4),
          );
      if (sw > 6)
        for (let k = 0; k < 2; k++) {
          b.px(S.x + dx + 3 + k, S.y + dy - sh + 4, g(e.night ? 8 : 1));
          b.px(S.x + dx + 3 + k, S.y + dy - sh + 5, g(e.night ? 7 : 1));
        }
    }
    w.fire = [S.x - 30, S.y + 2];
    // the road: cracked asphalt with faded lane markings converging towards the city
    const ry = Math.round(H * 0.8);
    for (let y = ry; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = (y - ry) / (H - ry),
          cx = W * 0.4 + (x - W * 0.4) / (0.4 + t * 1.6);
        let v = Math.abs(cx - W * 0.4) < W * 0.25 ? 2 : 3;
        if (Math.abs(cx - W * 0.4) < 1.5 && Math.floor(y * 0.5 + t * 4) % 2 === 0 && hash(Math.floor(y / 3), 7) < 0.6)
          v = 5;
        if (Math.abs(Math.sin(x * 0.11 + y * 0.7) + Math.sin(x * 0.05 - y * 0.3)) < 0.04) v = 1;
        b.px(x, y, g(v));
      }
    // the car wreck, tyres, a bent sign, dead trees
    const cx = Math.round(W * 0.14),
      cy = Math.round(H * 0.9);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 26; x++) {
        if (y < 3 && (x < 6 || x > 19)) continue;
        b.px(
          cx + x,
          cy - y,
          g(y === 7 || (y === 2 && (x < 6 || x > 19)) ? 6 : y > 3 && y < 7 && x > 7 && x < 18 ? 1 : x === 0 ? 5 : 4),
        );
      }
    for (const tx2 of [cx + 4, cx + 20])
      for (let y = -2; y <= 2; y++)
        for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) b.px(tx2 + x, cy + 1 + y, g(x * x + y * y < 2 ? 3 : 1));
    for (const [t1, t2] of [
      [W * 0.32, H * 0.95],
      [W * 0.36, H * 0.97],
    ])
      for (let y = -2; y <= 2; y++)
        for (let x = -3; x <= 3; x++)
          if ((x * x) / 9 + (y * y) / 4 <= 1) b.px(t1 + x, t2 + y, g((x * x) / 9 + (y * y) / 4 < 0.3 ? 2 : 4));
    const sx = Math.round(W * 0.62);
    for (let y = 0; y < 18; y++) b.px(sx + Math.round(y > 10 ? (y - 10) * 0.4 : 0), H - 4 - y, g(5));
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 9; x++)
        b.px(sx + 3 + x, H - 26 + y + Math.round(x * 0.3), g(x === 0 || y === 0 || x === 8 || y === 6 ? 7 : 4));
    for (const [dx, h] of [
      [W * 0.04, 54],
      [W * 0.95, 46],
    ]) {
      for (let y = 0; y < h; y++) {
        b.px(dx, H - y, g(5));
        b.px(dx + 1, H - y, g(3));
      }
      const r = rng(Math.floor(dx));
      for (let i = 0; i < 7; i++) {
        let x = dx,
          y = H - h * (0.45 + r() * 0.5);
        const dir = r() < 0.5 ? -1 : 1;
        for (let k = 0; k < 6 + r() * 10; k++) {
          x += dir;
          y -= 0.5 + k * 0.05;
          b.px(x, y, g(4));
        }
      }
    }
    // power lines sagging between leaning poles
    const poles = [
      [W * 0.22, H * 0.72, 22],
      [W * 0.5, H * 0.74, 20],
      [W * 0.78, H * 0.72, 22],
    ];
    for (const [px, py, ph] of poles) {
      for (let y = 0; y < ph; y++) b.px(px + Math.round(y * 0.08), py - y, g(4));
      for (let k = -4; k <= 4; k++) b.px(px + 2 + k, py - ph + 2, g(4));
    }
    for (let i = 0; i < poles.length - 1; i++) {
      const [x0, y0, h0] = poles[i],
        [x1, y1, h1] = poles[i + 1];
      for (let x = Math.round(x0); x < x1; x++) {
        const t = (x - x0) / (x1 - x0);
        b.px(x, y0 - h0 + 2 + (y1 - h1 - y0 + h0) * t + Math.sin(t * Math.PI) * 8, g(3));
      }
    }
    b.put(c);
  }

  function sky(c, w, e, s) {
    const { W, H, hy } = w;
    // the ruins give off a faint glow
    w.glows.rad ||= softGlow(Math.round(W * 0.22), g(6), 0.2);
    {
      const R = w.glows.rad.width >> 1;
      c.globalAlpha = 0.6 + 0.4 * Math.sin(s * 0.5);
      c.drawImage(w.glows.rad, Math.round(W * 0.45) - R, hy - 18 - R);
      c.globalAlpha = 1;
    }
    // a radiation storm flickering on the horizon at night: the sky lights, a bolt drops
    if (e.day < 0.4) {
      const per = 37,
        t = s % per,
        n = Math.floor(s / per);
      if (t < 0.6 && Math.sin(t * 60) > -0.2) {
        let x = Math.round(W * (0.1 + hash(n, 1) * 0.8)),
          y = Math.round(H * 0.12);
        c.fillStyle = C(3);
        c.globalAlpha = 0.25;
        c.fillRect(0, 0, W, hy);
        c.globalAlpha = 1;
        c.fillStyle = C(8);
        while (y < hy - 4) {
          const nx = x + Math.round((hash(x, y + n) - 0.5) * 8);
          for (let j = 0; j < 3; j++) c.fillRect(Math.round(x + ((nx - x) * j) / 3), y + j, 1, 1);
          x = nx;
          y += 3;
        }
      }
    }
    // vultures circling high
    for (let i = 0; i < 3; i++) {
      const an = s * 0.2 + i * 2.1,
        x = Math.round(W * 0.6 + Math.cos(an) * 30),
        y = Math.round(w.H * 0.18 + Math.sin(an) * 7),
        up = Math.floor(s * 2 + i) % 2;
      c.fillStyle = C(1);
      c.fillRect(x - 3, y - up, 3, 1);
      c.fillRect(x, y, 2, 1);
      c.fillRect(x + 2, y - up, 3, 1);
    }
  }

  const WANDERER = [
    ["..77..", ".7777.", "..66..", ".5555.", "555555", "5.55.5", ".5..5.", ".5..5.", "44..44"],
    ["..77..", ".7777.", "..66..", ".5555.", "555555", "5.55.5", ".5.5..", "..5.5.", ".44.44"],
  ];
  const DOG = [
    ["......55", "5....555", "5555555.", ".555555.", ".5.5..5.", "5..5..5."],
    ["......55", ".....555", "5555555.", "5555555.", "..55.55.", ".5..5..."],
  ];

  function frame(c, w, e, s) {
    const { W, H, hy } = w;
    // turbine blades turning
    const [hx, hyy] = w.hub,
      an = s * 0.6;
    for (let k = 0; k < 3; k++) {
      const a = an + (k * Math.PI * 2) / 3;
      c.fillStyle = C(6);
      for (let j = 1; j < 14; j++)
        c.fillRect(Math.round(hx + Math.cos(a) * j), Math.round(hyy + Math.sin(a) * j), 1, 1);
    }
    c.fillStyle = C(7);
    c.fillRect(hx - 1, hyy - 1, 3, 3);
    // the mast light blinking
    if (Math.floor(s * 1.4) % 2) {
      c.fillStyle = C(8);
      c.fillRect(w.mastTop[0], w.mastTop[1], 1, 2);
      c.fillStyle = C(5);
      c.fillRect(w.mastTop[0] - 1, w.mastTop[1], 3, 1);
    }
    // the camp fire
    {
      const [fx, fy] = w.fire;
      for (let k = -2; k <= 2; k++) {
        const h = 2 + Math.round(Math.abs(Math.sin(s * 9 + k * 1.7)) * 4 * (1 - Math.abs(k) / 3));
        for (let y = 0; y < h; y++) {
          c.fillStyle = C(y < h / 2 ? 8 : 6);
          c.fillRect(fx + k, fy - y, 1, 1);
        }
      }
      c.fillStyle = C(5);
      for (let yy = -6; yy <= 4; yy++)
        for (let xx = -7; xx <= 7; xx++) {
          const d = Math.sqrt(xx * xx + yy * yy) / 7;
          if (d < 1 && (1 - d) * 0.35 > bayer(fx + xx, fy + yy)) c.fillRect(fx + xx, fy + yy, 1, 1);
        }
    }
    // the wanderer and their dog walking the road
    {
      const per = 70,
        t = (s % per) / per,
        x = Math.round(-12 + t * (W + 24)),
        y = Math.round(H * 0.85),
        st = Math.floor(s * 4) % 2;
      sprite(c, WANDERER[st], x, y - 9, { 4: C(4), 5: C(5), 6: C(6), 7: C(7) });
      sprite(c, DOG[st], x + 9, y - 6, { 5: C(5) });
    }
    // tumbleweed bouncing along with the wind
    {
      const per = 30,
        t = (s % per) / per,
        x = Math.round(t * (W + 20) - 10),
        y = Math.round(H * 0.92 - Math.abs(Math.sin(s * 3)) * 4);
      c.fillStyle = C(5);
      for (let a = 0; a < 12; a++) {
        const aa = (a / 12) * Math.PI * 2 + s * 4;
        c.fillRect(Math.round(x + Math.cos(aa) * 3), Math.round(y + Math.sin(aa) * 3), 1, 1);
      }
      c.fillRect(x, y, 1, 1);
    }
    // banks of dust rolling across the flats
    w.dustBank ||= mist(W, 20, g(4), 0.8, 0.55, 13);
    for (const [y, sp, a] of [
      [hy - 8, 3, 0.7],
      [Math.round(H * 0.83), 6, 0.45],
    ]) {
      const ox = -Math.round((s * sp) % W);
      c.globalAlpha = a;
      c.drawImage(w.dustBank, ox, y);
      c.drawImage(w.dustBank, ox + W, y);
    }
    c.globalAlpha = 1;
    // a patrol aircraft crossing, twin rotors, a searchlight sweeping the ground at night
    {
      const per = 75,
        t = (s % per) / per;
      if (t < 0.35) {
        const k = t / 0.35,
          vx = Math.round(W + 30 - k * (W + 60)),
          vy = Math.round(H * 0.3 + Math.sin(s * 0.9) * 2);
        if (e.day < 0.5) {
          const aim = Math.sin(s * 0.7) * 0.35,
            len = Math.round(H * 0.82) - vy;
          for (let y = 3; y < len; y++) {
            const hw = 0.5 + y * 0.12;
            c.fillStyle = `rgba(${g(7).join(",")},${0.1 * (1 - y / len / 2)})`;
            c.fillRect(Math.round(vx + y * aim - hw), vy + y, Math.round(hw * 2) + 1, 1);
          }
        }
        c.fillStyle = C(1);
        c.fillRect(vx - 6, vy, 13, 3);
        c.fillRect(vx + 7, vy + 1, 6, 1);
        c.fillRect(vx - 9, vy - 2, 4, 1);
        c.fillRect(vx + 6, vy - 2, 4, 1);
        const sp = Math.floor(s * 12) % 2;
        c.fillStyle = C(2);
        c.fillRect(vx - 7 - (sp ? 4 : 0), vy - 3, 6 + (sp ? 4 : 0), 1);
        c.fillRect(vx + 5 - (sp ? 2 : 0), vy - 3, 6 + (sp ? 4 : 0), 1);
        c.fillStyle = Math.floor(s * 2) % 2 ? C(8) : C(5);
        c.fillRect(vx - 6, vy + 1, 1, 1);
      }
    }
    // dust blowing on the wind
    const wind = Math.min(3, (e.wx.wind || 5) / 6);
    for (const [px, py, p] of w.dust) {
      const x = Math.round((px * W + s * (10 + wind * 10) * (0.5 + p)) % W),
        y = Math.round(py * H + Math.sin(s + p * 20) * 2);
      if (p > 0.6) {
        c.fillStyle = C(p > 0.9 ? 6 : 4);
        c.fillRect(x, y, 1, 1);
      }
    }
    // weather in phosphor
    if (e.wx.rain) {
      c.fillStyle = C(5);
      for (let i = 0; i < ((W * H) / 260) * Math.min(1, e.wx.rain + 0.2); i++) {
        const [px, py, p] = w.dust[i % w.dust.length];
        c.fillRect(Math.round(px * W), Math.round((py * H + s * 100 * (0.6 + p)) % H), 1, 2);
      }
    }
    if (e.wx.snow) {
      c.fillStyle = C(7);
      for (const [px, py, p] of w.dust)
        c.fillRect(Math.round(px * W + Math.sin(s + py * 20) * 3), Math.round((py * H + s * 12 * (0.6 + p)) % H), 1, 1);
    }
    if (e.wx.fog) {
      c.fillStyle = C(3);
      for (let y = Math.round(hy * 0.6); y < H; y++)
        for (let x = y & 1; x < W; x += 2) if (bayer(x, y) < 0.45) c.fillRect(x, y, 1, 1);
    }
    if (e.wx.thunder && s % 10 < 0.15) {
      let x = Math.round(W * (0.55 + (Math.floor(s / 10) % 3) * 0.12)),
        y = 0;
      c.fillStyle = C(8);
      while (y < hy - 10) {
        const nx = x + Math.round((hash(x, y + Math.floor(s)) - 0.5) * 8);
        for (let k = 0; k < 4; k++) c.fillRect(Math.round(x + ((nx - x) * k) / 4), y + k, 1, 1);
        x = nx;
        y += 4;
      }
    }
    // the refresh band rolling down the screen
    const band = Math.round((s * 18) % (H + 30)) - 15;
    c.fillStyle = "rgba(140,255,150,0.06)";
    c.fillRect(0, band, W, 6);
    c.fillStyle = "rgba(140,255,150,0.04)";
    c.fillRect(0, band + 6, W, 4);
  }

  RS_SCENE.register("wasteland", { build, background, sky, land, frame });
})();
