// Small dependency-free SVG charts: a line/bar chart with a hover layer, and a sparkline.
import { fixed } from './units.js';

const MIN = 6e4, HOUR = 36e5, DAY = 864e5;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function niceTicks(lo, hi, n) {
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.floor(lo / step) * step; v < hi + step - step * 1e-6; v += step) out.push(+v.toFixed(10));
  return out;
}

// Tick positions for a time axis, chosen by how much time it spans.
function timeTicks(t0, t1) {
  const span = t1 - t0, out = [], d = new Date(t0);
  if (span <= 0) return out; // a single reading: the tooltip carries its time
  if (span <= 3 * HOUR) {
    // A station that has only just started reporting: label by the minute.
    const stepM = span <= 40 * MIN ? 10 : span <= 90 * MIN ? 15 : 30;
    d.setMinutes(Math.ceil(d.getMinutes() / stepM) * stepM, 0, 0);
    for (; d.getTime() <= t1; d.setMinutes(d.getMinutes() + stepM)) {
      out.push([d.getTime(), d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })]);
    }
    return out;
  }
  d.setHours(0, 0, 0, 0);
  if (span <= 36 * HOUR) {
    const stepH = span <= 3 * HOUR ? 1 : span <= 9 * HOUR ? 2 : span <= 18 * HOUR ? 3 : 6;
    for (; d.getTime() <= t1; d.setHours(d.getHours() + stepH)) {
      if (d.getTime() >= t0) out.push([d.getTime(), d.toLocaleTimeString([], { hour: 'numeric' })]);
    }
  } else {
    const stepD = span <= 9 * DAY ? 1 : 7;
    const opts = stepD === 1 ? { weekday: 'short' } : { month: 'short', day: 'numeric' };
    for (; d.getTime() <= t1; d.setDate(d.getDate() + stepD)) {
      if (d.getTime() >= t0) out.push([d.getTime(), d.toLocaleDateString([], opts)]);
    }
  }
  return out;
}

/**
 * @param el      container (position: relative)
 * @param times   shared x values (ms)
 * @param series  [{ name, color, values }] with values in display units, null for gaps
 * @param bars    draw columns on a band scale instead of lines
 * @param zero    start the y axis at zero
 * @param minSpan smallest y range to show, so tiny wobbles are not blown up to full height
 * @param floor   lowest / ceil highest value the y axis may reach (e.g. 0 and 100 for humidity)
 * @param show    formats a value for the tooltip
 * @param timeFmt formats a time for the tooltip
 */
