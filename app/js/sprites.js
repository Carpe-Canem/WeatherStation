// Pixel-art Ziggy, Frank and Minnie. Each is drawn as simple shapes at low resolution, then snapped to
// its own small palette with a dark outline, which gives crisp pixel art in any pose.
//
// A pose is a plain object; every field is optional:
//   t (seconds, for fast wiggles), ph/amp (gait phase and stride), bob, y, tail, head, ear,
//   mouth, tongue, bow, sit (0-1), lie (0-1), eyes (0 = closed), sweater, scratch, shake, puff (0-1), splash (0-1),
//   legF/legB (extra swing of the front/back legs, radians, + is forward: dangling and falling)
// Holiday outfits (outfits.js) are stamped on as pixel art, following the head or body (see stamp()).

export const SIZE = { z: 0.9, f: 0.75, m: 0.64 }; // Ziggy is the biggest, Minnie the smallest
const OUT = '#141012';
const PAL = {
  z: ['#1f1f22', '#121214', '#3a3a40', '#f2efe8', '#cfc9bf', '#b5773c', '#8a5a2c', '#3b2412', '#0d0d0d', '#e06878'],
  f: ['#202022', '#131315', '#45454a', '#8d8d8b', '#a3a3a0', '#ecebe7', '#c4c2bd', '#8ec0ee', '#0d0d0d', '#3a1a1a', '#e06878', '#6f7376', '#e8622a'],
  m: ['#f5f1e8', '#d6cfc2', '#ffffff', '#d3a16a', '#b98550', '#1e120c', '#0d0d0d', '#e06878', '#141414'],
};
const rgb = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
const PRGB = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, v.map(rgb)]));
const ORGB = rgb(OUT);
// Where the nose and feet sit in each dog's unscaled drawing, for breath puffs and splashes.
export const NOSE = { z: [67, 10], f: [61, 12], m: [58, 13] };

let o; // drawing context for the dog being drawn
const XF = {}; // the body and head transforms of the dog being drawn, for its outfit
const E = (x, y, rx, ry, c) => { o.fillStyle = c; o.beginPath(); o.ellipse(x, y, rx, ry, 0, 0, 7); o.fill(); };
const P = (pts, c) => { o.fillStyle = c; o.beginPath(); pts.forEach(([x, y], i) => (i ? o.lineTo(x, y) : o.moveTo(x, y))); o.closePath(); o.fill(); };
const L = (a, b, c2, d, w, c) => { o.strokeStyle = c; o.lineWidth = w; o.lineCap = 'round'; o.beginPath(); o.moveTo(a, b); o.lineTo(c2, d); o.stroke(); };
const Q = (a, b, cx, cy, c2, d, w, c) => { o.strokeStyle = c; o.lineWidth = w; o.lineCap = 'round'; o.beginPath(); o.moveTo(a, b); o.quadraticCurveTo(cx, cy, c2, d); o.stroke(); };
const pivot = (x, y, a) => { o.translate(x, y); o.rotate(a); o.translate(-x, -y); };
const eye = (x, y, r, c, p) => (p.eyes === 0 ? E(x, y + 0.2, r * 1.1, 0.35, c) : E(x, y, r, r, c));

function leg(hx, hy, a, l1, l2, w, col, foot, fl, back, fold = 0) {
  // fold tucks the hock back along the ground, as when sitting.
  const ua = back ? a + 0.35 : a, la = (back ? a - 0.4 : a + 0.05) - fold;
  const kx = hx + Math.sin(ua) * l1, ky = hy + Math.cos(ua) * l1, px = kx + Math.sin(la) * l2, py = ky + Math.cos(la) * l2;
  L(hx, hy, kx, ky, w, col);
  L(kx, ky, px, py, w * 0.85, col);
  if (foot) { const t = (l2 - fl) / l2; L(kx + (px - kx) * t, ky + (py - ky) * t, px, py, w * 0.85, foot); }
  E(px + 0.9, py, w * 0.62, w * 0.42, foot || col);
}

