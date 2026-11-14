// All data is held in US units (°F, mph, inHg, in) and converted for display.
const DEFS = {
  temp: {
    F: { label: '°F', f: v => v, d: 0, k: 1 },
    C: { label: '°C', f: v => (v - 32) / 1.8, d: 0, k: 1 / 1.8 },
  },
  wind: {
    mph: { label: 'mph', f: v => v, d: 0 },
    'km/h': { label: 'km/h', f: v => v * 1.609344, d: 0 },
    'm/s': { label: 'm/s', f: v => v * 0.44704, d: 1 },
    kn: { label: 'kn', f: v => v * 0.868976, d: 0 },
  },
  pressure: {
    inHg: { label: 'inHg', f: v => v, d: 2 },
    hPa: { label: 'hPa', f: v => v * 33.8639, d: 0 },
  },
  rain: {
    in: { label: 'in', f: v => v, d: 2 },
    mm: { label: 'mm', f: v => v * 25.4, d: 1 },
  },
};

export const UNIT_CHOICES = Object.fromEntries(
  Object.entries(DEFS).map(([kind, opts]) => [kind, Object.keys(opts)]),
);

// toFixed without "-0", and with a real minus sign.
export function fixed(x, d) {
  const s = x.toFixed(d);
  return (+s === 0 ? (0).toFixed(d) : s).replace('-', '−');
}

export function makeUnits(sel) {
  const def = kind => DEFS[kind][sel[kind]] || Object.values(DEFS[kind])[0];
  const conv = (kind, v) => (v == null ? null : def(kind).f(v));
  // show(): format a value that is already in display units.
  const show = (kind, cv, d) => {
    if (cv == null) return '–';
    const n = fixed(cv, d ?? def(kind).d);
    return kind === 'temp' ? `${n}°` : `${n} ${def(kind).label}`;
  };
  return {
    conv,
    show,
    fmt: (kind, v, d) => show(kind, conv(kind, v), d),
    num: (kind, v, d) => (v == null ? '–' : fixed(def(kind).f(v), d ?? def(kind).d)),
    label: kind => def(kind).label,
    // Convert a difference rather than an absolute value (matters for temperature).
    delta: (kind, dv) => (kind === 'temp' ? dv * def('temp').k : def(kind).f(dv)),
  };
}
