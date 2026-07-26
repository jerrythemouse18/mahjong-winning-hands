# Design & Architecture

This document explains how the app is put together and how the analysis engine works.

## Overview

The app is a dependency-free static site. Five scripts load in order and share globals (no modules, no bundler — deliberately simple for a prototype):

```
tiles.js  →  engine.js  →  patterns.js  →  suggestions.js  →  scoring.js  →  app.js
(data)       (win check)   (SG patterns)   (closeness +       (tai calc)     (UI)
                                            discard advice)
```

## Tile representation

Every tile type gets an integer id `0..33`:

| Range | Tiles |
|---|---|
| 0–8 | Characters (萬) 1–9 |
| 9–17 | Dots (筒) 1–9 |
| 18–26 | Bamboo (條) 1–9 |
| 27–30 | Winds: East, South, West, North |
| 31–33 | Dragons: Red 中, Green 發, White 白 |

A hand is a **counts array** of length 34 — `counts[i]` is how many copies of tile `i` the player holds (0–4). This makes set-detection recursion cheap: removing a pung is `counts[i] -= 3`.

Hands can also be written in compact notation for tests and examples: `"123m 456p 789s EEE CC"` (`m`/`p`/`s` suits; `E S W N` winds; `C F P` = Red/Green/White dragons). `parseHand()` converts notation → ids.

## Win detection (`engine.js`)

`analyzeWin(counts)` checks a 14-tile hand in order:

1. **Thirteen Wonders (十三幺)** — exactly one of each of the 13 terminal/honor types plus one duplicate. Checked first since it doesn't fit the standard shape.
2. **Standard hand** — 4 sets + 1 pair, via backtracking:
   - For each candidate pair (any tile with count ≥ 2), remove it, then try to decompose the remaining 12 tiles into sets.
   - `decomposeSets()` walks tiles in ascending id order. At the lowest non-empty tile it tries: a **pung** (count ≥ 3), then a **chow** (suited, rank ≤ 7, next two ranks present). Because the walk always resolves the lowest tile first, the search cannot skip tiles, so it's complete and fast (worst case well under a millisecond).

Singapore rules note: **Seven Pairs is intentionally not implemented** — it is not a valid Singapore hand.

## Waits (`findWaits`)

For a 13-tile hand, try all 34 tile types (skipping tiles already at 4 copies), add one, and ask `analyzeWin`. Every tile that yields a win is a **winning tile**. 34 win-checks is trivially fast, so no caching is needed.

## Closeness ranking (`suggestions.js`)

Two kinds of distance:

- **`standardShanten(counts)`** — an exact backtracking search for the standard shape. It counts complete melds, partial melds (two tiles that extend to a chow or pung), and the pair, and returns the classic formula `8 − 2·melds − partials − pair` minimised over all decompositions. `0` = tenpai, `−1` = complete.
- **Per-pattern heuristics** — each Singapore pattern has an estimator in `PATTERN_DISTANCE` that answers "roughly how many of your tiles must change to land this pattern?" Examples:
  - *Full Flush*: for each suit, count tiles you could keep (that suit only); distance = 13 − best keep count.
  - *Pong Pong*: distance from 4 triplets + pair given your current triplets/pairs.
  - *Big Three Dragons*: missing dragon tiles + remaining shape distance.

These heuristics are intentionally approximate — the goal is teaching ("you're closest to a Half Flush"), not optimal play. `suggestPatterns()` ranks all patterns by distance, breaking ties by difficulty, and the UI shows the top 5.

## Discard advisor (`adviseDiscards`)

For a 14-tile hand that isn't a win, try discarding each distinct tile in turn. For each candidate:

1. compute the resulting 13-tile `standardShanten`;
2. count **ukeire** — for every tile type that would lower the shanten (or complete a tenpai hand), add the number of copies still live: `4 − copies visible in your own hand`.

Options sort by shanten ascending, then ukeire descending. The UI shows the top 3 with the accepted tiles rendered, and tapping a suggested tile performs the discard. The advisor targets the standard shape only; it doesn't strategise for Thirteen Wonders.

## Discard safety (`safety.js`)

