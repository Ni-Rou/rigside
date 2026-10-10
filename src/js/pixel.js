"use strict";

/* Drawing helpers the scenes share.
   Buf: an ImageData you draw into pixel by pixel (quick for whole layers), then put() onto a canvas.
   ramp(): picks from a list of colours by a 0..1 value, dithered (4x4 Bayer) where they meet, so a
   gradient turns into tidy pixel-art bands rather than a blur.
   sprite(): draws a sprite written as strings, one character per pixel, with a palette.
   Further down there's the atmosphere stuff: mist, glows, smoke, light shafts, specks and so on. */
const RS_PX = (() => {
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // Solid bands of each colour, only dithered in a thin strip where one meets the next (`soft`, as a
  // fraction of the step). That's how you'd do it by hand.
  function ramp(cols, v, x, y, soft = 0.3) {
    const n = cols.length - 1,
      f = Math.max(0, Math.min(1, v)) * n,
      i = Math.floor(f),
      frac = f - i;
    const lo = 0.5 - soft / 2,
      t = (frac - lo) / soft;
    return cols[Math.min(n, t >= 1 ? i + 1 : t <= 0 ? i : t > bayer(x, y) ? i + 1 : i)];
  }

  class Buf {
    constructor(g, W, H) {
      this.W = W;
      this.H = H;
      this.img = g.createImageData(W, H);
      this.d = this.img.data;
    }
    px(x, y, c, a = 1) {
      x |= 0;
      y |= 0;
      if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
      const i = (y * this.W + x) * 4,
        d = this.d;
      if (a >= 1 || d[i + 3] === 0) {
        d[i] = c[0];
        d[i + 1] = c[1];
        d[i + 2] = c[2];
        d[i + 3] = Math.round(255 * Math.min(1, a));
        return;
      }
      d[i] += (c[0] - d[i]) * a;
      d[i + 1] += (c[1] - d[i + 1]) * a;
      d[i + 2] += (c[2] - d[i + 2]) * a;
    }
    get(x, y) {
      x = Math.max(0, Math.min(this.W - 1, x | 0));
      y = Math.max(0, Math.min(this.H - 1, y | 0));
      const i = (y * this.W + x) * 4;
      return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
    }
    rect(x, y, w, h, c, a = 1) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c, a);
    }
    put(g) {
      g.putImageData(this.img, 0, 0);
    }
  }

  function sprite(g, rows, x, y, pal, flip = false) {
    x = Math.round(x);
    y = Math.round(y);
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[flip ? row.length - 1 - i : i];
        if (ch !== "." && ch !== " " && pal[ch]) {
          g.fillStyle = pal[ch];
          g.fillRect(x + i, y + j, 1, 1);
        }
      }
    }
  }
  const css = (c, a = 1) =>
    a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  // Blend two palettes (lists of colours) by t, e.g. a night sky ramp into a day one.
  const blendRamp = (a, b, t) => a.map((c, i) => mix(c, b[Math.min(i, b.length - 1)], t));

  const H_ = (a) => a.map(hex);
  // A stable pseudo-random 0..1 for a pair of numbers (texture, scatter), the same every frame.
  const hash = (a, b) => {
    const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const smooth = (t) => t * t * (3 - 2 * t);

  // Sky ramp from palettes {day, night, warm, grey} (each a list of hex colours, top -> horizon).
  function skyRamp(e, P) {
    let r = blendRamp(P.night, P.day, smooth(e.day));
    if (e.glow > 0 && P.warm) r = blendRamp(r, P.warm, e.glow * 0.85);
    if (e.wx.grey > 0.35 && P.grey) r = blendRamp(r, e.night ? P.night : P.grey, clamp01((e.wx.grey - 0.3) * 1.3));
    return r;
  }

  // Tints everything that isn't a light: bluer and darker at night, warmer at sunrise and sunset.
  // strength 0..1 is for places that should change less (indoors, or a city full of neon).
  function toner(e, strength = 1) {
    const n = clamp01((0.55 - e.day) / 0.45) * strength,
      warm = e.glow * strength,
      grey = e.night ? 0 : e.wx.grey * 0.3 * strength;
    return (c) => {
      let [r, g, b] = typeof c === "string" ? hex(c) : c;
      if (warm) {
        r += (255 - r) * 0.14 * warm;
        g += (170 - g) * 0.05 * warm;
        b *= 1 - 0.2 * warm;
      }
      if (grey) {
        const l = (r + g + b) / 3;
        r += (l - r) * grey;
        g += (l - g) * grey;
        b += (l - b) * grey;
      }
      return [r * (1 - 0.74 * n), g * (1 - 0.64 * n), b * (1 - 0.4 * n) + 14 * n];
    };
  }

  // A 1D ridge line: smooth value noise in octaves, W samples, 0..1. Wraps if `wrap` is set.
  function ridge(
    r,
    W,
    octaves = [
      [60, 1],
      [24, 0.45],
      [9, 0.18],
    ],
    wrap = false,
  ) {
    const out = new Float32Array(W);
    for (const [len, amp] of octaves) {
      const n = Math.ceil(W / len) + 2,
        pts = Array.from({ length: n }, () => r());
      if (wrap) ((pts[n - 1] = pts[0]), (pts[n - 2] = pts[0]));
      for (let x = 0; x < W; x++) {
        const f = x / len,
          i = Math.floor(f),
          t = smooth(f - i);
        out[x] += (pts[i] + (pts[i + 1] - pts[i]) * t) * amp;
      }
    }
    let lo = Infinity,
      hi = -Infinity;
    for (const v of out) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    for (let x = 0; x < W; x++) out[x] = (out[x] - lo) / (hi - lo || 1);
    return out;
  }

  // An offscreen canvas drawn once (pixels via a Buf, or plain canvas calls), for sprites and strips.
  function canvas(w, h, draw) {
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, w | 0);
    cv.height = Math.max(1, h | 0);
    const g = cv.getContext("2d"),
      b = new Buf(g, cv.width, cv.height);
    draw(b, g);
    b.put(g);
    return cv;
  }

  // A dithered round glow for lamps, screens and so on. Fine to draw every frame up to a radius of
  // about 12; past that, bake it once with glowSprite().
  function glow(c, x, y, R, col, k = 0.6, alpha = 0.35) {
    c.fillStyle = css(col, alpha);
    for (let yy = -R; yy <= R; yy++)
      for (let xx = -R; xx <= R; xx++) {
        const d = Math.sqrt(xx * xx + yy * yy) / R;
        if (d < 1 && (1 - d) * k > bayer(x + xx, y + yy)) c.fillRect(x + xx, y + yy, 1, 1);
      }
  }
  function glowSprite(R, col, k = 0.6, alpha = 0.35) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = R * 2 + 1;
    glow(cv.getContext("2d"), R, R, R, col, k, alpha);
    return cv;
  }

  // 3x5 pixel font for signs, screens and labels.
  const FONT = {
    A: "010101111101101",
    B: "110101110101110",
    C: "011100100100011",
    D: "110101101101110",
    E: "111100110100111",
    F: "111100110100100",
    G: "011100101101011",
    H: "101101111101101",
    I: "111010010010111",
    J: "001001001101010",
    K: "101101110101101",
    L: "100100100100111",
    M: "101111111101101",
    N: "110101101101101",
    O: "010101101101010",
    P: "110101110100100",
    Q: "010101101110011",
    R: "110101110101101",
    S: "011100010001110",
    T: "111010010010010",
    U: "101101101101111",
    V: "101101101101010",
    W: "101101111111101",
    X: "101101010101101",
    Y: "101101010010010",
    Z: "111001010100111",
    0: "111101101101111",
    1: "010110010010111",
    2: "110001010100111",
    3: "110001010001110",
    4: "101101111001001",
    5: "111100110001110",
    6: "011100110101010",
    7: "111001010010010",
    8: "010101010101010",
    9: "010101011001110",
    " ": "000000000000000",
    "!": "010010010000010",
    "-": "000000111000000",
    ".": "000000000000010",
    ":": "000010000010000",
    "/": "001001010100100",
  };
  function text(c, s, x, y, col, scale = 1) {
    c.fillStyle = col;
    for (const ch of String(s).toUpperCase()) {
      const f = FONT[ch] || FONT[" "];
      for (let i = 0; i < 15; i++)
        if (f[i] === "1") c.fillRect(x + (i % 3) * scale, y + Math.floor(i / 3) * scale, scale, scale);
      x += 4 * scale;
    }
  }

  // Shade a colour: f < 0 darker (towards a cool shadow), f > 0 lighter (towards a warm highlight).
  const shade = (c, f) =>
    f < 0 ? mix(c, [c[0] * 0.25, c[1] * 0.3, c[2] * 0.45 + 10], -f) : mix(c, [255, 250, 235], f);

  // A band of drifting mist h tall that tiles across W (draw it at x and x + W to scroll it).
  // Thickest along the middle; dens 0..1 is how much of the band is filled.
  function mist(W, h, col, dens = 0.7, alpha = 0.45, seed = 1) {
    return canvas(W, h, (b) => {
      for (let y = 0; y < h; y++) {
        const edge = Math.sin((Math.PI * (y + 0.5)) / h);
        for (let x = 0; x < W; x++) {
          const u = (x / W) * Math.PI * 2,
            v =
              0.5 +
              0.22 * Math.sin(u * 2 + seed + y * 0.21) +
              0.18 * Math.sin(u * 5 + seed * 2.3 - y * 0.13) +
              0.1 * Math.sin(u * 11 + seed * 4.1);
          if (bayer(x, y) < v * edge * dens) b.px(x, y, col, alpha);
        }
      }
    });
  }

  // A soft round glow (a radial gradient, not dithered): light hanging in haze or water.
  function softGlow(R, col, a = 0.3) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = R * 2 + 1;
    const g = cv.getContext("2d"),
      gr = g.createRadialGradient(R, R, 0, R, R, R);
    gr.addColorStop(0, css(col, a));
    gr.addColorStop(0.5, css(col, a * 0.4));
    gr.addColorStop(1, css(col, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, cv.width, cv.height);
    return cv;
  }

  // Dithered puffs of radius 1..n for smoke().
  function puffs(col, n = 10, a = 0.85) {
    return Array.from({ length: n }, (_, i) => {
      const r = i + 1;
      return canvas(r * 2 + 1, r * 2 + 1, (b) => {
        for (let y = -r; y <= r; y++)
          for (let x = -r; x <= r; x++) {
            const d = Math.sqrt(x * x + y * y) / r;
            if (d <= 1 && bayer(x, y) < 1.15 - d) b.px(x + r, y + r, col, a);
          }
      });
    });
  }

  // A column of smoke rising from (x, y): puffs grow as they climb `h` and drift `lean` sideways.
  function smoke(c, P, x, y, s, { n = 14, h = 60, lean = 20, speed = 0.04, alpha = 0.6 } = {}) {
    for (let i = 0; i < n; i++) {
      const t = (s * speed + i / n) % 1,
        r = Math.min(P.length, 1 + Math.floor(t * P.length));
      c.globalAlpha = (1 - t) * alpha;
      c.drawImage(
        P[r - 1],
        Math.round(x + t * t * lean + Math.sin(s * 0.6 + i * 1.7) * 1.5 - r),
        Math.round(y - t * h - r),
      );
    }
    c.globalAlpha = 1;
  }

  // Shafts of light into a Buf: n dithered beams fanning out from (x, y) around angle `an`
  // (radians: 0 = right, PI / 2 = down), fading along their length.
  function rays(
    b,
    x,
    y,
    an,
    { n = 5, len = 100, spread = 0.2, width = 0.05, col = [255, 250, 220], k = 0.3, a = 0.22 } = {},
  ) {
    for (let i = 0; i < n; i++) {
      const a0 = an + (i - (n - 1) / 2) * spread + Math.sin(i * 3.7) * spread * 0.25,
        ca = Math.cos(a0),
        sa = Math.sin(a0);
      for (let t = 4; t < len; t++) {
        const hw = 0.5 + t * width,
          cx = x + ca * t,
          cy = y + sa * t;
        for (let j = -hw; j <= hw; j++) {
          const px = Math.round(cx - sa * j),
            py = Math.round(cy + ca * j);
          if (bayer(px, py) < k * (1 - t / len)) b.px(px, py, col, a);
        }
      }
    }
  }

  // Specks drifting through an area: dust, pollen, spores, embers, snow in a beam, fireflies.
  // list holds [rx, ry, p] randoms (fixed per world); vx/vy are pixels a second, wob a sideways sway,
  // blink > 0 makes them glow on and off (fireflies), glow is an optional sprite drawn under each.
  function motes(
    c,
    list,
    s,
    area,
    { col = "#ffffff", vx = 0, vy = -3, wob = 2, blink = 0, glow = null, size = 1 } = {},
  ) {
    const [ax, ay, aw, ah] = area;
    c.fillStyle = col;
    for (const [rx, ry, p] of list) {
      if (blink && Math.sin(s * blink * (0.6 + p) + rx * 30) < 0.2) continue;
      const x = Math.round(
          ax + ((((rx * aw + s * vx * (0.5 + p)) % aw) + aw) % aw) + Math.sin(s * (1 + p) + rx * 20) * wob,
        ),
        y = Math.round(ay + ((((ry * ah + s * vy * (0.5 + p)) % ah) + ah) % ah));
      if (glow) c.drawImage(glow, x - (glow.width >> 1), y - (glow.height >> 1));
      c.fillRect(x, y, size, size);
    }
  }

  // A shooting star every `per` seconds or so, somewhere across the top of the sky.
  function shootingStar(c, W, H, s, per = 23, col = [230, 240, 255]) {
    const t = s % per,
      n = Math.floor(s / per);
    if (t >= 0.7) return;
    const x0 = W * (0.15 + hash(n, 1) * 0.6),
      y0 = H * (0.04 + hash(n, 2) * 0.2),
      dir = hash(n, 3) < 0.5 ? 1 : -1;
    for (let k = 0; k < 10; k++) {
      c.fillStyle = css(col, (1 - k / 10) * (1 - t / 0.7));
      c.fillRect(Math.round(x0 + dir * (t * 90 - k * 2)), Math.round(y0 + t * 30 - k * 0.7), 1, 1);
    }
  }

  // Aurora curtains, baked once as a strip W x h; draw with aurora() so they ripple.
  function auroraStrip(W, h, cols, seed = 1) {
    return canvas(W, h, (b) => {
      for (let x = 0; x < W; x++) {
        const u = (x / W) * Math.PI * 2,
          bright = 0.5 + 0.3 * Math.sin(u * 3 + seed) + 0.2 * Math.sin(u * 7 + seed * 2),
          len = h * (0.55 + 0.35 * Math.sin(u * 2 + seed * 3)),
          col = cols[Math.floor((0.5 + 0.5 * Math.sin(u * 4 + seed)) * (cols.length - 0.01))];
        for (let y = 0; y < len; y++) {
          const k = (1 - y / len) * bright * (y < 2 ? 0.6 : 1);
          if (bayer(x, y) < k) b.px(x, y, col, 0.55);
        }
      }
    });
  }
  // Draw an aurora strip at y, in 4 px slices that wave up and down, shimmering.
  function aurora(c, strip, y, s, alpha = 0.8) {
    c.globalAlpha = alpha * (0.75 + 0.25 * Math.sin(s * 0.5));
    for (let x = 0; x < strip.width; x += 4) {
      const dy = Math.round(Math.sin(x * 0.03 + s * 0.35) * 5 + Math.sin(x * 0.011 - s * 0.2) * 4);
      c.drawImage(strip, x, 0, 4, strip.height, x, y + dy, 4, strip.height);
    }
    c.globalAlpha = 1;
  }

  // Darker corners, baked once per size: draw the result over the frame.
  function vignette(W, H, col = [8, 10, 8], strength = 0.55) {
    return canvas(W, H, (b) => {
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const dx = (x / W - 0.5) * 2,
            dy = (y / H - 0.5) * 2,
            d = Math.sqrt(dx * dx * 0.8 + dy * dy);
          if (d > 0.6) b.px(x, y, col, Math.min(strength, ((d - 0.6) / 0.8) ** 1.5 * strength));
        }
    });
  }

  return {
    Buf,
    ramp,
    bayer,
    hash,
    hex,
    H_,
    mix,
    sprite,
    css,
    blendRamp,
    skyRamp,
    toner,
    ridge,
    canvas,
    mist,
    softGlow,
    puffs,
    smoke,
    rays,
    motes,
    shootingStar,
    vignette,
    auroraStrip,
    aurora,
    glow,
    glowSprite,
    text,
    shade,
    smooth,
    clamp01,
  };
})();
