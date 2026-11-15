// Ziggy, Frank and Minnie roam the screen. Each picks what to do next at random, weighted by its
// personality and by the weather (see conditions.js), so no two minutes look the same.
// Ziggy is hyper and playful, Frank grumpy and protective, Minnie absent-minded and aloof.
//
// Dogs stand on "surfaces": the top of the tab bar (the ground), the top edges of tiles and cards,
// and the big temperature. Surfaces are looked up afresh every frame, because the views re-render.
// Debug: ?dogspeed=8 speeds everything up; ?dogact=zoomies forces an activity for every dog that has it;
// ?dogact=ball throws a tennis ball every few seconds; ?dogscene=howl|pile|tug|steal|rumble|stretch|treat
// starts that scene (see "scenes" below) a couple of seconds in, then again every 25 seconds or so
// (holiday scenes too: drumstick|coma|gift|sleigh|fireworks|confetti|rose|rainbow|egg|bunny|hotdog|
// fireworks4|bone|dogpile|ghost|pumpkin; and the fall leaf pile: leafpile); with frozen puddles
// (?preview=ice, or ?ice) ?dogact=iceslide has them all slide;
// ?holiday=thanksgiving dresses them for that holiday whatever the date (ids in holidays.js), ?holiday=none
// leaves them undressed; ?dogact=quip has them say their holiday lines.

import { render, outfitTop, box, NOSE, SIZE, PAD, mouthPoint } from './sprites.js';
import { holidayOn } from './holidays.js';
import { OUTFITS } from './outfits.js';
import { PUDDLES, PILE, W as SKY_W, pileSize, scatterPile, pileColours } from './sky.js';

const q = new URLSearchParams(location.search);
const SPEED = Math.max(0.1, +q.get('dogspeed') || 1);
const FORCE = q.get('dogact');
const FORCE_SCENE = q.get('dogscene');
const FORCE_HOLIDAY = q.get('holiday')?.toLowerCase();
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
  comeback: d => { walkTo(d, rnd(0.2, 0.8)); d.queue.unshift('greeted'); return { dur: 15, untilArrive: 1 }; },
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
  // Flat on the belly, back legs splayed out behind: as much of the dog on the cool ground as possible.
  sploot: still_([10, 20], (d, u, t) => ({ lie: 1, head: 0.36, legB: -2.1, legF: 0.25, eyes: Math.sin(t * 0.6 + d.seed) > 0.6 ? 0 : 1 })),
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
  return !still && !grab && !treat && !inScene() && !k.night && !k.hot && !k.rain && !k.snowing && !k.fog && clock - lastRuckus > RUCKUS_GAP
    && onScreen(m) && !['hide', 'wanderoff', 'comeback'].includes(m.actName);
}

