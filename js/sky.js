// The pixel-art backyard behind the app: sky by time of day, clouds, sun or moon, hills and a tree,
// and whatever the weather is doing (rain, snow, wind-blown leaves, fog, frost, puddles).
// The hills, lawn and tree follow the time of year (seasons.js): dormant tan in winter, blossom and bright
// green in spring, deep green in summer, and in fall a patchwork of ochre and rust while the tree turns and
// drops its leaves into a pile on the lawn (the dogs dive into it: see dogs.js) and geese fly over.
// Weather draws over the season: snow and frost still cover everything. In winter there are more stars
// and smoke rises from the chimney of the little house on the far hill. After a snowfall the snow lies
// for days, melting away in patches, with a snowman on the lawn; puddles freeze on icy days after rain
// (conditions.js keeps track of both: k.snowLying, k.snowman, k.ice).
// In spring the blossom comes off the tree in drifting petals, wildflowers come up in the lawn, then
// dandelions, which go to seed (the dogs blow the puffs apart: see dogs.js), and robins drop in to hop
// about the lawn. After rain, while the sun's out, a rainbow stands over the hills (k.rainbow).
// In summer butterflies flutter over the lawn (Ziggy snaps at them: see dogs.js), sunflowers come up along
// it in mid to late summer, and dragonflies dart over the puddles after rain. In a dry spell the lawn
// browns in patches (k.drought), heat shimmers over the hills on hot afternoons, and when a storm is
// building (the pressure falling) thunderheads tower on the horizon.
// Drawn at a low resolution and scaled up with crisp pixels. Frame rate drops when nothing moves fast.
//
// Debug: ?season= and ?seasonat= (seasons.js); ?geese brings the geese over every 40 s or so, and
// ?robins the robins (in spring); ?snowlying=0..1, ?ice and ?rainbow (conditions.js), or the Settings
// previews "After snow", "Icy puddles" and "Rainbow". ?season=spring&seasonat=0.6 has the most puffs.
// Summer: ?butterflies brings them every few seconds; ?heatshimmer and ?thunderheads force those on;
// ?drought=0..1 (conditions.js) or the Settings preview "Dry spell" browns the lawn; the previews "Hot",
// "Storm coming" and "After rain" show the shimmer, the thunderheads and the dragonflies.

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
// The tree is drawn TREE_SCALE times its original design, grown from the same root (column 4, row 12 of
// the design, relative to the tree's spot), so its crown fills more of the sky above the hills.
// Pixels stay one sky pixel each: the outline is scaled up, the leaves and branches are not.
const TREE_SCALE = 1.5;
const treeUp = (v, o) => o + Math.round((v - o) * TREE_SCALE);
const treeDown = (v, o) => Math.floor(o + (v + 0.5 - o) / TREE_SCALE);
// The canopy, pixel by pixel (relative to the tree's spot), each leaf with its own timing: some turn
// and fall days before the others, so the colours mix.
const canopy = [];
{
  const on = new Set(), rect = (x, y, w, h) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) on.add(`${x + i},${y + j}`); };
  rect(-3, -16, 15, 10); rect(-1, -20, 11, 4); rect(-4, -10, 17, 5);
  ['-4,-6', '12,-6', '-1,-20', '9,-20', '-3,-16', '11,-16'].forEach(p => on.delete(p));
  for (let Y = treeUp(-21, 12); Y <= treeUp(-4, 12); Y++) {
    for (let X = treeUp(-5, 4); X <= treeUp(14, 4); X++) {
      const x = treeDown(X, 4), y = treeDown(Y, 12); // the design pixel this one comes from
      if (on.has(`${x},${y}`)) canopy.push({ x: X, y: Y, turn: (r() - 0.5) * 16, drop: r(), light: y < -15 && x < 5 ? 0.12 : y > -9 && x > 4 ? -0.14 : 0 });
    }
  }
}
// Bare branches, seen once the leaves are gone: lines through the design's points, scaled up.
const BRANCHES = [];
{
  const seen = new Set();
  const line = (x0, y0, x1, y1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / (n || 1)), y = Math.round(y0 + ((y1 - y0) * i) / (n || 1));
      if (!seen.has(`${x},${y}`)) { seen.add(`${x},${y}`); BRANCHES.push({ x, y, sway: treeDown(y, 12) < -8 }); }
    }
  };
  [
    [[4, -5], [4, -8], [5, -9], [5, -11], [4, -12], [4, -14], [5, -15], [5, -16]],
    [[3, -6], [-1, -10], [-2, -11], [-2, -12]],
    [[0, -9], [1, -10], [1, -11], [0, -12], [0, -13]],
    [[6, -6], [10, -10], [10, -11]],
    [[8, -8], [7, -10], [7, -11], [8, -12]],
    [[5, -12], [6, -13], [7, -14], [7, -15]],
    [[4, -14], [3, -15], [2, -16], [2, -17]],
  ].forEach(pts => pts.slice(1).forEach(([x, y], i) => line(treeUp(pts[i][0], 4), treeUp(pts[i][1], 12), treeUp(x, 4), treeUp(y, 12))));
}
// ---------- winter ----------
// (Their own random numbers, so the clouds, fields and canopy above stay as they were.)
const r2 = rand(1013);
const winterStars = Array.from({ length: 50 }, () => [r2(), r2() * 0.7, r2()]);
/** How wintry the season day is, 0 to 1: in through late November and December, out by mid-March. */
const wintry = day => Math.max(ramp(day, 318, 345), 1 - ramp(day, 50, 75));
/** A fixed 0-1 value per pixel, in blobs: where lying snow melts first (low) and last (high). */
const hash = (x, y) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** Smooth noise: hash values on a grid, blended between corners. */
const smooth = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
};
const meltAt = (x, y) => 0.6 * smooth(x / 7, y / 3.5) + 0.3 * smooth(x / 3 + 50, y / 2 + 50) + 0.1 * hash(x, y + 5003);
const SNOW = '#f2f6fb';
/** Where the lawn browns first in a dry spell (low) and last (high): speckled blobs, like dried-out turf. */
const dryAt = (x, y) => 0.6 * smooth(x / 6 + 211, y / 2.5 + 7) + 0.4 * hash(x + 7001, y);
// The house on the far hill, sitting on its flat top at columns 72-78. Roof 'r' takes the snow; 'y' is
// the window, lit at night.
const HOUSE = ['.....c.', '..rrrc.', '.rrrrr.', 'rrrrrrr', '.wwwww.', '.wywdw.', '.wwwdw.'];
const HOUSE_X = 72, HOUSE_COLS = { c: '#6e5a50', r: '#8e3b2e', w: '#d9c8a8', d: '#6b4a2b', y: '#8aa2b8' };
// The snowman, on the lawn between the tree's side and the first-but-one puddle (columns 41-51).
// Rows 0-6 head and hat, 7-11 middle, 12-16 base; as the snow melts he slumps, then sinks to a lump.
const SNOWMAN = [
  '....kkk....',
  '....kkk....',
  '...kkkkk...',
  '....www....',
  '...wkwks...',
  '...wwwoo...',
  '....wss....',
  '...rrrrrr..',
  '.b.wwwwsr.b',
  '..bwwkwssb.',
  '...wwwwss..',
  '....wwss...',
  '..wwwwwwss.',
  '.wwwwkwwwss',
  '.wwwwwwwwss',
  '.wwwwkwwwss',
  '..wwwwwwss.',
];
const SNOWMAN_X = 41, SNOWMAN_COLS = { w: '#f4f7fb', s: '#c9d6e6', k: '#2a2a33', o: '#f08a24', r: '#d23b3b', b: '#6b4a2b' };

