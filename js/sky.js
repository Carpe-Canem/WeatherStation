// The pixel-art backyard behind the app: sky by time of day, clouds, sun or moon, hills and a tree,
// and whatever the weather is doing (rain, snow, wind-blown leaves, fog, frost, puddles).
// The hills, lawn and tree follow the time of year (seasons.js): dormant tan in winter, blossom and bright
// green in spring, deep green in summer, and in fall a patchwork of ochre and rust while the tree turns and
// drops its leaves into a pile on the lawn (the dogs dive into it: see dogs.js) and geese fly over.
// Weather draws over the season: snow and frost still cover everything.
// Drawn at a low resolution and scaled up with crisp pixels. Frame rate drops when nothing moves fast.
//
// Debug: ?season= and ?seasonat= (seasons.js); ?geese brings the geese over every 40 s or so.

import { seasonNow, yearly, ramp, mix } from './seasons.js';

export const W = 120;
/** Puddles on the lawn after rain: [x, width] in sky pixels (the dogs stomp in them). */
export const PUDDLES = [[18, 9], [62, 13], [96, 8]];
/** The fall leaf pile on the lawn: [x, width] in sky pixels, clear of the puddles. */
export const PILE = [79, 15];
const rand = seed => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const q = new URLSearchParams(location.search);
const SPEED = Math.max(0.1, +q.get('dogspeed') || 1);

const SKY = {
  day: ['#3f9fe6', '#bfe6f8'], dawn: ['#6f8fd0', '#f9c9a6'], dusk: ['#4a5aa4', '#f5a179'], night: ['#08122c', '#1d2b58'],
};
// The land is drawn in its daylight colours, then shaded toward these for the time of day.
const SHADE = { dawn: ['#6a7a90', 0.18], dusk: ['#3a3f60', 0.3], night: ['#0b1c22', 0.78] };
const shade = (c, ph) => (SHADE[ph] ? mix(c, SHADE[ph][0], SHADE[ph][1]) : c);

// Far hill, near hill, lawn, and how much fall patchwork shows, through the year (northern season days).
const LAND = yearly([
  [15, '#c2b48c', '#ad9c72', '#9c8c62', 0], // mid-winter: dormant tan
  [60, '#b8b083', '#a39a6c', '#94905c', 0],
  [85, '#a9c879', '#8fb95c', '#82ad4f', 0], // greening
  [110, '#b4dc72', '#93cc4f', '#86c244', 0], // spring: bright yellow-green
  [150, '#94cf6f', '#6fb84f', '#62ac44', 0],
  [190, '#6fb563', '#4c9a43', '#3f8a38', 0], // summer: deep green
  [240, '#78b062', '#559844', '#4a8a3a', 0],
  [268, '#8fae5a', '#6f9a42', '#64903c', 0.35],
  [295, '#c7a24c', '#a87a36', '#8f8a3e', 1], // fall: ochre and rust
  [320, '#b49a5e', '#9a7444', '#8a8248', 0.8],
  [342, '#bfae84', '#a99670', '#97895c', 0.15],
]);
// Fields and copses on the hills in fall, in runs along each hill.
const PATCH = ['#b0582c', '#d4a640', '#5f8a3a', '#c07a34'];
// The tree's leaves and how many of them are on it: bare in winter, blossom then light green in spring,
// full green in summer, then yellow, orange and red, thinning to bare by late November.
const TREE = yearly([
  [0, '#7a3a26', 0],
  [70, '#c9e29a', 0],
  [78, '#f6c6d6', 0.35],
  [90, '#f4b6cc', 0.85],
  [104, '#f8d4e0', 0.9],
  [116, '#a6d870', 0.9],
  [140, '#6fb84f', 1],
  [165, '#3f8a3c', 1],
  [245, '#3f8a3c', 1],
  [262, '#7a9a35', 1],
  [274, '#d9c23a', 1],
  [288, '#e0892f', 0.95],
  [302, '#c8402c', 0.8],
  [314, '#a8392a', 0.5],
  [324, '#8a3a26', 0.18],
  [330, '#7a3a26', 0.04],
  [334, '#7a3a26', 0],
]);
// The leaf pile, bright at first and browning as it ages.
const PILE_COLS = ['#d9b23a', '#e0892f', '#c8642c', '#b0452a', '#9a6a34'];

