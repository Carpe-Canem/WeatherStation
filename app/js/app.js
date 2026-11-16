import { makeUnits, UNIT_CHOICES, fixed } from './units.js';
import * as wu from './wu.js';
import * as demo from './demo.js';
import { lineChart, sparkline } from './charts.js';
import { sortable, arrange, isDragging } from './reorder.js';
import { conditions, PREVIEWS } from './conditions.js';
import { initSky, setSky } from './sky.js';
import { initDogs, setDogs } from './dogs.js';
import { CHANGES } from './changelog.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MIN = 6e4, HOUR = 36e5, DAY = 864e5;
const SETTINGS_KEY = 'backyard.settings.v1', CACHE_KEY = 'backyard.cache.v1';

const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v, (key, val) => (key === 'preview' ? undefined : val))); } catch { /* storage unavailable */ }
};

const saved = read(SETTINGS_KEY) || {};
const settings = {
  stationId: '', apiKey: '', demo: true, layout: {}, dogs: true, preview: 'live', loc: null, ...saved,
  units: { temp: 'F', wind: 'mph', pressure: 'inHg', rain: 'in', ...(saved.units || {}) },
};
settings.preview = 'live'; // the weather preview is only for this visit; never saved
// Debug: ?preview=night (or any id in PREVIEWS) starts this visit with that preview.
const askedPreview = new URLSearchParams(location.search).get('preview');
if (PREVIEWS.some(([id]) => id === askedPreview)) settings.preview = askedPreview;

// A share link (?station=ID&key=KEY) connects this device to that station without typing anything.
// It is applied once per link, so choosing demo data later sticks. The parameters stay in the address so
// a bookmark or Home Screen icon made from this page keeps them (index.html leaves out the manifest on
// these visits, so iOS saves this exact address rather than the manifest's start_url).
const link = new URLSearchParams(location.search);
const linked = link.get('station') && link.get('key')
  ? { stationId: link.get('station').trim().toUpperCase(), apiKey: link.get('key').trim() } : null;
if (linked && settings.link !== `${linked.stationId}|${linked.apiKey}`) {
  Object.assign(settings, linked, { demo: false, link: `${linked.stationId}|${linked.apiKey}` });
  write(SETTINGS_KEY, settings);
}
const shareUrl = () => `${location.origin}${location.pathname}?station=${encodeURIComponent(settings.stationId)}&key=${encodeURIComponent(settings.apiKey)}`;

const DATA_KEYS = ['current', 'today', 'hourly', 'daily', 'forecast', 'sky'];
const emptyData = () => ({ current: null, today: [], hourly: [], daily: [], forecast: [], sky: null });
const state = {
  view: 'now', range: 'today', ...emptyData(),
  error: null, loading: false, lastCurrent: 0, lastFull: 0, lastForecast: 0, lastSky: 0,
};

// ---------- appearance and the world behind it ----------

// Day or night follows sunrise and sunset at the station.
let world = null;

/** Works out the weather the sky and the dogs react to, then applies day/night, sky and dogs. */
function updateWorld() {
  const c = state.current;
  if (c?.lat != null && (settings.loc?.lat !== c.lat || settings.loc?.lon !== c.lon)) {
    settings.loc = { lat: c.lat, lon: c.lon };
    write(SETTINGS_KEY, settings);
  }
  const k = conditions(c, pressureDelta(), settings.loc, settings.preview, { sky: state.sky, forecast: state.forecast, remember: !isDemo() });
  world = k;
  document.documentElement.dataset.theme = k.night ? 'dark' : 'light';
  document.documentElement.classList.toggle('frost', k.frost);
  // Keep the browser and status bar in step with the page.
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--page').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', bg));
  setSky(k);
  setDogs(settings.dogs ? k : null);
}

const isDemo = () => settings.demo || !settings.stationId || !settings.apiKey;
const units = () => makeUnits(settings.units);

// ---------- formatting ----------

const timeShort = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function ago(t) {
  const m = Math.round((Date.now() - t) / MIN);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}
const CARDINALS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const cardinal = deg => CARDINALS[Math.round(deg / 22.5) % 16];
const uvBand = uv => (uv < 3 ? 'Low' : uv < 6 ? 'Moderate' : uv < 8 ? 'High' : uv < 11 ? 'Very high' : 'Extreme');