// ---------- spring ----------
// (Laid out with hash(), and anything at random uses Math.random(): nothing here draws from r().)
/** How much blossom is coming off the tree, 0 to 1: late March to mid-April. */
const petalling = day => ramp(day, 84, 92) * (1 - ramp(day, 108, 118));
const PETAL_COLS = ['#f8d0de', '#f4b6cc', '#fbe6ee'];
/** How many wildflowers are out, 0 to 1: from early April into July. */
const blooming = day => ramp(day, 84, 104) * (1 - ramp(day, 168, 196));
const FLOWER_COLS = ['#f4f0e8', '#f2d23c', '#9a6ad8', '#f08cb0', '#6f9cf0'];
// Dandelions on the lawn, clear of the puddles: [x, how many days behind the rest]. Each is a yellow
// flower from day 92, closes up at 106, is a puff from 110 and is gone by 155 (plus its own lag).
export const DANDELIONS = [[8, -10], [33, 4], [41, -14], [50, 0], [57, -7], [86, 8], [91, -12], [108, 2], [114, -4]];
const blownAt = DANDELIONS.map(() => -Infinity);
const PUFF_REGROW = 60e3; // ms before a blown dandelion has a new puff, at normal speed
const dandelionStage = d => (d < 92 || d >= 158 ? null : d < 106 ? 'flower' : d < 110 ? 'bud' : d < 155 ? 'puff' : 'stem');
/** Robins come to the lawn from mid-March to early July. */
const robinSeason = day => ramp(day, 62, 76) * (1 - ramp(day, 165, 190));
// Facing right. b back, k head, o breast, y beak, l legs.
const ROBIN = {
  stand: ['...kk.', 'bbbbky', '.bboo.', '..l.l.'],
  peck: ['......', 'bbbb..', '.bbokk', '..l.ly'],
  up: ['.bb...', 'bbbbky', '..oo..', '......'],
  down: ['......', 'bbbbky', '.bboo.', '.b....'],
};
const ROBIN_COLS = { b: '#6e5a4a', k: '#2b2626', o: '#e06a2c', y: '#f0c040', l: '#4a3a2e' };
// A rainbow's bands, outside in.
const BOW = ['#e8463a', '#f39a2e', '#f5d63c', '#5cbf4a', '#3f86e0', '#7a4fc0'];

// ---------- summer ----------
// (Laid out with hash(), and anything at random uses Math.random(): nothing here draws from r().)
/** Butterflies are about from mid-May to mid-September. */
const fluttering = day => ramp(day, 130, 150) * (1 - ramp(day, 250, 270));
/** Dragonflies, over the puddles: June to early September. */
const darting = day => ramp(day, 145, 165) * (1 - ramp(day, 240, 260));
/** Thunderstorm season: mid-May into early October. */
const stormy = day => ramp(day, 120, 150) * (1 - ramp(day, 255, 285));
/** When the lawn can brown in a dry spell: May to mid-October (the rest of the year it's dormant anyway). */
const growing = day => ramp(day, 110, 140) * (1 - ramp(day, 270, 295));
const BFLY_COLS = ['#f4f2e6', '#f2d24a', '#e8862a', '#8fb4f4'];
const BFLY = { open: ['cc.cc', 'ccbcc', '.c.c.'], shut: ['..c..', '..c..', '..b..'] };
const DFLY_COLS = ['#2f86b8', '#3a9a62', '#b8452e'];
// Sunflowers along the lawn, clear of the puddles and the tree's trunk: [x, days behind the rest, height].
// Each comes up from day 172, is in bud from 188, flowers from 194, droops and browns from 246 and is
// gone by 264 (plus its own lag).
export const SUNFLOWERS = [];
for (let x = 2, last = -9; x < W - 2; x++) {
  if (x - last < 5 || (x >= 9 && x <= 29) || PUDDLES.some(([px, w]) => x >= px - 3 && x <= px + w + 2) || hash(x, 211) > 0.22) continue;
  SUNFLOWERS.push([x, Math.round((hash(x, 212) - 0.5) * 12), 9 + Math.floor(hash(x, 213) * 5)]);
  last = x;
}
const sunflowerStage = d => (d < 172 || d >= 264 ? null : d < 188 ? 'grow' : d < 194 ? 'bud' : d < 246 ? 'bloom' : 'droop');
const SUNFLOWER_HEAD = ['.yyy.', 'ycccy', 'ycccy', '.yyy.'];
const SUNFLOWER_DROOP = ['.ccc', 'yccy', '..y.'];

let falling = [], nextDrop = 0, geese = null, nextGeese = null, scatteredAt = -Infinity;
let robins = [], nextRobins = null, robinVisits = 0;
let butterflies = [], nextButterfly = null, dflies = [], thunder = null, flashUntil = 0, nextFlash = 0;
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

