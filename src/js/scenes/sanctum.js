"use strict";

// Sanctum: gothic cathedral and graveyard under a blood moon.
(() => {
  const { Buf, ramp, bayer, H_, css, skyRamp, toner, ridge, glowSprite, sprite, hash, mist, rays, softGlow, vignette } =
    RS_PX;
  const { rng } = RS_SCENE;
  const SKY = {
    night: H_(["#060204", "#12040a", "#240810", "#3a0c14", "#541418"]),
    day: H_(["#3a3438", "#4a3e40", "#5c4644", "#704e48", "#84584c"]),
    warm: H_(["#1a0610", "#3a0c18", "#6a1a1e", "#a0301e", "#d05a28"]),
    grey: H_(["#2a2628", "#36302e", "#423a36", "#4e443c", "#5a4c42"]),
  };
  const ST = [
    [150, 140, 140],
    [118, 108, 112],
    [90, 82, 88],
    [62, 56, 64],
    [40, 36, 44],
  ];

  function build(W, H) {
    const r = rng(1313),
      hy = Math.round(H * 0.66),
      gy = Math.round(H * 0.8);
    const cat = { x: Math.round(W * 0.56), base: gy - 2, nave: Math.round(Math.min(96, W * 0.32)) };
    const hills = ridge(r, W, [
      [60, 1],
      [20, 0.4],
    ]);
    const graves = [];
    for (let i = 0; i < Math.round(W / 11); i++)
      graves.push({
        x: r() * W,
        y: gy + 6 + r() * (H - gy - 8),
        kind: Math.floor(r() * 4),
        lean: Math.round((r() - 0.5) * 2),
      });
    graves.sort((a, b) => a.y - b.y);
    const bats = Array.from({ length: 7 }, () => [r() * 6, 8 + r() * 18, r()]);
    const drops = Array.from({ length: Math.round((W * H) / 240) }, () => [r(), r(), 0.7 + r() * 0.6]);
    const embers = Array.from({ length: 30 }, () => [r(), r(), r()]);
    return { W, H, hy, gy, cat, hills, graves, bats, drops, embers, glows: {} };
  }

  function background(g, w, e) {
    const { W, H, hy } = w,
      b = new Buf(g, W, H),
      sky = skyRamp(e, SKY),
      night = e.day < 0.5;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b.px(x, y, ramp(sky, y / hy, x, y, 0.3));
    // clouds in bands, lit red from below
    const r = rng(9);
    for (let i = 0; i < 8; i++) {
      const cy = hy * (0.08 + r() * 0.6),
        cx = r() * W,
        cw = 40 + r() * 60,
        ch = 3 + r() * 4;
      for (let y = -ch; y <= ch; y++)
        for (let x = -cw; x <= cw; x++) {
          const d = (x / cw) ** 2 + (y / ch) ** 2 + Math.sin(x * 0.2 + i) * 0.08;
          if (d > 1 || (d > 0.75 && bayer(x, y) < 0.5)) continue;
          b.px(
            cx + x,
            cy + y,
            y > ch * 0.3 ? (night ? [120, 30, 26] : [130, 100, 90]) : night ? [40, 12, 16] : [80, 70, 70],
          );
        }
    }
    // the blood moon with a stepped halo (a pale sun disc in murk by day)
    const mx = Math.round(W * 0.8),
      my = Math.round(H * 0.2),
      R = night ? 17 : 9;
    for (let y = -R - 10; y <= R + 10; y++)
      for (let x = -R - 10; x <= R + 10; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d > R) {
          const k = 1 - (d - R) / 10;
          if (k > 0) {
            const lvl = Math.floor(k * 3 + bayer(x, y) * 0.8) / 3;
            if (lvl > 0) b.px(mx + x, my + y, night ? [200, 40, 30] : [220, 200, 180], lvl * 0.35);
          }
          continue;
        }
        const crater =
          night &&
          [
            [-6, -4, 4],
            [5, 3, 5],
            [-2, 8, 3],
            [7, -8, 2],
          ].some(([cx, cy, cr]) => (x - cx) ** 2 + (y - cy) ** 2 < cr * cr);
        const lit = (-x - y) / R;
        b.px(
          mx + x,
          my + y,
          night
            ? crater
              ? [150, 30, 24]
              : lit > 0.5
                ? [240, 90, 70]
                : lit < -0.6
                  ? [140, 26, 20]
                  : [200, 54, 40]
            : [236, 220, 200],
        );
      }
    // moonlight slanting down through the murk
    if (e.wx.clouds < 0.95)
      rays(b, mx, my, Math.PI * 0.68, {
        n: 5,
        len: H * 0.9,
        spread: 0.16,
        width: 0.06,
        col: night ? [255, 120, 100] : [236, 226, 210],
        k: 0.2,
        a: 0.18,
      });
    // far hills, and a burning town along them
    const tone = toner(e, 0.6);
    for (let x = 0; x < W; x++) {
      const top = Math.round(hy - 6 - w.hills[x] * 12);
      for (let y = top; y < hy + 8; y++) b.px(x, y, tone(y === top ? [80, 30, 30] : [30, 14, 18]));
    }
    const r2 = rng(3);
    w.fires = [];
    for (let x = 4; x < W * 0.36; x += 7 + Math.floor(r2() * 6)) {
      const top = Math.round(hy - 6 - w.hills[x] * 12),
        h = 5 + Math.floor(r2() * 8),
        wd = 5 + Math.floor(r2() * 4);
      for (let y = 0; y < h; y++) for (let k = 0; k < wd; k++) b.px(x + k, top - y, [24, 10, 14]);
      for (let k = 0; k < wd; k++)
        b.px(
          x + k,
          top - h - Math.round(Math.abs(k - wd / 2) * -0.6) - 2 + Math.round(Math.abs(k - wd / 2)),
          [24, 10, 14],
        );
      if (r2() < 0.6) w.fires.push([x + (wd >> 1), top - h]);
    }
    b.put(g);
  }

  function land(g, w, e) {
    const { W, H, gy, cat: C } = w,
      b = new Buf(g, W, H),
      tone = toner(e, 0.6),
      night = e.day < 0.5;
    const P = (x, y, c) => b.px(x, y, tone(c));
    const stone = (x, y, lvl, xx, yy) => {
      const course = yy % 5 === 0 || (xx + (Math.floor(yy / 5) % 2) * 4) % 8 === 0;
      return ST[Math.min(4, lvl + (course ? 1 : 0))];
    };
    // ground
    for (let y = gy - 2; y < H; y++)
      for (let x = 0; x < W; x++)
        P(x, y, y === gy - 2 ? [60, 50, 50] : bayer(x, y) < 0.2 ? [34, 28, 32] : [26, 22, 26]);
    // the nave: wall with buttresses and lancets, a slate roof
    const nx0 = C.x - 10,
      nx1 = C.x + C.nave,
      wallTop = C.base - 30;
    for (let y = wallTop; y < C.base; y++)
      for (let x = nx0; x < nx1; x++) P(x, y, stone(x, y, 1, x - nx0, y - wallTop));
    for (let y = 0; y < 14; y++)
      for (let x = nx0 - 2 + y; x < nx1 + 2 - y * 0; x++)
        if (x < nx1 + 2)
          P(x, wallTop - y, (x + y * 2) % 6 === 0 ? [50, 50, 64] : y === 0 ? [90, 90, 104] : [66, 66, 80]);
    w.lancets = [];
    for (let x = nx0 + 8; x < nx1 - 6; x += 13) {
      // buttress: a stepped pier with a pinnacle
      for (let y = 0; y < 34; y++)
        for (let k = 0; k < 4 + (y < 12 ? 2 : 0); k++)
          P(x - 2 - (y < 12 ? 1 : 0) + k, C.base - y, ST[k === 0 ? 0 : k > 3 ? 3 : 2]);
      for (let y = 0; y < 8; y++) P(x, C.base - 34 - y, ST[y % 2 ? 1 : 0]);
      P(x - 1, C.base - 38, ST[1]);
      P(x + 1, C.base - 38, ST[1]);
      // a lancet window between buttresses
      const lx = x + 5,
        ly = C.base - 24;
      for (let y = 0; y < 16; y++)
        for (let k = 0; k < 4; k++) {
          if (y < 2 && (k === 0 || k === 3)) continue;
          P(lx + k, ly + y, k === 0 || k === 3 ? [20, 14, 18] : y % 5 === 0 ? [30, 20, 24] : [60, 20, 26]);
        }
      w.lancets.push([lx + 1, ly + 1]);
    }
    // the west front: tower with spire and crockets, the rose window, great doors
    const tw = 22,
      tx0 = nx0 - tw + 4,
      tTop = C.base - 64;
    for (let y = tTop; y < C.base; y++)
      for (let x = tx0; x < tx0 + tw; x++)
        P(x, y, x === tx0 ? ST[0] : x >= tx0 + tw - 2 ? ST[3] : stone(x, y, 1, x - tx0, y - tTop));
    for (let x = tx0 - 1; x <= tx0 + tw; x += 3) for (let y = 0; y < 3; y++) P(x, tTop - y, ST[1]);
    const sx = tx0 + tw / 2,
      spH = Math.round(H * 0.32);
    for (let y = 0; y < spH; y++) {
      const hw = Math.max(0, Math.round((tw / 2 - 2) * (1 - y / spH)));
      for (let k = -hw; k <= hw; k++) P(sx + k, tTop - 3 - y, k < 0 ? [96, 92, 104] : [60, 58, 70]);
      if (y % 6 === 3 && hw > 0) {
        P(sx - hw - 1, tTop - 3 - y, ST[1]);
        P(sx + hw + 1, tTop - 3 - y, ST[3]);
      }
    }
    for (let y = 0; y < 6; y++) P(sx, tTop - 3 - spH - y, [60, 58, 70]);
    P(sx - 1, tTop - 3 - spH - 4, [60, 58, 70]);
    P(sx + 1, tTop - 3 - spH - 4, [60, 58, 70]);
    w.spireTop = [sx, tTop - spH];
    const rx = Math.round(sx),
      ry = tTop + 18,
      RR = 7;
    for (let y = -RR - 1; y <= RR + 1; y++)
      for (let x = -RR - 1; x <= RR + 1; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d > RR + 1) continue;
        const an = Math.atan2(y, x),
          spoke = Math.abs(Math.sin(an * 4)) < 0.18 && d > 2;
        P(rx + x, ry + y, d > RR ? ST[0] : d < 1.5 || spoke || Math.abs(d - 4.5) < 0.5 ? [30, 20, 24] : [70, 20, 26]);
      }
    w.rose = [rx, ry];
    for (let y = 0; y < 18; y++)
      for (let x = -6; x <= 6; x++) {
        const arch = y < 6 && x * x + (6 - y) ** 2 > 36;
        if (arch) continue;
        P(
          rx + x,
          C.base - 18 + y,
          Math.abs(x) === 6 || y === 0 ? ST[0] : x === 0 ? [40, 24, 18] : y % 4 === 0 ? [70, 40, 24] : [90, 54, 30],
        );
      }
    // gargoyles on the tower corners
    for (const [gx, dir] of [
      [tx0, -1],
      [tx0 + tw - 1, 1],
    ])
      for (const [dx, dy] of [
        [0, 0],
        [dir, 0],
        [dir * 2, 0],
        [dir * 2, -1],
        [dir * 3, 1],
        [dir, -1],
      ])
        P(gx + dx, tTop + 8 + dy, ST[3]);
    // the mausoleum, left of the cathedral
    const mx = Math.round(W * 0.2),
      my = gy + 6;
    for (let y = 0; y < 18; y++)
      for (let x = 0; x < 26; x++)
        P(mx + x, my - y, x === 0 ? ST[0] : x === 25 ? ST[3] : stone(mx + x, my - y, 1, x, y));
    for (let y = 0; y < 7; y++) for (let x = -2 + y; x <= 27 - y; x++) P(mx + x, my - 18 - y, y === 0 ? ST[2] : ST[1]);
    for (const cx of [4, 9, 16, 21])
      for (let y = 1; y < 16; y++) {
        P(mx + cx, my - y, ST[0]);
        P(mx + cx + 1, my - y, ST[2]);
      }
    for (let y = 0; y < 10; y++) for (let x = 11; x < 15; x++) P(mx + x, my - y, [16, 12, 16]);
    // an angel statue on a plinth
    const ax = Math.round(W * 0.38),
      ay = gy + 14;
    for (let y = 0; y < 5; y++) for (let x = -4; x <= 4; x++) P(ax + x, ay - y, x < -2 ? ST[0] : ST[2]);
    const ANG = ["...hh...", "w..hh..w", "ww.ss.ww", "wwwssww.", ".wwrrw..", "..rrrr..", "..rrrr..", ".rrrrrr."];
    ANG.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch !== ".")
          P(ax - 4 + i, ay - 5 - ANG.length + j, ch === "w" ? ST[0] : ch === "h" ? ST[1] : ch === "s" ? ST[1] : ST[1]);
      }
    });
    // headstones, crosses, obelisks
    for (const G of w.graves) {
      const x = Math.round(G.x),
        y = Math.round(G.y);
      if (G.kind === 0) {
        for (let yy = 0; yy < 7; yy++)
          for (let k = -2; k <= 2; k++) {
            if (yy > 4 && Math.abs(k) === 2) continue;
            P(x + k + (yy > 3 ? G.lean : 0), y - yy, k === -2 ? ST[0] : k === 2 ? ST[3] : ST[1]);
          }
      } else if (G.kind === 1) {
        for (let yy = 0; yy < 9; yy++) P(x + (yy > 5 ? G.lean : 0), y - yy, ST[1]);
        for (let k = -2; k <= 2; k++) P(x + k + G.lean, y - 6, ST[k < 0 ? 0 : 2]);
      } else if (G.kind === 2) {
        for (let yy = 0; yy < 12; yy++) {
          const hw = yy > 9 ? 0 : 1;
          for (let k = -hw; k <= hw; k++) P(x + k, y - yy, k < 0 ? ST[0] : ST[2]);
        }
        for (let k = -2; k <= 2; k++) P(x + k, y, ST[2]);
      } else {
        for (let yy = 0; yy < 3; yy++) for (let k = -4; k <= 4; k++) P(x + k, y - yy, yy === 2 ? ST[1] : ST[3]);
      }
    }
    // the iron spear fence along the front
    const fy = Math.round(H * 0.9);
    for (let x = 0; x < W; x++) {
      P(x, fy - 12, [20, 18, 22]);
      P(x, fy - 3, [20, 18, 22]);
      if (x % 4 === 0) {
        for (let y = 0; y < 14; y++) P(x, fy - y, [24, 22, 26]);
        P(x, fy - 15, [40, 36, 40]);
        P(x - 1, fy - 14, [24, 22, 26]);
        P(x + 1, fy - 14, [24, 22, 26]);
      }
    }
    w.fenceY = fy - 15;
    // gnarled dead trees framing the sides
    for (const [tx, h, dir] of [
      [Math.round(W * 0.04), H * 0.7, 1],
      [Math.round(W * 0.96), H * 0.62, -1],
    ]) {
      const r = rng(tx + 1);
      for (let y = 0; y < h; y++) {
        const x = Math.round(tx + Math.sin(y * 0.05) * 3 * dir),
          hw = Math.max(1, Math.round(4 - (y / h) * 3));
        for (let k = -hw; k <= hw; k++) P(x + k, H - y, k < 0 ? [50, 40, 44] : [22, 18, 22]);
      }
      const branch = (x, y, an, len, d) => {
        for (let k = 0; k < len; k++) {
          x += Math.cos(an);
          y += Math.sin(an);
          P(x, y, [30, 24, 28]);
          if (d < 2) P(x, y + 1, [30, 24, 28]);
          an += (r() - 0.5) * 0.3;
        }
        if (d < 4) {
          branch(x, y, an - 0.5 - r() * 0.3, len * 0.65, d + 1);
          branch(x, y, an + 0.4 + r() * 0.3, len * 0.6, d + 1);
        }
      };
      for (let i = 0; i < 3; i++)
        branch(
          tx + Math.sin(h * 0.05) * 3 * dir,
          H - h * (0.6 + i * 0.15),
          -Math.PI / 2 + dir * (0.6 + i * 0.3),
          14 - i * 3,
          0,
        );
    }

    b.put(g);
  }

  function sky(c, w, e, s) {
    const { W, H, hy } = w;
    // the burning town lights the smoke above it
    w.glows.town ||= softGlow(Math.round(W * 0.2), [255, 90, 40], 0.3);
    {
      const R = w.glows.town.width >> 1;
      c.globalAlpha = 0.6 + 0.25 * Math.sin(s * 1.3) * Math.sin(s * 0.7);
      c.drawImage(w.glows.town, Math.round(W * 0.18) - R, hy - 10 - R);
      c.globalAlpha = 1;
    }
    // lightning behind the cathedral at night: the sky flashes, a bolt forks down
    if (e.day < 0.5) {
      const per = 41,
        t = s % per,
        n = Math.floor(s / per);
      if (t < 0.5 && Math.sin(t * 50) > -0.3) {
        c.fillStyle = "rgba(255,230,230,0.22)";
        c.fillRect(0, 0, W, hy);
        let x = Math.round(W * (0.35 + hash(n, 1) * 0.5)),
          y = 0;
        c.fillStyle = "#fff0f0";
        while (y < hy - 6) {
          const nx = x + Math.round((hash(x, y + n) - 0.5) * 9);
          for (let j = 0; j < 4; j++) c.fillRect(Math.round(x + ((nx - x) * j) / 4), y + j, 1, 1);
          x = nx;
          y += 4;
        }
      }
    }
    // embers and flames over the burning town
    for (const [fx, fy] of w.fires) {
      for (let k = -1; k <= 1; k++) {
        const h = 1 + Math.round(Math.abs(Math.sin(s * 8 + fx + k)) * 3);
        c.fillStyle = k ? "#ff6a20" : "#ffc050";
        c.fillRect(fx + k, fy - h, 1, h);
      }
    }
    for (const [px, py, p] of w.embers) {
      const t = (py + s * 0.08 * (0.5 + p)) % 1,
        x = Math.round(px * w.W * 0.36 + Math.sin(s + p * 20) * 3),
        y = Math.round(w.hy - 8 - t * w.hy * 0.5);
      c.fillStyle = t < 0.5 ? "#ffb040" : "#a03010";
      c.fillRect(x, y, 1, 1);
    }
  }

  const WANDERER = ["..hh...", ".hhhh..", ".hhfh..", ".cccc..", "ccccc.l", "ccccccl", ".cccc..", ".cc.c..", "cc..cc."];

  function frame(c, w, e, s) {
    const { W, H, gy } = w,
      night = e.day < 0.5;
    if (!w.glows.win) {
      w.glows.win = glowSprite(6, [255, 120, 50], 0.7, 0.4);
      w.glows.rose = glowSprite(13, [255, 90, 50], 0.6, 0.35);
      w.glows.lamp = glowSprite(8, [255, 200, 110], 0.7, 0.4);
      w.glows.wisp = glowSprite(4, [150, 220, 255], 0.8, 0.45);
    }
    // candlelight flickering in the lancets and the rose window
    for (const [i, [lx, ly]] of w.lancets.entries()) {
      const f = 0.7 + 0.3 * Math.sin(s * 7 + i * 2) * Math.sin(s * 3.1 + i);
      c.fillStyle = css([255, 120 * f + 40, 50]);
      for (let y = 0; y < 14; y += 1) if (y % 5) c.fillRect(lx, ly + y, 2, 1);
      if (night) {
        c.globalAlpha = f;
        c.drawImage(w.glows.win, lx - 5, ly + 2);
        c.globalAlpha = 1;
      }
    }
    {
      const [rx, ry] = w.rose,
        f = 0.75 + 0.25 * Math.sin(s * 2.3);
      c.fillStyle = css([255, 80 * f + 30, 40]);
      for (let y = -6; y <= 6; y++)
        for (let x = -6; x <= 6; x++) {
          const d = Math.sqrt(x * x + y * y),
            an = Math.atan2(y, x);
          if (d < 6.5 && d > 1.5 && Math.abs(Math.sin(an * 4)) > 0.2 && Math.abs(d - 4.5) > 0.5)
            c.fillRect(rx + x, ry + y, 1, 1);
        }
      if (night) c.drawImage(w.glows.rose, rx - 13, ry - 13);
    }
    // bats circling the spire
    for (const [ph, rr, p] of w.bats) {
      const an = s * (0.8 + p) + ph,
        x = Math.round(w.spireTop[0] + Math.cos(an) * rr * 1.4),
        y = Math.round(w.spireTop[1] + 10 + Math.sin(an * 1.3) * rr * 0.6),
        up = Math.floor(s * 8 + ph * 5) % 2;
      c.fillStyle = "#0a0408";
      c.fillRect(x, y, 1, 1);
      c.fillRect(x - 2, y - up, 2, 1);
      c.fillRect(x + 1, y - up, 2, 1);
    }
    // crows on the fence, one hopping now and then
    for (let i = 0; i < 3; i++) {
      const x = Math.round(W * (0.3 + i * 0.22)),
        hop = Math.sin(s * 0.7 + i * 3) > 0.95 ? 2 : 0,
        y = w.fenceY - 3 - hop;
      c.fillStyle = "#08060a";
      c.fillRect(x, y, 3, 2);
      c.fillRect(x + 2, y - 1, 2, 1);
      c.fillRect(x - 1, y + 1, 1, 1);
      c.fillStyle = "#c0a040";
      c.fillRect(x + 4, y - 1, 1, 1);
    }
    // the hooded wanderer with a lantern, walking the path
    {
      const per = 90,
        t = (s % per) / per;
      if (t < 0.5) {
        const x = Math.round(W + 10 - (t / 0.5) * (W + 20)),
          y = gy + 3;
        sprite(c, WANDERER, x, y - 9, { h: "#1a1418", f: "#a07060", c: "#241c22", l: "#ffd27a" });
        if (night) c.drawImage(w.glows.lamp, x - 2, y - 13);
      }
    }
    // wisps among the graves at night
    if (night)
      for (let i = 0; i < 3; i++) {
        const x = Math.round(W * (0.15 + i * 0.3) + Math.sin(s * 0.5 + i * 2) * 12),
          y = Math.round(gy + 10 + Math.cos(s * 0.7 + i) * 4);
        if (Math.sin(s * 0.3 + i * 2) > -0.3) {
          c.drawImage(w.glows.wisp, x - 4, y - 4);
          c.fillStyle = "#e0f4ff";
          c.fillRect(x, y, 1, 1);
        }
      }
    // ground mist rolling between the graves, in two banks
    const M = night ? "night" : "day";
    w.mists ||= {};
    w.mists[M] ||= mist(W, 22, night ? [150, 110, 130] : [180, 170, 170], 0.85, 0.45, 17);
    for (const [y, sp, a] of [
      [gy - 10, 2.5, 0.8],
      [gy + 4, 4, 0.9],
      [H - 14, 6, 0.6],
    ]) {
      const ox = -Math.round((s * sp) % W);
      c.globalAlpha = e.wx.fog ? 1 : a;
      c.drawImage(w.mists[M], ox, y);
      c.drawImage(w.mists[M], ox + W, y);
    }
    c.globalAlpha = 1;
    // weather
    if (e.wx.rain) {
      c.fillStyle = "rgba(170,160,180,0.5)";
      const n = Math.round(w.drops.length * Math.min(1, e.wx.rain + 0.2));
      for (let i = 0; i < n; i++) {
        const [px, py, sp] = w.drops[i];
        c.fillRect(Math.round(px * W), Math.round((py * H + s * 120 * sp) % H), 1, 3);
      }
    }
    if (e.wx.snow) {
      c.fillStyle = "#f0e8ec";
      for (const [px, py, sp] of w.drops)
        c.fillRect(Math.round(px * W + Math.sin(s + py * 20) * 3), Math.round((py * H + s * 14 * sp) % H), 1, 1);
    }
    if (e.wx.fog) {
      c.fillStyle = "rgba(150,130,140,0.35)";
      for (let y = Math.round(H * 0.4); y < H; y++)
        for (let x = y & 1; x < W; x += 2) if (bayer(x, y) < 0.5) c.fillRect(x, y, 1, 1);
    }
    if (e.wx.thunder && s % 9 < 0.15) {
      c.fillStyle = "rgba(255,230,230,0.4)";
      c.fillRect(0, 0, W, H);
      let x = Math.round(W * (0.2 + (Math.floor(s / 9) % 4) * 0.18)),
        y = 0;
      c.fillStyle = "#ffe8e8";
      while (y < w.hy) {
        const nx = x + Math.round((hash(x, y + Math.floor(s)) - 0.5) * 10);
        for (let k = 0; k < 4; k++) c.fillRect(Math.round(x + ((nx - x) * k) / 4), y + k, 1, 1);
        x = nx;
        y += 4;
      }
    }
    w.vig ||= vignette(W, H, [10, 4, 6], 0.6);
    c.drawImage(w.vig, 0, 0);
  }

  RS_SCENE.register("sanctum", { build, background, sky, land, frame });
})();
