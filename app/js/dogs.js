// Ziggy, Frank and Minnie roam the screen. Each picks what to do next at random, weighted by its
// personality and by the weather (see conditions.js), so no two minutes look the same.
// Ziggy is hyper and playful, Frank grumpy and protective, Minnie absent-minded and aloof.
//
// Dogs stand on "surfaces": the top of the tab bar (the ground), the top edges of tiles and cards,
// and the big temperature. Surfaces are looked up afresh every frame, because the views re-render.
// Debug: ?dogspeed=8 speeds everything up; ?dogact=zoomies forces an activity for every dog that has it;
// ?dogact=ball throws a tennis ball every few seconds.

import { render, box, NOSE, SIZE, mouthPoint } from './sprites.js';

const q = new URLSearchParams(location.search);
const SPEED = Math.max(0.1, +q.get('dogspeed') || 1);
const FORCE = q.get('dogact');
const K = 2; // screen pixels per sprite pixel
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pick = list => {
  const total = list.reduce((s, [, w]) => s + Math.max(0, w), 0);
  let r = Math.random() * total;
  for (const [v, w] of list) if ((r -= Math.max(0, w)) <= 0) return v;
  return list[0][0];
};

let root, opts = {}, dogs = [], ball = null, k = null, raf = 0, still = false, lastDraw = 0, suppressClick = 0, tap = null, scrolled = true;

const DEFS = [
  { k: 'z', name: 'Ziggy', walk: 52, run: 190, start: ['ground', 0.22] },
  { k: 'f', name: 'Frank', walk: 34, run: 90, start: ['ground', 0.72] },
  { k: 'm', name: 'Minnie', walk: 28, run: 70, start: ['ground', 0.5] },
];

// ---------- surfaces ----------

function surfaces() {
  const out = new Map();
  const tabs = document.querySelector('.tabs')?.getBoundingClientRect();
  const groundY = tabs ? tabs.top : innerHeight;
  // Surfaces need room above them for a dog (about 100px tall) and its speech bubble, below the header.
  const hdr = document.querySelector('.top')?.getBoundingClientRect().bottom || 0, topY = hdr + 140;
  out.ceil = hdr + 105; // no jump arc takes a dog's feet higher than this
  out.set('ground', { l: 0, r: innerWidth, y: groundY, ground: true });
  const view = document.querySelector('.view:not([hidden])');
  if (!view) return out;
  const cards = [...view.querySelectorAll('.card')];
  view.querySelectorAll('.tile, .card, .hero-temp').forEach(el => {
    if (el.classList.contains('dragging') || el.closest('.dragging')) return;
    let r = el.getBoundingClientRect();
    if (el.classList.contains('hero-temp')) {
      const range = document.createRange();
      range.selectNodeContents(el);
      r = range.getBoundingClientRect();
      r = { left: r.left, right: r.right, top: r.top + r.height * 0.12, width: r.width };
    }
    if (r.top < topY || r.top > groundY - 40 || r.width < 70) return;
    const key = el.dataset.id ? `tile:${el.dataset.id}` : el.classList.contains('hero-temp') ? 'hero' : `card:${cards.indexOf(el)}`;
    out.set(key, { l: r.left + 10, r: r.right - 10, y: Math.round(r.top) + 1, el });
  });
  return out;
}

const at = (S, key, fx) => {
  const s = S.get(key) || S.get('ground');
  return { x: s.l + fx * (s.r - s.l), y: s.y, s };
};

// ---------- activities ----------
// Each returns { dur, pose(d, u, t) } and may set d.move (walk target) or start a jump.