let cv, ctx, H = 200, ground = 180, k = null, raf = 0, last = 0, still = false, prevT = 0, busy = false;
const r = rand(7);
const stars = Array.from({ length: 40 }, () => [r(), r() * 0.55, r()]);
const clouds = Array.from({ length: 8 }, () => [r(), 0.06 + r() * 0.36, 0.6 + r() * 0.6]);
const drops = Array.from({ length: 90 }, () => [r(), r()]);
const leaves = Array.from({ length: 9 }, () => [r(), r(), r()]);
// Fall fields on each hill: runs of columns, each cut into bands that follow the slope, and each patch
// an index into PATCH, or -1 for the hill's own colour.
const fields = () => {
  const col = [], tab = [];
  while (col.length < W) {
    const n = 4 + Math.floor(r() * 8), band = 3 + Math.floor(r() * 3);
    tab.push({ band, p: Array.from({ length: 16 }, () => (r() < 0.4 ? -1 : Math.floor(r() * PATCH.length))) });
    for (let i = 0; i < n; i++) col.push(tab.length - 1);
  }
  return { col: col.slice(0, W), tab };
};
const fields1 = fields(), fields2 = fields();
/** One hill column from y0 down: plain, or in fall, banded into fields. */
function hillColumn(x, y0, f, cols, patchy) {
  if (!patchy) { ctx.fillStyle = cols[0]; ctx.fillRect(x, y0, 1, H); return; }
  const run = f.tab[f.col[x]];
  for (let j = 0, y = y0; y < H; j++, y += run.band) {
    ctx.fillStyle = cols[run.p[Math.min(j, 15)] + 1];
    ctx.fillRect(x, y, 1, j < 15 ? run.band : H);
  }
}
// The canopy, pixel by pixel (relative to the tree's spot), each leaf with its own timing: some turn
// and fall days before the others, so the colours mix.
const canopy = [];
{
  const on = new Set(), rect = (x, y, w, h) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) on.add(`${x + i},${y + j}`); };
  rect(-3, -16, 15, 10); rect(-1, -20, 11, 4); rect(-4, -10, 17, 5);
  ['-4,-6', '12,-6', '-1,-20', '9,-20', '-3,-16', '11,-16'].forEach(p => on.delete(p));
  for (const p of on) {
    const [x, y] = p.split(',').map(Number);
    canopy.push({ x, y, turn: (r() - 0.5) * 16, drop: r(), light: y < -15 && x < 5 ? 0.12 : y > -9 && x > 4 ? -0.14 : 0 });
  }
}
// Bare branches, seen once the leaves are gone.
const BRANCHES = [
  [4, -5], [4, -6], [4, -7], [4, -8], [5, -9], [5, -10], [5, -11], [4, -12], [4, -13], [4, -14], [5, -15], [5, -16],
  [3, -6], [2, -7], [1, -8], [0, -9], [-1, -10], [-2, -11], [-2, -12], [1, -10], [1, -11], [0, -12], [0, -13],
  [6, -6], [7, -7], [8, -8], [9, -9], [10, -10], [10, -11], [7, -10], [7, -11], [8, -12],
  [6, -13], [7, -14], [7, -15], [3, -15], [2, -16], [2, -17],
].map(([x, y]) => ({ x, y }));
let falling = [], nextDrop = 0, geese = null, nextGeese = null, scatteredAt = -Infinity;
const REGROW = 6 * 60e3; // ms for a scattered pile to build back up, at normal speed

function size() {
  const sc = innerWidth / W;
  H = Math.ceil(innerHeight / sc);
  cv.width = W;
  cv.height = H;
  const tabs = document.querySelector('.tabs');
  ground = Math.round((tabs ? tabs.getBoundingClientRect().top : innerHeight) / sc);
}

function cloud(x, y, s, c) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y + s, s * 6, s * 2);
  ctx.fillRect(x + s, y, s * 3, s);
  ctx.fillRect(x + s * 2, y - s * 0.6, s * 2, s);
}

/** The leaf pile's size now, 0 (none) to 1: it grows through the fall, is gone by mid-December, and
 *  builds back up after a dog scatters it. */
export function pileSize() {
  const day = seasonNow(k?.lat).day;
  const season = ramp(day, 270, 325) * (1 - ramp(day, 338, 352));
  return season * ramp((performance.now() - scatteredAt) * SPEED, 0, REGROW);
}
/** A dog has dived in: the pile is gone, and starts building back up. */
export function scatterPile() {
  scatteredAt = performance.now();
  if (k) draw(performance.now() / 1000);
}
/** Colours for leaves thrown up from the pile. */
export function pileColours() {
  const brown = ramp(seasonNow(k?.lat).day, 312, 338);
  return PILE_COLS.map(c => mix(c, '#7a5a36', brown * 0.6));
}

