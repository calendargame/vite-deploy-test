// Regression tests for the score-integrity bugs the C2 fuzz survey found + fixed (2026-06-06).
// Each is a focused, app-reachable sequence that produced an IMPOSSIBLE score (streak/best > good)
// before the fix — and slipped past the earlier good≤played checks. The fuzz (tests/engine/fuzz) is
// the broad net; these pin the exact scenarios so a future regression names itself.
//
// Root cause (all in one family): a history entry's `hasCredit` ("earned a point") was inferred from
// the answer grid, but REVEAL / Show Codes / timeout / a reversed-to-wrong Override all leave a clean
// 'correct' on the grid WITHOUT crediting good. A later Override that recomputes the streak from
// history then counted those false credits. Fixed in gameReducer.advance (hasCredit gated on
// !revealed && !countedWrong) + Path 2's best/btns revert + TIMEOUT_MISS marking revealed.
import { describe, it, expect } from 'vitest'
import { gameReducer, initEngine } from '../../src/engine/gameReducer.js'
import { wday } from '../../src/lib/calendar.js'

const D1 = { y: 2024, m: 1, d: 1, _fmt: 'numeric-ymd', _jul: false }
const D2 = { y: 2024, m: 2, d: 2, _fmt: 'numeric-ymd', _jul: false }
const D3 = { y: 2024, m: 3, d: 3, _fmt: 'numeric-ymd', _jul: false }
const C = wday(2024, 1, 1) // correct weekday index for D1
const ctx = { useJulian: false, saveStats: true }
const reveal = (s) => gameReducer(s, { type: 'REVEAL', ...ctx, elapsed: null })
const neu = (s, nextDate) => gameReducer(s, { type: 'NEW', ...ctx, nextDate })
const back = (s) => gameReducer(s, { type: 'BACK' })
const override = (s, nextDate, extra = {}) =>
  gameReducer(s, { type: 'OVERRIDE', ...ctx, tracking: false, timingOff: true, nextDate, ...extra })

describe('score-integrity regressions (C2 fuzz fixes, 2026-06-06)', () => {
  it('a Reveal-miss is NOT recorded in history as a credit', () => {
    // Reveal (give up) then New: good stayed 0, so the pushed entry must NOT be a credit.
    const s = neu(reveal(initEngine(D1)), D2)
    expect(s.stats.good).toBe(0)
    expect(s.stack).toHaveLength(1)
    expect(s.stack[0].hasCredit).toBe(false) // was wrongly true → inflated a later streak recompute
  })

  it('two Reveal-misses + a back-browse Override never inflate streak/best past good', () => {
    let s = initEngine(D1)
    s = neu(reveal(s), D2) // Q1: reveal-miss, pushed
    s = neu(reveal(s), D3) // Q2: reveal-miss, pushed
    s = back(s) // browse Q2
    s = override(s, D3) // credit Q2
    // Q2 is now the only credit; Q1 stays a miss. good=1, streak=1, best=1 — NOT the buggy 2/2.
    expect(s.stats).toMatchObject({ played: 2, good: 1, streak: 1, best: 1 })
    expect(s.stats.streak).toBeLessThanOrEqual(s.stats.good)
    expect(s.stats.best).toBeLessThanOrEqual(s.stats.good)
  })

  it('reversing a completing (AoX) solve reverts best too, not just good/streak', () => {
    // Answer correct as a completing solve (stays on screen, reversible), then Override to flip it
    // to wrong. good/streak/best must ALL revert to 0 — best must not stay stranded at 1.
    let s = initEngine(D1)
    s = gameReducer(s, { type: 'ANSWER', idx: C, ...ctx, elapsed: null, tracking: false, complete: true })
    expect(s.stats).toMatchObject({ good: 1, streak: 1, best: 1 })
    s = override(s, D2, { noAdvance: true })
    expect(s.stats.good).toBe(0)
    expect(s.stats.best).toBe(0)
    expect(s.stats.best).toBeLessThanOrEqual(s.stats.good)
  })
})
