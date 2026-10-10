"use strict";

// Tavern: inn interior. The window shows the real sky and weather.
(() => {
  const { Buf, ramp, mix, css, glowSprite, shade, sprite, hash, canvas, mist, rays, softGlow, vignette } = RS_PX;
  const { rng } = RS_SCENE;
  const BEAM = [
    [70, 40, 22],
    [96, 58, 30],
    [120, 76, 40],
  ];
  const PLASTER = [
    [206, 180, 140],
    [188, 160, 122],
    [170, 142, 106],
  ];

  function build(W, H) {
    const r = rng(1212),
      floorY = Math.round(H * 0.72);
    const hearth = { x: Math.round(W * 0.14), w: Math.round(Math.min(W * 0.24, 66)), y: floorY };
    const win = {
      x: Math.round(W * 0.84),
      y: Math.round(H * 0.2),
      w: Math.round(Math.min(W * 0.14, 40)),
      h: Math.round(H * 0.3),
    };
    const bar = { x0: Math.round(W * 0.36), x1: Math.round(W * 0.7), y: floorY + 2, h: 24 };
    const bottles = Array.from({ length: Math.round((bar.x1 - bar.x0) / 5) }, (_, i) => ({
      x: bar.x0 + 4 + i * 5 + Math.round(r() * 2),
      shelf: i % 2,
      col: [
        [60, 140, 70],
        [140, 60, 50],
        [180, 150, 60],
        [70, 90, 160],
        [150, 120, 160],
      ][Math.floor(r() * 5)],
      h: 5 + Math.round(r() * 3),
    }));
    const table = { x: Math.round(W * 0.5), y: Math.round(H * 0.88), w: 60 };
    const rain = Array.from({ length: 60 }, () => [r(), r(), 0.5 + r()]);
    const stars = Array.from({ length: 30 }, () => [r(), r() * 0.6, r()]);
    const sparks = Array.from({ length: 16 }, () => [r(), r(), r()]);
    const motes = Array.from({ length: 24 }, () => [r(), r(), r()]);
    return { W, H, floorY, hearth, win, bar, bottles, table, rain, stars, sparks, motes, glows: {} };
  }

  function outside(e) {
    const day = [
        [90, 150, 220],
        [170, 210, 240],
      ],
      night = [
        [10, 14, 34],
        [30, 40, 70],
      ],
      warm = [
        [80, 60, 120],
        [255, 150, 100],
      ];
    let top = mix(night[0], day[0], e.day),
      bot = mix(night[1], day[1], e.day);
    if (e.glow > 0) {
      top = mix(top, warm[0], e.glow * 0.7);
      bot = mix(bot, warm[1], e.glow * 0.7);
    }
    if (e.wx.grey > 0.4) {
      top = mix(
        top,
        [70, 76, 86].map((v) => v * (0.3 + e.day * 0.7)),
        e.wx.grey * 0.7,
      );
      bot = mix(
        bot,
        [110, 114, 120].map((v) => v * (0.3 + e.day * 0.7)),
        e.wx.grey * 0.7,
      );
    }
    return [top, bot];
  }

  function background(g, w) {
    const { W, H, floorY, hearth: F, win: Wn, bar: B } = w,
      b = new Buf(g, W, H);
    // the wall: plaster panels in a timber frame above a stone base; darker towards the ceiling
    const dado = Math.round(floorY - H * 0.16),
      posts = [];
    for (let x = 0; x < W; x += 46) posts.push(x);
    for (let y = 0; y < floorY; y++)
      for (let x = 0; x < W; x++) {
        const v = y / floorY;
        let c;
        if (y >= dado) {
          const row = Math.floor((y - dado) / 5),
            col = Math.floor((x + (row % 2) * 4) / 9);
          const mortar = (y - dado) % 5 === 0 || (x + (row % 2) * 4) % 9 === 0;
          c = mortar ? [56, 46, 40] : (row * 7 + col * 3) % 5 === 0 ? [118, 104, 92] : [98, 86, 76];
        } else {
          c = ramp(PLASTER, 1 - v * 0.9 + (hash(x >> 1, y >> 1) - 0.5) * 0.25, x, y, 0.4);
          if (hash(x, y) < 0.01) c = shade(c, -0.2);
        }
        c = mix(c, [20, 10, 6], Math.max(0, 0.55 - v * 0.6)); // shadow under the ceiling
        b.px(x, y, c);
      }
    const beam = (x0, y0, wd, ht) => {
      for (let y = 0; y < ht; y++)
        for (let x = 0; x < wd; x++)
          b.px(x0 + x, y0 + y, BEAM[x === 0 || y === 0 ? 2 : x === wd - 1 || y === ht - 1 ? 0 : 1]);
    };
    for (const px of posts) beam(px, 0, 5, dado);
    beam(0, dado - 4, W, 4);
    beam(0, Math.round(H * 0.16), W, 4);
    for (let i = 1; i < posts.length - 1; i += 2) {
      const x0 = posts[i] + 5,
        x1 = posts[i + 1],
        y0 = dado - 4,
        y1 = Math.round(H * 0.16) + 4;
      for (let x = x0; x < x1; x++) {
        const t = (x - x0) / (x1 - x0),
          y = Math.round(y0 + (y1 - y0) * t);
        for (let j = -2; j <= 2; j++) b.px(x, y + j, BEAM[j === -2 ? 2 : j === 2 ? 0 : 1]);
      }
    }
    for (let y = 0; y < 8; y++) for (let x = 0; x < W; x++) b.px(x, y, y < 7 ? BEAM[y < 1 ? 0 : 1] : BEAM[0]); // ceiling joist line
    // floor boards in perspective
    for (let y = floorY; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = (y - floorY) / (H - floorY),
          pw = Math.max(1, Math.round(9 * (0.6 + t * 0.9))),
          plank = Math.floor((x - W / 2) / pw);
        b.px(
          x,
          y,
          (x - W / 2) % pw === 0
            ? [36, 20, 10]
            : ramp(
                [
                  [72, 42, 22],
                  [94, 56, 28],
                ],
                t * 0.6 + (plank % 2) * 0.2 + hash(plank, 3) * 0.2,
                x,
                y,
                0.3,
              ),
        );
      }
    // the hearth: stone surround, arched firebox, a thick mantel
    const fx = F.x - F.w / 2,
      fTop = F.y - 64;
    for (let y = fTop; y < F.y; y++)
      for (let x = fx; x < fx + F.w; x++) {
        const row = Math.floor((y - fTop) / 5),
          mortar = (y - fTop) % 5 === 0 || (x - fx + (row % 2) * 4) % 8 === 0;
        b.px(
          x,
          y,
          mortar
            ? [50, 46, 46]
            : x < fx + 3
              ? [140, 130, 124]
              : x > fx + F.w - 4
                ? [80, 74, 72]
                : (row * 7 + Math.floor((x - fx) / 8) * 3) % 5 === 0
                  ? [118, 110, 104]
                  : [100, 94, 90],
        );
      }
    const boxW = Math.round(F.w * 0.62),
      boxH = 30,
      bx0 = Math.round(F.x - boxW / 2);
    for (let y = 0; y < boxH; y++)
      for (let x = 0; x < boxW; x++) {
        const arch =
          y < boxW * 0.25 && (x - boxW / 2) ** 2 / (boxW / 2) ** 2 + (boxW * 0.25 - y) ** 2 / (boxW * 0.25) ** 2 > 1;
        if (!arch) b.px(bx0 + x, F.y - boxH + y, y < 4 ? [26, 14, 10] : [16, 8, 6]);
      }
    w.firebox = [F.x, F.y - 2, boxW, boxH];
    const mY = fTop + 20;
    for (let x = fx - 5; x < fx + F.w + 5; x++)
      for (let y = 0; y < 5; y++) b.px(x, mY + y, y === 0 ? [160, 108, 58] : y === 4 ? [60, 36, 18] : [110, 70, 34]);
    // on the mantel: a jug and two candlesticks; above it antlers and a shield with crossed swords
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 4; x++) b.px(fx + 8 + x, mY - 1 - y, x === 0 ? [180, 150, 120] : [140, 110, 90]);
    w.mantelCandles = [
      [fx + 2, mY - 1],
      [fx + F.w - 4, mY - 1],
    ];
    for (const [cx, cy] of w.mantelCandles) {
      b.px(cx, cy, [180, 150, 60]);
      for (let y = 1; y < 5; y++) b.px(cx, cy - y, [240, 230, 210]);
    }
    const sx = F.x,
      sy = fTop - 4;
    for (let y = -9; y <= 9; y++)
      for (let x = -7; x <= 7; x++) {
        const d = (x / 7) ** 2 + (y / 9) ** 2;
        if (d <= 1 && y < 8 - Math.abs(x) * 0.5)
          b.px(sx + x, sy + y, d > 0.75 ? [190, 160, 70] : x < 0 === y < 0 ? [140, 30, 30] : [40, 60, 120]);
      }
    for (let k = -14; k <= 14; k++) {
      b.px(sx + k, sy + k * 0.7, [200, 204, 214]);
      b.px(sx + k, sy - k * 0.7, [200, 204, 214]);
    }
    for (const k of [-14, 14]) {
      b.px(sx + k, sy + k * 0.7 + (k > 0 ? 1 : -1), [120, 80, 40]);
      b.px(sx + k, sy - k * 0.7 + (k > 0 ? -1 : 1), [120, 80, 40]);
    }
    const ax = sx,
      ay = Math.round(H * 0.13);
    for (const dir of [-1, 1])
      for (let k = 0; k < 12; k++) {
        const x = ax + dir * (2 + k),
          y = ay - Math.round(k * 0.6);
        b.px(x, y, [220, 200, 170]);
        if (k % 4 === 3) for (let j = 1; j < 4; j++) b.px(x, y - j, [220, 200, 170]);
      }
    for (let y = 0; y < 4; y++) for (let x = -2; x <= 2; x++) b.px(ax + x, ay + y, [110, 70, 40]);
    // the window reveal (the glass is drawn live), a bench under it
    for (let y = Wn.y - 4; y < Wn.y + Wn.h + 6; y++)
      for (let x = Wn.x - Wn.w / 2 - 5; x < Wn.x + Wn.w / 2 + 5; x++)
        b.px(x, y, (x + y) % 7 === 0 ? [90, 84, 80] : [118, 110, 104]);
    for (let x = Wn.x - Wn.w / 2 - 8; x < Wn.x + Wn.w / 2 + 8; x++)
      for (let y = 0; y < 3; y++) b.px(x, floorY - 12 + y, y === 0 ? [150, 100, 54] : [100, 62, 30]);
    // behind the bar: shelves of bottles and a barrel rack with taps
    for (const shy of [Math.round(H * 0.3), Math.round(H * 0.42)])
      for (let x = B.x0; x < B.x1; x++) for (let k = 0; k < 2; k++) b.px(x, shy + k, k ? [50, 28, 14] : [140, 90, 46]);
    for (const bt of w.bottles) {
      const by = (bt.shelf ? Math.round(H * 0.42) : Math.round(H * 0.3)) - 1;
      for (let y = 0; y < bt.h; y++)
        for (let x = 0; x < 3; x++) {
          if (y > bt.h - 3 && x !== 1) continue;
          b.px(bt.x + x, by - y, x === 0 ? mix(bt.col, [255, 255, 255], 0.35) : bt.col);
        }
      b.px(bt.x + 1, by - bt.h, [150, 110, 60]);
    }
    w.taps = [];
    for (let i = 0; i < 3; i++) {
      const cx = B.x0 + 16 + i * 26,
        cy = Math.round(H * 0.53);
      for (let y = -7; y <= 7; y++)
        for (let x = -9; x <= 9; x++) {
          const d = (x / 9) ** 2 + (y / 7) ** 2;
          if (d > 1) continue;
          const ring = Math.abs(d - 0.55) < 0.07 || d > 0.9;
          b.px(
            cx + x,
            cy + y,
            ring ? [70, 70, 74] : x * 0.3 + y < -2 ? [160, 106, 56] : y > 3 ? [86, 52, 26] : [126, 80, 40],
          );
        }
      b.px(cx, cy + 7, [200, 180, 80]);
      b.px(cx, cy + 8, [200, 180, 80]);
      w.taps.push([cx, cy + 9]);
    }
    // the counter
    for (let y = B.y - B.h; y < B.y; y++)
      for (let x = B.x0; x < B.x1; x++) {
        const top = y < B.y - B.h + 3;
        b.px(
          x,
          y,
          top
            ? y === B.y - B.h
              ? [190, 128, 64]
              : [140, 88, 44]
            : (x - B.x0) % 10 === 0
              ? [44, 24, 12]
              : (y - (B.y - B.h)) % 8 === 5
                ? [70, 40, 20]
                : [96, 58, 28],
        );
      }
    // the rug in front of the hearth
    const rx = F.x - 30,
      ry = Math.round(H * 0.84);
    for (let y = 0; y < 14; y++)
      for (let x = 0; x < 58; x++) {
        const edge = y < 1 || y > 12 || x < 1 || x > 56,
          inner = y === 3 || y === 10 || x === 4 || x === 53;
        b.px(
          rx + x,
          ry + y,
          edge ? [216, 176, 80] : inner ? [200, 150, 60] : ((x >> 2) + (y >> 2)) % 2 ? [140, 40, 40] : [110, 30, 34],
        );
      }
    w.rug = [rx, ry];
    b.put(g);
  }

  const DOG = [
    ["..........kk..", ".kkkkkkkkkkkkk", "kkkkkkkkkkkkk.", "kkkkkkkkkkk..."],
    ["..........kk..", ".kkkkkkkkkkkkk", "kkkkkkkkkkkkkk", "kkkkkkkkkkk..."],
  ];
  const KEEP = [
    "..hhhhh..",
    ".hhhhhhh.",
    ".hsssssh.",
    "..sesess..",
    "..sssss..",
    "...sss...",
    ".wwaaaww.",
    "wwwaaawww",
    "wwwaaawww",
    "sswwwwwss",
    "ss.www.ss",
    "wwwwwwwww",
  ];
  const PATRON = (c) =>
    [
      "..hhhh..",
      ".hhhhhh.",
      ".hhhhhh.",
      ".hhhhhh.",
      "..ssss..",
      "...ss...",
      ".cccccc.",
      "cccccccc",
      "cccccccc",
      "cccccccc",
      "cccccccc",
      "cccccccc",
      ".cccccc.",
      ".dd..dd.",
      ".dd..dd.",
    ].map((r) => r.replace(/c/g, c));
  const BARD = [
    "...ff.....",
    "..fffff...",
    ".ffffffF..",
    "..hhhh....",
    "..hehh....",
    "...hh.....",
    "..gggg....",
    ".gggggg.ll",
    ".gggggglll",
    ".gggggllll",
    ".ggggg.ll.",
    "..gggg....",
    "..gg.gg...",
    "..gg..gg..",
    "..bb...bb.",
  ];

  function sky(c, w, e, s) {
    const { win: Wn } = w,
      [top, bot] = outside(e),
      x0 = Math.round(Wn.x - Wn.w / 2),
      y0 = Wn.y;
    const inWin = (x, y) => {
      if (y < 0 || y >= Wn.h || x < 0 || x >= Wn.w) return false;
      const ay = Wn.w / 2;
      return y >= ay || (x - Wn.w / 2) ** 2 / (Wn.w / 2) ** 2 + (ay - y) ** 2 / (ay * ay) <= 1;
    };
    for (let y = 0; y < Wn.h; y++)
      for (let x = 0; x < Wn.w; x++) {
        if (!inWin(x, y)) continue;
        c.fillStyle = css(ramp([top, mix(top, bot, 0.5), bot], y / Wn.h, x, y, 0.3));
        c.fillRect(x0 + x, y0 + y, 1, 1);
      }
    if (e.day < 0.35 && e.wx.clouds < 0.8)
      for (const [px, py, p] of w.stars) {
        const x = Math.round(px * Wn.w),
          y = Math.round(py * Wn.h);
        if (inWin(x, y) && Math.sin(s * (1 + p) + p * 20) > -0.3) {
          c.fillStyle = "#e8ecff";
          c.fillRect(x0 + x, y0 + y, 1, 1);
        }
      }
    if (e.wx.clouds < 0.85) {
      const mx = x0 + Math.round(Wn.w * 0.65),
        my = y0 + Math.round(Wn.h * 0.25);
      c.fillStyle = e.night ? "#f2eed8" : "#fff4b0";
      for (let y = -4; y <= 4; y++)
        for (let x = -4; x <= 4; x++) if (x * x + y * y <= 16) c.fillRect(mx + x, my + y, 1, 1);
    }
    c.fillStyle = e.night ? "#0c0a14" : "#3a3440";
    for (let x = 0; x < Wn.w; x++) {
      const hgt = Math.round(Wn.h * 0.14 + Math.abs(Math.sin(x * 0.4)) * 4 + (x % 9 < 3 ? 3 : 0));
      for (let y = Wn.h - hgt; y < Wn.h; y++) if (inWin(x, y)) c.fillRect(x0 + x, y0 + y, 1, 1);
    }
    if (e.night) {
      c.fillStyle = "#ffd070";
      for (let i = 0; i < 4; i++) c.fillRect(x0 + 3 + i * Math.round(Wn.w / 4), y0 + Wn.h - 3 - (i % 2), 1, 1);
    }
    if (e.wx.rain) {
      c.fillStyle = "rgba(190,210,240,0.85)";
      for (const [px, py, sp] of w.rain) {
        const x = Math.round(px * Wn.w),
          y = Math.round((py * Wn.h + s * 30 * sp) % Wn.h);
        if (inWin(x, y)) c.fillRect(x0 + x, y0 + y, 1, 2);
      }
    }
    if (e.wx.snow) {
      c.fillStyle = "#ffffff";
      for (const [px, py, sp] of w.rain) {
        const x = Math.round(px * Wn.w + Math.sin(s + py * 9) * 2),
          y = Math.round((py * Wn.h + s * 6 * sp) % Wn.h);
        if (inWin(x, y)) c.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
    c.fillStyle = "#3a2210";
    for (let y = 0; y < Wn.h; y++)
      if (inWin(Math.round(Wn.w / 2), y)) c.fillRect(x0 + Math.round(Wn.w / 2), y0 + y, 1, 1);
    for (const fy of [0.45, 0.72])
      for (let x = 0; x < Wn.w; x++)
        if (inWin(x, Math.round(Wn.h * fy))) c.fillRect(x0 + x, y0 + Math.round(Wn.h * fy), 1, 1);
    if (e.wx.snow || e.wx.temp <= 0) {
      c.fillStyle = "#f4f6ff";
      c.fillRect(x0 - 2, y0 + Wn.h, Wn.w + 4, 2);
    }
  }

  function frame(c, w, e, s) {
    const { W, H, floorY, hearth: F, bar: B, table: T } = w;
    if (!w.glows.fire) {
      w.glows.fire = glowSprite(26, [255, 150, 60], 0.55, 0.22);
      w.glows.candle = glowSprite(6, [255, 200, 110], 0.7, 0.35);
      w.glows.chand = glowSprite(16, [255, 200, 110], 0.5, 0.2);
    }
    const flick = 0.85 + 0.15 * Math.sin(s * 7) * Math.sin(s * 3.3);
    // the fire: logs, layered flames, sparks, the cauldron hanging over it with steam
    const [fx, fy, bw] = w.firebox;
    c.fillStyle = "#3a2210";
    c.fillRect(fx - bw * 0.32, fy - 2, bw * 0.64, 2);
    c.fillStyle = "#5a3418";
    c.fillRect(fx - bw * 0.28, fy - 3, bw * 0.56, 1);
    for (let i = -8; i <= 8; i++) {
      const hgt = Math.round((11 + Math.sin(s * 9 + i * 1.7) * 3 + Math.sin(s * 5.3 + i) * 2) * (1 - Math.abs(i) / 10));
      for (let y = 0; y < hgt; y++) {
        const t = y / hgt;
        c.fillStyle = t < 0.3 ? "#ffe890" : t < 0.6 ? "#ffa830" : "#e04a18";
        c.fillRect(Math.round(fx + i * 1.3), fy - 3 - y, 1, 1);
      }
    }
    for (const [px, py, p] of w.sparks) {
      const t = (py + s * 0.5 * (0.5 + p)) % 1;
      c.fillStyle = t < 0.5 ? "#ffd060" : "#ff7020";
      c.fillRect(
        Math.round(fx + (px - 0.5) * bw * 0.5 + Math.sin(s * 3 + p * 9) * 2),
        Math.round(fy - 10 - t * 18),
        1,
        1,
      );
    }
    const cy = fy - 20,
      sw = Math.round(Math.sin(s * 0.9) * 1);
    c.fillStyle = "#2a2a2e";
    c.fillRect(fx, fy - 30, 1, 8);
    for (let y = 0; y < 7; y++) {
      const hw = 6 - Math.max(0, y - 4);
      c.fillRect(fx - hw + sw, cy + y, hw * 2 + 1, 1);
    }
    c.fillStyle = "#4a4a50";
    c.fillRect(fx - 6 + sw, cy, 13, 1);
    for (let i = 0; i < 4; i++) {
      const t = (s * 0.5 + i / 4) % 1;
      c.fillStyle = `rgba(230,230,230,${0.45 * (1 - t)})`;
      c.fillRect(fx + sw + Math.round(Math.sin(s * 2 + i) * 2), cy - 2 - Math.round(t * 12), 2, 1);
    }
    // light from the window falling across the room: sun by day, a pale moon at night
    const lightKey = e.day > 0.5 ? "day" : "night";
    if (w.beamKey !== lightKey) {
      w.beamKey = lightKey;
      const Wn = w.win;
      w.beam = canvas(W, H, (b) =>
        rays(b, Wn.x, Wn.y + Wn.h * 0.5, Math.PI * 0.78, {
          n: 5,
          len: H * 0.85,
          spread: 0.07,
          width: 0.11,
          col: lightKey === "day" ? [255, 236, 190] : [170, 190, 255],
          k: lightKey === "day" ? 0.5 : 0.28,
          a: 0.3,
        }),
      );
    }
    c.drawImage(w.beam, 0, 0);
    // a warm haze round the hearth that breathes with the fire
    w.glows.hearth ||= softGlow(Math.round(Math.min(W * 0.26, H * 0.5)), [255, 150, 70], 0.3);
    {
      const R = w.glows.hearth.width >> 1;
      c.globalAlpha = 0.55 + flick * 0.45;
      c.drawImage(w.glows.hearth, fx - R, fy - 12 - R);
      c.globalAlpha = 1;
    }
    // firelight breathing across the room
    c.globalAlpha = 0.6 + flick * 0.4;
    c.drawImage(w.glows.fire, fx - 26, fy - 30);
    c.drawImage(w.glows.fire, fx - 10, fy - 16);
    c.globalAlpha = 1;
    // candles on the mantel and the chandelier, swaying gently
    for (const [cx, cy2] of w.mantelCandles) {
      c.fillStyle = Math.sin(s * 10 + cx) > 0 ? "#ffe080" : "#ffb040";
      c.fillRect(cx, cy2 - 6, 1, 2);
      c.drawImage(w.glows.candle, cx - 6, cy2 - 11);
    }
    const chx = Math.round(W * 0.56 + Math.sin(s * 0.6) * 1.5),
      chy = Math.round(H * 0.24);
    c.fillStyle = "#2a1a10";
    for (let y = 8; y < chy; y++) c.fillRect(Math.round(W * 0.56 + Math.sin(s * 0.6) * 1.5 * (y / chy)), y, 1, 1);
    c.fillStyle = "#4a3020";
    c.fillRect(chx - 12, chy, 25, 2);
    c.fillRect(chx - 1, chy - 2, 3, 2);
    for (let k = -2; k <= 2; k++) {
      const x = chx + k * 6;
      c.fillStyle = "#f0e8d8";
      c.fillRect(x, chy - 3, 1, 3);
      c.fillStyle = Math.sin(s * 9 + k) > 0 ? "#ffe080" : "#ffb040";
      c.fillRect(x, chy - 5, 1, 2);
    }
    c.globalAlpha = flick;
    c.drawImage(w.glows.chand, chx - 16, chy - 18);
    c.globalAlpha = 1;
    // dried herbs hanging from the beam
    for (let i = 0; i < 5; i++) {
      const hx = Math.round(W * (0.3 + i * 0.12)),
        hy = Math.round(H * 0.16) + 4;
      c.fillStyle = "#4a3a20";
      c.fillRect(hx, hy, 1, 3);
      c.fillStyle = i % 2 ? "#6a8a40" : "#8a7a40";
      for (let y = 0; y < 6; y++) c.fillRect(hx - 1 + (y % 2), hy + 3 + y, 2 + (y < 3 ? 1 : 0), 1);
    }
    // the bartender polishing a tankard; tankards on the counter; drips from a tap
    const kx = Math.round((B.x0 + B.x1) / 2 - 4),
      ky = B.y - B.h - 12;
    sprite(c, KEEP, kx, ky, { h: "#6a3a1a", s: "#e8b88a", e: "#2a1a10", a: "#7a2a2a", w: "#e8e0cc" });
    const rub = Math.round(Math.sin(s * 4) * 2);
    c.fillStyle = "#c8c8cc";
    c.fillRect(kx + 9, ky + 7, 3, 4);
    c.fillRect(kx + 12, ky + 8, 1, 2);
    c.fillStyle = "#f4f0e4";
    c.fillRect(kx + 8 + rub, ky + 8, 2, 2);
    for (let i = 0; i < 4; i++) {
      const tx = B.x0 + 8 + i * 22,
        ty = B.y - B.h - 4;
      c.fillStyle = "#8a8a90";
      c.fillRect(tx, ty, 3, 4);
      c.fillRect(tx + 3, ty + 1, 1, 2);
      c.fillStyle = "#f4e8c0";
      c.fillRect(tx, ty - 1, 3, 1);
    }
    {
      const [tx, ty] = w.taps[1],
        t = (s * 1.5) % 1;
      c.fillStyle = "#e0b040";
      c.fillRect(tx, ty + Math.round(t * 4), 1, 1);
    }
    // patrons on stools at the bar (back view), heads turning now and then
    for (const [i, px] of [B.x0 + 14, B.x1 - 26].entries()) {
      const py = B.y - 8,
        turn = Math.sin(s * 0.3 + i * 3) > 0.8 ? 1 : 0;
      c.fillStyle = "#3a2010";
      c.fillRect(px + 1, py + 8, 1, 10);
      c.fillRect(px + 5, py + 8, 1, 10);
      c.fillRect(px - 1, py + 7, 9, 2);
      sprite(c, PATRON("c"), px, py - 14, {
        h: i ? "#2a1a10" : "#a06030",
        s: "#d8a882",
        c: i ? "#3a5a3a" : "#5a3a6a",
        d: "#2a1a10",
      });
      if (turn) {
        c.fillStyle = "#d8a882";
        c.fillRect(px + (i ? 1 : 5), py, 1, 2);
      }
    }
    // the bard by the window, strumming
    {
      const bx = Math.round(w.win.x - 14),
        by = floorY - 26,
        strum = Math.floor(s * 5) % 2;
      sprite(c, BARD, bx, by, {
        f: "#3a6a3a",
        F: "#c04040",
        h: "#e0b090",
        e: "#2a1a10",
        g: "#6a3a7a",
        l: "#c08040",
        b: "#2a1a10",
      });
      c.fillStyle = "#e0b090";
      c.fillRect(bx + 7, by + 8 + strum, 1, 1);
      c.fillStyle = "#4a2a10";
      c.fillRect(bx + 9, by + 5, 4, 1);
      c.fillRect(bx + 12, by + 4, 2, 1);
      if (Math.floor(s * 2) % 3 === 0) {
        c.fillStyle = "rgba(255,230,160,0.8)";
        c.fillRect(bx + 10 + Math.round((s * 6) % 6), by - 2 - Math.round((s * 4) % 5), 1, 2);
        c.fillRect(bx + 11 + Math.round((s * 6) % 6), by - 2 - Math.round((s * 4) % 5), 1, 1);
      }
    }
    // the dog asleep on the rug, breathing
    {
      const [rx, ry] = w.rug,
        br = Math.sin(s * 1.2) > 0 ? 0 : 1;
      sprite(c, DOG[br], rx + 22, ry + 4, { k: "#e8d8b8" });
      c.fillStyle = "#a08060";
      c.fillRect(rx + 33, ry + 4, 2, 1);
      c.fillRect(rx + 22, ry + 6, 2, 1);
    }
    // the front table: two drinkers raising mugs now and then, a candle, a steaming bowl
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < T.w; x++) {
        c.fillStyle = y < 1 ? "#b07a40" : y > 3 ? "#4a2a14" : "#7a4a24";
        c.fillRect(T.x - T.w / 2 + x, T.y + y, 1, 1);
      }
    for (const lx of [T.x - T.w / 2 + 3, T.x + T.w / 2 - 5]) {
      c.fillStyle = "#4a2a14";
      c.fillRect(lx, T.y + 5, 2, H - T.y - 5);
    }
    for (const [i, dx] of [-T.w / 2 - 4, T.w / 2 - 4].entries()) {
      const px = Math.round(T.x + dx),
        raise = Math.sin(s * 0.5 + i * 2.5) > 0.85 ? 3 : 0;
      sprite(c, PATRON("c"), px, T.y - 13, {
        h: i ? "#c08040" : "#3a2a1a",
        s: "#e0b090",
        c: i ? "#6a2a2a" : "#2a4a6a",
        d: "#2a1a10",
      });
      c.fillStyle = "#9a6a3a";
      c.fillRect(px + (i ? -2 : 7), T.y - 3 - raise, 3, 4);
      c.fillStyle = "#f4e8c0";
      c.fillRect(px + (i ? -2 : 7), T.y - 4 - raise, 3, 1);
    }
    const ccx = T.x - 10,
      cf = Math.sin(s * 10) > 0;
    c.fillStyle = "#f4ecd8";
    c.fillRect(ccx, T.y - 6, 2, 6);
    c.fillStyle = cf ? "#ffe080" : "#ffb040";
    c.fillRect(ccx, T.y - 8 - (cf ? 1 : 0), 2, 2);
    c.drawImage(w.glows.candle, ccx - 5, T.y - 13);
    c.fillStyle = "#6a5a4a";
    c.fillRect(T.x + 4, T.y - 3, 7, 3);
    c.fillStyle = "#c08a50";
    c.fillRect(T.x + 5, T.y - 3, 5, 1);
    for (let i = 0; i < 3; i++) {
      const t = (s * 0.6 + i / 3) % 1;
      c.fillStyle = `rgba(230,230,230,${0.5 * (1 - t)})`;
      c.fillRect(T.x + 6 + Math.round(Math.sin(s * 2 + i) * 1.5), T.y - 5 - Math.round(t * 8), 1, 1);
    }
    // dust drifting in the light
    for (const [px, py, p] of w.motes) {
      const x = Math.round(px * W + Math.sin(s * 0.3 + p * 9) * 6),
        y = Math.round(H * 0.2 + py * H * 0.5 + Math.cos(s * 0.2 + p * 7) * 4);
      c.fillStyle = `rgba(255,220,160,${0.3 + 0.3 * Math.sin(s + p * 10)})`;
      c.fillRect(x, y, 1, 1);
    }
    // pipe smoke and woodsmoke hanging under the beams
    w.haze ||= mist(W, 20, [200, 170, 140], 0.75, 0.35, 23);
    {
      const ox = -Math.round((s * 1.2) % W);
      c.drawImage(w.haze, ox, Math.round(H * 0.08));
      c.drawImage(w.haze, ox + W, Math.round(H * 0.08));
    }
    w.vig ||= vignette(W, H, [14, 8, 4], 0.6);
    c.drawImage(w.vig, 0, 0);
  }

  RS_SCENE.register("tavern", { build, background, sky, frame });
})();