/** The dandelions now, in DANDELIONS order: { x (sky px), puff: a whole seed head, there to blow }. */
export function dandelions() {
  const day = seasonNow(k?.lat).day, now = performance.now();
  const hidden = !k || k.snowing || (k.snowLying || 0) >= 0.3;
  return DANDELIONS.map(([x, lag], i) => ({ x, puff: !hidden && dandelionStage(day - lag) === 'puff' && (now - blownAt[i]) * SPEED >= PUFF_REGROW }));
}
/** A dog has run through dandelion i: the seeds are gone (dogs.js sends them off), and it grows a new head. */
export function blowDandelion(i) {
  blownAt[i] = performance.now();
  if (k) draw(performance.now() / 1000);
}

/** A few robins fly in and land on the lawn (2 or 3, or n). */
export function robinsArrive(n = 2 + Math.floor(Math.random() * 2)) {
  robinVisits++;
  for (let i = 0; i < n; i++) {
    const from = Math.random() < 0.5 ? -6 : W + 6;
    const rb = { x: from, h: 22 + Math.random() * 14, dir: 1, delay: i * (0.5 + Math.random() * 0.6), lands: Math.random() < 0.6 ? 1 : 0, stay: 35 + Math.random() * 25, wait: 0, peck: 0, hop: null, fly: null, leave: false };
    flyTo(rb, 14 + Math.random() * (W - 28), 4);
    robins.push(rb);
  }
}
/** The robins about now: { x, h (sky px, h above the lawn), down (on the lawn), going (flying off) }. */
export const robinsNow = () => robins.filter(rb => !(rb.delay > 0)).map(rb => ({ x: rb.x, h: rb.h, down: !rb.fly && !rb.leave, going: rb.leave }));
/** Goes up by one each time robins arrive. */
export const robinVisit = () => robinVisits;
/** Something has come at the robins near x (sky px): they fly up, and some land again further off. */
export function startleRobins(x, reach = 22) {
  for (const rb of robins) {
    if (rb.leave || rb.delay > 0 || rb.fly || Math.abs(rb.x - x) > reach) continue;
    const away = rb.x < x ? -1 : 1, to = away > 0 ? x + 40 + Math.random() * (W - 10 - x - 40) : 10 + Math.random() * (x - 50);
    if (rb.lands > 0 && to > 8 && to < W - 8) { rb.lands--; rb.stay = Math.max(rb.stay, 12); flyTo(rb, to, 12); }
    else leaveRobin(rb, away);
  }
}
function flyTo(rb, x, arc) {
  rb.fly = { x0: rb.x, h0: rb.h, x1: x, u: 0, dur: Math.max(0.8, Math.abs(x - rb.x) / 32), arc };
  rb.dir = x >= rb.x ? 1 : -1;
  rb.hop = null;
}
function leaveRobin(rb, dir = rb.x < W / 2 ? -1 : 1) {
  Object.assign(rb, { leave: true, fly: null, hop: null, dir, vx: dir * (30 + Math.random() * 10), vh: 14 + Math.random() * 8 });
}

