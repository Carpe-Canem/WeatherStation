// The holiday calendar, for the dogs' holiday outfits. A holiday is on from 7 days before its date through
// the end of the day itself, by local time. New Year's runs Dec 26 through Jan 1, so Christmas keeps Dec 25.
// Where two windows overlap (Easter can land on St. Patrick's week), the holiday whose date comes first wins
// until its day is over.
//
// Ids: valentines, stpatricks, easter, july4, dogday, halloween, thanksgiving, christmas, newyear.

/** Western (Gregorian) Easter Sunday, as [month 0-11, day]. */
export function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return [Math.floor(n / 31) - 1, (n % 31) + 1];
}

/** Thanksgiving (US): the fourth Thursday of November, as [month, day]. */
const thanksgiving = y => [10, 1 + ((4 - new Date(y, 10, 1).getDay() + 7) % 7) + 21];

// Each holiday's date in a given year, as [month 0-11, day].
const DATES = {
  valentines: () => [1, 14],
  stpatricks: () => [2, 17],
  easter,
  july4: () => [6, 4],
  dogday: () => [7, 26],
  halloween: () => [9, 31],
  thanksgiving,
  christmas: () => [11, 25],
  newyear: () => [0, 1],
};
export const HOLIDAYS = Object.keys(DATES);

// A calendar day as one comparable number (no clock times, so daylight saving can't shift a window).
const day = (y, m, d) => Date.UTC(y, m, d) / 864e5;

/** The holiday on at a local date and time, or null. */
export function holidayOn(date = new Date()) {
  const y = date.getFullYear(), today = day(y, date.getMonth(), date.getDate());
  let best = null, bestEnd = Infinity;
  for (const yr of [y, y + 1]) for (const id of HOLIDAYS) {
    const [m, d] = DATES[id](yr), end = day(yr, m, d), start = id === 'newyear' ? day(yr - 1, 11, 26) : end - 7;
    if (today >= start && today <= end && end < bestEnd) { best = id; bestEnd = end; }
  }
  return best;
}
