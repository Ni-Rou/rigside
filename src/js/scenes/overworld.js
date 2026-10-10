"use strict";

// Overworld: 16-bit style kingdom with a castle, village and hero.
(() => {
  const { Buf, ramp, hex, sprite, css, blendRamp, hash, smooth, mist, puffs, smoke } = RS_PX;
  const { rng } = RS_SCENE;
  const H_ = (a) => a.map(hex);
  const SKY = {
    day: H_(["#3a78d8", "#4c8ce2", "#62a2ea", "#82baf2", "#a8d2f8"]),
    night: H_(["#0c1238", "#121a48", "#1a2458", "#222e66", "#2c3a74"]),
    warm: H_(["#3a3480", "#6c4898", "#c0608c", "#f08c64", "#ffc87c"]),
    grey: H_(["#6a7484", "#788292", "#86909e", "#96a0ac", "#a6aeb8"]),
  };
  const skyRamp = (e) => {
    let r = blendRamp(SKY.night, SKY.day, smooth(e.day));
    if (e.glow > 0) r = blendRamp(r, SKY.warm, e.glow * 0.8);
    if (e.wx.grey > 0.4) r = blendRamp(r, e.night ? SKY.night : SKY.grey, (e.wx.grey - 0.3) * 1.2);
    return r;
  };
  function toner(e) {
    const n = Math.max(0, Math.min(1, (0.55 - e.day) / 0.45)),
      warm = e.glow;
    return (c, glow = false) => {
      if (glow) return c;
      let [r, g, b] = typeof c === "string" ? hex(c) : c;
      if (warm) {
        r += (255 - r) * 0.12 * warm;
        b *= 1 - 0.18 * warm;
      }
      return [r * (1 - 0.72 * n), g * (1 - 0.62 * n), b * (1 - 0.35 * n) + 18 * n];
    };
  }

  const TREE_BIG = [
    "....kkkkk....",
    "..kkLLlllkk..",
    ".kLLllllgggk.",
    "kLLlllllggggk",
    "kLlllllgggggk",
    "klllllggggggk",
    "kllllgggggdgk",
    "kgllggggggddk",
    ".kgggggggddk.",
    ".kkggggdddkk.",
    "...kkkddkk...",
    ".....kbbk....",
    ".....kbbk....",
    "....kbbbbk...",
  ];
  const TREE_SMALL = [
    "..kkkk...",
    ".kLlllk..",
    "kLllgggk.",
    "klllgggdk",
    "kgggggddk",
    ".kggdddk.",
    "..kkkkk..",
    "....b....",
    "....b....",
  ];
  const BUSH = ["..kkk..", ".kLlgk.", "kLlggdk", "kkkkkkk"];
  const HOUSE = [
    "....rrrr....",
    "...rRRRRr...",
    "..rRRRRRRr..",
    ".rRRRRRRRRr.",
    "rrrrrrrrrrrr",
    ".cccccccccc.",
    ".cWWccccWWc.",
    ".cWWccddcWWc",
    ".ccccddcccc.",
    ".ccccddcccc.",
  ];
  const HERO = [
    [
      "...hhh..",
      "..hhhhh.",
      "..hsss..",
      "...sss..",
      ".CCtttC.",
      "CCttTttC",
      "C.ttTtt.",
      "..bbbb..",
      "..b..b..",
      ".kk..kk.",
    ],
    [
      "...hhh..",
      "..hhhhh.",
      "..hsss..",
      "...sss..",
      ".CCtttC.",
      "CCttTttC",
      "C.ttTtt.",
      "..bbbb..",
      "...bb...",
      "...kk...",
    ],
  ];
  const CART = [
    [
      "..........ww....",
      ".........wwww...",
      "..ccccc..wHHw...",
      ".cyyyyyc.wHHHH..",
      ".cccccccHHHHHHH.",
      "..o...o.HH..HH..",
      ".ooo.ooo.H....H.",
    ],
    [
      "..........ww....",
      ".........wwww...",
      "..ccccc..wHHw...",
      ".cyyyyyc.wHHHH..",
      ".cccccccHHHHHHH.",
      "..o...o..HH.HH..",
      ".ooo.ooo..H..H..",
    ],
  ];
  const SLIME = [
    ["...kkk...", ".kkGggkk.", "kGgggggk.", "kgkgkgggk", "kgggggggk", ".kkkkkkk."],
    [".........", "...kkk...", ".kGgggkk.", "kgkgkggk.", "kgggggggk", "kkkkkkkkk"],
  ];
  const DRAGON = [
    ["x.........x.", "xx.......xx.", ".xxx...xxx..", "..xxxxxxx..x", "....xxxxxxx.", "....x..x...."],
    ["............", "............", "xxxx...xxxx.", "..xxxxxxx..x", "....xxxxxxx.", "....x..x...."],
  ];

  function build(W, H) {
    const r = rng(1986),
      u = Math.min(W, H) / 180;
    const horizon = Math.round(H * 0.42);
    const far = [0, 1].map((k) =>
      Array.from({ length: W }, (_, x) =>
        Math.round(
          horizon -
            (k ? 6 : 14) * u -
            Math.abs(Math.sin(x * (0.03 + k * 0.02) + k * 2)) * (k ? 14 : 26) * u -
            Math.sin(x * 0.11 + k) * 2 * u,
        ),
      ),
    );
    const hill1 = Array.from({ length: W }, (_, x) =>
      Math.round(horizon + 6 * u - Math.sin(x * 0.022 + 2) * 9 * u - Math.sin(x * 0.07) * 2 * u),
    );
    const hill2 = Array.from({ length: W }, (_, x) => Math.round(H * 0.6 - Math.sin(x * 0.03 + 4) * 6 * u));
    const castle = { x: Math.round(W * 0.74), y: hill1[Math.round(W * 0.74)] + Math.round(2 * u) };
    const cliffTop = hill1[Math.round(W * 0.14)] - Math.round(6 * u);
    const cliff = {
      x: Math.round(W * 0.14),
      top: cliffTop,
      base: Math.min(Math.round(H * 0.6), cliffTop + Math.round(44 * u)),
    }; // capped so tall screens don't stretch it
    const lake = {
      x: Math.round(W * 0.17),
      y: cliff.base + Math.round(13 * u),
      rx: Math.round(Math.min(W * 0.1, 30 * u)),
      ry: Math.round(6 * u),
    };
    // the road: from the bottom of the screen winding up to the castle gate
    const road = (y) => {
      const t = (H - y) / (H - castle.y);
      return Math.round(W * 0.46 + (castle.x - W * 0.46) * t * t + Math.sin(t * Math.PI * 2) * 10 * u);
    };
    // the river: from the lake east to the right edge, under the road
    const river = (x) =>
      Math.round(lake.y + 2 * u + ((x - lake.x) / (W - lake.x)) * (H * 0.85 - lake.y) + Math.sin(x * 0.05) * 3 * u);
    const village = { x: Math.round(W * 0.34), y: hill2[Math.round(W * 0.34)] + Math.round(4 * u) };
    const field = {
      x: Math.round(W * 0.56),
      y: Math.round(H * 0.58),
      w: Math.round(Math.min(W * 0.14, 60 * u)),
      h: Math.round(10 * u),
    };
    const trees = [];
    for (let i = 0; i < Math.round(W / 11); i++) {
      const x = Math.round(r() * (W - 14)),
        band = r();
      const y =
        band < 0.4
          ? hill1[Math.min(W - 1, x + 6)] + Math.round(r() * 8 * u)
          : band < 0.75
            ? hill2[Math.min(W - 1, x + 6)] + Math.round(r() * 10 * u)
            : Math.round(H * 0.72 + r() * H * 0.22);
      if (Math.abs(x + 6 - castle.x) < 26 * u && y < castle.y + 10) continue;
      if (Math.abs(x + 6 - road(y + 12)) < 8 * u) continue;
      if (Math.abs(x - village.x) < 30 * u && Math.abs(y - village.y) < 16 * u) continue;
      if (x > field.x - 8 && x < field.x + field.w + 4 && Math.abs(y - field.y) < 14 * u) continue;
      if ((x - lake.x) ** 2 / (lake.rx + 10) ** 2 + (y + 10 - lake.y) ** 2 / (lake.ry + 12) ** 2 < 1) continue;
      trees.push({ x, y, big: band > 0.75 || r() < 0.3 });
    }
    trees.sort((a, b) => a.y - b.y);
    const flowers = Array.from({ length: Math.round(W * 1.2) }, () => [
      Math.round(r() * W),
      Math.round(H * 0.7 + r() * H * 0.3),
      ["#ff6b8a", "#ffe066", "#ffffff", "#9b7bff"][Math.floor(r() * 4)],
    ]);
    const grass = Array.from({ length: Math.round(W * 0.8) }, () => [
      Math.round(r() * W),
      Math.round(H * 0.74 + r() * H * 0.26),
      r() * 6,
    ]);
    const clouds = Array.from({ length: Math.max(4, Math.round(W / 50)) }, (_, i) => ({
      x: r() * W,
      y: Math.round(6 * u + r() * horizon * 0.5),
      w: Math.round((18 + r() * 22) * u),
      sp: 0.5 + r() * 0.9,
      far: i % 2 === 0,
    }));
    const stars = Array.from({ length: Math.round((W * horizon) / 40) }, () => [
      Math.round(r() * W),
      Math.round(r() * horizon * 0.9),
      r(),
    ]);
    const slimes = [0.24, 0.62, 0.9].map((f) => ({
      x: Math.round(W * f),
      y: Math.round(H * 0.86 + r() * H * 0.06),
      ph: r() * 10,
    }));
    const flies = Array.from({ length: Math.round(W / 6) }, () => [r() * W, H * 0.55 + r() * H * 0.4, r() * 10]);
    const flutters = Array.from({ length: 4 }, () => [r() * W, H * 0.75 + r() * H * 0.2, r() * 10]);
    return {
      W,
      H,
      u,
      horizon,
      far,
      hill1,
      hill2,
      castle,
      cliff,
      lake,
      road,
      river,
      village,
      field,
      trees,
      flowers,
      grass,
      clouds,
      stars,
      slimes,
      flies,
      flutters,
      cloudSprites: null,
    };
  }

  // sky
  function background(g, w, e) {
    const { W, H, u, horizon } = w,
      sr = skyRamp(e),
      T = toner(e),
      b = new Buf(g, W, H);
    for (let y = 0; y < H; y++) {
      const v = Math.min(1, y / horizon);
      for (let x = 0; x < W; x++) b.px(x, y, ramp(sr, v, x, y, 0.15));
    }
    if (e.day < 0.35 && e.wx.clouds < 0.85)
      for (const [x, y, p] of w.stars) if (p < 0.7) b.px(x, y, p < 0.2 ? [255, 255, 255] : [170, 190, 255]);
    if (e.wx.clouds < 0.85) {
      const p = Math.min(1, Math.max(0, e.night ? e.moon : e.sun));
      const sx = Math.round(W * (0.1 + 0.8 * p)),
        sy = Math.round(horizon * (0.8 - 0.62 * Math.sin(Math.PI * p))),
        R = Math.round(7 * u);
      for (let y = -R - 4; y <= R + 4; y++)
        for (let x = -R - 4; x <= R + 4; x++) {
          const d = Math.sqrt(x * x + y * y);
          if (d <= R)
            b.px(
              sx + x,
              sy + y,
              e.night
                ? d > R - 1.2
                  ? [210, 210, 190]
                  : [248, 246, 222]
                : d > R - 1.2
                  ? [255, 200, 60]
                  : d < R * 0.5
                    ? [255, 252, 200]
                    : [255, 236, 120],
            );
          else if (!e.night && d < R + 4 && (x === 0 || y === 0 || Math.abs(x) === Math.abs(y)) && d > R + 1.5)
            b.px(sx + x, sy + y, [255, 240, 140]); // rays
        }
      if (e.night) {
        const lit = (1 - Math.cos(e.moonPhase * 2 * Math.PI)) / 2,
          off = Math.round((e.moonPhase < 0.5 ? -1 : 1) * 2 * R * lit);
        for (let y = -R; y <= R; y++)
          for (let x = -R - 1; x <= R + 1; x++)
            if ((x - off) ** 2 + y * y <= R * R + 1 && x * x + y * y <= R * R)
              b.px(sx + x, sy + y, ramp(sr, (sy + y) / horizon, sx + x, sy + y, 0.15));
      }
    }
    // far mountains with snowy tops and a lit edge
    w.far.forEach((m, k) => {
      const col = T(k ? "#5868b8" : "#7484c8"),
        lit = T(k ? "#7a8ad0" : "#97a6dc"),
        snow = T("#eef2ff");
      for (let x = 0; x < W; x++)
        for (let y = m[x]; y < horizon + 10; y++) {
          const depth = y - m[x],
            slopeLit = x > 0 && m[x] <= m[x - 1];
          b.px(
            x,
            y,
            depth < (k ? 3 : 6) * u && m[x] < horizon - (k ? 16 : 26) * u ? snow : slopeLit && depth < 4 ? lit : col,
          );
        }
    });
    b.put(g);
  }

  function cloudSprite(w, cl, e) {
    const c = document.createElement("canvas"),
      cw = cl.w * 2 + 4,
      ch = Math.round(cl.w * 0.9) + 4;
    c.width = cw;
    c.height = ch;
    const g = c.getContext("2d"),
      grey = e.wx.grey > 0.45,
      n = Math.max(0, Math.min(1, (0.55 - e.day) / 0.45));
    const top = grey ? [210, 214, 222] : [255, 255, 255],
      mid = grey ? [176, 182, 194] : [226, 238, 252],
      bot = grey ? [140, 148, 162] : [184, 206, 236];
    const tone = (c2) => [c2[0] * (1 - 0.7 * n), c2[1] * (1 - 0.62 * n), c2[2] * (1 - 0.35 * n) + 18 * n];
    const puffs = [
      [0.5, 0.62, 0.3],
      [0.3, 0.68, 0.22],
      [0.7, 0.66, 0.24],
      [0.42, 0.42, 0.24],
      [0.6, 0.45, 0.2],
    ];
    const inside = (x, y) =>
      puffs.some(([px2, py, pr]) => Math.sqrt((x - px2 * cw) ** 2 + ((y - py * ch) * 1.25) ** 2) < pr * cw) &&
      y <= ch * 0.78;
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++) {
        if (!inside(x, y)) continue;
        const v = y / (ch * 0.78),
          rim = !inside(x, y - 1) || !inside(x - 1, y); // top-left rim catches the light
        const under = !inside(x, y + 2); // the flat shaded underside
        g.fillStyle = css(tone(under ? bot : rim ? top : v < 0.45 ? top : v < 0.8 ? mid : bot));
        g.fillRect(x, y, 1, 1);
      }
    return c;
  }

  function sky(c, w, e, s) {
    const { W, H, u, horizon } = w;
    if (e.day < 0.35 && e.wx.clouds < 0.85)
      for (const [x, y, p] of w.stars)
        if (p >= 0.7 && Math.sin(s * (1 + p * 2) + p * 30) > 0) {
          c.fillStyle = "#ffffff";
          c.fillRect(x, y, 1, 1);
        }
    const key = `${e.wx.grey > 0.45}|${Math.round(e.day * 8)}`;
    if (!w.cloudSprites || w.cloudKey !== key) {
      w.cloudSprites = w.clouds.map((cl) => cloudSprite(w, cl, e));
      w.cloudKey = key;
    }
    const n = Math.round(w.clouds.length * Math.max(0.35, Math.min(1, e.wx.clouds + 0.3)));
    for (let i = 0; i < n; i++) {
      const cl = w.clouds[i],
        spr = w.cloudSprites[i];
      const x = Math.round(((cl.x + s * cl.sp * (cl.far ? 0.5 : 1)) % (W + spr.width + 20)) - spr.width - 10);
      c.drawImage(spr, x, cl.y);
    }
    // the dragon circling the far peaks every so often
    const T2 = 120,
      p = ((s + 20) % T2) / T2;
    if (p < 0.5) {
      const a = (p / 0.5) * Math.PI * 2,
        x = Math.round(W * 0.42 + Math.cos(a) * W * 0.18),
        y = Math.round(horizon * 0.45 + Math.sin(a) * 8 * u);
      sprite(c, DRAGON[Math.floor(s * 4) % 2], x, y, { x: e.day < 0.4 ? "#141838" : "#4a3a7a" }, Math.sin(a) > 0);
    }
  }

  // land
  function land(g, w, e) {
    const { W, H, u, horizon, hill1, hill2, castle: C, cliff, lake, road, river, village, field } = w,
      T = toner(e),
      b = new Buf(g, W, H);
    const lit = e.day < 0.5;
    // hill bands, each with a light rim and darker shade lower down
    for (let x = 0; x < W; x++) {
      for (let y = hill1[x]; y < H; y++)
        b.px(x, y, y - hill1[x] < 1 ? T("#9be07a") : y - hill1[x] < 5 * u ? T("#6cc85a") : T("#52b04c"));
      for (let y = hill2[x]; y < H; y++)
        b.px(x, y, y - hill2[x] < 1 ? T("#86d46c") : y - hill2[x] < 6 * u ? T("#5cbc50") : T("#48a444"));
    }
    // the meadow in front, with a light/dark checker of grass tufts
    const mY = Math.round(H * 0.72);
    for (let y = mY; y < H; y++)
      for (let x = 0; x < W; x++) {
        const v = Math.sin(x * 0.05 + y * 0.09) * 0.5 + Math.sin(x * 0.013 - y * 0.04) * 0.5,
          n = hash(x, y);
        let c = v > 0.35 ? "#58b84e" : v < -0.4 ? "#48a444" : "#50b04a";
        if (n < 0.03) c = "#7ad468";
        else if (n > 0.97) c = "#3c9840";
        if (n > 0.5 && n < 0.53 && y & 1) {
          b.px(x - 1, y - 1, T("#6ccc5c"));
          b.px(x + 1, y - 1, T("#6ccc5c"));
        } // little v tufts
        b.px(x, y, T(c));
      }
    for (let x = 0; x < W; x++) b.px(x, mY, T("#7ad468"));
    // the cliff on the left: stacked rounded boulders, lit from the upper left, moss in the cracks, grass on top
    const cw2 = Math.round(26 * u),
      cxL = cliff.x - cw2 + Math.round(3 * u);
    const rr0 = rng(41),
      boulders = [];
    for (let y = cliff.top + 3; y < cliff.base + 4; y += 6)
      for (let x = cxL + Math.round((y - cliff.top) * 0.12); x < cliff.x + 2 * u; x += 7 + Math.floor(rr0() * 4))
        boulders.push([x + rr0() * 3, y + rr0() * 2, 4 + rr0() * 2.5]);
    for (const [bx, by, br] of boulders)
      for (let y = -br; y <= br; y++)
        for (let x = -br * 1.2; x <= br * 1.2; x++) {
          const d = (x / (br * 1.2)) ** 2 + (y / br) ** 2;
          if (d > 1) continue;
          const px = Math.round(bx + x),
            py = Math.round(by + y);
          if (py < cliff.top || py >= cliff.base || px > cliff.x + 2 * u) continue;
          const lit = (-x / (br * 1.2) - y / br) * 0.7;
          b.px(
            px,
            py,
            T(
              d > 0.8
                ? "#5a5464"
                : lit > 0.35
                  ? "#d0c8d8"
                  : lit > -0.1
                    ? "#a8a0b4"
                    : lit > -0.5
                      ? "#8a829a"
                      : "#6e6878",
            ),
          );
        }
    for (const [bx, by, br] of boulders)
      if (rr0() < 0.5)
        for (let k = 0; k < 3; k++)
          b.px(Math.round(bx - br + k), Math.round(by + br - 1), T(k === 1 ? "#4ca048" : "#6cc85a"));
    for (let x = cxL - 2; x <= cliff.x + Math.round(2 * u); x++) {
      const ty = cliff.top + Math.round(Math.abs(Math.sin(x * 0.4)) * 2 * u);
      b.px(x, ty, T("#9be07a"));
      b.px(x, ty + 1, T("#6cc85a"));
      b.px(x, ty + 2, T("#4ca048"));
      if (x % 3 === 0) b.px(x, ty - 1, T("#6cc85a"));
      if (x % 5 === 0) for (let k = 3; k < 6 + (x % 3); k++) b.px(x, ty + k, T("#4ca048"));
    }
    // the lake, with a sandy rim and lighter water toward the middle
    for (let y = lake.y - lake.ry - 2; y <= lake.y + lake.ry + 2; y++)
      for (let x = lake.x - lake.rx - 3; x <= lake.x + lake.rx + 3; x++) {
        const d = ((x - lake.x) / lake.rx) ** 2 + ((y - lake.y) / lake.ry) ** 2,
          dr = ((x - lake.x) / (lake.rx + 3)) ** 2 + ((y - lake.y) / (lake.ry + 2)) ** 2;
        if (d <= 1) b.px(x, y, d < 0.35 ? T("#6ab0f0") : d < 0.75 ? T("#4c94e0") : T("#3a7ccc"));
        else if (dr <= 1) b.px(x, y, T("#e8d498"));
      }
    // the river to the right edge
    for (let x = lake.x + Math.round(lake.rx * 0.8); x < W; x++) {
      const y = river(x);
      for (let k = -2; k <= 2; k++)
        b.px(x, y + k, k === -2 ? T("#e8d498") : k === 2 ? T("#2c64b0") : k === -1 ? T("#6ab0f0") : T("#4c94e0"));
    }
    // the road, with darker edges and pebbles, and a stone bridge over the river
    let bridgeY = null;
    for (let y = C.y + 6; y < H; y++) {
      const t = (y - C.y) / (H - C.y),
        half = Math.round((1.5 + t * 6) * u),
        x0 = road(y);
      for (let x = x0 - half; x <= x0 + half; x++)
        b.px(
          x,
          y,
          x === x0 - half || x === x0 + half ? T("#b08a50") : (x * 3 + y * 7) % 13 === 0 ? T("#c8a468") : T("#e2c488"),
        );
      if (bridgeY === null && Math.abs(y - river(x0)) < 1) bridgeY = y;
    }
    if (bridgeY !== null) {
      const x0 = road(bridgeY),
        half = Math.round(8 * u);
      for (let y = bridgeY - 4; y <= bridgeY + 4; y++)
        for (let x = x0 - half; x <= x0 + half; x++)
          b.px(
            x,
            y,
            y === bridgeY - 4 || y === bridgeY + 4 ? T("#6a6470") : (x + y) % 4 === 0 ? T("#8a8494") : T("#a8a2b2"),
          );
      for (let x = x0 - half; x <= x0 + half; x++) b.px(x, bridgeY - 5, T("#c4bece"));
    }
    // fenced field with crop rows
    for (let y = 0; y < field.h; y++)
      for (let x = 0; x < field.w; x++)
        b.px(field.x + x, field.y + y, y % 3 === 0 ? T("#8a5a30") : x % 4 === 0 ? T("#e0c040") : T("#78c048"));
    for (let x = -1; x <= field.w; x++) {
      b.px(field.x + x, field.y - 1, T("#c08a50"));
      b.px(field.x + x, field.y + field.h, T("#c08a50"));
      if (x % 4 === 0) {
        b.px(field.x + x, field.y - 2, T("#8a5a30"));
        b.px(field.x + x, field.y + field.h - 1, T("#8a5a30"));
      }
    }
    // the castle: curtain wall with battlements, towers with cone roofs, a gate, a moat
    const k = u,
      stone = T("#b8bcc8"),
      stoneD = T("#82869a"),
      stoneL = T("#dadce6"),
      roof = T("#3c5ad8"),
      roofL = T("#6a86f0");
    for (let x = -28 * k; x <= 28 * k; x++)
      for (let y = 0; y < 3; y++) b.px(Math.round(C.x + x), C.y + 2 + y, y === 1 ? T("#4c94e0") : T("#3a7ccc")); // moat
    const wallH = Math.round(14 * k);
    for (let y = 0; y < wallH; y++)
      for (let x = -22 * k; x <= 22 * k; x++)
        b.px(
          Math.round(C.x + x),
          C.y - y,
          y % 4 === 0 || (Math.round(x) + (Math.floor(y / 4) % 2) * 2) % 6 === 0 ? stoneD : stone,
        );
    for (let x = -22 * k; x <= 22 * k; x += 3) b.rect(Math.round(C.x + x), C.y - wallH - 2, 2, 2, stoneL);
    w.castleWins = [];
    for (const [dx, tw, th] of [
      [-26, 9, 26],
      [17, 9, 26],
      [-6, 12, 40],
    ]) {
      const x0 = Math.round(C.x + dx * k),
        w0 = Math.round(tw * k),
        h0 = Math.round(th * k);
      for (let y = 0; y < h0; y++)
        for (let x = 0; x < w0; x++)
          b.px(x0 + x, C.y - y, x === 0 ? stoneL : x === w0 - 1 ? stoneD : y % 4 === 0 ? stoneD : stone);
      for (let j = 0; j < Math.round(10 * k); j++) {
        const half = Math.round((j / (10 * k)) * (w0 / 2 + 1));
        for (let i = -half; i <= half; i++)
          b.px(x0 + Math.round(w0 / 2) + i, C.y - h0 - Math.round(10 * k) + j, i < 0 ? roofL : roof);
      }
      w.castleWins.push(
        [x0 + Math.round(w0 / 2) - 1, C.y - Math.round(h0 * 0.6)],
        [x0 + Math.round(w0 / 2) - 1, C.y - Math.round(h0 * 0.35)],
      );
      if (dx === -6) w.flag = [x0 + Math.round(w0 / 2), C.y - h0 - Math.round(10 * k) - 6];
    }
    for (let y = 0; y < Math.round(9 * k); y++)
      for (let x = -3 * k; x <= 3 * k; x++) {
        const arch = y > 9 * k - 3 && Math.abs(x) > 3 * k - (9 * k - y);
        if (!arch) b.px(Math.round(C.x + x), C.y - y, y < 1 ? T("#5a3a22") : T("#3a2414"));
      }
    // the village: houses and a windmill
    const pal = (roofC, roofL2) => ({
      r: css(T(roofC)),
      R: css(T(roofL2)),
      c: css(T("#f4e4c4")),
      W: css(lit ? [255, 214, 96] : T("#5a7ab0")),
      d: css(T("#7a4a2a")),
    });
    const houses = [
      [0, 0, "#c0392b", "#e0533f"],
      [16, 3, "#3a64c8", "#5a86e0"],
      [-15, 5, "#c0392b", "#e0533f"],
      [30, 6, "#8a4ab0", "#a86ad0"],
    ];
    w.windmill = { x: village.x - Math.round(30 * u), y: village.y - 2 };
    for (let y = 0; y < Math.round(20 * u); y++) {
      const half = Math.round(3 + (y / (20 * u)) * 2);
      for (let i = -half; i <= half; i++)
        b.px(
          w.windmill.x + i,
          w.windmill.y - Math.round(20 * u) + y,
          i === -half ? T("#fff4dc") : i === half ? T("#b8a888") : T("#e8dcc0"),
        );
    }
    for (let j = 0; j < 5; j++)
      for (let i = -j - 1; i <= j + 1; i++)
        b.px(w.windmill.x + i, w.windmill.y - Math.round(20 * u) - 5 + j, T("#a0503a"));
    b.rect(w.windmill.x - 1, w.windmill.y - 4, 2, 4, T("#6a3a22"));
    for (const [dx, dy, rc, rl] of houses) {
      const ctx = {
        fillStyle: "",
        fillRect: (x, y) => b.px(x, y, hex(ctx.fillStyle.startsWith("#") ? ctx.fillStyle : "#000000")),
      };
      const p2 = pal(rc, rl);
      HOUSE.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const ch = row[i];
          if (ch === "." || !p2[ch]) continue;
          const m = p2[ch].match(/\d+/g).map(Number);
          b.px(village.x + dx + i, village.y + dy - HOUSE.length + j, m);
        }
      });
    }
    w.chimneys = houses.slice(0, 3).map(([dx, dy]) => [village.x + dx + 8, village.y + dy - HOUSE.length + 1]);
    // trees and bushes
    const tp = { k: T("#1c4424"), L: T("#a8e870"), l: T("#6cc85a"), g: T("#3c9a40"), d: T("#2a7030"), b: T("#7a4a24") };
    const tpc = Object.fromEntries(Object.entries(tp).map(([kk, v]) => [kk, v]));
    for (const t of w.trees) {
      const spr = t.big ? TREE_BIG : TREE_SMALL;
      spr.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const ch = row[i];
          if (ch === "." || !tpc[ch]) continue;
          b.px(t.x + i, t.y - spr.length + j, tpc[ch]);
        }
      });
    }
    for (let i = 0; i < W / 20; i++) {
      const x = Math.round((i * 47.3) % W),
        y = Math.round(H * 0.74 + ((i * 13) % 20) * u);
      BUSH.forEach((row, j) => {
        for (let ii = 0; ii < row.length; ii++) {
          const ch = row[ii];
          if (ch !== "." && tpc[ch]) b.px(x + ii, y + j, tpc[ch]);
        }
      });
    }
    // foreground: two big framing trees, rocks, a wooden signpost by the road
    const bigTree = (tx, base, R) => {
      for (let y = 0; y < R * 1.4; y++)
        for (let k = -2; k <= 2; k++)
          b.px(tx + k + (y > R ? 0 : 0), base - y, T(k < 0 ? "#9a6a3a" : k > 0 ? "#5a3a1e" : "#7a4a24"));
      for (const [ox, oy, rr] of [
        [0, -R * 1.9, R],
        [-R * 0.7, -R * 1.5, R * 0.75],
        [R * 0.7, -R * 1.45, R * 0.8],
        [0, -R * 2.5, R * 0.7],
      ])
        for (let y = -rr; y <= rr; y++)
          for (let x = -rr; x <= rr; x++) {
            const d = (x * x + y * y) / (rr * rr);
            if (d > 1) continue;
            const lit = (-x - y) / rr,
              blob = Math.sin(x * 0.9 + y * 0.6) * Math.sin(y * 0.8 - x * 0.3) > 0.35;
            b.px(
              tx + ox + x,
              base + oy + y,
              T(
                d > 0.86
                  ? "#1c4424"
                  : lit > 0.7
                    ? "#a8e870"
                    : lit > 0.1
                      ? blob
                        ? "#8ad860"
                        : "#6cc85a"
                      : lit > -0.5
                        ? blob
                          ? "#3c9a40"
                          : "#4aac44"
                        : "#2a7030",
              ),
            );
          }
    };
    bigTree(Math.round(W * 0.03), H + 2, Math.round(16 * u));
    bigTree(Math.round(W * 0.97), H + 4, Math.round(14 * u));
    for (const [rx, ry, R2] of [
      [W * 0.2, H * 0.93, 5],
      [W * 0.68, H * 0.95, 4],
      [W * 0.83, H * 0.86, 3],
    ])
      for (let y = -R2; y <= 0; y++)
        for (let x = -R2 - 1; x <= R2 + 1; x++)
          if ((x / (R2 + 1)) ** 2 + (y / R2) ** 2 <= 1)
            b.px(
              rx + x,
              ry + y,
              T(y === -R2 || (x < 0 && y < -R2 * 0.4) ? "#d0c8d8" : x > R2 * 0.4 ? "#6e6878" : "#9a92a6"),
            );
    {
      const sy = Math.round(H * 0.84),
        sx = road(sy) - Math.round(14 * u);
      for (let y = 0; y < 12; y++) b.px(sx + 4, sy - y, T("#6a3a22"));
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 11; x++)
          b.px(
            sx + x,
            sy - 12 + y,
            T(
              x === 0 || y === 0 || x === 10 || y === 4
                ? "#6a3a22"
                : y === 2 && x > 1 && x < 9 && x % 2
                  ? "#5a3a22"
                  : "#c08a50",
            ),
          );
      b.px(sx + 11, sy - 10, T("#c08a50"));
      b.px(sx + 12, sy - 10, T("#c08a50"));
    }
    // flowers
    for (const [x, y, col] of w.flowers)
      if (Math.abs(x - road(y)) > 9 * u) {
        b.px(x, y, T(col));
        b.px(x, y + 1, T("#2a7a30"));
      }
    b.put(g);
  }

  // motion
  function frame(c, w, e, s) {
    const { W, H, u, cliff, lake, road, castle: C } = w,
      wx = e.wx,
      night = e.day < 0.45,
      T = toner(e);
    // the waterfall and its splash
    const fx = Math.round(cliff.x + 2 * u),
      ft = cliff.top,
      fb = lake.y - lake.ry + 1;
    for (let y = ft; y < fb; y++)
      for (let x = 0; x < Math.round(4 * u); x++) {
        const streak = (y - Math.floor(s * 30) + x * 5) % 6;
        c.fillStyle = streak < 2 ? css(T("#ffffff")) : streak < 4 ? css(T("#a8d8ff")) : css(T("#6ab0f0"));
        c.fillRect(fx + x, y, 1, 1);
      }
    for (let i = 0; i < 6; i++) {
      const t = (s * 1.5 + i / 6) % 1;
      c.fillStyle = css(T("#ffffff"));
      c.fillRect(
        fx + Math.round((i - 2.5) * 1.5 + t * (i % 2 ? 3 : -3)),
        fb - Math.round(Math.sin(t * Math.PI) * 4),
        1,
        1,
      );
    }
    // water sparkle on the lake and river
    for (let i = 0; i < Math.round(W / 16); i++) {
      if (Math.sin(s * 3 + i * 1.7) < 0.6) continue;
      const lx = lake.x + Math.round(Math.sin(i * 2.1) * lake.rx * 0.7),
        ly = lake.y + Math.round(Math.cos(i * 1.3) * lake.ry * 0.6);
      c.fillStyle = night ? "#e8e4c0" : "#ffffff";
      c.fillRect(lx, ly, 2, 1);
      const rx = Math.round(lake.x + lake.rx + ((i * 37 + s * 8) % (W - lake.x - lake.rx)));
      c.fillRect(rx, w.river(rx) - 1, 2, 1);
    }
    // a fish leaps from the lake every few seconds
    {
      const T2 = 7,
        p = (s % T2) / T2;
      if (p < 0.25) {
        const q = p / 0.25,
          x = Math.round(lake.x - 8 + q * 16),
          y = Math.round(lake.y - Math.sin(q * Math.PI) * 8 * u);
        c.fillStyle = "#ffb050";
        c.fillRect(x, y, 3, 1);
        c.fillRect(x + (q < 0.5 ? 3 : -1), y + (q < 0.5 ? 1 : -1), 1, 1);
        if (q > 0.9 || q < 0.1) {
          c.fillStyle = "#ffffff";
          c.fillRect(x - 1, lake.y - 1, 1, 1);
          c.fillRect(x + 3, lake.y - 1, 1, 1);
        }
      }
    }
    // windmill sails turning
    const M = w.windmill,
      hub = [M.x, M.y - Math.round(20 * u) - 1],
      L = Math.round(11 * u),
      ang = s * 1.2;
    for (let k2 = 0; k2 < 4; k2++) {
      const a = ang + (k2 * Math.PI) / 2;
      for (let i = 2; i <= L; i++) {
        const x = Math.round(hub[0] + Math.cos(a) * i),
          y = Math.round(hub[1] + Math.sin(a) * i);
        c.fillStyle = css(T("#6a4a2a"));
        c.fillRect(x, y, 1, 1);
        if (i > 3) {
          const sx = Math.round(x + Math.cos(a + Math.PI / 2) * 1.5),
            sy = Math.round(y + Math.sin(a + Math.PI / 2) * 1.5);
          c.fillStyle = css(T("#f4ecd8"));
          c.fillRect(sx, sy, 1, 1);
        }
      }
    }
    c.fillStyle = css(T("#4a3a2a"));
    c.fillRect(hub[0] - 1, hub[1] - 1, 2, 2);
    // the castle flag
    if (w.flag) {
      const [fx2, fy] = w.flag;
      c.fillStyle = css(T("#5a4a3a"));
      c.fillRect(fx2, fy, 1, 7);
      for (let i = 1; i < 6; i++) {
        c.fillStyle = css(T("#e03a3a"));
        c.fillRect(fx2 + i, fy + Math.round(Math.sin(s * 5 + i * 0.8)) + (i > 3 ? 1 : 0), 1, 2);
      }
    }
    // castle and house windows at night
    if (e.day < 0.55)
      for (const [x, y] of w.castleWins || []) {
        c.fillStyle = Math.sin(s * 2 + x) > -0.8 ? "#ffd75e" : "#c89a3a";
        c.fillRect(x, y, 2, 3);
      }
    // the hero walks the road toward the castle and back (about two minutes each way)
    {
      const lap = 120,
        t = (s % (lap * 2)) / lap,
        up = t < 1,
        k2 = up ? t : 2 - t;
      const y = Math.round(H - 4 - k2 * (H - C.y - 26)),
        x = road(y) - 4,
        step = Math.floor(s * 4) % 2;
      const pal = {
        h: css(T("#6b3e1f")),
        s: css(T("#f1c08a")),
        C: css(T("#c23a3a")),
        t: css(T("#2d6fd8")),
        T: css(T("#ffd75e")),
        b: css(T("#4a3020")),
        k: css(T("#1c1c1c")),
      };
      sprite(c, HERO[step], x, y - 10, pal, !up);
    }
    // the merchant's cart, the other way
    {
      const lap = 160,
        t = ((s + 70) % lap) / lap;
      if (t < 0.6) {
        const k2 = t / 0.6,
          y = Math.round(C.y + 30 + k2 * (H - C.y - 34)),
          x = road(y) + Math.round(5 * u);
        const pal = {
          c: css(T("#8a5a30")),
          y: css(T("#f0d070")),
          o: css(T("#3a2a1a")),
          w: css(T("#5a3a22")),
          H: css(T("#a07050")),
        };
        sprite(c, CART[Math.floor(s * 3) % 2], x, y - 7, pal, true);
      }
    }
    // slimes bouncing in the meadow
    const sp = { k: css(T("#1c3a22")), G: css(T("#c8ffb0")), g: css(T("#4cd06a")) };
    for (const sl of w.slimes) {
      const ph = (s * 1.4 + sl.ph) % 2,
        f = ph < 0.4 ? 1 : 0,
        jump = ph > 0.4 && ph < 1 ? Math.round(Math.sin(((ph - 0.4) / 0.6) * Math.PI) * 5) : 0;
      sprite(c, SLIME[f], sl.x + Math.round(Math.sin(s * 0.2 + sl.ph) * 10), sl.y - jump, sp);
    }
    // smoke curling from the village chimneys
    w.puffs ||= puffs([236, 236, 240], 5, 0.8);
    for (const [i, [cx, cy]] of (w.chimneys || []).entries())
      smoke(c, w.puffs, cx, cy, s + i * 3.3, { n: 8, h: 18 * u, lean: 10 * u, speed: 0.07, alpha: night ? 0.35 : 0.6 });
    // mist on the lake at dawn and at night
    if (night || e.phase === "dawn" || wx.fog) {
      w.lakeMist ||= mist(Math.round(lake.rx * 3), Math.round(10 * u), [220, 230, 245], 0.8, 0.5, 43);
      const m = w.lakeMist,
        ox = -Math.round((s * 1.5) % m.width);
      c.save();
      c.beginPath();
      c.rect(lake.x - lake.rx * 1.5, lake.y - 14 * u, lake.rx * 3, 24 * u);
      c.clip();
      c.globalAlpha = night ? 0.5 : 0.8;
      c.drawImage(m, lake.x - lake.rx * 1.5 + ox, lake.y - 7 * u);
      c.drawImage(m, lake.x - lake.rx * 1.5 + ox + m.width, lake.y - 7 * u);
      c.restore();
    }
    // shadows of clouds sliding over the land on bright days
    if (!night && wx.clouds > 0.15 && wx.clouds < 0.9 && !wx.rain) {
      if (!w.shadow) {
        const R = Math.round(40 * u);
        w.shadow = document.createElement("canvas");
        w.shadow.width = R * 2;
        w.shadow.height = R;
        const g = w.shadow.getContext("2d"),
          gr = g.createRadialGradient(R, R / 2, 0, R, R / 2, R);
        gr.addColorStop(0, "rgba(10,30,50,0.22)");
        gr.addColorStop(0.6, "rgba(10,30,50,0.12)");
        gr.addColorStop(1, "rgba(10,30,50,0)");
        g.setTransform(1, 0, 0, 0.5, 0, 0);
        g.fillStyle = gr;
        g.fillRect(0, 0, R * 2, R * 2);
      }
      const sh = w.shadow;
      for (let i = 0; i < 3; i++) {
        const x = ((((i * 0.37 * (W + sh.width) + s * 4) % (W + sh.width)) + W + sh.width) % (W + sh.width)) - sh.width,
          y = Math.round(w.horizon + (H - w.horizon) * (0.15 + i * 0.28));
        c.drawImage(sh, Math.round(x), y);
      }
    }
    // birds, butterflies by day; fireflies by night
    if (!night) {
      for (let i = 0; i < 3; i++) {
        const x = Math.round(((s * (7 + i) + i * 80) % (W + 30)) - 15),
          y = Math.round(20 * u + i * 6 + Math.sin(s + i) * 2),
          f = Math.floor(s * 3 + i) % 2;
        c.fillStyle = "#2a2a3a";
        if (f) {
          c.fillRect(x, y, 1, 1);
          c.fillRect(x + 1, y + 1, 1, 1);
          c.fillRect(x + 2, y, 1, 1);
        } else c.fillRect(x, y + 1, 3, 1);
      }
      for (const [x0, y0, ph] of w.flutters) {
        const x = Math.round(x0 + Math.sin(s * 0.4 + ph) * 12),
          y = Math.round(y0 + Math.sin(s * 1.7 + ph) * 3),
          f = Math.floor(s * 6 + ph) % 2;
        c.fillStyle = ph > 5 ? "#ffe066" : "#ff8ac8";
        c.fillRect(x - (f ? 1 : 0), y, f ? 3 : 1, 1);
        c.fillStyle = "#3a2a3a";
        c.fillRect(x, y + 1, 1, 1);
      }
    } else {
      for (const [x0, y0, ph] of w.flies) {
        if (Math.sin(s * 2 + ph) < 0.2) continue;
        c.fillStyle = "#e8ff7a";
        c.fillRect(Math.round(x0 + Math.sin(s * 0.5 + ph) * 4), Math.round(y0 + Math.cos(s * 0.4 + ph) * 3), 1, 1);
      }
    }
    // tall grass swaying in the meadow
    c.fillStyle = css(T("#3a9a40"));
    for (const [x, y, ph] of w.grass) {
      const lean = Math.round(Math.sin(s * 1.6 + ph) * 0.8);
      c.fillRect(x, y, 1, 2);
      c.fillRect(x + lean, y - 1, 1, 1);
    }
    // weather
    if (wx.rain) {
      c.fillStyle = "rgba(190,215,255,0.7)";
      for (let i = 0; i < Math.round(W * 0.7 * wx.rain); i++) {
        const x = Math.floor((i * 37 + s * 25) % W),
          y = Math.floor((i * 53 + s * 90) % H);
        c.fillRect(x, y, 1, 3);
      }
    }
    if (wx.snow) {
      c.fillStyle = "#ffffff";
      for (let i = 0; i < Math.round(W * 0.6 * wx.snow); i++) {
        const x = Math.floor((i * 41 + s * 3 + Math.sin(s + i) * 2) % W),
          y = Math.floor((i * 29 + s * 12) % H);
        c.fillRect(x, y, 1, 1);
      }
    }
    if (wx.thunder && Math.sin(s * 0.8) > 0.985) {
      c.fillStyle = "rgba(255,255,255,0.4)";
      c.fillRect(0, 0, W, H);
    }
    if (wx.fog)
      for (let y = Math.round(H * 0.35); y < H; y++) {
        c.fillStyle = `rgba(220,228,236,${0.15 + 0.25 * Math.sin(((y - H * 0.35) / (H * 0.65)) * Math.PI)})`;
        c.fillRect(0, y, W, 1);
      }
  }

  RS_SCENE.register("overworld", { build, background, sky, land, frame });
})();
