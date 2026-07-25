/**
 * suggestions.js — Ranks named patterns by how close the user's current
 * tiles are to completing them, and computes exact waits at 13 tiles.
 *
 * Standard-hand distance uses a real shanten search (exact). Per-pattern
 * distances are fast heuristics — good enough to say "you're closest to a
 * Half Flush" while the hand is still forming.
 */

/**
 * Exact standard shanten for up to 14 tiles.
 * Returns 0 when one tile from winning (tenpai), -1 when complete.
 */
function standardShanten(counts) {
  let best = 8;

  function dfs(i, melds, partials, hasPair) {
    while (i < TILE_COUNT && counts[i] === 0) i++;
    if (i === TILE_COUNT) {
      best = Math.min(best, 8 - 2 * melds - partials - (hasPair ? 1 : 0));
      return;
    }

    // Pung
    if (counts[i] >= 3) {
      counts[i] -= 3;
      dfs(i, melds + 1, partials, hasPair);
      counts[i] += 3;
    }
    // Chow
    if (isSuited(i) && rankOf(i) <= 7 && counts[i + 1] > 0 && counts[i + 2] > 0) {
      counts[i]--; counts[i + 1]--; counts[i + 2]--;
      dfs(i, melds + 1, partials, hasPair);
      counts[i]++; counts[i + 1]++; counts[i + 2]++;
    }
    if (melds + partials < 4) {
      // Partial run: adjacent or one-gap
      if (isSuited(i) && rankOf(i) <= 8 && counts[i + 1] > 0) {
        counts[i]--; counts[i + 1]--;
        dfs(i, melds, partials + 1, hasPair);
        counts[i]++; counts[i + 1]++;
      }
      if (isSuited(i) && rankOf(i) <= 7 && counts[i + 2] > 0) {
        counts[i]--; counts[i + 2]--;
        dfs(i, melds, partials + 1, hasPair);
        counts[i]++; counts[i + 2]++;
      }
    }
    if (counts[i] >= 2) {
      counts[i] -= 2;
      if (!hasPair) dfs(i, melds, partials, true);          // reserve as the pair
      else if (melds + partials < 4) dfs(i, melds, partials + 1, hasPair); // pair as partial pung
      counts[i] += 2;
    }
    // Skip this tile (leave as floater)
    const saved = counts[i];
    counts[i] = 0;
    dfs(i + 1, melds, partials, hasPair);
    counts[i] = saved;
  }

  const backup = counts.slice();
  dfs(0, 0, 0, false);
  for (let i = 0; i < TILE_COUNT; i++) counts[i] = backup[i];

  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 14 && analyzeWin(counts).win) return -1;
  return best;
}

function thirteenWondersShanten(counts) {
  let kinds = 0, hasPair = false;
  for (let i = 0; i < TILE_COUNT; i++) {
    if (!isTerminalOrHonor(i)) continue;
    if (counts[i] > 0) kinds++;
    if (counts[i] >= 2) hasPair = true;
  }
  return 13 - kinds - (hasPair ? 1 : 0);
}

/**
 * Heuristic distance estimators per pattern id: roughly "how many of your
 * tiles would need to change" to land this pattern. Lower is closer.
 */
const PATTERN_DISTANCE = {
  'chicken-hand': counts => standardShanten(counts),
  'ping-hu': counts => {
    // Penalise honor tiles — they can never join a chow.
    let penalty = 0;
    for (let i = 27; i < TILE_COUNT; i++) penalty += counts[i];
    return standardShanten(counts) + penalty;
  },
  'pong-pong': counts => {
    let pairsPlus = 0, triples = 0;
    for (let i = 0; i < TILE_COUNT; i++) {
      if (counts[i] >= 3) triples++;
      else if (counts[i] === 2) pairsPlus++;
    }
    // Need 4 triplets + 1 pair.
    return Math.max(0, 8 - 2 * triples - Math.min(pairsPlus, 5 - triples));
  },
  'half-flush': counts => flushDistance(counts, true),
  'full-flush': counts => flushDistance(counts, false),
  'dragon-pung': counts => {
    const bestDragon = Math.max(counts[31], counts[32], counts[33]);
    return Math.max(0, 3 - bestDragon) + Math.max(0, standardShanten(counts) - (3 - bestDragon));
  },
  'all-honors': counts => {
    let honors = 0;
    for (let i = 27; i < TILE_COUNT; i++) honors += counts[i];
    return Math.max(0, 14 - honors - 1); // rough: every non-honor must go
  },
  'little-dragons': counts => dragonDistance(counts, 2),
  'big-dragons': counts => dragonDistance(counts, 3),
  'little-winds': counts => windDistance(counts, 3),
  'big-winds': counts => windDistance(counts, 4),
  'mixed-terminals': counts => terminalPungDistance(counts, true),
  'pure-terminals': counts => terminalPungDistance(counts, false),
  'nine-gates': counts => nineGatesDistance(counts),
  'thirteen-wonders': counts => thirteenWondersShanten(counts),
};