export function lineChart(el, { times, series, bars = false, zero = false, minSpan = 0, floor, ceil, show, timeFmt, label, height = 170 }) {
  el.textContent = '';
  const all = series.flatMap(s => s.values.filter(v => v != null));
  if (!all.length) {
    el.innerHTML = '<p class="empty">No data for this period yet.</p>';
    return;
  }
  const W = Math.max(260, Math.round(el.clientWidth || 340)), H = height;
  const m = { l: 42, r: 10, t: 8, b: 22 }, pw = W - m.l - m.r, ph = H - m.t - m.b;

  let lo = Math.min(...all), hi = Math.max(...all);
  if (bars || zero) {
    lo = 0;
    hi = Math.max(hi, minSpan || 0.1);
  } else if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
    if (ceil != null && hi > ceil) { lo -= hi - ceil; hi = ceil; }
    if (floor != null && lo < floor) { hi += floor - lo; lo = floor; }
  }
  const ticks = niceTicks(lo, hi, 3);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const digits = Math.max(0, -Math.floor(Math.log10(ticks[1] - ticks[0]) + 1e-9));
  const Y = v => m.t + ph - ((v - y0) / (y1 - y0)) * ph;

  const n = times.length, t0 = times[0], t1 = times[n - 1], band = pw / n;
  const xs = times.map((t, i) => (bars ? m.l + band * (i + 0.5) : t1 === t0 ? m.l + pw / 2 : m.l + ((t - t0) / (t1 - t0)) * pw));

  let g = '';
  // Gridlines and y labels; the bottom line is the baseline.
  ticks.forEach((v, i) => {
    const y = Y(v).toFixed(1);
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" stroke="var(${i ? '--grid' : '--axis'})"/>`;
    g += `<text class="tick" x="${m.l - 6}" y="${y}" dy=".32em" text-anchor="end">${fixed(v, digits)}</text>`;
  });

  // X labels.
  const xLabels = bars
    ? times.map((t, i) => {
        const d = new Date(t);
        if (n <= 8) return [xs[i], d.toLocaleDateString([], { weekday: 'short' })];
        return (n - 1 - i) % 7 === 0 ? [xs[i], d.toLocaleDateString([], { month: 'short', day: 'numeric' })] : null;
      }).filter(Boolean)
    : timeTicks(t0, t1).map(([t, text]) => [m.l + ((t - t0) / (t1 - t0 || 1)) * pw, text]);
  for (const [x, text] of xLabels) {
    const anchor = x < m.l + 16 ? 'start' : x > W - m.r - 16 ? 'end' : 'middle';
    g += `<text class="tick" x="${x.toFixed(1)}" y="${H - 6}" text-anchor="${anchor}">${esc(text)}</text>`;
  }

  if (bars) {
    const bw = Math.max(1, Math.min(24, band - 2)), base = Y(0);
    g += `<rect class="cross" x="0" y="${m.t}" width="${band.toFixed(1)}" height="${ph}" fill="var(--grid)" opacity=".6" visibility="hidden"/>`;
    const s = series[0];
    s.values.forEach((v, i) => {
      if (v == null || v <= 0) return;
      const top = Y(v), r = Math.min(4, bw / 2, base - top), a = xs[i] - bw / 2, b = xs[i] + bw / 2;
      g += `<path d="M${a.toFixed(1)} ${base}V${(top + r).toFixed(1)}Q${a.toFixed(1)} ${top.toFixed(1)} ${(a + r).toFixed(1)} ${top.toFixed(1)}H${(b - r).toFixed(1)}Q${b.toFixed(1)} ${top.toFixed(1)} ${b.toFixed(1)} ${(top + r).toFixed(1)}V${base}Z" fill="var(${s.color})"/>`;
    });
  } else {
    for (const s of series) {
      // Split into runs so gaps in the data stay gaps.
      const runs = [];
      let run = [];
      s.values.forEach((v, i) => {
        if (v == null) { if (run.length) runs.push(run); run = []; }
        else run.push(`${xs[i].toFixed(1)} ${Y(v).toFixed(1)}`);
      });
      if (run.length) runs.push(run);
      for (const r of runs) {
        if (r.length === 1) {
          // A lone reading has no line to draw, so mark it with a dot.
          const [cx, cy] = r[0].split(' ');
          g += `<circle cx="${cx}" cy="${cy}" r="4" fill="var(${s.color})" stroke="var(--surface)" stroke-width="2"/>`;
          continue;
        }
        if (series.length === 1) {
          const first = r[0].split(' ')[0], last = r[r.length - 1].split(' ')[0], by = Y(y0).toFixed(1);
          g += `<path d="M${r.join('L')}L${last} ${by}L${first} ${by}Z" fill="var(${s.color})" opacity=".1"/>`;
        }
        g += `<path d="M${r.join('L')}" fill="none" stroke="var(${s.color})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
    }
    g += `<g class="hover" visibility="hidden"><line class="cross" y1="${m.t}" y2="${m.t + ph}" stroke="var(--axis)"/>`;
    for (const s of series) g += `<circle r="4.5" fill="var(${s.color})" stroke="var(--surface)" stroke-width="2"/>`;
    g += '</g>';
  }

  const legend = series.length > 1
    ? `<div class="legend">${series.map(s => `<span><i class="key" style="background:var(${s.color})"></i>${esc(s.name)}</span>`).join('')}</div>`
    : '';
  el.innerHTML = `${legend}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label || '')}">${g}</svg><div class="tip" hidden></div>`;

  // Hover layer: nearest reading, crosshair, and a tooltip beside it.
  const svg = el.querySelector('svg'), tip = el.querySelector('.tip');
  const cross = svg.querySelector('.cross'), hover = svg.querySelector('.hover');
  const dots = hover ? [...hover.querySelectorAll('circle')] : [];
  const valid = times.map((_, i) => series.some(s => s.values[i] != null));

  function showAt(clientX) {
    const r = svg.getBoundingClientRect(), px = (clientX - r.left) * (W / r.width);
    let best = -1, bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(xs[i] - px);
      if (valid[i] && d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) return;
    const x = xs[best];
    if (bars) {
      cross.setAttribute('x', (x - band / 2).toFixed(1));
      cross.setAttribute('visibility', 'visible');
    } else {
      hover.setAttribute('visibility', 'visible');
      cross.setAttribute('x1', x.toFixed(1));
      cross.setAttribute('x2', x.toFixed(1));
      dots.forEach((dot, k) => {
        const v = series[k].values[best];
        dot.setAttribute('visibility', v == null ? 'hidden' : 'inherit');
        if (v != null) { dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', Y(v).toFixed(1)); }
      });
    }
    tip.innerHTML = `<div class="when">${esc(timeFmt(times[best]))}</div>` + series.map(s =>
      `<div class="row"><i class="key" style="background:var(${s.color})"></i>${esc(s.name)}<b>${esc(show(s.values[best]))}</b></div>`).join('');
    tip.hidden = false;
    const xpx = x * (r.width / W);
    tip.style.top = `${r.top - el.getBoundingClientRect().top + 4}px`;
    if (xpx > r.width / 2) { tip.style.left = 'auto'; tip.style.right = `${r.width - xpx + 10}px`; }
    else { tip.style.right = 'auto'; tip.style.left = `${xpx + 10}px`; }
  }
  function hide() {
    tip.hidden = true;
    (bars ? cross : hover).setAttribute('visibility', 'hidden');
  }
  svg.addEventListener('pointerdown', e => showAt(e.clientX));
  svg.addEventListener('pointermove', e => showAt(e.clientX));
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('pointercancel', hide);
}

export function sparkline(values) {
  const v = values.filter(x => x != null);
  if (v.length < 2) return '';
  const lo = Math.min(...v);
  let hi = Math.max(...v);
  if (hi - lo < 1e-9) hi = lo + 1; // a flat series sits on the floor
  const w = 100, h = 28, pad = 2;
  const pts = v.map((x, i) =>
    `${((i / (v.length - 1)) * w).toFixed(1)},${(pad + (h - 2 * pad) * (1 - (x - lo) / (hi - lo))).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--s1)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}
