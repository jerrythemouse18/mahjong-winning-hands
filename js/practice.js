/**
 * practice.js — Quiz generation and grading (pure logic, UI in practice-ui.js).
 *
 * Two drills:
 *  - Waits quiz: a random tenpai (13-tile) hand; name every winning tile.
 *  - Discard quiz: a random 14-tile hand; pick the best discard.
 *
 * Generators take an rng () => [0,1) so tests can inject a seeded one.
 */

/** Random complete 14-tile hand (4 sets + pair) as a counts array. */
function generateCompleteHand(rng) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const counts = new Array(TILE_COUNT).fill(0);
    let ok = true;
    for (let s = 0; s < 4 && ok; s++) {
      if (rng() < 0.6) {
        // Chow: random suit, start rank 1..7.
        const suit = Math.floor(rng() * 3);
        const start = suit * 9 + Math.floor(rng() * 7);
        counts[start]++; counts[start + 1]++; counts[start + 2]++;
        if (counts[start] > 4 || counts[start + 1] > 4 || counts[start + 2] > 4) ok = false;
      } else {
        const t = Math.floor(rng() * TILE_COUNT);
        counts[t] += 3;
        if (counts[t] > 4) ok = false;
      }
    }
    if (!ok) continue;
    const pair = Math.floor(rng() * TILE_COUNT);
    counts[pair] += 2;
    if (counts[pair] > 4) continue;
    return counts;
  }
  // Deterministic fallback — always valid.
  return toCounts(parseHand('123m 456p 789s 234s 55m'));
}

/** Waits quiz: tenpai hand + its true waits. */
function generateWaitsQuiz(rng) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const counts = generateCompleteHand(rng);
    // Remove one random tile → usually tenpai.
    const present = [];
    for (let t = 0; t < TILE_COUNT; t++) if (counts[t] > 0) present.push(t);
    const drop = present[Math.floor(rng() * present.length)];
    counts[drop]--;
    const waits = findWaits(counts);
    if (waits.length > 0) return { counts, waits };
  }
  const counts = toCounts(parseHand('123m 456p 789s 234s 5m'));
  return { counts, waits: findWaits(counts) };
}

/** Grade a waits answer: sets must match exactly for full marks. */
function gradeWaits(answer, waits) {
  const ansSet = new Set(answer);
  const trueSet = new Set(waits);
  const hits = waits.filter(t => ansSet.has(t));
  const misses = waits.filter(t => !ansSet.has(t));
  const extras = answer.filter(t => !trueSet.has(t));
  return {
    correct: misses.length === 0 && extras.length === 0 && hits.length > 0,
    hits, misses, extras,
  };
}

/** Discard quiz: a 14-tile hand that is NOT a win and has a meaningful choice. */
function generateDiscardQuiz(rng) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const counts = new Array(TILE_COUNT).fill(0);
    let placed = 0;
    // Random-ish playable hand: a few partial shapes + noise.
    while (placed < 14) {
      const roll = rng();
      if (roll < 0.5) {
        const suit = Math.floor(rng() * 3);
        const start = suit * 9 + Math.floor(rng() * 8);
        if (counts[start] < 4 && counts[start + 1] < 4 && placed + 2 <= 14) {
          counts[start]++; counts[start + 1]++; placed += 2;
        }
      } else if (roll < 0.7) {
        const t = Math.floor(rng() * TILE_COUNT);
        if (counts[t] <= 2 && placed + 2 <= 14) { counts[t] += 2; placed += 2; }
      } else {
        const t = Math.floor(rng() * TILE_COUNT);
        if (counts[t] < 4) { counts[t]++; placed++; }
      }
    }
    if (analyzeWin(counts).win) continue;
    const options = adviseDiscards(counts);
    if (!options.length) continue;
    const best = options[0];
    // Interesting only if the choice matters: some discard is strictly worse.
    const worst = options[options.length - 1];
    if (best.shanten === worst.shanten && best.ukeire === worst.ukeire) continue;
    if (best.shanten > 3) continue; // too random to teach anything
    return { counts, options };
  }
  const counts = toCounts(parseHand('129m 345p 789s 234s 5m E'));
  return { counts, options: adviseDiscards(counts) };
}

/**
 * Grade a discard choice against the advisor's ranking.
 * full  = ties the best on shanten AND ukeire;
 * good  = reaches the best shanten with fewer accepting tiles;
 * poor  = leaves the hand further from ready than needed.
 */
function gradeDiscard(tile, options) {
  const pick = options.find(o => o.tile === tile);
  if (!pick) return { grade: 'invalid' };
  const best = options[0];
  if (pick.shanten === best.shanten && pick.ukeire === best.ukeire) {
    return { grade: 'full', pick, best };
  }
  if (pick.shanten === best.shanten) return { grade: 'good', pick, best };
  return { grade: 'poor', pick, best };
}