// Line icons drawn in the theme's ink; the sun takes the brass accent.
const CLOUD = '<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 11.2 3.5 3.5 0 0 0 7 18z"/>';
const ICONS = {
  sun: '<g class="sun"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></g>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
  cloud: CLOUD,
  partly: '<g class="sun"><path d="M8 3v1.5M3 8h1.5M4.5 4.5l1 1M11.5 4.5l-1 1"/><path d="M5.3 10.4A3.5 3.5 0 0 1 11 6.5"/></g><path d="M9 20h8a3.5 3.5 0 0 0 .4-6.97 5 5 0 0 0-9.6 1.2A2.9 2.9 0 0 0 9 20z"/>',
  rain: '<path d="M7 14h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 7.2 3.5 3.5 0 0 0 7 14z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
  snow: '<path d="M7 14h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 7.2 3.5 3.5 0 0 0 7 14z"/><path d="M8 18h.01M12 18h.01M16 18h.01M10 21h.01M14 21h.01" stroke-width="2.4"/>',
  storm: '<path d="M7 14h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 7.2 3.5 3.5 0 0 0 7 14z"/><path class="sun" d="M12.5 14l-2 3.5h3l-2 3.5"/>',
  fog: '<path d="M4 9h16M6 13h12M4 17h16"/>',
  wind: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8"/>',
};
function forecastIcon(code) {
  if (code == null) return '';
  let k = 'sun';
  if ([0, 1, 2, 3, 4, 37, 38, 47].includes(code)) k = 'storm';
  else if ([5, 6, 7, 8, 10, 13, 14, 15, 16, 17, 18, 35, 41, 42, 43, 46].includes(code)) k = 'snow';
  else if ([9, 11, 12, 39, 40, 45].includes(code)) k = 'rain';
  else if ([19, 20, 21, 22].includes(code)) k = 'fog';
  else if ([23, 24].includes(code)) k = 'wind';
  else if ([26, 27, 28].includes(code)) k = 'cloud';
  else if ([29, 30].includes(code)) k = 'partly';
  else if ([31, 33].includes(code)) k = 'moon';
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;
}

function errorText(e) {
  switch (e?.kind) {
    case 'auth': return 'Weather Underground rejected the API key.';
    case 'notfound': return 'Station ID not found.';
    case 'rate': return 'Too many requests. Trying again shortly.';
    case 'network': return 'No connection.';
    default: return "Couldn't reach Weather Underground.";
  }
}

// ---------- derived values ----------

// The reading closest to a moment in the past, if there is one within an hour of it.
function valueAt(key, t) {
  let best = null, bestD = HOUR;
  for (const p of [...state.hourly, ...state.today]) {
    const d = Math.abs(p.t - t);
    if (p[key] != null && d < bestD) { bestD = d; best = p[key]; }
  }
  return best;
}

function pressureDelta() {
  const c = state.current;
  const then = c?.pressure == null ? null : valueAt('pressure', c.t - 3 * HOUR);
  return then == null ? null : c.pressure - then;
}

function todayHiLo() {
  let hi = null, lo = null;
  // With under an hour of readings, a high and low would just repeat the current temperature.
  const pts = state.today;
  if (pts.length < 2 || pts[pts.length - 1].t - pts[0].t < HOUR) return { hi, lo };
  for (const p of state.today) {
    const h = p.tempHi ?? p.temp, l = p.tempLo ?? p.temp;
    if (h != null && (!hi || h > hi.v)) hi = { v: h, t: p.t };
    if (l != null && (!lo || l < lo.v)) lo = { v: l, t: p.t };
  }
  return { hi, lo };
}

function insight(c, u) {
  const out = [];
  if (c.rainRate > 0) out.push(`Raining at ${u.fmt('rain', c.rainRate)} per hour.`);
  const dp = pressureDelta();
  if (dp != null && dp <= -0.06) out.push('Pressure is falling fast, so unsettled weather is likely.');
  else if (dp != null && dp >= 0.06) out.push('Pressure is rising fast, so clearing is likely.');
  const y = c.temp == null ? null : valueAt('temp', c.t - DAY);
  if (y != null) {
    const d = Math.round(u.delta('temp', c.temp - y));
    out.push(d === 0 ? 'About the same as this time yesterday.' : `${Math.abs(d)}° ${d > 0 ? 'warmer' : 'cooler'} than this time yesterday.`);
  }
  return out.slice(0, 2).join(' ');
}