const still_ = (dur, pose) => () => ({ dur: rnd(...dur), pose });
const ACTS = {
  sit: still_([6, 14], (d, u, t) => ({ sit: 1, head: 0.08 * Math.sin(t * 0.7 + d.seed) })),
  lie: still_([8, 18], () => ({ lie: 1, head: 0.15 })),
  nap: d => ({ dur: rnd(12, 30), bubble: 'z z', pose: (dd, u, t) => ({ lie: 1, eyes: dd.def.k === 'f' && Math.sin(t * 0.5 + dd.seed) > 0.85 ? 1 : 0, head: dd.def.k === 'f' && Math.sin(t * 0.5 + dd.seed) > 0.85 ? -0.1 : 0.32 }) }),
  look: () => ({ dur: rnd(3, 6), pose: (d, u) => { if (u > 0.5 && !d.turned) { d.facing *= -1; d.turned = 1; } return { head: -0.05 }; } }),
  scratch: still_([1.4, 2.4], () => ({ sit: 1, scratch: 1, head: 0.15 })),
  yawn: still_([1.8, 2.4], (d, u) => ({ sit: 1, mouth: u > 0.3 && u < 0.75 ? 1 : 0, eyes: u > 0.3 && u < 0.75 ? 0 : 1, head: -0.15 })),
  sniff: d => { walkTo(d, d.fx + rnd(-0.15, 0.15)); d.slow = 0.35; return { dur: rnd(2.5, 4.5), pose: (dd, u, t) => ({ head: 0.5 + 0.05 * Math.sin(t * 12) }) }; },
  wander: d => { walkTo(d, rnd(0.08, 0.92)); return { dur: 12, untilArrive: 1 }; },
  hop: d => { jumpTo(d, hopTarget(d)); return { dur: 9, untilLand: 1 }; },
  playbow: still_([1.1, 1.5], () => ({ bow: 0.2, mouth: 1, ear: -0.2 })),
  zoomies: d => needGround(d, 'zoomies') || { dur: rnd(3.5, 5), run: 1, pose: (dd, u) => { if (!dd.move) walkTo(dd, dd.fx > 0.5 ? rnd(0.04, 0.2) : rnd(0.8, 0.96)); return { mouth: 1, ear: -0.3 }; } },
  bark: d => ({ dur: rnd(1.4, 2.2), bubble: 'WOOF!', pose: (dd, u, t) => { const m = Math.floor(t * 4) % 2; return { mouth: m, head: -0.14 * m }; } }),
  guard: d => needGround(d, 'guard') || (walkTo(d, Math.random() < 0.5 ? 0.06 : 0.94), { dur: rnd(5, 10), pose: (dd) => { if (!dd.move) dd.facing = dd.fx < 0.5 ? -1 : 1; return { head: -0.06, ear: -0.1 }; } }),
  grumble: d => { d.facing *= -1; return { dur: 2.6, bubble: 'hmph', pose: () => ({ sit: 1, head: 0.1 }) }; },
  gaze: still_([4, 8], (d, u, t) => ({ sit: 1, head: -0.38 + 0.04 * Math.sin(t) })),
  wanderoff: d => needGround(d, 'wanderoff') || (walkTo(d, d.fx < 0.5 ? -0.3 : 1.3), d.queue.push('comeback'), { dur: rnd(14, 22), untilArriveThenWait: 1 }),
  comeback: d => { walkTo(d, rnd(0.2, 0.8)); return { dur: 15, untilArrive: 1 }; },
  // Weather
  shake: still_([1, 1.3], () => ({ shake: 1 })),
  splash: d => needGround(d, 'splash') || { dur: 2.6, pose: (dd, u, t) => ({ y: -Math.abs(Math.sin(t * 7)) * 5, splash: (t * 7 / Math.PI) % 1, mouth: 1, amp: 0.3, ph: 1.2 }) },
  glare: still_([3, 5], () => ({ sit: 1, head: -0.32 })),
  // Off the edge of the screen, facing away, so only her tail shows.
  hide: d => needGround(d, 'hide') || (walkTo(d, d.fx < 0.5 ? -36 / innerWidth : 1 + 26 / innerWidth), d.queue.push('comeback'), { dur: rnd(14, 22), untilArriveThenWait: 1, pose: () => ({ lie: 1 }) }),
  chase: d => needGround(d, 'chase') || { dur: rnd(3, 4.5), run: 1, pose: (dd) => { if (!dd.move) walkTo(dd, dd.fx < 0.5 ? 0.95 : 0.05); return { mouth: 1, head: -0.15 }; } },
  catch: still_([2.5, 3.5], (d, u, t) => ({ y: -Math.abs(Math.sin(t * 5)) * 7, mouth: 1, head: -0.3 })),
  dig: still_([2, 3], (d, u, t) => ({ bow: 0.18, ph: t * 30, amp: 0.25, head: 0.3 })),
  curl: still_([15, 30], () => ({ lie: 1, eyes: 0, head: 0.38 })),
  sploot: still_([10, 20], () => ({ lie: 1, head: 0.3 })),
  shade: d => (d.surf === 'ground' && Math.random() < 0.6 ? (d.queue.push('shade'), ACTS.hop(d)) : { dur: rnd(12, 20), pose: () => ({ lie: 1 }) }),
  sunbathe: still_([15, 25], () => ({ lie: 1, eyes: 0, head: -0.05 })),
  shadow: still_([2.5, 3.5], (d, u, t) => { const f = Math.floor(t * 3) % 2 ? 1 : -1; d.facing = f; return { ph: t * 14, amp: 0.5, mouth: 1 }; }),
  squint: still_([4, 6], () => ({ sit: 1, eyes: 0, head: -0.1 })),
  pace: d => { walkTo(d, d.fx < 0.5 ? rnd(0.6, 0.9) : rnd(0.1, 0.4)); d.slow = 1.6; return { dur: 8, untilArrive: 1 }; },
  // Taps
  come: d => needGround(d, 'come') || (walkTo(d, d.tapFx ?? 0.5), { dur: 10, untilArrive: 1 }),
  ignore: d => { d.facing *= -1; return { dur: 2, pose: () => ({ sit: 1, head: -0.2 }) }; },
  // Frank: furious barking, with a lunge on every woof.
  angrybark: () => ({ dur: 2.6, bubble: 'WOOF! WOOF!', mood: 'angry', fx: 'anger', pose: (d, u, t) => { const m = Math.floor(t * 6) % 2; return { mouth: m, head: -0.14 * m, ear: -0.4, x: m * 1.5 }; } }),
  // Ziggy: delighted yips, bouncing on the spot.
  happybark: () => ({ dur: 2.4, bubble: 'Woof! Woof!', mood: 'happy', fx: 'joy', pose: (d, u, t) => ({ mouth: 1, head: -0.22 - 0.08 * (Math.floor(t * 5) % 2), y: -Math.abs(Math.sin(t * 9)) * 4, ear: 0.2 }) }),
  // Minnie: a low growl, lip curled, ears pinned back.
  growl: d => { d.queue.push('ignore'); return { dur: 2.4, bubble: 'grrrrr…', mood: 'growl', fx: 'growl', pose: (dd, u, t) => ({ head: 0.12, ear: -0.7, snarl: 1, x: Math.sin(t * 50) * 0.5 }) }; },
};

// ---------- the ruckus ----------
// Now and then Ziggy pesters Minnie: play bows and little nips. Minnie flinches and pretends not to care.
// Frank, who is protective of her, growls, rushes over and chases Ziggy off, then stands guard by her.

const RUCKUS_GAP = 150; // seconds between ruckuses, at normal speed
let clock = 0, lastRuckus = -1e9, curS = new Map();
const [Z, F, M] = [0, 1, 2];
const width = key => { const s = curS.get(key) || curS.get('ground'); return Math.max(80, s.r - s.l); };
const onScreen = d => !!d && !d.grabbed && curS.has(d.surf) && d.fx >= 0 && d.fx <= 1 && !d.jump;
/** fx on target's surface, px pixels beside it, on the side the mover is coming from. */
function beside(target, mover, px) {
  const side = (mover.sx ?? 0) < (target.sx ?? 0) ? -1 : 1;
  return Math.min(0.97, Math.max(0.03, target.fx + (side * px) / width(target.surf)));
}
function interrupt(d, name) {
  if (d.grabbed) return;
  d.queue = [name];
  d.move = null;
  if (!d.jump) choose(d);
}
function canRuckus() {
  const m = dogs[M];
  return !still && !grab && !k.night && !k.hot && !k.rain && !k.snowing && clock - lastRuckus > RUCKUS_GAP
    && onScreen(m) && !['hide', 'wanderoff', 'comeback'].includes(m.actName);
}

