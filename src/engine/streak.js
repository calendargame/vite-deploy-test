// ─────────────────────────────────────────────────────────────────────────
// engine/streak.js — the first resident of the shared game engine.
//
// computeStreaks: given the chronological list of per-question "did this question
// earn credit" booleans, return the current trailing streak and the best (longest)
// run anywhere in the history. Pure — no app state, no React.
//
// This is the single source of truth for streak math. The identical loop was
// previously inlined in App's recalcStreak() and in override() Paths 4 and 5
// (and, separately, twice inside AoxMode). Those App-side copies now call this;
// AoX's copies adopt it when AoX moves onto the shared engine. Extracted in the
// mode-untangle (Stage C, Step 6) as the first carved-out piece of common logic.
// ─────────────────────────────────────────────────────────────────────────

/**
 * @param {boolean[]} history chronological per-question credit flags
 * @returns {{curStreak:number,bestStreak:number}} trailing streak + longest run
 */
export function computeStreaks(history) {
  // Current streak: count back from the end until the first non-credit question.
  let curStreak = 0
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]) curStreak++
    else break
  }
  // Best streak: the longest unbroken run of credit anywhere in the history.
  let bestStreak = 0,
    run = 0
  for (const h of history) {
    if (h) {
      run++
      if (run > bestStreak) bestStreak = run
    } else run = 0
  }
  return { curStreak, bestStreak }
}
