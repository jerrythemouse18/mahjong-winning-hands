/**
 * safety.js — Defensive discard analysis from opponents' recent discards.
 *
 * Implements:
 *  1. Suji (筋) inference — if an opponent discarded X, the two-sided wait
 *     partners are safer (1↔4, 2↔5, 3↔6, 4↔7, 5↔8, 6↔9).
 *  2. Kabe (壁) / wall counting — if 3–4 copies of a tile are visible,
 *     sequences through it are blocked, making adjacent tiles safer.
 *  3. One-chance / No-chance — all 4 copies visible = completely dead;
 *     3 copies = one-chance (moderate boost).
 *  4. Early vs late discard weighting — later discards are stronger signals.
 *  5. Genbutsu (現物) — exact tiles an opponent already discarded are very
 *     safe against them. (Note: the hard furiten guarantee is a riichi rule;
 *     Singapore house rules vary on winning off a tile you discarded, so we
 *     treat it as a strong signal rather than an absolute.)
 *  6. Assumption mode — "chow" (Ping Hu assumption, full suji weight) vs
 *     "mixed" (half suji weight, for pung-heavy tables).
 *
 * Thresholds: score ≥ 10 'safe', ≥ 5 'caution', else 'risky'.
 */

const MAX_DISCARD_ROUNDS = 5;
const OPPONENT_NAMES = ['Right player (下家)', 'Facing player (對家)', 'Left player (上家)'];

/**
 * Suji pairs: for each rank, the partner tiles that become safer when it's discarded.
 * E.g. rank 4 → partners [1, 7] (via 2-3 and 5-6 two-sided waits).
 */
const SUJI_PARTNERS = {
  1: [4],      // 1 discarded → 4 safer (only from 2-3 wait side)
  2: [5],      // 2 discarded → 5 safer (from 3-4 wait side)
  3: [6],      // 3 discarded → 6 safer (from 4-5 wait side)
  4: [1, 7],   // 4 discarded → 1 safer (2-3 wait) and 7 safer (5-6 wait)
  5: [2, 8],   // 5 discarded → 2 safer (3-4 wait) and 8 safer (6-7 wait)
  6: [3, 9],   // 6 discarded → 3 safer (4-5 wait) and 9 safer (7-8 wait)
  7: [4],      // 7 discarded → 4 safer (from 5-6 wait side)
  8: [5],      // 8 discarded → 5 safer (from 6-7 wait side)
  9: [6],      // 9 discarded → 6 safer (from 7-8 wait side)
};

/**
 * Compute total visible copies of each tile (from hand + all opponent discards).
 * Returns a counts[34] array.
 */
function visibleCounts(handCounts, oppDiscards) {
  const visible = handCounts.slice();
  for (const list of oppDiscards) {
    for (const t of list) visible[t]++;
  }
  return visible;
}

/**
 * Score one tile for safety against all opponents.
 *
 * @param tile          tile id 0..33
 * @param handCounts    your hand (counts[34])
 * @param oppDiscards   [[ids], [ids], [ids]] recent discards per opponent
 * @param assumeChow   true = full suji weight (Ping Hu assumption); false = half
 * @param oppTai        [number, number, number] tai outside per opponent (0 = unknown/none)
 */
