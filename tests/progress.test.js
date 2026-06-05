import { describe, it, expect, beforeEach } from 'vitest'
import { useProgress, makeProgressDefaults } from '../src/store/progress.js'

// progress.test.js — the saved-progress store (Stage D1). Mirrors settings.test.js.
// Locks the contract: (1) empty defaults (blank stats for all five silos, empty
// bests, empty history); (2) setModeStats updates one silo without disturbing the
// others and supports a functional updater; (3) the best/history setters accept
// direct values AND React-style functional updaters; (4) resetProgress restores
// FRESH defaults (no aliasing). Persistence (localStorage) is verified in-browser,
// like the settings store, since jsdom/node storage timing differs from the runtime.

const blank = { played: 0, good: 0, streak: 0, best: 0, times: [] }

describe('progress store', () => {
  beforeEach(() => {
    useProgress.getState().resetProgress()
  })

  it('starts empty: blank stats for all five silos, no bests, no history', () => {
    const s = useProgress.getState()
    for (const k of ['classic', 'flash', 'dedDay', 'dedMonth', 'dedYear']) {
      expect(s.stats[k]).toEqual(blank)
    }
    expect(s.blitzBest).toEqual({})
    expect(s.suddenBest).toEqual({})
    expect(s.aoxBest).toEqual({})
    expect(s.lookupHistory).toEqual([])
  })

  it('setModeStats updates one silo and leaves the others blank', () => {
    useProgress.getState().setModeStats('classic', { played: 5, good: 4, streak: 2, best: 3, times: [1.1, 2.2] })
    const s = useProgress.getState()
    expect(s.stats.classic).toEqual({ played: 5, good: 4, streak: 2, best: 3, times: [1.1, 2.2] })
    expect(s.stats.flash).toEqual(blank)
    expect(s.stats.dedDay).toEqual(blank)
  })

  it('setModeStats accepts a functional updater', () => {
    useProgress.getState().setModeStats('flash', { played: 1, good: 1, streak: 1, best: 1, times: [] })
    useProgress.getState().setModeStats('flash', (prev) => ({ ...prev, played: prev.played + 1, good: prev.good + 1 }))
    expect(useProgress.getState().stats.flash).toEqual({ played: 2, good: 2, streak: 1, best: 1, times: [] })
  })

  it('best setters accept direct values and functional updaters', () => {
    useProgress.getState().setBlitzBest({ k1: { score: 7, streak: 5, scoreRoundId: 1, streakRoundId: 1 } })
    expect(useProgress.getState().blitzBest.k1.score).toBe(7)
    useProgress.getState().setSuddenBest((p) => ({ ...p, k2: { score: 3, roundId: 2 } }))
    expect(useProgress.getState().suddenBest.k2.score).toBe(3)
    useProgress.getState().setAoxBest((p) => ({ ...p, k3: { avg: 1.5, avgMed: 1.4, avgRoundId: 1, med: 1.4, medAvg: 1.5, medRoundId: 1 } }))
    expect(useProgress.getState().aoxBest.k3.avg).toBe(1.5)
  })

  it('setLookupHistory accepts direct + functional updaters', () => {
    const e = { id: 'a', label: 'x', weekday: 'Thursday', result: 'r', y: 1776, m: 7, d: 4 }
    useProgress.getState().setLookupHistory([e])
    expect(useProgress.getState().lookupHistory).toHaveLength(1)
    useProgress.getState().setLookupHistory((prev) => [{ ...e, id: 'b' }, ...prev])
    expect(useProgress.getState().lookupHistory).toHaveLength(2)
    expect(useProgress.getState().lookupHistory[0].id).toBe('b')
  })

  it('resetProgress restores fresh defaults, even after changes (no aliasing)', () => {
    const g = useProgress.getState
    g().setModeStats('classic', { played: 9, good: 9, streak: 9, best: 9, times: [9] })
    g().setBlitzBest({ k: { score: 1, streak: 1, scoreRoundId: 1, streakRoundId: 1 } })
    g().setLookupHistory([{ id: 'a', label: 'x', weekday: 'w', result: 'r', y: 1, m: 1, d: 1 }])
    g().resetProgress()
    const s = g()
    expect(s.stats.classic).toEqual(blank)
    expect(s.blitzBest).toEqual({})
    expect(s.lookupHistory).toEqual([])
    // The factory returns fresh nested objects — mutating live state must not leak into defaults.
    s.stats.classic.times.push(1)
    expect(makeProgressDefaults().stats.classic.times).toEqual([])
  })
})
