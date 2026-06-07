// ─────────────────────────────────────────────────────────────────────────
// tests/engine/fuzz.test.js — the C2 fuzz / bug survey.
//
// Drives the shared game reducer through HUNDREDS OF THOUSANDS of random-but-valid action
// sequences, covering every mode's action pattern and every settings toggle mid-play, and after
// EVERY action asserts the engine's invariants (engine/invariants.ts) still hold. This is two
// things at once:
//   1. A BUG HUNT — any impossible score (good>played, …) or desynced history fails the test with
//      a reproducible seed + step.
//   2. The VALIDATION that the production tripwires never false-fire — if any invariant fired during
//      correct play, it would fail HERE first, so a green run proves the tripwires are safe to ship.
//
// Coverage: weekday questions AND all three Deduction puzzle kinds (day/month/year) as nextDate; the
// full action set incl. the timed-mode actions (LOCK_REVEAL / TIMEOUT_MISS / RESET_ROUND) and the
// AoX flags (ANSWER.complete / OVERRIDE.noAdvance); Save Stats, timing, and tracking toggled per
// action (where the C3 score bugs lived); calendar (useJulian) fixed per sequence. OVERRIDE is gated
// on the SAME availability check the hook uses, so we exercise the real 5 paths, not the no-op
// fall-through.
//
// Deterministic seeds ⇒ any failure reproduces exactly. KEPT as a permanent CI regression net (an
// upgrade over the prior throwaway survey — justified now the invariants are a real shared module).
// ─────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  gameReducer,
  initEngine,
  correctIndexOf,
  effectiveSaveStats,
} from '../../src/engine/gameReducer.js'
import { checkGameInvariants } from '../../src/engine/invariants.js'

// Seeded PRNG (mulberry32) — deterministic, so a failing seed reproduces exactly.
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const chance = (rnd, p) => rnd() < p

// ── Valid question generators (so nextDate covers every mode's question kind) ──
function randWeekday(rnd) {
  return {
    y: 1700 + Math.floor(rnd() * 400),
    m: 1 + Math.floor(rnd() * 12),
    d: 1 + Math.floor(rnd() * 28), // 1-28 is valid in every month
    _fmt: 'numeric-ymd',
    _jul: false,
  }
}
function randDayPuzzle(rnd) {
  const b = randWeekday(rnd)
  const options = [b.d]
  while (options.length < 4) {
    const o = 1 + Math.floor(rnd() * 28)
    if (!options.includes(o)) options.push(o)
  }
  return { type: 'day', y: b.y, m: b.m, d: b.d, w: 0, options }
}
function randYearPuzzle(rnd) {
  const b = randWeekday(rnd)
  return { type: 'year', y: b.y, m: b.m, d: b.d, w: 0, options: [b.y, b.y + 1, b.y + 2, b.y + 3] }
}
function randMonthPuzzle(rnd) {
  const b = randWeekday(rnd)
  const other = (b.m % 12) + 1
  return {
    type: 'month',
    y: b.y,
    m: b.m,
    d: b.d,
    w: 0,
    options: ['A', 'B'],
    boxes: [
      { label: 'A', months: [b.m] },
      { label: 'B', months: [other] },
    ],
  }
}
function randDate(rnd) {
  const r = rnd()
  if (r < 0.55) return randWeekday(rnd)
  if (r < 0.7) return randDayPuzzle(rnd)
  if (r < 0.85) return randYearPuzzle(rnd)
  return randMonthPuzzle(rnd)
}
// Number of answer options for the current question (for picking a wrong index).
function optionCount(q) {
  if (q.type === 'month') return q.boxes.length
  if (q.type) return q.options.length
  return 7
}

// Replicate the hook's overrideAvail gate so OVERRIDE is only dispatched when the APP would dispatch
// it — exercising the real 5 paths instead of the no-op fall-through.
function overrideAvail(state, saveStats) {
  const last = state.stack[state.stack.length - 1]
  const retro =
    !state.locked &&
    !state.revealed &&
    !state.countedWrong &&
    !state.canOverrideCorrect &&
    state.pendingWrongOverride == null &&
    !!last &&
    !last.overrideUsed &&
    last.capsule?.snapshot != null
  return (
    effectiveSaveStats(state, saveStats) &&
    (state.countedWrong ||
      state.canOverrideCorrect ||
      (state.pendingWrongOverride != null && !last?.overrideUsed) ||
      retro) &&
    !state.overrideUsedThisQ
  )
}

const ACTION_KINDS = [
  'ANSWER',
  'ANSWER', // weighted: answering is the most common action
  'NEW',
  'REVEAL',
  'SHOW_CODES_OPEN',
  'SHOW_CODES_CLOSE',
  'BACK',
  'FORWARD',
  'OVERRIDE',
  'RESET',
  'REGEN',
  'LOCK_REVEAL',
  'TIMEOUT_MISS',
  'RESET_ROUND',
]

