// What the sky scene and the dogs react to, worked out once from the station's readings.
// A Settings preview can stand in for the live weather so each behaviour can be seen on demand.

const MIN = 6e4;

/** Sunrise and sunset (ms) for a place and day, or null in polar day or night. NOAA approximation. */
export function sunTimes(lat, lon, t = Date.now()) {
  const d = new Date(t);
  const base = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const doy = Math.round((base - Date.UTC(d.getFullYear(), 0, 0)) / 864e5);
  const g = (2 * Math.PI / 365) * (doy - 1);
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const r = (lat * Math.PI) / 180;
  const cosHa = Math.cos((90.833 * Math.PI) / 180) / (Math.cos(r) * Math.cos(decl)) - Math.tan(r) * Math.tan(decl);
  if (cosHa < -1 || cosHa > 1) return null;
  const ha = (Math.acos(cosHa) * 180) / Math.PI;
  const noon = 720 - 4 * lon - eqt; // minutes after UTC midnight
  return { rise: base + (noon - 4 * ha) * MIN, set: base + (noon + 4 * ha) * MIN };
}

/** Sun elevation in degrees above the horizon. NOAA approximation. */
export function sunElevation(lat, lon, t = Date.now()) {
  const d = new Date(t);
  const doy = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
  const g = (2 * Math.PI / 365) * (doy - 1 + (d.getUTCHours() - 12) / 24);
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes() + eqt + 4 * lon;
  const ha = ((mins / 4 - 180) * Math.PI) / 180, r = (lat * Math.PI) / 180;
  const cosZ = Math.sin(r) * Math.sin(decl) + Math.cos(r) * Math.cos(decl) * Math.cos(ha);
  return 90 - (Math.acos(Math.max(-1, Math.min(1, cosZ))) * 180) / Math.PI;
}

// Weather Company icon codes: how much of the sky is cloud, and what is falling.
const ICON_CLOUD = { 26: 1, 27: 0.85, 28: 0.85, 29: 0.5, 30: 0.5, 33: 0.2, 34: 0.2, 31: 0.05, 32: 0.05, 36: 0.05, 19: 0.6, 20: 0.95, 21: 0.6, 22: 0.6 };
const WET = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 35, 37, 38, 39, 40, 41, 42, 43, 45, 46, 47];
const SNOWY = [5, 7, 13, 14, 15, 16, 41, 42, 43, 46];

/** What the official observation says is falling, as a rain rate (in/h) for drawing, or 0. */
function obsPrecip(o) {
  if (!WET.includes(o.icon)) return 0;
  const p = o.phrase.toLowerCase();
  return /heavy/.test(p) ? 0.4 : /drizzle|light|flurr/.test(p) ? 0.03 : 0.12;
}

/** dawn | day | dusk | night for a time, from the station's position; falls back to the clock. */
export function phaseAt(lat, lon, t = Date.now()) {
  const s = lat != null && lon != null ? sunTimes(lat, lon, t) : null;
  if (!s) {
    const h = new Date(t).getHours();
    return h < 6 || h >= 20 ? 'night' : h < 7 ? 'dawn' : h >= 19 ? 'dusk' : 'day';
  }
  const W = 40 * MIN;
  if (t < s.rise - W || t > s.set + W) return 'night';
  if (t < s.rise + W) return 'dawn';
  if (t > s.set - W) return 'dusk';
  return 'day';
}

export const PREVIEWS = [
  ['live', 'Live weather'], ['sunny', 'Sunny'], ['rain', 'Rain'], ['wind', 'Windy'],
  ['puddles', 'After rain'], ['fog', 'Fog'], ['snow', 'Snow'], ['aftersnow', 'After snow'], ['frost', 'Frosty'],
  ['ice', 'Icy puddles'], ['hot', 'Hot'],
  ['storm', 'Storm coming'], ['dawn', 'Sunrise'], ['night', 'Night'], ['warmnight', 'Warm night'],
];

// ---------- what the yard remembers ----------
// Snow lies on the lawn and hills for days after it stops falling, melting slowly below freezing and
// faster as it warms (or rains); a snowman goes up once it stops; puddles from rain in the last day and a
// half freeze over on a freezing day. Only live readings from a real station are remembered (never a
// preview or demo data), in localStorage.
// Debug: ?snowlying=0..1 sets how much snow lies (with a snowman, unless it's snowing), ?ice freezes the puddles.