// ---------- data ----------

// Weather Underground sometimes answers the live call with every reading blank. When it does,
// show the station's latest 5-minute reading from today instead, with that reading's time.
function fillBlank(cur, today) {
  const p = today?.at(-1);
  if (cur.temp != null || p?.temp == null) return cur;
  return {
    ...cur, t: p.t, temp: p.temp, feels: p.temp, dewpt: p.dewpt, humidity: p.humidity,
    wind: p.wind, gust: p.gust, windDir: p.windDir, pressure: p.pressure,
    rainRate: p.rainRate, rain: p.rain, uv: p.uv, solar: p.solar,
  };
}

let inflight = null;
function refresh(full = true) {
  if (inflight) return inflight;
  inflight = (async () => {
    const demoRun = isDemo(), src = demoRun ? demo : wu;
    const cfg = { stationId: settings.stationId, apiKey: settings.apiKey };
    state.loading = true;
    renderStatus();
    try {
      // The live reading decides success; history calls may fail on their own.
      const soft = p => p.catch(e => { if (e.kind === 'auth') throw e; return null; });
      const [cur, today, hourly, daily] = await Promise.all([
        src.current(cfg),
        ...(full ? [soft(src.today(cfg)), soft(src.hourly(cfg)), soft(src.daily(cfg))] : []),
      ]);
      if (demoRun !== isDemo()) return; // the data source changed while this was running
      if (full && today) state.today = today;
      if (cur) state.current = fillBlank(cur, state.today);
      state.lastCurrent = Date.now();
      if (full) {
        if (hourly) state.hourly = hourly;
        if (daily) state.daily = daily;
        state.lastFull = Date.now();
      }
      const c = state.current;
      if (c?.lat != null && Date.now() - state.lastForecast > 30 * MIN) {
        state.forecast = await src.forecast(cfg, c.lat, c.lon).catch(() => state.forecast);
        state.lastForecast = Date.now();
      }
      // Sky cover and drizzle from the nearest official observation; the station can't see either.
      if (c?.lat != null && src.sky && Date.now() - state.lastSky > 10 * MIN) {
        state.sky = await src.sky(cfg, c.lat, c.lon).catch(() => state.sky);
        state.lastSky = Date.now();
      }
      state.error = null;
      if (!demoRun) write(CACHE_KEY, Object.fromEntries(DATA_KEYS.map(k => [k, state[k]])));
    } catch (e) {
      state.error = e;
    } finally {
      state.loading = false;
      inflight = null;
      render();
    }
  })();
  return inflight;
}

function switchSource() {
  Object.assign(state, emptyData(), { error: null, lastCurrent: 0, lastFull: 0, lastForecast: 0 });
  render();
  refresh(true);
}

// ---------- rendering ----------

function renderStatus() {
  const c = state.current;
  let st = 'idle', text = 'Loading';
  if (isDemo()) { st = 'demo'; text = 'Demo data'; }
  else if (state.error) { st = 'error'; text = errorText(state.error) + (c ? ` Showing data from ${ago(c.t)}.` : ''); }
  else if (!c && state.loading) text = 'Loading';
  else if (!c) { st = 'error'; text = 'Station offline'; }
  else if (Date.now() - c.t > 20 * MIN) { st = 'stale'; text = `Station quiet. Last report ${ago(c.t)}`; }
  else { st = 'live'; text = `Live. Updated ${ago(c.t)}`; }
  $('#status').dataset.state = st;
  $('#statusText').textContent = text;
  $('#stationName').textContent = isDemo() ? 'Backyard' : c?.name || settings.stationId;
  $('#refresh').classList.toggle('spin', state.loading);
}

const tile = (id, label, value, unit, sub, spark) => ({ id, html: `
  <div class="tile" data-id="${id}">
    <div class="label">${label}</div>
    <div class="value">${value}${unit ? `<span class="unit">${unit}</span>` : ''}</div>
    ${sub ? `<div class="sub">${sub}</div>` : ''}
    ${spark || ''}
  </div>` });