function draw(t) {
  if (!k) return;
  const dt = Math.min(0.5, Math.max(0, t - prevT));
  prevT = t;
  const ph = k.phase, night = ph === 'night';
  const { day } = seasonNow(k.lat);
  const sunHigh = Math.cos((2 * Math.PI * (day - 172)) / 365); // 1 at midsummer, -1 at midwinter
  const over = Math.max(0, (k.cloud - 0.5) * 1.6);
  const [top, hor] = SKY[ph];
  const grey = night ? ['#141a2a', '#283044'] : ['#7f93a6', '#c9d3db'];
  const horizon = ground - 30;

  // Sky in stepped bands, greyed toward overcast.
  const bands = 12;
  for (let i = 0; i < bands; i++) {
    const f = i / (bands - 1);
    ctx.fillStyle = mix(mix(top, hor, f), mix(grey[0], grey[1], f), Math.min(1, over));
    const y0 = Math.floor((horizon * i) / bands), y1 = Math.floor((horizon * (i + 1)) / bands);
    ctx.fillRect(0, y0, W, y1 - y0 + 1);
  }
  ctx.fillStyle = mix(hor, grey[1], Math.min(1, over));
  ctx.fillRect(0, horizon, W, H - horizon);

  if (night && over < 0.8) {
    for (const [x, y, tw] of stars) {
      ctx.fillStyle = (Math.sin(t * 1.5 + tw * 20) > 0.6) ? '#fff6c8' : '#9aa6d8';
      ctx.fillRect(Math.floor(x * W), Math.floor(y * horizon), 1, 1);
    }
  }
  // Sun or moon, hidden behind thick cloud. The sun rides lower in winter, the moon higher.
  if (over < 0.7) {
    const pos = { day: [0.8, 0.24 - 0.11 * sunHigh], dawn: [0.16, 0.62 - 0.05 * sunHigh], dusk: [0.84, 0.64 - 0.05 * sunHigh], night: [0.8, 0.2 + 0.06 * sunHigh] }[ph];
    const x = Math.floor(pos[0] * W), y = Math.floor(pos[1] * horizon);
    if (night) {
      ctx.fillStyle = '#f4ecc2';
      ['..XXX...', '.XX.....', 'XX......', 'XX......', 'XX......', 'XX......', '.XX.....', '..XXX...']
        .forEach((row, j) => [...row].forEach((ch, i) => ch === 'X' && ctx.fillRect(x + i, y + j, 1, 1)));
    } else {
      const c = ph === 'day' ? '#ffd65c' : '#ffb067';
      ctx.fillStyle = mix(c, '#ffffff', 0.2); ctx.fillRect(x - 2, y + 1, 12, 6); ctx.fillRect(x + 1, y - 2, 6, 12);
      ctx.fillStyle = c; ctx.fillRect(x, y, 8, 8);
    }
  }
  drawGeese(t, day, horizon, ph);
  // Clouds drift with the wind.
  const n = Math.round(2 + k.cloud * 6), speed = 0.6 + k.wind * 0.18;
  const cc = night ? (k.raining ? '#2b334a' : '#26335e') : k.raining ? '#9ba7b4' : ph === 'day' ? '#ffffff' : '#f7d6c6';
  for (let i = 0; i < n; i++) {
    const [x0, y, s] = clouds[i];
    const x = (((x0 * (W + 50) + t * speed * s) % (W + 50)) + W + 50) % (W + 50) - 30;
    cloud(Math.floor(x), Math.floor(y * horizon), Math.max(2, Math.round(s * 3 + k.cloud * 1.5)), cc);
  }

  // Hills, a tree, and the lawn the dogs walk on, in the season's colours.
  // Frost whitens the land a little; falling snow covers it.
  const cover = k.snowing ? 0.78 : k.frost ? 0.55 : 0, white = k.snowing ? '#f2f6fb' : '#e8f1f6';
  const land = c => { c = shade(c, ph); return cover ? mix(c, white, cover) : c; };
  const [d1, d2, dg, patchy] = LAND(day);
  const hill = base => [-1, ...PATCH.keys()].map(p => land(p < 0 || !patchy ? base : mix(base, PATCH[p], patchy * 0.65)));
  const c1 = hill(d1), c2 = hill(d2), grass = land(dg);
  for (let x = 0; x < W; x++) {
    const a = Math.round(10 + 5 * Math.sin(x / 13 + 1) + 3 * Math.sin(x / 5));
    const b = Math.round(5 + 4 * Math.sin(x / 9 + 3) + 2 * Math.sin(x / 4));
    hillColumn(x, horizon + 18 - a, fields1, c1, patchy);
    hillColumn(x, horizon + 26 - b, fields2, c2, patchy);
  }
  const sway = k.windy ? Math.round(Math.sin(t * 6)) : 0;
  const tx = 14, ty = horizon + 12;
  const bark = night ? '#2a1d14' : '#6b4a2b';
  ctx.fillStyle = bark; ctx.fillRect(tx + 3, ty - 4, 3, 16);
  const [, density] = TREE(day);
  for (const p of BRANCHES) {
    const x = tx + p.x + (p.y < -8 ? sway : 0), y = ty + p.y;
    ctx.fillStyle = bark; ctx.fillRect(x, y, 1, 1);
    if (k.snowing && density < 0.5) { ctx.fillStyle = land('#ffffff'); ctx.fillRect(x, y - 1, 1, 1); }
  }
  const leafCol = p => {
    const c = TREE(day + p.turn)[0];
    return land(p.light ? mix(c, p.light > 0 ? '#ffffff' : '#000000', Math.abs(p.light)) : c);
  };
  for (const p of canopy) {
    if (p.drop >= density) continue;
    ctx.fillStyle = leafCol(p);
    ctx.fillRect(tx + p.x + sway, ty + p.y, 1, 1);
  }
  ctx.fillStyle = grass; ctx.fillRect(0, ground, W, H - ground);
  ctx.fillStyle = mix(grass, '#ffffff', 0.18);
  for (let x = (Math.floor(t) % 2); x < W; x += 4) ctx.fillRect(x, ground, 1, 1);

  drawPile(land);
  // Fall: leaves let go of the tree and drift down, wind or no wind, in the tree's own colours.
  const dropRate = density * ramp(day, 258, 290);
  if (!still && dropRate > 0.03 && !k.snowing && t > nextDrop && falling.length < 6) {
    nextDrop = t + (1.5 + Math.random() * 3) / Math.max(0.3, dropRate);
    const on = canopy.filter(p => p.drop < density);
    const p = on[Math.floor(Math.random() * on.length)];
    if (p) falling.push({ x: tx + p.x + sway, y: ty + p.y, c: leafCol(p), ph: Math.random() * 9, vy: 3 + Math.random() * 2, land: ground - 1 - Math.floor(Math.random() * 6), rest: 0 });
  }
  const drift = k.windy ? 6 + k.gust * 0.3 : 0.8;
  for (const L of falling) {
    if (L.rest) { L.rest -= dt; } else {
      L.y += L.vy * dt; L.x += drift * dt;
      if (L.y >= L.land) { L.y = L.land; L.rest = 5 + Math.random() * 4; }
    }
    const x = Math.round(L.x + (L.rest ? 0 : Math.sin(t * 2.2 + L.ph) * 1.5)), flat = L.rest || Math.sin(t * 5 + L.ph) > 0;
    ctx.fillStyle = L.c; ctx.fillRect(x, Math.round(L.y), flat ? 2 : 1, 1);
  }
  falling = falling.filter(L => !(L.rest < 0) && L.x < W + 2);

  if (k.puddles) {
    ctx.fillStyle = night ? '#2c4a7a' : '#7fb3e0';
    PUDDLES.forEach(([x, w]) => { ctx.fillRect(x, ground - 1, w, 1); ctx.fillRect(x + 1, ground - 2, w - 2, 1); });
  }
  if (k.fog) {
    ctx.fillStyle = night ? 'rgba(160,170,200,0.18)' : 'rgba(255,255,255,0.32)';
    for (let i = 0; i < 4; i++) ctx.fillRect(0, horizon - 6 + i * 7 + Math.round(Math.sin(t / 3 + i) * 2), W, 4);
  }
  // Precipitation, slanted by the wind.
  if (k.raining) {
    const cnt = Math.round(30 + Math.min(1, k.rainRate * 3) * 60), slant = Math.min(2, k.wind / 10);
    ctx.fillStyle = k.snowing ? '#ffffff' : night ? '#8fb0e8' : '#5f8fc8';
    for (let i = 0; i < cnt; i++) {
      const [x0, y0] = drops[i];
      if (k.snowing) {
        const y = (y0 * H + t * 9) % H, x = (x0 * W + Math.sin(t + i) * 2 + t * slant * 3) % W;
        ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
      } else {
        const y = (y0 * H + t * 70) % H, x = (x0 * W + y * slant * 0.3) % W;
        ctx.fillRect(Math.floor(x), Math.floor(y), 1, 3);
      }
    }
  }
  if (k.windy && !k.snowing) {
    for (const [x0, y0, c] of leaves) {
      const x = (x0 * (W + 20) + t * (14 + k.gust * 0.6)) % (W + 20) - 10;
      const y = ground - 4 - y0 * 30 + Math.sin(t * 4 + c * 9) * 3;
      ctx.fillStyle = c > 0.5 ? '#e0892f' : '#d4b13a';
      ctx.fillRect(Math.floor(x), Math.floor(y), 2, 1);
    }
  }
  busy = falling.length > 0 || !!geese;
}