// Shared posture: sitting tips the body up steeply around the hips and lowers it until the rump rests
// on the ground; lying lowers it to the ground. Returns leg adjustments: back/front angle offsets,
// and reach(), how long a straight front leg from a given shoulder must be to stand on the ground.
function posture(p, hip, drop, sitDrop, rot = 0.42, lift = 3.6) {
  const s = p.sit || 0, l = p.lie || 0, base = o.getTransform(), dy = (p.y || 0) + (p.bob || 0);
  const R = rot * 1.5;
  o.translate(0, dy + (sitDrop + 6) * s + drop * l);
  if (p.shake) pivot(36, 28, Math.sin((p.t || 0) * 45) * 0.12 * p.shake);
  if (s) pivot(hip[0], hip[1], -R * s);
  if (p.bow) pivot(22, 30, p.bow);
  const scratch = p.scratch ? -0.9 + Math.sin((p.t || 0) * 32) * 0.45 : 0;
  const reach = (x, y, w) => {
    const pt = base.inverse().transformPoint(o.getTransform().transformPoint({ x, y }));
    return Math.max(4, 44 + dy - pt.y - w * 0.45);
  };
  return { bk: 1.05 * s + 1.15 * l + (p.legB || 0), fa: -R * s + 1.35 * l + (p.legF || 0), fx: lift * s, fold: 1.75 * s, scratch, sit: s >= 0.5, base, dy, reach };
}
/** Front leg: normal lengths, or when sitting, straight down to exactly the ground. */
function front(q, hx, hy, a, l1, l2, w, col, foot, fl) {
  if (q.sit) { const r = q.reach(hx, hy, w); leg(hx, hy, a, r * 0.5, r * 0.5, w, col, foot, fl, 0); }
  else leg(hx, hy, a, l1, l2, w, col, foot, fl, 0);
}

// Sitting hind legs, drawn level with the ground rather than in the tipped-up body.
// sitPaw: just a paw resting forward on the ground (far side). haunch: a folded leg (near side):
// thick thigh down and forward to the knee, shin back to the hock, paw forward along the ground.
function sitPaw(q, x, len, w, col) {
  o.save(); o.setTransform(q.base); o.translate(0, q.dy);
  L(x, 44 - w * 0.45, x + len, 44 - w * 0.45, w, col);
  o.restore();
}
function haunch(q, x, r, col, shade, foot, len, w) {
  o.save(); o.setTransform(q.base); o.translate(0, q.dy);
  const g = 44 - w * 0.45, hip = [x - r * 0.4, 44 - r * 2.1], knee = [x + r * 0.9, 44 - r * 0.9], hock = [x - r * 0.5, g];
  L(hock[0], g, hock[0] + len, g, w, foot);
  L(knee[0], knee[1], hock[0], hock[1], w * 1.1, col);
  L(hip[0], hip[1], knee[0], knee[1], w * 2.2, col);
  o.restore();
}

function ziggy(p) {
  const B = '#1f1f22', S = '#121214', H = '#3a3a40', W = '#f2efe8', T = '#b5773c';
  const a = Math.sin(p.ph || 0) * (p.amp || 0), b = -a;
  const q = posture(p, [22, 27], 13, 4, 0.34, 2.4); XF.body = o.getTransform();
  if (q.sit) p.scratch ? haunch(q, 25, 6.4, S, S, '#cfc9bf', 8, 2.4) : sitPaw(q, 27, 8, 2.4, '#cfc9bf');
  else leg(25, 26, b + q.bk, 9.5, 9.6, 2.6, S, '#cfc9bf', 3, 1, q.fold);
  front(q, 45, 28, a + q.fa, 8, 8.2, 2.2, S, '#8a5a2c', 4);
  const tl = p.tail || 0, te = [11 + 4 * Math.sin(tl), 7 + 2 * Math.cos(tl)];
  Q(19, 19, 10, 18, te[0], te[1], 2, B);
  Q(12 + 0.3 * (te[0] - 11), 12, te[0] + 0.5, te[1] + 3, te[0], te[1], 2, W);
  E(22, 22.5, 6.2, 5.8, S); E(34, 22, 13, 4.8, S); E(46, 24, 7, 7.6, S);
  E(22, 22, 5.8, 5.3, B); E(34, 21.5, 12.6, 4.2, B); E(46, 23.5, 6.6, 7, B);
  P([[27, 24], [40, 27], [40, 25], [28, 22]], B); E(33, 17.6, 9, 1, H);
  E(50, 25, 3, 5.6, W);
  if (q.sit && !p.scratch) haunch(q, 23, 6.6, B, S, W, 9, 2.6);
  else leg(22, 26, a + q.bk + q.scratch, 9.5, 9.6, 2.8, B, W, 3, 1, q.fold);
  front(q, 47, 28, b + q.fa, 8, 8.2, 2.4, B, T, 4);
  o.save(); o.translate(0.5, -2.5); pivot(50, 18, p.head || 0); XF.head = o.getTransform();
  P([[44, 23], [50, 10], [56, 12], [51, 27]], B); E(55, 11, 5.5, 5, B); E(54, 7.4, 3.6, 0.9, H);
  P([[57, 8.8], [66.5, 11.6], [67.3, 14], [66.4, 15.3], [57, 15.6]], B);
  P([[59.5, 14.8], [66.2, 14.6], [64.6, 16.2], [59, 16.4]], W); // white only on the chin and lower lip
  E(55.6, 8.6, 1.1, 0.75, T); E(57, 13.8, 1.8, 1.3, T); eye(57.2, 10.3, 1.05, '#3b2412', p); E(66.9, 12.4, 1.4, 1.25, '#0d0d0d');
  if (p.mouth || p.tongue) P([[60, 15.4], [63.5, 15.4], [62.2, 19.3]], '#e06878');
  o.save(); pivot(53, 6.5, p.ear || 0); P([[50.8, 7.6], [53.6, 4.3], [57.3, 6.6], [58.6, 9.6], [55.4, 9.1]], B); o.restore();
  o.restore();
}