const OFFLINE_ICONS = {
  // Signal bars with a slash: the station isn't sending.
  station: '<path d="M4 20v-3M9 20v-7M14 20v-4M19 20V6"/><path d="M3 3l18 18"/>',
  // Wi-Fi arcs with a slash: this phone has no connection.
  network: '<path d="M2 8.8a15 15 0 0 1 4.4-2.7M10 5.2A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 5.2-2.7M17.3 11.4a10 10 0 0 1 1.7 1.5M8.5 16.4a5 5 0 0 1 7 0"/><circle cx="12" cy="20" r="0.6"/><path d="M3 3l18 18"/>',
  // A key: the settings need fixing.
  settings: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>',
};

/** Shown in place of the readings when there are none: says why, and what to do about it. */
function offlineCard(err) {
  const kind = err?.kind;
  const [icon, title, body, action] =
    kind === 'network' ? ['network', "You're offline", 'This phone has no internet connection. Your readings will show once it reconnects.', 'retry']
    : kind === 'auth' || kind === 'notfound' ? ['settings', 'Check your station settings', errorText(err), 'settings']
    : err ? ['station', "Couldn't reach Weather Underground", errorText(err) === "Couldn't reach Weather Underground." ? 'It may be having trouble. Try again in a few minutes.' : errorText(err), 'retry']
    : ['station', 'Your station is offline', 'Weather Underground has no recent readings from it. Check that the station has power and Wi-Fi, and that it is set to upload to Weather Underground.', 'retry'];
  const btn = action === 'settings'
    ? '<button class="btn small" type="button" data-go="settings">Open settings</button>'
    : '<button class="btn small ghost" type="button" data-retry>Try again</button>';
  return `
    <div class="card offline" role="status">
      <svg class="offline-icon" viewBox="0 0 24 24" aria-hidden="true">${OFFLINE_ICONS[icon]}</svg>
      <h2>${esc(title)}</h2>
      <p>${esc(body)}</p>
      ${btn}
    </div>`;
}

