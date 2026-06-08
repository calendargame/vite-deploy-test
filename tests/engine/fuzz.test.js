// ─────────────────────────────────────────────────────────────────────────
// tests/engine/fuzz.test.js — the C2 fuzz / bug survey, EXPANDED in C1 (the giant bug pass).
//
// Drives the shared game reducer through MILLIONS of random-but-valid action sequences, covering
// every mode's action pattern and every settings toggle mid-play, and after EVERY action asserts
// the engine's invariants (engine/invariants.ts) still hold. This is two things at once:
//   1. A BUG HUNT — any impossible score (good>played, …) or desynced history fails the test with
//      a reproducible {profile, seed, step}.
//   2. The VALIDATION that the production tripwires never false-fire — if any invariant fired during
//      correct play, it would fail HERE first, so a green run proves the tripwires are safe to ship.
//
// The deterministic generator + the weighting profiles + the strong score oracle now live in the
// importable harness (tests/engine/fuzzHarness.js) so standalone sweep/debug scripts share them.
// This file just runs each profile and asserts profile-specific COVERAGE (so a profile can never pass
// by silently never reaching its target corner).
//
// ── WEIGHTING PROFILES (C1) ──
// The original survey used ONE uniform action distribution, which under-samples the rare COMPOUND
// sequences where the C2 score bugs lived. So the survey runs WEIGHTED profiles, each a weighted
// action table + flag probabilities, sharing one runSequence:
//   • uniform           — the original even distribution (broad, unbiased corpus).
//   • override-heavy     — biases OVERRIDE + the actions that arm it + BACK → all 5 Override paths.
//   • aox-complete-heavy — biases ANSWER.complete + OVERRIDE.noAdvance → the AoX run-completion corner.
//   • reveal-heavy       — biases the "clean correct on the grid WITHOUT credit" seeds → the false-
//                          credit family the C2 fuzz first caught.
//
// ── STRONG oracle + three more profiles + a sweep knob (C1 deeper pass) ──
// The checks above are INEQUALITIES (good≤played, streak/best/times≤good): they catch IMPOSSIBLE
// states but not "merely WRONG" ones. So three profiles run on the Classic/Deduction action surface
// (no AoX live-credit, no RESET_ROUND — the two things that decouple stats from history) under an
// EXACT oracle (checkStrongScoreOracle): good must EQUAL the reconstructed credit count (a pure, non-
// circular cross-check — good is only ever maintained incrementally), plus best and clean-edge streak.
//   • classic-strict — balanced Classic/Deduction play under the strong oracle.
//   • deep-history   — long (600-step) sequences over DEEP stacks under the strong oracle.
//   • times-churn    — heavy solve-time + tracking churn → hammers the times pool (dropContributedTime).
// Sweep knob: `FUZZ_SCALE=N npx vitest run tests/engine/fuzz.test.js` multiplies every profile's
// sequence COUNT by N (committed default 1) so a "bigger one-time sweep" needs NO code edit.
//
// Deterministic seeds ⇒ any failure reproduces exactly (the failure prints profile + seed + step).
// ─────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { runFuzzProfile, SCALE } from './fuzzHarness.js'

// These profiles are deliberately heavy (millions of reducer calls), so they routinely exceed
// vitest's 5s default per-test timeout — especially under full-suite CPU contention. Give them an
// explicit, generous budget, scaled with the sweep size (SCALE, imported from the harness) so a
// FUZZ_SCALE big-sweep doesn't trip it. A sweep can also pass `--testTimeout=…`.
const T = 30000 * SCALE

describe('fuzz / bug survey — engine invariants hold across random play (C1/C2)', () => {
  // The broad, unbiased baseline — no invariant may ever break across the whole action space.
  it(
    'uniform — survives a large unbiased corpus with ZERO invariant violations',
    () => {
      const cov = runFuzzProfile('uniform')
      // Prove the survey wasn't vacuous — it actually exercised credits, the override paths,
      // back-browsing, and Deduction puzzles (not just trivial no-ops).
      expect(cov.good).toBeGreaterThan(0)
      expect(cov.override).toBeGreaterThan(0)
      expect(cov.back).toBeGreaterThan(0)
      expect(cov.deduction).toBeGreaterThan(0)
    },
    T,
  )

  // Override-heavy — the back-browse / 5-path Override score-integrity family over deep histories.
  it(
    'override-heavy — survives biased Override play with ZERO invariant violations',
    () => {
      const cov = runFuzzProfile('override-heavy')
      expect(cov.override).toBeGreaterThan(0)
      expect(cov.overrideBrowsing).toBeGreaterThan(0) // reached back-browse Override (Path 1)
      expect(cov.back).toBeGreaterThan(0)
    },
    T,
  )

  // AoX-complete-heavy — credit the Nth solve without advancing, then reverse it (run fails).
  it(
    'aox-complete-heavy — survives biased AoX-completion play with ZERO invariant violations',
    () => {
      const cov = runFuzzProfile('aox-complete-heavy')
      expect(cov.complete).toBeGreaterThan(0) // actually fired ANSWER.complete
      expect(cov.noAdvance).toBeGreaterThan(0) // actually fired OVERRIDE.noAdvance
      expect(cov.override).toBeGreaterThan(0)
    },
    T,
  )

  // Reveal-heavy — the "clean correct without credit" seeds, then back-browse + Override to inflate.
  it(
    'reveal-heavy — survives biased burn-then-override play with ZERO invariant violations',
    () => {
      const cov = runFuzzProfile('reveal-heavy')
      expect(cov.reveal).toBeGreaterThan(0) // actually burned questions via Reveal
      expect(cov.override).toBeGreaterThan(0)
      expect(cov.overrideBrowsing).toBeGreaterThan(0) // back-browse Override after the burns
    },
    T,
  )

  // Classic-strict — the Classic/Deduction surface under the EXACT good==credits / best / streak oracle.
  it(
    'classic-strict — survives Classic/Deduction play under the EXACT score oracle',
    () => {
      const cov = runFuzzProfile('classic-strict')
      expect(cov.good).toBeGreaterThan(0)
      expect(cov.override).toBeGreaterThan(0)
      expect(cov.overrideBrowsing).toBeGreaterThan(0)
      expect(cov.deduction).toBeGreaterThan(0)
    },
    T,
  )

  // Deep-history — long sequences over DEEP stacks under the exact oracle.
  it(
    'deep-history — survives long, deep-stack play under the EXACT score oracle',
    () => {
      const cov = runFuzzProfile('deep-history')
      expect(cov.maxStack).toBeGreaterThan(20) // actually built a deep history
      expect(cov.override).toBeGreaterThan(0)
      expect(cov.overrideBrowsing).toBeGreaterThan(0)
    },
    T,
  )

  // Times-churn — hammers the solve-time pool + dropContributedTime under the exact oracle.
  it(
    'times-churn — survives heavy solve-time churn under the EXACT score oracle',
    () => {
      const cov = runFuzzProfile('times-churn')
      expect(cov.maxTimes).toBeGreaterThan(5) // actually accumulated solve times
      expect(cov.override).toBeGreaterThan(0)
      expect(cov.good).toBeGreaterThan(0)
    },
    T,
  )
})
