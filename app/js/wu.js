// Weather Underground personal-weather-station API, normalised to the app's data shapes.
const BASE = 'https://api.weather.com';

export class ApiError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind; // auth | notfound | rate | network | http
  }
}

async function get(path, params) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  let res;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    throw new ApiError('network', 'No connection');
  }
  if (res.status === 204) return null; // station known, but nothing reported
  if (res.status === 401 || res.status === 403) throw new ApiError('auth', 'API key rejected');
  if (res.status === 404) throw new ApiError('notfound', 'Station not found');
  if (res.status === 429) throw new ApiError('rate', 'Too many requests');
  if (!res.ok) throw new ApiError('http', `Weather Underground returned ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const base = ({ stationId, apiKey }) => ({
  stationId, apiKey, format: 'json', units: 'e', numericPrecision: 'decimal',
});

const mid = (a, b) => (a == null || b == null ? a ?? b ?? null : (a + b) / 2);

function toPoint(o, daily) {
  const m = o.imperial || {};
  return {
    t: daily ? new Date(`${o.obsTimeLocal.slice(0, 10)}T12:00:00`).getTime() : o.epoch * 1000,
    temp: m.tempAvg ?? null,
    tempHi: m.tempHigh ?? null,
    tempLo: m.tempLow ?? null,
    dewpt: m.dewptAvg ?? null,
    humidity: o.humidityAvg ?? null,
    wind: m.windspeedAvg ?? null,
    gust: m.windgustHigh ?? null,
    windDir: o.winddirAvg ?? null,
    pressure: mid(m.pressureMax, m.pressureMin),
    rain: m.precipTotal ?? null,
    rainRate: m.precipRate ?? null,
    uv: o.uvHigh ?? null,
    solar: o.solarRadiationHigh ?? null,
  };
}

const points = (j, daily) =>
  (j?.observations || []).map(o => toPoint(o, daily)).sort((a, b) => a.t - b.t);

export async function current(cfg) {
  const j = await get('/v2/pws/observations/current', base(cfg));
  const o = j?.observations?.[0];
  if (!o) return null;
  const m = o.imperial || {};
  const temp = m.temp ?? null;
  const feels = temp == null ? null
    : temp >= 70 ? m.heatIndex ?? temp
    : temp <= 50 ? m.windChill ?? temp
    : temp;
  return {
    t: o.epoch * 1000,
    name: o.neighborhood || o.stationID,
    lat: o.lat ?? null,
    lon: o.lon ?? null,
    temp,
    feels,
    dewpt: m.dewpt ?? null,
    humidity: o.humidity ?? null,
    wind: m.windSpeed ?? null,
    gust: m.windGust ?? null,
    windDir: o.winddir ?? null,
    pressure: m.pressure ?? null,
    rainRate: m.precipRate ?? null,
    rain: m.precipTotal ?? null,
    uv: o.uv ?? null,
    solar: o.solarRadiation ?? null,
  };
}

// Every reading so far today (roughly 5-minute spacing).
export const today = async cfg => points(await get('/v2/pws/observations/all/1day', base(cfg)));

// Hourly readings for the last 7 days.
export const hourly = async cfg => points(await get('/v2/pws/observations/hourly/7day', base(cfg)));

const ymd = d =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

// One summary per day. Falls back to the 7-day summary if the longer history call fails.
export async function daily(cfg, days = 30) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  try {
    const j = await get('/v2/pws/history/daily', { ...base(cfg), startDate: ymd(start), endDate: ymd(end) });
    const pts = points(j, true);
    if (pts.length) return pts;
  } catch (e) {
    if (e.kind === 'auth' || e.kind === 'network') throw e;
  }
  return points(await get('/v2/pws/dailysummary/7day', base(cfg)), true);
}

export async function forecast({ apiKey }, lat, lon) {
  const j = await get('/v3/wx/forecast/daily/5day', {
    geocode: `${lat.toFixed(2)},${lon.toFixed(2)}`,
    format: 'json', units: 'e', language: 'en-US', apiKey,
  });
  if (!j?.dayOfWeek) return [];
  const dp = j.daypart?.[0] || {};
  return j.dayOfWeek.slice(0, 5).map((dow, i) => {
    // Each day has a day part and a night part; the day part is empty once it has passed.
    const k = dp.iconCode?.[2 * i] != null ? 2 * i : 2 * i + 1;
    return {
      dow: i === 0 ? 'Today' : dow.slice(0, 3),
      hi: j.temperatureMax?.[i] ?? null,
      lo: j.temperatureMin?.[i] ?? null,
      pop: dp.precipChance?.[k] ?? null,
      icon: dp.iconCode?.[k] ?? null,
      phrase: dp.wxPhraseShort?.[k] ?? '',
      cloud: dp.cloudCover?.[k] ?? null,
    };
  });
}

// The latest official observation near the station (usually the nearest airport, updated hourly):
// sky cover and weather such as drizzle, which a home station has no sensor for.
export async function sky({ apiKey }, lat, lon) {
  const j = await get('/v3/wx/observations/current', {
    geocode: `${lat.toFixed(2)},${lon.toFixed(2)}`,
    format: 'json', units: 'e', language: 'en-US', apiKey,
  });
  if (!j || j.iconCode == null) return null;
  return { t: (j.validTimeUtc ?? 0) * 1000, icon: j.iconCode, phrase: j.wxPhraseLong || '', cover: j.cloudCoverPhrase || '' };
}