function frank(p) {
  const B = '#202022', S = '#131315', H = '#45454a', W = '#ecebe7', WS = '#c4c2bd', G = '#8d8d8b';
  const a = Math.sin(p.ph || 0) * (p.amp || 0), b = -a;
  const q = posture(p, [20, 29], 9, 3, 0.3, 1.6); XF.body = o.getTransform();
  if (q.sit) p.scratch ? haunch(q, 23, 5.4, S, S, WS, 7, 3.2) : sitPaw(q, 25, 7, 3.2, WS);
  else leg(24, 31, b + q.bk, 7, 7.1, 3.6, WS, 0, 0, 1, q.fold);
  front(q, 40, 31, a + q.fa, 6.5, 6.5, 3.4, WS, 0, 0);
  L(17, 24, 17 + Math.sin(p.tail || 0) * 0.8, 19.5, 3.4, B); // cropped stub
  E(19, 26, 6, 7, S); E(29, 27, 13, 7.5, S); E(40, 28, 6, 7.5, S);
  E(19, 25, 5.6, 6.4, B); E(29, 26, 12.5, 6.8, B); E(40, 27.4, 5.6, 6.9, B); E(28, 20.6, 9, 1.3, H);
  E(44, 29, 3, 5.4, W); P([[24, 31], [40, 31], [38, 34], [26, 34]], W);
  if (p.sweater) {
    P([[16, 22], [28, 18.6], [42, 20.6], [44, 30], [30, 33], [17, 31]], '#6f7376');
    P([[18, 26], [30, 23.6], [43, 25.4], [43, 27.2], [30, 25.6], [18, 28]], '#c4c2bd');
    E(36, 21.4, 1.2, 1.2, '#e8622a');
  }
  if (q.sit && !p.scratch) haunch(q, 21, 5.6, B, S, W, 8, 3.4);
  else leg(21, 31, a + q.bk + q.scratch, 7, 7.1, 3.9, W, 0, 0, 1, q.fold);
  front(q, 42, 31, b + q.fa, 6.5, 6.5, 3.7, W, 0, 0);
  o.save(); pivot(44, 22, p.head || 0); XF.head = o.getTransform();
  P([[39, 26], [44, 13], [52, 13], [48, 30]], B); E(50, 13, 6, 5.5, B); E(49, 9, 4, 1, H);
  P([[52, 10], [60, 11], [61, 13], [61, 17], [52, 18]], B); E(48.6, 16, 2.6, 2.2, G);
  P([[49, 7], [51, 7], [55.5, 11], [53.5, 12]], W);
  P([[52, 16], [61, 15.5], [62.4, 18], [60.6, 21.5], [58.8, 19.6], [57, 22], [55, 19.6], [53, 20.5]], W);
  if (p.tongue) P([[56.5, 18], [59.5, 18], [58.2, 22.6]], '#e06878');
  eye(54.2, 12, 1.1, '#8ec0ee', p);
  P([[51.5, 9.6], [56.5, 10.6], [56.5, 11.6], [51.5, 10.9]], '#a3a3a0'); // low, grumpy brow
  E(60.8, 12.4, 1.5, 1.3, '#0d0d0d');
  if (p.mouth) P([[57, 17.2], [61.5, 17.4], [58.5, 19.6]], '#3a1a1a');
  o.save(); pivot(51, 8, p.ear || 0); P([[47.5, 9], [48.6, 2], [51, 8]], S); P([[50, 9], [52, 1.4], [54.4, 8]], B); o.restore();
  o.restore();
}