Object.assign(ACTS, {
  // Ziggy: goes to Minnie, play-bows, then lunges with a nip, over and over.
  pester: z => {
    lastRuckus = clock;
    return {
      dur: 14,
      pose: (d, u, t) => {
        const m = dogs[M];
        if (!onScreen(m) && !m.jump) { d.actT = d.act.dur; return {}; }
        if (d.jump || m.jump) return { mouth: 1 };
        if (d.surf !== m.surf) { jumpTo(d, [m.surf, beside(m, d, 24)]); return { mouth: 1 }; }
        if (Math.abs(d.sx - m.sx) > 34) { walkTo(d, beside(m, d, 24)); d.slow = 1.6; return { mouth: 1, ear: -0.2 }; }
        d.move = null;
        d.facing = m.sx > d.sx ? 1 : -1;
        const c = (t * 1.3) % 1;
        if (c < 0.55) return { bow: 0.22, ear: -0.25 };
        if (!d.nipped) { d.nipped = 1; say(d, 'nip!', 1); onNip(d, m); }
        return { mouth: 1, x: d.facing * 3, ear: -0.35 };
      },
    };
  },
  // Minnie: a startled hop, ears back, then she turns away as if nothing happened.
  flinch: m => {
    m.queue.push('ignore');
    return { dur: 1.1, pose: (d, u) => ({ y: u < 0.4 ? -Math.sin((u / 0.4) * Math.PI) * 4 : 0, ear: 0.5, head: -0.15 }) };
  },
  // Frank: growls, rushes to Ziggy (hopping between surfaces if he must), and chases him.
  rescue: f => {
    say(f, 'GRR!', 1.4);
    f.queue.push('guardM');
    return {
      dur: 12, run: 1,
      pose: (d, u, t) => {
        const z = dogs[Z];
        if (z.fx < -0.15 || z.fx > 1.15) { d.actT = d.act.dur; return {}; } // Ziggy has gone
        if (d.jump || z.jump) return { mouth: 1 };
        if (d.surf !== z.surf) { jumpTo(d, [z.surf, beside(z, d, 30)]); return { mouth: 1 }; }
        if (!d.chasing && Math.abs(d.sx - z.sx) < 40) { d.chasing = 1; interrupt(z, 'flee'); say(d, 'WOOF! WOOF!', 2.2); }
        walkTo(d, Math.min(0.97, Math.max(0.03, z.fx)));
        return { mouth: Math.floor(t * 5) % 2, head: -0.05, ear: -0.15 };
      },
    };
  },
  // Ziggy: drops to the ground and bolts off the edge of the screen, then wanders back later.
  flee: z => {
    const f = dogs[F], away = (f.sx ?? 0) < (z.sx ?? 0) ? 1 : -1;
    if (z.surf !== 'ground') {
      z.queue.unshift('flee');
      jumpTo(z, ['ground', Math.min(0.9, Math.max(0.1, (z.sx + away * 60) / innerWidth))]);
      return { dur: 9, untilLand: 1, run: 1 };
    }
    walkTo(z, away > 0 ? 1.35 : -0.35);
    z.queue.push('comeback');
    return { dur: rnd(5, 8), run: 1, untilArriveThenWait: 1, pose: () => ({ mouth: 1, ear: -0.35 }) };
  },
  // Frank: back to Minnie's side, sitting watch with his back to her.
  guardM: f => {
    const m = dogs[M];
    if (!onScreen(m)) return { dur: 3, pose: () => ({ sit: 1, head: -0.06 }) };
    if (f.surf !== m.surf) { f.queue.unshift('guardM'); jumpTo(f, [m.surf, beside(m, f, 30)]); return { dur: 9, untilLand: 1 }; }
    walkTo(f, beside(m, f, 30));
    return {
      dur: rnd(10, 14),
      pose: d => {
        if (d.move) return {};
        d.facing = d.sx < m.sx ? -1 : 1;
        return { sit: 1, head: -0.06, ear: -0.1 };
      },
    };
  },
});

function onNip(z, m) {
  interrupt(m, 'flinch');
  const f = dogs[F];
  // Even on guard, he goes after Ziggy; only a chase already under way is left alone.
  if (f.actName !== 'rescue') setTimeout(() => interrupt(f, 'rescue'), 450 / SPEED);
}

function needGround(d, act) {
  if (d.surf === 'ground') return null;
  d.queue.unshift(act);
  jumpTo(d, ['ground', rnd(0.15, 0.85)]);
  return { dur: 9, untilLand: 1 };
}

function walkTo(d, fx) {
  d.move = { fx };
  d.facing = fx >= d.fx ? 1 : -1;
}

function hopTarget(d) {
  const S = surfaces(), opts_ = [];
  for (const key of S.keys()) {
    if (key === d.surf) continue;
    if (key === 'ground' && d.def.k === 'f' && k?.hotGround) continue; // Frank won't touch hot pavement
    const w = key === 'ground' ? 2.5 : key === 'hero' ? (d.def.k === 'm' ? 2 : 0.6) : 1;
    opts_.push([key, w]);
  }
  return opts_.length ? [pick(opts_), rnd(0.15, 0.85)] : ['ground', rnd(0.1, 0.9)];
}

function jumpTo(d, [key, fx]) {
  d.jump = { from: [d.surf, d.fx], to: [key, fx], t: 0, dur: 0.75 };
  d.move = null;
}

// What each dog tends to do, given the weather.
function weights(d) {
  const z = d.def.k === 'z', f = d.def.k === 'f', m = d.def.k === 'm';
  if (k.night) return [['nap', 10], ['lie', 1.5], ['sit', 0.4], ['wander', m ? 0.5 : 0.05], ['look', f ? 0.6 : 0.1]];
  const w = z
    ? { sit: 3, lie: 3, nap: 1, look: 1.5, scratch: 0.7, yawn: 0.5, wander: 3, hop: 2.5, sniff: 1, playbow: 0.8, zoomies: 0.8, pester: canRuckus() ? 1.4 : 0 }
    : f
      ? { sit: 4, lie: 3, nap: 2, look: 1.5, scratch: 0.5, yawn: 0.5, wander: 1.5, hop: 1, sniff: 1, guard: 1.5, bark: 0.5, grumble: 0.5 }
      : { sit: 3, lie: 3, nap: 2, look: 1, scratch: 0.5, yawn: 0.5, wander: 2.5, hop: 1, sniff: 2, gaze: 2, wanderoff: 0.5 };
  const add = (o) => { for (const [a, v] of Object.entries(o)) w[a] = (w[a] || 0) + v; };
  if (k.rain) z ? add({ splash: 4, shake: 1.5 }) : f ? add({ shake: 2, glare: 3 }) : add({ hide: 4, shake: 1 });
  else if (k.puddles && z) add({ splash: 2 });
  if (k.windy) z ? add({ chase: 4 }) : f ? add({ bark: 3 }) : 0;
  if (k.snowing) z ? add({ catch: 4, dig: 1.5 }) : m ? add({ curl: 3 }) : add({ sit: 2 });
  else if (k.cold) z ? add({ dig: 0.5 }) : m ? add({ curl: 3 }) : 0;
  if (k.hot) {
    z ? add({ sploot: 5 }) : f ? add({ lie: 3 }) : add({ shade: 4 });
    w.zoomies = 0; w.playbow = (w.playbow || 0) * 0.3; w.wander *= 0.4; w.hop *= 0.5;
  }
  if (k.sunny && !k.hot) z ? add({ shadow: 2 }) : f ? add({ squint: 2 }) : add({ sunbathe: 4 });
  if (k.falling) z ? add({ pace: 4 }) : f ? add({ guard: 5, bark: 2 }) : 0;
  return Object.entries(w);
}

function choose(d) {
  d.turned = 0; d.slow = 1; d.move = null; d.nipped = 0; d.chasing = 0;
  let name = d.queue.shift();
  // Frank won't stand on hot pavement: first thing, he finds a tile.
  if (!name && !still && k.hotGround && d.def.k === 'f' && d.surf === 'ground' && surfaces().size > 1) name = 'hop';
  if (!name) {
    if (FORCE && ACTS[FORCE] && weights(d).some(([a]) => a === FORCE)) name = FORCE;
    else if (still) name = pick([['sit', 1], ['lie', 1]]);
    else name = pick(weights(d));
  }
  d.actName = name;
  d.act = ACTS[name](d) || { dur: 2 };
  d.actT = 0;
  if (d.act.bubble) say(d, d.act.bubble, Math.min(d.act.dur, 3), d.act.mood);
  else { d.bubble.hidden = true; clearTimeout(d.bubbleTimer); }
  showFx(d, d.act.fx);
}

