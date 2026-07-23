/**
 * engine.js — Winning-hand analysis engine (Singapore rules).
 *
 * Works on a counts array of length 34 (see tiles.js).
 * A standard winning hand is 14 tiles: 4 sets (chow or pung) + 1 pair.
 * The only special hand recognised in Singapore style is Thirteen Wonders
 * (十三幺). Seven Pairs is NOT a valid Singapore hand.
 *
 * Note: Singapore mahjong also uses flower and animal bonus tiles; they sit
 * outside the 14-tile hand structure and are not modelled in this prototype.
 */

/** Try to decompose `counts` into 4 sets + 1 pair. Returns a decomposition or null. */
function decomposeStandard(counts) {
  for (let pairTile = 0; pairTile < TILE_COUNT; pairTile++) {
    if (counts[pairTile] < 2) continue;
    counts[pairTile] -= 2;
    const sets = decomposeSets(counts, 0, []);
    counts[pairTile] += 2;
    if (sets) return { pair: pairTile, sets };
  }
  return null;
}

/** Recursively remove sets (pungs/chows) starting from tile index `start`. */
function decomposeSets(counts, start, acc) {
  // Advance past empty tiles.
  while (start < TILE_COUNT && counts[start] === 0) start++;
  if (start === TILE_COUNT) return acc.slice();

  // Try a pung.
  if (counts[start] >= 3) {
    counts[start] -= 3;
    const r = decomposeSets(counts, start, [...acc, { type: 'pung', tile: start }]);
    counts[start] += 3;
    if (r) return r;
  }

  // Try a chow (suited tiles only, rank <= 7 so it fits in the suit).
  if (isSuited(start) && rankOf(start) <= 7 && counts[start + 1] > 0 && counts[start + 2] > 0) {
    counts[start]--; counts[start + 1]--; counts[start + 2]--;
    const r = decomposeSets(counts, start, [...acc, { type: 'chow', tile: start }]);
    counts[start]++; counts[start + 1]++; counts[start + 2]++;
    if (r) return r;
  }

  return null;
}

/** Thirteen Wonders (十三幺): one of each terminal/honor plus one duplicate. */
function isThirteenWonders(counts) {
  let hasPair = false;
  for (let i = 0; i < TILE_COUNT; i++) {
    if (isTerminalOrHonor(i)) {
      if (counts[i] === 0 || counts[i] > 2) return false;
      if (counts[i] === 2) {
        if (hasPair) return false;
        hasPair = true;
      }
    } else if (counts[i] !== 0) {
      return false;
    }
  }
  return hasPair;
}

/** Full analysis of a 14-tile hand. */
function analyzeWin(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total !== 14) return { win: false, reason: `Need 14 tiles (have ${total}).` };
  if (counts.some(c => c > 4)) return { win: false, reason: 'More than four copies of a tile.' };

  if (isThirteenWonders(counts)) {
    return { win: true, kind: 'thirteen-wonders', decomposition: null };
  }
  const d = decomposeStandard(counts.slice());
  if (d) return { win: true, kind: 'standard', decomposition: d };
  return { win: false, reason: 'Cannot form 4 sets + a pair (or Thirteen Wonders).' };
}

/** Given 13 tiles, return every tile id that completes a win (the "waits"). */
function findWaits(counts) {
  const waits = [];
  for (let t = 0; t < TILE_COUNT; t++) {
    if (counts[t] >= 4) continue;
    counts[t]++;
    if (analyzeWin(counts).win) waits.push(t);
    counts[t]--;
  }
  return waits;
}

/**
 * Shanten-lite: how many tile swaps a 13-tile hand is from tenpai (ready).
 * 0 = tenpai. Capped search depth keeps it fast for a teaching tool.
 */
function isTenpai(counts) {
  return findWaits(counts).length > 0;
}