function minnie(p) {
  const W = '#f5f1e8', S = '#d6cfc2', T = '#d3a16a', TD = '#b98550';
  const a = Math.sin(p.ph || 0) * (p.amp || 0), b = -a;
  const q = posture(p, [23, 32], 12, 3); XF.body = o.getTransform();
  if (q.sit) p.scratch ? haunch(q, 26, 5.6, S, S, S, 7, 2.2) : sitPaw(q, 26, 7, 2.2, S);
  else leg(25, 28, b + q.bk, 7.5, 9.5, 2.4, S, 0, 0, 1, q.fold);
  front(q, 39, 29, a + q.fa, 7.5, 7.6, 2.2, S, 0, 0);
  o.strokeStyle = W; o.lineWidth = 3.4; o.lineCap = 'round'; o.beginPath(); o.moveTo(19, 21); // tail curled into a ring
  o.quadraticCurveTo(14 + Math.sin(p.tail || 0) * 0.8, 15, 16, 10.5); o.quadraticCurveTo(19, 7.5, 22.5, 10); o.quadraticCurveTo(24, 13, 21, 14.5); o.stroke();
  E(23, 25, 6, 5.6, S); E(32, 25, 10.5, 4.8, S); E(41, 25.5, 5.8, 6.4, S);
  E(23, 24.4, 5.6, 5, W); E(32, 24.4, 10, 4.2, W); E(41, 25, 5.4, 5.8, W);
  P([[27, 26.5], [37, 29], [37, 27], [28, 25]], W); E(21.5, 25.5, 3.4, 4.8, T);
  if (q.sit && !p.scratch) haunch(q, 24, 5.8, W, S, W, 8, 2.4);
  else leg(22, 28, a + q.bk + q.scratch, 7.5, 9.5, 2.6, W, 0, 0, 1, q.fold);
  front(q, 41, 29, b + q.fa, 7.5, 7.6, 2.4, W, 0, 0);
  o.save(); pivot(42, 22, p.head || 0); XF.head = o.getTransform();
  P([[37.5, 24], [41.5, 12.5], [48, 12.5], [46, 27]], W);
  P([[40.6, 19], [46.6, 19.8], [46.4, 21.2], [40.2, 20.4]], '#141414'); // collar
  P([[43.2, 9.6], [42.2, 3.2], [45.4, 8.6]], S);
  E(48, 12, 5.2, 4.6, W); P([[51, 10.6], [57.6, 12.6], [58.2, 14.8], [52, 16.6]], W);
  E(46.4, 10.8, 3.6, 3.3, T); E(45, 12.6, 2.2, 2, TD);
  o.save(); pivot(46, 8.4, p.ear || 0); P([[43.8, 9], [45.6, 0.8], [48.6, 8.4]], W); P([[44.8, 8.6], [45.8, 3.2], [47.4, 8.4]], T); o.restore();
  eye(50.2, 10.6, 1, '#1e120c', p); E(57.8, 13.4, 1.35, 1.15, '#0d0d0d');
  if (p.mouth && !p.snarl) P([[52, 15.4], [57.6, 14.8], [55, 18]], '#1e120c');
  if (p.tongue) P([[53.5, 15.8], [56, 15.8], [55, 19.4]], '#e06878');
  if (p.snarl) { P([[51.5, 15.6], [58, 14], [58, 15.6], [52, 17]], '#1e120c'); o.fillStyle = '#ffffff'; o.fillRect(55.6, 14.8, 1.2, 1.4); }
  o.fillStyle = S; o.fillRect(52, 16.4, 1, 1.6); o.fillRect(54.2, 16, 1, 1.6); o.fillRect(56, 15.4, 1, 1.3);
  o.fillStyle = W; o.fillRect(45, -0.2, 1, 1); o.fillRect(46.6, 0, 1, 1); o.fillRect(42.4, 22.5, 1, 1);
  o.restore();
}

