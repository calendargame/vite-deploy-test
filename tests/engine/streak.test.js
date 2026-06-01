// Unit tests for the engine's streak math (Stage C, Step 6 — first engine extraction).
// Pure function, so these are fast oracle checks: each case states the expected
// trailing streak and longest run for a given credit-history.
import { describe, it, expect } from 'vitest'
import { computeStreaks } from '../../src/engine/streak.js'

describe('computeStreaks', () => {
  it('returns 0/0 for an empty history', () => {
    expect(computeStreaks([])).toEqual({ curStreak: 0, bestStreak: 0 })
  })

  it('handles single questions', () => {
    expect(computeStreaks([true])).toEqual({ curStreak: 1, bestStreak: 1 })
    expect(computeStreaks([false])).toEqual({ curStreak: 0, bestStreak: 0 })
  })

  it('counts an all-correct run as both current and best', () => {
    expect(computeStreaks([true, true, true])).toEqual({ curStreak: 3, bestStreak: 3 })
  })

  it('resets the current streak at a trailing miss but keeps the best', () => {
    expect(computeStreaks([true, true, false])).toEqual({ curStreak: 0, bestStreak: 2 })
  })

  it('current streak counts only the unbroken tail', () => {
    // trailing run is the last two; best is the same two
    expect(computeStreaks([true, false, true, true])).toEqual({ curStreak: 2, bestStreak: 2 })
  })

  it('finds the best run in the middle of the history', () => {
    // runs: 3 (mid), then 1 (tail) → best 3, current 1
    expect(computeStreaks([true, true, true, false, true])).toEqual({ curStreak: 1, bestStreak: 3 })
  })

  it('a leading run does not count toward the current streak after a break', () => {
    expect(computeStreaks([true, true, false, false])).toEqual({ curStreak: 0, bestStreak: 2 })
  })

  it('mixed history: tail run shorter than an earlier peak', () => {
    expect(computeStreaks([true, false, true, true, true, false, true])).toEqual({
      curStreak: 1,
      bestStreak: 3,
    })
  })
})