function tileSafety(tile, handCounts, oppDiscards, assumeChow, oppTai) {
  let score = 0;
  const reasons = [];
  const allDiscards = oppDiscards.flat();
  const visible = visibleCounts(handCounts, oppDiscards);
  const sujiMultiplier = assumeChow ? 1.0 : 0.5;

  // Track per-opponent safety status for tai weighting.
  // 0 = live, 1 = suji coverage (heuristic), 2 = genbutsu/dead (hard).
  const oppSafe = [0, 0, 0];

  // --- 1. Genbutsu: exact tile discarded by opponent(s) ---
  const discardedBy = oppDiscards.filter((list, i) => {
    const has = list.includes(tile);
    if (has) oppSafe[i] = 2;
    return has;
  }).length;
  if (discardedBy > 0) {
    score += 5 * discardedBy;
    reasons.push({
      type: 'genbutsu',
      text: `discarded by ${discardedBy} opponent${discardedBy > 1 ? 's' : ''} (they passed on it — very safe)`,
    });
  }

  // A tile with all 4 copies visible cannot complete anyone's hand.
  const fullyDead = visible[tile] >= 4;
  if (fullyDead) oppSafe.fill(2);

  // --- 2. Suji inference (suited tiles only) ---
  if (isSuited(tile)) {
    const rank = rankOf(tile);
    const suit = suitOf(tile);
    // Check if any opponent discarded a tile whose suji partner is our tile
    const sujiSources = [];
    for (let r = 1; r <= 9; r++) {
      const partners = SUJI_PARTNERS[r];
      if (!partners || !partners.includes(rank)) continue;
      // r was discarded → our tile (rank) is a suji partner
      const sourceId = suit * 9 + (r - 1);
      const sourceDiscardedBy = oppDiscards.filter((list, i) => {
        const has = list.includes(sourceId);
        if (has) oppSafe[i] = Math.max(oppSafe[i], 1); // suji coverage (heuristic)
        return has;
      }).length;
      if (sourceDiscardedBy > 0) {
        sujiSources.push({ rank: r, count: sourceDiscardedBy });
      }
    }
    if (sujiSources.length > 0) {
      // Weight by how many opponents discarded the source tile + early/late
      for (const src of sujiSources) {
        const baseBonus = 3 * src.count;
        const bonus = Math.round(baseBonus * sujiMultiplier);
        score += bonus;
      }
      const srcDesc = sujiSources.map(s =>
        `${s.rank}${SUITS[suit].key} by ${s.count} opp`).join(', ');
      reasons.push({
        type: 'suji',
        text: `suji safe — ${srcDesc} discarded${!assumeChow ? ' (half weight, mixed mode)' : ''}`,
      });
    }
  }

  // --- 3. Kabe (壁) / No-chance / One-chance ---
  if (isSuited(tile)) {
    const rank = rankOf(tile);
    const suit = suitOf(tile);
    // Check tiles that form sequences containing our tile
    // A sequence [a, a+1, a+2] — our tile participates if rank ∈ {a, a+1, a+2}
    // So sequences containing our tile start at max(1, rank-2) to min(7, rank)
    let blockedPaths = 0;
    let totalPaths = 0;
    const blockedDetails = [];

    for (let start = Math.max(1, rank - 2); start <= Math.min(7, rank); start++) {
      totalPaths++;
      // Check if any tile in this sequence (other than ours) is fully/heavily blocked
      const seqTiles = [start, start + 1, start + 2];
      const otherTiles = seqTiles.filter(r => r !== rank);
      for (const r of otherTiles) {
        const tId = suit * 9 + (r - 1);
        if (visible[tId] >= 4) {
          // No-chance: this sequence path is completely dead
          blockedPaths++;
          blockedDetails.push(`${r}${SUITS[suit].key} (all 4 visible)`);
          break;
        } else if (visible[tId] >= 3) {
          // One-chance: only 1 copy remains
          blockedPaths += 0.75;
          blockedDetails.push(`${r}${SUITS[suit].key} (3 visible)`);
          break;
        }
      }
    }

    if (blockedPaths > 0) {
      const bonus = Math.round(blockedPaths * 2);
      score += bonus;
      const uniqueDetails = [...new Set(blockedDetails)].slice(0, 3);
      reasons.push({
        type: 'kabe',
        text: `kabe — ${Math.floor(blockedPaths)}/${totalPaths} sequence paths blocked (${uniqueDetails.join(', ')})`,
      });
    }
  }

  // --- 4. Visible copies (basic) ---
  const visibleElsewhere = allDiscards.filter(t => t === tile).length +
    Math.max(0, handCounts[tile] - 1);
  if (visibleElsewhere > 0 && discardedBy === 0) {
    // Only add if not already counted via genbutsu
    score += Math.min(visibleElsewhere, 3);
    reasons.push({
      type: 'visible',
      text: `${visibleElsewhere} other cop${visibleElsewhere > 1 ? 'ies' : 'y'} visible`,
    });
  }

  // --- 5. Honor tile specifics ---
  if (isHonor(tile)) {
    const totalVisible = visible[tile];
    if (totalVisible >= 4) {
      score += 4;
      reasons.push({ type: 'dead-honor', text: 'honor is dead — all 4 copies visible, no win possible' });
    } else if (totalVisible === 3) {
      // Pung impossible, but the last copy can still win a tanki (pair) wait.
      score += 2;
      reasons.push({ type: 'dead-honor', text: 'pung impossible (3 visible) — a pair wait on the last copy is still possible' });
    } else if (totalVisible <= handCounts[tile] && discardedBy === 0) {
      // Only copies visible are in our own hand — no opponent has shown it
      score -= 3;
      reasons.push({ type: 'fresh-honor', text: 'fresh honor — someone may be collecting' });
    }
  }

  // --- 6. Early vs late weighting (boost for late-game discards) ---
  if (isSuited(tile) && discardedBy === 0) {
    // Check if suji source tiles were discarded late (later in the list = later in game)
    // A tile in position 3-4 (0-indexed) of a 5-discard list is "late"
    let lateBonus = 0;
    for (let opp = 0; opp < oppDiscards.length; opp++) {
      const list = oppDiscards[opp];
      if (list.length < 3) continue; // not enough data for early/late
      // Check suji sources in later positions
      const rank = rankOf(tile);
      const suit = suitOf(tile);
      for (let r = 1; r <= 9; r++) {
        const partners = SUJI_PARTNERS[r];
        if (!partners || !partners.includes(rank)) continue;
        const sourceId = suit * 9 + (r - 1);
        const pos = list.lastIndexOf(sourceId);
        if (pos >= 0) {
          const relativePos = pos / (list.length - 1); // 0=earliest, 1=latest
          if (relativePos >= 0.6) lateBonus += 1;
        }
      }
    }
    if (lateBonus > 0) {
      score += lateBonus;
      reasons.push({
        type: 'late',
        text: `suji source discarded late (stronger signal)`,
      });
    }
  }

  // --- 7. Nearby suited discards (soft signal) ---
  if (isSuited(tile) && discardedBy === 0) {
    let nearby = 0;
    for (const t of allDiscards) {
      if (isSuited(t) && suitOf(t) === suitOf(tile) && t !== tile && Math.abs(rankOf(t) - rankOf(tile)) <= 2) {
        nearby++;
      }
    }
    if (nearby >= 2) {
      const bonus = Math.min(nearby - 1, 2);
      score += bonus;
      reasons.push({
        type: 'nearby',
        text: `${nearby} nearby tiles of the same suit discarded`,
      });
    }
  }

  // --- 8. Per-player tai weighting ---
  // If an opponent has high tai outside (visible from exposed melds), penalize tiles
  // that are live (not safe) against them, and reward tiles that ARE safe against them.
  if (oppTai && oppTai.some(t => t > 0)) {
    for (let i = 0; i < 3; i++) {
      const tai = oppTai[i];
      if (tai <= 0) continue;
      if (oppSafe[i] === 2) {
        // Hard-safe (genbutsu or dead tile) against the dangerous player — full bonus
        const bonus = Math.ceil(tai * 0.75);
        score += bonus;
        reasons.push({
          type: 'tai-safe',
          text: `safe vs ${OPPONENT_NAMES[i].split(' (')[0]} (${tai} tai outside)`,
        });
      } else if (oppSafe[i] === 1) {
        // Suji coverage only — heuristic, scale by the mode's suji trust
        const bonus = Math.ceil(tai * 0.75 * sujiMultiplier * 0.5);
        score += bonus;
        reasons.push({
          type: 'tai-safe',
          text: `suji-safe vs ${OPPONENT_NAMES[i].split(' (')[0]} (${tai} tai outside) — heuristic only`,
        });
      } else {
        // This tile is live against a dangerous player — penalty
        const penalty = tai;
        score -= penalty;
        reasons.push({
          type: 'tai-danger',
          text: `live vs ${OPPONENT_NAMES[i].split(' (')[0]} (${tai} tai outside) — avoid shooting`,
        });
      }
    }
  }

  // --- Classify ---
  const level = score >= 10 ? 'safe' : score >= 5 ? 'caution' : 'risky';
  if (!reasons.length) reasons.push({ type: 'none', text: 'no information — treat as live' });
  return { tile, score, level, reasons };
}

/** Rank every distinct tile in the hand, safest first. */
function safetyRanking(handCounts, oppDiscards, assumeChow, oppTai) {
  const out = [];
  for (let t = 0; t < TILE_COUNT; t++) {
    if (handCounts[t] > 0) out.push(tileSafety(t, handCounts, oppDiscards, assumeChow, oppTai));
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}