function flushDistance(counts, allowHonors) {
  let best = 99;
  for (let suit = 0; suit < 3; suit++) {
    let keep = 0;
    for (let i = 0; i < TILE_COUNT; i++) {
      if (!counts[i]) continue;
      if (isHonor(i)) { if (allowHonors) keep += counts[i]; }
      else if (suitOf(i) === suit) keep += counts[i];
    }
    best = Math.min(best, Math.max(0, 13 - keep));
  }
  return best;
}

function windDistance(counts, pungsNeeded) {
  const winds = [counts[27], counts[28], counts[29], counts[30]].sort((a, b) => b - a);
  let need = 0;
  for (let i = 0; i < pungsNeeded; i++) need += Math.max(0, 3 - winds[i]);
  if (pungsNeeded === 3) need += Math.max(0, 2 - winds[3]); // pair of 4th wind
  return need + Math.max(0, standardShanten(counts) - need);
}

/** Distance to an all-pung hand of terminals (+honors when allowed). */
function terminalPungDistance(counts, allowHonors) {
  let keep = 0;
  for (let i = 0; i < TILE_COUNT; i++) {
    if (!counts[i]) continue;
    const eligible = allowHonors ? isTerminalOrHonor(i) : (isSuited(i) && isTerminalOrHonor(i));
    if (eligible) keep += Math.min(counts[i], 3);
  }
  return Math.max(0, 14 - keep - 1);
}

/** Tiles missing from the best-suit 1112345678999 template. */
function nineGatesDistance(counts) {
  let best = 99;
  for (let suit = 0; suit < 3; suit++) {
    const base = suit * 9;
    let missing = 0;
    for (let r = 0; r < 9; r++) {
      const need = (r === 0 || r === 8) ? 3 : 1;
      missing += Math.max(0, need - counts[base + r]);
    }
    best = Math.min(best, missing);
  }
  return best;
}

function dragonDistance(counts, pungsNeeded) {
  const dragons = [counts[31], counts[32], counts[33]].sort((a, b) => b - a);
  let need = 0;
  for (let i = 0; i < pungsNeeded; i++) need += Math.max(0, 3 - dragons[i]);
  if (pungsNeeded === 2) need += Math.max(0, 2 - dragons[2]); // pair of third dragon
  // Rest of the hand still needs shape; add a soft baseline.
  return need + Math.max(0, standardShanten(counts) - need);
}

/**
 * Discard advisor: for a 14-tile hand that is not a win, evaluate every
 * possible discard. For each candidate, report the resulting shanten and
 * ukeire — how many individual tiles (out of the remaining wall) would
 * advance the hand. Lower shanten first, then higher ukeire.
 *
 * Returns [{ tile, shanten, ukeire, acceptedTiles }], best first.
 */
function adviseDiscards(counts) {
  const options = [];
  for (let d = 0; d < TILE_COUNT; d++) {
    if (counts[d] === 0) continue;
    counts[d]--;
    const shanten = standardShanten(counts);
    // Ukeire: tiles that lower the shanten (or complete the hand at 0).
    let ukeire = 0;
    const acceptedTiles = [];
    for (let t = 0; t < TILE_COUNT; t++) {
      if (counts[t] >= 4) continue;
      counts[t]++;
      const after = shanten === 0 ? (analyzeWin(counts).win ? -1 : 99) : standardShanten(counts);
      counts[t]--;
      if (after < shanten) {
        // 4 copies per tile type minus what we can see in our own hand/discard.
        const live = 4 - counts[t] - (t === d ? 1 : 0);
        if (live > 0) {
          ukeire += live;
          acceptedTiles.push(t);
        }
      }
    }
    counts[d]++;
    options.push({ tile: d, shanten, ukeire, acceptedTiles });
  }
  options.sort((a, b) => a.shanten - b.shanten || b.ukeire - a.ukeire);
  return options;
}

/**
 * For a specific pattern, find which tile(s) to throw: the discards that
 * leave the remaining hand closest to the pattern. Returns tile ids tied
 * for the best resulting distance (up to maxTiles).
 */
function bestDiscardsForPattern(counts, patternId, maxTiles = 3) {
  const fn = PATTERN_DISTANCE[patternId];
  if (!fn) return [];
  const options = [];
  for (let d = 0; d < TILE_COUNT; d++) {
    if (!counts[d]) continue;
    counts[d]--;
    options.push({ tile: d, distance: fn(counts.slice()) });
    counts[d]++;
  }
  if (!options.length) return [];
  const best = Math.min(...options.map(o => o.distance));
  return options.filter(o => o.distance === best).map(o => o.tile).slice(0, maxTiles);
}

/**
 * Main entry: given the user's current counts, return ranked suggestions.
 * Each suggestion: { pattern, distance, note }.
 */
function suggestPatterns(counts) {
  const results = [];
  for (const p of PATTERNS) {
    const fn = PATTERN_DISTANCE[p.id];
    if (!fn) continue;
    const d = fn(counts.slice());
    results.push({ pattern: p, distance: d });
  }
  results.sort((a, b) => a.distance - b.distance || a.pattern.difficulty - b.pattern.difficulty);
  return results;
}
