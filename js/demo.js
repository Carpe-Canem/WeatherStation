// Synthetic station data in the same shapes as wu.js, so the app can be explored
// before a real station is connected. Values are a smooth function of time, so
// every view (now, today, 7 days, 30 days) agrees with the others.
const DAY = 864e5, HOUR = 36e5;

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dayStart = t => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const cache = new Map();
function dayParams(ds) {
  const key = Math.round(ds / DAY);
  if (!cache.has(key)) {
    const r = rng(key * 7919);
    cache.set(key, {
      mean: 52 + (r() - 0.5) * 18,
      amp: 6 + r() * 6,
      rainy: r() < 0.3,
      rainStart: 4 + r() * 13,
      rainDur: 1 + r() * 4,
      rainRate: 0.03 + r() * 0.22,
      windBase: 2 + r() * 7,
      pOff: (r() - 0.5) * 0.36,
    });
  }
  return cache.get(key);
}

// Day-level parameters blend from noon to noon so nothing jumps at midnight.
function blend(t, key) {
  const ds = dayStart(t), h = (t - ds) / HOUR;
  const a = dayParams(h < 12 ? ds - DAY : ds);
  const b = dayParams(h < 12 ? ds : ds + DAY);
  const f = h < 12 ? (h + 12) / 24 : (h - 12) / 24;
  return a[key] + (b[key] - a[key]) * f;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function sample(t) {
  const ds = dayStart(t), h = (t - ds) / HOUR, p = dayParams(ds);
  const mean = blend(t, 'mean');
  const temp = mean + blend(t, 'amp') * Math.sin(((h - 9) / 24) * 2 * Math.PI)
    + 0.5 * Math.sin(t / 7e5) + 0.3 * Math.sin(t / 23e5);
  const raining = p.rainy && h >= p.rainStart && h <= p.rainStart + p.rainDur;
  // Rain lifts humidity, easing in and out over about 45 minutes.
  const wet = p.rainy ? clamp(Math.min(h - p.rainStart, p.rainStart + p.rainDur - h) / 0.75 + 1, 0, 1) : 0;
  const humidity = clamp(64 - (temp - mean) * 2.6 + wet * 18 + 3 * Math.sin(t / 11e5), 18, 99);
  const wind = Math.max(0, blend(t, 'windBase') * (0.6 + 0.5 * Math.sin(((h - 10) / 24) * 2 * Math.PI))
    + 1.2 * Math.sin(t / 9e5) + 0.6 * Math.sin(t / 37e4));
  const sun = h > 6.5 && h < 17.5 ? Math.sin(((h - 6.5) / 11) * Math.PI) : 0;
  const uv = sun * (p.rainy ? 1.5 : 4.5);
  return {
    t,
    temp,
    tempHi: temp + 0.4,
    tempLo: temp - 0.4,
    dewpt: temp - (100 - humidity) * 0.36,
    humidity,
    wind,
    gust: wind * 1.6 + 1.2,
    windDir: (230 + 55 * Math.sin(t / 3e7) + 25 * Math.sin(t / 5e5) + 360) % 360,
    pressure: 29.95 + blend(t, 'pOff') + 0.02 * Math.sin(t / 2e7),
    rain: p.rainy ? p.rainRate * clamp(h - p.rainStart, 0, p.rainDur) : 0,
    rainRate: raining ? p.rainRate : 0,
    uv,
    solar: uv * 130,
  };
}

export async function current() {
  const s = sample(Date.now());
  return { ...s, feels: s.temp <= 50 && s.wind > 3 ? s.temp - s.wind * 0.3 : s.temp, name: 'Demo station', lat: 40.44, lon: -79.99 };
}

export async function today() {
  const now = Date.now(), out = [];
  for (let t = dayStart(now); t <= now; t += 5 * 6e4) out.push(sample(t));
  return out;
}

export async function hourly() {
  const now = Date.now(), out = [];
  const first = Math.ceil((now - 7 * DAY) / HOUR) * HOUR;
  for (let t = first; t <= now; t += HOUR) out.push(sample(t));
  return out;
}

export async function daily(_cfg, days = 30) {
  const now = Date.now(), out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(dayStart(now));
    d.setDate(d.getDate() - i);
    const ds = d.getTime(), end = Math.min(ds + DAY - 1, now);
    const s = [];
    for (let t = ds; t <= end; t += 30 * 6e4) s.push(sample(t));
    s.push(sample(end));
    const avg = k => s.reduce((a, x) => a + x[k], 0) / s.length;
    const max = k => Math.max(...s.map(x => x[k]));
    const min = k => Math.min(...s.map(x => x[k]));
    out.push({
      t: ds + 12 * HOUR,
      temp: avg('temp'), tempHi: max('temp'), tempLo: min('temp'), dewpt: avg('dewpt'),
      humidity: avg('humidity'), wind: avg('wind'), gust: max('gust'), windDir: avg('windDir'),
      pressure: avg('pressure'), rain: max('rain'), rainRate: max('rainRate'),
      uv: max('uv'), solar: max('solar'),
    });
  }
  return out;
}

// The next 24 hours, shaped like nws.hours().
export async function hours() {
  const first = Math.ceil(Date.now() / HOUR) * HOUR - HOUR, out = [];
  for (let t = first; t < first + 24 * HOUR; t += HOUR) {
    const ds = dayStart(t), h = (t - ds) / HOUR, p = dayParams(ds);
    const wet = p.rainy && h >= p.rainStart - 1 && h <= p.rainStart + p.rainDur;
    const day = h >= 7 && h < 18;
    out.push({
      t, temp: sample(t).temp, pop: wet ? 70 : 10,
      icon: wet ? 'rain' : !day ? 'moon' : p.windBase > 6 ? 'partly' : 'sun',
      phrase: wet ? 'Rain' : !day ? 'Clear' : p.windBase > 6 ? 'Partly cloudy' : 'Sunny',
    });
  }
  return out;
}

export async function forecast() {
  const now = Date.now(), out = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(dayStart(now));
    d.setDate(d.getDate() + i);
    const p = dayParams(d.getTime());
    out.push({
      dow: i === 0 ? 'Today' : d.toLocaleDateString([], { weekday: 'short' }),
      hi: p.mean + p.amp,
      lo: p.mean - p.amp,
      pop: p.rainy ? 70 : 10,
      icon: p.rainy ? 12 : p.windBase > 6 ? 30 : 32,
      phrase: p.rainy ? 'Rain' : p.windBase > 6 ? 'Partly cloudy' : 'Sunny',
    });
  }
  return out;
}
