// Ziggy, Frank and Minnie roam the screen. Each picks what to do next at random, weighted by its
// personality and by the weather (see conditions.js), so no two minutes look the same.
// Ziggy is hyper and playful, Frank grumpy and protective, Minnie absent-minded and aloof.
//
// Dogs stand on "surfaces": the top of the tab bar (the ground), the top edges of tiles and cards,
// and the big temperature. Surfaces are looked up afresh every frame, because the views re-render.
// Debug: ?dogspeed=8 speeds everything up; ?dogact=zoomies forces an activity for every dog that has it.

import { render, box } from './sprites.js';

const q = new URLSearchParams(location.search);
const SPEED = Math.max(0.1, +q.get('dogspeed') || 1);
const FORCE = q.get('dogact');
const K = 2; // screen pixels per sprite pixel
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = list => {
  const total = list.reduce((s, [, w]) => s + Math.max(0, w), 0);
  let r = Math.random() * total;
  for (const [v, w] of list) if ((r -= Math.max(0, w)) <= 0) return v;
  return list[0][0];
};

let root, opts = {}, dogs = [], k = null, raf = 0, still = false, lastDraw = 0, suppressClick = 0, tap = null, scrolled = true;

const DEFS = [
  { k: 'z', name: 'Ziggy', walk: 52, run: 190, start: ['ground', 0.22] },
  { k: 'f', name: 'Frank', walk: 34, run: 90, start: ['ground', 0.72] },
  { k: 'm', name: 'Minnie', walk: 28, run: 70, start: ['hero', 0.75] },
];

// ---------- surfaces ----------

function surfaces() {
  const out = new Map();
  const tabs = document.querySelector('.tabs')?.getBoundingClientRect();
  const groundY = tabs ? tabs.top : innerHeight;
  const topY = (document.querySelector('.top')?.getBoundingClientRect().bottom || 0) + 46;
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
  hide: d => needGround(d, 'hide') || (walkTo(d, d.fx < 0.5 ? -26 / innerWidth : 1 + 26 / innerWidth), d.queue.push('comeback'), { dur: rnd(14, 22), untilArriveThenWait: 1, pose: () => ({ lie: 1 }) }),
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
};

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
    ? { sit: 3, lie: 3, nap: 1, look: 1.5, scratch: 0.7, yawn: 0.5, wander: 3, hop: 2.5, sniff: 1, playbow: 0.8, zoomies: 0.8 }
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
  d.turned = 0; d.slow = 1; d.move = null;
  let name = d.queue.shift();
  // Frank won't stand on hot pavement: first thing, he finds a tile.
  if (!name && !still && k.hotGround && d.def.k === 'f' && d.surf === 'ground' && surfaces().size > 1) name = 'hop';
  if (!name) {
    if (FORCE && ACTS[FORCE]) name = FORCE;
    else if (still) name = pick([['sit', 1], ['lie', 1]]);
    else name = pick(weights(d));
  }
  d.actName = name;
  d.act = ACTS[name](d) || { dur: 2 };
  d.actT = 0;
  if (d.act.bubble) say(d, d.act.bubble, Math.min(d.act.dur, 3));
  else { d.bubble.hidden = true; clearTimeout(d.bubbleTimer); }
}

// ---------- per-frame ----------

function say(d, text, secs) {
  d.bubble.textContent = text;
  d.bubble.hidden = false;
  clearTimeout(d.bubbleTimer);
  d.bubbleTimer = setTimeout(() => { d.bubble.hidden = true; }, secs * 1000);
}

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
    y = A.y + (B.y - A.y) * u - Math.sin(Math.PI * u) * (36 + Math.abs(B.y - A.y) * 0.25);
    d.facing = B.x >= A.x ? 1 : -1;
  } else ({ x, y } = at(S, d.surf, d.fx));
  const b = d.box;
  x += (d.pose?.x || 0) * K;
  d.cv.style.transform = `translate(${Math.round(x - b.cx * K)}px, ${Math.round(y - b.footY * K)}px) scaleX(${d.facing})`;
  d.bubble.style.transform = `translate(${Math.round(x - 24)}px, ${Math.round(y - b.footY * K * 0.8)}px) translateY(-100%)`;
  d.sx = x; d.sy = y;
}

function frame(now) {
  raf = requestAnimationFrame(frame);
  if (!k) return;
  const t = now / 1000, dt = Math.min(0.1, (t - (frame.t || t))) * (still ? 0 : SPEED);
  frame.t = t;
  const draw = now - lastDraw > 90;
  if (draw) lastDraw = now;
  const moving = dogs.some(d => d.jump || d.move);
  if (draw || moving || scrolled || !frame.S) { frame.S = surfaces(); scrolled = false; }
  const S = frame.S;
  for (const d of dogs) {
    step(d, dt, still ? 0 : t * SPEED, S);
    if (draw) render(d.def.k, d.pose, d.ctx);
    place(d, S);
  }
}

// ---------- taps ----------

function hitDog(x, y) {
  for (const d of dogs) {
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
  if (z) d.queue.push('playbow', 'zoomies');
  else if (f) d.queue.push('grumble');
  else if (Math.random() < 0.2) { d.tapFx = Math.min(0.95, Math.max(0.05, x / innerWidth)); d.queue.push('come'); }
  else d.queue.push('ignore');
  if (!d.jump) choose(d);
}

function onDown(e) {
  if (!k || !dogs.length) return;
  const d = hitDog(e.clientX, e.clientY);
  tap = d ? { d, x: e.clientX, y: e.clientY, at: performance.now(), id: e.pointerId } : null;
}
function onUp(e) {
  if (!tap || e.pointerId !== tap.id) return;
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
  addEventListener('click', e => { if (performance.now() < suppressClick) { e.preventDefault(); e.stopPropagation(); } }, true);
}

/** Conditions from conditions.js, or null to send the dogs away. */
export function setDogs(next) {
  k = next;
  if (!k) {
    root.textContent = '';
    dogs = [];
    return;
  }
  if (!dogs.length) {
    dogs = DEFS.map((def, i) => {
      const b = box(def.k), cv = document.createElement('canvas');
      cv.width = b.w; cv.height = b.h;
      cv.className = 'dog';
      cv.style.width = `${b.w * K}px`; cv.style.height = `${b.h * K}px`;
      const bubble = document.createElement('span');
      bubble.className = 'bubble';
      bubble.hidden = true;
      root.append(cv, bubble);
      return {
        def, box: b, cv, ctx: cv.getContext('2d', { willReadFrequently: true }), bubble,
        surf: def.start[0], fx: def.start[1], facing: i === 1 ? -1 : 1, queue: [], seed: i * 1.7, slow: 1, act: null, actT: 0,
      };
    });
  }
  if (q.has('dogspeed')) window.__pack = dogs; // for debugging
  if (!raf) raf = requestAnimationFrame(frame);
}