// Each dog's head: the pivot it turns about, its mouth, and the extra offset its head is drawn with.
const HEAD = { z: [50, 18, 63.5, 15, 0.5, -2.5], f: [44, 22, 58.5, 18.5, 0, 0], m: [42, 22, 55, 16.5, 0, 0] };
/** Where a dog's mouth is in its drawing for a pose (unscaled, before PAD), following the same head
 *  offset and tilt as its drawing and the body bob, so a carried ball or rope sits in its mouth. */
export function mouthPoint(p, k = 'z') {
  const [px, py, mx, my, ox, oy] = HEAD[k], a = p.head || 0, dx = mx - px, dy = my - py;
  const x = px + dx * Math.cos(a) - dy * Math.sin(a), y = py + dx * Math.sin(a) + dy * Math.cos(a);
  return [x + ox, y + oy + (p.bob || 0) + (p.y || 0)];
}

const DRAW = { z: ziggy, f: frank, m: minnie };
const work = {};

// Headroom above the drawing, for sitting up, hopping and holiday hats: 8 drawing units, plus LIFT whole sprite
// pixels added as rows above (see render()), which makes PAD at least 13. Ziggy needs the most: his snow
// pounce leaps 16 units with his feathers or Santa hat on; Frank's crooked party hat needs 6 for a hop.
// WIDE adds whole columns at the right, for a hat that tips past the nose (Ziggy's bunny ears need 2, landing
// nose-first in snow). Both are set by the pose-grid clip test of every outfit (holiday-proposals/clip.html?src=outfits).
const LIFT = { z: 11, f: 6, m: 4 };
const WIDE = { z: 2, f: 0, m: 0 };
/** Headroom per dog, in drawing units: a point at drawing y sits at canvas y (y + PAD[k]) * SIZE[k]. */
export const PAD = Object.fromEntries(Object.keys(SIZE).map(k => [k, 8 + LIFT[k] / SIZE[k]]));

/** Buffer size in sprite pixels for a dog, and where its feet touch the ground.
 *  lift: the sprite pixels of headroom added for hats, above what the dogs had before; wide: the columns
 *  added at the right for them (body: the width without them). */
export const box = k => {
  const s = SIZE[k], l = LIFT[k], body = Math.ceil(72 * s);
  return { w: body + WIDE[k], h: Math.ceil(56 * s) + l, footY: Math.round(52 * s) + l, cx: Math.round(40 * s), lift: l, body };
};

// Stamps one outfit part (see outfits.js) into the snapped pixels: the art follows its frame's transform,
// turning with it in whole sprite pixels, and marks the mask so the outline goes round it too.
const RGB = new WeakMap();
function stamp(part, d, mask, w, h, dy) {
  const m = XF[part.frame || 'head'];
  if (!m) return;
  let pal = RGB.get(part);
  if (!pal) RGB.set(part, (pal = Object.fromEntries(Object.entries(part.pal).map(([ch, c]) => [ch, rgb(c)]))));
  const a = m.transformPoint({ x: part.at[0], y: part.at[1] });
  a.y += dy; // the rows the drawing was moved down by
  let th = Math.atan2(m.b, m.a) * (part.turn ?? 1);
  if (Math.abs(th) < 0.07) th = 0; // dead level: keep the art pixel-perfect
  const c = Math.cos(th), s = Math.sin(th), rows = part.rows, [px, py] = part.pivot;
  const ax = th ? a.x : Math.round(a.x * 2) / 2, ay = th ? a.y : Math.round(a.y * 2) / 2;
  const R = Math.ceil(Math.hypot(rows[0].length, rows.length)) + 1, x0 = Math.floor(ax), y0 = Math.floor(ay);
  for (let Y = Math.max(0, y0 - R); Y <= Math.min(h - 1, y0 + R); Y++) for (let X = Math.max(0, x0 - R); X <= Math.min(w - 1, x0 + R); X++) {
    const rx = X + 0.5 - ax, ry = Y + 0.5 - ay;
    const ch = rows[Math.floor(-s * rx + c * ry + py)]?.[Math.floor(c * rx + s * ry + px)];
    if (!ch || ch === '.') continue;
    const i = Y * w + X;
    if (part.behind && mask[i]) continue;
    const col = pal[ch], j = i * 4;
    d[j] = col[0]; d[j + 1] = col[1]; d[j + 2] = col[2]; d[j + 3] = 255;
    mask[i] = 1;
  }
}