/** A butterfly or two flutters in from the side (n of them). */
export function butterfliesArrive(n = 1) {
  for (let i = 0; i < n; i++) {
    const from = Math.random() < 0.5 ? -3 : W + 3;
    butterflies.push({
      x: from, h: 12 + Math.random() * 20, tx: 15 + Math.random() * (W - 30), th: 3 + Math.random() * 16, dir: from < 0 ? 1 : -1,
      c: BFLY_COLS[Math.floor(Math.random() * BFLY_COLS.length)], ph: Math.random() * 9, rest: 0, life: 35 + Math.random() * 35, leave: false, jink: 0, landing: false,
    });
  }
}
/** The butterflies about now: { x, h (sky px, h above the lawn), down (resting), going (flying off) }. */
export const butterfliesNow = () => butterflies.map(b => ({ x: b.x, h: b.h, down: b.rest > 0, going: b.leave }));
/** A dog has snapped at x (sky px): any butterfly within reach jinks up and away. */
export function startleButterfly(x, reach = 9) {
  for (const b of butterflies) {
    if (b.leave || Math.abs(b.x - x) > reach || b.h > 26) continue;
    Object.assign(b, { rest: 0, jink: 0.7, landing: false, th: 18 + Math.random() * 14 });
    b.tx = Math.min(W - 6, Math.max(6, b.x + (b.x < x ? -1 : 1) * (12 + Math.random() * 16)));
  }
}
/** Sunflowers in flower now, as landing spots: { x, h } (the top of the head, above the lawn). */
function sunflowerHeads(day) {
  return SUNFLOWERS.filter(([, lag]) => sunflowerStage(day - lag) === 'bloom').map(([x, , h]) => ({ x, h: h + 1 }));
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
    // Long, clear winter nights: half as many again, fainter, the odd one twinkling.
    const extra = Math.round(winterStars.length * wintry(day));
    for (let i = 0; i < extra; i++) {
      const [x, y, tw] = winterStars[i];
      ctx.fillStyle = tw > 0.8 && Math.sin(t * 1.1 + tw * 30) > 0.7 ? '#e8ecff' : tw > 0.4 ? '#6f7cb0' : '#525e92';
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
  drawThunderheads(t, day, horizon, ph, over);
  drawGeese(t, day, horizon, ph);
  // Clouds drift with the wind.
  const n = Math.round(2 + k.cloud * 6), speed = 0.6 + k.wind * 0.18;
  const cc = night ? (k.raining ? '#2b334a' : '#26335e') : k.raining ? '#9ba7b4' : ph === 'day' ? '#ffffff' : '#f7d6c6';
  for (let i = 0; i < n; i++) {
    const [x0, y, s] = clouds[i];
    const x = (((x0 * (W + 50) + t * speed * s) % (W + 50)) + W + 50) % (W + 50) - 30;
    cloud(Math.floor(x), Math.floor(y * horizon), Math.max(2, Math.round(s * 3 + k.cloud * 1.5)), cc);
  }
  drawRainbow(horizon, ph);

  // Hills, a tree, and the lawn the dogs walk on, in the season's colours.
  // Frost whitens the land a little; falling snow covers it, and so does fresh snow lying after a fall.
  // As lying snow melts, the ground shows through in patches, the far hill keeping its snow longest.
  const lying = k.snowLying || 0, full = k.snowing || lying >= 0.85;
  const cover = full ? 0.78 : k.frost ? 0.55 : 0, white = full ? SNOW : '#e8f1f6';
  const patches = !full && lying > 0.04 ? lying * 1.15 : 0; // melt values under this are still snow
  const land = c => { c = shade(c, ph); return cover ? mix(c, white, cover) : c; };
  const snowOn = c => mix(shade(c, ph), SNOW, 0.8);
  // A dry spell (k.drought) fades the green a little everywhere, and browns the lawn in patches.
  const dry = full || patches ? 0 : (k.drought || 0) * growing(day);
  let [d1, d2, dg, patchy] = LAND(day);
  if (dry) [d1, d2, dg] = [d1, d2, dg].map(c => mix(c, '#b9ad66', dry * 0.25));
  const hill = base => [-1, ...PATCH.keys()].map(p => land(p < 0 || !patchy ? base : mix(base, PATCH[p], patchy * 0.65)));
  const c1 = hill(d1), c2 = hill(d2), grass = land(dg);
  const tops = [];
  for (let x = 0; x < W; x++) {
    const a = Math.round(10 + 5 * Math.sin(x / 13 + 1) + 3 * Math.sin(x / 5));
    const b = Math.round(5 + 4 * Math.sin(x / 9 + 3) + 2 * Math.sin(x / 4));
    hillColumn(x, horizon + 18 - a, fields1, c1, patchy);
    hillColumn(x, horizon + 26 - b, fields2, c2, patchy);
    tops.push([horizon + 18 - a, horizon + 26 - b]);
  }
  if (patches) {
    snowPatches(x => tops[x][0], x => tops[x][1], horizon, patches + 0.08, snowOn(d1));
    snowPatches(x => tops[x][1], () => ground, horizon, patches, snowOn(d2));
  }
  if (dry > 0.05) {
    snowPatches(x => tops[x][1], () => ground, horizon, dry * 0.7, land(mix(d2, '#c9ad60', 0.7)), dryAt);
    snowPatches(x => tops[x][1], () => ground, horizon, dry * 0.4, land(mix(d2, '#a8884a', 0.75)), dryAt);
  }
  drawHouse(t, day, horizon, ph, land, full || lying >= 0.3, snowOn);
  // Heat haze over the hills on a hot afternoon.
  const hazy = (k.hot && k.afternoon && ph === 'day' && !k.raining && !still) || q.has('heatshimmer');
  if (hazy) shimmer(t, horizon);
  const sway = k.windy ? Math.round(Math.sin(t * 6)) : 0;
  const tx = 14, ty = horizon + 12;
  const bark = night ? '#2a1d14' : '#6b4a2b';
  ctx.fillStyle = bark; ctx.fillRect(tx + treeUp(3, 4), ty + treeUp(-4, 12), treeUp(6, 4) - treeUp(3, 4), 12 - treeUp(-4, 12));
  const [, density] = TREE(day);
  for (const p of BRANCHES) {
    const x = tx + p.x + (p.sway ? sway : 0), y = ty + p.y;
    ctx.fillStyle = bark; ctx.fillRect(x, y, 1, 1);
    if ((k.snowing || lying >= 0.4) && density < 0.5) { ctx.fillStyle = snowOn('#ffffff'); ctx.fillRect(x, y - 1, 1, 1); }
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
  if (dry > 0.05) snowPatches(() => ground, () => H, horizon, dry * 0.7, land(mix(dg, '#c9ad60', 0.7)), dryAt);
  ctx.fillStyle = mix(grass, '#ffffff', 0.18);
  for (let x = (Math.floor(t) % 2); x < W; x += 4) ctx.fillRect(x, ground, 1, 1);
  // Spring flowers, under the snow if there is any: none under a full cover, none where a patch lies.
  if (!full) {
    const snowAt = (x, y) => patches && meltAt(x, y - horizon) < patches;
    drawFlowers(day, land, dg, snowAt);
    drawSunflowers(t, day, land, dg, snowAt);
  }
  if (patches) snowPatches(() => ground, () => H, horizon, patches, snowOn(dg));
  // Lying snow banks up a little along the lawn's edge.
  if (lying > 0.3) {
    ctx.fillStyle = snowOn(dg);
    for (let x = 0; x < W; x++) if (meltAt(x, -40) < lying - 0.2) ctx.fillRect(x, ground - 1, 1, 1);
  }
  if (k.snowman) drawSnowman(lying, ph);

  drawPile(land);
  // Fall: leaves let go of the tree and drift down, wind or no wind, in the tree's own colours.
  // Spring: blossom petals, lighter, slower and further on the breeze.
  const leafing = ramp(day, 258, 290), petals = petalling(day);
  const dropRate = density * Math.max(leafing, petals * 0.9), petal = petals > leafing;
  if (!still && dropRate > 0.03 && !k.snowing && t > nextDrop && falling.length < (petal ? 8 : 6)) {
    nextDrop = t + (petal ? 0.6 + Math.random() * 1.6 : 1.5 + Math.random() * 3) / Math.max(0.3, dropRate);
    const on = canopy.filter(p => p.drop < density);
    const p = on[Math.floor(Math.random() * on.length)];
    if (p) falling.push({
      x: tx + p.x + sway, y: ty + p.y, ph: Math.random() * 9, petal, land: ground - 1 - Math.floor(Math.random() * 6), rest: 0,
      c: petal ? land(PETAL_COLS[Math.floor(Math.random() * PETAL_COLS.length)]) : leafCol(p), vy: petal ? 1.6 + Math.random() * 1.4 : 3 + Math.random() * 2,
    });
  }
  const drift = k.windy ? 6 + k.gust * 0.3 : 0.8;
  for (const L of falling) {
    if (L.rest) { L.rest -= dt; } else {
      L.y += L.vy * dt; L.x += (L.petal ? drift * 1.6 + 1.2 : drift) * dt;
      if (L.y >= L.land) { L.y = L.land; L.rest = 5 + Math.random() * 4; }
    }
    const x = Math.round(L.x + (L.rest ? 0 : Math.sin(t * (L.petal ? 1.6 : 2.2) + L.ph) * (L.petal ? 2.5 : 1.5))), flat = L.rest || Math.sin(t * 5 + L.ph) > 0;
    ctx.fillStyle = L.c; ctx.fillRect(x, Math.round(L.y), flat ? 2 : 1, 1);
  }
  falling = falling.filter(L => !(L.rest < 0) && L.x < W + 2);

  if (k.puddles) {
    ctx.fillStyle = night ? '#2c4a7a' : '#7fb3e0';
    PUDDLES.forEach(([x, w]) => { ctx.fillRect(x, ground - 1, w, 1); ctx.fillRect(x + 1, ground - 2, w - 2, 1); });
  } else if (k.ice) {
    // Frozen over: pale and milky, a glint that comes and goes.
    PUDDLES.forEach(([x, w], i) => {
      ctx.fillStyle = night ? '#5a7298' : '#bcdcef'; ctx.fillRect(x, ground - 1, w, 1);
      ctx.fillStyle = night ? '#7088ad' : '#e2f1fa'; ctx.fillRect(x + 1, ground - 2, w - 2, 1);
      if (Math.sin(t * 0.9 + i * 2.1) > 0.2) { ctx.fillStyle = night ? '#a9bde0' : '#ffffff'; ctx.fillRect(x + 2 + ((i * 5) % (w - 4)), ground - 2, 1, 1); }
    });
  }
  drawDragonflies(t, dt, day, ph);
  drawRobins(t, dt, day, ph);
  drawButterflies(t, dt, day, ph);
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
  busy = falling.length > 0 || !!geese || robins.length > 0 || butterflies.length > 0 || dflies.length > 0 || hazy || !!thunder?.flashing;
}

// Wildflowers (single pixels on short stems, here and there along the lawn's edge) and dandelions.
// All through land(), so frost whitens them and they darken after sundown; snowAt(x, y) is lying snow.
function drawFlowers(day, land, dg, snowAt) {
  const stem = land(mix(dg, '#2f6b2a', 0.45)), put = (c, x, y) => { if (!snowAt(x, y)) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); } };
  const n = blooming(day);
  if (n > 0.02) for (let x = 1; x < W - 1; x++) {
    if (hash(x, 71) > 0.34 * n || PUDDLES.some(([px, w]) => x >= px - 1 && x <= px + w)) continue;
    const h = 1 + Math.floor(hash(x, 73) * 3);
    for (let j = 1; j < h; j++) put(stem, x, ground - j);
    put(land(FLOWER_COLS[Math.floor(hash(x, 72) * FLOWER_COLS.length)]), x, ground - h);
  }
  const now = performance.now(), yellow = land('#f5c518'), seed = land('#fbfbf2'), core = land('#cfcfc0'), bud = land('#9ab23c');
  DANDELIONS.forEach(([x, lag], i) => {
    let s = dandelionStage(day - lag);
    if (!s) return;
    if (s === 'puff' && (now - blownAt[i]) * SPEED < PUFF_REGROW) s = 'stem';
    const g = ground;
    put(stem, x, g - 1); put(stem, x, g - 2);
    if (s === 'flower') { put(yellow, x - 1, g - 3); put(yellow, x, g - 3); put(yellow, x + 1, g - 3); put(yellow, x, g - 4); return; }
    put(s === 'bud' ? bud : stem, x, g - 3);
    if (s !== 'puff') return;
    put(seed, x, g - 6); put(seed, x - 1, g - 5); put(core, x, g - 5); put(seed, x + 1, g - 5); put(seed, x - 1, g - 4); put(seed, x + 1, g - 4);
  });
}