function renderNow() {
  const el = $('#view-now'), c = state.current, u = units();
  if (!c) {
    el.innerHTML = state.loading ? '<p class="empty">Loading your station</p>' : offlineCard(state.error);
    return;
  }
  const recent = state.today.length >= 24 || state.today.length >= state.hourly.length ? state.today : state.hourly.slice(-24);
  // Sparklines wait for about an hour of readings; fewer points only show noise.
  const spark = key => (recent.length >= 12 ? sparkline(recent.map(p => p[key])) : '');
  // A station without a UV sensor reports a constant zero, so only show UV once it has registered.
  const hasUv = c.uv > 0 || c.solar > 0 || state.today.some(p => p.uv > 0 || p.solar > 0);
  const { hi, lo } = todayHiLo();

  const tiles = [];
  if (c.humidity != null) {
    tiles.push(tile('humidity', 'Humidity', Math.round(c.humidity), '%', c.dewpt != null ? `Dew point ${u.fmt('temp', c.dewpt)}` : '', spark('humidity')));
  }
  if (c.wind != null) {
    const calm = c.wind < 0.5;
    const arrow = calm || c.windDir == null ? '' :
      `<svg class="compass" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${Math.round(c.windDir + 180)}deg)"><path d="M12 3l5.5 16L12 15.5 6.5 19z"/></svg>`;
    const parts = [];
    if (!calm && c.windDir != null) parts.push(`From ${cardinal(c.windDir)}`);
    if (c.gust != null && c.gust > c.wind) parts.push(`gusts ${u.fmt('wind', c.gust)}`);
    const sub = parts.join(', ');
    tiles.push(tile('wind', 'Wind', calm ? 'Calm' : u.num('wind', c.wind), calm ? '' : u.label('wind') + arrow,
      sub.charAt(0).toUpperCase() + sub.slice(1), spark('wind')));
  }
  if (c.pressure != null) {
    const dp = pressureDelta();
    let sub = '';
    if (dp != null) {
      const shown = u.delta('pressure', dp), d = settings.units.pressure === 'hPa' ? 1 : 2;
      sub = Math.abs(dp) < 0.02 ? 'Steady'
        : `${dp > 0 ? '↗ Rising' : '↘ Falling'}, ${dp > 0 ? '+' : ''}${fixed(shown, d)} in 3 h`;
    }
    tiles.push(tile('pressure', 'Pressure', u.num('pressure', c.pressure), u.label('pressure'), sub, spark('pressure')));
  }
  if (c.rain != null) {
    const days = state.daily.slice(-7);
    const week = days.reduce((a, p) => a + (p.rain || 0), 0);
    const sub = c.rainRate > 0 ? `Falling at ${u.fmt('rain', c.rainRate)} per hour`
      : days.length > 1 ? `${u.fmt('rain', week)} over ${days.length} days` : '';
    tiles.push(tile('rain', 'Rain today', u.num('rain', c.rain), u.label('rain'), sub, spark('rain')));
  }
  const meta = [];
  if (c.feels != null) meta.push(`Feels like ${u.fmt('temp', c.feels)}`);
  if (hi) meta.push(`High ${u.fmt('temp', hi.v)} at ${timeShort(hi.t)}`);
  if (lo) meta.push(`Low ${u.fmt('temp', lo.v)} at ${timeShort(lo.t)}`);
  if (c.uv != null && hasUv) meta.push(`UV ${Math.round(c.uv)}, ${uvBand(c.uv).toLowerCase()}`);
  const note = insight(c, u);

  const fc = state.forecast.length ? `
    <div class="card forecast" aria-label="Forecast">${state.forecast.map(d => `
      <div class="fday" title="${esc(d.phrase)}">
        <div class="dow">${esc(d.dow)}</div>
        <div class="ficon" role="img" aria-label="${esc(d.phrase)}">${forecastIcon(d.icon)}</div>
        <div class="fhl"><span class="fhi">${u.fmt('temp', d.hi ?? (d.dow === 'Today' ? hi?.v : null))}</span> <span class="flo">${u.fmt('temp', d.lo)}</span></div>
        <div class="fpop">${d.pop != null ? `${d.pop}% rain` : ''}</div>
      </div>`).join('')}
    </div>` : '';

  el.innerHTML = `
    <div class="hero">
      <div class="hero-temp">${u.num('temp', c.temp)}<span class="deg">${u.label('temp')}</span></div>
      <div class="hero-meta">${meta.map(s => `<span>${esc(s)}</span>`).join('')}</div>
      ${note ? `<p class="insight">${esc(note)}</p>` : ''}
    </div>
    <div class="tiles">${arrange(tiles, settings.layout.now).map(t => t.html).join('')}</div>
    ${fc}`;
}

const CHARTS = [
  { id: 'temp', title: 'Temperature', kind: 'temp',
    series: r => (r === '30d' ? [['High', 'tempHi', '--s2'], ['Low', 'tempLo', '--s3']] : [['Temperature', 'temp', '--s1'], ['Dew point', 'dewpt', '--s3']]) },
  { id: 'humidity', title: 'Humidity', series: () => [['Humidity', 'humidity', '--s1']] },
  { id: 'wind', title: 'Wind', kind: 'wind', series: () => [['Speed', 'wind', '--s1'], ['Gust', 'gust', '--s2']] },
  { id: 'pressure', title: 'Pressure', kind: 'pressure', series: () => [['Pressure', 'pressure', '--s1']] },
  { id: 'rain', title: 'Rain', kind: 'rain', rain: true, series: () => [['Rain', 'rain', '--s1']] },
];
const RANGES = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days']];
// Smallest y-axis range per chart, in base units (°F, %, mph, inHg, in).
const MIN_SPAN = { temp: 10, humidity: 20, wind: 5, pressure: 0.2, rain: 0.1 };

