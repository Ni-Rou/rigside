"use strict";

// The Zone: abandoned exclusion zone. A blowout every ~10 minutes.
(() => {
  const { Buf, mist, ramp, bayer, H_, mix, css, skyRamp, toner, ridge, glowSprite, shade, sprite, hash, clamp01 } =
    RS_PX;
  const { rng } = RS_SCENE;
  const SKY = {
    night: H_(["#060a08", "#0a100c", "#0e1610", "#141c14", "#1a2218"]),
    day: H_(["#4c5048", "#5c5e50", "#6e6e5a", "#808064", "#908c6c"]),
    warm: H_(["#3a2a2a", "#6a3a2e", "#9a5034", "#c0703c", "#d8904a"]),
    grey: H_(["#484a46", "#545650", "#62645c", "#6e7066", "#7c7e72"]),
  };

  function build(W, H) {
    const r = rng(1986),
      hy = Math.round(H * 0.62);
    const blocks = [];
    for (let x = Math.round(W * 0.05); x < W * 0.58;) {
      const bw = 18 + Math.floor(r() * 14);
      blocks.push({ x, w: bw, h: 22 + Math.floor(r() * 26), seed: r() });
      x += bw + 3 + Math.floor(r() * 8);
    }
    const birches = [W * 0.04, W * 0.11, W * 0.86, W * 0.93, W * 0.97].map((x, i) => ({
      x: Math.round(x),
      h: H * (0.45 + (i % 3) * 0.12),
      seed: i * 7 + 3,
    }));
    const poles = [W * 0.2, W * 0.5, W * 0.8].map((x, i) => ({
      x: Math.round(x),
      h: 40 - i * 4,
      lean: [0.12, -0.05, 0.08][i],
    }));
    const field = ridge(r, W, [
      [60, 1],
      [20, 0.3],
    ]);
    const grass = Array.from({ length: Math.round(W * 1.2) }, () => [r() * W, r(), r()]);
    const anoms = [
      { x: W * 0.36, y: H * 0.82, R: 9 },
      { x: W * 0.7, y: H * 0.88, R: 7 },
    ];
    const debris = Array.from({ length: 8 }, () => [r() * 6, r(), r()]);
    const crows = Array.from({ length: 5 }, () => [r() * 6, 8 + r() * 14, r()]);
    const drops = Array.from({ length: Math.round((W * H) / 240) }, () => [r(), r(), 0.7 + r() * 0.6]);
    return { W, H, hy, blocks, birches, poles, field, grass, anoms, debris, crows, drops, glows: {} };
  }

  function background(g, w, e) {
    const { W, H, hy } = w,
      b = new Buf(g, W, H),
      sky = skyRamp(e, SKY),
      tone = toner(e);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b.px(x, y, ramp(sky, y / hy, x, y, 0.35));
    // a pale sun smothered by the overcast
    const sunVis = e.day > 0.2 && e.wx.clouds < 0.97 ? (1 - e.wx.clouds * 0.6) * Math.min(1, e.day * 1.5) : 0;
    const sunX = Math.round(W * (0.08 + 0.84 * clamp01(e.sun))),
      sunY = Math.round(hy * (0.8 - Math.sin(Math.PI * clamp01(e.sun)) * 0.5));
    if (sunVis)
      for (let y = -24; y <= 24; y++)
        for (let x = -24; x <= 24; x++) {
          const d = Math.sqrt(x * x + y * y);
          if (d <= 5) b.px(sunX + x, sunY + y, [236, 232, 204], 0.25 + 0.5 * sunVis);
          else if (d < 24 && bayer(x, y) < (1 - d / 24) * 0.55 * sunVis) b.px(sunX + x, sunY + y, [214, 210, 176], 0.3);
        }
    // overcast in heavy layered bands, darker undersides
    const r = rng(77);
    for (let i = 0; i < 14; i++) {
      const cy = hy * (0.05 + r() * 0.6),
        cx = r() * W,
        cw = 50 + r() * 90,
        ch = 3 + r() * 5;
      for (let y = -ch; y <= ch; y++)
        for (let x = -cw; x <= cw; x++) {
          const d = (x / cw) ** 2 + (y / ch) ** 2 + Math.sin(x * 0.2 + i) * 0.1;
          if (d > 1) continue;
          const under = (y + ch) / (2 * ch);
          if (d < 0.75 || bayer(x, y) > (d - 0.75) * 4)
            b.px(
              cx + x,
              cy + y,
              mix(shade(sky[Math.min(4, Math.round((cy / hy) * 4))], 0.08), shade(sky[1], -0.25), under * 0.8),
            );
        }
    }
    // light falling through the gaps in the cloud
    if (sunVis)
      for (let k = 0; k < 6; k++) {
        const an = Math.PI / 2 + (k - 2.5) * 0.22 + Math.sin(k * 3.7) * 0.05;
        for (let t = 8; t < hy * 1.1; t++) {
          const cx = sunX + Math.cos(an) * t,
            cy = sunY + Math.sin(an) * t,
            hw = 0.5 + t * 0.045;
          for (let j = -hw; j <= hw; j++) {
            const x = Math.round(cx + j),
              y = Math.round(cy);
            if (bayer(x, y) < 0.3 * sunVis * (1 - t / (hy * 1.1))) b.px(x, y, [226, 222, 186], 0.22);
          }
        }
      }
    // the power plant: two cooling towers (hyperboloid), a reactor block, a striped chimney
    const haze = (c) => mix(tone(c), sky[4], 0.5);
    const px = Math.round(W * 0.72),
      base = hy + 2;
    for (const [cx, R0, h] of [
      [px, 11, 30],
      [px + 26, 9, 24],
    ])
      for (let y = 0; y < h; y++) {
        const t = y / h,
          hw = Math.round(R0 * (0.72 + 0.28 * (2 * t - 1.1) ** 2));
        for (let k = -hw; k <= hw; k++)
          b.px(cx + k, base - y, haze(k < -hw * 0.4 ? [150, 150, 140] : k > hw * 0.5 ? [90, 92, 88] : [120, 120, 112]));
      }
    for (let y = 0; y < 16; y++)
      for (let x = -14; x < 6; x++)
        b.px(
          px - 30 + x,
          base - y,
          haze(y === 15 ? [110, 108, 100] : x % 4 === 0 && y % 4 === 1 ? [60, 60, 58] : [96, 96, 90]),
        );
    for (let y = 0; y < 50; y++)
      for (let k = 0; k < 3; k++)
        b.px(px - 26 + k, base - 16 - y, haze(Math.floor(y / 6) % 2 ? [160, 60, 50] : [190, 190, 180]));
    w.chimTop = [px - 25, base - 67];
    w.plant = [px - 14, base - 14];
    // panel blocks: grids of dark windows, a few broken, hazed
    for (const B of w.blocks)
      for (let y = 0; y < B.h; y++)
        for (let x = 0; x < B.w; x++) {
          let c = x === 0 ? [140, 138, 128] : x === B.w - 1 ? [80, 80, 76] : [112, 110, 102];
          if (x > 1 && x < B.w - 2 && y > 1 && y % 4 < 2 && x % 3 < 2)
            c = Math.sin(x * 7.7 + y * 3.1 + B.seed * 90) > 0.85 ? [70, 66, 58] : [36, 38, 36];
          if (y % 4 === 3) c = shade(c, -0.12);
          b.px(B.x + x, base - y, mix(tone(c), sky[4], 0.35));
        }
    b.put(g);
  }

  const HELI = [
    "...........m....................",
    ".rrrrrrrrrrmrrrr................",
    "..........KKK...rrrrrr..........",
    ".......KKKKKKKKKK.....rrrrr.....",
    "....gKKKKKKKKKKKKKKKK.......rr..",
    "...ggkkkkkkkkkkkkkkkkKKKK.......",
    "..gggkkhhkkkkkkkkkkkkkkkkKKKK...",
    "..ggkkkhhkkkkkkkkkkkkk...kkkkK..",
    "...kkkkkkkkkkkkkkkkkk......kkk..",
    "....kkkkkkkkkkkkkkkk.......kk...",
    "....d...d.........d.............",
  ];
  // A text sprite into a Buf, toned like the rest of the land
  function stamp(b, tone, rows, x, y, pal) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (pal[row[i]]) b.px(x + i, y + j, tone(pal[row[i]]));
    });
  }

  function land(g, w, e) {
    const { W, H, hy } = w,
      b = new Buf(g, W, H),
      tone = toner(e);
    const P = (x, y, c) => b.px(x, y, tone(c));
    // the Ferris wheel: a rusted rim, spokes, cars, A-frame legs
    const fx = Math.round(W * 0.53),
      fy = Math.round(hy - 26),
      R = 24,
      RUST = [130, 80, 50];
    for (let a = 0; a < 400; a++) {
      const an = (a / 400) * Math.PI * 2;
      P(fx + Math.cos(an) * R, fy + Math.sin(an) * R, a % 40 < 3 ? [90, 50, 30] : RUST);
      P(fx + Math.cos(an) * (R - 2), fy + Math.sin(an) * (R - 2), [100, 64, 44]);
    }
    for (let k = 0; k < 12; k++) {
      const an = (k / 12) * Math.PI * 2;
      for (let j = 0; j < R; j++)
        if (j % 2 === 0 || k % 3 === 0) P(fx + Math.cos(an) * j, fy + Math.sin(an) * j, [110, 70, 46]);
      const cx = Math.round(fx + Math.cos(an) * R),
        cy = Math.round(fy + Math.sin(an) * R);
      for (let y = 0; y < 3; y++)
        for (let x = -1; x <= 1; x++) P(cx + x, cy + 1 + y, y === 0 ? [150, 120, 60] : [120, 90, 50]);
    }
    for (let y = 0; y < hy - fy + 6; y++) {
      P(fx - Math.round(y * 0.45), fy + y, [90, 58, 40]);
      P(fx + Math.round(y * 0.45), fy + y, [90, 58, 40]);
    }
    // the field: long grass in bands, darker in the folds
    for (let x = 0; x < W; x++) {
      const top = Math.round(hy + 2 - w.field[x] * 6);
      for (let y = top; y < H; y++) {
        const v = 0.5 + Math.sin(x * 0.05 + y * 0.11) * 0.3 + (hash(x, y) - 0.5) * 0.35;
        P(
          x,
          y,
          y - top < 1
            ? [150, 140, 90]
            : ramp(
                [
                  [70, 70, 44],
                  [96, 92, 56],
                  [126, 118, 72],
                ],
                v * 0.6 + ((y - top) / (H - top)) * 0.3,
                x,
                y,
                0.5,
              ),
        );
      }
    }
    // a checkpoint watchtower out in the field
    const tx = Math.round(W * 0.31),
      tb = hy + 9;
    for (let y = 0; y < 18; y++) {
      const sp = Math.round((18 - y) * 0.22);
      P(tx - 4 - sp, tb - y, [56, 50, 42]);
      P(tx + 4 + sp, tb - y, [42, 38, 32]);
      if (y % 6 === 2) for (let x = -3 - sp; x <= 3 + sp; x++) if ((x + y) % 2 === 0) P(tx + x, tb - y, [50, 46, 38]);
    }
    for (let y = 0; y < 8; y++)
      for (let x = -6; x <= 6; x++)
        P(
          tx + x,
          tb - 18 - y,
          y > 2 && y < 6 && Math.abs(x) < 5
            ? [26, 26, 24]
            : x === -6
              ? [86, 80, 66]
              : x === 6
                ? [48, 44, 38]
                : [70, 64, 54],
        );
    for (let x = -8; x <= 8; x++) P(tx + x, tb - 26, [48, 44, 38]);
    for (let x = -6; x <= 6; x++) P(tx + x, tb - 27, [58, 54, 46]);
    w.towerLamp = [tx + 4, tb - 23];
    // a downed helicopter: hull on its side, tail boom snapped, one blade in the grass
    stamp(b, tone, HELI, Math.round(W * 0.66), hy + 8, {
      k: [40, 46, 36],
      K: [70, 78, 58],
      g: [120, 140, 136],
      h: [12, 12, 10],
      r: [26, 26, 24],
      m: [22, 22, 20],
      d: [34, 38, 28],
    });
    // the bus: rusted, windows gone, sunk on its rims
    const bx = Math.round(W * 0.6),
      by = Math.round(H * 0.79);
    for (let y = 0; y < 14; y++)
      for (let x = 0; x < 40; x++) {
        if (y < 2 && (x < 2 || x > 37)) continue;
        let c =
          y < 2
            ? [170, 150, 110]
            : y < 8 && x > 2 && x < 37 && x % 5 < 4
              ? [30, 30, 28]
              : y === 8
                ? [180, 160, 110]
                : (x * 7 + y * 3) % 11 === 0
                  ? [120, 60, 36]
                  : [154, 120, 80];
        if (x < 2) c = shade(c, 0.1);
        if (x > 37) c = shade(c, -0.3);
        P(bx + x, by + y, c);
      }
    for (const wx of [7, 31])
      for (let y = 0; y < 4; y++)
        for (let x = -2; x <= 2; x++) if (x * x + y * y < 6) P(bx + wx + x, by + 13 + y, [30, 28, 26]);
    // power lines: leaning poles with crossarms, sagging wires (drawn here), birches
    const tops = [];
    for (const p of w.poles) {
      for (let y = 0; y < p.h; y++) {
        const x = Math.round(p.x + y * p.lean);
        P(x, hy + 4 - y, [70, 56, 44]);
        P(x + 1, hy + 4 - y, [50, 40, 32]);
      }
      const tx = Math.round(p.x + p.h * p.lean),
        ty = hy + 4 - p.h;
      for (let k = -6; k <= 6; k++) P(tx + k, ty + 3, [60, 48, 38]);
      tops.push([tx, ty + 3]);
    }
    const wires = [[-W * 0.1, hy - 30], ...tops, [W * 1.1, hy - 26]];
    for (let i = 0; i < wires.length - 1; i++)
      for (const off of [-5, 0, 5]) {
        const [x0, y0] = wires[i],
          [x1, y1] = wires[i + 1];
        for (let x = Math.max(0, Math.round(x0 + off)); x < Math.min(W, x1 + off); x++) {
          const t = (x - x0 - off) / (x1 - x0);
          b.px(x, y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * (9 + off * 0.3) + Math.abs(off) * 0.1, [36, 34, 32]);
        }
      }
    // crows sitting on the middle wire
    const wireY = (x) => {
      for (let i = 0; i < wires.length - 1; i++) {
        const [x0, y0] = wires[i],
          [x1, y1] = wires[i + 1];
        if (x >= x0 && x < x1) {
          const t = (x - x0) / (x1 - x0);
          return Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 9);
        }
      }
      return null;
    };
    for (const f of [0.35, 0.37, 0.4, 0.64]) {
      const x = Math.round(W * f),
        y = wireY(x);
      if (y == null) continue;
      for (const [dx, dy] of [
        [0, -1],
        [1, -1],
        [-1, -1],
        [0, -2],
        [1, -3],
        [2, -3],
        [-2, 0],
      ])
        b.px(x + dx, y + dy, [22, 22, 20]);
    }
    for (const B of w.birches) {
      const r = rng(B.seed),
        base = H;
      for (let y = 0; y < B.h; y++) {
        const x = Math.round(B.x + Math.sin(y * 0.03 + B.seed) * 2);
        for (let k = -1; k <= 1; k++)
          P(
            x + k,
            base - y,
            (y + B.seed) % 7 < 1 && k <= 0
              ? [30, 30, 30]
              : k < 0
                ? [236, 232, 220]
                : k > 0
                  ? [150, 146, 136]
                  : [210, 206, 194],
          );
      }
      for (let i = 0; i < 9; i++) {
        const y0 = B.h * (0.45 + r() * 0.5),
          dir = r() < 0.5 ? -1 : 1,
          len = 6 + r() * 12;
        let x = B.x,
          y = base - y0;
        for (let k = 0; k < len; k++) {
          x += dir * 0.8;
          y -= 0.6 + k * 0.03;
          P(x, y, [60, 56, 52]);
          if (k > len * 0.6 && k % 2) P(x + dir, y - 1, [60, 56, 52]);
        }
      }
    }
    // the fence: posts, three strands of barbed wire, a warning sign
    const fy2 = Math.round(H * 0.9);
    for (let x = 0; x < W; x++)
      for (const dy of [0, 4, 8]) {
        const y = fy2 - dy + Math.round(Math.sin(x * 0.06) * 1);
        b.px(x, y, [40, 40, 40]);
        if (x % 5 === 0) b.px(x, y - 1, [40, 40, 40]);
      }
    for (let x = 6; x < W; x += 22)
      for (let y = 0; y < 14; y++) {
        P(x, fy2 + 4 - y, [90, 76, 60]);
        P(x + 1, fy2 + 4 - y, [60, 50, 40]);
      }
    const sx = Math.round(W * 0.42),
      sy = fy2 - 14;
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 11; x++)
        P(sx + x, sy + y, x === 0 || y === 0 || x === 10 || y === 8 ? [40, 36, 30] : [216, 190, 60]);
    for (const [dx, dy] of [
      [5, 3],
      [4, 4],
      [6, 4],
      [5, 5],
      [3, 5],
      [7, 5],
      [5, 2],
      [3, 3],
      [7, 3],
    ])
      P(sx + dx, sy + dy, [30, 26, 20]);
    w.fireAt = [Math.round(W * 0.24), Math.round(H * 0.86)];
    b.put(g);
  }

  function sky(c, w, e, s) {
    const { W, hy } = w;
    // low cloud scudding across
    c.fillStyle = e.night ? "rgba(20,26,20,0.5)" : "rgba(60,60,52,0.3)";
    for (let i = 0; i < 4; i++) {
      const x0 = ((i * 131 + s * (4 + i)) % (W + 120)) - 100,
        y0 = hy * (0.1 + i * 0.12);
      for (let k = 0; k < 90; k++)
        for (let j = 0; j < 3; j++)
          if (bayer(k + i, j) < 0.45)
            c.fillRect(Math.round(x0 + k), Math.round(y0 + j + Math.sin(k * 0.08 + i) * 2), 1, 1);
    }
    // a column of smoke from something burning far off, leaning with the wind
    if (!w.puffs) {
      w.puffs = RS_PX.puffs([48, 48, 44], 10);
      w.glows.ember = glowSprite(7, [255, 120, 50], 0.6, 0.35);
      w.glows.reactor = RS_PX.softGlow(30, [120, 255, 140], 0.32); // soft: a glow in the haze, not a lit object
    }
    const lean = Math.min(3, (e.wx.wind || 6) / 7),
      smokeX = W * 0.9;
    RS_PX.smoke(c, w.puffs, smokeX, hy - 2, s, {
      n: 18,
      h: hy * 0.75,
      lean: W * 0.12 * lean,
      speed: 0.035,
      alpha: 0.7,
    });
    if (e.day < 0.6) c.drawImage(w.glows.ember, Math.round(smokeX) - 7, hy - 8);
    // something under the reactor still glows at night
    if (e.day < 0.6 && w.plant) {
      c.globalAlpha = (1 - e.day) * (0.55 + 0.3 * Math.sin(s * 0.6));
      c.drawImage(w.glows.reactor, w.plant[0] - 30, w.plant[1] - 30);
      c.globalAlpha = 1;
    }
    // mist lying on the horizon, over the town and the plant
    if (!w.mists)
      w.mists = {
        light: mist(W, 22, [196, 200, 184], 0.85, 0.5, 2),
        dark: mist(W, 22, [44, 54, 46], 0.85, 0.5, 2),
      };
    {
      const m = e.day < 0.4 ? w.mists.dark : w.mists.light,
        ox = -Math.round((s * 2) % W);
      c.drawImage(m, ox, hy - 14);
      c.drawImage(m, ox + W, hy - 14);
    }
    // the chimney light
    if (Math.floor(s * 1.2) % 2) {
      c.fillStyle = "#ff3a2a";
      c.fillRect(w.chimTop[0], w.chimTop[1], 1, 1);
    }
  }

  const DOG = [
    ["........", "k.....kk", "kkkkkkkk", ".kkkkkk.", ".k.k..k.", "k...k..k"],
    ["........", "......kk", "kkkkkkkk", "kkkkkkk.", "..kk.kk.", ".k..k..."],
  ];
  const FIGURE = ["..hh..", ".hhhh.", ".hfh..", "cccc..", "ccccc.", "cccccc", ".ccc..", "cc.cc."];

  function frame(c, w, e, s) {
    const { W, H, hy } = w,
      night = e.day < 0.4;
    if (!w.glows.fire) {
      w.glows.fire = glowSprite(12, [255, 150, 60], 0.7, 0.4);
      w.glows.anom = glowSprite(10, [180, 220, 255], 0.5, 0.3);
      w.glows.art = glowSprite(6, [255, 180, 80], 0.7, 0.4);
      w.glows.flash = glowSprite(3, [255, 220, 150], 0.8, 0.5);
    }
    // mist creeping over the field, thicker at night and dawn
    {
      const m = night ? w.mists.dark : w.mists.light,
        ox = -Math.round((s * 3.5) % W);
      c.globalAlpha = e.wx.fog ? 1 : night || e.phase === "dawn" ? 0.85 : 0.45;
      c.drawImage(m, ox, hy + 4);
      c.drawImage(m, ox + W, hy + 4);
      c.globalAlpha = 1;
    }
    // the watchtower's searchlight sweeping the field at night
    if (night) {
      const [ox, oy] = w.towerLamp,
        tx = ox + Math.sin(s * 0.22) * W * 0.4,
        ty = hy + 22 + Math.cos(s * 0.31) * 6,
        n = Math.max(1, Math.round(Math.max(Math.abs(tx - ox), Math.abs(ty - oy))));
      for (let i = 3; i <= n; i++) {
        const t = i / n,
          hw = 0.5 + t * 4;
        c.fillStyle = `rgba(230,240,210,${0.13 * (1 - t * 0.5)})`;
        c.fillRect(Math.round(ox + (tx - ox) * t), Math.round(oy + (ty - oy) * t - hw), 1, Math.round(hw * 2) + 1);
      }
      c.fillStyle = "rgba(230,240,210,0.16)";
      for (let yy = -2; yy <= 2; yy++)
        c.fillRect(Math.round(tx - 7 + Math.abs(yy) * 2), Math.round(ty) + yy, 15 - Math.abs(yy) * 4, 1);
      c.fillStyle = "#fffbe0";
      c.fillRect(ox, oy, 2, 1);
    }
    // long grass swaying in front, in tufts
    const wind = Math.min(3, (e.wx.wind || 6) / 7);
    for (const [gx, gp, gq] of w.grass) {
      const top = Math.round(H * 0.72 + gq * H * 0.28),
        h = 3 + Math.round(gp * 6),
        sw = Math.sin(s * 1.8 + gx * 0.15) * wind * 0.6 + wind * 0.5;
      c.fillStyle = css(toner(e)(gp > 0.6 ? [170, 160, 100] : gp > 0.3 ? [130, 124, 76] : [96, 96, 60]));
      for (let k = 0; k < h; k++) c.fillRect(Math.round(gx + sw * (k / h) ** 1.5), top - k, 1, 1);
    }
    // anomalies: a shimmering lens in the grass, debris orbiting, a spark now and then
    for (const [i, A] of w.anoms.entries()) {
      for (let k = 0; k < 40; k++) {
        const an = (k / 40) * Math.PI * 2,
          rr = A.R * (0.8 + 0.2 * Math.sin(s * 3 + k)),
          x = Math.round(A.x + Math.cos(an) * rr),
          y = Math.round(A.y + Math.sin(an) * rr * 0.5);
        if (bayer(x + Math.floor(s * 6), y) < 0.4) {
          c.fillStyle = "rgba(200,230,255,0.4)";
          c.fillRect(x, y, 1, 1);
        }
      }
      for (const [ph, dist, sz] of w.debris) {
        const an = s * (0.6 + sz) + ph + i,
          x = Math.round(A.x + Math.cos(an) * A.R * dist * 0.8),
          y = Math.round(A.y - 6 - Math.sin(an * 0.5) * 6 - dist * 4);
        c.fillStyle = sz > 0.6 ? "#6a5a48" : "#8a8a80";
        c.fillRect(x, y, sz > 0.6 ? 2 : 1, 1);
      }
      if (Math.sin(s * 5 + i * 4) > 0.97) {
        c.drawImage(w.glows.anom, Math.round(A.x) - 10, Math.round(A.y) - 14);
        c.fillStyle = "#e8f4ff";
        for (let k = 0; k < 6; k++)
          c.fillRect(Math.round(A.x + (bayer(k, i) - 0.5) * 8), Math.round(A.y - k * 2), 1, 1);
      }
    }
    // an artefact floating over the first anomaly, pulsing
    {
      const A = w.anoms[0],
        ax = Math.round(A.x + 6),
        ay = Math.round(A.y - 13 + Math.sin(s * 1.4) * 2);
      c.globalAlpha = 0.6 + 0.4 * Math.sin(s * 2.2);
      c.drawImage(w.glows.art, ax - 6, ay - 6);
      c.globalAlpha = 1;
      c.fillStyle = "#ffbe55";
      c.fillRect(ax, ay, 2, 2);
      c.fillStyle = "#fff4d0";
      c.fillRect(ax, ay, 1, 1);
    }
    // the second anomaly is electric: it crackles every few seconds
    {
      const B = w.anoms[1],
        ph = s % 3.3;
      if (ph < 0.4) {
        const seed = Math.floor(s / 3.3) * 7 + Math.floor(ph * 20);
        c.drawImage(w.glows.anom, Math.round(B.x) - 10, Math.round(B.y) - 14);
        c.fillStyle = "#dff0ff";
        for (let a = 0; a < 3; a++) {
          const an = hash(seed, a) * Math.PI * 2;
          let x = B.x,
            y = B.y - 4;
          for (let k = 0; k < 7; k++) {
            x += Math.cos(an) * 2 + (hash(seed + k, a) - 0.5) * 3;
            y += Math.sin(an) * 1.2 + (hash(a, seed + k) - 0.5) * 3;
            c.fillRect(Math.round(x), Math.round(y), 1, 1);
          }
        }
      }
    }
    // crows circling over the field
    if (!e.wx.rain)
      for (const [ph, rr, p] of w.crows) {
        const an = s * (0.3 + p * 0.2) + ph,
          x = Math.round(W * 0.3 + Math.cos(an) * rr * 2.5),
          y = Math.round(hy * 0.45 + Math.sin(an) * rr * 0.6),
          up = Math.floor(s * 4 + ph) % 2;
        c.fillStyle = "#141414";
        c.fillRect(x, y, 2, 1);
        c.fillRect(x - 2, y - up, 2, 1);
        c.fillRect(x + 2, y - up, 2, 1);
      }
    // a dog pack loping across now and then
    {
      const per = 75,
        t = (s % per) / per;
      if (t < 0.25) {
        const k = t / 0.25;
        for (let d = 0; d < 4; d++) {
          const x = Math.round(-20 + k * (W + 60) - d * 11),
            y = Math.round(H * 0.8 + (d % 2) * 3);
          sprite(c, DOG[Math.floor(s * 8 + d) % 2], x, y, { k: css(toner(e)([70, 60, 50])) });
        }
      }
    }
    // stalkers crossing the far field by torchlight
    if (night)
      for (let i = 0; i < 2; i++) {
        const dir = i ? -1 : 1,
          x = Math.round(((((i * W * 0.6 + s * (1.6 + i * 0.5) * dir) % (W + 40)) + W + 40) % (W + 40)) - 20),
          y = Math.round(hy + 10 + i * 6);
        c.fillStyle = "#16160f";
        c.fillRect(x, y - 4, 2, 4);
        c.fillRect(x, y - 5, 1, 1);
        for (let k = 1; k < 11; k++) {
          c.fillStyle = `rgba(255,240,180,${0.3 * (1 - k / 11)})`;
          c.fillRect(dir > 0 ? x + 2 + k : x - 1 - k, y - 3 + Math.floor(k / 4), 1, 1 + Math.floor(k / 4));
        }
        c.fillStyle = "#fff4c0";
        c.fillRect(dir > 0 ? x + 2 : x - 1, y - 3, 1, 1);
      }
    // gunfire somewhere out on the horizon now and then
    if (night) {
      const per = 29,
        ci = Math.floor(s / per);
      if (s % per < 1.4 && (s * 9) % 1 < 0.35 && hash(ci, Math.floor(s * 9)) < 0.7) {
        const gx = Math.round(W * (0.15 + hash(ci, 1) * 0.7)),
          gy0 = Math.round(hy + 3 + hash(ci, 2) * 6);
        c.drawImage(w.glows.flash, gx - 3, gy0 - 3);
        c.fillStyle = "#fff0b0";
        c.fillRect(gx, gy0, 1, 1);
      }
    }
    // leaves blowing through
    if (!e.wx.rain && !e.wx.snow)
      for (let i = 0; i < 6; i++) {
        const x = Math.round((((hash(i, 3) * W + s * (6 + wind * 6)) % (W + 20)) + W + 20) % (W + 20)) - 10,
          y = Math.round(H * 0.66 + hash(i, 4) * H * 0.3 + Math.sin(s * 2 + i) * 3);
        c.fillStyle = i % 2 ? "#7a5a30" : "#5a4a2a";
        c.fillRect(x, y, Math.floor(s * 6 + i) % 2 ? 2 : 1, 1);
      }
    // a lone figure at a campfire at night
    if (night) {
      const [fx, fy] = w.fireAt;
      c.drawImage(w.glows.fire, fx - 12, fy - 14);
      for (let k = -2; k <= 2; k++) {
        const h = 2 + Math.round(Math.abs(Math.sin(s * 9 + k * 2)) * 4 * (1 - Math.abs(k) / 3));
        c.fillStyle = k === 0 ? "#fff0a0" : "#ff9a30";
        c.fillRect(fx + k, fy - h, 1, h);
      }
      c.fillStyle = "#3a2a1a";
      c.fillRect(fx - 3, fy, 7, 1);
      sprite(c, FIGURE, fx - 11, fy - 8, { h: "#2a2a24", f: "#c08a60", c: "#3a3a2e" });
      for (let i = 0; i < 4; i++) {
        const t2 = (s * 0.5 + i / 4) % 1;
        c.fillStyle = `rgba(255,190,90,${1 - t2})`;
        c.fillRect(fx + Math.round(Math.sin(s + i) * 3), fy - 6 - Math.round(t2 * 14), 1, 1);
      }
    }
    // the blowout: every ~10 minutes the sky floods red with lightning for half a minute
    const per = 600,
      bt = ((s + 300) % per) / per;
    // the half minute before: the sky turns a sick red and the light drains
    if (bt > 0.95) {
      const k = (bt - 0.95) / 0.05;
      for (let i = 0; i < 6; i++) {
        c.fillStyle = `rgba(120,30,16,${0.05 * k * (6 - i)})`;
        c.fillRect(0, Math.round((hy / 6) * i), W, Math.ceil(hy / 6));
      }
      c.fillStyle = `rgba(10,6,4,${0.2 * k})`;
      c.fillRect(0, 0, W, H);
    }
    if (bt < 0.05) {
      const k = Math.sin((bt / 0.05) * Math.PI);
      c.fillStyle = `rgba(200,30,20,${0.35 * k})`;
      for (let y = 0; y < hy + 10; y++)
        for (let x = y & 1; x < W; x += 2) if (bayer(x, y) < 0.7 - y / (hy * 2)) c.fillRect(x, y, 1, 1);
      if (Math.sin(s * 11) > 0.8) {
        let x = Math.round(W * (0.2 + (Math.floor(s * 3) % 5) * 0.15)),
          y = 0;
        c.fillStyle = "#ffd0c0";
        while (y < hy) {
          const nx = x + Math.round((hash(x, y + Math.floor(s * 3)) - 0.5) * 10);
          for (let j = 0; j < 4; j++) c.fillRect(Math.round(x + ((nx - x) * j) / 4), y + j, 1, 1);
          x = nx;
          y += 4;
        }
        c.fillStyle = "rgba(255,120,100,0.25)";
        c.fillRect(0, 0, W, H);
      }
    }
    // weather
    if (e.wx.rain) {
      c.fillStyle = "rgba(180,190,200,0.5)";
      const n = Math.round(w.drops.length * Math.min(1, e.wx.rain + 0.2));
      for (let i = 0; i < n; i++) {
        const [px, py, sp] = w.drops[i];
        c.fillRect(
          Math.round(px * W - ((py * H + s * 120 * sp) % H) * 0.1),
          Math.round((py * H + s * 120 * sp) % H),
          1,
          3,
        );
      }
    }
    if (e.wx.snow) {
      c.fillStyle = "#f0f0ea";
      for (const [px, py, sp] of w.drops)
        c.fillRect(Math.round(px * W + Math.sin(s + py * 20) * 3), Math.round((py * H + s * 14 * sp) % H), 1, 1);
    }
    if (e.wx.fog) {
      c.fillStyle = "rgba(170,172,160,0.45)";
      for (let y = Math.round(hy * 0.6); y < H; y++)
        for (let x = y & 1; x < W; x += 2) if (bayer(x, y) < 0.6) c.fillRect(x, y, 1, 1);
    }
    if (e.wx.thunder && s % 10 < 0.12) {
      c.fillStyle = "rgba(255,255,240,0.4)";
      c.fillRect(0, 0, W, H);
    }
    // darker corners
    w.vig ||= RS_PX.vignette(W, H);
    c.drawImage(w.vig, 0, 0);
  }

  RS_SCENE.register("zone", { build, background, sky, land, frame });
})();