// A rainbow after rain (k.rainbow, 0-1), opposite the sun, its feet behind the hills.
function drawRainbow(horizon, ph) {
  const s = k.rainbow || 0;
  if (s < 0.05 || ph === 'night') return;
  const cx = Math.round(W * (ph === 'dawn' ? 0.68 : 0.32)), cy = horizon + 14, R = 40;
  ctx.globalAlpha = 0.5 * s;
  for (let y = cy - R; y < cy; y++) for (let x = cx - R; x <= cx + R; x++) {
    const b = Math.floor(R - Math.hypot(x + 0.5 - cx, y + 0.5 - cy));
    if (b >= 0 && b < BOW.length) { ctx.fillStyle = BOW[b]; ctx.fillRect(x, y, 1, 1); }
  }
  ctx.globalAlpha = 1;
}

// Spring: now and then two or three robins drop onto the lawn. They run a few hops, stop, peck, and
// after a while fly off; rain or nightfall sends them off at once. Dogs startle them (startleRobins).
function drawRobins(t, dt, day, ph) {
  if (nextRobins == null) nextRobins = t + (q.has('robins') ? 3 : 60 + Math.random() * 180);
  const ok = !still && ph !== 'night' && !k.raining && !k.fog && !((k.snowLying || 0) >= 0.3);
  if (!robins.length && ok && robinSeason(day) > 0.5 && t > nextRobins) {
    robinsArrive();
    nextRobins = t + (q.has('robins') ? 45 : 300 + Math.random() * 420);
  }
  for (const rb of robins) {
    if (rb.delay > 0) { rb.delay -= dt; continue; }
    if (!ok && !rb.leave) leaveRobin(rb);
    if (rb.leave) { rb.x += rb.vx * dt; rb.h += rb.vh * dt; continue; }
    if (rb.fly) {
      const f = rb.fly;
      f.u = Math.min(1, f.u + dt / f.dur);
      rb.x = f.x0 + (f.x1 - f.x0) * f.u; rb.h = f.h0 * (1 - f.u) + Math.sin(f.u * Math.PI) * f.arc;
      if (f.u >= 1) { rb.fly = null; rb.h = 0; rb.wait = 0.4 + Math.random(); }
      continue;
    }
    if ((rb.stay -= dt) < 0) { leaveRobin(rb); continue; }
    if (rb.hop) {
      const p = rb.hop;
      p.u = Math.min(1, p.u + dt / 0.22);
      rb.x = p.x0 + p.dx * p.u; rb.h = Math.sin(p.u * Math.PI) * 1.5;
      if (p.u >= 1) { rb.hop = null; rb.h = 0; }
      continue;
    }
    rb.peck = Math.max(0, rb.peck - dt);
    if ((rb.wait -= dt) > 0) continue;
    const c = Math.random();
    if (c < 0.5) { // a hop or two, then a stop
      if ((rb.x < 8 && rb.dir < 0) || (rb.x > W - 8 && rb.dir > 0)) rb.dir = -rb.dir;
      rb.hop = { x0: rb.x, dx: rb.dir * (2 + Math.random() * 3), u: 0 };
      rb.wait = Math.random() < 0.6 ? 0.1 : 0.5 + Math.random() * 0.8;
    } else if (c < 0.82) { rb.peck = 0.45; rb.wait = 0.7 + Math.random() * 0.9; }
    else { rb.dir = -rb.dir; rb.wait = 0.5 + Math.random() * 0.8; }
  }
  robins = robins.filter(rb => !(rb.leave && (rb.x < -8 || rb.x > W + 8 || rb.h > 90)));
  const col = {};
  for (const [c, v] of Object.entries(ROBIN_COLS)) col[c] = shade(v, ph);
  for (const rb of robins) {
    if (rb.delay > 0) continue;
    const frame = rb.fly || rb.leave ? (Math.floor(t * 9 + rb.x) % 2 ? 'up' : 'down') : rb.peck > 0 ? 'peck' : 'stand';
    const x0 = Math.round(rb.x) - 3, y0 = ground - 4 - Math.round(rb.h);
    ROBIN[frame].forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.') return;
      ctx.fillStyle = col[ch];
      ctx.fillRect(rb.dir > 0 ? x0 + i : x0 + 5 - i, y0 + j, 1, 1);
    }));
  }
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

