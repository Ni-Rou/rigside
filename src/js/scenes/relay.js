"use strict";

// Relay: ring gate in orbit above a planet. The terminator follows the real time of day.
(() => {
  const { Buf, ramp, bayer, mix, css, glowSprite, shade, hash, softGlow, motes } = RS_PX;
  const { rng } = RS_SCENE;
  const CORE = [90, 170, 255];

  function build(W, H) {
    const r = rng(2183);
    const planet = { x: W * 0.45, y: H * 2.05, R: H * 1.32 };
    const gate = { x: Math.round(W * 0.7), y: Math.round(H * 0.36), rx: 30, ry: 24 };
    const station = { x: Math.round(W * 0.2), y: Math.round(H * 0.3), R: 17 };
    const stars = Array.from({ length: Math.round((W * H) / 40) }, () => [r(), r(), r()]);
    const roids = Array.from({ length: 6 }, (_, i) => ({
      y: H * (0.12 + r() * 0.6),
      sp: 3 + r() * 6,
      ph: r() * 400,
      R: 2 + Math.floor(r() * (i < 2 ? 5 : 3)),
      spin: r() * 2 - 1,
      seed: Math.floor(r() * 1e6),
    }));
    const ships = Array.from({ length: 4 }, () => ({
      ph: r() * 30,
      per: 16 + r() * 14,
      y0: H * (0.1 + r() * 0.6),
      x0: r() < 0.5 ? -10 : W * 0.3 * r(),
    }));
    const sats = Array.from({ length: 3 }, (_, i) => ({ ph: r() * 60, per: 40 + i * 13 }));
    return { W, H, planet, gate, station, stars, roids, ships, sats, glows: {}, clouds: null, cloudKey: "" };
  }

  // planet surface pattern (land/sea) and cloud field, in the planet's own coordinates
  const terr = (u, v) =>
    Math.sin(u * 0.028 + 1) * Math.cos(v * 0.05 + u * 0.011) +
    Math.sin(u * 0.083 + v * 0.031) * 0.45 +
    Math.sin(u * 0.21 - v * 0.13) * 0.18 +
    Math.sin(u * 0.53 + v * 0.4) * 0.07;
  const cloudV = (u, v) =>
    Math.sin(u * 0.05 + v * 0.3) + Math.sin(u * 0.13 - v * 0.17) * 0.7 + Math.sin(u * 0.31 + v * 0.11) * 0.4;

  // where the terminator sits: full day -> mostly lit, night -> mostly dark
  const terminator = (w, e) => w.W * (0.2 + e.day * 0.75);

  function background(g, w, e) {
    const { W, H, planet: Pl } = w,
      b = new Buf(g, W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        b.px(
          x,
          y,
          ramp(
            [
              [2, 2, 8],
              [4, 4, 14],
              [8, 6, 22],
            ],
            y / H,
            x,
            y,
            0.4,
          ),
        );
    // galaxy band: a diagonal lane of haze with a darker dust core
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const d = Math.abs(y - H * 0.75 + (x - W * 0.5) * 0.45) / (H * 0.18);
        if (d < 1) {
          const v = (1 - d) * (0.6 + 0.4 * Math.sin(x * 0.07 + y * 0.13));
          if (v * 0.6 > bayer(x, y))
            b.px(x, y, d < 0.3 && Math.sin(x * 0.2 - y * 0.3) > 0.6 ? [60, 40, 50] : [70, 60, 90], 0.5);
        }
      }
    // nebula clouds, magenta and teal, dithered
    for (const [cx, cy, R, col] of [
      [0.3, 0.2, 60, [180, 60, 160]],
      [0.85, 0.15, 45, [40, 140, 180]],
      [0.55, 0.05, 35, [120, 70, 200]],
    ])
      for (let y = -R; y <= R; y++)
        for (let x = -R * 1.6; x <= R * 1.6; x++) {
          const d = Math.sqrt((x / 1.6) ** 2 + y * y) / R + Math.sin(x * 0.1 + y * 0.2) * 0.12;
          if (d < 1 && (1 - d) * 0.55 > bayer(x, y)) b.px(W * cx + x, H * cy + y, col, 0.35);
        }
    for (const [px, py, p] of w.stars)
      b.px(px * W, py * H, p > 0.97 ? [255, 255, 255] : p > 0.85 ? [200, 210, 255] : [120, 120, 160], 0.5 + p * 0.5);
    // the planet: continents and seas, a terminator that follows the time of day, an atmosphere rim
    const tx = terminator(w, e);
    for (let y = Math.floor(Pl.y - Pl.R); y < H; y++)
      for (let x = 0; x < W; x++) {
        const dx = x - Pl.x,
          dy = y - Pl.y,
          d = Math.sqrt(dx * dx + dy * dy);
        if (d > Pl.R + 3) continue;
        if (d > Pl.R) {
          if (((Pl.R + 3 - d) / 3) * 0.8 > bayer(x, y)) b.px(x, y, [90, 170, 255], 0.6);
          continue;
        }
        const u = x * 1.0 + (y - (Pl.y - Pl.R)) * 0.6,
          v = (y - (Pl.y - Pl.R)) * 2.2,
          t = terr(u, v);
        const lat = Math.abs(Math.sin(u * 0.013 + 0.6));
        let c =
          t > 0.75
            ? [236, 236, 240]
            : t > 0.58
              ? [150, 120, 96]
              : t > 0.38
                ? lat > 0.7
                  ? [206, 184, 130]
                  : [70, 120, 60]
                : t > 0.24
                  ? [96, 146, 74]
                  : t > 0.18
                    ? [210, 200, 150]
                    : t > 0.05
                      ? [46, 120, 170]
                      : t > -0.3
                        ? [30, 84, 146]
                        : [20, 60, 120];
        const light = (tx - x) / 40 + 0.5;
        if (light < 1) {
          const k = Math.max(0, light);
          c = mix([6, 10, 24], c, k * k);
          if (light < 0.2 && t > 0.18 && t < 0.62) {
            const hh = (Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1,
              cl = Math.sin(u * 0.09) * Math.sin(v * 0.07 + 2);
            if (Math.abs(hh) < (cl > 0.3 ? 0.35 : 0.05)) c = Math.abs(hh) < 0.08 ? [255, 236, 170] : [230, 160, 80];
          }
        } // city lights
        if (light > 0.6 && light < 1.3) c = mix(c, [255, 160, 110], (1 - Math.abs(light - 0.95) / 0.35) * 0.3); // sunset band
        if (d > Pl.R - 2) c = mix(c, [120, 190, 255], light > 0.3 ? 0.6 : 0.3);
        b.px(x, y, c);
      }
    b.put(g);
  }

  function land(g, w) {
    const { gate: G } = w,
      b = new Buf(g, w.W, w.H);
    // the gate: a thick ring at an angle, panelled, a dark inner face, four pylons
    for (let y = -G.ry - 6; y <= G.ry + 6; y++)
      for (let x = -G.rx - 6; x <= G.rx + 6; x++) {
        const d = Math.sqrt((x / G.rx) ** 2 + (y / G.ry) ** 2);
        if (d < 0.78 || d > 1.12) continue;
        const an = Math.atan2(y / G.ry, x / G.rx),
          panel = Math.floor((an + Math.PI) / (Math.PI / 12)) % 2,
          lit = -Math.cos(an - 2.3);
        let c =
          d < 0.84
            ? [40, 44, 60]
            : ramp(
                [
                  [60, 64, 84],
                  [100, 106, 130],
                  [150, 156, 176],
                  [200, 206, 220],
                ],
                0.5 + lit * 0.45 + (panel ? 0.06 : -0.06),
                x,
                y,
                0.4,
              );
        if (d > 1.09 || Math.abs(d - 0.84) < 0.015) c = shade(c, -0.4);
        b.px(G.x + x, G.y + y, c);
      }
    for (const an of [0.6, 2.2, 3.8, 5.4]) {
      const ex = Math.cos(an) * G.rx * 1.25,
        ey = Math.sin(an) * G.ry * 1.25;
      for (let k = 0; k < 14; k++) {
        const t = k / 14,
          x = Math.round(G.x + Math.cos(an) * G.rx * 0.95 + (ex - Math.cos(an) * G.rx * 0.95) * t),
          y = Math.round(G.y + Math.sin(an) * G.ry * 0.95 + (ey - Math.sin(an) * G.ry * 0.95) * t);
        b.px(x, y, [170, 176, 196]);
        b.px(x + 1, y, [90, 96, 118]);
        b.px(x, y + 1, [70, 74, 94]);
      }
    }
    w.pylonTips = [0.6, 2.2, 3.8, 5.4].map((an) => [
      Math.round(G.x + Math.cos(an) * G.rx * 1.25),
      Math.round(G.y + Math.sin(an) * G.ry * 1.25),
    ]);
    b.put(g);
  }

  function sky(c, w, e, s) {
    const { W, H, planet: Pl } = w;
    // the sun just off the top left: glare and long spikes, stronger the more of the planet is lit
    if (!w.glows.sun) {
      w.glows.sun = softGlow(Math.round(H * 0.4), [255, 244, 220], 0.8);
      w.glows.ghost = [
        softGlow(6, [140, 220, 255], 0.25),
        softGlow(10, [255, 200, 140], 0.14),
        softGlow(4, [200, 160, 255], 0.3),
      ];
    }
    const sunA = 0.35 + e.day * 0.65,
      sx = Math.round(W * 0.06),
      sy = Math.round(H * 0.08),
      R = w.glows.sun.width >> 1;
    c.globalAlpha = sunA * (0.92 + 0.08 * Math.sin(s * 0.7));
    c.drawImage(w.glows.sun, sx - R, sy - R);
    c.globalAlpha = 1;
    for (let k = 1; k < 34; k++) {
      c.fillStyle = `rgba(255,246,225,${0.55 * sunA * (1 - k / 34) ** 2})`;
      c.fillRect(sx + k, sy, 1, 1);
      c.fillRect(sx - k, sy, 1, 1);
      if (k < 22) {
        c.fillRect(sx, sy + k, 1, 1);
        c.fillRect(sx, sy - k, 1, 1);
      }
    }
    c.fillStyle = "#fffaf0";
    c.fillRect(sx - 1, sy - 1, 3, 3);
    for (let i = 0; i < w.stars.length; i += 7) {
      const [px, py, p] = w.stars[i];
      if (Math.sin(s * (1 + p * 2) + p * 50) > 0.9) {
        c.fillStyle = "#ffffff";
        c.fillRect(Math.round(px * W), Math.round(py * H), 1, 1);
      }
    }
    // clouds drifting over the planet: baked once per light/cloud level, scrolled under a disc clip
    const key = `${Math.round(e.wx.clouds * 10)}|${Math.round(e.day * 10)}`;
    if (w.cloudKey !== key) {
      const cw = W * 2,
        top = Math.floor(Pl.y - Pl.R),
        tx = terminator(w, e),
        th = 0.9 - e.wx.clouds * 0.9;
      w.clouds = RS_PX.canvas(cw, H - top, (b) => {
        for (let y = 0; y < H - top; y++)
          for (let x = 0; x < cw; x++) {
            const v = cloudV(x * 1.1, y * 2.3);
            if (v > th + 0.6) {
              const light = (tx - (x % W)) / 40 + 0.5;
              b.px(x, y, light > 0.5 ? [250, 252, 255] : light > 0 ? [120, 120, 140] : [40, 44, 60], 0.9);
            }
          }
      });
      w.cloudTop = top;
      w.cloudKey = key;
    }
    c.save();
    c.beginPath();
    c.arc(Pl.x, Pl.y, Pl.R - 1, 0, Math.PI * 2);
    c.clip();
    const off = (s * 1.2) % W;
    c.drawImage(w.clouds, Math.round(-off), w.cloudTop);
    c.drawImage(w.clouds, Math.round(-off + W * 2), w.cloudTop);
    if (e.wx.thunder)
      for (let i = 0; i < 3; i++)
        if (Math.sin(s * 7 + i * 3) > 0.92) {
          const x = Math.round(W * (0.75 + i * 0.07)),
            y = Math.round(H * 0.86 + i * 4);
          c.fillStyle = "rgba(220,230,255,0.8)";
          c.fillRect(x - 1, y - 1, 3, 3);
          c.fillStyle = "rgba(220,230,255,0.3)";
          c.fillRect(x - 4, y - 3, 9, 7);
        }
    c.restore();
    for (const st of w.sats) {
      const t = ((s + st.ph) % st.per) / st.per,
        an = Math.PI * (1.1 + t * 0.8),
        x = Math.round(Pl.x + Math.cos(an) * (Pl.R + 6)),
        y = Math.round(Pl.y + Math.sin(an) * (Pl.R + 6));
      if (y < H) {
        c.fillStyle = Math.sin(s * 5 + st.ph) > 0.8 ? "#ffffff" : "#8a90a8";
        c.fillRect(x, y, 1, 1);
      }
    }
    {
      const per = 90,
        t = (s % per) / per;
      if (t < 0.2) {
        const k = t / 0.2,
          x = Math.round(W * (1.1 - k * 1.3)),
          y = Math.round(H * (0.05 + k * 0.25));
        for (let j = 0; j < 28; j++) {
          c.fillStyle = j < 2 ? "#ffffff" : `rgba(150,220,255,${0.7 * (1 - j / 28)})`;
          c.fillRect(x + Math.round(j * 1.3), y - Math.round(j * 0.3), 1, 1);
          if (j > 4 && j % 3 === 0) c.fillRect(x + Math.round(j * 1.3), y - Math.round(j * 0.3) + 1, 1, 1);
        }
      }
    }
  }

  function roidSprite(R, seed, rot) {
    const r = rng(seed),
      lumps = Array.from({ length: 7 }, () => 0.75 + r() * 0.35);
    return RS_PX.canvas(R * 2 + 3, R * 2 + 3, (b) => {
      for (let y = -R - 1; y <= R + 1; y++)
        for (let x = -R - 1; x <= R + 1; x++) {
          const an = Math.atan2(y, x) + rot,
            i = Math.floor(((((an / (Math.PI * 2)) % 1) + 1) % 1) * 7),
            rr = R * lumps[i];
          const d = Math.sqrt(x * x + y * y);
          if (d > rr) continue;
          const lit = (-x - y) / (R * 1.4);
          b.px(
            x + R + 1,
            y + R + 1,
            d > rr - 1 ? [70, 64, 70] : lit > 0.3 ? [200, 188, 172] : lit > -0.2 ? [140, 128, 118] : [86, 78, 76],
          );
        }
      b.px(R + 1 - Math.round(R * 0.3), R + 1, [50, 46, 46]);
    });
  }

  function frame(c, w, e, s) {
    const { W, H, gate: G, station: St } = w;
    if (!w.glows.core) {
      w.glows.core = glowSprite(14, CORE, 0.8, 0.35);
      w.glows.small = glowSprite(4, CORE, 0.8, 0.5);
      w.glows.flash = glowSprite(10, [220, 240, 255], 0.9, 0.6);
      w.roidImgs = w.roids.map((rd) => [0, 1, 2, 3].map((k) => roidSprite(rd.R, rd.seed, (k * Math.PI) / 2)));
    }
    // the gate's core: a pulsing blue star with a swirl inside the ring
    const pulse = 0.5 + 0.5 * Math.sin(s * 1.8);
    c.drawImage(w.glows.core, G.x - 14, G.y - 14);
    for (let i = 0; i < 24; i++) {
      const an = (i / 24) * Math.PI * 2 + s * 0.8,
        rr = 4 + (i % 3) * 4 + pulse * 2;
      c.fillStyle = css(mix(CORE, [255, 255, 255], (i % 3) / 3), 0.7);
      c.fillRect(Math.round(G.x + Math.cos(an) * rr * (G.rx / G.ry)), Math.round(G.y + Math.sin(an) * rr), 1, 1);
    }
    c.fillStyle = "#e8f4ff";
    c.fillRect(G.x - 1, G.y - 1, 3, 3);
    for (const [px, py] of w.pylonTips)
      if (Math.sin(s * 2 + px) > -0.2) {
        c.fillStyle = "#9ad0ff";
        c.fillRect(px, py, 1, 1);
        c.drawImage(w.glows.small, px - 4, py - 4);
      }
    // the ring station: a wheel at an angle, rotating spokes and lit windows on the rim, solar wings
    const rot = s * 0.15;
    c.fillStyle = "#6a7088";
    for (let k = 0; k < 4; k++) {
      const an = rot + (k * Math.PI) / 2;
      for (let j = 3; j < St.R; j++)
        c.fillRect(Math.round(St.x + Math.cos(an) * j), Math.round(St.y + Math.sin(an) * j * 0.38), 1, 1);
    }
    for (let i = 0; i < 80; i++) {
      const an = (i / 80) * Math.PI * 2 + rot,
        x = Math.round(St.x + Math.cos(an) * St.R),
        y = Math.round(St.y + Math.sin(an) * St.R * 0.38),
        front = Math.sin(an) > 0;
      c.fillStyle = front ? "#b8bed0" : "#5a6078";
      c.fillRect(x, y, 1, 2);
      if (i % 4 === 0) {
        c.fillStyle = front ? "#ffe0a0" : "#806040";
        c.fillRect(x, y + (front ? 1 : 0), 1, 1);
      }
    }
    c.fillStyle = "#a8aec0";
    c.fillRect(St.x - 2, St.y - 3, 5, 6);
    c.fillStyle = "#e8ecf4";
    c.fillRect(St.x - 2, St.y - 3, 5, 1);
    c.fillStyle = "#3a4a8a";
    c.fillRect(St.x - 12, St.y - 9, 8, 3);
    c.fillRect(St.x + 5, St.y - 9, 8, 3);
    c.fillStyle = "#6a7088";
    c.fillRect(St.x - 4, St.y - 8, 9, 1);
    if (Math.floor(s * 2) % 2) {
      c.fillStyle = "#ff4040";
      c.fillRect(St.x, St.y - 4, 1, 1);
    }
    // ships cruising into the gate: they shrink, flare and vanish
    for (const sh of w.ships) {
      const t = ((s + sh.ph) % sh.per) / sh.per;
      if (t > 0.85) {
        if (t < 0.9) c.drawImage(w.glows.flash, G.x - 10, G.y - 10);
        continue;
      }
      const k = t / 0.85,
        x = Math.round(sh.x0 + (G.x - sh.x0) * k),
        y = Math.round(sh.y0 + (G.y - sh.y0) * k),
        big = k < 0.5;
      c.fillStyle = "#c8ccd8";
      c.fillRect(x - (big ? 3 : 1), y, big ? 7 : 3, big ? 2 : 1);
      if (big) {
        c.fillStyle = "#6a7088";
        c.fillRect(x - 3, y + 1, 7, 1);
        c.fillRect(x - 1, y - 1, 3, 1);
      }
      c.fillStyle = "#7ad8ff";
      c.fillRect(x - (big ? 4 : 2), y, 1, 1);
      c.fillStyle = "rgba(120,200,255,0.4)";
      c.fillRect(x - (big ? 7 : 4), y, big ? 3 : 2, 1);
    }
    // the night side of the planet: aurora shimmering along the rim, lightning in the clouds
    const tx = W * (0.2 + e.day * 0.75),
      rimY = (x) => {
        const dx = x - w.planet.x;
        return Math.abs(dx) < w.planet.R ? w.planet.y - Math.sqrt(w.planet.R ** 2 - dx * dx) : null;
      };
    if (tx < W - 10) {
      for (let x = Math.max(0, Math.round(tx + 10)); x < W; x++) {
        const y0 = rimY(x);
        if (y0 == null) continue;
        const v = 0.5 + 0.5 * Math.sin(x * 0.07 + s * 0.8) * Math.sin(x * 0.023 - s * 0.3),
          h = 2 + Math.round(v * 4);
        for (let k = 1; k <= h; k++)
          if (bayer(x, k + Math.floor(s * 3)) < v * 0.8 * (1 - k / (h + 1))) {
            c.fillStyle = k > 3 ? "rgba(200,120,255,0.5)" : "rgba(110,255,170,0.6)";
            c.fillRect(x, Math.round(y0) - k, 1, 1);
          }
      }
      const per = 4.3,
        n = Math.floor(s / per);
      if (s % per < 0.25 && Math.sin(s * 40) > 0) {
        const lx = Math.round(tx + 20 + hash(n, 1) * Math.max(10, W - tx - 30)),
          ly0 = rimY(lx);
        if (ly0 != null) {
          const ly = Math.round(ly0 + 6 + hash(n, 2) * 18);
          c.drawImage(w.glows.small, lx - 4, ly - 4);
          c.fillStyle = "#e8f4ff";
          c.fillRect(lx, ly, 1, 1);
        }
      }
    }
    // meteors burning up as they hit the atmosphere
    {
      const per = 9,
        t = s % per,
        n = Math.floor(s / per);
      if (t < 0.9) {
        const mx = W * (0.15 + hash(n, 5) * 0.7),
          y1 = rimY(mx);
        if (y1 != null) {
          const k = t / 0.9,
            hx = Math.round(mx - 30 + k * 30),
            hyy = Math.round(y1 - 22 + k * 22);
          for (let j = 0; j < 12; j++) {
            c.fillStyle = `rgba(255,${200 - j * 10},${120 - j * 8},${(1 - j / 12) * (1 - k * 0.6)})`;
            c.fillRect(hx - j, hyy - j * 0.75, 1, 1);
          }
          c.fillStyle = "#fff4d0";
          c.fillRect(hx, hyy, 1, 1);
        }
      }
    }
    // lens flare ghosts along the line from the sun through the middle, by day
    if (e.day > 0.3) {
      const sx = W * 0.06,
        sy = H * 0.08;
      c.globalAlpha = (e.day - 0.3) / 0.7;
      for (const [i, t] of [0.55, 0.9, 1.25].entries()) {
        const g = w.glows.ghost[i];
        c.drawImage(
          g,
          Math.round(sx + (W / 2 - sx) * t * 1.4 - g.width / 2),
          Math.round(sy + (H / 2 - sy) * t * 1.4 - g.height / 2),
        );
      }
      c.globalAlpha = 1;
    }
    // faint dust drifting past
    w.dust ||= Array.from({ length: Math.round(W / 10) }, (_, i) => [hash(i, 7), hash(i, 8), hash(i, 9)]);
    motes(c, w.dust, s, [0, 0, W, H], { col: "rgba(200,210,255,0.35)", vx: -4, vy: 0.5, wob: 0 });
    // asteroids tumbling past in front
    for (const [i, rd] of w.roids.entries()) {
      const x = Math.round(W + 20 - ((rd.ph + s * rd.sp) % (W + 40))),
        y = Math.round(rd.y + Math.sin(s * 0.2 + i) * 2);
      const fr = Math.floor((((s * rd.spin * 0.6) % 4) + 4) % 4);
      c.drawImage(w.roidImgs[i][fr], x - rd.R - 1, y - rd.R - 1);
    }
  }

  RS_SCENE.register("relay", { fps: 12, build, background, sky, land, frame });
})();