// ---------- per-frame ----------

function say(d, text, secs, mood = '') {
  d.bubble.textContent = text;
  d.bubble.className = `bubble ${mood}`;
  d.bubble.hidden = false;
  clearTimeout(d.bubbleTimer);
  d.bubbleTimer = setTimeout(() => { d.bubble.hidden = true; }, secs * 1000);
}

// ---------- accents ----------
// Little pixel marks around a dog's head: anger veins, hearts, growl lines. Offsets are screen pixels
// from the nose for a dog facing right; the whole group is mirrored when it faces left.

/** Pixel art as an SVG: one row string per line, '.' for empty; col is a colour, or a map of colour per letter. */
const pix = (rows, col, z = 3) => {
  let r = '';
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== '.') r += `<rect x="${x}" y="${y}" width="1" height="1"${typeof col === 'object' ? ` fill="${col[c]}"` : ''}/>`;
  }));
  return `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" width="${rows[0].length * z}" height="${rows.length * z}"${typeof col === 'string' ? ` fill="${col}"` : ''} shape-rendering="crispEdges" style="display:block">${r}</svg>`;
};
const VEIN = pix(['.xx.xx.', 'x.x.x.x', 'xx...xx', '.......', 'xx...xx', 'x.x.x.x', '.xx.xx.'], '#e3342f');
const HEART = pix(['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'], '#ff6b8f');
const STAR = pix(['..x..', '.xxx.', 'xxxxx', '.xxx.', '..x..'], '#f5c518', 2);
const ZIG = pix(['x...x...', '.x.x.x.x', '..x...x.'], 'currentColor');
const FX = {
  anger: [[VEIN, -26, -38, 0], [VEIN, -6, -46, 0.22], [VEIN, -42, -24, 0.4]],
  joy: [[HEART, -28, -32, 0], [HEART, -10, -40, 0.4], [HEART, -42, -22, 0.8]],
  growl: [[ZIG, 6, -6, 0], [ZIG, 9, 4, 0.12], [ZIG, 5, 14, 0.24]],
  dizzy: [[STAR, -22, -34, 0], [STAR, -22, -34, -0.3], [STAR, -22, -34, -0.6]],
};
function showFx(d, kind) {
  if (!kind || still) { d.fx_.hidden = true; return; }
  d.fx_.className = `fx ${kind}`;
  d.fx_.innerHTML = FX[kind].map(([svg, x, y, delay]) => `<i style="left:${x}px;top:${y}px;animation-delay:${delay}s">${svg}</i>`).join('');
  d.fx_.hidden = false;
}

// ---------- the tennis ball ----------
// Now and then a ball bounces in from one side and all three chase it. Ziggy, the fastest,
// sometimes catches it and prances about with it; otherwise it rolls off the other side.

const BALL_GAP = [150, 360]; // seconds between balls, at normal speed
let nextBall = FORCE === 'ball' ? 2 : rnd(40, 110);
const BALL_PX = pix(['..oooo..', '.oyyywo.', 'oyyyyywo', 'oyyyywyo', 'oywwwyyo', 'owyyyyso', '.oyssso.', '..oooo..'],
  { o: '#3d4a14', y: '#d5e83f', s: '#aabd2a', w: '#f7f7ea' }, K);
const noseOff = d => (NOSE[d.def.k][0] * SIZE[d.def.k] - d.box.cx) * K;

function ballReady() {
  if (FORCE === 'ball') return clock > nextBall;
  return clock > nextBall && !still && !grab && !k.night && !k.snowing
    && !dogs.some(d => ['pester', 'rescue', 'flee', 'flinch'].includes(d.actName));
}

function throwBall() {
  const fromLeft = Math.random() < 0.5;
  const el = document.createElement('span');
  el.className = 'ball';
  el.innerHTML = BALL_PX;
  root.append(el);
  ball = { el, x: fromLeft ? -20 : innerWidth + 20, vx: (fromLeft ? 1 : -1) * rnd(140, 185), h: rnd(90, 150), vh: 0, spin: 0, held: null, gone: false, age: 0, catchable: Math.random() < 0.6 };
  nextBall = clock + (FORCE === 'ball' ? 12 : rnd(...BALL_GAP));
  dogs.forEach((d, i) => setTimeout(() => { if (ball && !ball.held) interrupt(d, 'fetch'); }, [0, 350, 700][i] / SPEED));
}

function moveBall(dt, S) {
  const b = ball, gy = S.get('ground').y;
  if (b.held && b.held.actName !== 'proud') { b.held = null; b.vx = 0; b.h = Math.max(0, gy - b.y); b.fade = 1.5; } // interrupted: he drops it
  if (b.held) {
    const z = b.held;
    // Centred on his mouth (b.y is the ball's bottom; it is 16px tall).
    const [mx, my] = mouthPoint(z.pose || {});
    b.x = z.sx + z.facing * ((mx + (z.pose?.x || 0)) * SIZE.z - z.box.cx) * K;
    b.y = z.sy - (z.box.footY - (my + 8) * SIZE.z) * K + 8;
  } else {
    b.age += dt;
    b.vh -= 900 * dt;
    b.h += b.vh * dt;
    if (b.h <= 0) { b.h = 0; b.vh = Math.abs(b.vh) * 0.68; if (b.vh < 40) b.vh = 0; }
    b.x += b.vx * dt;
    b.spin += b.vx * dt;
    b.y = gy - b.h;
    if (b.x < -40 || b.x > innerWidth + 40) b.gone = true;
    // Ziggy snaps it up if his nose gets to it while it's low, after a proper chase (and not every time).
    const z = dogs[Z];
    if (!b.gone && !b.fade && b.catchable && b.age > 2.5 && z.actName === 'fetch' && !z.jump && z.surf === 'ground' && b.h < 22
      && Math.abs(z.sx + z.facing * noseOff(z) - b.x) < 14) {
      b.held = z;
      interrupt(z, 'proud');
      for (const d of dogs) if (d !== z && d.actName === 'fetch') interrupt(d, d.def.k === 'f' ? 'grumble' : 'ignore');
    }
  }
  if (b.fade) {
    b.fade -= dt;
    b.el.style.opacity = Math.max(0, b.fade / 1.5);
    if (b.fade <= 0) b.gone = true;
  }
  b.el.style.transform = `translate(${Math.round(b.x - 8)}px, ${Math.round(b.y - 16)}px) rotate(${(Math.round(b.spin / 12) % 4) * 90}deg)`;
  if (b.gone) { b.el.remove(); ball = null; }
}