/** Lying snow, partly melted (or, with at = dryAt, a lawn browned in patches): in each column from from(x) to to(x), the pixels whose melt value is under thr. */
function snowPatches(from, to, horizon, thr, col, at = meltAt) {
  ctx.fillStyle = col;
  for (let x = 0; x < W; x++) {
    const y1 = to(x);
    let run = -1;
    for (let y = from(x); y <= y1; y++) {
      const on = y < y1 && at(x, y - horizon) < thr;
      if (on && run < 0) run = y;
      else if (!on && run >= 0) { ctx.fillRect(x, run, 1, y - run); run = -1; }
    }
  }
}

// The little house on the far hill: snow on its roof when there's snow about, the window lit after dark,
// and in winter (or on any cold day) smoke from the chimney, leaning with the wind.
function drawHouse(t, day, horizon, ph, land, snowy, snowOn) {
  let base = 0;
  for (let x = HOUSE_X; x < HOUSE_X + HOUSE[0].length; x++) base = Math.max(base, horizon + 17 - Math.round(10 + 5 * Math.sin(x / 13 + 1) + 3 * Math.sin(x / 5)));
  const y0 = base - HOUSE.length + 1, lit = ph === 'night' || ph === 'dusk';
  const col = { c: shade(HOUSE_COLS.c, ph), w: shade(HOUSE_COLS.w, ph), d: shade(HOUSE_COLS.d, ph), r: snowy ? snowOn('#ffffff') : land(HOUSE_COLS.r), y: lit ? '#ffd36b' : shade(HOUSE_COLS.y, ph) };
  HOUSE.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.') return;
    // The eaves stay dark under the snow.
    ctx.fillStyle = ch === 'r' && j === 3 && snowy ? shade(HOUSE_COLS.r, ph) : col[ch];
    ctx.fillRect(HOUSE_X + i, y0 + j, 1, 1);
  }));
  const s = Math.max(wintry(day), k.cold ? 0.6 : 0);
  if (s < 0.05) return;
  const n = Math.ceil(6 * s), tt = still ? 3 : t, lean = 0.5 + Math.min(20, k.wind) * 0.35;
  ctx.fillStyle = ph === 'night' ? '#5d6580' : ph === 'day' ? '#aab3bd' : '#b3a9b0';
  for (let i = 0; i < n; i++) {
    const p = (tt * 0.18 + i / n) % 1, size = p < 0.3 ? 1 : 2;
    ctx.globalAlpha = 0.9 * (1 - p);
    ctx.fillRect(Math.round(HOUSE_X + 5 + p * p * lean * 8 + Math.sin(tt * 1.3 + i * 2) * p * 1.2), Math.round(y0 - 1 - p * 16), size, size);
  }
  ctx.globalAlpha = 1;
}

// The snowman: whole while the snow's fresh, slumping as it melts, then a lump with a hat and a carrot.
function drawSnowman(lying, ph) {
  const col = {};
  for (const [c, v] of Object.entries(SNOWMAN_COLS)) col[c] = c === 'w' || c === 's' ? mix(shade(v, ph), v, 0.8) : shade(v, ph);
  const top = ground - SNOWMAN.length;
  const put = (r0, r1, dx, dy) => {
    for (let j = r0; j <= r1; j++) [...SNOWMAN[j]].forEach((ch, i) => {
      if (ch !== '.') { ctx.fillStyle = col[ch]; ctx.fillRect(SNOWMAN_X + i + dx, top + j + dy, 1, 1); }
    });
  };
  if (lying >= 0.45) put(0, 16, 0, 0);
  else if (lying >= 0.25) { put(12, 16, 0, 0); put(7, 11, 0, 1); put(0, 6, 1, 2); }
  else {
    put(14, 16, 0, 0); put(1, 2, 3, 11);
    ctx.fillStyle = col.o; ctx.fillRect(SNOWMAN_X + 7, top + 13, 2, 1);
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

// ---------- summer ----------

// Sunflowers along the lawn: a stem shooting up, a green bud, then the big yellow head (nodding in the
// wind), which droops and browns as summer ends. Through land(), like the wildflowers.
function drawSunflowers(t, day, land, dg, snowAt) {
  const stem = land(mix(dg, '#2f6b2a', 0.55)), leaf = land('#2f6e26'), cols = { y: land('#f5c21a'), c: land('#6b4220') };
  const dead = { y: land('#b8902e'), c: land('#5a3a1e') };
  const put = (c, x, y) => { if (!snowAt(x, y)) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); } };
  for (const [x, lag, h] of SUNFLOWERS) {
    const d = day - lag, s = sunflowerStage(d);
    if (!s) continue;
    const tall = s === 'grow' ? Math.max(2, Math.round(h * ramp(d, 172, 188))) : h - 2;
    const lean = s === 'droop' ? 1 : k.windy ? Math.round(Math.sin(t * 5 + x)) : 0;
    for (let j = 1; j <= tall; j++) put(stem, x + (j === tall ? lean : 0), ground - j);
    if (tall >= 5) { put(leaf, x - 1, ground - 3); put(leaf, x + 1, ground - 5); }
    if (tall >= 8) put(leaf, x - 1, ground - 7);
    const top = ground - tall, hx = x + lean;
    if (s === 'grow') { put(leaf, hx, top - 1); continue; }
    if (s === 'bud') { put(leaf, hx - 1, top - 1); put(leaf, hx, top - 1); put(leaf, hx + 1, top - 1); put(leaf, hx, top - 2); continue; }
    const head = s === 'bloom' ? SUNFLOWER_HEAD : SUNFLOWER_DROOP, c = s === 'bloom' ? cols : dead;
    const x0 = hx - (s === 'bloom' ? 2 : 1), y0 = top - (s === 'bloom' ? 3 : 1);
    head.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && put(c[ch], x0 + i, y0 + j)));
  }
}