Object.assign(ACTS, {
  // Ziggy: goes to Minnie, play-bows, then lunges with a nip, over and over.
  pester: z => {
    lastRuckus = clock;
    nextScene = Math.max(nextScene, clock + 60);
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
    z.fled = 1;
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
        // She's moved on (or was still running when he set off): catch up.
        if (m.surf === d.surf && !m.jump && Math.abs(d.sx - m.sx) > 50) { walkTo(d, beside(m, d, 30)); return {}; }
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

/** Snow underfoot: falling, or lying on the lawn after a fall (see conditions.js). */
const snowyGround = () => !!k && (k.snowing || k.snowLying >= 0.3);
/** Frank won't stand on hot pavement and Minnie won't set foot in falling snow, if there is anywhere else to be. */
const avoidsGround = d => !!k && ((d.def.k === 'f' && k.hotGround) || (d.def.k === 'm' && k.snowing)) && curS.size > 1;

function needGround(d, act) {
  if (d.surf === 'ground') return null;
  if (avoidsGround(d)) return ACTS.refuse(d);
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
    if (key === 'ground' && avoidsGround(d)) continue;
    const w = key === 'ground' ? 2.5 : key === 'hero' ? (d.def.k === 'm' ? 2 : 0.6) : 1;
    opts_.push([key, w]);
  }
  return opts_.length ? [pick(opts_), rnd(0.15, 0.85)] : ['ground', rnd(0.1, 0.9)];
}

/** Jumps to fx on a surface; lift caps the arc's height (a low hop), dur is in seconds. */
function jumpTo(d, [key, fx], lift, dur = 0.75) {
  d.jump = { from: [d.surf, d.fx], to: [key, fx], t: 0, dur, lift };
  d.move = null;
}

// What each dog tends to do, given the weather.
function weights(d) {
  const z = d.def.k === 'z', f = d.def.k === 'f', m = d.def.k === 'm';
  if (k.night) return [['nap', 10], ['lie', 1.5], ['sit', 0.4], ['wander', m ? 0.5 : 0.05], ['look', f ? 0.6 : 0.1], ['snap', z && flies.length ? 3 : 0]];
  const w = z
    ? { sit: 3, lie: 3, nap: 1, look: 1.5, scratch: 0.7, yawn: 0.5, wander: 3, hop: 2.5, sniff: 1, playbow: 0.8, zoomies: 0.8, pester: canRuckus() ? 1.4 : 0 }
    : f
      ? { sit: 4, lie: 3, nap: 2, look: 1.5, scratch: 0.5, yawn: 0.5, wander: 1.5, hop: 1, sniff: 1, guard: 1.5, bark: 0.5, grumble: 0.5 }
      : { sit: 3, lie: 3, nap: 2, look: 1, scratch: 0.5, yawn: 0.5, wander: 2.5, hop: 1, sniff: 2, gaze: 2, wanderoff: 0.5 };
  const add = (o) => { for (const [a, v] of Object.entries(o)) w[a] = (w[a] || 0) + v; };
  if (k.rain) z ? add({ splash: 4, shake: 1.5 }) : f ? add({ shake: 2, glare: 3 }) : add({ hide: 4, shake: 1 });
  else if (k.puddles && z) add({ splash: 2 });
  if (k.puddles) z ? add({ stomp: k.rain ? 1.5 : 2.5 }) : f ? add({ puddleglare: 1.5 }) : 0;
  if (k.windy) z ? add({ chase: 1.5, leafchase: 4 }) : f ? add({ bark: 3 }) : 0;
  if (k.snowing) {
    z ? add({ catch: 3, pounce: 4, dig: 1.5 }) : m ? add({ curl: 2, refuse: d.surf !== 'ground' ? 3 : 0 }) : add({ snowsulk: 4 });
    if (m) w.wanderoff = 0;
  } else if (k.cold) z ? add({ dig: 0.5 }) : m ? add({ curl: 3 }) : 0;
  // A frosty morning: zoomies, breath puffing.
  if (k.frost && !k.night) z ? add({ zoomies: 3 }) : m ? add({ zoomies: 0.5 }) : 0;
  // Frozen puddles: Ziggy can't keep off them; the others try one, in their own way.
  if (k.ice && !k.night) z ? add({ iceslide: 3 }) : f ? add({ iceslide: 0.7 }) : add({ iceslide: 0.9 });
  if (k.fog) { add({ sniff: 6 }); w.hop *= 0.3; }
  if (k.hot) {
    z ? add({ sploot: 5, drink: bowl ? 2.5 : 0 }) : f ? add({ lie: 3, sploot: 2 }) : add({ shade: 4, drink: bowl ? 1.5 : 0 });
    w.zoomies = 0; w.playbow = (w.playbow || 0) * 0.3; w.wander *= 0.4; w.hop *= 0.5;
  }
  if (k.sunny && !k.hot) z ? add({ shadow: 2 }) : f ? add({ squint: 2 }) : add({ sunbathe: 4 });
  if (k.falling) z ? add({ pace: 4 }) : f ? add({ guard: 5, bark: 2 }) : 0;
  if (QUIPS[holiday()]) w.quip = 0.7;
  return Object.entries(w);
}

// Per-activity scratch state, cleared whenever a dog starts something new.
const FRESH = {
  turned: 0, nipped: 0, chasing: 0, landed: 0, said: 0, snapped: 0, drinkAt: 0, pounced: 0, looked: 0, hopped: 0,
  bowed: 0, took: 0, nudged: 0, barked: 0, settled: 0, sniffing: 0, tried: 0,
};
function choose(d) {
  Object.assign(d, FRESH);
  d.slow = 1; d.move = null;
  let name = d.queue.shift();
  // Frank won't stand on hot pavement, nor Minnie in snow: first thing, they find a tile.
  if (!name && !still && d.surf === 'ground' && avoidsGround(d) && surfaces().size > 1) name = 'hop';
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
  d.bubbleW = 0; // measured when next placed
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
  heart: [[HEART, -24, -34, 0]], // just the one, once
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
  return clock > nextBall && !still && !grab && !treat && !k.night && !k.snowing && !inScene();
}

/** A ball in from one side; or, given { x, y, dir }, one popping up from that spot (out of a present). */
function throwBall(from) {
  const fromLeft = Math.random() < 0.5;
  const el = document.createElement('span');
  el.className = 'ball';
  el.innerHTML = BALL_PX;
  root.append(el);
  ball = from
    ? { el, x: from.x, vx: from.dir * rnd(120, 160), h: Math.max(0, groundY() - from.y) + 6, vh: 300, spin: 0, held: null, gone: false, age: 0, catchable: true }
    : { el, x: fromLeft ? -20 : innerWidth + 20, vx: (fromLeft ? 1 : -1) * rnd(140, 185), h: rnd(90, 150), vh: 0, spin: 0, held: null, gone: false, age: 0, catchable: Math.random() < 0.6 };
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
    b.y = z.sy - (z.box.footY - (my + PAD.z) * SIZE.z) * K + 8;
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
    if (j.t >= 1) { d.surf = j.to[0]; d.fx = j.to[1]; d.jump = null; d.landed = 1; if (a?.untilLand) d.actT = a.dur; }
  } else if (d.move) {
    const s = S.get(d.surf) || S.get('ground');
    const speed = ((a?.run ? d.def.run : d.def.walk) * d.slow) / Math.max(80, s.r - s.l);
    const dir = Math.sign(d.move.fx - d.fx);
    d.fx += dir * speed * dt;
    d.walking = true;
    if (!dir || Math.sign(d.move.fx - d.fx) !== dir) { // there (or already there)
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
  // Breath clouds, quicker when running.
  if (k.cold && !k.night) { const per = d.act?.run && d.walking ? 1.1 : 2.6, c = ((t + d.seed) % per) / per; pose.puff = c < 0.6 ? c / 0.6 : 0; }
  if (k.windy) pose.ear = d.def.k === 'm' ? -0.9 : (pose.ear || 0) + Math.sin(t * 20) * 0.25;
  // Shiver only at or below freezing, in short bursts: about once every 12s at 32°F, every 6s near 0°F.
  if (k.freezing && !pose.lie && !d.walking && !SCENE_ACTS.has(d.actName)) {
    const every = Math.max(6, 12 - Math.max(0, 32 - k.temp) * 0.2);
    if ((t + d.seed * 7) % every < 1.1) pose.x = (pose.x || 0) + Math.sin(t * 60) * 0.6;
  }
  d.pose = pose;
}

function place(d, S) {
  let x, y;
  if (d.jump) {
    const j = d.jump, A = j.fromXY ? { x: j.fromXY[0], y: j.fromXY[1] } : at(S, ...j.from), B = at(S, ...j.to), u = Math.min(1, j.t);
    x = A.x + (B.x - A.x) * u;
    const room = Math.max(6, Math.min(A.y, B.y) - (S.ceil ?? 0));
    const lift = Math.min(j.lift ?? 36 + Math.abs(B.y - A.y) * 0.25, room);
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
  d.bubble.style.transform = `translate(${bubbleX(d, x)}px, ${Math.round(y - (b.footY - b.lift) * K * 0.8 - (d.rise || 0))}px) translateY(-100%)`;
  d.sx = x; d.sy = y;
  if (!d.fx_.hidden) {
    const [nx, ny] = NOSE[d.def.k], sc = SIZE[d.def.k];
    const hx = x + d.facing * (nx * sc - b.cx) * K, hy = y - (b.footY - (ny + PAD[d.def.k] + (d.pose?.y || 0)) * sc) * K;
    d.fx_.style.transform = `translate(${Math.round(hx)}px, ${Math.round(hy)}px) scaleX(${d.facing})`;
  }
}

/** A speech bubble's left edge for a dog at screen x: just behind its head, but kept on screen. */
function bubbleX(d, x) {
  if (d.bubble.hidden) return Math.round(x - 24);
  if (!d.bubbleW) d.bubbleW = d.bubble.offsetWidth;
  return Math.round(clamp(x - 24, 4, innerWidth - d.bubbleW - 4));
}

/** How far (screen px) to raise a dog's speech bubble so it clears its outfit when standing or sitting. */
function bubbleRise(d, parts) {
  const top = outfitTop(d.def.k, parts), b = d.box;
  return top == null ? 0 : Math.max(0, (b.footY - top) * K + 2 - (b.footY - b.lift) * K * 0.8);
}

/** Today's holiday (holidays.js), or the one forced by ?holiday=. Looked up again whenever the date
 *  changes, since the app stays open for days. */
function holiday() {
  if (FORCE_HOLIDAY) return FORCE_HOLIDAY === 'none' ? null : FORCE_HOLIDAY;
  const now = new Date(), day = now.toDateString();
  if (day !== holiday.day) { holiday.day = day; holiday.id = holidayOn(now); }
  return holiday.id;
}

let skew = 0; // debug: time added by __step
function frame(now) {
  now += skew;
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
  director();
  if (!ball && ballReady()) throwBall();
  if (ball) moveBall(dt, S);
  fogBumps();
  const outfit = OUTFITS[holiday()];
  for (const d of dogs) {
    if (d.grabbed) grabStep(d, rdt, t, S);
    else step(d, dt, still ? 0 : t * SPEED, S);
    if (d.squash > 0) d.squash = Math.max(0, d.squash - rdt);
    const parts = outfit?.[d.def.k]?.parts;
    if (draw || d.grabbed) render(d.def.k, d.pose, d.ctx, parts);
    d.rise = bubbleRise(d, parts);
    if (d.grabbed) placeGrab(d, S); else place(d, S);
    // In fog they drift in and out of sight, speech bubbles and all.
    const op = k.fog && !still && !d.grabbed ? (0.3 + 0.35 * (1 + Math.sin(clock * 0.35 + d.seed * 2.1))).toFixed(2) : '';
    if (op !== d.op) { d.op = op; d.cv.style.opacity = d.bubble.style.opacity = d.fx_.style.opacity = op; }
  }
  propsStep(dt, S);
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
const scruff = d => { const [x, y] = SCRUFF[d.def.k], s = SIZE[d.def.k]; return [x * s * K, (y + PAD[d.def.k]) * s * K]; };
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
function puff(x, y, drop, ground, cls) {
  const el = document.createElement('span');
  el.className = `puff ${cls || ((k.rain || k.puddles) && ground ? 'wet' : snowyGround() ? 'snow' : '')}`;
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
  d.bubble.style.transform = `translate(${bubbleX(d, x)}px, ${Math.round(y - 30 - (d.rise || 0))}px) translateY(-100%)`;
  if (!d.fx_.hidden) {
    const [nx, ny] = NOSE[d.def.k], sc = SIZE[d.def.k], c = Math.cos(ang), s = Math.sin(ang);
    const vx = d.facing * (nx * sc * K - gx), vy = (ny + PAD[d.def.k]) * sc * K - gy;
    d.fx_.style.transform = `translate(${Math.round(x + vx * c - vy * s)}px, ${Math.round(y + vx * s + vy * c)}px) scaleX(${d.facing})`;
  }
  // The shadow on the surface below, sharper and darker the nearer it gets, and that surface's edge aglow.
  const fx = clamp(d.sx, 14, innerWidth - 14), tg = target(S, fx, d.sy), f = clamp(1 - (tg.s.y - d.sy) / 700, 0.4, 1);
  shadowEl.hidden = false;
  shadowEl.style.width = `${Math.round(d.box.body * K * 0.55)}px`;
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

// ---------- props ----------
// Things in the yard the dogs react to: wind-blown leaves, fireflies, paw prints in snow and frost,
// a water bowl on the hottest days, a rope toy, a treat. Each lives in #pack, above the cards.

let leaves = [], flies = [], bowl = null, rope = null, treat = null, nextLeaf = 0;
let press = null, lastTap = null, lastPhase = null;
const later = (secs, fn) => setTimeout(() => { if (k && dogs.length && !still) fn(); }, (secs * 1000) / SPEED);
const free = d => !!d && !d.grabbed;
const groundY = () => curS.get('ground')?.y ?? innerHeight;
const PUDDLE_FX = PUDDLES.map(([x, w]) => (x + w / 2) / SKY_W);
function prop(cls, html = '') {
  const e = document.createElement('span');
  e.className = cls;
  e.innerHTML = html;
  root.append(e);
  return e;
}
/** A point on top of a dog's head, in screen pixels. */
function headPt(d) {
  const [nx, ny] = NOSE[d.def.k], sc = SIZE[d.def.k], b = d.box;
  return [d.sx + d.facing * ((nx - 12) * sc - b.cx) * K, d.sy - (b.footY - (ny - 5 + PAD[d.def.k] + (d.pose?.y || 0)) * sc) * K];
}
/** A dog's mouth, in screen pixels. */
function mouthXY(d) {
  const [mx, my] = mouthPoint(d.pose || {}, d.def.k), sc = SIZE[d.def.k];
  return [d.sx + d.facing * (mx * sc - d.box.cx) * K, d.sy - (d.box.footY - (my + PAD[d.def.k]) * sc) * K];
}
/** fx on a surface that puts a dog's nose at screen x, approaching from whichever side fits. */
function noseTo(d, x, key = d.surf) {
  const s = curS.get(key) || curS.get('ground'), w = Math.max(1, s.r - s.l);
  let dir = Math.sign(x - d.sx) || d.facing, c = x - dir * noseOff(d);
  if (c < s.l + 4 || c > s.r - 4) { dir = -dir; c = x - dir * noseOff(d); }
  return { fx: clamp((c - s.l) / w, 0.01, 0.99), dir };
}

function propsStep(dt, S) {
  leavesStep(dt);
  fliesStep(dt);
  printsStep();
  bowlStep();
  treatStep(dt, S);
  ropeStep();
  holidayStep(dt);
  leafBitsStep(dt);
}

// Leaves: the same little orange and yellow leaves the sky blows past, but in front, where the dogs are.
// Now and then one lands on a dog's head until it shakes it off.
function leavesStep(dt) {
  const px = innerWidth / SKY_W, gy = groundY();
  if (k.windy && !k.snowing && !still && clock > nextLeaf && leaves.length < 3) {
    nextLeaf = clock + rnd(1.5, 4.5);
    const e = prop('leaf');
    e.style.width = `${Math.round(px * 2)}px`; e.style.height = `${Math.max(2, Math.round(px))}px`;
    e.style.background = Math.random() < 0.5 ? '#e0892f' : '#d4b13a';
    const L = { el: e, x: -12, h: rnd(14, 90), ph: rnd(0, 9), v: (14 + k.gust * 0.6) * px * rnd(0.8, 1.2), sticky: Math.random() < 0.35, on: null, lift: 0 };
    // A sticky one is aimed at someone's head.
    const d = L.sticky && dogs.find(o => free(o) && o.surf === 'ground' && !o.jump);
    if (d) L.h = gy - headPt(d)[1];
    leaves.push(L);
  }
  for (const L of leaves) {
    if (L.on) {
      const d = L.on;
      if (!free(d) || !dogs.includes(d)) L.on = null;
      else {
        [L.x, L.y] = headPt(d);
        if (clock > L.off) {
          L.on = null; L.h = gy - L.y; L.lift = 70;
          if (!SCENE_ACTS.has(d.actName)) interrupt(d, 'shake');
        }
      }
    }
    if (!L.on) {
      L.x += L.v * dt;
      if (L.lift) { L.h += L.lift * dt; L.lift = Math.max(0, L.lift - 60 * dt); }
      else L.h = Math.max(6, L.h - 5 * dt);
      L.y = gy - L.h + Math.sin(clock * 4 + L.ph) * 5;
      if (L.sticky && !leaves.some(o => o.on)) for (const d of dogs) {
        if (!free(d) || d.jump || d.actName === 'leafchase') continue;
        const [hx, hy] = headPt(d);
        if (Math.abs(hx - L.x) < 14 && Math.abs(hy - L.y) < 16) {
          L.on = d; L.sticky = false; L.off = clock + rnd(2.5, 4.5);
          if (d.def.k === 'f') say(d, 'hmph', 1.5);
          break;
        }
      }
    }
    L.el.style.transform = `translate(${Math.round(L.x)}px, ${Math.round(L.y)}px) rotate(${Math.round(Math.sin(clock * 6 + L.ph)) * 25}deg)`;
  }
  leaves = leaves.filter(L => {
    const gone = L.caught || L.x > innerWidth + 20 || L.h > innerHeight;
    if (gone) L.el.remove();
    return !gone;
  });
}

// Fireflies on warm summer nights, blinking low over the lawn.
function fliesStep(dt) {
  const want = !still && k.night && k.temp >= 65 && !k.raining ? 7 : 0;
  while (flies.length < want) flies.push({ el: prop('fly'), x: rnd(0.05, 0.95) * innerWidth, h: rnd(20, 150), vx: 0, vh: 0, ph: rnd(0, 6), lit: false, next: clock + rnd(0, 3), dart: 0 });
  if (flies.length > want) flies.splice(want).forEach(f => f.el.remove());
  const gy = groundY();
  for (const f of flies) {
    f.vx += (Math.sin(clock * 0.7 + f.ph * 3) * 22 - f.vx) * Math.min(1, dt);
    f.vh += (Math.cos(clock * 0.9 + f.ph * 5) * 12 - f.vh) * Math.min(1, dt);
    f.x = clamp(f.x + f.vx * dt, 6, innerWidth - 6);
    f.h = clamp(f.h + (f.vh + (f.dart > 0 ? 110 : 0)) * dt, 12, 190);
    f.dart = Math.max(0, f.dart - dt);
    if (clock > f.next) {
      f.lit = !f.lit; f.next = clock + (f.lit ? rnd(0.8, 1.8) : rnd(1.2, 3.5));
      f.el.classList.toggle('lit', f.lit);
    }
    f.el.style.transform = `translate(${Math.round(f.x)}px, ${Math.round(gy - f.h)}px)`;
  }
}

// Paw prints behind a dog walking in snow (falling, or still lying after a fall) or across a frosty lawn;
// they fade after a few seconds.
function printsStep() {
  if (still || !(snowyGround() || k.frost)) return;
  const gy = groundY();
  for (const d of dogs) {
    if (d.surf !== 'ground' || d.jump || !free(d) || !d.walking) { d.lastPrint = null; continue; }
    if (d.lastPrint != null && Math.abs(d.sx - d.lastPrint) < 13) continue;
    d.lastPrint = d.sx;
    d.printSide = -(d.printSide || 1);
    const e = prop(`print ${snowyGround() ? 'snow' : 'frost'}`);
    e.style.transform = `translate(${Math.round(d.sx + d.printSide * 4)}px, ${Math.round(gy - 3 + (d.printSide > 0 ? 1 : 0))}px)`;
    e.addEventListener('animationend', () => e.remove());
    const all = root.querySelectorAll('.print');
    if (all.length > 60) all[0].remove();
  }
}

const BOWL_PX = pix(['.wwwwwwwwww.', 'bwwwwwwwwwwb', 'bbbbbbbbbbbb', '.bbbbbbbbbb.', '..bbbbbbbb..'], { w: '#8fd0f5', b: '#3d7fc4' }, K);
// A water bowl on the hottest days. One dog laps at a time; the next waits its turn.
function bowlStep() {
  const want = !still && k.hot && k.temp >= 90 && !k.night;
  if (want && !bowl) bowl = { el: prop('bowl', BOWL_PX), fx: 0.1, user: null };
  if (!want && bowl) { bowl.el.remove(); bowl = null; }
  if (!bowl) return;
  if (bowl.user && bowl.user.actName !== 'drink') bowl.user = null;
  bowl.el.style.transform = `translate(${Math.round(bowl.fx * innerWidth - 12)}px, ${Math.round(groundY() - 10)}px)`;
  bowl.el.classList.toggle('lap', !!bowl.user?.drinkAt);
}

// The rope toy: between two mouths during a tug, hanging from one, or dropped on the lawn to fade.
const ROPE_ACTS = ['tugbring', 'tug', 'tugwin'];
function ropeStep() {
  if (!rope) return;
  const holds = d => free(d) && ROPE_ACTS.includes(d.actName);
  if (rope.a && !holds(rope.a)) rope.a = null;
  if (rope.b && !holds(rope.b)) rope.b = null;
  if (!rope.a && rope.b) { rope.a = rope.b; rope.b = null; }
  let x1, y1, x2, y2;
  if (rope.a && rope.b) { [x1, y1] = mouthXY(rope.a); [x2, y2] = mouthXY(rope.b); }
  else if (rope.a) { [x1, y1] = mouthXY(rope.a); x2 = x1 - rope.a.facing * 16; y2 = y1 + 11; }
  else {
    if (!rope.fade) rope.fade = clock + 1.5;
    x1 = rope.x ?? innerWidth / 2; y1 = y2 = groundY() - 2; x2 = x1 + 22;
    rope.el.style.opacity = Math.max(0, (rope.fade - clock) / 1.5).toFixed(2);
    if (clock > rope.fade) { rope.el.remove(); rope = null; tugS = null; return; }
  }
  rope.x = Math.min(x1, x2);
  const len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1);
  rope.el.style.width = `${Math.round(len)}px`;
  rope.el.style.transform = `translate(${Math.round(x1)}px, ${Math.round(y1 - 2)}px) rotate(${ang.toFixed(3)}rad)`;
}

// ---------- weather and time-of-day activities ----------

// Frozen puddles (k.ice; sky.js draws them): Ziggy, gleeful, slides back and forth two or three times,
// legs splayed; Frank's feet scrabble and go out from under him, and he sits there put out; Minnie
// tiptoes up and glides across, nose in the air, then walks off as if she meant it.
const ICE_LINES = {
  z: { pre: 'ICE RINK!!', go: 'WHEEE!!', post: 'AGAIN!!', mood: 'happy' },
  f: { pre: 'careful…', go: 'whoa—', post: 'who did this' },
  m: { pre: 'tippy toes.', go: '…', post: 'how graceful' },
};
// Run-up and overshoot past the far edge (screen px), and how long the slide takes (s).
const ICE = { z: { runup: 70, over: 34, slide: 1.2 }, f: { runup: 34, over: 8, slide: 1.1 }, m: { runup: 26, over: 14, slide: 1.7 } };
/** Whether a slide across puddle s in direction s.dir starts and ends on screen. */
function iceFits(s, who) {
  const C = ICE[who], a = s.cx - s.dir * (s.half + C.runup), b = s.cx + s.dir * (s.half + C.over);
  return Math.min(a, b) > 36 && Math.max(a, b) < innerWidth - 36;
}
function iceStep(d, t) {
  const s = d.ice, who = d.def.k, C = ICE[who], L = ICE_LINES[who];
  const end = () => { d.actT = d.act.dur; return {}; };
  if (!s || d.jump) return {};
  if (s.step === 'go') { // to the run-up spot
    const fx = (s.cx - s.dir * (s.half + C.runup)) / innerWidth;
    if (Math.abs(fx - d.fx) > 0.006) { if (!d.move) walkTo(d, fx); return who === 'z' ? { mouth: 1 } : {}; }
    d.move = null; d.facing = s.dir; s.step = 'ready'; s.t0 = clock;
    if (!s.pass) say(d, L.pre, 1.6, L.mood);
  }
  if (s.step === 'ready') { // Ziggy wiggles; Frank eyes the ice; Minnie lifts her nose
    if (clock - s.t0 < (who === 'z' ? 0.6 : 1.4)) return who === 'z' ? { bow: 0.22, mouth: 1, ear: -0.25 } : who === 'f' ? { head: 0.4, ear: -0.2 } : { head: -0.25, eyes: 0 };
    s.step = 'run';
    walkTo(d, (s.cx - s.dir * s.half) / innerWidth);
    d.slow = who === 'm' ? 0.6 : 1; // she tiptoes
  }
  if (s.step === 'run') { // up to the edge of the ice
    if (d.move) return who === 'z' ? { mouth: 1, ear: -0.35 } : who === 'm' ? { head: -0.2 } : {};
    s.step = 'slide'; s.t0 = clock; s.x0 = d.sx;
    say(d, L.go, 1.4, L.mood);
  }
  if (s.step === 'slide') { // no steps: the feet stay put and the ice does the rest, slowing as it goes
    const u = Math.min(1, (clock - s.t0) / C.slide), e = 1 - (1 - u) * (1 - u);
    d.fx = clamp((s.x0 + s.dir * (2 * s.half + C.over) * e) / innerWidth, 0.01, 0.99);
    d.facing = s.dir;
    if (u < 1) {
      if (who === 'z') return { legF: 0.7, legB: -0.7, mouth: 1, ear: -0.5, head: -0.15 };
      if (who === 'm') return { legF: 0.25, legB: -0.25, head: -0.3, eyes: 0, ear: 0.1 };
      if (u < 0.55) return { ph: t * 40, amp: 0.8, ear: -0.4, head: 0.1 }; // Frank scrabbling…
      if (!s.sat) { s.sat = 1; puff(d.sx, groundY(), 100, true, 'snow'); } // …and down he goes
      return { sit: 1, ear: -0.45, head: 0.05 };
    }
    s.step = 'after'; s.t0 = clock; s.pass++;
    if (who !== 'z' || s.pass >= s.passes) say(d, L.post, 2.2, L.mood);
    if (who === 'z' && s.pass === 1) iceReactions();
  }
  const a = clock - s.t0;
  if (who === 'z') {
    if (a < 0.9) return { y: -Math.abs(Math.sin(t * 9)) * 4, mouth: 1, head: -0.25, ear: 0.2 };
    if (s.pass < s.passes) { s.dir = -s.dir; if (iceFits(s, 'z')) { s.step = 'go'; return {}; } }
    return end();
  }
  if (who === 'f') { if (a > 2.4) { d.queue = ['grumble']; return end(); } return { sit: 1, head: 0.12, ear: -0.35 }; }
  if (a > 1.8) { d.dropX = s.cx; d.queue = ['walkoff']; return end(); }
  return { sit: 1, head: -0.32, eyes: 0 };
}
// What the others make of Ziggy on the ice.
function iceReactions() {
  const [, f, m] = dogs, idle = o => free(o) && onScreen(o) && !SCENE_ACTS.has(o.actName) && o.actName !== 'iceslide';
  later(1, () => { if (idle(f)) { interrupt(f, 'ignore'); say(f, 'show-off.', 1.6); } });
  later(2, () => { if (idle(m)) say(m, 'how common.', 1.6); });
}

Object.assign(ACTS, {
  // Minnie at the edge of her tile, peering down at the snow (or Frank at the hot pavement): no.
  refuse: d => {
    if (d.surf === 'ground') return { dur: 2.5, bubble: 'nope.', pose: () => ({ sit: 1, head: 0.1, ear: -0.3 }) };
    const edge = d.fx < 0.5 ? 0.05 : 0.95;
    walkTo(d, edge);
    d.queue.push('look');
    return {
      dur: 6,
      pose: (dd, u, t) => {
        if (dd.move) return {};
        if (!dd.said) { dd.said = 1; say(dd, k.snowing ? 'nope.' : 'too hot.', 1.8); }
        const peek = (t * 1.1) % 1 < 0.45;
        return { head: 0.4, legF: peek ? 0.9 : 0, ear: -0.3 };
      },
    };
  },
  // Ziggy: a crouch and a wiggle, a leap, and nose-first into the snow. Then a good shake.
  pounce: d => needGround(d, 'pounce') || (d.queue.unshift('shake'), {
    dur: 2.4,
    pose: (dd, u, t) => {
      if (u < 0.35) return { bow: 0.18, ear: -0.25, head: 0.1, x: Math.sin(t * 30) * 0.5 };
      if (u < 0.72) { const v = (u - 0.35) / 0.37; return { y: -Math.sin(v * Math.PI) * 16, x: dd.facing * v * 6, head: 0.2 + v * 0.3, legF: 0.6, legB: -0.5 }; }
      if (!dd.pounced) {
        dd.pounced = 1;
        dd.fx = clamp(dd.fx + (dd.facing * 6 * K) / width(dd.surf), 0.02, 0.98);
        puff(dd.sx + dd.facing * (noseOff(dd) + 6 * K), groundY(), 300, true);
      }
      return { bow: 0.35, head: 0.6, ear: -0.1 };
    },
  }),
  // Frank, in his sweater, with his back to the weather.
  snowsulk: () => ({ dur: rnd(6, 10), bubble: Math.random() < 0.4 ? 'hmph' : undefined, pose: (d, u, t) => ({ sit: 1, head: 0.16, ear: -0.35, eyes: Math.sin(t * 0.8 + d.seed) > 0.7 ? 0 : 1 }) }),
  // Ziggy: puddle to puddle, a splash at every landing.
  stomp: d => {
    const g = needGround(d, 'stomp');
    if (g) return g;
    // Along the row from the nearer end, and sometimes back again.
    const list = [...PUDDLE_FX].sort((a, b) => (d.fx < 0.5 ? a - b : b - a));
    if (Math.random() < 0.5) list.push(...list.slice(0, -1).reverse());
    d.stomp = { list, i: 0, next: clock + 0.2, hit: -9 };
    d.queue.push('shake');
    return {
      dur: 18, run: 1,
      pose: (dd, u, t) => {
        const s = dd.stomp;
        if (dd.jump) return { mouth: 1, ear: -0.3, legF: 0.5, legB: -0.5 };
        if (dd.landed) { dd.landed = 0; s.hit = clock; s.next = clock + 0.5; puff(dd.sx, groundY(), 300, true); }
        if (clock > s.next) {
          if (s.i >= s.list.length) { dd.actT = dd.act.dur; return {}; }
          jumpTo(dd, ['ground', s.list[s.i++]], 22, 0.5);
          return {};
        }
        const h = clock - s.hit;
        return h < 0.4 ? { mouth: 1, splash: h / 0.4, ear: 0.2 } : { mouth: 1, head: -0.1 };
      },
    };
  },
  // Frank: walks up to a puddle, considers it, and hops over rather than get his feet wet.
  puddleglare: d => {
    const g = needGround(d, 'puddleglare');
    if (g) return g;
    const i = PUDDLE_FX.reduce((b, p, j) => (Math.abs(p - d.fx) < Math.abs(PUDDLE_FX[b] - d.fx) ? j : b), 0);
    const cx = PUDDLE_FX[i] * innerWidth, half = (PUDDLES[i][1] / 2) * (innerWidth / SKY_W);
    const dir = cx > d.sx ? 1 : -1;
    const stop = (cx - dir * (half + noseOff(d) + 4)) / innerWidth, land = (cx + dir * (half + 22)) / innerWidth;
    if (land < 0.03 || land > 0.97 || Math.abs(stop - d.fx) < 0.01) return { dur: 1 };
    walkTo(d, stop);
    return {
      dur: 12,
      pose: (dd) => {
        if (dd.move || dd.jump) return {};
        if (dd.hopped) { dd.actT = dd.act.dur; return {}; }
        dd.facing = dir;
        if (!dd.looked) dd.looked = clock;
        if (clock - dd.looked < 1.6) return { head: 0.4, ear: -0.2 };
        dd.hopped = 1;
        say(dd, 'hmph', 1.4);
        jumpTo(dd, ['ground', land], 24, 0.6);
        return {};
      },
    };
  },
  // Frozen puddles: a run-up and a slide across one (see iceStep).
  iceslide: d => {
    const g = needGround(d, 'iceslide');
    if (g) return g;
    const who = d.def.k;
    const i = who === 'z' ? Math.floor(Math.random() * PUDDLES.length) : PUDDLE_FX.reduce((b, p, j) => (Math.abs(p - d.fx) < Math.abs(PUDDLE_FX[b] - d.fx) ? j : b), 0);
    const s = { cx: PUDDLE_FX[i] * innerWidth, half: (PUDDLES[i][1] / 2) * (innerWidth / SKY_W), step: 'go', pass: 0, passes: who === 'z' ? 2 + Math.floor(Math.random() * 2) : 1 };
    s.dir = (d.sx ?? 0) < s.cx ? 1 : -1;
    if (!iceFits(s, who)) s.dir = -s.dir;
    if (!iceFits(s, who)) return { dur: 1 };
    d.ice = s;
    return { dur: 40, run: who === 'z' ? 1 : 0, pose: (dd, u, t) => iceStep(dd, t) };
  },
  // Ziggy after the leaves: runs one down and snaps; sometimes he gets it.
  leafchase: d => needGround(d, 'leafchase') || {
    dur: rnd(4, 7), run: 1,
    pose: (dd, u, t) => {
      const L = leaves.filter(l => !l.on && !l.lift && l.x > 0 && l.x < innerWidth).sort((a, b) => Math.abs(a.x - dd.sx) - Math.abs(b.x - dd.sx))[0];
      if (!L) { if (!dd.move) walkTo(dd, dd.fx < 0.5 ? rnd(0.6, 0.9) : rnd(0.1, 0.4)); return { mouth: 1, head: -0.15 }; }
      const { fx, dir } = noseTo(dd, L.x + 6);
      walkTo(dd, fx); dd.facing = dir;
      const nose = dd.sx + dir * noseOff(dd);
      if (Math.abs(nose - L.x) < 16 && L.h < 60) {
        if (L.h < 34 && Math.random() < 0.5) { L.caught = true; say(dd, 'got it!', 1.2, 'happy'); dd.actT = dd.act.dur - 0.4; }
        else L.lift = 90; // it gets away
      }
      return { mouth: Math.floor(t * 8) % 2, ear: -0.3, head: -0.25, y: L.h < 60 ? -Math.abs(Math.sin(t * 9)) * 4 : 0 };
    },
  },
  // Lapping at the water bowl, or waiting a turn beside it.
  drink: d => needGround(d, 'drink') || (!bowl ? null : {
    dur: 30, // ends itself after a drink; the time covers waiting for a turn
    pose: (dd, u, t) => {
      if (!bowl) { dd.actT = dd.act.dur; return {}; }
      const bx = bowl.fx * innerWidth;
      if (bowl.user && bowl.user !== dd) {
        if (!dd.move && Math.abs(dd.sx - (bx + 80)) > 10) walkTo(dd, clamp((bx + 80) / innerWidth, 0.03, 0.97));
        if (dd.move) return { tongue: 1 };
        dd.facing = -1;
        return { sit: 1, head: -0.05, tongue: 1 };
      }
      bowl.user = dd;
      if (!dd.drinkAt) {
        const { fx, dir } = noseTo(dd, bx);
        if (Math.abs(fx - dd.fx) > 0.004) { if (!dd.move) walkTo(dd, fx); return { tongue: 1 }; }
        dd.facing = dir; dd.drinkAt = clock;
      }
      if (clock - dd.drinkAt > 4.5) { bowl.user = null; dd.actT = dd.act.dur; return {}; }
      const lap = Math.floor(t * 8) % 2;
      return { bow: 0.3, head: 0.65, tongue: lap, mouth: lap };
    },
  }),
  // Ziggy, wide awake on a summer night, snapping at fireflies. He never catches one.
  snap: d => needGround(d, 'snap') || {
    dur: rnd(6, 10),
    pose: (dd, u, t) => {
      const f = flies.filter(o => o.lit && o.h < 110).sort((a, b) => Math.abs(a.x - dd.sx) - Math.abs(b.x - dd.sx))[0] || flies[0];
      if (!f) { dd.actT = dd.act.dur; return {}; }
      const { fx, dir } = noseTo(dd, f.x);
      if (Math.abs(fx - dd.fx) > 0.02 && !dd.snapped) { walkTo(dd, fx); dd.slow = 1.4; return { head: -0.3, ear: 0.1 }; }
      dd.move = null; dd.facing = dir;
      const c = (t * 1.4) % 1;
      if (c < 0.5) { dd.snapped = 0; return { head: -0.42, ear: 0.15 }; }
      if (!dd.snapped) { dd.snapped = 1; f.dart = 0.8; f.lit = false; f.el.classList.remove('lit'); f.next = clock + rnd(1, 2); }
      return { y: -Math.sin(((c - 0.5) / 0.5) * Math.PI) * 6, mouth: Math.floor(t * 10) % 2, head: -0.3 };
    },
  },
  // Foggy: two dogs nose-down blunder into each other.
  bonk: d => {
    const dir = d.bonkFrom || d.facing;
    d.facing = dir;
    say(d, d.def.k === 'f' ? 'hey!' : d.def.k === 'z' ? '!' : '?', 1.2);
    d.queue.push('look');
    return { dur: 1.3, pose: (dd, u) => ({ x: -dir * 3 * Math.sin(Math.min(1, u * 3) * Math.PI), y: u < 0.25 ? -Math.sin((u / 0.25) * Math.PI) * 3 : 0, ear: 0.4, head: -0.1 }) };
  },
  // First thing in the day: front stretch, back stretch, then a yawn.
  stretch: () => ({
    dur: 3.2,
    pose: (d, u) => (u < 0.5
      ? { bow: 0.3, legF: 0.5, head: -0.12, eyes: 0, ear: -0.2 }
      : { legB: -0.7, legF: -0.15, head: -0.18, eyes: u > 0.9 ? 1 : 0, ear: -0.1 }),
  }),
  // Thunder: Minnie bolts for the edge and lies flat, shaking.
  cower: d => {
    walkTo(d, d.fx < 0.5 ? 0.04 : 0.96);
    d.slow = 1.4;
    return { dur: rnd(14, 20), run: 1, bubble: '!', pose: (dd, u, t) => (dd.move ? { ear: -0.8, head: 0.15 } : { lie: 1, eyes: 0, ear: -0.9, head: 0.38, x: Math.sin(t * 50) * 0.4 }) };
  },
  // Ziggy barks at the sky, then paces.
  skybark: d => { d.queue.push('pace'); return { dur: rnd(2.5, 3.5), bubble: 'WOOF?!', pose: (dd, u, t) => { const m = Math.floor(t * 4) % 2; return { head: -0.42 - 0.08 * m, mouth: m, ear: -0.1 }; } }; },
  // A howl at the moon, eyes shut, then back to sleep.
  howl: d => {
    d.queue.push('nap');
    return {
      dur: rnd(4, 5.5), bubble: { z: 'AWOOOO!', f: 'aroooo', m: 'ooo?' }[d.def.k],
      pose: (dd, u, t) => { const open = u > 0.12 && u < 0.88; return { sit: 1, head: open ? -0.5 + 0.03 * Math.sin(t * 6) : -0.3, mouth: open ? 1 : 0, eyes: open ? 0 : 1, ear: -0.35 }; },
    };
  },
});

function fogBumps() {
  if (!k.fog || still) return;
  for (let i = 0; i < dogs.length; i++) for (let j = i + 1; j < dogs.length; j++) {
    const a = dogs[i], b = dogs[j];
    if (!free(a) || !free(b) || a.jump || b.jump || a.surf !== b.surf || !(a.walking || b.walking)) continue;
    if (clock < (a.bonkT || 0) || clock < (b.bonkT || 0) || SCENE_ACTS.has(a.actName) || SCENE_ACTS.has(b.actName)) continue;
    const dx = (b.sx ?? 0) - (a.sx ?? 0), s = Math.sign(dx) || 1;
    if (Math.abs(dx) < 30 && ((a.walking && a.facing === s) || (b.walking && b.facing === -s))) {
      a.bonkT = b.bonkT = clock + 25;
      if (Math.random() < 0.5) continue; // they sidestep, this time
      a.bonkFrom = s; b.bonkFrom = -s;
      interrupt(a, 'bonk'); interrupt(b, 'bonk');
    }
  }
}

function maybeStretch(prev) {
  if (still || k.night) return;
  const today = new Date().toDateString();
  let last = null;
  try { last = localStorage.getItem('dogs.stretched'); } catch { /* storage unavailable */ }
  if (prev !== 'night' && last === today) return;
  if (prev != null && prev !== 'night') return; // only on opening the app, or when night turns to dawn
  try { localStorage.setItem('dogs.stretched', today); } catch { /* storage unavailable */ }
  later(1.2, startStretch);
}
function startStretch() {
  dogs.forEach((d, i) => later(i * 0.9, () => { if (free(d)) { interrupt(d, 'stretch'); d.queue.push('yawn'); } }));
}

// ---------- scenes ----------
// Little set pieces with all three dogs. One runs at a time, and the ball, the ruckus and other scenes
// wait until it's over. A dog in one of these activities counts as in a scene.

const SCENE_ACTS = new Set([
  'pester', 'flinch', 'rescue', 'flee', 'guardM', 'howl', 'pileup', 'tugwait', 'tugbring', 'tug', 'tugwin', 'tuglose',
  'steal', 'budge', 'evict', 'slink', 'reclaim', 'cower', 'skybark', 'race', 'chomp', 'beg', 'greeted', 'buttsniff', 'stretch',
  'unwrap', 'santa', 'onewoof', 'cheer', 'confcatch', 'woo', 'rebuff', 'goldig', 'claim', 'bunnychase', 'ghostbark',
  'leafdive',
]);
const inScene = () => dogs.some(d => SCENE_ACTS.has(d.actName) || d.queue.some(a => SCENE_ACTS.has(a)));
let nextScene = FORCE_SCENE ? 2 : rnd(45, 100), tugS = null, stealS = null, pileSpot = null;

const SCENES = {
  howl: { when: () => k.night, w: 1, go: startHowl },
  pile: { when: () => k.night || k.freezing, w: () => (k.night ? 1.2 : 0.5), go: startPile },
  tug: { when: () => !k.night && !k.raining && !k.hot && !k.falling && !k.fog, w: 1, go: startTug },
  steal: { when: () => k.sunny && !k.hot && dogs[M].actName === 'sunbathe' && onScreen(dogs[M]), w: 4, go: startSteal },
  rumble: { when: () => k.falling, w: 2, go: startRumble },
  stretch: { when: () => false, go: startStretch },
  treat: { when: () => false, go: () => dropTreat(rnd(0.2, 0.8) * innerWidth, innerHeight * 0.3) },
  // Fall: the leaf pile on the lawn (sky.js) is big enough to dive into.
  leafpile: { when: () => pileSize() >= 0.4 && !k.night && !k.raining && !k.snowing && !k.fog, w: 1.5, go: startLeafPile },
  // Holiday scenes, only in their holiday's week (see "holidays" below).
  drumstick: { when: () => hol('thanksgiving') && !k.night && !k.raining, w: 1.5, go: () => dropTreat(rnd(0.2, 0.8) * innerWidth, innerHeight * 0.3, 'drumstick') },
  coma: { when: () => hol('thanksgiving') && !k.night && !k.hot, w: 0.8, go: () => startPile('coma') },
  gift: { when: () => hol('christmas') && !k.night && !k.raining, w: 1.5, go: () => dropTreat(rnd(0.2, 0.8) * innerWidth, innerHeight * 0.3, 'gift') },
  sleigh: { when: () => hol('christmas') && k.night && !k.raining, w: 1.5, go: startSleigh },
  fireworks: { when: () => hol('newyear') && k.night && !k.raining, w: 1.5, go: startFireworks },
  confetti: { when: () => hol('newyear') && !k.night && !k.raining, w: 1.2, go: startConfetti },
  rose: { when: () => hol('valentines') && !k.night && !k.rain && onScreen(dogs[M]) && !['hide', 'wanderoff', 'comeback'].includes(dogs[M].actName), w: 1.5, go: startRose },
  rainbow: { when: () => hol('stpatricks') && !k.night && !k.raining, w: 1.5, go: startRainbow },
  egg: { when: () => hol('easter') && !k.night && !k.raining, w: 1.5, go: () => dropTreat(rnd(0.2, 0.8) * innerWidth, innerHeight * 0.3, 'egg') },
  bunny: { when: () => hol('easter') && !k.night && !k.raining, w: 1.2, go: startBunny },
  hotdog: { when: () => hol('july4') && !k.night && !k.raining, w: 1.5, go: () => dropTreat(rnd(0.2, 0.8) * innerWidth, innerHeight * 0.3, 'hotdog') },
  fireworks4: { when: () => hol('july4') && k.night && !k.raining, w: 1.5, go: () => startFireworks(JULY4_COLS, 'too loud.') },
  bone: { when: () => hol('dogday') && !k.night && !k.raining, w: 1.5, go: () => dropTreat(rnd(0.2, 0.8) * innerWidth, innerHeight * 0.3, 'bone') },
  dogpile: { when: () => hol('dogday') && !k.night && !k.hot, w: 0.8, go: () => startPile('dogday') },
  ghost: { when: () => hol('halloween') && k.night && !k.raining, w: 1.5, go: startGhost },
  pumpkin: { when: () => hol('halloween') && !k.night && !k.raining, w: 1.5, go: () => dropTreat(rnd(0.2, 0.8) * innerWidth, innerHeight * 0.3, 'pumpkin') },
};

// The gap between scenes counts from when the last one ended, so a long one (a nap pile) doesn't
// leave the next one due the moment it's over.
const SCENE_GAP = [60, 150];
let sceneOn = false;
function director() {
  if (!dogs.length) return;
  if (inScene() || treat) { sceneOn = true; return; }
  if (sceneOn) { sceneOn = false; nextScene = Math.max(nextScene, clock + (FORCE_SCENE ? 25 : rnd(...SCENE_GAP))); }
  if (still || grab || clock < nextScene || dogs.some(d => d.grabbed)) return;
  if (FORCE_SCENE) { nextScene = clock + 25; SCENES[FORCE_SCENE]?.go(); return; }
  const ok = Object.values(SCENES).filter(s => s.when());
  if (!ok.length) { nextScene = clock + 5; return; }
  nextScene = clock + rnd(...SCENE_GAP);
  pick(ok.map(s => [s, typeof s.w === 'function' ? s.w() : s.w])).go();
}

// Moon howl: one starts, the others join in one at a time.
function startHowl() {
  [...dogs].sort(() => Math.random() - 0.5).forEach((d, i) => later(i * 1.8, () => free(d) && interrupt(d, 'howl')));
}

// Thunder rumbles (the pressure is falling): Minnie hides, Frank guards her, Ziggy barks at the sky.
function startRumble() {
  const [z, f, m] = dogs;
  const flash = prop('flash');
  setTimeout(() => flash.remove(), 900);
  if (free(m)) interrupt(m, 'cower');
  later(0.3, () => free(z) && interrupt(z, 'skybark'));
  later(2.2, () => free(f) && interrupt(f, 'guardM')); // once she's at the edge
}

// Nap pile: all three curled up together, Minnie in the middle, on her tile if it's big enough.
// 'coma' is Thanksgiving's: the same pile by day, after too much turkey; 'dogday' is National Dog Day's.
const PILE_LINES = { coma: { z: 'so… full…', f: 'worth it.', m: 'z z' }, dogday: { z: 'best… day…', f: 'best day.', m: 'z z' } };
function startPile(mode) {
  const m = dogs[M];
  let surf = onScreen(m) && width(m.surf) >= 120 ? m.surf : 'ground';
  // In snow, Minnie won't come down: they pile up on the widest tile instead.
  if (surf === 'ground' && k.snowing) {
    for (const [key, s] of curS) if (!s.ground && s.r - s.l >= 120 && (surf === 'ground' || s.r - s.l > width(surf))) surf = key;
  }
  const w = width(surf);
  const c = surf === m.surf ? clamp(m.fx, 60 / w, 1 - 60 / w) : rnd(0.3, 0.7);
  pileSpot = { surf, c, lines: PILE_LINES[mode], fx: { m: c, f: clamp(c - 30 / w, 0.02, 0.98), z: clamp(c + 34 / w, 0.02, 0.98) } };
  dogs.forEach((d, i) => later(i * 0.6, () => free(d) && interrupt(d, 'pileup')));
}

// Fall leaf pile: one of them dives in and scatters it, in character. Ziggy most often, gleeful; Frank,
// grumpily, just the once; Minnie, a dainty little hop. The pile builds back up over a few minutes.
const LEAF_LINES = {
  z: { pre: 'LEAVES!!', post: 'CRUNCH!!', mood: 'happy' },
  f: { pre: 'fine. once.', post: 'hmph. itchy.' },
  m: { pre: 'just a hop.', post: 'how crunchy.' },
};
const pileX = () => ((PILE[0] + PILE[1] / 2) * innerWidth) / SKY_W;
function startLeafPile() {
  const ok = [[Z, 3], [F, 1], [M, 1]].filter(([i]) => free(dogs[i]) && onScreen(dogs[i]) && !avoidsGround(dogs[i])
    && !['hide', 'wanderoff', 'comeback'].includes(dogs[i].actName));
  if (ok.length) interrupt(dogs[pick(ok)], 'leafdive');
}
// The others have something to say about it.
function leafReactions(d) {
  const [z, f, m] = dogs, idle = o => free(o) && onScreen(o) && !SCENE_ACTS.has(o.actName);
  if (d === z) {
    later(1.2, () => { if (idle(f)) { interrupt(f, 'ignore'); say(f, 'my pile.', 1.8); } });
    later(2.2, () => { if (idle(m)) { interrupt(m, 'ignore'); say(m, 'how messy.', 1.8); } });
  } else {
    later(0.9, () => { if (idle(z)) { interrupt(z, 'happybark'); say(z, d === f ? 'AGAIN!!' : 'MY TURN!!', 1.8, 'happy'); } });
    if (d === m) later(1.8, () => { if (idle(f)) say(f, 'hmph.', 1.4); });
  }
}
let leafBits = [];
function leafBurst(x) {
  const px = innerWidth / SKY_W, gy = groundY(), cols = pileColours();
  for (let i = 0; i < 26; i++) {
    const e = prop('leafbit');
    e.style.width = `${Math.round(px * (Math.random() < 0.5 ? 2 : 1))}px`; e.style.height = `${Math.max(2, Math.round(px))}px`;
    e.style.background = cols[Math.floor(Math.random() * cols.length)];
    leafBits.push({ el: e, x: x + rnd(-1, 1) * PILE[1] * px * 0.4, y: gy - rnd(2, 12), vx: rnd(-110, 110), vy: -rnd(140, 300), ph: rnd(0, 9), land: gy - rnd(0, 5) });
  }
}
function leafBitsStep(dt) {
  for (const b of leafBits) {
    if (b.down) continue;
    b.vy = Math.min(70, b.vy + 520 * dt); // tossed up, then flutters down
    b.vx *= 1 - 1.5 * dt;
    b.x += (b.vx + (b.vy > 0 ? Math.sin(clock * 5 + b.ph) * 30 : 0)) * dt; b.y += b.vy * dt;
    if (b.vy > 0 && b.y >= b.land) {
      b.y = b.land; b.down = true;
      b.el.classList.add('down');
      b.el.addEventListener('animationend', () => { b.el.remove(); b.gone = true; });
    }
    b.el.style.transform = `translate(${Math.round(b.x)}px, ${Math.round(b.y)}px) rotate(${b.down ? 0 : Math.round(Math.sin(clock * 7 + b.ph)) * 30}deg)`;
  }
  leafBits = leafBits.filter(b => !b.gone);
}

// Tug-of-war: Ziggy brings the rope to Frank; they pull until one wins and takes a lap with it.
function startTug() {
  const [z, f] = dogs;
  if (!free(z) || !free(f)) return;
  tugS = { end: 0, winner: null };
  if (!rope) rope = { el: prop('rope') };
  Object.assign(rope, { a: z, b: null, fade: 0 });
  rope.el.style.opacity = '';
  interrupt(f, 'tugwait');
  interrupt(z, 'tugbring');
  // Minnie wants no part of it: out of the way if she's near Frank.
  const m = dogs[M];
  if (free(m) && m.surf === 'ground' && !SCENE_ACTS.has(m.actName) && Math.abs((m.sx ?? 0) - (f.sx ?? 0)) < 160) {
    m.dropX = f.sx; // walkoff heads away from here
    interrupt(m, 'walkoff');
  }
}

// Stolen spot: Ziggy nudges Minnie out of her patch of sun; Frank makes him give it back.
function startSteal() {
  const [z, , m] = dogs;
  if (!free(z) || !onScreen(m)) return;
  stealS = { surf: m.surf, fx: m.fx };
  interrupt(z, 'steal');
}

Object.assign(ACTS, {
  // A run-up, a dive into the pile, leaves everywhere. Then Ziggy bounces about in them, Frank sits
  // there put out and shakes them off, and Minnie shakes them off straight away and walks off.
  leafdive: d => needGround(d, 'leafdive') || {
    dur: 24, run: d.def.k === 'z' ? 1 : 0,
    pose: (dd, u, t) => {
      const who = dd.def.k, L = LEAF_LINES[who], cx = pileX();
      if (!dd.bowed) {
        const side = (dd.sx ?? 0) < cx ? -1 : 1, runup = who === 'z' ? 72 : who === 'f' ? 42 : 32;
        const fx = clamp((cx + side * runup) / innerWidth, 0.03, 0.97);
        if (Math.abs(fx - dd.fx) > 0.006) { walkTo(dd, fx); return who === 'z' ? { mouth: 1, ear: -0.3 } : { ear: -0.1 }; }
        dd.move = null; dd.facing = cx > dd.sx ? 1 : -1; dd.bowed = clock;
        say(dd, L.pre, 1.6, L.mood);
      }
      const s = clock - dd.bowed;
      if (!dd.hopped) {
        if (s < (who === 'z' ? 0.9 : 1.7)) return who === 'z' ? { bow: 0.22, mouth: 1, ear: -0.25 } : who === 'f' ? { sit: 1, head: 0.1, ear: -0.2 } : { head: -0.25, eyes: 0 };
        dd.hopped = clock;
        jumpTo(dd, ['ground', clamp(cx / innerWidth, 0.03, 0.97)], who === 'z' ? 34 : who === 'f' ? 12 : 10, who === 'z' ? 0.6 : 0.5);
        return {};
      }
      if (dd.jump) return who === 'z' ? { mouth: 1, ear: -0.4 } : {};
      if (!dd.took) {
        dd.took = clock;
        scatterPile(); leafBurst(cx);
        say(dd, L.post, 2.4, L.mood);
        leafReactions(dd);
      }
      const a = clock - dd.took;
      if (who === 'z') {
        if (a > 4) { dd.queue = ['shake', 'zoomies']; dd.actT = dd.act.dur; return {}; }
        return { y: -Math.abs(Math.sin(t * 7)) * 6, mouth: 1, head: -0.3, ear: 0.2 };
      }
      if (who === 'f') {
        if (a > 3) { dd.queue = ['shake', 'grumble']; dd.actT = dd.act.dur; return {}; }
        return { sit: 1, head: 0.12, ear: -0.35 };
      }
      if (a > 1.2) { dd.queue = ['walkoff']; dd.actT = dd.act.dur; return {}; }
      return { shake: 1 };
    },
  },
  pileup: d => {
    const p = pileSpot;
    if (!p) return null;
    const fx = p.fx[d.def.k];
    if (d.surf !== p.surf) { d.queue.unshift('pileup'); jumpTo(d, [p.surf, fx]); return { dur: 9, untilLand: 1 }; }
    walkTo(d, fx);
    d.slow = 0.8;
    return {
      dur: k.night ? rnd(70, 110) : rnd(30, 50), // a long sleep at night, a short huddle by day
      pose: dd => {
        if (dd.move) return {};
        if (!dd.settled) {
          dd.settled = 1;
          dd.facing = dd.def.k === 'm' ? (Math.random() < 0.5 ? 1 : -1) : fx < p.c ? 1 : -1;
          if (p.lines) say(dd, p.lines[dd.def.k], 3);
          else if (dd.def.k === 'm') say(dd, 'z z', 3);
        }
        return { lie: 1, eyes: 0, head: 0.38 };
      },
    };
  },
  tugwait: d => needGround(d, 'tugwait') || {
    dur: 20,
    pose: dd => {
      if (!tugS || tugS.end) { dd.actT = dd.act.dur; return {}; }
      dd.facing = dogs[Z].sx > dd.sx ? 1 : -1;
      return { sit: 1, head: -0.05, ear: -0.1 };
    },
  },
  tugbring: z => needGround(z, 'tugbring') || {
    dur: 18,
    pose: (d) => {
      const f = dogs[F];
      if (!tugS || !free(f) || f.actName !== 'tugwait') { d.actT = d.act.dur; return {}; }
      if (f.surf !== 'ground' || f.jump) return { ear: 0.2 };
      const gap = noseOff(d) + noseOff(f) + 26;
      let side = Math.sign(f.sx - d.sx) || 1, x = f.sx - side * gap;
      if (x < 12 || x > innerWidth - 12) { side = -side; x = f.sx - side * gap; }
      if (Math.abs(d.sx - x) > 4 && !d.bowed) { walkTo(d, clamp(x / innerWidth, 0.02, 0.98)); d.slow = 0.8; return { ear: 0.2, head: -0.1 }; }
      d.move = null; d.facing = side;
      if (!d.bowed) d.bowed = clock;
      if (clock - d.bowed < 1.2) return { bow: 0.2, ear: -0.2 };
      tugS.end = clock + rnd(5, 8);
      tugS.winner = Math.random() < 0.55 ? f : d;
      rope.b = f;
      interrupt(f, 'tug'); interrupt(d, 'tug');
      say(d, 'rrr!', 1.5, 'happy'); say(f, 'GRRR', 1.8, 'growl');
      return {};
    },
  },
  tug: () => ({
    dur: 30,
    pose: (d, u, t) => {
      const o = d === dogs[Z] ? dogs[F] : dogs[Z];
      if (!tugS) { d.actT = d.act.dur; return {}; }
      if (clock >= tugS.end) { interrupt(d, tugS.winner === d ? 'tugwin' : 'tuglose'); return {}; }
      if (!free(o) || o.actName !== 'tug') { d.actT = d.act.dur; return {}; }
      d.facing = o.sx > d.sx ? 1 : -1;
      // Both lean back; the rope's give moves them together, first one way, then the other.
      const s = Math.sin(clock * 2.6) * 2.2 + Math.sin(clock * 7.3) * 0.8;
      return { x: -d.facing * 1.5 + s, legF: 0.45, legB: -0.25, head: -0.06 + 0.06 * Math.sin(t * 13 + d.seed), mouth: d.def.k === 'z' ? 1 : 0, ear: -0.3 };
    },
  }),
  tugwin: d => {
    if (rope) { rope.a = d; rope.b = null; }
    say(d, d.def.k === 'z' ? 'MINE!' : 'hmph.', 1.8, d.def.k === 'z' ? 'happy' : '');
    d.lap = [d.fx < 0.5 ? rnd(0.8, 0.93) : rnd(0.07, 0.2), d.fx];
    return {
      dur: 16, run: 1,
      pose: dd => {
        if (!dd.move) {
          const nxt = dd.lap.shift();
          if (nxt == null) { if (rope) rope.a = null; dd.actT = dd.act.dur; return {}; }
          walkTo(dd, nxt);
        }
        return { ear: 0.2, head: -0.2 };
      },
    };
  },
  // The loser stumbles forward as the rope goes.
  tuglose: d => {
    d.queue.push(d.def.k === 'f' ? 'grumble' : 'playbow');
    return { dur: 0.9, pose: (dd, u) => ({ x: dd.facing * 4 * Math.sin(u * Math.PI), bow: 0.15 * Math.sin(u * Math.PI), mouth: 1 }) };
  },
  steal: () => ({
    dur: 40,
    pose: d => {
      const m = dogs[M], s = stealS;
      if (!s) { d.actT = d.act.dur; return {}; }
      if (d.jump) return {};
      if (!d.took) {
        if (m.actName !== 'budge') {
          if (!onScreen(m)) { d.actT = d.act.dur; return {}; }
          if (d.surf !== m.surf) { jumpTo(d, [m.surf, beside(m, d, 26)]); return {}; }
          if (Math.abs(d.sx - m.sx) > 30) { walkTo(d, beside(m, d, 26)); d.slow = 0.8; return { ear: 0.2 }; }
          d.move = null; d.facing = m.sx > d.sx ? 1 : -1;
          if (!d.nudged) d.nudged = clock;
          if (clock - d.nudged < 0.8) return { bow: 0.1, head: 0.15, x: d.facing * 2 };
          interrupt(m, 'budge');
          return {};
        }
        if (d.surf !== s.surf) { jumpTo(d, [s.surf, s.fx]); return {}; }
        if (Math.abs(d.fx - s.fx) > 0.01) { if (!d.move) walkTo(d, s.fx); return {}; }
        d.took = clock;
      }
      if (clock - d.took > 2.5 && !s.called) {
        s.called = 1;
        if (free(dogs[F])) interrupt(dogs[F], 'evict');
      }
      return { lie: 1, eyes: 0, head: -0.05 };
    },
  }),
  budge: m => {
    const z = dogs[Z], away = (z.sx ?? 0) < m.sx ? 1 : -1;
    say(m, '!?', 1.5);
    walkTo(m, clamp(m.fx + (away * 56) / width(m.surf), 0.03, 0.97));
    return {
      dur: 40,
      pose: d => {
        if (z.actName !== 'steal') { d.actT = d.act.dur; return {}; }
        if (d.move) return { ear: -0.3 };
        d.facing = z.sx > d.sx ? 1 : -1;
        return { sit: 1, head: -0.12, ear: -0.4 };
      },
    };
  },
  evict: f => {
    say(f, 'GRR!', 1.2);
    return {
      dur: 20, run: 1,
      pose: (d, u, t) => {
        const z = dogs[Z];
        if (!stealS || z.actName !== 'steal') { d.actT = d.act.dur; return {}; }
        if (d.jump || z.jump) return {};
        if (d.surf !== z.surf) { jumpTo(d, [z.surf, beside(z, d, 34)]); return {}; }
        if (!d.barked && Math.abs(d.sx - z.sx) > 40) { walkTo(d, beside(z, d, 34)); return { ear: -0.2 }; }
        d.move = null; d.facing = z.sx > d.sx ? 1 : -1;
        if (!d.barked) { d.barked = clock; say(d, 'MOVE.', 2, 'angry'); showFx(d, 'anger'); }
        if (clock - d.barked > 2) {
          interrupt(z, 'slink');
          interrupt(dogs[M], 'reclaim');
          interrupt(d, 'guardM');
          return {};
        }
        const m = Math.floor(t * 6) % 2;
        return { mouth: m, head: -0.1 * m, ear: -0.4, x: d.facing * m * 1.5 };
      },
    };
  },
  slink: z => {
    const away = (dogs[F].sx ?? 0) < z.sx ? 1 : -1;
    walkTo(z, clamp(z.fx + (away * rnd(120, 170)) / width(z.surf), 0.04, 0.96));
    z.slow = 0.6;
    return { dur: 12, untilArrive: 1, bubble: '…', pose: () => ({ ear: -0.6, head: 0.22 }) };
  },
  reclaim: m => {
    const s = stealS;
    stealS = null;
    if (!s || s.surf !== m.surf) return { dur: 1 };
    walkTo(m, s.fx);
    m.queue.push('sunbathe');
    return { dur: 12, untilArrive: 1 };
  },
  // Back from wandering off: the others come over for a sniff.
  greeted: d => {
    const fled = d.fled;
    d.fled = 0;
    const sniffers = still ? [] : dogs.filter(o => o !== d && free(o) && onScreen(o) && onScreen(d) && o.surf === d.surf
      && !SCENE_ACTS.has(o.actName) && !['nap', 'curl', 'fetch', 'proud', 'pileup'].includes(o.actName)
      && !(fled && o.def.k === 'f') && Math.random() < 0.7);
    if (!sniffers.length) return { dur: 0.1 };
    sniffers.forEach((o, i) => { o.sniffAt = d; o.sniffBack = i * 14; interrupt(o, 'buttsniff'); });
    // Stands still for it until they're done.
    return {
      dur: 15,
      pose: dd => {
        if (dd.actT > 0.5 && !dogs.some(o => o.sniffAt === dd && o.actName === 'buttsniff')) dd.actT = dd.act.dur;
        return { ear: 0.1, head: dd.def.k === 'm' ? -0.1 : 0 };
      },
    };
  },
  buttsniff: () => ({
    dur: 12, run: 1,
    pose: (d, u, t) => {
      d.slow = 0.55; // a trot
      const tg = d.sniffAt;
      if (!tg || tg.actName !== 'greeted' || tg.surf !== d.surf || d.jump) { d.actT = d.act.dur; return {}; }
      if (!d.sniffing) {
        const rear = tg.sx - tg.facing * (tg.box.cx - 16 * SIZE[tg.def.k]) * K;
        const s = curS.get(d.surf) || curS.get('ground');
        if (!d.tried) { d.tried = 1; walkTo(d, clamp((rear - tg.facing * (noseOff(d) + d.sniffBack) - s.l) / Math.max(1, s.r - s.l), 0.01, 0.99)); }
        if (d.move) return {};
        d.sniffing = clock;
      }
      d.facing = tg.facing;
      if (clock - d.sniffing > 3) { d.actT = d.act.dur; return {}; }
      return { head: 0.28 + 0.05 * Math.sin(t * 14), ear: 0.1 };
    },
  }),
});

// ---------- the treat ----------
// Double-tap anywhere that isn't a button or a chart: a treat drops onto the surface below, and the
// dogs race for it. Ziggy is fastest, Frank wins if it lands near him, and Minnie only bothers if it's close.

const TREAT_PX = pix(['.bb....bb.', 'bbbbbbbbbb', '.bbbbbbbb.', 'ssssssssss', '.ss....ss.'], { b: '#f3e6c8', s: '#cdb68c' }, K);
const DRUM_PX = pix(['ww.....mmmm.', '.wwwwwmmmhhm', '.wwwwwmmmmmm', 'ww.....mmmm.'], { w: '#f4efe2', m: '#a5562a', h: '#d9864a' }, K);
const EGG_PX = pix(['..ll..', '.llll.', 'pppppp', 'yyyyyy', 'pppppp', '.llll.', '..ll..'], { l: '#b9a0e8', p: '#f4a6c8', y: '#f7d95a' }, K);
const HOTDOG_PX = pix(['.bbbbbbbbbb.', 'ryyrryyrryyr', 'rrrrrrrrrrrr', '.bbbbbbbbbb.'], { b: '#e0b36a', r: '#b5432a', y: '#f2c230' }, K);
const BONE_PX = pix(['.ww........ww.', 'wwww......wwww', '.wwwwwwwwwwww.', 'wwss......ssww', '.ss........ss.'], { w: '#f6f1e4', s: '#cfc5ae' }, K);
const PUMPKIN_PX = pix(['...g....', '...gg...', '.oooooo.', 'oOoOOoOo', 'oOoOOoOo', 'oOoOOoOo', '.oooooo.'], { o: '#c8641c', O: '#e8862e', g: '#4e8a28' }, K);
const GIFT_PX = pix(['..y...y..', '...yyy...', 'rrrryrrrr', 'rrrryrrrr', 'yyyyyyyyy', 'rrrryrrrr', 'rrrryrrrr', 'rrrryrrrr'], { r: '#d63a3a', y: '#f2c94c' }, K);
// Things that drop for the dogs: a double-tap treat, and the holiday ones (drumstick, present, egg, hot dog,
// bone, pumpkin biscuit). Size in
// screen pixels; cry is what each dog shouts as it races for it; only, the one dog who bothers; got,
// what the winner does with it.
const DROPS = {
  treat: { px: TREAT_PX, w: 20, h: 10, cry: { z: 'TREAT!!', f: '!' } },
  drumstick: { px: DRUM_PX, w: 24, h: 8, cry: { z: 'TURKEY!!', f: 'MINE.' } },
  gift: { px: GIFT_PX, w: 18, h: 16, cry: { z: 'PRESENT!!' }, only: 'z', got: 'unwrap' },
  egg: { px: EGG_PX, w: 12, h: 14, cry: { z: 'EGG!!', f: 'MINE.' } },
  hotdog: { px: HOTDOG_PX, w: 24, h: 8, cry: { z: 'HOT DOG!!', f: 'MINE.' } },
  bone: { px: BONE_PX, w: 28, h: 10, cry: { z: 'BONE!!', f: 'MINE.' } },
  pumpkin: { px: PUMPKIN_PX, w: 16, h: 14, cry: { z: 'PUMPKIN!!', f: 'MINE.' } },
};

function doubleTap(e) {
  const p = press, now = performance.now();
  press = null;
  const ok = now - p.at < 300 && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 10 && !opts.isDragging?.()
    && !e.target.closest?.('button, a, input, select, textarea, label, .chart');
  if (!ok) { lastTap = null; return; }
  if (lastTap && now - lastTap.at < 380 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 36) {
    lastTap = null;
    dropTreat(e.clientX, e.clientY);
    suppressClick = now + 400;
    getSelection?.()?.removeAllRanges();
  } else lastTap = { x: e.clientX, y: e.clientY, at: now };
}

function dropTreat(x, y, kind = 'treat') {
  if (treat || still || !k || !dogs.length) return;
  const D = DROPS[kind];
  treat = { el: prop('treat', D.px), kind, x, y, vy: -140, surf: null, fx: 0, born: clock };
  if (kind === 'gift') later(1.8, () => { const f = dogs[F]; if (free(f) && !SCENE_ACTS.has(f.actName)) say(f, 'bah.', 1.6); });
  for (const d of dogs) {
    if (!free(d) || (D.only && d.def.k !== D.only)) continue;
    if (d.def.k === 'm' && Math.abs((d.sx ?? 0) - x) > 220) continue; // too far; Minnie can't be bothered
    later({ z: 0.15, f: 0.45, m: 0.7 }[d.def.k], () => { if (free(d) && treat) interrupt(d, 'race'); });
  }
}

function treatStep(dt, S) {
  const t = treat;
  if (!t) return;
  if (t.surf && !S.has(t.surf)) t.surf = null; // its tile went away: it falls again
  if (!t.surf) {
    const y0 = t.y;
    t.vy += GRAV * 0.7 * dt; t.y += t.vy * dt;
    const g = S.get('ground');
    let hit = t.y >= g.y ? ['ground', g] : null;
    for (const [key, s] of S) if (!s.ground && t.x >= s.l && t.x <= s.r && y0 <= s.y && t.y >= s.y && (!hit || s.y < hit[1].y)) hit = [key, s];
    if (hit) { t.surf = hit[0]; t.fx = clamp((t.x - hit[1].l) / Math.max(1, hit[1].r - hit[1].l), 0.02, 0.98); t.vy = 0; }
  }
  if (t.surf) { const p = at(S, t.surf, t.fx); t.x = p.x; t.y = p.y; }
  const D = DROPS[t.kind];
  t.el.style.transform = `translate(${Math.round(t.x - D.w / 2)}px, ${Math.round(t.y - D.h)}px)`;
  if (clock - t.born > 40) { t.el.remove(); treat = null; } // nobody wanted it
}

Object.assign(ACTS, {
  race: d => ({
    dur: 25, run: 1, bubble: DROPS[treat?.kind || 'treat'].cry[d.def.k], mood: 'happy',
    pose: dd => {
      const t = treat;
      if (!t) { dd.actT = dd.act.dur; return {}; }
      if (!t.surf) { dd.facing = t.x > dd.sx ? 1 : -1; return { head: -0.3, ear: 0.2 }; }
      if (dd.jump) return { mouth: 1 };
      if (t.surf === 'ground' && dd.surf !== 'ground' && avoidsGround(dd)) { interrupt(dd, 'refuse'); return {}; }
      if (dd.surf !== t.surf) { jumpTo(dd, [t.surf, noseTo(dd, t.x, t.surf).fx]); return {}; }
      const { fx, dir } = noseTo(dd, t.x);
      if (Math.abs(dd.sx + dir * noseOff(dd) - t.x) > 7) { walkTo(dd, fx); return { mouth: 1, ear: -0.3, head: -0.05 }; }
      // Got it.
      const got = DROPS[t.kind].got || 'chomp';
      if (got === 'unwrap') giftBox = { el: t.el, x: t.x, y: t.y, t: clock }; else t.el.remove();
      treat = null;
      dd.facing = dir;
      for (const o of dogs) if (o !== dd && o.actName === 'race') interrupt(o, { z: 'beg', f: 'grumble', m: 'ignore' }[o.def.k]);
      interrupt(dd, got);
      return {};
    },
  }),
  chomp: () => ({ dur: 2, bubble: 'nom nom', mood: 'happy', pose: (d, u, t) => ({ bow: 0.08, head: 0.25, mouth: Math.floor(t * 9) % 2, ear: 0.15 }) }),
  // Ziggy, when someone else got it: sits and looks up at you. Any more?
  beg: d => { d.facing = d.sx < innerWidth / 2 ? 1 : -1; return { dur: 3, bubble: '?', pose: () => ({ sit: 1, head: -0.3, ear: 0.25 }) }; },
});

// ---------- holidays ----------
// While a holiday is on (holidays.js; outfits.js dresses them), each dog now and then says something
// about it, and the holiday's scenes join the others (see SCENES). Only holidays with outfits have these.

const QUIPS = {
  thanksgiving: { z: ['TURKEY?!', 'GRAVY!!', 'IS IT TIME?!'], f: ['my plate.', 'no sharing.', 'hmph. pie.'], m: ['…stuffing?', 'pass.', 'too loud.'] },
  christmas: { z: ['SANTA?!', 'PRESENTS!!', 'SNOW?! SNOW!'], f: ['bah.', 'humbug.', 'this hat.'], m: ['naughty? me?', '…tinsel.', 'fa la… la.'] },
  newyear: { z: ['3! 2! 1!', 'PARTY!!', 'HAPPY NEW—!'], f: ['bedtime.', 'noise. ugh.', 'hmph.'], m: ['…sparkly.', 'midnight? eh.', 'z z… cheers.'] },
  valentines: { z: ['BE MINE!!', 'LOVE YOU!!', 'ROSES!!'], f: ['mush.', 'no hugs.', '…fine. one.'], m: ['…flowers?', 'you may.', 'not today.'] },
  stpatricks: { z: ['GOLD?!', 'LUCKY ME!!', 'RAINBOW!!'], f: ['no pinching.', 'hmph. green.', 'mine.'], m: ['…clover.', 'lucky? eh.', 'how green.'] },
  easter: { z: ['EGGS?!', 'BUNNY?!', 'HOP HOP!!'], f: ['no hopping.', 'these ears.', 'hmph. eggs.'], m: ['…jellybean?', 'pastel. eh.', 'how springy.'] },
  july4: { z: ['BOOM?!', 'HOT DOGS!!', 'PARADE!!'], f: ['too loud.', 'no boom.', 'hmph. picnic.'], m: ['…sparklers.', 'hide me.', 'how festive.'] },
  dogday: { z: ['MY DAY!!', 'TREATS?!', 'BEST DAY!!'], f: ['my day.', 'treats. now.', 'hmph. fine.'], m: ['as it should', 'adore me.', 'finally.'] },
  halloween: { z: ['BOO!!', 'CANDY?!', 'SPOOKY!!'], f: ['i vant… nap.', 'bah. ghosts.', 'no candy?'], m: ['…boo.', 'how spooky.', 'witch? me?'] },
};
const hol = id => holiday() === id;
const skyTop = () => document.querySelector('.top')?.getBoundingClientRect().bottom || 0;

const SLEIGH_PX = pix([
  '...w....................b.b...',
  '..rrr....................b....',
  '..fff...................bbbn..',
  '..www...................bb....',
  '.rrrrrllllllllllll..bbbbbb....',
  'ddrrrrrdd.........l.bbbbbb....',
  'dddddddd...........b.b..b.b...',
  '.dddddd............b.b..b.b...',
  'yyyyyyyyy.....................',
], { r: '#e04040', w: '#f4f4f4', f: '#f2c9a0', d: '#8e1f2a', b: '#9a6a3c', n: '#ff4a4a', l: '#c8a46a', y: '#f2c94c' }, K);
const BURST = ['.....x.....', '.x...x...x.', '..x.....x..', '...........', '.....c.....', 'xx..ccc..xx', '.....c.....', '...........', '..x.....x..', '.x...x...x.', '.....x.....'];
const BURST_COLS = ['#ff5a5a', '#ffd34d', '#6fd3ff', '#c39bff', '#7dffa1', '#ff8ad8'];
const CONFETTI_COLS = ['#ff5a5a', '#ffd34d', '#4fb3ff', '#b98cff', '#3fcf7a', '#ff8ad8'];
const JULY4_COLS = ['#ff4a4a', '#f4f4f4', '#4f7bff'];
// Facing right; flipped with scaleX when it hops left.
const BUNNY_PX = pix(['.......b.b.', '.......b.b.', '......bbbb.', '.bbbbbbbbkb', 'wbbbbbbbbbb', '.bbbbbbbb..', '..bb...bb..'], { b: '#a88f74', k: '#1a1410', w: '#f4f4f4' }, K);
const GHOST_PX = pix(['..wwwww..', '.wwwwwww.', 'wwkwwwkww', 'wwkwwwkww', 'wwwwwwwww', 'wwwwkwwww', 'wwwwwwwww', 'wwwwwwwww', 'ww.www.ww', 'w...w...w'], { w: '#f2f2f8', k: '#1a1a2a' }, 3);
const COIN_PX = pix(['.yyyy.', 'yywwyy', 'yywyyy', 'yyyyyy', '.yyyy.'], { y: '#f2c94c', w: '#fff3b0' }, K);
// A rainbow arc, 6 bands of 2 pixels, drawn 3x; its right foot is 126px from its left edge.
const RAINBOW_PX = (() => {
  const W = 48, H = 24, rows = [];
  for (let y = 0; y < H; y++) {
    let r = '';
    for (let x = 0; x < W; x++) { const b = Math.floor((24 - Math.hypot(x + 0.5 - W / 2, H - y - 0.5)) / 2); r += b >= 0 && b < 6 ? 'abcdef'[b] : '.'; }
    rows.push(r);
  }
  return pix(rows, { a: '#e53935', b: '#fb8c00', c: '#fdd835', d: '#43a047', e: '#1e88e5', f: '#8e24aa' }, 3);
})();

let giftBox = null, sleigh = null, rainbow = null, bunny = null, ghost = null, confetti = [], confettiUntil = 0, nextConfetti = 0;

// Christmas Eve, late: a sleigh crosses the sky. Ziggy wakes up shouting; Frank gives it one woof.
function startSleigh() {
  sleigh = { el: prop('sleigh', SLEIGH_PX), x: -70, y: skyTop() + rnd(30, 70), v: (innerWidth + 90) / 9 };
  later(1.5, () => free(dogs[Z]) && interrupt(dogs[Z], 'santa'));
  later(3.2, () => free(dogs[F]) && interrupt(dogs[F], 'onewoof'));
}

// New Year's at midnight: fireworks. Ziggy cheers, Minnie hides at the edge and Frank guards her.
function startFireworks(cols = BURST_COLS, line = 'noise. ugh.') {
  const [z, f, m] = dogs, top = skyTop();
  for (let i = 0; i < 8; i++) {
    later(i * 0.8 + rnd(0, 0.4), () => {
      const e = prop('burst', pix(BURST, { x: cols[Math.floor(Math.random() * cols.length)], c: '#fff' }, 3));
      e.style.transform = `translate(${Math.round(rnd(0.1, 0.9) * innerWidth - 16)}px, ${Math.round(top + rnd(20, 170))}px)`;
      e.addEventListener('animationend', () => e.remove());
    });
  }
  later(0.4, () => free(m) && interrupt(m, 'cower'));
  later(0.7, () => free(z) && interrupt(z, 'cheer'));
  later(2.4, () => { if (free(f)) { interrupt(f, 'guardM'); say(f, line, 1.8); } });
}
// (July 4 night uses it too, in red, white and blue, and Frank says "too loud.")

// Easter: a bunny hops across the lawn. Ziggy chases it off; Frank grumbles; Minnie can't be bothered.
function startBunny() {
  if (!free(dogs[Z]) || bunny) return;
  const dir = (dogs[Z].sx ?? 0) < innerWidth / 2 ? 1 : -1; // from Ziggy's side, so he can chase it across
  bunny = { el: prop('bunny', BUNNY_PX), dir, x: dir > 0 ? -24 : innerWidth + 24, v: Math.max(120, innerWidth / 6), t: 0 }; // 3-6 s across
  later(0.6, () => free(dogs[Z]) && interrupt(dogs[Z], 'bunnychase'));
  later(1.6, () => { const f = dogs[F]; if (free(f) && !SCENE_ACTS.has(f.actName)) say(f, 'hmph.', 1.6); });
  later(2, () => { const m = dogs[M]; if (free(m) && onScreen(m) && !SCENE_ACTS.has(m.actName)) interrupt(m, 'ignore'); });
}

// Halloween night: a little ghost drifts across the sky. Ziggy barks at it, Frank gives it one woof, Minnie hides.
function startGhost() {
  if (ghost) return;
  ghost = { el: prop('ghost', GHOST_PX), x: -30, y: skyTop() + rnd(30, 80), v: (innerWidth + 60) / 10 };
  later(1.2, () => free(dogs[Z]) && interrupt(dogs[Z], 'ghostbark'));
  later(1.8, () => free(dogs[M]) && interrupt(dogs[M], 'cower'));
  later(2.6, () => free(dogs[F]) && interrupt(dogs[F], 'onewoof'));
}

// New Year's Day: confetti. Ziggy jumps for it, Frank turns his back, Minnie sits it out, then shakes it off.
function startConfetti() {
  const [z, f, m] = dogs;
  confettiUntil = clock + 9;
  later(0.8, () => free(z) && interrupt(z, 'confcatch'));
  later(1.4, () => free(f) && !SCENE_ACTS.has(f.actName) && interrupt(f, 'grumble'));
  later(1.8, () => free(m) && !SCENE_ACTS.has(m.actName) && interrupt(m, 'gaze'));
  later(10, () => { if (free(m) && !SCENE_ACTS.has(m.actName)) { interrupt(m, 'shake'); say(m, '…', 1.5); } });
}

// Valentine's: Ziggy brings Minnie his rose. Not today. Frank sits by her, and a heart pops over him.
function startRose() {
  if (free(dogs[Z]) && onScreen(dogs[M])) interrupt(dogs[Z], 'woo');
}

// St. Patrick's: a rainbow comes down on the lawn. Ziggy digs at its end and finds gold; Frank sits on it.
function startRainbow() {
  if (!free(dogs[Z]) || rainbow) return;
  rainbow = { el: prop('rainbow', RAINBOW_PX), x: clamp(rnd(0.35, 0.8) * innerWidth, 140, innerWidth - 24), coin: null, until: clock + 40 };
  root.prepend(rainbow.el); // behind the dogs
  later(1.2, () => free(dogs[Z]) && interrupt(dogs[Z], 'goldig'));
}

function holidayStep(dt) {
  const gy = groundY();
  if (giftBox && dogs[Z].actName !== 'unwrap' && clock - giftBox.t > 1) { giftBox.el.remove(); giftBox = null; } // he was interrupted
  if (sleigh) {
    const s = sleigh;
    s.x += s.v * dt;
    s.el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y - (s.x / innerWidth) * 24 + Math.sin(clock * 3) * 3)}px)`;
    if (s.x > innerWidth + 20) { s.el.remove(); sleigh = null; }
  }
  if (bunny) {
    const b = bunny, hop = Math.abs(Math.sin(b.t * 7));
    b.t += dt; b.x += b.dir * b.v * dt;
    b.el.style.transform = `translate(${Math.round(b.x - 11)}px, ${Math.round(gy - 14 - hop * 12)}px) scaleX(${b.dir})`;
    if (b.x < -40 || b.x > innerWidth + 40) { b.el.remove(); bunny = null; }
  }
  if (ghost) {
    const g = ghost;
    g.x += g.v * dt;
    g.el.style.transform = `translate(${Math.round(g.x)}px, ${Math.round(g.y + Math.sin(clock * 2) * 8)}px)`;
    if (g.x > innerWidth + 30) { g.el.remove(); ghost = null; }
  }
  if (!still && clock < confettiUntil && clock > nextConfetti && confetti.length < 70) {
    nextConfetti = clock + 0.1;
    const e = prop('confetti');
    e.style.background = CONFETTI_COLS[Math.floor(Math.random() * CONFETTI_COLS.length)];
    confetti.push({ el: e, x: rnd(0, innerWidth), y: skyTop(), v: rnd(45, 75), ph: rnd(0, 9), down: false });
  }
  for (const c of confetti) {
    if (c.down) continue;
    c.y += c.v * dt;
    if (c.y >= gy - 2) {
      c.y = gy - 2; c.down = true;
      c.el.classList.add('down');
      c.el.addEventListener('animationend', () => { c.el.remove(); c.gone = true; });
    }
    c.el.style.transform = `translate(${Math.round(c.x + Math.sin(clock * 3 + c.ph) * 8)}px, ${Math.round(c.y)}px) rotate(${Math.round(Math.sin(clock * 5 + c.ph)) * 45}deg)`;
  }
  confetti = confetti.filter(c => !c.gone);
  if (rainbow) {
    const r = rainbow;
    r.el.style.transform = `translate(${Math.round(r.x - 126)}px, ${Math.round(gy - 72)}px)`;
    if (r.coin) { const a = clock - r.coinT; r.coin.style.transform = `translate(${Math.round(r.x - 6)}px, ${Math.round(gy - 10 - (a < 0.6 ? Math.sin((a / 0.6) * Math.PI) * 16 : 0))}px)`; }
    if (!r.out && (r.done || clock > r.until)) { r.out = clock; r.el.classList.add('out'); r.coin?.remove(); r.coin = null; }
    if (r.out && clock - r.out > 1.6) { r.el.remove(); rainbow = null; }
  }
}

Object.assign(ACTS, {
  // A holiday line, in character: Ziggy bouncing, Frank sitting with his back turned, Minnie nose in the air.
  quip: d => {
    const lines = QUIPS[holiday()]?.[d.def.k];
    if (!lines) return null;
    const text = lines[Math.floor(Math.random() * lines.length)];
    if (d.def.k === 'z') return { dur: 2.4, bubble: text, mood: 'happy', fx: hol('valentines') ? 'joy' : undefined, pose: (dd, u, t) => ({ mouth: 1, head: -0.22, y: -Math.abs(Math.sin(t * 9)) * 4, ear: 0.2 }) };
    if (d.def.k === 'f') { d.facing *= -1; return { dur: 2.8, bubble: text, pose: () => ({ sit: 1, head: 0.1, ear: -0.15 }) }; }
    return { dur: 3, bubble: text, pose: () => ({ sit: 1, head: -0.32, eyes: 0 }) };
  },
  // Ziggy tears into a present: paper everywhere, and out bounces a ball.
  unwrap: () => ({
    dur: 2.8,
    pose: (d, u, t) => {
      const box = giftBox;
      if (!box) { d.actT = d.act.dur; return {}; }
      const n = Math.floor(d.actT / 0.4);
      if (n !== d.tried) { d.tried = n; puff(box.x, box.y - 6, 100, false, 'paper'); }
      if (u > 0.9) {
        box.el.remove(); giftBox = null;
        if (!ball) throwBall({ x: box.x, y: box.y, dir: Math.random() < 0.5 ? 1 : -1 });
        d.actT = d.act.dur;
        return {};
      }
      return { bow: 0.2, head: 0.35 + 0.1 * Math.sin(t * 25), mouth: Math.floor(t * 8) % 2, ear: -0.2 };
    },
  }),
  // Ziggy, woken by sleigh bells: sits up barking at the sky, then goes back to sleep.
  santa: d => {
    d.queue.push('nap');
    return {
      dur: 3.6, bubble: 'SANTA?!', mood: 'happy',
      pose: (dd, u, t) => { if (sleigh) dd.facing = sleigh.x > dd.sx ? 1 : -1; const m = Math.floor(t * 4) % 2; return { sit: 1, head: -0.45 - 0.06 * m, mouth: m, ear: 0.2 }; },
    };
  },
  // Ziggy runs after the Easter bunny until it's gone.
  bunnychase: d => needGround(d, 'bunnychase') || {
    dur: 14, run: 1, bubble: 'BUNNY!!', mood: 'happy',
    pose: dd => {
      const b = bunny;
      if (!b) { dd.actT = dd.act.dur; return {}; }
      walkTo(dd, noseTo(dd, clamp(b.x, 12, innerWidth - 12)).fx);
      return { mouth: 1, ear: -0.3, head: -0.05 };
    },
  },
  // Ziggy, at a ghost in the sky: sits up barking at it, then goes back to sleep.
  ghostbark: d => {
    d.queue.push('nap');
    return {
      dur: 3.6, bubble: 'BOO?!',
      pose: (dd, u, t) => { if (ghost) dd.facing = ghost.x > dd.sx ? 1 : -1; const m = Math.floor(t * 4) % 2; return { sit: 1, head: -0.45 - 0.06 * m, mouth: m, ear: -0.1 }; },
    };
  },
  // Frank lifts his head: one woof, and back to sleep.
  onewoof: d => { d.queue.push('nap'); return { dur: 2.2, bubble: 'WOOF.', pose: (dd, u) => ({ lie: 1, head: -0.15, mouth: u > 0.15 && u < 0.4 ? 1 : 0, ear: -0.2 }) }; },
  cheer: () => ({ dur: 3.4, bubble: 'WOO!!', mood: 'happy', pose: (d, u, t) => ({ mouth: 1, head: -0.4, y: -Math.abs(Math.sin(t * 8)) * 5, ear: 0.25 }) }),
  confcatch: () => ({ dur: 6, bubble: 'PARTY!!', mood: 'happy', pose: (d, u, t) => ({ y: -Math.abs(Math.sin(t * 5)) * 7, mouth: Math.floor(t * 5) % 2, head: -0.35, ear: 0.2 }) }),
  // Ziggy to Minnie, rose in his teeth: a play bow and hearts. Then he slinks off.
  woo: () => ({
    dur: 18,
    pose: (d, u, t) => {
      const m = dogs[M];
      if (!d.bowed && !onScreen(m) && !m.jump) { d.actT = d.act.dur; return {}; }
      if (d.jump || m.jump) return {};
      if (!d.bowed) {
        if (d.surf !== m.surf) { jumpTo(d, [m.surf, beside(m, d, 30)]); return {}; }
        if (Math.abs(d.sx - m.sx) > 40) { walkTo(d, beside(m, d, 30)); d.slow = 0.9; return { ear: 0.2, head: -0.1 }; }
        d.move = null; d.facing = m.sx > d.sx ? 1 : -1;
        d.bowed = clock; say(d, 'BE MINE!!', 2.2, 'happy'); showFx(d, 'joy');
      }
      const s = clock - d.bowed;
      if (s > 2.2 && !d.said) { d.said = 1; interrupt(m, 'rebuff'); }
      if (s > 3.8) { d.queue = ['slink']; d.actT = d.act.dur; return {}; }
      return s < 2.2 ? { bow: 0.22, ear: 0.2, head: -0.1 } : { sit: 1, ear: -0.3, head: 0.05 };
    },
  }),
  // Minnie turns her back on him. Frank comes and sits by her; once he's settled, one heart.
  rebuff: m => {
    const z = dogs[Z], f = dogs[F];
    m.facing = (z.sx ?? 0) > m.sx ? -1 : 1;
    m.queue.push('gaze'); // and stays put, so Frank can settle beside her
    later(1.2, () => free(f) && interrupt(f, 'guardM'));
    const heart = n => later(1, () => {
      if (f.actName !== 'guardM' || n <= 0) return;
      if (f.move || f.jump) heart(n - 1); else showFx(f, 'heart');
    });
    later(2, () => heart(10));
    return { dur: 3, bubble: 'not today.', pose: () => ({ sit: 1, head: -0.32, eyes: 0 }) };
  },
  // Ziggy runs to the end of the rainbow and digs; up comes a gold coin.
  goldig: d => needGround(d, 'goldig') || {
    dur: 22, run: 1,
    pose: (dd, u, t) => {
      const r = rainbow;
      if (!r || r.out) { dd.actT = dd.act.dur; return {}; }
      if (!dd.sniffing) {
        const { fx, dir } = noseTo(dd, r.x);
        if (Math.abs(fx - dd.fx) > 0.006) { walkTo(dd, fx); return { mouth: 1, ear: -0.3 }; }
        dd.move = null; dd.facing = dir; dd.sniffing = clock;
        say(dd, 'RAINBOW!!', 1.4, 'happy');
      }
      const s = clock - dd.sniffing;
      if (s < 2.6) {
        const n = Math.floor(s / 0.45);
        if (n !== dd.tried) { dd.tried = n; puff(r.x, groundY(), 100, true); }
        return { bow: 0.18, ph: t * 30, amp: 0.25, head: 0.3 };
      }
      if (!dd.took) {
        dd.took = 1;
        r.coin = prop('treat', COIN_PX); r.coinT = clock;
        say(dd, 'GOLD?!', 2.2, 'happy');
        later(1.2, () => free(dogs[F]) && interrupt(dogs[F], 'claim'));
        const m = dogs[M];
        later(2, () => { if (free(m) && onScreen(m) && !SCENE_ACTS.has(m.actName)) { interrupt(m, 'ignore'); say(m, 'how green.', 1.8); } });
      }
      if (s > 14) { r.done = true; dd.actT = dd.act.dur; return {}; }
      return { sit: 1, mouth: 1, head: -0.2, y: -Math.abs(Math.sin(t * 9)) * 3, ear: 0.2 };
    },
  },
  // Frank stalks over, shoos Ziggy off, and sits on the gold.
  claim: f => needGround(f, 'claim') || {
    dur: 20, run: 1,
    pose: d => {
      const r = rainbow, z = dogs[Z];
      if (!r || r.out) { d.actT = d.act.dur; return {}; }
      if (!d.settled) {
        if (z.actName === 'goldig' && Math.abs(d.sx - z.sx) < 70) interrupt(z, 'slink');
        if (Math.abs(d.sx - r.x) > 4) { walkTo(d, clamp(r.x / innerWidth, 0.03, 0.97)); return { ear: -0.2, head: -0.05 }; }
        d.move = null; d.settled = clock;
        r.coin?.remove(); r.coin = null;
        say(d, 'mine.', 2.2);
      }
      if (clock - d.settled > 4.5) { r.done = true; d.actT = d.act.dur; return {}; }
      return { sit: 1, head: -0.08, ear: -0.1 };
    },
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
  press = d ? null : { x: e.clientX, y: e.clientY, at: performance.now(), id: e.pointerId };
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
  if (press && e.pointerId === press.id) doubleTap(e);
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
  // A desktop double-click selects a word as well as dropping a treat; undo that.
  addEventListener('dblclick', () => { if (performance.now() < suppressClick) getSelection?.()?.removeAllRanges(); }, true);
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
    press = lastTap = null;
    leaves = []; flies = []; bowl = null; rope = null; treat = null;
    tugS = stealS = pileSpot = null;
    leafBits = [];
    giftBox = sleigh = rainbow = null; confetti = []; confettiUntil = 0;
    lastPhase = null;
    document.documentElement.classList.remove('dog-held');
    return;
  }
  const born = !dogs.length;
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
  const prev = lastPhase;
  lastPhase = k.phase;
  maybeStretch(born ? null : prev);
  if (q.has('dogspeed')) { // for debugging; __step(secs) runs the pack forward even in a background tab
    window.__pack = dogs;
    window.__step = secs => {
      for (let i = 0; i < secs * 30; i++) { skew += 1000 / 30; frame(performance.now()); cancelAnimationFrame(raf); }
      raf = requestAnimationFrame(frame);
    };
  }
  if (!raf) raf = requestAnimationFrame(frame);
}
