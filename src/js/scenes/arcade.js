"use strict";

// Arcade: neon arcade interior, cabinets running mini-games, claw machine. Weather shows through the door.
(() => {
  const { Buf, ramp, bayer, mix, css, hash, mist, motes, vignette } = RS_PX;
  const { rng } = RS_SCENE;

  // a tiny 3x5 font for the sign and screen text
  const FONT = {
    A: "010101111101101",
    R: "110101110101101",
    C: "011100100100011",
    D: "110101101101110",
    E: "111100110100111",
    I: "111010010010111",
    N: "101111111111101",
    S: "011100010001110",
    T: "111010010010010",
    O: "010101101101010",
    P: "110101110100100",
    L: "100100100100111",
    Y: "101101010010010",
    U: "101101101101111",
    G: "011100101101011",
    H: "101101111101101",
    M: "101111111101101",
    V: "101101101101010",
    1: "010110010010111",
    2: "110001010100111",
    0: "111101101101111",
    B: "110101110101110",
    K: "101101110101101",
    W: "101101111111101",
    X: "101101010101101",
    F: "111100110100100",
    Z: "111001010100111",
    " ": "000000000000000",
    "!": "010010010000010",
  };
  function text(c, s, x, y, col, scale = 1) {
    c.fillStyle = col;
    for (const ch of s) {
      const f = FONT[ch] || FONT[" "];
      for (let i = 0; i < 15; i++)
        if (f[i] === "1") c.fillRect(x + (i % 3) * scale, y + Math.floor(i / 3) * scale, scale, scale);
      x += 4 * scale;
    }
  }

  const GAMES = ["blocks", "shooter", "snake", "racer", "breaker"];
  const TITLE = { blocks: "BLOCKS", shooter: "BLAST!", snake: "SNAKE", racer: "RACER", breaker: "BRICKS" };
  const BODY = [
    [
      [140, 30, 90],
      [200, 50, 130],
    ],
    [
      [30, 60, 150],
      [50, 100, 210],
    ],
    [
      [30, 110, 70],
      [50, 170, 100],
    ],
    [
      [150, 90, 20],
      [220, 140, 40],
    ],
    [
      [90, 40, 150],
      [140, 70, 210],
    ],
  ];
  const MARQ = ["#ff4fa8", "#4fc8ff", "#6dff8a", "#ffc84f", "#c07bff"];

  function build(W, H) {
    const r = rng(1980),
      floorY = Math.round(H * 0.7);
    const doorW = Math.round(Math.min(46, W * 0.14)),
      door = { x: W - doorW - 6, y: Math.round(H * 0.2), w: doorW, h: floorY - Math.round(H * 0.2) };
    const clawW = 36,
      claw = { x: door.x - clawW - 10, w: clawW, y: floorY + 8, h: 76 };
    const space = claw.x - 12,
      n = Math.max(3, Math.min(5, Math.floor(space / 40))),
      cw = 34;
    const gap = (space - n * cw) / (n + 1);
    const cabs = Array.from({ length: n }, (_, i) => ({
      x: Math.round(gap + i * (cw + gap)),
      w: cw,
      top: floorY - 78,
      game: GAMES[i % 5],
      i,
    }));
    const carpet = Array.from({ length: Math.round((W * (H - floorY)) / 150) }, () => [
      r() * W,
      floorY + 4 + r() * (H - floorY - 4),
      Math.floor(r() * 4),
      Math.floor(r() * 3),
    ]);
    const drops = Array.from({ length: 40 }, () => [r(), r(), 0.6 + r() * 0.6]);
    const stars = Array.from({ length: 16 }, () => [r(), r() * 0.6]);
    const plush = Array.from({ length: 14 }, () => [
      r(),
      r(),
      ["#ff8ab8", "#8ad8ff", "#ffe07a", "#a8ff9a", "#d8a8ff"][Math.floor(r() * 5)],
    ]);
    return { W, H, floorY, door, claw, cabs, carpet, drops, stars, plush, blocks: null };
  }

  function background(g, w) {
    const { W, H, floorY, door: D, claw: K } = w,
      b = new Buf(g, W, H);
    // back wall: deep purple panelling with a dado rail, darker up top
    for (let y = 0; y < floorY; y++)
      for (let x = 0; x < W; x++) {
        const v = y / floorY,
          panel = x % 24 === 0 && y > floorY * 0.55;
        b.px(
          x,
          y,
          panel
            ? [24, 10, 40]
            : y > floorY * 0.55
              ? ramp(
                  [
                    [44, 18, 66],
                    [56, 24, 80],
                  ],
                  (x % 24) / 24,
                  x,
                  y,
                  0.4,
                )
              : ramp(
                  [
                    [14, 6, 26],
                    [24, 10, 42],
                    [34, 14, 56],
                  ],
                  v / 0.55,
                  x,
                  y,
                  0.3,
                ),
        );
      }
    for (let x = 0; x < W; x++) {
      b.px(x, Math.round(floorY * 0.55), [255, 90, 180]);
      b.px(x, Math.round(floorY * 0.55) + 1, [120, 30, 90]);
      b.px(x, Math.round(floorY * 0.55) - 1, [80, 20, 70]);
    }
    // carpet: navy with a cosmic pattern (triangles, squiggles, stars) in neon colours
    const CC = [
      [255, 79, 168],
      [79, 200, 255],
      [255, 200, 79],
      [109, 255, 138],
    ];
    for (let y = floorY; y < H; y++)
      for (let x = 0; x < W; x++)
        b.px(
          x,
          y,
          ramp(
            [
              [16, 12, 40],
              [22, 16, 54],
            ],
            (y - floorY) / (H - floorY),
            x,
            y,
            0.4,
          ),
        );
    for (let x = 0; x < W; x++) {
      b.px(x, floorY, [60, 40, 90]);
      b.px(x, floorY + 1, [10, 6, 20]);
    }
    for (const [cx, cy, col, shape] of w.carpet) {
      const C = CC[col];
      if (shape === 0) for (let i = 0; i < 4; i++) for (let j = 0; j <= i; j++) b.px(cx + j - i / 2, cy + i, C, 0.45);
      else if (shape === 1) for (let i = 0; i < 7; i++) b.px(cx + i, cy + Math.round(Math.sin(i * 1.3) * 1.2), C, 0.45);
      else {
        b.px(cx, cy, C, 0.7);
        b.px(cx - 1, cy, C, 0.5);
        b.px(cx + 1, cy, C, 0.5);
        b.px(cx, cy - 1, C, 0.5);
        b.px(cx, cy + 1, C, 0.5);
      }
    }
    // framed posters between the sign and the cabinets: a rocket, an alien, a race flag
    const signEnd = Math.round((K.x - 72) / 2) + 72;
    const posters = [
      [signEnd + 10, [255, 79, 168], 0],
      [signEnd + 32, [79, 200, 255], 1],
      [signEnd + 54, [255, 200, 79], 2],
    ];
    for (const [px, col, kind] of posters) {
      const py = 10,
        pw = 16,
        ph = 20;
      if (px + pw > K.x - 4) continue;
      for (let y = 0; y < ph; y++)
        for (let x = 0; x < pw; x++)
          b.px(
            px + x,
            py + y,
            x === 0 || y === 0 || x === pw - 1 || y === ph - 1
              ? [20, 16, 26]
              : x === 1 || y === 1
                ? mix(col, [0, 0, 0], 0.3)
                : [30, 20, 50],
          );
      if (kind === 0) {
        for (let y = 4; y < 15; y++) for (let x = 6; x < 10; x++) b.px(px + x, py + y, y < 7 ? col : [220, 220, 230]);
        b.px(px + 5, py + 13, col);
        b.px(px + 10, py + 13, col);
        b.px(px + 7, py + 16, [255, 200, 60]);
        b.px(px + 8, py + 17, [255, 120, 40]);
      } else if (kind === 1) {
        for (let y = 5; y < 14; y++)
          for (let x = 4; x < 12; x++) if ((x - 7.5) ** 2 / 16 + (y - 9) ** 2 / 20 < 1) b.px(px + x, py + y, col);
        b.px(px + 6, py + 8, [10, 10, 20]);
        b.px(px + 9, py + 8, [10, 10, 20]);
        b.px(px + 5, py + 4, col);
        b.px(px + 10, py + 4, col);
      } else
        for (let y = 4; y < 14; y++)
          for (let x = 4; x < 12; x++) b.px(px + x, py + y, ((x >> 1) + (y >> 1)) % 2 ? [240, 240, 240] : [20, 20, 20]);
      for (let x = 3; x < pw - 3; x++) if (x % 2) b.px(px + x, py + ph - 3, mix(col, [255, 255, 255], 0.4));
    }
    // a change machine by the door
    const cmx = D.x - 12;
    for (let y = 0; y < 26; y++)
      for (let x = 0; x < 9; x++)
        b.px(
          cmx + x,
          floorY - y,
          x === 0 ? [170, 170, 180] : x === 8 ? [70, 70, 80] : y > 20 ? [60, 60, 70] : [120, 120, 132],
        );
    for (let x = 2; x < 7; x++) b.px(cmx + x, floorY - 18, [20, 20, 20]);
    b.px(cmx + 4, floorY - 13, [255, 200, 60]);
    b.px(cmx + 4, floorY - 12, [255, 200, 60]);
    // door frame (the glass is drawn live)
    for (let y = D.y - 3; y < D.y + D.h; y++) for (let x = D.x - 3; x < D.x + D.w + 3; x++) b.px(x, y, [70, 70, 84]);
    // cabinets: side art in two tones, recessed screen bezel, control deck, coin door
    for (const cb of w.cabs) {
      const [dark, light] = BODY[cb.i % 5],
        x0 = cb.x,
        top = cb.top;
      for (let y = top; y < floorY; y++)
        for (let x = x0; x < x0 + cb.w; x++) {
          const rel = y - top,
            lx = x - x0;
          let col = lx < 3 || lx > cb.w - 4 ? light : dark;
          if (rel > 34 && rel < 44) col = mix(dark, [0, 0, 0], 0.4); // control deck shadow
          if (rel > 50 && lx > 10 && lx < cb.w - 10 && rel < 62) col = [26, 22, 30]; // coin door
          if (lx === 3 || lx === cb.w - 4) col = mix(light, [255, 255, 255], 0.25);
          b.px(x, y, col);
        }
      for (let y = top + 12; y < top + 34; y++) for (let x = x0 + 4; x < x0 + cb.w - 4; x++) b.px(x, y, [10, 8, 14]); // bezel
      for (let x = x0 + 2; x < x0 + cb.w - 2; x++)
        for (let y = top + 34; y < top + 38; y++)
          b.px(x, y, y === top + 34 ? mix(light, [255, 255, 255], 0.3) : [40, 36, 48]); // deck
      b.px(x0 + 9, top + 32, [20, 20, 20]);
      b.px(x0 + 9, top + 31, [220, 40, 40]);
      b.px(x0 + 10, top + 31, [220, 40, 40]); // stick
      for (const [bx, bc] of [
        [18, [255, 220, 60]],
        [22, [60, 200, 255]],
        [26, [255, 80, 160]],
      ])
        b.px(x0 + bx, top + 35, bc);
      for (const [cx, cy] of [
        [cb.w / 2 - 3, 54],
        [cb.w / 2 + 2, 54],
      ]) {
        b.px(x0 + cx, top + cy, [255, 120, 60]);
        b.px(x0 + cx, top + cy + 1, [255, 120, 60]);
      }
    }
    // claw machine: base, glass case frame (contents live)
    for (let y = K.y - 24; y < K.y; y++)
      for (let x = K.x; x < K.x + K.w; x++) b.px(x, y, (x - K.x) % 6 < 3 ? [230, 60, 140] : [250, 230, 240]);
    for (let y = K.y - K.h; y < K.y - 24; y++)
      for (const x of [K.x, K.x + 1, K.x + K.w - 2, K.x + K.w - 1]) b.px(x, y, [220, 220, 230]);
    for (let x = K.x; x < K.x + K.w; x++) for (let y = K.y - K.h - 8; y < K.y - K.h; y++) b.px(x, y, [230, 60, 140]);
    for (let y = K.y - 18; y < K.y - 8; y++) for (let x = K.x + 10; x < K.x + 18; x++) b.px(x, y, [30, 20, 30]); // prize chute
    b.put(g);
  }

  function sky(c, w, e, s) {
    // outside the glass door: the real sky, a street lamp, rain or snow
    const { door: D } = w;
    const top = mix([8, 10, 30], [90, 150, 220], e.day),
      bot = mix([30, 24, 60], [180, 210, 240], e.day);
    for (let y = 0; y < D.h; y++)
      for (let x = 0; x < D.w; x++) {
        let col = ramp([top, mix(top, bot, 0.5), bot], y / D.h, x, y, 0.3);
        if (e.wx.grey > 0.4) col = mix(col, [90 * (0.3 + e.day), 94 * (0.3 + e.day), 104 * (0.3 + e.day)], 0.6);
        c.fillStyle = css(col);
        c.fillRect(D.x + x, D.y + y, 1, 1);
      }
    if (e.night && e.wx.clouds < 0.8) {
      c.fillStyle = "#e8ecff";
      for (const [px, py] of w.stars) c.fillRect(D.x + Math.round(px * D.w), D.y + Math.round(py * D.h * 0.5), 1, 1);
    }
    // street: kerb, lamp post with a glow at night, buildings opposite
    c.fillStyle = e.night ? "#100c1c" : "#5a5466";
    for (let x = 0; x < D.w; x++) {
      const hh = 20 + (Math.floor(x / 9) % 3) * 8;
      c.fillRect(D.x + x, D.y + D.h - hh, 1, hh);
    }
    if (e.night) {
      c.fillStyle = "#ffd070";
      for (let i = 0; i < 6; i++) c.fillRect(D.x + 3 + ((i * 7) % (D.w - 4)), D.y + D.h - 14 - (i % 3) * 6, 1, 1);
    }
    c.fillStyle = "#2a2a32";
    c.fillRect(D.x + D.w - 8, D.y + 14, 1, D.h - 14);
    c.fillRect(D.x + D.w - 12, D.y + 14, 5, 1);
    if (e.night)
      for (let yy = -6; yy <= 6; yy++)
        for (let xx = -6; xx <= 6; xx++) {
          const d = Math.sqrt(xx * xx + yy * yy) / 6;
          if (d < 1 && (1 - d) * 0.7 > bayer(xx + 8, yy + 8)) {
            c.fillStyle = "rgba(255,200,110,0.5)";
            c.fillRect(D.x + D.w - 11 + xx, D.y + 16 + yy, 1, 1);
          }
        }
    if (e.wx.rain) {
      c.fillStyle = "rgba(180,200,240,0.8)";
      for (const [px, py, sp] of w.drops) {
        const y = Math.round((py * D.h + s * 50 * sp) % D.h);
        c.fillRect(D.x + Math.round(px * D.w), D.y + y, 1, 2);
      }
    }
    if (e.wx.snow) {
      c.fillStyle = "#fff";
      for (const [px, py, sp] of w.drops) {
        const y = Math.round((py * D.h + s * 8 * sp) % D.h);
        c.fillRect(D.x + Math.round(px * D.w + Math.sin(s + py * 9) * 2), D.y + y, 1, 1);
      }
    }
    // door bar and "OPEN" sign on the glass
    c.fillStyle = "#9a9aa8";
    c.fillRect(D.x + 3, D.y + Math.round(D.h * 0.55), D.w - 6, 1);
    const on = Math.sin(s * 1.3) > -0.9;
    c.fillStyle = "#1a0a1a";
    c.fillRect(D.x + Math.round(D.w / 2) - 9, D.y + 6, 19, 9);
    text(c, "OPEN", D.x + Math.round(D.w / 2) - 7, D.y + 8, on ? "#ff5050" : "#5a2020");
  }

  // the screens: each a tiny game on a 24x20 field
  const SW = 24,
    SH = 20;
  function screen(c, x0, y0, game, s, i, w) {
    c.fillStyle = "#06060c";
    c.fillRect(x0, y0, SW, SH);
    const t = s + i * 13;
    if (game === "blocks") {
      if (!w.blocks) {
        const r = rng(7);
        w.blocks = Array.from({ length: 10 }, (_, y) =>
          Array.from({ length: 8 }, () => (y > 5 && r() > 0.25 ? 1 + Math.floor(r() * 4) : 0)),
        );
      }
      const cols = ["", "#ff4f6a", "#4fc8ff", "#ffd84f", "#8aff6a"];
      w.blocks.forEach((row, y) =>
        row.forEach((v, x) => {
          if (v) {
            c.fillStyle = cols[v];
            c.fillRect(x0 + 4 + x * 2, y0 + y * 2, 2, 2);
          }
        }),
      );
      const fy = Math.floor((t * 3) % 12),
        fx = 1 + (Math.floor(t / 4) % 5);
      c.fillStyle = "#c07bff";
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [2, 0],
        [1, 1],
      ])
        c.fillRect(x0 + 4 + (fx + dx) * 2, y0 + (fy + dy - 2) * 2, 2, 2);
      c.fillStyle = "#3a3a5a";
      c.fillRect(x0 + 3, y0, 1, SH);
      c.fillRect(x0 + 20, y0, 1, SH);
    } else if (game === "shooter") {
      const march = Math.round(Math.sin(t * 0.8) * 3),
        drop = Math.floor(t * 0.3) % 4;
      for (let r = 0; r < 3; r++)
        for (let k = 0; k < 5; k++) {
          c.fillStyle = ["#ff4fa8", "#ffd84f", "#6dff8a"][r];
          const ix = x0 + 3 + k * 4 + march,
            iy = y0 + 2 + r * 3 + drop;
          c.fillRect(ix, iy, 3, 1);
          if (Math.floor(t * 4) % 2) {
            c.fillRect(ix, iy + 1, 1, 1);
            c.fillRect(ix + 2, iy + 1, 1, 1);
          } else c.fillRect(ix + 1, iy + 1, 1, 1);
        }
      const sx = x0 + 11 + Math.round(Math.sin(t * 1.3) * 8);
      c.fillStyle = "#4fc8ff";
      c.fillRect(sx - 1, y0 + SH - 2, 3, 1);
      c.fillRect(sx, y0 + SH - 3, 1, 1);
      c.fillStyle = "#ffffff";
      const by = Math.floor((t * 20) % 14);
      c.fillRect(sx, y0 + SH - 4 - by, 1, 2);
    } else if (game === "snake") {
      const len = 9,
        path = (k) => {
          const p = Math.floor(t * 6) - k,
            per = 2 * (SW - 4) + 2 * (SH - 6),
            q = ((p % per) + per) % per;
          if (q < SW - 4) return [2 + q, 3];
          if (q < SW - 4 + SH - 6) return [SW - 2, 3 + q - (SW - 4)];
          if (q < 2 * (SW - 4) + SH - 6) return [SW - 2 - (q - (SW - 4 + SH - 6)), SH - 3];
          return [2, SH - 3 - (q - (2 * (SW - 4) + SH - 6))];
        };
      for (let k = 0; k < len; k++) {
        const [px, py] = path(k);
        c.fillStyle = k === 0 ? "#c8ff9a" : "#4fdc6a";
        c.fillRect(x0 + px, y0 + py, 1, 1);
      }
      c.fillStyle = "#ff4f6a";
      c.fillRect(x0 + 12, y0 + 10, 1, 1);
      text(c, "1UP", x0 + 7, y0 + 13, "#3a6a4a");
    } else if (game === "racer") {
      for (let y = 6; y < SH; y++) {
        const half = 2 + (y - 6) * 0.8,
          cx = SW / 2 + Math.sin(t * 0.5) * (SH - y) * 0.15;
        c.fillStyle = Math.floor(y * 0.6 - t * 6) % 2 ? "#2a8a3a" : "#1e6a2c";
        c.fillRect(x0, y0 + y, SW, 1);
        c.fillStyle = "#444450";
        c.fillRect(x0 + Math.round(cx - half), y0 + y, Math.round(half * 2), 1);
        if (Math.floor(y * 0.6 - t * 6) % 2) {
          c.fillStyle = "#fff";
          c.fillRect(x0 + Math.round(cx), y0 + y, 1, 1);
        }
      }
      c.fillStyle = "#ff8a3a";
      c.fillRect(x0, y0, SW, 2);
      c.fillStyle = "#4a3aa8";
      c.fillRect(x0, y0 + 2, SW, 4);
      c.fillStyle = "#ff3a3a";
      const px = x0 + 10 + Math.round(Math.sin(t * 0.9) * 2);
      c.fillRect(px, y0 + SH - 3, 4, 2);
      c.fillStyle = "#111";
      c.fillRect(px, y0 + SH - 1, 1, 1);
      c.fillRect(px + 3, y0 + SH - 1, 1, 1);
    } else {
      for (let r = 0; r < 4; r++)
        for (let k = 0; k < 7; k++)
          if ((r * 7 + k + Math.floor(t / 3)) % 5) {
            c.fillStyle = ["#ff4f6a", "#ffb04f", "#ffe84f", "#6dff8a"][r];
            c.fillRect(x0 + 1 + k * 3, y0 + 2 + r * 2, 2, 1);
          }
      const bx = Math.abs(((t * 9) % 40) - 20) + 2,
        by = Math.abs(((t * 7) % 20) - 10) + 9;
      c.fillStyle = "#fff";
      c.fillRect(x0 + Math.round(bx), y0 + Math.round(by), 1, 1);
      c.fillStyle = "#4fc8ff";
      c.fillRect(x0 + Math.round(bx) - 2, y0 + SH - 1, 5, 1);
    }
    // scanlines and a slight glass sheen
    c.fillStyle = "rgba(0,0,0,0.28)";
    for (let y = 1; y < SH; y += 2) c.fillRect(x0, y0 + y, SW, 1);
    c.fillStyle = "rgba(255,255,255,0.08)";
    c.fillRect(x0 + 1, y0 + 1, 6, 1);
  }

  function frame(c, w, e, s) {
    const { W, H, floorY, cabs, claw: K } = w;
    // ceiling neon tubes
    for (let i = 0; i < 3; i++) {
      const x0 = Math.round(W * (0.08 + i * 0.3)),
        len = Math.round(W * 0.2);
      c.fillStyle = "rgba(80,220,255,0.25)";
      c.fillRect(x0 - 2, 3, len + 4, 5);
      c.fillStyle = "#c8f6ff";
      c.fillRect(x0, 5, len, 1);
    }
    // light falling from the tubes through the hazy air, dust turning in it
    for (let i = 0; i < 3; i++) {
      const x0 = Math.round(W * (0.08 + i * 0.3)),
        len = Math.round(W * 0.2);
      for (let y = 8; y < floorY; y++) {
        const t = (y - 8) / (floorY - 8),
          spread = Math.round(t * len * 0.25);
        c.fillStyle = `rgba(140,230,255,${0.07 * (1 - t * 0.6)})`;
        c.fillRect(x0 - spread, y, len + spread * 2, 1);
      }
    }
    w.dust ||= Array.from({ length: Math.round(W / 9) }, (_, i) => [hash(i, 1), hash(i, 2), hash(i, 3)]);
    motes(c, w.dust, s, [0, 10, W, floorY - 10], { col: "rgba(200,240,255,0.45)", vx: 1.5, vy: 1, wob: 3 });
    w.haze ||= mist(W, 16, [140, 70, 170], 0.75, 0.35, 37);
    {
      const ox = -Math.round((s * 1) % W);
      c.drawImage(w.haze, ox, 6);
      c.drawImage(w.haze, ox + W, 6);
    }
    // the big neon sign, with a flicker on one letter
    const word = "ARCADE",
      sc = 3,
      sw = word.length * 4 * sc,
      sx = Math.round((K.x - sw) / 2),
      sy = 16;
    const flick = Math.sin(s * 23) > 0.6 && Math.sin(s * 0.7) > 0.5;
    for (let yy = -4; yy < 5 * sc + 4; yy++)
      for (let xx = -6; xx < sw + 4; xx++)
        if (bayer(xx, yy) < 0.18) {
          c.fillStyle = "rgba(79,200,255,0.3)";
          c.fillRect(sx + xx, sy + yy, 1, 1);
        }
    [...word].forEach((ch, i) => text(c, ch, sx + i * 4 * sc, sy, flick && i === 3 ? "#183a5a" : "#7adcff", sc));
    text(
      c,
      "HIGH SCORE 120200",
      sx + Math.round(sw / 2) - 34,
      sy + 5 * sc + 6,
      Math.floor(s * 2) % 2 ? "#ffd84f" : "#a88a2a",
    );
    // a neon planet with a ring, left of the sign
    const px = sx - 26,
      py = 26;
    if (px > 12) {
      c.fillStyle = "#ffd84f";
      for (let a = 0; a < 40; a++) {
        const an = (a / 40) * Math.PI * 2;
        c.fillRect(Math.round(px + Math.cos(an) * 7), Math.round(py + Math.sin(an) * 7), 1, 1);
      }
      c.fillStyle = "#6dff8a";
      for (let a = 0; a < 60; a++) {
        const an = (a / 60) * Math.PI * 2,
          rx = Math.cos(an) * 13,
          ry = Math.sin(an) * 3;
        if (ry > 0 || Math.abs(rx) > 7) c.fillRect(Math.round(px + rx), Math.round(py + ry), 1, 1);
      }
    }
    // cabinets: marquee, screen game, screen glow on the floor in front
    for (const cb of cabs) {
      const col = MARQ[cb.i % 5],
        x0 = cb.x,
        top = cb.top;
      c.fillStyle = col;
      c.fillRect(x0 + 1, top, cb.w - 2, 9);
      c.fillStyle = "rgba(255,255,255,0.55)";
      c.fillRect(x0 + 2, top + 1, cb.w - 4, 1);
      const title = TITLE[cb.game];
      text(c, title, x0 + Math.round((cb.w - title.length * 4) / 2) + 1, top + 2, "#1a0a1a");
      screen(c, x0 + 5, top + 13, cb.game, s, cb.i, w);
      for (let y = floorY; y < Math.min(H, floorY + 26); y++)
        for (let x = x0 - 6; x < x0 + cb.w + 6; x++) {
          const d = Math.abs(x - (x0 + cb.w / 2)) / (cb.w / 2 + 6) + (y - floorY) / 26;
          if (d < 1 && (1 - d) * 0.45 > bayer(x, y)) {
            c.fillStyle = col;
            c.globalAlpha = 0.18;
            c.fillRect(x, y, 1, 1);
            c.globalAlpha = 1;
          }
        }
    }
    // a player at the second cabinet: back view, hood up, arms working the controls
    if (cabs[1]) {
      const cb = cabs[1],
        bx = cb.x + Math.round(cb.w / 2) - 5,
        by = floorY + 4,
        jig = Math.floor(s * 6) % 2;
      c.fillStyle = "#1a1a24";
      c.fillRect(bx + 2, by - 12, 2, 12);
      c.fillRect(bx + 6, by - 12, 2, 12); // legs
      c.fillStyle = "#2a5ad8";
      c.fillRect(bx, by - 28, 10, 16); // hoodie
      c.fillStyle = "#1e44a8";
      c.fillRect(bx + 1, by - 34, 8, 7);
      c.fillRect(bx, by - 30, 10, 1); // hood
      c.fillStyle = "#2a5ad8";
      c.fillRect(bx - 2, by - 26 - jig, 2, 6);
      c.fillRect(bx + 10, by - 26 - (1 - jig), 2, 6); // arms
      c.fillStyle = "#e8e8f0";
      c.fillRect(bx + 2, by - 1, 3, 1);
      c.fillRect(bx + 6, by - 1, 3, 1); // trainers
    }
    // a second player at the fourth cabinet, and a kid watching the first player
    if (cabs[3]) {
      const cb = cabs[3],
        bx = cb.x + Math.round(cb.w / 2) - 5,
        by = floorY + 4,
        jig = Math.floor(s * 5 + 1) % 2;
      c.fillStyle = "#2a2a34";
      c.fillRect(bx + 2, by - 12, 2, 12);
      c.fillRect(bx + 6, by - 12, 2, 12);
      c.fillStyle = "#c83a3a";
      c.fillRect(bx, by - 27, 10, 15);
      c.fillStyle = "#3a2010";
      c.fillRect(bx + 1, by - 33, 8, 6);
      c.fillStyle = "#c83a3a";
      c.fillRect(bx - 2, by - 25 - jig, 2, 6);
      c.fillRect(bx + 10, by - 25 - (1 - jig), 2, 6);
      c.fillStyle = "#f0f0f0";
      c.fillRect(bx + 2, by - 1, 3, 1);
      c.fillRect(bx + 6, by - 1, 3, 1);
    }
    if (cabs[1]) {
      const kx = cabs[1].x + cabs[1].w + 4,
        ky = floorY + 6,
        look = Math.sin(s * 0.8) > 0 ? 0 : 1;
      c.fillStyle = "#2a3a6a";
      c.fillRect(kx + 1, ky - 8, 2, 8);
      c.fillRect(kx + 4, ky - 8, 2, 8);
      c.fillStyle = "#ffd84f";
      c.fillRect(kx, ky - 17, 7, 9);
      c.fillStyle = "#e0b090";
      c.fillRect(kx + 1, ky - 22, 5, 5);
      c.fillStyle = "#5a3018";
      c.fillRect(kx + 1, ky - 23, 5, 2);
      c.fillRect(kx + (look ? 5 : 1), ky - 21, 1, 2);
    }
    // a pinball table in the foreground, lights chasing, a flipper flicking
    {
      const px = Math.round(W * 0.05),
        py = H - 6,
        pw = 40;
      c.fillStyle = "#1a1030";
      for (let y = 0; y < 18; y++) c.fillRect(px + Math.round(y * 0.6), py - 14 - y * 0.0 - Math.round(y * 0.4), pw, 1);
      for (let y = 0; y < 10; y++)
        for (let x = 0; x < pw - 2; x++) {
          c.fillStyle = (x + y) % 9 === 0 ? "#6a2a8a" : "#2a1a4a";
          c.fillRect(px + 1 + x + Math.round(y * 0.6), py - 16 - Math.round(y * 0.4) + 0, 1, 1);
        }
      c.fillStyle = "#c83a8a";
      c.fillRect(px, py - 14, pw, 8);
      c.fillStyle = "#ff7ac0";
      c.fillRect(px, py - 14, pw, 1);
      c.fillStyle = "#1a1030";
      c.fillRect(px + 2, py - 6, 3, 6);
      c.fillRect(px + pw - 5, py - 6, 3, 6);
      for (let i = 0; i < 8; i++) {
        c.fillStyle = Math.floor(s * 6 + i) % 8 < 2 ? "#ffe84f" : "#5a4a20";
        c.fillRect(px + 4 + i * 4, py - 12, 2, 2);
      }
      const fl = Math.sin(s * 3) > 0.7 ? 1 : 0;
      c.fillStyle = "#e8e8f0";
      c.fillRect(px + 14, py - 19 - fl, 5, 1);
      c.fillRect(px + 22, py - 19 - (1 - fl), 5, 1);
      c.fillStyle = "#ffffff";
      c.fillRect(
        px + 10 + Math.round(Math.abs(((s * 14) % 40) - 20)),
        py - 22 - Math.round(Math.abs(Math.sin(s * 2)) * 3),
        1,
        1,
      );
    }
    // claw machine: plush pile, the claw wandering then dipping, glass sheen
    const gx = K.x + 2,
      gw = K.w - 4,
      gTop = K.y - K.h,
      gBot = K.y - 24;
    c.fillStyle = "rgba(40,20,60,0.85)";
    c.fillRect(gx, gTop, gw, gBot - gTop);
    for (const [px2, py2, col] of w.plush) {
      const x = gx + 2 + Math.round(px2 * (gw - 7)),
        y = gBot - 4 - Math.round(py2 * 10);
      c.fillStyle = col;
      c.fillRect(x, y, 4, 4);
      c.fillRect(x, y - 1, 1, 1);
      c.fillRect(x + 3, y - 1, 1, 1);
      c.fillStyle = "#1a1a1a";
      c.fillRect(x + 1, y + 1, 1, 1);
      c.fillRect(x + 2, y + 1, 1, 1);
    }
    const cyc = s % 10,
      cx = gx + Math.round(gw / 2 + Math.sin(Math.floor(s / 10) * 2.3 + Math.min(cyc, 6) * 0.6) * (gw / 2 - 5));
    const dip = cyc < 6 ? 0 : cyc < 8 ? (cyc - 6) / 2 : 1 - (cyc - 8) / 2,
      cy = gTop + 3 + Math.round(dip * (gBot - gTop - 18));
    c.fillStyle = "#c8c8d0";
    c.fillRect(gx, gTop + 1, gw, 1);
    c.fillRect(cx, gTop + 1, 1, cy - gTop);
    c.fillRect(cx - 2, cy, 5, 1);
    const open = cyc > 6.5 && cyc < 7.5 ? 1 : 0;
    c.fillRect(cx - 2 - open, cy + 1, 1, 3);
    c.fillRect(cx + 2 + open, cy + 1, 1, 3);
    c.fillStyle = "rgba(255,255,255,0.12)";
    for (let y = gTop; y < gBot; y++) c.fillRect(gx + 3 + Math.round((y - gTop) * 0.3), y, 2, 1);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = Math.floor(s * 4 + i) % 3 === 0 ? "#ffe84f" : "#6a5a20";
      c.fillRect(K.x + 3 + i * Math.round((K.w - 6) / 5), gTop - 5, 2, 2);
    } // chaser lights
    w.vig ||= vignette(W, H, [10, 4, 20], 0.55);
    c.drawImage(w.vig, 0, 0);
  }

  RS_SCENE.register("arcade", { fps: 12, build, background, sky, frame });
})();