function renderTrends() {
  const el = $('#view-trends'), u = units(), r = state.range;
  const lineData = r === 'today' ? state.today : r === '7d' ? state.hourly : state.daily;
  const days = r === '7d' ? state.daily.slice(-7) : state.daily;
  const dayFmt = t => new Date(t).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const timeFmt = r === 'today' ? timeShort
    : r === '7d' ? t => new Date(t).toLocaleString([], { weekday: 'short', hour: 'numeric' })
    : dayFmt;

  const specs = CHARTS.map(ch => {
    const bars = ch.rain && r !== 'today';
    const data = bars ? days : lineData;
    const conv = v => (ch.kind ? u.conv(ch.kind, v) : v);
    const show = v => (v == null ? '–' : ch.kind ? u.show(ch.kind, v) : `${Math.round(v)}%`);
    const series = ch.series(r).map(([name, key, color]) => ({ name, color, values: data.map(p => conv(p[key])) }));
    const all = series.flatMap(s => s.values.filter(v => v != null));
    if (!all.length) return null;
    let summary;
    if (ch.rain) {
      const total = bars ? all.reduce((a, v) => a + v, 0) : all[all.length - 1];
      summary = `${show(total)} total`;
    } else if (ch.id === 'wind' && series[1].values.some(v => v != null)) {
      summary = `Gusts to ${show(Math.max(...series[1].values.filter(v => v != null)))}`;
    } else {
      // Summarise the headline series only, except High/Low, which together give the range.
      const main = r === '30d' || series.length === 1 ? all : series[0].values.filter(v => v != null);
      summary = main.length ? `${show(Math.min(...main))} to ${show(Math.max(...main))}` : '';
    }
    const minSpan = ch.kind ? Math.abs(u.delta(ch.kind, MIN_SPAN[ch.id])) : MIN_SPAN[ch.id];
    return { ch, bars, series, summary, show, minSpan, times: data.map(p => p.t), timeFmt: bars ? dayFmt : timeFmt };
  }).filter(Boolean);
  const ordered = arrange(specs, settings.layout.trends, s => s.ch.id);

  // A newly connected station has little history; say so rather than show near-empty charts unexplained.
  const thin = r === 'today' ? state.today.length < 12 : r === '7d' ? state.hourly.length < 24 : state.daily.length < 3;
  const firstT = Math.min(...[state.today[0], state.hourly[0]].filter(Boolean).map(p => p.t));
  const building = thin && Number.isFinite(firstT)
    ? `<p class="note">History is still building. The first reading arrived ${new Date(firstT).toDateString() === new Date().toDateString() ? `today at ${timeShort(firstT)}` : `on ${dayFmt(firstT)}`}, and the charts fill in as more come through.</p>`
    : '';

  const table = r === 'today' || !days.length ? '' : `
    <h2>Daily summary</h2>
    <div class="card table-wrap"><table>
      <thead><tr><th>Day</th><th>High</th><th>Low</th><th>Humidity</th><th>Gust</th><th>Rain</th></tr></thead>
      <tbody>${[...days].reverse().map(p => `<tr>
        <td>${esc(new Date(p.t).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }))}</td>
        <td>${u.fmt('temp', p.tempHi)}</td><td>${u.fmt('temp', p.tempLo)}</td>
        <td>${p.humidity == null ? '–' : `${Math.round(p.humidity)}%`}</td>
        <td>${u.num('wind', p.gust)}</td><td>${u.num('rain', p.rain)}</td></tr>`).join('')}
      </tbody></table>
      <p class="table-note">Gust in ${u.label('wind')}, rain in ${u.label('rain') === 'in' ? 'inches' : u.label('rain')}.</p>
    </div>`;

  el.innerHTML = `
    <div class="seg" role="group" aria-label="Time range">${RANGES.map(([id, label]) =>
      `<button type="button" data-range="${id}" aria-pressed="${id === r}">${label}</button>`).join('')}</div>
    ${building}
    ${specs.length ? '' : `<p class="empty">${state.loading ? 'Loading' : 'No history for this period yet.'}</p>`}
    <div class="charts">${ordered.map(s => `
      <section class="card chart-card" data-id="${s.ch.id}">
        <header><h3>${s.ch.title}${s.ch.kind ? `<span class="unit">${u.label(s.ch.kind)}</span>` : s.ch.id === 'humidity' ? '<span class="unit">%</span>' : ''}</h3><span class="summary">${esc(s.summary)}</span></header>
        <div class="chart" id="chart-${s.ch.id}"></div>
      </section>`).join('')}</div>
    ${table}`;

  for (const s of specs) {
    lineChart($(`#chart-${s.ch.id}`), {
      times: s.times, series: s.series, bars: s.bars, zero: s.ch.rain || s.ch.id === 'wind',
      minSpan: s.minSpan, floor: s.ch.id === 'humidity' ? 0 : undefined, ceil: s.ch.id === 'humidity' ? 100 : undefined,
      show: s.show, timeFmt: s.timeFmt, label: `${s.ch.title}, ${s.summary}`,
    });
  }
}