const q = new URLSearchParams(location.search);
const YARD_KEY = 'backyard-yard';
let yard = null;
function loadYard() {
  if (!yard) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(YARD_KEY)); } catch { /* storage unavailable */ }
    yard = { snow: 0, t: Date.now(), man: 0, wet: 0, ...(saved && typeof saved === 'object' ? saved : {}) };
  }
  return yard;
}

function yardMemory(k, preview, remember) {
  const live = preview === 'live', now = Date.now();
  const y = loadYard();
  if (live && remember) {
    const h = Math.min(96, Math.max(0, (now - y.t) / 36e5));
    if (k.snowing) {
      // Settles over an hour or so, quicker in heavier snow (the gap since the last reading counts for at most an hour).
      y.snow = Math.min(1, y.snow + Math.min(1, h) * (0.6 + 8 * k.rainRate));
    } else {
      // Per day: barely at all in the cold, gone in about a day at 40°F, faster in rain or sun.
      const rate = (k.temp <= 32 ? 0.12 : Math.min(3, 0.12 + (k.temp - 32) * 0.11)) + (k.rain ? 2 : 0) + (k.sunny ? 0.15 : 0);
      y.snow = Math.max(0, y.snow - (h / 24) * rate);
    }
    if (!k.snowing && y.snow >= 0.4 && !k.night) y.man = 1; // built once it stops, in daylight
    if (y.snow < 0.12) y.man = 0;
    if (k.rain || k.puddles) y.wet = now;
    y.t = now;
    try { localStorage.setItem(YARD_KEY, JSON.stringify(y)); } catch { /* storage unavailable */ }
  }
  k.snowLying = live ? y.snow : preview === 'aftersnow' ? 0.9 : 0;
  k.snowman = live ? !!y.man : preview === 'aftersnow';
  if (q.has('snowlying')) {
    k.snowLying = Math.min(1, Math.max(0, +q.get('snowlying') || 0));
    k.snowman = k.snowLying >= 0.12 && !k.snowing;
  }
  // Puddles freeze when it's at or below freezing after rain (today's, or up to a day and a half ago),
  // unless they're under the snow.
  const rained = k.rainToday >= 0.05 || (live && now - y.wet < 36 * 36e5);
  k.ice = (k.freezing && !k.raining && k.snowLying < 0.5 && rained) || q.has('ice');
}

/**
 * @param c        current reading (imperial units, as stored) or null
 * @param dp       pressure change over 3 h in inHg, or null
 * @param loc      { lat, lon } or null
 * @param preview  one of PREVIEWS ids
 */
