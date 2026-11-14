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
  ['snow', 'Snow'], ['frost', 'Frosty'], ['hot', 'Hot'], ['storm', 'Storm coming'], ['night', 'Night'],
];

/**
 * @param c        current reading (imperial units, as stored) or null
 * @param dp       pressure change over 3 h in inHg, or null
 * @param loc      { lat, lon } or null
 * @param preview  one of PREVIEWS ids
 */
export function conditions(c, dp, loc, preview = 'live') {
  const k = {
    phase: phaseAt(loc?.lat, loc?.lon), temp: c?.temp ?? 60, rainRate: c?.rainRate ?? 0, rainToday: c?.rain ?? 0,
    wind: c?.wind ?? 0, gust: c?.gust ?? c?.wind ?? 0, uv: c?.uv ?? 0, humidity: c?.humidity ?? 50,
    dewpt: c?.dewpt ?? null, falling: dp != null && dp <= -0.06,
  };
  const set = o => Object.assign(k, o);
  switch (preview) {
    case 'sunny': set({ phase: 'day', temp: 72, rainRate: 0, rainToday: 0, wind: 4, gust: 7, uv: 7, humidity: 40, falling: false }); break;
    case 'rain': set({ temp: 55, rainRate: 0.25, rainToday: 0.4, wind: 6, gust: 10, uv: 0, humidity: 96, falling: false }); break;
    case 'wind': set({ temp: 58, rainRate: 0, wind: 18, gust: 31, uv: 2, humidity: 55, falling: false }); break;
    case 'snow': set({ temp: 29, rainRate: 0.06, rainToday: 0.1, wind: 5, gust: 9, uv: 0, humidity: 92, falling: false }); break;
    case 'frost': set({ phase: 'dawn', temp: 26, rainRate: 0, rainToday: 0, wind: 2, gust: 4, uv: 1, humidity: 80, falling: false }); break;
    case 'hot': set({ phase: 'day', temp: 94, rainRate: 0, rainToday: 0, wind: 3, gust: 6, uv: 9, humidity: 45, falling: false }); break;
    case 'storm': set({ temp: 66, rainRate: 0, wind: 12, gust: 22, uv: 1, humidity: 82, falling: true }); break;
    case 'night': set({ phase: 'night', rainRate: 0, uv: 0 }); break;
  }
  k.night = k.phase === 'night';
  k.raining = k.rainRate > 0;
  k.snowing = k.raining && k.temp <= 34;
  k.rain = k.raining && !k.snowing;
  k.puddles = k.rainToday >= 0.05 && k.temp > 32;
  k.windy = k.gust >= 15 || k.wind >= 12;
  k.cold = k.temp < 40;
  k.frost = k.temp <= 32 && !k.raining;
  // Asphalt in full sun runs far hotter than the air; past roughly 125°F it can burn paws.
  k.hotGround = !k.night && (k.temp >= 85 || (k.temp >= 77 && k.uv >= 6));
  k.hot = k.temp >= 85 || k.hotGround;
  k.sunny = !k.night && !k.raining && k.uv >= 6;
  k.fog = k.humidity >= 97 && k.dewpt != null && k.temp - k.dewpt < 2;
  k.cloud = k.raining ? 1 : k.falling ? 0.8 : k.humidity >= 90 ? 0.7 : k.sunny ? 0.15 : 0.4;
  return k;
}