Object.assign(ACTS, {
  fetch: d => needGround(d, 'fetch') || {
    dur: 16, run: 1, bubble: d.def.k === 'z' ? 'BALL!!' : '!', mood: 'happy',
    pose: (dd, u, t) => {
      if (!ball || ball.gone) { dd.move = null; dd.actT = Math.max(dd.actT, dd.act.dur - 1.2); return { mouth: 1, head: -0.1 }; }
      // Run after it from behind, nose at its tail (right up to it once it can be caught),
      // never past the edges of the screen.
      const dir = Math.sign(ball.vx) || Math.sign(ball.x - dd.sx) || 1, gap = ball.catchable && ball.age > 2.5 ? 0 : 18;
      walkTo(dd, Math.min(0.97, Math.max(0.03, (ball.x - dir * (noseOff(dd) + gap)) / innerWidth)));
      dd.facing = dir;
      return { mouth: 1, ear: -0.35, head: -0.12 + 0.05 * Math.sin(t * 20) };
    },
  },
  // Ziggy, ball in mouth, trotting about very pleased with himself; then he drops it.
  proud: z => (z.slow = 0.55, {
    dur: rnd(6, 8), run: 1,
    pose: (d, u, t) => {
      if (!d.move) { walkTo(d, d.fx > 0.5 ? rnd(0.1, 0.4) : rnd(0.6, 0.9)); d.slow = 0.55; }
      if (u > 0.98 && ball?.held === d) { ball.held = null; ball.vx = 0; ball.h = Math.max(0, (curS.get('ground')?.y ?? ball.y) - ball.y); ball.vh = 0; ball.fade = 1.5; }
      return { ear: 0.25, head: -0.25 };
    },
  }),
});

function step(d, dt, t, S) {
  d.actT += dt;
  const a = d.act;
  // Movement along a surface.
  if (d.jump) {
    const j = d.jump;
    j.t += dt / j.dur;
    if (j.t >= 1) { d.surf = j.to[0]; d.fx = j.to[1]; d.jump = null; if (a?.untilLand) d.actT = a.dur; }
  } else if (d.move) {
    const s = S.get(d.surf) || S.get('ground');
    const speed = ((a?.run ? d.def.run : d.def.walk) * d.slow) / Math.max(80, s.r - s.l);
    const dir = Math.sign(d.move.fx - d.fx);
    d.fx += dir * speed * dt;
    d.walking = true;
    if (Math.sign(d.move.fx - d.fx) !== dir) {
      d.fx = d.move.fx; d.move = null; d.walking = false;
      if (a?.untilArrive) d.actT = a.dur;
    }
  } else d.walking = false;
  // A surface that disappeared (view change, re-render, dragged tile): drop to the ground.
  if (!d.jump && !S.has(d.surf)) {
    d.jump = { fromXY: [d.sx ?? innerWidth / 2, d.sy ?? innerHeight], to: ['ground', Math.min(0.9, Math.max(0.1, (d.sx ?? 0) / innerWidth))], t: 0, dur: 0.6 };
    d.surf = 'ground'; d.move = null;
  }
  if (!a || d.actT >= a.dur * (a.untilArriveThenWait && d.move ? 99 : 1)) choose(d);

  const u = d.act.dur ? Math.min(1, d.actT / d.act.dur) : 0;
  const pose = { t, tail: 0, ...(d.act.pose ? d.act.pose(d, u, t) : {}) };
  // Gait while walking or in the air.
  if (d.walking || d.jump) {
    const fast = d.act?.run;
    pose.ph = t * (fast ? 22 : 11) * (d.def.k === 'm' ? 1.1 : 1); pose.amp = fast ? 0.75 : 0.45;
    pose.bob = -Math.abs(Math.sin(pose.ph)) * (fast ? 1.5 : 0.8);
    pose.sit = 0; pose.lie = 0;
  }
  // Personality in the tail.
  pose.tail = d.def.k === 'z' ? t * (k.night ? 2 : 14) : d.def.k === 'f' ? Math.sin(t * 9) * 0.4 : t * 2;
  // Weather touches that apply whatever they are doing.
  if (k.hot) pose.tongue = 1;
  if (k.cold && d.def.k === 'f') pose.sweater = 1;
  if (k.cold && !k.night) pose.puff = ((t + d.seed) % 2.6) / 2.6 < 0.6 ? ((t + d.seed) % 2.6) / 1.56 : 0;
  if (k.windy) pose.ear = d.def.k === 'm' ? -0.9 : (pose.ear || 0) + Math.sin(t * 20) * 0.25;
  if (k.cold && !pose.lie && !d.walking) pose.x = Math.sin(t * 60) * 0.6; // shiver
  d.pose = pose;
}

function place(d, S) {
  let x, y;
  if (d.jump) {
    const j = d.jump, A = j.fromXY ? { x: j.fromXY[0], y: j.fromXY[1] } : at(S, ...j.from), B = at(S, ...j.to), u = Math.min(1, j.t);
    x = A.x + (B.x - A.x) * u;
    const lift = Math.min(36 + Math.abs(B.y - A.y) * 0.25, Math.max(6, Math.min(A.y, B.y) - (S.ceil ?? 0)));
    y = A.y + (B.y - A.y) * u - Math.sin(Math.PI * u) * lift;
    d.facing = B.x >= A.x ? 1 : -1;
  } else ({ x, y } = at(S, d.surf, d.fx));
  const b = d.box;
  x += (d.pose?.x || 0) * K;
  // Just landed from a drop: squash flat, spring up tall, a little bounce, settle.
  let sc = '';
  if (d.squash > 0) {
    const u = 1 - d.squash / SQUASH, s = 0.28 * Math.exp(-u * 5) * Math.cos(u * 11);
    sc = ` scale(${(1 + s * 0.7).toFixed(3)}, ${(1 - s).toFixed(3)})`;
    if (u > 0.15 && u < 0.6) y -= Math.sin(((u - 0.15) / 0.45) * Math.PI) * 5;
  }
  d.cv.style.transform = `translate(${Math.round(x - b.cx * K)}px, ${Math.round(y - b.footY * K)}px) scaleX(${d.facing})${sc}`;
  d.bubble.style.transform = `translate(${Math.round(x - 24)}px, ${Math.round(y - b.footY * K * 0.8)}px) translateY(-100%)`;
  d.sx = x; d.sy = y;
  if (!d.fx_.hidden) {
    const [nx, ny] = NOSE[d.def.k], sc = SIZE[d.def.k];
    const hx = x + d.facing * (nx * sc - b.cx) * K, hy = y - (b.footY - (ny + 8 + (d.pose?.y || 0)) * sc) * K;
    d.fx_.style.transform = `translate(${Math.round(hx)}px, ${Math.round(hy)}px) scaleX(${d.facing})`;
  }
}

