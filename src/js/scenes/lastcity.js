"use strict";

// Last City: walled city under a pale sphere, seen from a terrace.
(() => {
  const { Buf, ramp, bayer, H_, mix, css, skyRamp, toner, ridge, glowSprite, hash, mist, rays, motes, softGlow } =
    RS_PX;
  const { rng } = RS_SCENE;
  const SKY = {
    night: H_(["#04060f", "#080e22", "#0e1834", "#162444", "#203252"]),
    day: H_(["#3a6aa8", "#5a86b8", "#88a8c4", "#c4bca8", "#ecc89a"]), // a warm horizon even by day
    warm: H_(["#2a2a5a", "#5a4478", "#b06a78", "#f09a6a", "#ffcc88"]),
    grey: H_(["#5a6270", "#6a727e", "#7a828c", "#8a9098", "#9aa0a4"]),
  };

  function build(W, H) {
    const r = rng(1999),
      hy = Math.round(H * 0.62);
    const sph = { x: Math.round(W * 0.52), y: Math.round(H * 0.21), R: Math.round(H * 0.17) };
    const mL = ridge(r, W, [
        [46, 1],
        [16, 0.4],
        [6, 0.12],
      ]),
      mR = ridge(r, W, [
        [46, 1],
        [16, 0.4],
        [6, 0.12],
      ]);
    const towers = [];
    for (let i = 0; i < 26; i++) {
      const t = r(),
        x = Math.round(W * (0.3 + t * 0.42)),
        centre = 1 - Math.abs(t - 0.5) * 2;
      towers.push({
        x,
        w: 3 + Math.floor(r() * 4),
        h: Math.round(H * (0.08 + centre * 0.22 + r() * 0.08)),
        fin: r() < 0.5,
        garden: r() < 0.35,
        seed: r(),
      });
    }
    towers.sort((a, b) => b.h - a.h);
    const forest = ridge(r, W, [
      [30, 1],
      [9, 0.4],
    ]);
    const ships = Array.from({ length: 5 }, (_, i) => ({
      ph: r() * 40,
      per: 26 + r() * 20,
      y: H * (0.32 + r() * 0.2),
      dir: i % 2 ? 1 : -1,
      big: i === 0,
    }));
    const drops = Array.from({ length: Math.round((W * H) / 240) }, () => [r(), r(), 0.7 + r() * 0.6]);
    const stars = Array.from({ length: Math.round((W * H) / 120) }, () => [r(), r() * 0.55, r()]);
    return { W, H, hy, sph, mL, mR, towers, forest, ships, drops, stars, glows: {} };
  }

  function background(g, w, e) {
    const { W, H, hy, sph: S } = w,
      b = new Buf(g, W, H),
      sky = skyRamp(e, SKY),
      tone = toner(e);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b.px(x, y, ramp(sky, y / hy, x, y, 0.3));
    if (e.day < 0.5)
      for (const [px, py, p] of w.stars) b.px(px * W, py * H, [220, 230, 255], (1 - e.day * 2) * (0.3 + p * 0.7));
    // the sphere: faceted (a fixed pattern of plates), lit from the low sun, a bright rim, a soft halo
    const r = rng(5),
      facets = Array.from({ length: 26 }, () => [r() * 2 - 1, r() * 2 - 1, r()]);
    const halo = e.night ? [180, 200, 240] : [255, 240, 210];
    for (let y = -S.R - 8; y <= S.R + 8; y++)
      for (let x = -S.R - 8; x <= S.R + 8; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d > S.R) {
          const hd = (d - S.R) / 8;
          if (hd < 1 && (1 - hd) * 0.5 > bayer(x, y)) b.px(S.x + x, S.y + y, halo, 0.35);
          continue;
        }
        const nx = x / S.R,
          ny = y / S.R;
        let best = 0,
          bd = 9;
        for (let i = 0; i < facets.length; i++) {
          const dd = (nx - facets[i][0]) ** 2 + (ny - facets[i][1]) ** 2;
          if (dd < bd) {
            bd = dd;
            best = i;
          }
        }
        const lightF = -nx * 0.6 - ny * 0.5 + facets[best][2] * 0.35;
        let c = ramp(
          [
            [150, 156, 170],
            [196, 200, 210],
            [228, 230, 236],
            [250, 250, 252],
          ],
          0.45 + lightF * 0.5,
          x,
          y,
          0.3,
        );
        if (d > S.R - 1.5) c = e.night ? [210, 225, 255] : [255, 250, 236];
        b.px(S.x + x, S.y + y, e.night ? mix(c, [120, 140, 190], 0.35) : c);
      }
    // shards hanging near it
    for (const [dx, dy, sz] of [
      [1.35, 0.5, 4],
      [1.6, 0.1, 2],
      [-1.4, 0.7, 3],
      [1.2, 0.95, 2],
    ])
      for (let y = 0; y < sz; y++)
        for (let x = 0; x < sz + 1 - y; x++)
          b.px(S.x + dx * S.R + x, S.y + dy * S.R + y, e.night ? [150, 160, 190] : [210, 210, 220]);
    // light fanning down from under the sphere through the haze
    if (e.day > 0.3 && e.wx.clouds < 0.95)
      rays(b, S.x, S.y + S.R * 0.6, Math.PI / 2, {
        n: 7,
        len: H * 0.55,
        spread: 0.22,
        width: 0.07,
        col: e.glow > 0.3 ? [255, 210, 160] : [255, 248, 228],
        k: 0.2 * Math.min(1, (e.day - 0.3) * 2),
      });
    // snowy mountains on both sides, faceted by smoothed slope, hazed
    for (const [side, rr] of [
      [0, w.mL],
      [1, w.mR],
    ])
      for (let x = 0; x < W; x++) {
        const t = side ? (x - W * 0.55) / (W * 0.45) : (W * 0.45 - x) / (W * 0.45);
        if (t < 0) continue;
        const hAt = (xx) => {
          const tt = Math.max(0, side ? (xx - W * 0.55) / (W * 0.45) : (W * 0.45 - xx) / (W * 0.45));
          return (
            H * 0.66 -
            Math.pow(tt, 0.7) * H * 0.4 -
            rr[Math.max(0, Math.min(W - 1, xx))] * H * 0.12 * Math.min(1, tt * 3)
          );
        };
        const top = Math.round(hAt(x)),
          slope = (hAt(x + 6) - hAt(x - 6)) / 12,
          lit = slope > 0.1 ? 1 : slope < -0.1 ? -1 : 0;
        for (let y = top; y < hy + 10; y++) {
          const dd = y - top,
            snow = dd < 6 + rr[x] * 8 && top < H * 0.45;
          let c = snow
            ? lit > 0
              ? [250, 246, 240]
              : lit < 0
                ? [170, 180, 200]
                : [214, 218, 226]
            : lit > 0
              ? [120, 116, 120]
              : lit < 0
                ? [70, 72, 86]
                : [94, 94, 104];
          if (snow && dd > 3 && bayer(x, y) < 0.3) c = lit > 0 ? [150, 146, 146] : [90, 92, 106];
          b.px(x, y, mix(tone(c), sky[4], 0.35));
        }
      }
    b.put(g);
  }

  function land(g, w, e) {
    const { W, H, hy } = w,
      b = new Buf(g, W, H),
      tone = toner(e),
      night = e.day < 0.45,
      sky = skyRamp(e, SKY);
    const P = (x, y, c, a) => b.px(x, y, c, a);
    const haze = (c, k) => mix(tone(c), sky[4], k);
    // the city: towers back to front, hazed; fins, gardens, windows, beacons
    w.beacons = [];
    const base = hy + 2;
    for (const t of w.towers) {
      const k = 0.35 - (t.h / H) * 0.6,
        x0 = t.x - (t.w >> 1);
      for (let y = 0; y < t.h; y++) {
        const taper = y > t.h - 6 ? Math.round((y - (t.h - 6)) / 2.5) : 0;
        for (let x = x0 + taper; x < x0 + t.w - taper; x++) {
          const rel = x - x0;
          let c = rel === 0 ? [236, 232, 226] : rel === t.w - 1 ? [130, 134, 150] : [196, 196, 204];
          if (rel > 0 && rel < t.w - 1 && y % 3 === 1 && y < t.h - 6) {
            const lit = Math.sin(x * 7.1 + y * 3.3 + t.seed * 50) > (night ? -0.2 : 0.8);
            c = lit ? (night ? [255, 220, 150] : [240, 230, 200]) : night ? [40, 46, 70] : [150, 160, 180];
          }
          P(x, base - y, night && c[0] === 255 ? c : haze(c, Math.max(0, k)));
        }
      }
      if (t.fin)
        for (let y = Math.round(t.h * 0.3); y < t.h * 0.8; y++) {
          const off = Math.round((y - t.h * 0.3) * 0.15);
          P(x0 - 1 - off, base - y, haze([220, 220, 228], k));
          P(x0 + t.w + off, base - y, haze([150, 150, 166], k));
        }
      if (t.garden) {
        const gy = base - Math.round(t.h * 0.55);
        for (let x = x0 - 3; x < x0 + t.w + 3; x++) {
          P(x, gy, haze([220, 220, 226], k));
          P(x, gy - 1, haze([90, 150, 90], k));
          if ((x & 1) === 0) P(x, gy - 2, haze([70, 130, 80], k));
        }
      }
      w.beacons.push([t.x, base - t.h - 1, t.seed]);
    }
    // the great wall: across the valley, buttresses, a walkway of lights
    const wy = hy + 4;
    for (let x = Math.round(W * 0.18); x < W * 0.86; x++) {
      for (let y = wy; y < wy + 14; y++) {
        const rel = y - wy;
        P(
          x,
          y,
          tone(
            rel === 0
              ? [230, 226, 218]
              : rel === 1
                ? [160, 156, 150]
                : x % 16 < 3
                  ? [190, 186, 180]
                  : x % 16 > 13
                    ? [110, 108, 112]
                    : [150, 146, 144],
          ),
        );
      }
      if (x % 16 === 0) for (let y = wy - 3; y < wy; y++) P(x, y, tone([200, 196, 190]));
    }
    w.flood = [];
    for (let x = Math.round(W * 0.2); x < W * 0.86; x += 16) w.flood.push([x + 1, wy - 3]);
    // forested slopes either side and in front of the wall
    for (let x = 0; x < W; x++) {
      const edge = Math.max(0, Math.abs(x - W * 0.52) / (W * 0.5)),
        top = Math.round(hy + 22 - edge * edge * 34 - w.forest[x] * 5);
      for (let y = top; y < H; y++) P(x, y, tone(bayer(x, y) < 0.15 ? [36, 70, 50] : [26, 54, 40]));
      w.forestTop = w.forestTop || [];
      w.forestTop[x] = top;
    }
    // individual conifers along the slopes: lit on the left, dark on the right, rows going down
    const rt = rng(8);
    for (let row = 0; row < 5; row++)
      for (let i = 0; i < W / 4; i++) {
        const x = Math.round(rt() * W),
          top = w.forestTop[x] + row * 6 + Math.round(rt() * 3),
          th = 6 + Math.floor(rt() * 5);
        if (top > H) continue;
        for (let y = 0; y < th; y++) {
          const hw = Math.round((y / th) * 3);
          for (let k = -hw; k <= hw; k++)
            P(
              x + k,
              top + y,
              tone(k < 0 ? (y % 3 === 0 ? [80, 130, 80] : [56, 104, 66]) : k === 0 ? [44, 88, 58] : [28, 60, 44]),
            );
        }
      }
    // the terrace: stone floor, balustrade with posts and a rail, banner poles
    const ty = Math.round(H * 0.86);
    for (let y = ty; y < H; y++)
      for (let x = 0; x < W; x++) {
        const rel = y - ty;
        P(
          x,
          y,
          tone(
            rel < 2
              ? [214, 206, 190]
              : (x + (rel >> 2) * 8) % 16 === 0 || rel % 4 === 0
                ? [140, 132, 122]
                : [176, 168, 152],
          ),
        );
      }
    for (let x = 0; x < W; x++) {
      P(x, ty - 10, tone([236, 230, 216]));
      P(x, ty - 9, tone([180, 172, 158]));
    }
    for (let x = 2; x < W; x += 6)
      for (let y = ty - 8; y < ty; y++) {
        const bulge = y === ty - 5 || y === ty - 4 ? 1 : 0;
        P(x - bulge, y, tone([220, 214, 200]));
        P(x + 1, y, tone([170, 162, 148]));
        P(x + 2 + bulge - 1, y, tone([140, 132, 120]));
      }
    w.poles = [
      [Math.round(W * 0.08), ty - 10],
      [Math.round(W * 0.93), ty - 10],
    ];
    for (const [px, py] of w.poles) {
      for (let y = 0; y < H * 0.4; y++) {
        P(px, py - y, tone([90, 80, 70]));
        P(px + 1, py - y, tone([60, 52, 46]));
      }
      for (let k = -2; k <= 3; k++) P(px + k, py - Math.round(H * 0.4), tone([200, 170, 90]));
    }
    w.lanterns = [
      [Math.round(W * 0.3), ty - 12],
      [Math.round(W * 0.7), ty - 12],
    ];
    for (const [lx, ly] of w.lanterns) {
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 3; x++)
          P(
            lx + x,
            ly - y,
            x === 1 && y > 0 && y < 3 ? (night ? [255, 220, 140] : [220, 200, 160]) : tone([70, 60, 50]),
          );
    }
    b.put(g);
  }

  function sky(c, w, e, s) {
    const { W, H, sph: S } = w;
    // the sphere's halo breathing at night, and the odd shooting star
    if (e.day < 0.5) {
      w.glows.halo ||= softGlow(Math.round(S.R * 2.2), [190, 210, 255], 0.35);
      const R = w.glows.halo.width >> 1;
      c.globalAlpha = (1 - e.day * 2) * (0.6 + 0.4 * Math.sin(s * 0.4));
      c.drawImage(w.glows.halo, S.x - R, S.y - R);
      c.globalAlpha = 1;
      RS_PX.shootingStar(c, W, H, s, 27);
    }
    // clouds drifting beneath the sphere
    const n = 3 + Math.round(e.wx.clouds * 5);
    for (let i = 0; i < n; i++) {
      const x0 = ((i * 89 + s * (1.5 + i * 0.4)) % (W + 100)) - 70,
        y0 = S.y + S.R * (0.6 + (i % 3) * 0.35),
        cw = 26 + (i % 3) * 10;
      const top = e.night ? [70, 80, 110] : e.glow > 0.3 ? [255, 200, 160] : [250, 246, 240],
        under = e.night ? [40, 46, 70] : e.glow > 0.3 ? [200, 120, 110] : [190, 190, 200];
      for (let x = 0; x < cw; x++) {
        const hh = Math.round(Math.sin((x / cw) * Math.PI) * 4 + Math.sin(x * 0.7 + i) * 0.8);
        for (let y = -hh; y <= 1; y++) {
          c.fillStyle = css(y >= 0 ? under : top);
          c.fillRect(Math.round(x0 + x), Math.round(y0 + y), 1, 1);
        }
      }
    }
  }

  const BIRD = [
    ["x...x", ".x.x.", "..x.."],
    [".....", "xxxxx", "..x.."],
  ];
  const BANNER = (len, s, ph) =>
    Array.from({ length: len }, (_, y) => Math.round(Math.sin(s * 3 + y * 0.5 + ph) * (y / len) * 2));

  function frame(c, w, e, s) {
    const { W, H, hy } = w,
      night = e.day < 0.45;
    if (!w.glows.b) {
      w.glows.b = glowSprite(4, [255, 230, 160], 0.8, 0.45);
      w.glows.flood = glowSprite(7, [255, 240, 210], 0.6, 0.3);
    }
    // the city rising out of mist in the valley; its light hangs in the mist at night
    const M = night ? "night" : "day";
    w.mists ||= {};
    w.mists[M] ||= mist(W, 18, night ? [70, 80, 110] : [236, 232, 226], 0.85, 0.5, 9);
    {
      const ox = -Math.round((s * 2) % W);
      c.globalAlpha = e.wx.fog ? 1 : 0.75;
      c.drawImage(w.mists[M], ox, hy - 10);
      c.drawImage(w.mists[M], ox + W, hy - 10);
      c.globalAlpha = 1;
    }
    if (night) {
      w.glows.city ||= softGlow(Math.round(W * 0.2), [255, 200, 130], 0.22);
      const R = w.glows.city.width >> 1;
      c.drawImage(w.glows.city, Math.round(W * 0.51) - R, hy - 14 - R);
    }
    // dust drifting in the sunlight over the terrace
    if (!night && !e.wx.rain) {
      w.motes ||= Array.from({ length: Math.round(W / 9) }, (_, i) => [hash(i, 1), hash(i, 2), hash(i, 3)]);
      motes(c, w.motes, s, [0, H * 0.5, W, H * 0.45], { col: "rgba(255,244,214,0.6)", vx: 2, vy: -1, wob: 2 });
    }
    // beacon tips blink in sequence; floodlights on the wall at night
    for (const [bx, by, sd] of w.beacons)
      if (Math.sin(s * 1.5 + sd * 20) > 0.5) {
        c.fillStyle = night ? "#ffe0a0" : "#ff5040";
        c.fillRect(bx, by, 1, 1);
        if (night) c.drawImage(w.glows.b, bx - 4, by - 4);
      }
    if (night)
      for (const [fx, fy] of w.flood) {
        c.fillStyle = "#fff4d0";
        c.fillRect(fx, fy, 1, 1);
        c.drawImage(w.glows.flood, fx - 7, fy - 7);
        c.fillStyle = "rgba(255,240,200,0.1)";
        for (let k = 1; k < 30; k++)
          for (let j = -k * 0.15; j <= k * 0.15; j++)
            if (bayer(fx + j, fy - k) < 0.5) c.fillRect(Math.round(fx + j + k * 0.2), fy - k, 1, 1);
      }
    // ships on curving paths with contrails
    for (const sh of w.ships) {
      const t = ((s + sh.ph) % sh.per) / sh.per,
        x = sh.dir > 0 ? -20 + t * (W + 40) : W + 20 - t * (W + 40),
        y = sh.y - Math.sin(t * Math.PI) * 14;
      const vx = sh.dir,
        vy = (-Math.cos(t * Math.PI) * 14 * Math.PI) / (W + 40);
      c.fillStyle = e.night ? "rgba(180,190,220,0.25)" : "rgba(255,255,255,0.5)";
      for (let k = 2; k < 24; k++) {
        const tx = x - vx * k,
          ty = y - (vy * k * (W + 40)) / sh.per;
        if (bayer(Math.round(tx), Math.round(ty)) < 0.8 - k / 30) c.fillRect(Math.round(tx), Math.round(ty), 1, 1);
      }
      const xi = Math.round(x),
        yi = Math.round(y);
      c.fillStyle = e.night ? "#5a6078" : "#3a4258";
      if (sh.big) {
        c.fillRect(xi - 4, yi, 9, 2);
        c.fillRect(xi - 1, yi - 1, 3, 1);
        c.fillRect(xi - 6 * sh.dir, yi - 1, 2, 1);
      } else {
        c.fillRect(xi - 2, yi, 5, 1);
        c.fillRect(xi, yi - 1, 1, 1);
      }
      c.fillStyle = "#9ae8ff";
      c.fillRect(xi - (sh.big ? 5 : 3) * sh.dir, yi + (sh.big ? 1 : 0), 1, 1);
    }
    // a shuttle lifts off from the tower plaza now and then
    {
      const per = 70,
        t = (s % per) / per;
      if (t < 0.3) {
        const k = t / 0.3,
          x = Math.round(W * 0.52 + k * k * 20),
          y = Math.round(hy - k * k * hy * 1.1);
        c.fillStyle = "#e8e8ee";
        c.fillRect(x - 1, y - 4, 3, 5);
        c.fillStyle = "#9aa0b0";
        c.fillRect(x + 1, y - 4, 1, 5);
        for (let j = 1; j < 16; j++) {
          c.fillStyle = j < 3 ? "#fff0b0" : `rgba(240,240,240,${0.6 * (1 - j / 16)})`;
          c.fillRect(x - (j < 3 ? 0 : 1) - Math.round(j * k * 0.8), y + 1 + j, j < 3 ? 1 : 2, 1);
        }
      }
    }
    // birds over the valley
    if (!night && !e.wx.rain)
      for (let i = 0; i < 5; i++) {
        const bx = Math.round(((s * (5 + i) + i * 60) % (W + 30)) - 15),
          by = Math.round(H * 0.42 + i * 4 + Math.sin(s + i) * 3);
        RS_PX.sprite(c, BIRD[Math.floor(s * 4 + i) % 2], bx, by, { x: "#2a2a34" });
      }
    // banners stirring on the poles
    const wind = Math.min(2, (e.wx.wind || 5) / 10);
    for (const [i, [px, py]] of w.poles.entries()) {
      const top = py - Math.round(H * 0.4) + 1,
        len = Math.round(H * 0.22),
        off = BANNER(len, s * (0.6 + wind * 0.4), i);
      for (let y = 0; y < len; y++)
        for (let k = 0; k < 6; k++) {
          if (y > len - 3 && Math.abs(k - 2.5) < (y - (len - 3)) * 1.2) continue;
          c.fillStyle = css(
            toner(e)(k === 0 ? [200, 170, 90] : y % 8 < 1 ? [220, 190, 110] : i ? [70, 90, 150] : [150, 50, 50]),
          );
          c.fillRect(px + 2 + k + off[y], top + y, 1, 1);
        }
    }
    // lanterns glow at night
    if (night) for (const [lx, ly] of w.lanterns) c.drawImage(w.glows.b, lx - 3, ly - 6);
    // weather
    if (e.wx.rain) {
      c.fillStyle = "rgba(190,205,235,0.55)";
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
      c.fillStyle = "rgba(220,220,230,0.4)";
      for (let y = Math.round(hy * 0.7); y < H; y++)
        for (let x = y & 1; x < W; x += 2) if (bayer(x, y) < 0.55) c.fillRect(x, y, 1, 1);
    }
    if (e.wx.thunder && s % 10 < 0.12) {
      c.fillStyle = "rgba(255,255,255,0.45)";
      c.fillRect(0, 0, W, H);
    }
  }

  RS_SCENE.register("lastcity", { fps: 12, build, background, sky, land, frame });
})();