/** The highest canvas row an outfit reaches, its outline included, while the dog stands or sits; null for
 *  none. Speech bubbles go up to clear it. */
const TOPS = new WeakMap();
export function outfitTop(k, parts) {
  if (!parts) return null;
  let t = TOPS.get(parts);
  if (t === undefined) {
    const { w, h } = box(k), c = Object.assign(document.createElement('canvas'), { width: w, height: h }).getContext('2d', { willReadFrequently: true });
    const draw = (p, pp) => { c.clearRect(0, 0, w, h); render(k, p, c, pp); return c.getImageData(0, 0, w, h).data; };
    t = h;
    for (const p of [{}, { sit: 1 }]) {
      const a = draw(p), b = draw(p, parts), i = a.findIndex((v, j) => v !== b[j]);
      if (i >= 0) t = Math.min(t, Math.floor(i / 4 / w));
    }
    TOPS.set(parts, t);
  }
  return t;
}

/** Draws a dog in a pose onto ctx (a canvas sized by box()), wearing parts (an outfit's parts, if any). */
export function render(k, pose, out, parts) {
  const { w, h, lift } = box(k), sc = SIZE[k];
  // The dog is drawn on a canvas the size it always had, then moved down `lift` whole rows into the headroom:
  // drawing it lower down, or on a taller canvas, rounds some edges differently and changes its pixels.
  // Only a pose that reaches the top edge is drawn again, on the taller canvas, so nothing is cut off.
  if (!work[k]) work[k] = [h - lift, h].map(ch => Object.assign(document.createElement('canvas'), { width: w, height: ch }).getContext('2d', { willReadFrequently: true }));
  let id, dy;
  for (const top of [0, lift]) {
    o = work[k][top ? 1 : 0];
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.clearRect(0, 0, w, h);
    XF.body = XF.head = null;
    o.save(); o.translate(0, top); o.scale(sc, sc); o.translate(0, 8); DRAW[k](pose); o.restore();
    const got = o.getImageData(0, 0, w, h - lift + top);
    if (top) { id = got; dy = 0; break; }
    if (!got.data.subarray(0, w * 4).some((v, i) => i % 4 === 3 && v)) { id = new ImageData(w, h); id.data.set(got.data, lift * w * 4); dy = lift; break; }
  }
  const d = id.data, pal = PRGB[k], mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    if (d[j + 3] < 110) { d[j + 3] = 0; continue; }
    mask[i] = 1;
    let best = 0, bd = 1e9;
    for (let n = 0; n < pal.length; n++) {
      const c = pal[n], e = (c[0] - d[j]) ** 2 + (c[1] - d[j + 1]) ** 2 + (c[2] - d[j + 2]) ** 2;
      if (e < bd) { bd = e; best = n; }
    }
    d[j] = pal[best][0]; d[j + 1] = pal[best][1]; d[j + 2] = pal[best][2]; d[j + 3] = 255;
  }
  if (parts) for (const part of parts) stamp(part, d, mask, w, h, dy);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (mask[i]) continue;
    if ((x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) || (y > 0 && mask[i - w]) || (y < h - 1 && mask[i + w])) {
      const j = i * 4; d[j] = ORGB[0]; d[j + 1] = ORGB[1]; d[j + 2] = ORGB[2]; d[j + 3] = 255;
    }
  }
  out.putImageData(id, 0, 0);
  // Little effects drawn straight in pixels, without an outline.
  if (pose.puff) {
    const [nx, ny] = NOSE[k], f = pose.puff;
    out.fillStyle = `rgba(235,242,250,${(1 - f).toFixed(2)})`;
    const x = Math.round((nx + 2 + f * 6) * sc), y = Math.round((ny + 8 - f * 5) * sc) + lift, r = Math.round(1 + f * 2);
    out.fillRect(x, y, r * 2, r); out.fillRect(x + 1, y - 1, r, r * 2);
  }
  if (pose.splash) {
    const f = pose.splash, y0 = Math.round(52 * sc) + lift;
    out.fillStyle = '#9cc6ee';
    for (const [x, dx] of [[24, -3], [30, 2], [44, -2], [50, 3]]) {
      const px = Math.round((x + dx * f * 2) * sc), py = Math.round(y0 - Math.sin(f * Math.PI) * 6 * sc);
      out.fillRect(px, py, 1, 1);
    }
  }
}