function frame(now) {
  raf = requestAnimationFrame(frame);
  if (!k) return;
  const t = now / 1000, rdt = Math.min(0.05, t - (frame.t || t)), dt = Math.min(0.1, (t - (frame.t || t))) * (still ? 0 : SPEED);
  frame.t = t;
  const draw = now - lastDraw > 90;
  if (draw) lastDraw = now;
  const moving = grab || dogs.some(d => d.jump || d.move);
  if (draw || moving || scrolled || !frame.S) { frame.S = surfaces(); scrolled = false; }
  const S = frame.S;
  curS = S;
  clock += dt;
  if (!ball && ballReady()) throwBall();
  if (ball) moveBall(dt, S);
  for (const d of dogs) {
    if (d.grabbed) grabStep(d, rdt, t, S);
    else step(d, dt, still ? 0 : t * SPEED, S);
    if (d.squash > 0) d.squash = Math.max(0, d.squash - rdt);
    if (draw || d.grabbed) render(d.def.k, d.pose, d.ctx);
    if (d.grabbed) placeGrab(d, S); else place(d, S);
  }
}

// ---------- picking a dog up ----------
// Press and hold a dog (a mouse can simply drag) to pick it up by the scruff. It dangles from the
// pointer and swings like a pendulum, while a shadow and a glowing ledge show where it will land.
// Let go and it falls, keeping the pointer's sideways speed, onto the first surface below.

const HOLD_MS = 300, SLOP = 10, GRAV = 2200, TURN = Math.PI / 12, SQUASH = 0.4;
// Where each dog is held, in its unscaled drawing.
const SCRUFF = { z: [49, 17], f: [43, 20], m: [41, 19] };
// How far each hangs nose-up: Frank holds himself stiff, Minnie goes limp.
const TILT = { z: 0.35, f: 0.22, m: 0.5 };
let grab = null, shadowEl, ledgeEl;

/** The scruff, in the dog's canvas, in screen pixels. */
const scruff = d => { const [x, y] = SCRUFF[d.def.k], s = SIZE[d.def.k]; return [x * s * K, (y + 8) * s * K]; };
/** The feet, relative to the scruff, for a dog held level. */
const feetRel = d => { const [gx, gy] = scruff(d); return [d.facing * (d.box.cx * K - gx), d.box.footY * K - gy]; };

function startHold(x, y) {
  const p = tap;
  tap = null;
  if (!p) return;
  clearTimeout(p.timer);
  if (!dogs.includes(p.d) || p.d.grabbed || grab) return;
  pickUp(p.d, p.x, p.y, p.id);
  if (x != null) { grab.px = x; grab.py = y; }
}

function pickUp(d, x, y, id) {
  const [rx, ry] = feetRel(d), [gx, gy] = scruff(d), now = performance.now();
  grab = {
    d, id, phase: 'held', px: x, py: y, age: 0, samples: [[now, x, y]],
    ox: still ? 0 : d.sx - rx - x, oy: still ? 4 : d.sy - ry - y, // the scruff, from the finger; it slides in under it
    ang: 0, av: 0, fvx: 0, lpx: x, lfvx: 0, tilt: -d.facing * TILT[d.def.k],
  };
  Object.assign(d, { grabbed: true, queue: [], move: null, jump: null, walking: false, squash: 0, actName: 'held', act: { dur: 1e9 }, actT: 0 });
  d.cv.style.transformOrigin = `${gx}px ${gy}px`;
  d.cv.style.zIndex = 2;
  document.documentElement.classList.add('dog-held');
  navigator.vibrate?.(12);
  d.bubble.hidden = true; clearTimeout(d.bubbleTimer);
  const kk = d.def.k;
  if (kk === 'f') say(d, 'hmph', 2.5);
  else if (kk === 'm') say(d, '…', 2.5);
  showFx(d, kk === 'z' ? 'joy' : null);
  // The others stop to watch; Frank won't have anyone lifting Minnie.
  for (const o of dogs) {
    if (o === d || ['nap', 'curl'].includes(o.actName)) continue;
    if (o.def.k === 'f' && kk === 'm') { interrupt(o, 'angrybark'); o.queue.push('watch'); }
    else interrupt(o, 'watch');
  }
}

function release() {
  const g = grab, d = g.d, now = performance.now();
  document.documentElement.classList.remove('dog-held');
  // Throw speed: how far the pointer moved over its last tenth of a second.
  const s = g.samples.filter(([t]) => now - t < 100);
  let vx = 0, vy = 0;
  if (s.length > 1) {
    const [t0, x0, y0] = s[0], [t1, x1, y1] = s[s.length - 1], dt = Math.max(40, t1 - t0) / 1000;
    vx = (x1 - x0) / dt; vy = (y1 - y0) / dt;
  }
  // A finger still drifting as it lifts is a drop, not a throw; a real flick is toned down to fit a phone.
  if (Math.hypot(vx, vy) < 300) vx = vy = 0;
  Object.assign(g, { phase: 'fall', x: g.px + g.ox, y: g.py + g.oy, vx: clamp(vx * 0.5, -650, 650), vy: clamp(vy * 0.5, -500, 500) });
  g.peak = g.y + feetRel(d)[1];
  if (still) { // no flying about: straight onto whatever is below
    const [rx, ry] = feetRel(d), fx = clamp(g.x + rx, 14, innerWidth - 14);
    land(d, target(curS, fx, g.y + ry), fx);
  }
}

/** The surface a dog whose feet are at (x, y) would land on. */
function target(S, x, y) {
  let best = null;
  for (const [key, s] of S) {
    if (s.ground || x < s.l || x > s.r || s.y < y - 2) continue;
    if (!best || s.y < best.s.y) best = { key, s };
  }
  return best || { key: 'ground', s: S.get('ground') };
}

function heldPose(d, t, g) {
  const ear = clamp(-g.fvx * 0.0007 * d.facing, -0.5, 0.5);
  if (d.def.k === 'z') return { ph: t * 16, amp: 0.55, legF: -0.15, legB: 0.15, mouth: 1, head: -0.12, ear: 0.2 + ear, tail: t * 22 }; // paddling, delighted
  if (d.def.k === 'f') return { legF: 0.55, legB: -0.6, head: 0.1, ear: -0.4 + ear, tail: Math.sin(t * 9) * 0.4 }; // stiff as a board
  return { legF: -0.3, legB: 0.35, head: 0.38, eyes: Math.sin(t * 1.3) > 0.8 ? 1 : 0, ear: -0.35 + ear, tail: t }; // a rag doll
}

