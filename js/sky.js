// The pixel-art backyard behind the app: sky by time of day, clouds, sun or moon, hills and a tree,
// and whatever the weather is doing (rain, snow, wind-blown leaves, fog, frost, puddles).
// Drawn at a low resolution and scaled up with crisp pixels. Frame rate drops when nothing moves fast.

export const W = 120;
/** Puddles on the lawn after rain: [x, width] in sky pixels (the dogs stomp in them). */
export const PUDDLES = [[18, 9], [62, 13], [96, 8]];
const rand = seed => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const SKY = {
  day: ['#3f9fe6', '#bfe6f8'], dawn: ['#6f8fd0', '#f9c9a6'], dusk: ['#4a5aa4', '#f5a179'], night: ['#08122c', '#1d2b58'],
};
const HILLS = {
  day: ['#86c77f', '#5fae54', '#4c9a43'], dawn: ['#79ad7a', '#5a9358', '#4a8048'], dusk: ['#6a8f62', '#4f7a4c', '#40683f'],
  night: ['#1d3a33', '#16302a', '#112620'],
};

let cv, ctx, H = 200, ground = 180, k = null, raf = 0, last = 0, still = false;
const r = rand(7);
const stars = Array.from({ length: 40 }, () => [r(), r() * 0.55, r()]);
const clouds = Array.from({ length: 8 }, () => [r(), 0.06 + r() * 0.36, 0.6 + r() * 0.6]);
const drops = Array.from({ length: 90 }, () => [r(), r()]);
const leaves = Array.from({ length: 9 }, () => [r(), r(), r()]);

const hexRgb = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
/** Blends two #rrggbb colours; returns #rrggbb. */
const mix = (a, b, f) => {
  const x = hexRgb(a), y = hexRgb(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * f).toString(16).padStart(2, '0')).join('');
};

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

function draw(t) {
  if (!k) return;
  const ph = k.phase, night = ph === 'night';
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
  // Sun or moon, hidden behind thick cloud.
  if (over < 0.7) {
    const pos = { day: [0.8, 0.22], dawn: [0.16, 0.62], dusk: [0.84, 0.64], night: [0.8, 0.2] }[ph];
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
  // Clouds drift with the wind.
  const n = Math.round(2 + k.cloud * 6), speed = 0.6 + k.wind * 0.18;
  const cc = night ? (k.raining ? '#2b334a' : '#26335e') : k.raining ? '#9ba7b4' : ph === 'day' ? '#ffffff' : '#f7d6c6';
  for (let i = 0; i < n; i++) {
    const [x0, y, s] = clouds[i];
    const x = (((x0 * (W + 50) + t * speed * s) % (W + 50)) + W + 50) % (W + 50) - 30;
    cloud(Math.floor(x), Math.floor(y * horizon), Math.max(2, Math.round(s * 3 + k.cloud * 1.5)), cc);
  }

  // Hills, a tree, and the lawn the dogs walk on.
  // Frost whitens the lawn a little; falling snow covers it.
  const cover = k.snowing ? 0.78 : k.frost ? 0.55 : 0;
  const [h1, h2, grass] = HILLS[ph].map(c => (cover ? mix(c, k.snowing ? '#f2f6fb' : '#e8f1f6', cover) : c));
  for (let x = 0; x < W; x++) {
    const a = Math.round(10 + 5 * Math.sin(x / 13 + 1) + 3 * Math.sin(x / 5));
    const b = Math.round(5 + 4 * Math.sin(x / 9 + 3) + 2 * Math.sin(x / 4));
    ctx.fillStyle = h1; ctx.fillRect(x, horizon + 18 - a, 1, H);
    ctx.fillStyle = h2; ctx.fillRect(x, horizon + 26 - b, 1, H);
  }
  const sway = k.windy ? Math.round(Math.sin(t * 6)) : 0;
  const tx = 14, ty = horizon + 12;
  ctx.fillStyle = night ? '#2a1d14' : '#6b4a2b'; ctx.fillRect(tx + 3, ty - 4, 3, 16);
  ctx.fillStyle = k.frost || k.snowing ? '#cfe0d9' : night ? '#173a2a' : '#3f8a3c';
  ctx.fillRect(tx - 3 + sway, ty - 16, 15, 10); ctx.fillRect(tx - 1 + sway, ty - 20, 11, 4); ctx.fillRect(tx - 4 + sway, ty - 10, 17, 5);
  ctx.fillStyle = grass; ctx.fillRect(0, ground, W, H - ground);
  ctx.fillStyle = mix(grass, '#ffffff', 0.18);
  for (let x = (Math.floor(t) % 2); x < W; x += 4) ctx.fillRect(x, ground, 1, 1);

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
}

function loop(now) {
  const fast = k && (k.raining || k.windy || k.fog);
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
}

/** New conditions from the weather; starts the animation the first time. */
export function setSky(next) {
  k = next;
  size();
  draw(performance.now() / 1000);
  if (!still && !raf) raf = requestAnimationFrame(loop);
}
