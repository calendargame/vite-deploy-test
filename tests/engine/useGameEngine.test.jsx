// @vitest-environment jsdom
//
// Tests for the useGameEngine hook (Stage C, Step 6, 1c) — the React binding around the
// pure reducer. The reducer's transitions are exhaustively covered in gameReducer.test.js;
// these verify the wiring: mount generates a date, action callbacks dispatch with the right
// payloads, and the derived `correct` / `overrideAvail` reflect state.
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameEngine } from '../../src/engine/useGameEngine.js'
import { wday } from '../../src/lib/calendar.js'

// A deterministic genDate (fixed Gregorian date — value doesn't matter for these checks).
const genDate = () => ({ y: 2024, m: 1, d: 1, _fmt: 'numeric-ymd', _jul: false })
const C = wday(2024, 1, 1)
const W = (C + 1) % 7
const opts = { genDate, minY: 1583, maxY: 10000, useJulian: false, saveStats: true, timingOff: true }

describe('useGameEngine', () => {
  it('mounts with a generated question and the derived correct weekday', () => {
    const { result } = renderHook(() => useGameEngine(opts))
    expect(result.current.state.date.y).toBe(2024)
    expect(result.current.correct).toBe(C)
    expect(result.current.overrideAvail).toBe(false)
  })

  it('answer(correct) credits and advances; history grows', () => {
    const { result } = renderHook(() => useGameEngine(opts))
    act(() => result.current.answer(C))
    expect(result.current.state.stats).toMatchObject({ played: 1, good: 1, streak: 1 })
    expect(result.current.state.stack).toHaveLength(1)
  })

  it('answer(wrong) burns the question and arms Override', () => {
    const { result } = renderHook(() => useGameEngine(opts))
    act(() => result.current.answer(W))
    expect(result.current.state.countedWrong).toBe(true)
    expect(result.current.overrideAvail).toBe(true)
    act(() => result.current.override())
    expect(result.current.state.stats).toMatchObject({ played: 1, good: 1 }) // Path 3 credit
  })

  it('reset clears stats and history', () => {
    const { result } = renderHook(() => useGameEngine(opts))
    act(() => result.current.answer(C))
    act(() => result.current.resetStats())
    expect(result.current.state.stats).toMatchObject({ played: 0, good: 0 })
    expect(result.current.state.stack).toEqual([])
  })
})