function grabStep(d, dt, t, S) {
  const g = grab;
  if (g.phase === 'held') {
    if (dt > 0) {
      g.age += dt;
      // Pops up into the hand after a quick squash.
      if (g.age > 0.09) { const f = Math.exp(-dt * 16); g.ox *= f; g.oy = 4 + (g.oy - 4) * f; }
      // A pendulum on the finger: it lags as the finger speeds up and swings on past when it stops.
      const v = (g.px - g.lpx) / dt; g.lpx = g.px;
      g.fvx += (v - g.fvx) * Math.min(1, dt * 20);
      const ax = (g.fvx - g.lfvx) / dt; g.lfvx = g.fvx;
      if (!still) {
        g.av += (-100 * g.ang - 4 * g.av + 0.004 * ax) * dt;
        g.ang = clamp(g.ang + g.av * dt, -0.9, 0.9);
      }
    }
    d.pose = { t, ...heldPose(d, still ? 0 : t, g) };
  } else {
    d.pose = { t, legF: 0.7, legB: -0.7, mouth: 1, head: -0.2, ear: -0.45, tail: t * 6 };
    if (dt > 0) {
      const ry = feetRel(d)[1], y0 = g.y + ry;
      g.vy += GRAV * dt;
      g.x += g.vx * dt; g.y += g.vy * dt;
      // Bump off the sides and the top of the screen rather than leave it.
      const fx = g.x + feetRel(d)[0];
      if ((fx < 14 && g.vx < 0) || (fx > innerWidth - 14 && g.vx > 0)) g.vx *= -0.45;
      g.x = clamp(fx, 14, innerWidth - 14) - feetRel(d)[0];
      if (g.y < 20 && g.vy < 0) g.vy *= -0.3;
      // Righting itself on the way down.
      g.tilt *= Math.exp(-dt * 7);
      g.av += (-80 * g.ang - 10 * g.av) * dt; g.ang += g.av * dt;
      const y1 = g.y + ry, x1 = g.x + feetRel(d)[0];
      g.peak = Math.min(g.peak, y1);
      if (g.vy > 0) {
        const ground = S.get('ground');
        let hit = y1 >= ground.y ? { key: 'ground', s: ground } : null;
        for (const [key, s] of S) {
          if (!s.ground && x1 >= s.l && x1 <= s.r && y0 <= s.y && y1 >= s.y && (!hit || s.y < hit.s.y)) hit = { key, s };
        }
        if (hit) { land(d, hit, x1); return; }
      }
    }
  }
  if (k.hot) d.pose.tongue = 1;
  if (k.cold && d.def.k === 'f') d.pose.sweater = 1;
}

function land(d, { key, s }, x) {
  const g = grab, drop = s.y - g.peak;
  grab = null;
  d.grabbed = false;
  d.surf = key;
  d.fx = clamp((x - s.l) / Math.max(1, s.r - s.l), 0.02, 0.98);
  if (Math.abs(g.vx) > 80) d.facing = Math.sign(g.vx);
  d.cv.style.transformOrigin = `${d.box.cx * K}px ${d.box.footY * K}px`;
  d.cv.style.zIndex = '';
  shadowEl.hidden = ledgeEl.hidden = true;
  d.dropX = g.px;
  if (!still) { d.squash = SQUASH; puff(x, s.y, drop, s.ground); }
  const after = d.def.k === 'z' ? ['again', ...(Math.random() < 0.5 ? ['zoomies'] : [])] : d.def.k === 'f' ? ['shake', 'sulk'] : ['shake', 'snub'];
  d.queue = [...(drop > 260 && !still ? ['dazed'] : []), ...after];
  choose(d);
}

/** Dust (or a splash, or snow) kicked up where a dog lands. */
function puff(x, y, drop, ground) {
  const el = document.createElement('span');
  el.className = `puff ${(k.rain || k.puddles) && ground ? 'wet' : k.snowing ? 'snow' : ''}`;
  const n = drop > 200 ? 6 : 4;
  el.innerHTML = Array.from({ length: n }, (_, i) => `<i style="--dx:${(i % 2 ? 1 : -1) * (12 + (i >> 1) * 9)}px;--dy:${-(3 + (i % 3) * 5)}px"></i>`).join('');
  el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  root.append(el);
  setTimeout(() => el.remove(), 700);
}

function placeGrab(d, S) {
  const g = grab, [gx, gy] = scruff(d), held = g.phase === 'held';
  const x = held ? g.px + g.ox : g.x, y = held ? g.py + g.oy : g.y;
  const ang = still ? 0 : Math.round((g.tilt + g.ang) / TURN) * TURN; // whole steps keep the pixels crisp
  const sq = held && g.age < 0.09 && !still ? ' scale(1.06, 0.9)' : '';
  d.cv.style.transform = `translate(${Math.round(x - gx)}px, ${Math.round(y - gy)}px) rotate(${ang.toFixed(4)}rad) scaleX(${d.facing})${sq}`;
  const [rx, ry] = feetRel(d);
  d.sx = x + rx; d.sy = y + ry;
  d.bubble.style.transform = `translate(${Math.round(x - 24)}px, ${Math.round(y - 30)}px) translateY(-100%)`;
  if (!d.fx_.hidden) {
    const [nx, ny] = NOSE[d.def.k], sc = SIZE[d.def.k], c = Math.cos(ang), s = Math.sin(ang);
    const vx = d.facing * (nx * sc * K - gx), vy = (ny + 8) * sc * K - gy;
    d.fx_.style.transform = `translate(${Math.round(x + vx * c - vy * s)}px, ${Math.round(y + vx * s + vy * c)}px) scaleX(${d.facing})`;
  }
  // The shadow on the surface below, sharper and darker the nearer it gets, and that surface's edge aglow.
  const fx = clamp(d.sx, 14, innerWidth - 14), tg = target(S, fx, d.sy), f = clamp(1 - (tg.s.y - d.sy) / 700, 0.4, 1);
  shadowEl.hidden = false;
  shadowEl.style.width = `${Math.round(d.box.w * K * 0.55)}px`;
  shadowEl.style.opacity = (0.15 + 0.35 * f).toFixed(2);
  shadowEl.style.transform = `translate(${Math.round(fx)}px, ${Math.round(tg.s.y)}px) translate(-50%, -50%) scale(${f.toFixed(2)})`;
  ledgeEl.hidden = !!tg.s.ground;
  if (!tg.s.ground) {
    ledgeEl.style.width = `${Math.round(tg.s.r - tg.s.l + 16)}px`;
    ledgeEl.style.transform = `translate(${Math.round(tg.s.l - 8)}px, ${Math.round(tg.s.y)}px)`;
  }
}

