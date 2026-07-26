/**
 * safety.js — Defensive discard analysis from opponents' recent discards.
 *
 * The user records up to MAX_DISCARD_ROUNDS recent discards per opponent.
 * Each tile in the user's hand gets a heuristic safety score:
 *
 *  +4 per opponent who has discarded that exact tile — they let it pass, so
 *     it is unlikely to complete their hand (the strongest signal).
 *  +1 per copy of the tile visible elsewhere (discards + spare copies in
 *     your own hand) — fewer live copies means fewer ways to use it.
 *  +4 for an honor with 3+ copies visible — a pung/pair win on it is
 *     effectively dead.
 *  +1 (cap +3) per discarded suited tile within 2 ranks of it — opponents
 *     discarding around a tile suggests they aren't building runs there.
 *  −2 for a completely fresh honor (none visible anywhere) — someone may be
 *     collecting it.
 *
 * Thresholds: score ≥ 8 'safe', ≥ 4 'caution', else 'risky'. This is a
 * teaching heuristic, not a solver — real defence also reads timing, melds,
 * and table flow.
 */

const MAX_DISCARD_ROUNDS = 5;
const OPPONENT_NAMES = ['Right player (下家)', 'Facing player (對家)', 'Left player (上家)'];

/**
 * Score one tile against the recorded discards.
 * @param tile          tile id 0..33
 * @param handCounts    your hand (counts[34]) — spare copies count as visible
 * @param oppDiscards   [[ids], [ids], [ids]] recent discards per opponent
 */
function tileSafety(tile, handCounts, oppDiscards) {
  let score = 0;
  const reasons = [];

  const discardedBy = oppDiscards.filter(list => list.includes(tile)).length;
  if (discardedBy > 0) {
    score += 4 * discardedBy;
    reasons.push(`already discarded by ${discardedBy} opponent${discardedBy > 1 ? 's' : ''}`);
  }

  const allDiscards = oppDiscards.flat();
  const visibleElsewhere = allDiscards.filter(t => t === tile).length +
    Math.max(0, handCounts[tile] - 1);
  if (visibleElsewhere > 0) {
    score += visibleElsewhere;
    reasons.push(`${visibleElsewhere} other cop${visibleElsewhere > 1 ? 'ies' : 'y'} visible`);
  }

  if (isHonor(tile)) {
    if (visibleElsewhere >= 3) {
      score += 4;
      reasons.push('honor is dead — no pung possible');
    } else if (visibleElsewhere === 0 && discardedBy === 0) {
      score -= 2;
      reasons.push('fresh honor — someone may be collecting it');
    }
  } else {
    let nearby = 0;
    for (const t of allDiscards) {
      if (isSuited(t) && suitOf(t) === suitOf(tile) && t !== tile && Math.abs(t - tile) <= 2) nearby++;
    }
    if (nearby > 0) {
      const bonus = Math.min(nearby, 3);
      score += bonus;
      reasons.push(`${nearby} nearby tile${nearby > 1 ? 's' : ''} of the same suit discarded`);
    }
  }

  const level = score >= 8 ? 'safe' : score >= 4 ? 'caution' : 'risky';
  if (!reasons.length) reasons.push('no information yet — treat as live');
  return { tile, score, level, reasons };
}

/** Rank every distinct tile in the hand, safest first. */
function safetyRanking(handCounts, oppDiscards) {
  const out = [];
  for (let t = 0; t < TILE_COUNT; t++) {
    if (handCounts[t] > 0) out.push(tileSafety(t, handCounts, oppDiscards));
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}