The user records up to 5 recent discards per opponent (`state.oppDiscards`, oldest dropped first). Palette taps route to the selected opponent tab (`state.inputTarget`) or to the player's own hand. `tileSafety(tile, handCounts, oppDiscards)` scores each hand tile: +4 per opponent who discarded that exact tile, +1 per other visible copy, +4 for a dead honor (3+ visible), +1 (cap 3) per nearby same-suit discard, −2 for a completely fresh honor. Levels: ≥8 safe, ≥4 caution, else risky. `safetyRanking` sorts the hand safest-first; the UI renders one row per distinct tile with the reasons, tap-to-discard. Deliberately a teaching heuristic — no meld/timing reads.

## Pattern-targeted discards (`bestDiscardsForPattern`)

Complementing the shape-based advisor: for any named pattern, try each discard and keep those that minimise that pattern's `PATTERN_DISTANCE` heuristic. At 14 tiles, every suggestion card shows "To chase this, throw: …" with the tied-best tiles (tap to discard). The user can pin a pattern with the "Chase this hand" button (`state.targetPattern`) — the pinned card stays on top and throw suggestions are shown only for it.

## Tai scoring (`scoring.js`)

`scoreHand(analysis, counts, ctx)` builds an itemised breakdown:

1. **Hand patterns** from `matchPatterns` — except the generic dragon-pung pattern, which is replaced by per-dragon items (and skipped entirely when Little/Big Three Dragons already covers the pungs, to avoid double counting).
2. **Seat and prevailing wind pungs** (1 tai each; both apply when the winds coincide).
3. **Bonus tiles** — own flower/season (matching seat position), animals (1 tai each), and complete-set bonuses.
4. **Win context** — self-draw, last tile, kong replacement, robbing the kong (1 tai each).

The raw sum is capped at the 5-tai limit; the breakdown shows both.

**Money payouts**: the user picks a base cost (presets 10¢–$2 or custom input) — the per-player unit at 1 tai — plus a payment mode. `payoutAmounts(tai, base, mode)` computes the unit `base × 2^(tai−1)` and a pot of 4 units, then splits it: `'half'` mode → shooter pays 2 units, non-shooters 1 each; `'shooter'` mode (全銃) → shooter pays all 4 units, non-shooters nothing. Self-draw is mode-independent (all three pay 2 units, plus an optional flat per-player self-draw bonus the user can set). Alternatively a fixed `STAKE_TABLES` schedule (e.g. "3/6") replaces the formula: `perPlayer[tai-1]` from each player in half mode and on self-draw, `shooterAll[tai-1]` from the discarder alone in shooter mode, clamped at the top row and paying nothing at 0 tai. The UI renders a per-tai reference table (0 to the configured limit, shooter/non-shooter/winner-collects columns) including bite rows (open kong/animal = 1 tai, hidden kong = 2 tai, paid by every player instantly), and the win breakdown shows dollar amounts at the chosen stake and mode.

Table context lives in the UI state: seat wind, prevailing wind, a set of toggled bonus tiles, and win-context checkboxes — all passed to `scoreHand` on every update.

## Pattern matching (`patterns.js`)

Each pattern is `{ id, name, tai, difficulty, example, description, detect }`. `detect(analysis, counts)` runs only against a *confirmed winning hand*. `matchPatterns()` filters out Chicken Hand whenever any scoring pattern also matched (a hand is only "chicken" if it scores nothing).

Tai values are indicative of common Singapore house rules; they are data, not logic, so adjusting them for your table is a one-line change.

## UI (`app.js`)

Single state object: `state.counts`. Every interaction (add tile, remove tile, clear) calls `update()`, which re-renders:

- palette badges (copies held, greyed out at 4),
- the hand tray (tap to remove),
- the status line — win / tenpai + winning tiles / keep building,
- the suggestions panel (top 5 closest patterns, shown from 5 tiles up).

Input constraints enforced at the source: max 4 copies per tile, max 14 tiles total.

## Extending to other rule styles

A planned feature is letting the user switch rule styles (Hong Kong, Riichi, MCR…). The seams are already in place:

- `patterns.js` is pure data + detectors → one file per rule style.
- `engine.js` special hands (Seven Pairs, etc.) can be toggled by a rules config.
- Scoring names/units (tai vs fan vs han) are display strings in the pattern objects.

## Testing

`test/run-tests.js` loads the browser scripts into a Node `vm` context (no DOM needed — the engine files are UI-free) and asserts on win detection, waits, pattern matching, and shanten. Run with `node test/run-tests.js`.
