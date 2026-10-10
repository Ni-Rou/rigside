"use strict";

// Hellforge: lava plain, citadel and refinery. Rain/snow fall as ash, thunder is red.
(() => {
  const { Buf, ramp, bayer, H_, mix, css, skyRamp, ridge, glowSprite, shade, mist, softGlow, vignette } = RS_PX;
  const { rng } = RS_SCENE;
  const SKY = {
    night: H_(["#0e0204", "#1e0508", "#36080a", "#540e0a", "#74180c"]),
    day: H_(["#4a1a10", "#7a2a12", "#a84014", "#cc6018", "#e88a2a"]),
    warm: H_(["#2a0a10", "#5a1414", "#9a2a14", "#d8501a", "#ff8a30"]),
    grey: H_(["#2a1a18", "#3e2420", "#542e24", "#6a3a28", "#80482c"]),
  };
  const LAVA = [
    [255, 240, 160],
    [255, 190, 60],
    [255, 110, 20],
    [200, 40, 10],
    [110, 16, 8],
  ];

  function build(W, H) {
    const r = rng(666),
      hy = Math.round(H * 0.6);
    const far = ridge(r, W, [
        [40, 1],
        [13, 0.5],
        [5, 0.2],
      ]),
      near = ridge(r, W, [
        [60, 1],
        [20, 0.5],
        [7, 0.25],
      ]);
    // a lava river: from the far range towards the viewer, widening
    const river = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      river.push([W * (0.5 + Math.sin(t * 4) * 0.12 - t * 0.12), hy + 2 + t * (H - hy), 1 + t * t * 9]);
    }
    const river2 = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      river2.push([W * (0.86 - t * 0.2 + Math.sin(t * 5) * 0.04), hy + 4 + t * (H - hy) * 0.7, 1 + t * 4]);
    }
    const cit = { x: Math.round(W * 0.66), base: hy + 2 };
    const ref = { x: Math.round(W * 0.2), base: Math.round(H * 0.7) };
    const embers = Array.from({ length: Math.round((W * H) / 300) }, () => [r(), r(), r()]);
    const ash = Array.from({ length: Math.round((W * H) / 200) }, () => [r(), r(), 0.6 + r() * 0.6]);
    const geysers = [
      [W * 0.42, H * 0.82],
      [W * 0.78, H * 0.75],
    ];
    return { W, H, hy, far, near, river, river2, cit, ref, embers, ash, geysers, glows: {} };
  }

  function background(g, w, e) {
    const { W, H, hy } = w,
      b = new Buf(g, W, H),
      sky = skyRamp(e, SKY);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b.px(x, y, ramp(sky, y / hy, x, y, 0.3));
    // moons at night, a pale disc of sun by day
    if (e.night) {
      for (const [mx, my, R, col] of [
        [0.24, 0.14, 6, [230, 200, 180]],
        [0.33, 0.08, 3, [200, 150, 140]],
      ])
        for (let y = -R; y <= R; y++)
          for (let x = -R; x <= R; x++)
            if (x * x + y * y <= R * R) b.px(W * mx + x, H * my + y, x + y > R * 0.5 ? shade(col, -0.4) : col);
    } else
      for (let y = -9; y <= 9; y++)
        for (let x = -9; x <= 9; x++) {
          const d = x * x + y * y;
          if (d <= 81) b.px(W * 0.3 + x, H * 0.18 + y, [255, 220, 170], d > 64 ? 0.5 : 0.85);
        }
    // smoke banks: dark above, underlit orange below
    const r = rng(13);
    for (let i = 0; i < 9 + Math.round(e.wx.clouds * 6); i++) {
      const cx = r() * W,
        cy = hy * (0.1 + r() * 0.7),
        cw = 30 + r() * 60,
        ch = 5 + r() * 7;
      for (let y = -ch; y <= ch; y++)
        for (let x = -cw; x <= cw; x++) {
          const d = (x / cw) ** 2 + (y / ch) ** 2 + Math.sin(x * 0.25 + i) * 0.1;
          if (d > 1) continue;
          const under = (y + ch) / (2 * ch);
          const col = ramp(
            [
              [40, 14, 14],
              [70, 22, 16],
              [140, 50, 20],
              [220, 100, 30],
            ],
            under * under * (0.6 + (cy / hy) * 0.6),
            x + i,
            y,
            0.4,
          );
          if (d < 0.8 || bayer(x, y) > (d - 0.8) * 5) b.px(cx + x, cy + y, col);
        }
    }
    // far range: jagged, black-red, rim-lit from the lava below
    for (let x = 0; x < W; x++) {
      const top = Math.round(hy - 8 - w.far[x] * H * 0.2 - (x % 7 === 0 ? 2 : 0));
      for (let y = top; y < hy + 6; y++)
        b.px(x, y, y - top < 1 ? [150, 50, 30] : mix([46, 14, 14], sky[4], 0.25 + (y - top) / 80));
    }
    b.put(g);
  }

  function land(g, w, e) {
    const { W, H, hy, cit: C, ref: R } = w,
      b = new Buf(g, W, H);
    const P = (x, y, c, a) => b.px(x, y, c, a);
    // near range, black with a molten rim
    for (let x = 0; x < W; x++) {
      const top = Math.round(hy - w.near[x] * H * 0.12);
      for (let y = top; y < hy + 8; y++)
        P(x, y, y === top ? [120, 40, 24] : (x + y) % 5 === 0 ? [20, 8, 10] : [32, 12, 14]);
    }
    // the citadel: tiers of spires on a crag, rune slits, a great gate
    for (let x = -26; x <= 26; x++) {
      const top = C.base - 6 + Math.round(Math.abs(x) * 0.3);
      for (let y = top; y < C.base + 8; y++) P(C.x + x, y, [26, 10, 12]);
    }
    const spire = (sx, h, wd) => {
      for (let y = 0; y < h; y++) {
        const hw = Math.max(0, Math.round(wd * (1 - y / h)));
        for (let k = -hw; k <= hw; k++)
          P(sx + k, C.base - 6 - y, k === -hw ? [80, 40, 40] : k === hw ? [16, 6, 8] : [40, 16, 18]);
      }
      for (let k = 0; k < 3; k++) {
        P(sx - wd - 1 - k, C.base - 6 - h * 0.4 - k * 2, [40, 16, 18]);
        P(sx + wd + 1 + k, C.base - 6 - h * 0.4 - k * 2, [40, 16, 18]);
      }
    };
    spire(C.x, H * 0.46, 6);
    spire(C.x - 12, H * 0.3, 4);
    spire(C.x + 12, H * 0.32, 4);
    spire(C.x - 21, H * 0.18, 3);
    spire(C.x + 22, H * 0.2, 3);
    w.runes = [];
    for (const [sx, h] of [
      [C.x, H * 0.46],
      [C.x - 12, H * 0.3],
      [C.x + 12, H * 0.32],
    ])
      for (let k = 0.2; k < 0.7; k += 0.15) w.runes.push([sx, Math.round(C.base - 6 - h * k)]);
    for (let y = 0; y < 8; y++)
      for (let x = -3; x <= 3; x++) if (y > 2 || x * x + (3 - y) ** 2 <= 9) P(C.x + x, C.base - 2 - y, [255, 120, 30]);
    w.gate = [C.x, C.base - 5];
    // plain: cracked basalt, cracks glowing
    for (let y = hy + 2; y < H; y++)
      for (let x = 0; x < W; x++) {
        const d = (y - hy) / (H - hy),
          cell = Math.sin(x * 0.21 + Math.sin(y * 0.31) * 2) * Math.sin(y * (0.5 - d * 0.3) + Math.sin(x * 0.13) * 2);
        let c = ramp(
          [
            [20, 10, 12],
            [36, 16, 16],
            [52, 24, 20],
          ],
          0.3 + d * 0.5 + (bayer(x, y) - 0.5) * 0.2,
          x,
          y,
          0.5,
        );
        const near = Math.min(
          ...[...w.river, ...w.river2]
            .filter((_, i) => i % 4 === 0)
            .map(([rx, ry]) => Math.abs(rx - x) + Math.abs(ry - y) * 2),
        );
        if (Math.abs(cell) < 0.035 && near < 40) c = mix([255, 90, 20], c, 0.35 + near / 70);
        P(x, y, c);
      }
    // lava rivers, with a crust edge; remember their pixels for the flow animation
    w.lava = [];
    for (const [ri, rv] of [w.river, w.river2].entries())
      for (let i = 0; i < rv.length - 1; i++) {
        const [x0, y0, w0] = rv[i],
          [x1, y1] = rv[i + 1];
        for (let yy = Math.floor(y0); yy <= Math.ceil(y1); yy++) {
          const t = (yy - y0) / Math.max(1, y1 - y0),
            cx = x0 + (x1 - x0) * t;
          for (let k = -w0 - 1; k <= w0 + 1; k++) {
            const edge = Math.abs(k) > w0 - 0.5;
            P(cx + k, yy, edge ? [70, 20, 14] : LAVA[2]);
            if (!edge && (k + yy) % 2 === 0)
              w.lava.push([Math.round(cx + k), yy, i / rv.length + ri * 0.3, Math.abs(k) / w0]);
          }
        }
      }
    // the refinery: tanks, a pipe rack, chimneys and two flare stacks, a catwalk
    const M1 = [70, 60, 60],
      M2 = [44, 36, 38],
      M3 = [100, 86, 80];
    const tank = (tx, tw, th) => {
      for (let y = 0; y < th; y++)
        for (let x = 0; x < tw; x++) P(tx + x, R.base - y, x < 2 ? M3 : x > tw - 3 ? M2 : y % 6 === 0 ? M2 : M1);
      for (let x = 1; x < tw - 1; x++) P(tx + x, R.base - th, M3);
    };
    tank(R.x - 26, 14, 16);
    tank(R.x - 10, 10, 22);
    tank(R.x + 22, 16, 12);
    for (let x = R.x - 30; x < R.x + 40; x++) {
      P(x, R.base - 9, M2);
      P(x, R.base - 10, M3);
      if (x % 6 === 0) for (let y = R.base - 9; y < R.base; y++) P(x, y, M2);
    }
    for (let x = R.x - 28; x < R.x + 40; x++) if (x % 2) P(x, R.base - 24, [60, 50, 50]);
    w.chimneys = [];
    for (const [cx, ch] of [
      [R.x + 4, 38],
      [R.x + 12, 30],
    ]) {
      for (let y = 0; y < ch; y++)
        for (let k = 0; k < 4; k++)
          P(cx + k, R.base - y, k === 0 ? M3 : k === 3 ? M2 : Math.floor(y / 5) % 2 ? [120, 30, 24] : M1);
      w.chimneys.push([cx + 2, R.base - ch]);
    }
    w.flares = [];
    for (const [fx, fh] of [
      [R.x - 20, 46],
      [R.x + 34, 40],
    ]) {
      for (let y = 0; y < fh; y++) {
        P(fx, R.base - y, M3);
        P(fx + 1, R.base - y, M2);
        if (y % 4 === 0) {
          P(fx - 1, R.base - y, M2);
          P(fx + 2, R.base - y, M2);
        }
      }
      w.flares.push([fx, R.base - fh]);
    }
    w.beacons = [
      [R.x - 3, R.base - 23],
      [R.x + 30, R.base - 13],
      [R.x - 19, R.base - 17],
    ];
    // foreground: bone horns curving up from both sides, broken pillars
    const BONE = [
      [232, 220, 196],
      [196, 180, 156],
      [150, 132, 112],
      [96, 80, 70],
    ];
    const horn = (bx, by, len, dir, thick) => {
      for (let i = 0; i < len; i++) {
        const t = i / len,
          x = bx + dir * (Math.sin(t * 1.6) * Math.min(len * 0.45, W * 0.2)),
          y = by - i + t * t * len * 0.15,
          hw = thick * (1 - t * 0.85);
        const ridgeRow = i % 7 < 1;
        for (let k = -hw; k <= hw; k++) {
          const f = ((k + hw) / (2 * hw + 0.01)) * (dir > 0 ? 1 : -1) + (dir > 0 ? 0 : 1);
          let c = BONE[f < 0.2 ? 0 : f < 0.55 ? 1 : f < 0.85 ? 2 : 3];
          if (ridgeRow) c = shade(c, -0.3);
          P(x + k, y, c);
        }
      }
    };
    horn(W * 0.02, H + 4, H * 0.66, 1, 9);
    horn(W * 0.98, H + 4, H * 0.72, -1, 9);
    for (const [px, ph] of [
      [W * 0.2, 26],
      [W * 0.74, 18],
    ])
      for (let y = 0; y < ph; y++)
        for (let k = -4; k <= 4; k++) {
          const broken = y > ph - 4 && (k * 3 + y) % 4 === 0;
          if (!broken) P(px + k, H - y, k < -2 ? BONE[1] : k > 2 ? BONE[3] : k % 2 ? BONE[2] : BONE[1]);
        }
    // bones on the ground, near
    for (let i = 0; i < W / 30; i++) {
      const bx = (i * 61) % W,
        by = H - 3 - (i % 3) * 3;
      for (let k = 0; k < 5; k++) P(bx + k, by, BONE[1]);
      P(bx - 1, by - 1, BONE[0]);
      P(bx + 5, by - 1, BONE[0]);
    }
    b.put(g);
  }

  const SHAPE = (() => {
    const rows = [];
    for (let y = 0; y < 60; y++) {
      let row = "";
      for (let x = 0; x < 80; x++) {
        const hx = x - 40,
          body = (hx / 24) ** 2 + ((y - 50) / 34) ** 2 < 1,
          head = (hx / 10) ** 2 + ((y - 20) / 10) ** 2 < 1,
          hornL =
            Math.abs(x - (26 - (20 - y) * 0.6 + (y < 10 ? (10 - y) * 0.3 : 0))) < 2.2 - y * 0.04 && y < 20 && y > 0,
          hornR =
            Math.abs(x - (54 + (20 - y) * 0.6 - (y < 10 ? (10 - y) * 0.3 : 0))) < 2.2 - y * 0.04 && y < 20 && y > 0;
        row += body || head || hornL || hornR ? "x" : ".";
      }
      rows.push(row);
    }
    return rows;
  })();

  function sky(c, w, e, s) {
    const { W, hy } = w;
    // drifting smoke shadows
    c.fillStyle = "rgba(20,6,6,0.35)";
    for (let i = 0; i < 4; i++) {
      const x0 = ((i * 113 + s * (3 + i)) % (W + 90)) - 70,
        y0 = hy * (0.15 + i * 0.15);
      for (let k = 0; k < 60; k++)
        for (let j = 0; j < 4; j++)
          if (bayer(k + i, j) < 0.5 - Math.abs(j - 1.5) * 0.15)
            c.fillRect(Math.round(x0 + k), Math.round(y0 + j + Math.sin(k * 0.1) * 2), 1, 1);
    }
    // a colossal horned shape moving behind the smoke, eyes burning; every few minutes
    const per = 200,
      t = (s % per) / per;
    if (t < 0.3) {
      const k = t / 0.3,
        x0 = Math.round(W * 0.15 + k * W * 0.5),
        y0 = Math.round(hy - 66 + Math.sin(k * Math.PI) * -6),
        a = Math.sin(k * Math.PI) * 0.55;
      c.fillStyle = `rgba(14,2,4,${a})`;
      for (let y = 0; y < SHAPE.length; y++) {
        const row = SHAPE[y];
        let run = -1;
        for (let x = 0; x <= row.length; x++) {
          if (row[x] === "x") {
            if (run < 0) run = x;
          } else if (run >= 0) {
            c.fillRect(x0 + run, y0 + y, x - run, 1);
            run = -1;
          }
        }
      }
      c.fillStyle = `rgba(255,200,60,${a * 1.6})`;
      c.fillRect(x0 + 36, y0 + 20, 2, 1);
      c.fillRect(x0 + 43, y0 + 20, 2, 1);
    }
  }

  function frame(c, w, e, s) {
    const { W, H, hy } = w;
    if (!w.glows.fire) {
      w.glows.fire = glowSprite(10, [255, 140, 40], 0.7, 0.35);
      w.glows.small = glowSprite(5, [255, 80, 30], 0.7, 0.4);
      w.glows.rune = glowSprite(4, [255, 60, 30], 0.8, 0.45);
    }
    // lava flowing: bright pulses travelling down the river
    for (const [x, y, t, k] of w.lava) {
      const v = Math.sin(t * 40 - s * 3 + k * 2 + x * 0.1);
      c.fillStyle = css(v > 0.75 ? LAVA[0] : v > 0.2 ? LAVA[1] : v > -0.5 ? LAVA[2] : LAVA[3]);
      c.fillRect(x, y, 1, 1);
      if (k < 0.3 && v > 0.6) c.fillRect(x + 1, y, 1, 1);
    }
    // citadel runes pulsing, the gate glowing
    const pulse = 0.5 + 0.5 * Math.sin(s * 1.7);
    for (const [i, [rx, ry]] of w.runes.entries()) {
      if (Math.sin(s * 1.7 + i) < -0.3) continue;
      c.fillStyle = css([255, 60 + pulse * 80, 30]);
      c.fillRect(rx, ry, 1, 2);
      c.drawImage(w.glows.rune, rx - 4, ry - 3);
    }
    c.drawImage(w.glows.fire, w.gate[0] - 10, w.gate[1] - 10);
    // flare stacks: flickering flames; chimneys: smoke columns
    for (const [fx, fy] of w.flares) {
      for (let k = 0; k < 7; k++) {
        const h = 2 + Math.round(Math.abs(Math.sin(s * 9 + k * 1.7)) * 6 * (1 - Math.abs(k - 3) / 4));
        c.fillStyle = k === 3 ? "#fff0a0" : "#ff9030";
        c.fillRect(fx - 3 + k, fy - h, 1, h);
      }
      c.drawImage(w.glows.fire, fx - 10, fy - 14);
    }
    for (const [cx, cy] of w.chimneys)
      for (let i = 0; i < 8; i++) {
        const t = (s * 0.25 + i / 8) % 1,
          x = Math.round(cx + t * 20 + Math.sin(s + i) * 2),
          y = Math.round(cy - t * 40),
          R = 1 + t * 5;
        c.fillStyle = `rgba(30,14,14,${0.6 * (1 - t)})`;
        for (let k = -R; k <= R; k++) if (bayer(x + k, y) < 0.7) c.fillRect(x + Math.round(k), y, 1, 2);
      }
    // warning lights rotating on the refinery
    for (const [i, [bx, by]] of w.beacons.entries()) {
      const on = Math.floor(s * 3 + i) % 3 === 0;
      if (on) {
        c.fillStyle = "#ffd030";
        c.fillRect(bx, by, 1, 1);
        c.drawImage(w.glows.small, bx - 5, by - 5);
      }
    }
    // fireballs streaking down from the smoke
    for (let i = 0; i < 3; i++) {
      const per = 9 + i * 4,
        t = ((s + i * 3.1) % per) / per;
      if (t > 0.25) continue;
      const k = t / 0.25,
        x = Math.round(W * (0.2 + i * 0.3) + k * 40),
        y = Math.round(-6 + k * hy * 0.9);
      for (let j = 0; j < 12; j++) {
        c.fillStyle = j < 2 ? "#fff0b0" : j < 5 ? "#ffa030" : `rgba(200,60,20,${1 - j / 12})`;
        c.fillRect(x - Math.round(j * 0.45), y - j, j < 3 ? 2 : 1, 1);
      }
      if (k > 0.9) c.drawImage(w.glows.fire, x - 10, y - 10);
    }
    // lava geysers: build up, erupt, fall back
    for (const [i, [gx, gy]] of w.geysers.entries()) {
      const per = 14,
        t = ((s + i * 6) % per) / per;
      if (t > 0.3) continue;
      const k = t / 0.3,
        h = Math.sin(k * Math.PI) * 30;
      for (let j = 0; j < 10; j++) {
        const a = (j / 10) * Math.PI - Math.PI / 2,
          px = Math.round(gx + Math.sin(a) * h * 0.3 * k),
          py = Math.round(gy - h * (1 - Math.abs(Math.sin(a)) * 0.3));
        c.fillStyle = j % 3 ? "#ffb040" : "#fff0a0";
        c.fillRect(px, py, 1, 2);
      }
      c.fillStyle = "#ffb040";
      for (let j = 0; j < h; j += 2)
        c.fillRect(Math.round(gx + Math.sin(j + s * 9) * (j / h) * 2), Math.round(gy - j), 2, 2);
      c.drawImage(w.glows.fire, Math.round(gx) - 10, Math.round(gy - h) - 6);
    }
    // patrol craft sweeping a searchlight across the plain
    {
      const per = 48,
        t = (s % per) / per,
        px = Math.round(W * 1.1 - t * W * 1.3),
        py = Math.round(hy * 0.55 + Math.sin(s * 0.8) * 3),
        an = Math.PI / 2 + Math.sin(s * 0.9) * 0.5;
      c.fillStyle = "rgba(255,230,180,0.12)";
      for (let k = 3; k < 70; k++) {
        const hw = k * 0.18,
          cx = px + Math.cos(an) * k,
          cy = py + Math.sin(an) * k;
        for (let j = -hw; j <= hw; j++)
          if (bayer(Math.round(cx + j), Math.round(cy)) < 0.55) c.fillRect(Math.round(cx + j), Math.round(cy), 1, 1);
      }
      c.fillStyle = "#2a1a1a";
      c.fillRect(px - 6, py, 13, 3);
      c.fillRect(px - 3, py - 2, 6, 2);
      c.fillRect(px - 9, py + 1, 3, 1);
      c.fillRect(px + 7, py + 1, 3, 1);
      c.fillStyle = "#5a4040";
      c.fillRect(px - 6, py, 13, 1);
      c.fillStyle = Math.floor(s * 4) % 2 ? "#ff3020" : "#601010";
      c.fillRect(px, py - 3, 1, 1);
    }
    // the rivers light the air above them, the glow running down with the flow
    if (!w.glows.river) {
      w.glows.river = softGlow(12, [255, 110, 30], 0.32);
      w.glows.river2 = softGlow(20, [255, 90, 20], 0.22);
      w.smog = mist(W, 22, [70, 22, 14], 0.85, 0.55, 11);
      w.vig = vignette(W, H, [20, 4, 2], 0.6);
    }
    for (const [ri, R] of [w.river, w.river2].entries())
      for (let i = 4; i < R.length; i += 6) {
        const [x, y, wd] = R[i],
          g = wd > 4 ? w.glows.river2 : w.glows.river,
          k = 0.55 + 0.45 * Math.sin(s * 1.6 - i * 0.35 + ri);
        c.globalAlpha = k;
        c.drawImage(g, Math.round(x - g.width / 2), Math.round(y - g.height / 2 - 2));
      }
    c.globalAlpha = 1;
    // smoke lying over the plain
    {
      const ox = -Math.round((s * 4) % W);
      c.globalAlpha = 0.6;
      c.drawImage(w.smog, ox, hy - 6);
      c.drawImage(w.smog, ox + W, hy - 6);
      c.globalAlpha = 1;
    }
    // embers rising everywhere
    for (const [ex, ey, p] of w.embers) {
      const y = Math.round(H - ((ey * H + s * (6 + p * 10)) % H)),
        x = Math.round(ex * W + Math.sin(s * 1.3 + p * 20) * 4);
      c.fillStyle = p > 0.7 ? "#ffe080" : p > 0.3 ? "#ff8a30" : "#c03010";
      c.fillRect(x, y, 1, 1);
    }
    // weather -> ash, red lightning, smoke
    if (e.wx.rain || e.wx.snow) {
      const n = Math.round(w.ash.length * Math.min(1, (e.wx.rain || 0) + (e.wx.snow || 0) + 0.2));
      for (let i = 0; i < n; i++) {
        const [px, py, sp] = w.ash[i];
        c.fillStyle = i % 3 ? "rgba(90,80,80,0.8)" : "rgba(180,170,160,0.7)";
        c.fillRect(Math.round(px * W + Math.sin(s * 0.7 + py * 20) * 4), Math.round((py * H + s * 10 * sp) % H), 1, 1);
      }
    }
    if (e.wx.fog) {
      c.fillStyle = "rgba(40,16,14,0.45)";
      for (let y = Math.round(hy * 0.6); y < H; y++)
        for (let x = y & 1; x < W; x += 2) if (bayer(x, y) < 0.5) c.fillRect(x, y, 1, 1);
    }
    if (e.wx.thunder) {
      const t = s % 8;
      if (t < 0.25) {
        c.fillStyle = "rgba(255,40,30,0.25)";
        c.fillRect(0, 0, W, H);
        let x = Math.round(W * (0.3 + ((Math.floor(s / 8) * 0.37) % 0.5))),
          y = 0;
        c.fillStyle = "#ff8070";
        while (y < hy) {
          const hv = Math.sin(x * 127.1 + (y + Math.floor(s / 8) * 13) * 311.7) * 43758.5453,
            nx = x + Math.round((hv - Math.floor(hv) - 0.5) * 10);
          for (let k = 0; k < 4; k++) c.fillRect(Math.round(x + ((nx - x) * k) / 4), y + k, 1, 1);
          x = nx;
          y += 4;
        }
      }
    }
    c.drawImage(w.vig, 0, 0);
  }

  RS_SCENE.register("hellforge", { fps: 12, build, background, sky, land, frame });
})();
