# Design & Architecture

This document explains how the app is put together and how the analysis engine works.

## Overview

The app is a dependency-free static site. Five scripts load in order and share globals (no modules, no bundler — deliberately simple for a prototype):

```
tiles.js  →  engine.js  →  patterns.js  →  suggestions.js  →  app.js
(data)       (win check)   (SG patterns)   (closeness)        (UI)
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
