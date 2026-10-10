"use strict";

// Blocks: floating voxel island (isometric). The island is drawn once into the land layer.
(() => {
  const { Buf, ramp, bayer, hex, mix, css, blendRamp, smooth, hash } = RS_PX;
  const { rng } = RS_SCENE;
  const H_ = (a) => a.map(hex);
  const SKY = {
    day: H_(["#4a86e0", "#5e98e8", "#78acf0", "#96c2f6", "#b6d8fa"]),
    night: H_(["#060a20", "#0a1030", "#10183e", "#16204a", "#1c2856"]),
    warm: H_(["#3a3a88", "#6a4a9a", "#c0608a", "#f08a60", "#ffc070"]),
    grey: H_(["#6a7282", "#788090", "#868e9c", "#949ca8", "#a4aab4"]),
  };
  const COL = {
    grass: [98, 176, 64],
    dirt: [134, 96, 62],
    stone: [124, 124, 130],
    deep: [92, 92, 100],
    sand: [222, 204, 146],
    snow: [238, 242, 250],
    wood: [104, 76, 46],
    leaves: [58, 136, 52],
    birch: [226, 222, 210],
    bleaves: [110, 170, 70],
    plank: [176, 134, 82],
    roof: [146, 62, 50],
    water: [58, 118, 214],
    coal: [38, 38, 42],
    gold: [236, 196, 60],
    gem: [80, 228, 218],
  };

  function build(W, H) {
    const r = rng(2009),
      N = Math.max(14, Math.min(22, Math.floor((W - 16) / 8)));
    const vox = new Map(),
      key = (x, y, z) => `${x},${y},${z}`;
    const set = (x, y, z, t) => vox.set(key(x, y, z), t);
    const c = (N - 1) / 2,
      top = [];
    const noise = Array.from({ length: N * N }, () => r());
    const nz = (x, y) => noise[y * N + x];
    const lake = { x: Math.round(N * 0.62), y: Math.round(N * 0.6), r: N * 0.16 };
    for (let y = 0; y < N; y++) {
      top[y] = [];
      for (let x = 0; x < N; x++) {
        const dx = (x - c) / (N / 2),
          dy = (y - c) / (N / 2),
          d = Math.sqrt(dx * dx + dy * dy) + (nz(x, y) - 0.5) * 0.18;
        if (d > 0.98) {
          top[y][x] = null;
          continue;
        }
        // the hill: rises towards the left-back corner
        const hill = Math.max(0, 1 - Math.hypot(x - N * 0.22, y - N * 0.3) / (N * 0.42));
        let h = Math.round(1 + (1 - d) * 2 + hill * hill * 6 + nz(x, y) * 0.8);
        const inLake = Math.hypot(x - lake.x, y - lake.y) < lake.r;
        if (inLake) h = 2;
        const depth = Math.round(2 + Math.pow(1 - Math.min(1, d), 0.7) * 9 + nz(x, y) * 2);
        for (let z = -depth; z < h; z++) {
          const fromTop = h - 1 - z;
          let t = fromTop === 0 ? "grass" : fromTop < 3 ? "dirt" : z < -depth + 3 ? "deep" : "stone";
          if (t === "stone" && r() < 0.06) t = r() < 0.6 ? "coal" : r() < 0.6 ? "gold" : "gem";
          if (fromTop === 0 && inLake) t = "water";
          else if (fromTop === 0 && (Math.hypot(x - lake.x, y - lake.y) < lake.r + 1.2 || d > 0.88)) t = "sand";
          else if (fromTop === 0 && h >= 7) t = "snow";
          set(x, y, z, t);
        }
        top[y][x] = { h, t: inLake ? "water" : "land" };
      }
    }
    const tops = [];
    for (let y = 1; y < N - 1; y++)
      for (let x = 1; x < N - 1; x++) {
        const t = top[y][x];
        if (t && t.t === "land" && vox.get(key(x, y, t.h - 1)) === "grass") tops.push([x, y, t.h]);
      }
    // a cabin on flat ground near the middle-front
    let cabin = null;
    for (const [x, y, h] of tops.sort(
      (a, b) => Math.hypot(a[0] - N * 0.38, a[1] - N * 0.66) - Math.hypot(b[0] - N * 0.38, b[1] - N * 0.66),
    )) {
      if (
        [
          [1, 0],
          [0, 1],
          [1, 1],
          [2, 0],
          [2, 1],
        ].every(([dx, dy]) => top[y + dy]?.[x + dx]?.h === h && top[y + dy][x + dx].t === "land")
      ) {
        cabin = { x, y, h };
        break;
      }
    }
    if (cabin) {
      for (let dx = 0; dx < 3; dx++)
        for (let dy = 0; dy < 2; dy++) {
          set(cabin.x + dx, cabin.y + dy, cabin.h, "plank");
          set(cabin.x + dx, cabin.y + dy, cabin.h + 1, "plank");
          set(cabin.x + dx, cabin.y + dy, cabin.h + 2, "roof");
        }
      set(cabin.x + 1, cabin.y, cabin.h + 3, "roof");
      set(cabin.x + 1, cabin.y + 1, cabin.h + 3, "roof");
    }
    // trees, kept off the cabin and the lake shore
    const trees = [];
    for (const [x, y, h] of tops) {
      if (trees.length >= 7) break;
      if (r() > 0.18 || x < 2 || y < 2 || x > N - 3 || y > N - 3) continue;
      if (cabin && Math.abs(x - cabin.x - 1) < 4 && Math.abs(y - cabin.y) < 4) continue;
      if (trees.some(([tx, ty]) => Math.abs(tx - x) + Math.abs(ty - y) < 4)) continue;
      trees.push([x, y, h]);
      const birch = r() < 0.4,
        th = 3 + (r() < 0.5 ? 1 : 0) + (birch ? 1 : 0),
        lv = birch ? "bleaves" : "leaves";
      for (let z = h; z < h + th; z++) set(x, y, z, birch ? "birch" : "wood");
      for (let dz = 0; dz < 2; dz++)
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++)
            if (!(dz === 1 && Math.abs(dx) + Math.abs(dy) === 2) && !(dx === 0 && dy === 0 && dz === 0))
              set(x + dx, y + dy, h + th - 1 + dz, lv);
      set(x, y, h + th + 1, lv);
    }
    // the waterfall: from the front-most lake cell's edge, down past the underside
    let fall = null;
    for (let s = 0; s < N; s++) {
      const x = lake.x + s,
        y = lake.y + Math.round(s * 0.2);
      if (!top[y]?.[x]) {
        fall = { x: x - 1, y, z: 2 };
        break;
      }
    }
    const list = [...vox.entries()].map(([k, t]) => {
      const [x, y, z] = k.split(",").map(Number);
      return [x, y, z, t];
    });
    list.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[2] - b[2]);
    const ox = Math.round(W / 2),
      oy = Math.round(H - 4 * (N - 1) - 52);
    const walkers = tops.filter(
      ([x, y]) =>
        !trees.some(([tx, ty]) => tx === x && ty === y) &&
        !(cabin && x >= cabin.x && x < cabin.x + 3 && y >= cabin.y && y < cabin.y + 2),
    );
    const sheep = Array.from({ length: 3 }, (_, i) => ({
      cell: walkers[Math.floor(r() * walkers.length)],
      ph: r() * 10,
      i,
    }));
    const clouds = Array.from({ length: 6 }, () => ({
      x: r(),
      y: 6 + r() * 40,
      w: 3 + Math.floor(r() * 4),
      d: 2 + Math.floor(r() * 2),
    }));
    const stars = Array.from({ length: 70 }, () => [r(), r() * 0.75, r()]);
    const drops = Array.from({ length: 120 }, () => [r(), r(), 0.6 + r() * 0.6]);
    const flies = Array.from({ length: 14 }, () => [r(), r(), r()]);
    return {
      W,
      H,
      N,
      vox,
      key,
      list,
      top,
      ox,
      oy,
      cabin,
      trees,
      fall,
      sheep,
      walkers,
      clouds,
      stars,
      drops,
      flies,
      lake,
    };
  }

  // screen position of the top-centre of a voxel's top face
  const iso = (w, x, y, z) => [Math.round(w.ox + (x - y) * 4), Math.round(w.oy + (x + y) * 2 - z * 4)];

  function toner(e) {
    const n = Math.max(0, Math.min(1, (0.55 - e.day) / 0.45)),
      warm = e.glow;
    return ([r, g, b]) => {
      if (warm) {
        r += (255 - r) * 0.14 * warm;
        g += (180 - g) * 0.05 * warm;
        b *= 1 - 0.2 * warm;
      }
      return [r * (1 - 0.7 * n), g * (1 - 0.62 * n), b * (1 - 0.38 * n) + 16 * n];
    };
  }

  function background(g, w, e) {
    const { W, H } = w,
      b = new Buf(g, W, H);
    let rmp = blendRamp(SKY.night, SKY.day, smooth(e.day));
    if (e.glow > 0) rmp = blendRamp(rmp, SKY.warm, e.glow * 0.8);
    if (e.wx.grey > 0.4) rmp = blendRamp(rmp, e.night ? SKY.night : SKY.grey, (e.wx.grey - 0.3) * 1.2);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b.px(x, y, ramp(rmp, y / H, x, y, 0.3));
    // distant floating islands, hazed into the sky: a diamond of grass, a stepped rock underside, a thread of water
    const tone = toner(e);
    for (const [fx, fy, R, seed] of [
      [0.13, 0.62, 13, 3],
      [0.88, 0.42, 9, 7],
      [0.72, 0.8, 6, 11],
    ]) {
      const cx = Math.round(W * fx),
        cy = Math.round(H * fy),
        haze = 0.45 + (13 - R) * 0.03,
        skyc = rmp[Math.min(4, Math.floor(fy * 5))];
      const C = (col) => mix(tone(col), skyc, haze);
      for (let y = -R / 2; y <= R * 1.6; y++)
        for (let x = -R; x <= R; x++) {
          const topSurf = Math.abs(x) / 2 + y < R / 2 && -Math.abs(x) / 2 + y > -R / 2 - 1;
          const under =
            y > R / 2 - Math.abs(x) / 2 - 1 && y < R * 1.6 - Math.abs(x) * 1.4 + ((Math.floor((x + R) / 3) * seed) % 3);
          if (topSurf) b.px(cx + x, cy + y, C(y < -R / 2 + 2 ? [130, 200, 90] : [98, 176, 64]));
          else if (under)
            b.px(
              cx + x,
              cy + y,
              C(y < R / 2 - Math.abs(x) / 2 + 2 ? [134, 96, 62] : x < 0 ? [110, 110, 118] : [86, 86, 94]),
            );
        }
      for (let y = 0; y < 5; y++) b.px(cx - 2, cy - 2 - y, C([90, 66, 40]));
      for (let y = -3; y <= 3; y++)
        for (let x = -3; x <= 3; x++) if (Math.abs(x) + Math.abs(y) < 5) b.px(cx - 2 + x, cy - 9 + y, C([58, 136, 52]));
      for (let y = Math.round(cy + R * 0.4); y < Math.min(H, cy + R * 1.6 + 18); y++)
        b.px(cx + Math.round(R * 0.5), y, C([150, 196, 250]));
    }
    b.put(g);
  }

  // per-pixel texture: a small deterministic hash
  const hsh = (a, b, c2) => {
    let h = (a * 374761393 + b * 668265263 + c2 * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };

  function land(g, w, e) {
    const { W, H, vox, key } = w,
      b = new Buf(g, W, H),
      tone = toner(e);
    const snowy = e.wx.snow > 0 || e.wx.temp <= 0;
    const has = (x, y, z) => vox.has(key(x, y, z));
    for (const [x, y, z, t0] of w.list) {
      let t = t0;
      if (snowy && t === "grass" && !has(x, y, z + 1)) t = "snow";
      const showTop = !has(x, y, z + 1),
        showL = !has(x, y + 1, z),
        showR = !has(x + 1, y, z);
      if (!showTop && !showL && !showR) continue;
      const [sx, sy] = iso(w, x, y, z),
        base = COL[t];
      for (let i = 0; i < 8; i++) {
        const half = i < 2 || i > 5 ? 1 : 0,
          topEnd = half ? 2 : 3,
          topStart = half ? 1 : 0;
        for (let j = topStart; j <= topEnd + 4; j++) {
          const px = sx - 4 + i,
            py = sy - 2 + j;
          const n = hsh(x * 8 + i, y * 8 + j, z);
          let col, face;
          if (j <= topEnd) {
            if (!showTop) continue;
            face = 0;
            col = base;
          } else if (i < 4) {
            if (!showL) continue;
            face = 1;
            col = mix(base, [0, 0, 0], 0.22);
          } else {
            if (!showR) continue;
            face = 2;
            col = mix(base, [0, 0, 0], 0.4);
          }
          // textures
          if (t === "grass" && face > 0)
            col =
              j <= topEnd + 1
                ? mix(COL.grass, [0, 0, 0], face === 1 ? 0.22 : 0.4)
                : mix(COL.dirt, [0, 0, 0], face === 1 ? 0.22 : 0.4);
          if (t === "snow" && face > 0 && t0 === "grass")
            col =
              j <= topEnd + 1
                ? mix(COL.snow, [0, 0, 0], face === 1 ? 0.15 : 0.3)
                : mix(COL.dirt, [0, 0, 0], face === 1 ? 0.22 : 0.4);
          if (["coal", "gold", "gem"].includes(t))
            col =
              n > 0.7
                ? mix(COL[t], [0, 0, 0], face * 0.18)
                : mix(COL.stone, [0, 0, 0], face === 0 ? 0 : face === 1 ? 0.22 : 0.4);
          if (t === "wood" && face > 0 && i % 3 === 1) col = mix(col, [0, 0, 0], 0.2);
          if (t === "plank" && face > 0 && (j - topEnd) % 2 === 0) col = mix(col, [0, 0, 0], 0.18);
          if ((t === "leaves" || t === "bleaves") && n > 0.75) col = mix(col, [20, 60, 20], 0.4);
          if (t === "birch" && face > 0 && (j * 3 + i * 7 + z) % 5 === 0) col = [40, 40, 40];
          if (t === "water")
            col = face === 0 ? mix(COL.water, [255, 255, 255], n > 0.92 ? 0.35 : 0) : mix(COL.water, [0, 0, 30], 0.3);
          if (t !== "water" && t !== "leaves" && t !== "bleaves" && t !== "birch" && n > 0.86)
            col = mix(col, [0, 0, 0], 0.1);
          else if (t !== "water" && n < 0.08) col = mix(col, [255, 255, 255], 0.1);
          // crisp block edges: a lighter top rim, a dark seam on the side faces' edges
          if (face === 0 && j === topStart) col = mix(col, [255, 255, 255], 0.12);
          if (face > 0 && (i === 0 || i === 7 || j === topEnd + 4)) col = mix(col, [0, 0, 0], 0.18);
          b.px(px, py, tone(col));
        }
      }
    }
    // flowers dotted over the open grass
    if (!snowy) {
      const fl = [
        [230, 60, 60],
        [250, 220, 70],
        [120, 140, 250],
        [250, 250, 250],
      ];
      for (const [i, [x, y, h]] of w.walkers.entries())
        if (hsh(x, y, 9) < 0.18) {
          const [sx, sy] = iso(w, x + 0.2 + hsh(x, y, 1) * 0.6, y + 0.2 + hsh(y, x, 2) * 0.6, h);
          b.px(sx, sy - 2, tone(fl[i % 4]));
          b.px(sx, sy - 1, tone([50, 110, 40]));
        }
    }
    b.put(g);
  }

  function sky(c, w, e, s) {
    const { W, H } = w;
    if (e.day < 0.4 && e.wx.clouds < 0.8)
      for (const [px, py, p] of w.stars)
        if (Math.sin(s * (0.5 + p) + p * 30) > -0.4) {
          c.fillStyle = p > 0.85 ? "#ffffff" : "#b8c4ff";
          c.fillRect(Math.round(px * W), Math.round(py * H), 1, 1);
        }
    // the square sun with a stepped halo, or the square moon
    if (e.wx.clouds < 0.85) {
      const night = e.night,
        t = Math.max(0, Math.min(1, night ? e.moon : e.sun));
      const x = Math.round(W * (0.08 + 0.84 * t)),
        y = Math.round(H * 0.55 - Math.sin(t * Math.PI) * H * 0.45);
      if (night) {
        c.fillStyle = "rgba(200,210,255,0.12)";
        c.fillRect(x - 9, y - 9, 18, 18);
        c.fillStyle = "#e4e8f4";
        c.fillRect(x - 5, y - 5, 10, 10);
        c.fillStyle = "#b8bed0";
        c.fillRect(x - 3, y - 2, 2, 2);
        c.fillRect(x + 1, y + 1, 3, 2);
        c.fillRect(x - 1, y + 3, 1, 1);
      } else {
        c.fillStyle = "rgba(255,240,170,0.18)";
        c.fillRect(x - 12, y - 12, 24, 24);
        c.fillStyle = "rgba(255,240,170,0.3)";
        c.fillRect(x - 9, y - 9, 18, 18);
        c.fillStyle = "#fff6c0";
        c.fillRect(x - 6, y - 6, 12, 12);
        c.fillStyle = "#ffe070";
        c.fillRect(x - 6, y + 3, 12, 3);
        c.fillRect(x + 3, y - 6, 3, 12);
      }
    }
    // flat block clouds behind the island
    const nC = Math.round(2 + e.wx.clouds * 4);
    for (let i = 0; i < nC; i++) {
      const cl = w.clouds[i],
        x0 = Math.round(((cl.x * (W + 80) + s * (1.2 + i * 0.3)) % (W + 80)) - 60),
        y0 = Math.round(cl.y);
      const shade = e.night ? [70, 76, 100] : mix([255, 255, 255], [150, 156, 166], e.wx.grey);
      for (let k = 0; k < cl.w; k++)
        for (let d = 0; d < cl.d; d++) {
          if ((k === 0 || k === cl.w - 1) && d === cl.d - 1) continue;
          c.fillStyle = css(shade);
          c.fillRect(x0 + k * 8 - d * 4, y0 + d * 3, 8, 3);
          c.fillStyle = css(mix(shade, [0, 0, 0], 0.15));
          c.fillRect(x0 + k * 8 - d * 4, y0 + d * 3 + 3, 8, 1);
        }
    }
    // a sea of cloud far below the island, in blocks, drifting
    {
      const top = e.night ? [74, 80, 106] : mix([248, 250, 255], [160, 166, 176], e.wx.grey),
        side = mix(top, [40, 50, 90], 0.25),
        off = s * 2,
        base = Math.round(H * 0.84);
      for (let i = -1; i < W / 8 + 1; i++) {
        const col = i + Math.floor(off / 8),
          x = Math.round(i * 8 - (off % 8)),
          y = base + Math.round(hash(col, 1) * 3) * 3 - (hash(col, 2) < 0.3 ? 3 : 0);
        c.fillStyle = css(top);
        c.fillRect(x, y, 8, 3);
        c.fillStyle = css(side);
        c.fillRect(x, y + 3, 8, H - y - 3);
      }
    }
  }

  const VILL = [
    ["..hh..", ".hhhh.", ".ssss.", ".sess.", "rrrrrr", ".rrrr.", ".rrrr.", ".b..b."],
    ["..hh..", ".hhhh.", ".ssss.", ".sess.", "rrrrrr", ".rrrr.", ".rrrr.", "..bb.."],
  ];
  const SHEEP = [
    ["..wwww..", "kwwwwwwk", "kkwwwwww", "..w..w.."],
    ["..wwww..", "kwwwwwwk", "kkwwwwww", ".w..w..."],
  ];

  function frame(c, w, e, s) {
    const { W, H, top, cabin } = w,
      tone = toner(e),
      night = e.night;
    const surf = (fx, fy) => {
      const cell = top[Math.round(fy)]?.[Math.round(fx)];
      return cell ? cell.h : 1;
    };
    // the waterfall: a column of moving water off the island's edge, with mist at the foot
    if (w.fall) {
      const [fx, fy] = iso(w, w.fall.x, w.fall.y, w.fall.z - 1);
      for (let y = fy; y < H; y++)
        for (let x = -2; x <= 2; x++) {
          const v = (y * 0.5 - s * 18 + x * 3) % 6;
          c.fillStyle = css(tone(v < 1 ? [220, 240, 255] : v < 3 ? [110, 170, 240] : [70, 130, 220]));
          c.fillRect(fx + 2 + x, y, 1, 1);
        }
    }
    // cabin details: a door, a window that glows at night, torches on the corners
    if (cabin) {
      const [dx, dy] = iso(w, cabin.x + 1, cabin.y + 1, cabin.h);
      c.fillStyle = css(tone([70, 46, 24]));
      c.fillRect(dx - 3, dy + 3, 2, 4);
      c.fillRect(dx - 2, dy + 2, 1, 1);
      const [wx, wy] = iso(w, cabin.x + 2, cabin.y + 1, cabin.h + 1);
      c.fillStyle = night ? "#ffd27a" : css(tone([120, 170, 210]));
      c.fillRect(wx + 1, wy + 3, 2, 2);
      if (night)
        for (const [tx, ty] of [
          iso(w, cabin.x, cabin.y + 1, cabin.h + 1),
          iso(w, cabin.x + 2, cabin.y + 1, cabin.h + 1),
        ]) {
          const fl = Math.sin(s * 9 + tx) > 0;
          for (let yy = -5; yy <= 5; yy++)
            for (let xx = -5; xx <= 5; xx++) {
              const d = Math.sqrt(xx * xx + yy * yy) / 5;
              if (d < 1 && (1 - d) * 0.6 > bayer(tx + xx, ty + yy)) {
                c.fillStyle = "rgba(255,180,80,0.3)";
                c.fillRect(tx - 4 + xx, ty + 1 + yy, 1, 1);
              }
            }
          c.fillStyle = "#5a3a1a";
          c.fillRect(tx - 4, ty + 2, 1, 3);
          c.fillStyle = fl ? "#ffe080" : "#ff9a30";
          c.fillRect(tx - 4, ty + 1, 1, 1);
        }
      {
        const smk = (s * 0.8) % 1;
        c.fillStyle = `rgba(220,220,220,${0.5 * (1 - smk)})`;
        const [cx2, cy2] = iso(w, cabin.x + 1, cabin.y, cabin.h + 4);
        c.fillRect(cx2 + Math.round(Math.sin(s * 2) * 2), cy2 - 2 - Math.round(smk * 12), 2, 2);
      }
    }
    // sheep grazing: shuffle a little, head bobs
    for (const sh of w.sheep) {
      if (!sh.cell) continue;
      const fx = sh.cell[0] + Math.sin(s * 0.15 + sh.ph) * 0.8,
        fy = sh.cell[1] + Math.cos(s * 0.11 + sh.ph) * 0.8;
      const [sx, sy] = iso(w, fx, fy, surf(fx, fy));
      RS_PX.sprite(
        c,
        SHEEP[Math.floor(s * 2 + sh.ph) % 2],
        sx - 4,
        sy - 3,
        { w: css(tone([236, 236, 230])), k: css(tone([60, 50, 50])) },
        Math.sin(s * 0.15 + sh.ph + 1.57) < 0,
      );
    }
    // the villager walking a loop around the island top
    if (w.walkers.length) {
      const t = s * 0.05,
        cx = w.N / 2,
        R = w.N * 0.28,
        fx = cx + Math.cos(t) * R,
        fy = cx + Math.sin(t) * R * 0.9;
      const [vx, vy] = iso(w, fx, fy, surf(fx, fy));
      RS_PX.sprite(
        c,
        VILL[Math.floor(s * 5) % 2],
        vx - 3,
        vy - 8,
        {
          h: css(tone([90, 60, 30])),
          s: css(tone([226, 180, 140])),
          e: "#1a1a1a",
          r: css(tone([90, 70, 150])),
          b: css(tone([50, 40, 30])),
        },
        Math.sin(t) < 0,
      );
    }
    // birds flapping across by day
    if (!night && !e.wx.rain)
      for (let i = 0; i < 3; i++) {
        const bx = Math.round(((s * (7 + i) + i * 90) % (W + 40)) - 20),
          by = Math.round(H * 0.18 + i * 7 + Math.sin(s * 1.5 + i) * 3),
          up = Math.floor(s * 5 + i) % 2;
        c.fillStyle = "#2a2a34";
        c.fillRect(bx, by, 2, 1);
        c.fillRect(bx - 2, by - up, 2, 1);
        c.fillRect(bx + 2, by - up, 2, 1);
      }
    // a little boat drifting on the lake, a fisher with a rod that twitches now and then
    {
      const bx = w.lake.x + Math.sin(s * 0.08) * w.lake.r * 0.4,
        by = w.lake.y + Math.cos(s * 0.06) * w.lake.r * 0.3,
        [px, py] = iso(w, bx, by, 2),
        bob = Math.round(Math.sin(s * 1.5) * 0.6);
      c.fillStyle = css(tone([120, 80, 40]));
      c.fillRect(px - 4, py - 2 + bob, 9, 2);
      c.fillStyle = css(tone([160, 110, 60]));
      c.fillRect(px - 4, py - 2 + bob, 9, 1);
      c.fillStyle = css(tone([70, 46, 24]));
      c.fillRect(px - 3, py + bob, 7, 1);
      c.fillStyle = css(tone([60, 90, 160]));
      c.fillRect(px - 1, py - 6 + bob, 2, 4);
      c.fillStyle = css(tone([226, 180, 140]));
      c.fillRect(px - 1, py - 8 + bob, 2, 2);
      const tw = Math.sin(s * 0.9) > 0.9 ? 1 : 0;
      c.fillStyle = "#2a1a10";
      for (let k = 0; k < 6; k++) c.fillRect(px + 1 + k, py - 7 + bob - Math.round(k * 0.5) + (k > 3 ? tw : 0), 1, 1);
      c.fillStyle = "rgba(230,240,255,0.7)";
      c.fillRect(px + 7, py - 9 + bob + tw, 1, 6);
    }
    // water sparkles on the lake
    {
      const [lx, ly] = iso(w, w.lake.x, w.lake.y, 1);
      for (let i = 0; i < 5; i++)
        if (Math.sin(s * 3 + i * 2.1) > 0.7) {
          c.fillStyle = "#e8f4ff";
          c.fillRect(lx + Math.round(Math.sin(i * 7.3) * 8), ly + Math.round(Math.cos(i * 4.1) * 3), 2, 1);
        }
    }
    // fireflies on mild nights
    if (night && e.wx.temp > 8 && !e.wx.rain)
      for (const [px, py, p] of w.flies) {
        if (Math.sin(s * 2 + p * 20) < 0.2) continue;
        const [fx, fy] = iso(w, 2 + px * (w.N - 4), 2 + py * (w.N - 4), 3);
        c.fillStyle = "#d8ff70";
        c.fillRect(fx + Math.round(Math.sin(s + p * 9) * 4), fy - 6 + Math.round(Math.cos(s * 0.7 + p * 5) * 3), 1, 1);
      }
    // weather
    if (e.wx.rain) {
      c.fillStyle = "rgba(170,200,250,0.7)";
      const n = Math.round(w.drops.length * Math.min(1, e.wx.rain + 0.2));
      for (let i = 0; i < n; i++) {
        const [px, py, sp] = w.drops[i];
        c.fillRect(Math.round(px * W), Math.round((py * H + s * 110 * sp) % H), 1, 3);
      }
    }
    if (e.wx.snow) {
      c.fillStyle = "#ffffff";
      for (const [px, py, sp] of w.drops)
        c.fillRect(Math.round(px * W + Math.sin(s + py * 20) * 3), Math.round((py * H + s * 14 * sp) % H), 2, 2);
    }
    if (e.wx.fog) {
      c.fillStyle = "rgba(200,206,214,0.35)";
      for (let y = Math.round(H * 0.5); y < H; y += 2) for (let x = (y >> 1) & 1; x < W; x += 2) c.fillRect(x, y, 1, 1);
    }
    if (e.wx.thunder && s % 11 < 0.12) {
      c.fillStyle = "rgba(255,255,255,0.6)";
      c.fillRect(0, 0, W, H);
    }
    // now and then a cloud drifts across in front of the island
    {
      const per = 60,
        t = (s % per) / per;
      if (t < 0.5) {
        const k = t / 0.5,
          x0 = Math.round(W + 40 - k * (W + 120)),
          y0 = Math.round(H * 0.62);
        const col = e.night ? [80, 86, 112] : mix([255, 255, 255], [160, 166, 176], e.wx.grey);
        c.globalAlpha = 0.85;
        for (let kx = 0; kx < 7; kx++)
          for (let d = 0; d < 2; d++) {
            if ((kx === 0 || kx === 6) && d === 1) continue;
            c.fillStyle = css(col);
            c.fillRect(x0 + kx * 8 - d * 4, y0 + d * 3, 8, 3);
            c.fillStyle = css(mix(col, [0, 0, 0], 0.15));
            c.fillRect(x0 + kx * 8 - d * 4, y0 + d * 3 + 3, 8, 1);
          }
        c.globalAlpha = 1;
      }
    }
  }

  RS_SCENE.register("blocks", { build, background, sky, land, frame });
})();
