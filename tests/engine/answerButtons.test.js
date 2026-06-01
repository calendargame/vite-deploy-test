// Unit tests for the engine's pure answer-button / history-entry helpers
// (Stage C, Step 6 — extracted from main.jsx, shared by App, AoxMode, and the reducer).
import { describe, it, expect } from 'vitest'
import {
  computeHasCredit,
  markBtns,
  mkBtnsWithCorrect,
  entryWithGreen,
} from '../../src/engine/answerButtons.js'
import { wday } from '../../src/lib/calendar.js'

describe('computeHasCredit', () => {
  it('is false for empty state', () => {
    expect(computeHasCredit({})).toBe(false)
    expect(computeHasCredit(null)).toBe(false)
  })
  it('is true only when a correct exists with no lingering wrongs', () => {
    expect(computeHasCredit({ 0: 'correct' })).toBe(true)
    expect(computeHasCredit({ 3: 'wrong-latest' })).toBe(false)
    expect(computeHasCredit({ 0: 'correct', 1: 'wrong-prev' })).toBe(false)
    expect(computeHasCredit({ 2: 'wrong-prev' })).toBe(false)
  })
})

describe('markBtns / mkBtnsWithCorrect', () => {
  it('sets the target index and demotes a prior wrong-latest to wrong-prev', () => {
    expect(markBtns({ 0: 'wrong-latest' }, 2, 'correct')).toEqual({ 0: 'wrong-prev', 2: 'correct' })
  })
  it('does not mutate the input', () => {
    const input = { 0: 'wrong-latest' }
    markBtns(input, 1, 'correct')
    expect(input).toEqual({ 0: 'wrong-latest' })
  })
  it('mkBtnsWithCorrect marks the index correct', () => {
    expect(mkBtnsWithCorrect({ 1: 'wrong-latest' }, 3)).toEqual({ 1: 'wrong-prev', 3: 'correct' })
  })
})

describe('entryWithGreen', () => {
  it('returns the entry unchanged when it already has a correct, or has no wrong', () => {
    const correctEntry = { y: 2024, m: 1, d: 1, btns: { 1: 'correct' } }
    expect(entryWithGreen(correctEntry, false)).toBe(correctEntry)
    const cleanEntry = { y: 2024, m: 1, d: 1, btns: {} }
    expect(entryWithGreen(cleanEntry, false)).toBe(cleanEntry)
  })
  it('synthesizes a green on the correct weekday for a wrong-only date entry, demoting the wrong', () => {
    const ci = wday(2024, 1, 1) // the correct index for this date (Gregorian)
    const result = entryWithGreen({ y: 2024, m: 1, d: 1, btns: { 3: 'wrong-latest' }, _jul: false }, false)
    expect(result.btns[ci]).toBe('correct')
    expect(result.btns[3]).toBe('wrong-prev')
  })
  it('derives the correct index from options for a deduction year entry', () => {
    const result = entryWithGreen(
      { type: 'year', options: [2000, 2001, 2002], y: 2001, btns: { 0: 'wrong-latest' } },
      false,
    )
    expect(result.btns[1]).toBe('correct') // options.indexOf(2001) === 1
    expect(result.btns[0]).toBe('wrong-prev')
  })
})