function runSequence(seed, steps, cov) {
  const rnd = mulberry32(seed)
  const useJulian = chance(rnd, 0.3) // calendar setting — fixed per sequence
  let state = initEngine(randDate(rnd))
  const recent = []

  for (let i = 0; i < steps; i++) {
    const saveStats = chance(rnd, 0.8)
    const tracking = chance(rnd, 0.5)
    const timingOff = chance(rnd, 0.5)
    const nextDate = randDate(rnd)
    const kind = ACTION_KINDS[Math.floor(rnd() * ACTION_KINDS.length)]
    const t = () => (chance(rnd, 0.5) ? rnd() * 3 : null) // a random solve time, or null
    let action = null

    switch (kind) {
      case 'ANSWER': {
        const corr = correctIndexOf(state.date, useJulian)
        const idx = chance(rnd, 0.5) ? corr : Math.floor(rnd() * optionCount(state.date))
        action = {
          type: 'ANSWER',
          idx,
          useJulian,
          elapsed: t(),
          tracking,
          saveStats,
          nextDate,
          complete: chance(rnd, 0.2), // AoX completing-solve
        }
        break
      }
      case 'NEW':
        action = { type: 'NEW', nextDate, useJulian, saveStats }
        break
      case 'REVEAL':
        action = { type: 'REVEAL', useJulian, elapsed: t(), saveStats }
        break
      case 'SHOW_CODES_OPEN':
        action = { type: 'SHOW_CODES', open: true, useJulian, elapsed: t(), saveStats }
        break
      case 'SHOW_CODES_CLOSE':
        action = { type: 'SHOW_CODES', open: false, useJulian, elapsed: null, saveStats }
        break
      case 'BACK':
        action = { type: 'BACK' }
        break
      case 'FORWARD':
        action = { type: 'FORWARD', useJulian }
        break
      case 'OVERRIDE':
        if (overrideAvail(state, saveStats)) {
          action = { type: 'OVERRIDE', useJulian, tracking, timingOff, nextDate, noAdvance: chance(rnd, 0.2) }
          cov.override++
        }
        break
      case 'RESET':
        action = { type: 'RESET', timingOff, nextDate }
        break
      case 'REGEN':
        action = { type: 'REGEN_DATE', nextDate }
        break
      case 'LOCK_REVEAL':
        action = { type: 'LOCK_REVEAL', useJulian }
        break
      case 'TIMEOUT_MISS':
        action = { type: 'TIMEOUT_MISS', useJulian, saveStats }
        break
      case 'RESET_ROUND':
        action = { type: 'RESET_ROUND' }
        break
    }

    if (!action) continue
    if (kind === 'BACK' && state.stack.length) cov.back++
    if (state.date.type) cov.deduction++
    const prev = state
    state = gameReducer(state, action)
    if (state.stats.good > 0) cov.good++
    const S = state.stats
    recent.push(
      `${i}:${kind}${saveStats ? '+' : '-'} p${S.played}g${S.good}s${S.streak}b${S.best} bd${state.backDepth} stk${state.stack.length} cw${state.countedWrong ? 1 : 0} coc${state.canOverrideCorrect ? 1 : 0}`,
    )
    if (recent.length > 20) recent.shift()

    const violations = checkGameInvariants(state, useJulian)
    if (violations.length) {
      return {
        ok: false,
        seed,
        step: i,
        violations,
        action,
        prevStats: prev.stats,
        nowStats: state.stats,
        recent,
      }
    }
  }
  return { ok: true }
}

describe('fuzz / bug survey — engine invariants hold across random play (C2)', () => {
  it('survives a large corpus of random action sequences with ZERO invariant violations', () => {
    const SEQUENCES = 3000
    const STEPS = 150
    const cov = { good: 0, override: 0, back: 0, deduction: 0 }

    for (let seed = 1; seed <= SEQUENCES; seed++) {
      const r = runSequence(seed, STEPS, cov)
      if (!r.ok) {
        throw new Error(
          `INVARIANT VIOLATED — seed ${r.seed}, step ${r.step}:\n` +
            `  ${r.violations.join('\n  ')}\n` +
            `  action:   ${JSON.stringify(r.action)}\n` +
            `  stats before: ${JSON.stringify(r.prevStats)}\n` +
            `  stats after:  ${JSON.stringify(r.nowStats)}\n` +
            `  recent actions (oldest→newest):\n    ${r.recent.join('\n    ')}\n` +
            `  reproduce: runSequence(${r.seed}, ${r.step + 1}, {good:0,override:0,back:0,deduction:0})`,
        )
      }
    }

    // Prove the survey wasn't vacuous — it actually exercised credits, the override paths,
    // back-browsing, and Deduction puzzles (not just trivial no-ops) across the 3000 runs.
    expect(cov.good).toBeGreaterThan(0)
    expect(cov.override).toBeGreaterThan(0)
    expect(cov.back).toBeGreaterThan(0)
    expect(cov.deduction).toBeGreaterThan(0)
  })
})
