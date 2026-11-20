// Hourly forecast from the US National Weather Service (api.weather.gov): free, no key, US only.
// Weather Underground's own hourly forecast needs a paid licence, so the app's hourly row comes from here.
// Hours come back as { t, temp (°F), pop (%), icon (a forecast icon name in app.js), phrase }.

const BASE = 'https://api.weather.gov';
const points = new Map(); // "lat,lon" -> the hourly forecast URL for that spot's forecast grid square

async function getJson(url) {
  // Give up after 8 s: weather.gov can hang during outages, and the refresh waits on this.
  const res = await fetch(url, { headers: { Accept: 'application/geo+json' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`weather.gov returned ${res.status}`); // 404 outside the US
  return res.json();
}

// The weather.gov icon URL names the sky first, e.g. .../icons/land/night/rain,40/tsra,60?size=small.
function iconFor(url, day) {
  const m = /\/icons\/land\/(?:day|night)\/([a-z_]+)/.exec(url || '');
  const k = m?.[1] || '';
  if (/^(tsra|tornado|hurricane|tropical_storm)/.test(k)) return 'storm';
  if (/snow|sleet|fzra|blizzard/.test(k)) return 'snow';
  if (/^rain/.test(k)) return 'rain';
  if (/^(fog|haze|smoke|dust)/.test(k)) return 'fog';
  if (/^wind_/.test(k)) return 'wind';
  if (k === 'bkn' || k === 'ovc') return 'cloud';
  if (k === 'sct') return day ? 'partly' : 'moon'; // the partly-cloudy icon has a sun in it
  return day ? 'sun' : 'moon';
}

export async function hours(lat, lon, n = 24) {
  // weather.gov wants no more than four decimals.
  const at = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (!points.has(at)) points.set(at, (await getJson(`${BASE}/points/${at}`)).properties.forecastHourly);
  const j = await getJson(points.get(at));
  const now = Date.now();
  return (j.properties?.periods || [])
    .filter(p => Date.parse(p.endTime) > now)
    .slice(0, n)
    .map(p => ({
      t: Date.parse(p.startTime),
      temp: p.temperatureUnit === 'C' ? p.temperature * 9 / 5 + 32 : p.temperature,
      pop: p.probabilityOfPrecipitation?.value ?? null,
      icon: iconFor(p.icon, p.isDaytime),
      phrase: p.shortForecast || '',
    }));
}
