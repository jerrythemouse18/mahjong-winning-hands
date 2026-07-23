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

function dragonDistance(counts, pungsNeeded) {
  const dragons = [counts[31], counts[32], counts[33]].sort((a, b) => b - a);
  let need = 0;
  for (let i = 0; i < pungsNeeded; i++) need += Math.max(0, 3 - dragons[i]);
  if (pungsNeeded === 2) need += Math.max(0, 2 - dragons[2]); // pair of third dragon
  // Rest of the hand still needs shape; add a soft baseline.
  return need + Math.max(0, standardShanten(counts) - need);
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