function renderSettings() {
  const names = { temp: 'Temperature', wind: 'Wind', pressure: 'Pressure', rain: 'Rain' };
  $('#view-settings').innerHTML = `
    <h2>Your station</h2>
    <div class="card form">
      <p class="help">This app reads your station through Weather Underground. First set up your weather station to upload to Weather Underground (usually in the station's own app or console), then enter your station ID and API key. They are stored only on this device.</p>
      <label for="stationId">Station ID</label>
      <input id="stationId" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="KNYNEWYO123" value="${esc(settings.stationId)}">
      <label for="apiKey">API key</label>
      <input id="apiKey" type="password" autocomplete="off" value="${esc(settings.apiKey)}">
      <div class="row">
        <button class="btn" type="button" id="connect">Connect</button>
        <button class="btn ghost" type="button" id="useDemo">Use demo data</button>
      </div>
      <p class="msg" id="connectMsg" role="status">${isDemo() ? 'Showing demo data.' : `Connected to ${esc(settings.stationId)}.`}</p>
    </div>
    ${isDemo() ? '' : `<h2>Share</h2>
    <div class="card form">
      <p class="help">Anyone who opens this link sees your station without entering anything. It contains your API key, so only send it to people you trust.</p>
      <input id="shareLink" readonly value="${esc(shareUrl())}">
      <div class="row"><button class="btn ghost small" type="button" id="copyLink">Copy link</button></div>
    </div>`}
    <h2>Units</h2>
    <div class="card form units">${Object.entries(UNIT_CHOICES).map(([kind, opts]) => `
      <label for="unit-${kind}">${names[kind]}</label>
      <select id="unit-${kind}" data-unit="${kind}">${opts.map(o => `<option${o === settings.units[kind] ? ' selected' : ''}>${o}</option>`).join('')}</select>`).join('')}
    </div>
    <h2>Ziggy, Frank and Minnie</h2>
    <div class="card form">
      <div class="seg" role="group" aria-label="Dogs">${[[true, 'Show the dogs'], [false, 'Hide them']].map(([v, label]) =>
        `<button type="button" data-dogs="${v}" aria-pressed="${settings.dogs === v}">${label}</button>`).join('')}</div>
      <p class="help">They wander the screen and react to your station: rain, gusts, snow, fog, cold, heat, sun, falling pressure and the time of day. Tap one to see what it does, press and hold to pick one up, or double-tap anywhere else to drop a treat.</p>
      <label for="preview">Weather preview</label>
      <select id="preview">${PREVIEWS.map(([id, label]) => `<option value="${id}"${settings.preview === id ? ' selected' : ''}>${label}</option>`).join('')}</select>
      <p class="help" style="margin-top:8px">Shows the sky and the dogs in other weather. Your readings are not changed.</p>
    </div>
    <h2>Layout</h2>
    <div class="card form">
      <p class="help">Rearrange the readings on Now and the charts on Trends. On a phone, press and hold a tile or a chart title, then drag. With a mouse, just drag.</p>
      <div class="row"><button class="btn ghost small" type="button" id="resetLayout">Reset layout</button></div>
    </div>
    <h2>Put it on your iPhone</h2>
    <div class="card form"><p class="help">Open this page in Safari, tap Share, then Add to Home Screen. It opens full screen like any other app.</p></div>
    <details class="version">
      <summary>Version ${CHANGES[0][0]}</summary>
      <ol class="card changelog">${CHANGES.map(([v, date, text]) => `
        <li><b>Version ${v}</b> <span>${new Date(`${date}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span><p>${esc(text)}</p></li>`).join('')}
      </ol>
    </details>`;
}

// Saves a new order. Ids not currently shown (e.g. UV before the sensor reports) keep their old rank.
function saveOrder(view, shown) {
  const old = settings.layout[view] || [];
  settings.layout[view] = [...shown, ...old.filter(id => !shown.includes(id))];
  write(SETTINGS_KEY, settings);
}

let renderPending = false;
function render() {
  // Never swap the cards out from under a drag; catch up once it's dropped.
  if (isDragging()) { renderPending = true; return; }
  renderPending = false;
  renderStatus();
  if (state.view === 'now') renderNow();
  if (state.view === 'trends') renderTrends();
  updateWorld();
}

function go(view) {
  state.view = view;
  for (const v of ['now', 'trends', 'settings']) $(`#view-${v}`).hidden = v !== view;
  document.querySelectorAll('.tabs button').forEach(b =>
    b.dataset.view === view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  if (view === 'settings') renderSettings();
  render();
  window.scrollTo(0, 0);
}

// ---------- events ----------

async function connect() {
  const msg = $('#connectMsg');
  const cfg = { stationId: $('#stationId').value.trim().toUpperCase(), apiKey: $('#apiKey').value.trim() };
  if (!cfg.stationId || !cfg.apiKey) { msg.textContent = 'Enter both the station ID and the API key.'; return; }
  msg.textContent = 'Checking';
  try {
    const cur = await wu.current(cfg);
    Object.assign(settings, cfg, { demo: false });
    write(SETTINGS_KEY, settings);
    renderSettings(); // adds the share link
    $('#connectMsg').textContent = cur
      ? `Connected to ${cur.name}. Last report ${ago(cur.t)}.`
      : 'The key works, but the station has not reported anything yet. Check that your station is set to upload to Weather Underground.';
    switchSource();
  } catch (e) {
    msg.textContent = errorText(e);
  }
}

document.addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.view) go(t.dataset.view);
  else if (t.dataset.go) go(t.dataset.go);
  else if (t.dataset.range) { state.range = t.dataset.range; renderTrends(); }
  else if (t.dataset.dogs) {
    settings.dogs = t.dataset.dogs === 'true';
    write(SETTINGS_KEY, settings);
    updateWorld();
    document.querySelectorAll('[data-dogs]').forEach(b => b.setAttribute('aria-pressed', b === t));
  }
  else if (t.id === 'resetLayout') {
    settings.layout = {};
    write(SETTINGS_KEY, settings);
    t.textContent = 'Layout reset';
  }
  else if (t.id === 'refresh' || 'retry' in t.dataset) refresh(true);
  else if (t.id === 'connect') connect();
  else if (t.id === 'copyLink') {
    const inp = $('#shareLink');
    const done = () => { t.textContent = 'Copied'; };
    navigator.clipboard?.writeText(inp.value).then(done, () => { inp.select(); document.execCommand('copy'); done(); })
      ?? (inp.select(), document.execCommand('copy'), done());
  }
  else if (t.id === 'useDemo') {
    settings.demo = true;
    write(SETTINGS_KEY, settings);
    renderSettings(); // removes the share link
    switchSource();
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'preview') {
    settings.preview = e.target.value;
    updateWorld();
    return;
  }
  const kind = e.target.dataset?.unit;
  if (!kind) return;
  settings.units[kind] = e.target.value;
  write(SETTINGS_KEY, settings);
});

function tick() {
  renderStatus();
  updateWorld(); // sunrise and sunset move the sky even between readings
  if (document.hidden || Date.now() - state.lastCurrent < 2 * MIN) return;
  refresh(Date.now() - state.lastFull > 5 * MIN);
}
setInterval(tick, 30 * 1000);
document.addEventListener('visibilitychange', tick);

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (state.view === 'trends') renderTrends(); }, 150);
});

// ---------- start ----------

if (!isDemo()) Object.assign(state, read(CACHE_KEY) || {});
sortable($('#view-now'), { item: '.tile', onDrop: ids => saveOrder('now', ids) });
sortable($('#view-trends'), { item: '.chart-card', handle: 'header', onDrop: ids => saveOrder('trends', ids) });
addEventListener('pointerup', () => setTimeout(() => { if (renderPending) render(); }));

initSky();
initDogs({ isDragging });
go('now');
refresh(true);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
