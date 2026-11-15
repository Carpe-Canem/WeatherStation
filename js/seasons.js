// The time of year, for the backyard scene (sky.js): which season it is and how far along, from the local
// date. Everything seasonal in the scene is keyed to a "season day": the day of the year (0 = Jan 1) as it
// would be up north, so the southern hemisphere (station latitude below zero) runs half a year apart.
// The scene blends from one day to the next, so nothing jumps overnight.
//
// Debug: ?season=winter|spring|summer|fall shows the middle of that season; ?seasonat=0..1 picks the point
// in it (0.8 = late in the season), e.g. ?season=fall&seasonat=0.9 for bare trees in late November.

const q = new URLSearchParams(location.search);

// Meteorological seasons, as northern days of the year: spring from Mar 1, summer Jun 1, fall Sep 1, winter Dec 1.
export const START = { spring: 59, summer: 151, fall: 243, winter: 334 };
export const SEASONS = Object.keys(START);
const LEN = { spring: 92, summer: 92, fall: 91, winter: 90 };
const YEAR = 365;

/** The northern-equivalent day of the year (0-364) for a local date at a latitude. */
export function seasonDay(date = new Date(), lat = 0) {
  const y = date.getFullYear();
  let d = Math.round((Date.UTC(y, date.getMonth(), date.getDate()) - Date.UTC(y, 0, 1)) / 864e5);
  if (d >= YEAR) d = YEAR - 1; // Dec 31 in a leap year
  return lat < 0 ? (d + 182) % YEAR : d;
}

/** The season a season day falls in, and how far through it (0 at its start, 1 at its end). */
export function seasonOf(day) {
  for (const s of SEASONS) {
    const into = (day - START[s] + YEAR) % YEAR;
    if (into < LEN[s]) return { season: s, at: into / LEN[s] };
  }
  return { season: 'winter', at: 0 };
}

let cache = null;
/** Now: { day, season, at }, honouring ?season= and ?seasonat=. lat may be null (taken as north). */
export function seasonNow(lat) {
  const forced = q.get('season')?.toLowerCase();
  if (START[forced] != null) {
    const at = q.has('seasonat') ? Math.min(1, Math.max(0, +q.get('seasonat') || 0)) : 0.5;
    return { day: (START[forced] + at * (LEN[forced] - 1)) % YEAR, season: forced, at };
  }
  const now = new Date(), key = `${now.toDateString()}|${lat < 0}`;
  if (cache?.key !== key) {
    const day = seasonDay(now, lat ?? 0);
    cache = { key, v: { day, ...seasonOf(day) } };
  }
  return cache.v;
}

const hexRgb = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
/** Blends two #rrggbb colours; returns #rrggbb. */
export const mix = (a, b, f) => {
  const x = hexRgb(a), y = hexRgb(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * f).toString(16).padStart(2, '0')).join('');
};

/**
 * A value that changes through the year: keys are [day, ...values] in day order, values colours or numbers.
 * Returns day => values, blended between the keys either side (wrapping from December round to January).
 */
export function yearly(keys) {
  return day => {
    day = ((day % YEAR) + YEAR) % YEAR;
    let i = keys.findIndex(k => k[0] > day);
    const a = keys[i < 0 ? keys.length - 1 : (i + keys.length - 1) % keys.length], b = keys[i < 0 ? 0 : i];
    const span = (b[0] - a[0] + YEAR) % YEAR || YEAR, f = ((day - a[0] + YEAR) % YEAR) / span;
    return a.slice(1).map((v, j) => (typeof v === 'string' ? mix(v, b[j + 1], f) : v + (b[j + 1] - v) * f));
  };
}

/** 0 before day a, 1 after day b, smooth in between. */
export const ramp = (day, a, b) => { const x = Math.min(1, Math.max(0, (day - a) / (b - a))); return x * x * (3 - 2 * x); };