// Butterflies: in ones and twos they flutter in, wander low over the lawn, rest now and then on a
// sunflower or the grass, and after a while flutter off. Rain, wind, fog or evening sends them away.
function drawButterflies(t, dt, day, ph) {
  if (nextButterfly == null) nextButterfly = t + (q.has('butterflies') ? 2 : 10 + Math.random() * 40);
  const ok = !still && ph === 'day' && !k.raining && !k.fog && k.gust < 20 && k.temp >= 58 && !((k.snowLying || 0) >= 0.3);
  if (ok && fluttering(day) > 0.5 && butterflies.length < 3 && t > nextButterfly) {
    butterfliesArrive(Math.random() < 0.3 ? 2 : 1);
    nextButterfly = t + (q.has('butterflies') ? 8 : 20 + Math.random() * 60);
  }
  for (const b of butterflies) {
    b.life -= dt;
    if ((!ok || b.life < 0) && !b.leave) Object.assign(b, { leave: true, rest: 0, landing: false, tx: b.x < W / 2 ? -10 : W + 10, th: b.h + 25 });
    if (b.rest > 0) { b.rest -= dt; continue; }
    const dx = b.tx - b.x, fast = b.jink > 0 || b.leave;
    b.x += Math.sign(dx) * Math.min(Math.abs(dx), (b.jink > 0 ? 32 : b.leave ? 16 : 9) * dt);
    b.h += (b.th - b.h) * Math.min(1, dt * (fast ? 3 : 1.4));
    b.jink -= dt;
    if (Math.abs(dx) > 0.5) b.dir = Math.sign(dx);
    if (b.leave || Math.abs(dx) > 0.8 || Math.abs(b.th - b.h) > 1.2) continue;
    if (b.landing) { b.landing = false; b.h = b.th; b.rest = 2 + Math.random() * 4; continue; }
    if (Math.random() < 0.35) { // somewhere to rest: a sunflower, or the grass
      const heads = sunflowerHeads(day).filter(s => Math.abs(s.x - b.x) < 40);
      const s = heads.length && Math.random() < 0.7 ? heads[Math.floor(Math.random() * heads.length)] : { x: b.x + (Math.random() - 0.5) * 30, h: 0 };
      Object.assign(b, { tx: Math.min(W - 4, Math.max(4, s.x)), th: s.h, landing: true });
    } else Object.assign(b, { tx: Math.min(W - 6, Math.max(6, b.x + (Math.random() - 0.5) * 44)), th: 3 + Math.random() * 20 });
  }
  butterflies = butterflies.filter(b => !(b.leave && (b.x < -6 || b.x > W + 6)));
  for (const b of butterflies) {
    const resting = b.rest > 0, frame = resting || Math.floor(t * 8 + b.ph) % 2 ? 'shut' : 'open';
    const bob = resting ? 0 : Math.sin(t * 6 + b.ph) * 1.3;
    const x0 = Math.round(b.x) - 2, y0 = ground - 3 - Math.round(b.h + bob), col = { c: shade(b.c, ph), b: shade('#3a2e28', ph) };
    BFLY[frame].forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') { ctx.fillStyle = col[ch]; ctx.fillRect(x0 + i, y0 + j, 1, 1); } }));
  }
}

// Dragonflies after summer rain: they hover over the puddles, then dart to a new spot.
function drawDragonflies(t, dt, day, ph) {
  const want = !still && k.puddles && !k.raining && !k.fog && !k.windy && ph !== 'night' && k.temp >= 50 && darting(day) > 0.5 ? 2 : 0;
  const staying = dflies.filter(f => !f.leave);
  if (staying.length > want) staying.slice(want).forEach(f => Object.assign(f, { leave: true, wait: 0, tx: f.x < W / 2 ? -10 : W + 10, th: 40 }));
  for (let i = staying.length; i < want; i++) {
    const from = Math.random() < 0.5 ? -4 : W + 4;
    dflies.push({ x: from, h: 20, tx: 0, th: 0, wait: 0, home: Math.floor(Math.random() * PUDDLES.length), dir: 1, c: DFLY_COLS[Math.floor(Math.random() * DFLY_COLS.length)], ph: Math.random() * 9, leave: false, aim: true });
  }
  for (const f of dflies) {
    if (f.aim) { // a new spot over its puddle (now and then, another puddle)
      if (Math.random() < 0.15) f.home = Math.floor(Math.random() * PUDDLES.length);
      const [px, w] = PUDDLES[f.home];
      Object.assign(f, { tx: px - 3 + Math.random() * (w + 6), th: 1.5 + Math.random() * 6, aim: false });
    }
    if (f.wait > 0) { f.wait -= dt; if (f.wait <= 0) f.aim = !f.leave; continue; }
    const dx = f.tx - f.x, dh = f.th - f.h, dist = Math.hypot(dx, dh), step = (f.leave ? 50 : 70) * dt;
    if (Math.abs(dx) > 0.3) f.dir = Math.sign(dx);
    if (dist <= step) { f.x = f.tx; f.h = f.th; f.wait = f.leave ? 0 : 0.6 + Math.random() * 2.2; continue; }
    f.x += (dx / dist) * step; f.h += (dh / dist) * step;
  }
  dflies = dflies.filter(f => !(f.leave && (f.x < -6 || f.x > W + 6)));
  const wing = shade(ph === 'day' ? '#e4eef4' : '#c8d2e0', ph);
  for (const f of dflies) {
    const hovering = f.wait > 0, x0 = Math.round(f.x) - 2, y = ground - 3 - Math.round(f.h + (hovering ? Math.sin(t * 9 + f.ph) * 0.4 : 0));
    ctx.fillStyle = shade(f.c, ph); ctx.fillRect(x0, y, 4, 1);
    ctx.fillStyle = shade('#1e2a30', ph); ctx.fillRect(f.dir > 0 ? x0 + 3 : x0, y, 1, 1);
    if (Math.floor(t * 12 + f.ph) % 2) { ctx.fillStyle = wing; ctx.fillRect(x0 + (f.dir > 0 ? 1 : 2), y - 1, 1, 1); ctx.fillRect(x0 + (f.dir > 0 ? 2 : 1), y + 1, 1, 1); }
  }
}

