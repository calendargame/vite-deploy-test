// ─────────────────────────────────────────────────────────────────────────
// calendar.js — pure calendar / day-of-week math
//
// The self-contained core of the date engine: leap-year rules, days-in-month,
// Julian Day Numbers, weekday computation, and the 1582 Julian↔Gregorian
// boundary helpers. These functions reference only each other and plain
// arithmetic — no app state, no React, no formatting (display helpers like
// fmt/fmtPartial stay in the app; they depend on the MONTH names).
//
// Conventions:
//   • toAstro maps historical years to astronomical ones before any modular
//     math: 1 BC → 0, 2 BC → -1, … so weekday/leap math stays continuous.
//   • Weekday results are 0=Sunday … 6=Saturday (index into the app's DAY array).
//   • Gregorian reform: dates ≤ Oct 4, 1582 are Julian; ≥ Oct 15, 1582 are
//     Gregorian; Oct 5–14, 1582 never existed (gap days).
//
// Extracted verbatim from main.jsx in Stage C, Step 1. Ordered dependency-first
// so the module loads cleanly under strict block scoping (no use-before-declare).
// ─────────────────────────────────────────────────────────────────────────
export const toAstro = (y) => (y > 0 ? y : 1 - Math.abs(y))
export const isLeap = (y) => {
  y = toAstro(y)
  return y % 400 === 0 || (y % 4 === 0 && y % 100 !== 0)
}
export const isLeapJulian = (y) => {
  y = toAstro(y)
  return y % 4 === 0
}
// dim — days-in-month. Optional julian param switches leap-year rule:
// off (default) uses Gregorian leap rule (isLeap); on uses Julian (every y%4===0).
// All non-Julian callers can omit the param and behavior is unchanged.
export const dim = (y, m, julian = false) => {
  const leap = julian ? isLeapJulian(y) : isLeap(y)
  return m === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31
}
export function jdnGregorian(y, m, d) {
  const a = Math.floor((14 - m) / 12),
    y2 = y + 4800 - a,
    m2 = m - 3 + 12 * a
  return (
    d +
    Math.floor((153 * m2 + 2) / 5) +
    365 * y2 +
    Math.floor(y2 / 4) -
    Math.floor(y2 / 100) +
    Math.floor(y2 / 400) -
    32045
  )
}
export const wday = (y, m, d) => (((jdnGregorian(toAstro(y), m, d) + 1) % 7) + 7) % 7
export function jdnJulian(y, m, d) {
  const a = Math.floor((14 - m) / 12),
    y2 = y + 4800 - a,
    m2 = m - 3 + 12 * a
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - 32083
}
export const wdayJulian = (y, m, d) => (((jdnJulian(toAstro(y), m, d) + 1) % 7) + 7) % 7
export const isJulianDate = (y, m, d) =>
  y < 1582 || (y === 1582 && (m < 10 || (m === 10 && d <= 4)))
export const isGapDate = (y, m, d) => y === 1582 && m === 10 && d >= 5 && d <= 14
// Returns true if [lo,hi] contains at least one leap year, evaluated under the active calendar
// (Julian rule for years <1582 when useJulian is on; Gregorian rule otherwise). Used to lock the
// Leap Year Chance buttons when no leap year is reachable — without this, setting 50/75/100% would
// be silently ignored per date with no visible signal that the setting can't take effect.
export function rangeHasLeapYear(lo, hi, useJulian) {
  lo = Math.max(1, lo)
  hi = Math.min(10000, hi)
  if (lo > hi) return false
  // Check every multiple of 4 in [lo,hi]. Non-multiples can't be leap years under either rule.
  const start = lo + ((4 - (lo % 4)) % 4)
  for (let y = start; y <= hi; y += 4) {
    if (y === 0) continue
    const inJulianRange = useJulian && y < 1582
    if (inJulianRange ? isLeapJulian(y) : isLeap(y)) return true
  }
  return false
}