export function conditions(c, dp, loc, preview = 'live', extra = {}) {
  const k = {
    phase: phaseAt(loc?.lat, loc?.lon), temp: c?.temp ?? 60, rainRate: c?.rainRate ?? 0, rainToday: c?.rain ?? 0,
    wind: c?.wind ?? 0, gust: c?.gust ?? c?.wind ?? 0, uv: c?.uv ?? 0, humidity: c?.humidity ?? 50,
    dewpt: c?.dewpt ?? null, falling: dp != null && dp <= -0.06,
    lat: loc?.lat ?? null, // for the seasons: south of the equator they run half a year apart
  };
  // Cloud cover, 0 (clear) to 1 (overcast), from the best source to hand; null when unknown.
  let cloud = null, fogObs = false;
  if (preview === 'live') {
    // 1. The station's own solar sensor against a clear sky at this sun height: the most local measure.
    const el = loc ? sunElevation(loc.lat, loc.lon, c?.t ?? Date.now()) : -90;
    if (c?.solar != null && el > 12) {
      const s = Math.sin((el * Math.PI) / 180), clear = 1098 * s * Math.exp(-0.057 / s);
      cloud = Math.max(0.05, Math.min(1, (0.85 - c.solar / clear) / 0.6));
    }
    // 2. The official observation: sky cover when the sun is too low to judge, and drizzle or rain
    // too light for the station's rain gauge to register.
    const o = extra.sky;
    if (o && Date.now() - o.t < 2 * 36e5) {
      if (cloud == null && ICON_CLOUD[o.icon] != null) cloud = ICON_CLOUD[o.icon];
      const p = obsPrecip(o);
      if (p && !k.rainRate) {
        k.rainRate = p;
        if (SNOWY.includes(o.icon) && k.temp > 34) k.temp = 34;
      }
      if (p) cloud = Math.max(cloud ?? 0, 0.9);
      fogObs = o.icon === 20;
    }
    // 3. The forecast's cloud cover for this part of the day.
    const f = extra.forecast?.[0]?.cloud;
    if (cloud == null && f != null) cloud = f / 100;
  }
  const set = o => Object.assign(k, o);
  switch (preview) {
    case 'sunny': set({ phase: 'day', temp: 72, rainRate: 0, rainToday: 0, wind: 4, gust: 7, uv: 7, humidity: 40, falling: false }); break;
    case 'rain': set({ temp: 55, rainRate: 0.25, rainToday: 0.4, wind: 6, gust: 10, uv: 0, humidity: 96, falling: false }); break;
    case 'wind': set({ temp: 58, rainRate: 0, wind: 18, gust: 31, uv: 2, humidity: 55, falling: false }); break;
    case 'snow': set({ temp: 29, rainRate: 0.06, rainToday: 0.1, wind: 5, gust: 9, uv: 0, humidity: 92, falling: false }); break;
    case 'aftersnow': set({ phase: 'day', temp: 28, rainRate: 0, rainToday: 0, wind: 3, gust: 5, uv: 2, humidity: 75, falling: false }); break;
    case 'ice': set({ phase: 'day', temp: 27, rainRate: 0, rainToday: 0.3, wind: 2, gust: 4, uv: 2, humidity: 80, falling: false }); break;
    case 'frost': set({ phase: 'dawn', temp: 26, rainRate: 0, rainToday: 0, wind: 2, gust: 4, uv: 1, humidity: 80, falling: false }); break;
    case 'hot': set({ phase: 'day', temp: 94, rainRate: 0, rainToday: 0, wind: 3, gust: 6, uv: 9, humidity: 45, falling: false }); break;
    case 'storm': set({ temp: 66, rainRate: 0, wind: 12, gust: 22, uv: 1, humidity: 82, falling: true }); break;
    case 'night': set({ phase: 'night', rainRate: 0, uv: 0 }); break;
    case 'puddles': set({ temp: 56, rainRate: 0, rainToday: 0.6, wind: 4, gust: 7, uv: 1, humidity: 85, falling: false }); break;
    case 'fog': set({ temp: 48, dewpt: 47.5, humidity: 99, rainRate: 0, rainToday: 0, wind: 1, gust: 2, uv: 0, falling: false }); break;
    case 'dawn': set({ phase: 'dawn', temp: 52, rainRate: 0, rainToday: 0, wind: 2, gust: 4, uv: 0, humidity: 70, falling: false }); break;
    case 'warmnight': set({ phase: 'night', temp: 72, rainRate: 0, rainToday: 0, wind: 2, gust: 4, uv: 0, humidity: 70, falling: false }); break;
  }
  k.night = k.phase === 'night';
  k.raining = k.rainRate > 0;
  k.snowing = k.raining && k.temp <= 34;
  k.rain = k.raining && !k.snowing;
  k.puddles = k.rainToday >= 0.05 && k.temp > 32;
  k.windy = k.gust >= 15 || k.wind >= 12;
  k.cold = k.temp < 40;
  k.freezing = k.temp <= 32;
  k.frost = k.temp <= 32 && !k.raining;
  // Asphalt in full sun runs far hotter than the air; past roughly 125°F it can burn paws.
  k.hotGround = !k.night && (k.temp >= 85 || (k.temp >= 77 && k.uv >= 6));
  k.hot = k.temp >= 85 || k.hotGround;
  k.fog = fogObs || (k.humidity >= 97 && k.dewpt != null && k.temp - k.dewpt < 2);
  if (cloud != null) {
    k.cloud = k.raining ? Math.max(0.9, cloud) : cloud;
    k.sunny = !k.night && !k.raining && k.cloud < 0.35 && k.uv >= 5;
  } else {
    // No sky report (previews, or nothing fetched yet): guess from the station alone.
    k.sunny = !k.night && !k.raining && k.uv >= 6;
    k.cloud = k.raining ? 1 : k.falling ? 0.8 : k.humidity >= 90 ? 0.7 : k.sunny ? 0.15 : 0.4;
  }
  yardMemory(k, preview, extra.remember);
  return k;
}