// Heat haze: on a hot afternoon the far hills (and the house on them) waver, row by row.
function shimmer(t, horizon) {
  for (let y = horizon - 3; y < horizon + 17; y++) {
    const dx = Math.round(Math.sin(t * 3.2 + y * 0.9) * 0.55 + Math.sin(t * 1.7 - y * 0.4) * 0.45);
    if (dx) ctx.drawImage(cv, 0, y, W, 1, dx, y, W, 1);
  }
}

// Thunderheads: when a storm is building (the pressure falling, no rain yet) on a warm day, towering
// clouds with flat anvil tops stand on the horizon, lit on the sun's side. After dark, lightning flickers
// inside them.
function thunderShape(cx, height, baseW, topW, seed) {
  const rows = [], neck = baseW * 0.36;
  for (let j = 0; j < height; j++) {
    const u = j / (height - 1);
    let l, r, anvil = false;
    if (u < 0.8) {
      // The tower: billowing out in heaps on either side, narrowing a little as it climbs.
      const hw = (baseW / 2) * (1 - 0.3 * u);
      l = cx - hw - 2.4 * Math.abs(Math.sin(j * 0.37 + seed)) - smooth(j / 2.2, seed) * 1.6;
      r = cx + hw + 2.4 * Math.abs(Math.sin(j * 0.33 + seed * 1.7)) + smooth(j / 2.2, seed + 31) * 1.6;
    } else {
      // The anvil: spreading out under a flat top, mostly downwind (to the right), thin at its ends.
      const f = (u - 0.8) / 0.2;
      l = cx - neck - (topW * 0.3 - neck) * f ** 0.7 - smooth(j / 1.5, seed + 7) * 0.8;
      r = cx + neck + (topW * 0.72 - neck) * f ** 0.55 + smooth(j / 1.5, seed + 9) * 0.8;
      if (j === height - 1) { l += 2; r -= 3; }
      anvil = true;
    }
    rows.push({ u, l: Math.round(l), r: Math.round(r), mid: (l + r) / 2, hw: (r - l) / 2, anvil });
  }
  return rows;
}
function drawThunderheads(t, day, horizon, ph, over) {
  const on = (k.falling && !k.raining && !k.snowing && k.temp >= 60 && stormy(day) > 0.3) || q.has('thunderheads');
  if (!on) { if (thunder) thunder.flashing = false; return; }
  const big = Math.max(20, Math.min(85, Math.round(horizon * 0.8))), key = `${big}`;
  if (thunder?.key !== key) thunder = { key, heads: [[38, thunderShape(38, big, 30, 70, 4.1)], [98, thunderShape(98, Math.round(big * 0.6), 18, 36, 9.3)]], flashing: false };
  // Lightning after dark: a flicker every few seconds.
  const dark = ph === 'night' || ph === 'dusk';
  thunder.flashing = dark && !still;
  if (thunder.flashing && t > nextFlash) { flashUntil = t + (Math.random() < 0.4 ? 0.25 : 0.12); nextFlash = t + 3 + Math.random() * 7; }
  const flash = thunder.flashing && t < flashUntil;
  const tones = ['#fbf8f1', '#e2e0de', '#bdc0c9', '#8b8f9f'].map(c => {
    c = mix(shade(c, ph), '#8a93a3', Math.min(0.6, over * 0.6));
    return flash ? mix(c, '#efeaff', 0.65) : c;
  });
  const sun = ph === 'dawn' ? -1 : 1, base = horizon + 12;
  for (const [, rows] of thunder.heads) {
    rows.forEach((row, j) => {
      const y = base - j;
      const under = row.anvil && j > 0 && !rows[j - 1].anvil ? 1 : 0;
      for (let x = Math.max(0, row.l); x <= Math.min(W - 1, row.r); x++) {
        const side = (x - row.mid) / Math.max(1, row.hw);
        // Lit on the sun's side and toward the top, in soft heaps; dark along the base and under the anvil.
        let light = 0.45 + 0.34 * sun * side + 0.3 * (row.u - 0.4) + (smooth(x / 3.2 + j * 0.15, y / 2.6) - 0.5) * 0.5;
        if (row.anvil) light += 0.12;
        if (j < 3 || (under && (x < rows[j - 1].l || x > rows[j - 1].r))) light = 0;
        ctx.fillStyle = tones[Math.max(0, Math.min(3, 3 - Math.floor(light * 3.4)))];
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }
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
  if (q.has('dogspeed')) window.__sky = { draw: secs => draw(secs ?? performance.now() / 1000), geese: () => { nextGeese = 0; }, robins: n => robinsArrive(n), butterflies: n => butterfliesArrive(n) };
}

/** New conditions from the weather; starts the animation the first time. */
export function setSky(next) {
  k = next;
  size();
  draw(performance.now() / 1000);
  if (!still && !raf) raf = requestAnimationFrame(loop);
}