Object.assign(ACTS, {
  // The others, while a dog is up in the air: sit and look up at it.
  watch: () => ({
    dur: 30,
    pose: d => {
      const g = grab?.d;
      if (!g) { d.actT = d.act.dur; return { sit: 1 }; }
      d.facing = g.sx > d.sx ? 1 : -1;
      return { sit: 1, head: -0.35, ear: 0.15 };
    },
  }),
  // After a long drop: seeing stars.
  dazed: () => ({ dur: 1.5, fx: 'dizzy', pose: (d, u, t) => ({ sit: 1, head: Math.sin(t * 7) * 0.15, eyes: Math.floor(t * 3) % 2, ear: -0.2 }) }),
  // Ziggy: that was the best thing ever.
  again: () => ({ dur: 2, bubble: 'Again!', mood: 'happy', fx: 'joy', pose: (d, u, t) => ({ mouth: 1, head: -0.22, y: -Math.abs(Math.sin(t * 9)) * 4, ear: 0.2 }) }),
  // Frank: back turned on whoever did that.
  sulk: d => { d.facing = (d.dropX ?? d.sx) > d.sx ? -1 : 1; return { dur: 3, bubble: 'hmph', pose: () => ({ sit: 1, head: 0.1, ear: -0.2 }) }; },
  // Minnie: a long look at whoever did that, then she walks off the other way.
  snub: d => { d.facing = (d.dropX ?? d.sx) > d.sx ? 1 : -1; d.queue.unshift('walkoff'); return { dur: 1.3, pose: () => ({ sit: 1, head: -0.32, ear: -0.3 }) }; },
  walkoff: d => {
    const away = (d.dropX ?? d.sx) > d.sx ? -1 : 1;
    walkTo(d, clamp(d.fx + (away * rnd(110, 180)) / width(d.surf), 0.05, 0.95));
    return { dur: 10, untilArrive: 1, pose: () => ({ head: -0.1, ear: -0.2 }) };
  },
});

// ---------- taps ----------

function hitDog(x, y) {
  for (const d of dogs) {
    if (d.grabbed) continue;
    const r = d.cv.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    let lx = Math.floor((x - r.left) / K), ly = Math.floor((y - r.top) / K);
    if (d.facing < 0) lx = d.box.w - 1 - lx;
    if (d.ctx.getImageData(lx, ly, 1, 1).data[3] > 0) return d;
  }
  return null;
}

function react(d, x) {
  d.queue.length = 0;
  d.move = null;
  const z = d.def.k === 'z', f = d.def.k === 'f';
  if (z) d.queue.push('happybark', ...(Math.random() < 0.5 ? ['zoomies'] : []));
  else if (f) d.queue.push('angrybark');
  else d.queue.push('growl');
  if (!d.jump) choose(d);
}

function onDown(e) {
  if (!k || !dogs.length || grab || opts.isDragging?.()) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  clearTimeout(tap?.timer);
  const d = hitDog(e.clientX, e.clientY);
  tap = d ? { d, x: e.clientX, y: e.clientY, at: performance.now(), id: e.pointerId, mouse: e.pointerType === 'mouse' } : null;
  if (!d) return;
  e.stopPropagation(); // a press on a dog is for the dog, not the tile it stands on
  tap.timer = setTimeout(() => startHold(), HOLD_MS);
}
function onMove(e) {
  if (grab?.phase === 'held' && e.pointerId === grab.id) {
    const now = performance.now();
    grab.px = e.clientX; grab.py = e.clientY;
    grab.samples.push([now, e.clientX, e.clientY]);
    while (grab.samples.length > 2 && now - grab.samples[0][0] > 120) grab.samples.shift();
    return;
  }
  if (!tap || e.pointerId !== tap.id) return;
  const dist = Math.hypot(e.clientX - tap.x, e.clientY - tap.y);
  if (tap.mouse && dist > 6) startHold(e.clientX, e.clientY); // a mouse can just drag
  else if (!tap.mouse && dist > SLOP) { clearTimeout(tap.timer); tap = null; } // moved before the hold: a scroll
}
function onCancel(e) {
  if (grab?.phase === 'held' && e.pointerId === grab.id) release();
  if (tap && e.pointerId === tap.id) { clearTimeout(tap.timer); tap = null; }
}
function onUp(e) {
  if (grab?.phase === 'held' && e.pointerId === grab.id) { release(); suppressClick = performance.now() + 450; return; }
  if (!tap || e.pointerId !== tap.id) return;
  clearTimeout(tap.timer);
  const ok = performance.now() - tap.at < 400 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 10 && !opts.isDragging?.();
  if (ok) { react(tap.d, e.clientX); suppressClick = performance.now() + 450; }
  tap = null;
}

// ---------- public ----------

export function initDogs(o = {}) {
  opts = o;
  root = document.getElementById('pack');
  still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  addEventListener('scroll', () => { scrolled = true; }, { passive: true, capture: true });
  addEventListener('resize', () => { scrolled = true; });
  addEventListener('pointerdown', onDown, true);
  addEventListener('pointerup', onUp, true);
  addEventListener('pointermove', onMove, true);
  addEventListener('pointercancel', onCancel, true);
  // While a dog is held, the page mustn't scroll or pop up a callout under the finger.
  document.addEventListener('touchmove', e => { if (grab?.phase === 'held') e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', e => { if (grab || tap) e.preventDefault(); });
  addEventListener('click', e => { if (performance.now() < suppressClick) { e.preventDefault(); e.stopPropagation(); } }, true);
}

/** Conditions from conditions.js, or null to send the dogs away. */
export function setDogs(next) {
  k = next;
  if (!k) {
    root.textContent = '';
    dogs = [];
    ball = null;
    grab = null;
    clearTimeout(tap?.timer); tap = null;
    document.documentElement.classList.remove('dog-held');
    return;
  }
  if (!dogs.length) {
    dogs = DEFS.map((def, i) => {
      const b = box(def.k), cv = document.createElement('canvas');
      cv.width = b.w; cv.height = b.h;
      cv.className = 'dog';
      cv.style.width = `${b.w * K}px`; cv.style.height = `${b.h * K}px`;
      cv.style.transformOrigin = `${b.cx * K}px ${b.footY * K}px`; // flip and squash about the feet
      const bubble = document.createElement('span');
      bubble.className = 'bubble';
      bubble.hidden = true;
      const fx = document.createElement('span');
      fx.className = 'fx';
      fx.hidden = true;
      root.append(cv, fx, bubble);
      return {
        def, box: b, cv, ctx: cv.getContext('2d', { willReadFrequently: true }), bubble, fx_: fx,
        surf: def.start[0], fx: def.start[1], facing: i === 1 ? -1 : 1, queue: [], seed: i * 1.7, slow: 1, act: null, actT: 0,
      };
    });
    shadowEl = Object.assign(document.createElement('span'), { className: 'dshadow', hidden: true });
    ledgeEl = Object.assign(document.createElement('span'), { className: 'ledge', hidden: true });
    root.prepend(shadowEl, ledgeEl);
  }
  if (q.has('dogspeed')) window.__pack = dogs; // for debugging
  if (!raf) raf = requestAnimationFrame(frame);
}