// The leaf pile: a mound of mixed leaves, its pixels fixed so it doesn't shimmer.
function drawPile(land) {
  const s = pileSize();
  if (s < 0.08) return;
  const [x0, w0] = PILE, w = Math.max(4, Math.round(w0 * (0.55 + 0.45 * s))), h = Math.max(1, Math.round(6 * s));
  const cols = pileColours().map(land), left = Math.round(x0 + (w0 - w) / 2);
  for (let i = 0; i < w; i++) {
    const rel = ((i + 0.5) / w) * 2 - 1, colH = Math.max(1, Math.round(h * Math.sqrt(1 - rel * rel)));
    for (let j = 0; j < colH; j++) {
      const hsh = ((left + i) * 73856093) ^ (j * 19349663);
      ctx.fillStyle = cols[Math.abs(hsh) % cols.length];
      ctx.fillRect(left + i, ground - 1 - j, 1, 1);
    }
  }
}

// October and November days: now and then a V of geese crosses the sky, heading south (right to left).
const GOOSE = [['x.x', '.x.'], ['...', 'xxx']]; // wings up, wings level
function drawGeese(t, day, horizon, ph) {
  const season = day >= 273 && day < 334 && ph !== 'night' && !k.raining && !still;
  if (nextGeese == null) nextGeese = t + (q.has('geese') ? 3 : 30 + Math.random() * 120);
  if (!geese && season && t > nextGeese) {
    geese = { t0: t, y: Math.round((0.14 + Math.random() * 0.24) * horizon), n: 5 + 2 * Math.floor(Math.random() * 2) };
    nextGeese = t + (q.has('geese') ? 40 : 240 + Math.random() * 360);
  }
  if (!geese) return;
  const g = geese, lead = W + 4 - (t - g.t0) * 7;
  ctx.fillStyle = ph === 'day' ? '#2e3440' : '#3a3550';
  for (let i = 0; i < g.n; i++) {
    const rank = Math.ceil(i / 2), side = i % 2 ? -1 : 1;
    const x = Math.round(lead + rank * 4), y = Math.round(g.y + side * rank * 2.5 + Math.sin(t * 1.5 + i) * 0.6);
    GOOSE[Math.floor(t * 3 + i * 0.7) % 2].forEach((row, j) => [...row].forEach((ch, c) => ch === 'x' && ctx.fillRect(x + c - 1, y + j, 1, 1)));
  }
  if (lead + g.n * 2 + 6 < -4) geese = null;
}

function loop(now) {
  const fast = k && (k.raining || k.windy || k.fog || busy);
  if (now - last >= (fast ? 83 : 250)) {
    last = now;
    draw(now / 1000);
  }
  raf = requestAnimationFrame(loop);
}

export function initSky() {
  cv = document.getElementById('sky');
  ctx = cv.getContext('2d');
  still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  size();
  addEventListener('resize', () => { size(); draw(performance.now() / 1000); });
  if (q.has('dogspeed')) window.__sky = { draw: secs => draw(secs ?? performance.now() / 1000), geese: () => { nextGeese = 0; } };
}

/** New conditions from the weather; starts the animation the first time. */
export function setSky(next) {
  k = next;
  size();
  draw(performance.now() / 1000);
  if (!still && !raf) raf = requestAnimationFrame(loop);
}
