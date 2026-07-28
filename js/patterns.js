/**
 * patterns.js — Named winning patterns for Singapore-style mahjong.
 *
 * Each pattern carries a typical tai (台) value under common Singapore house
 * rules. Tai conventions vary table to table — values here are indicative,
 * for learning purposes. Flowers/animals (bonus tai) are out of scope for
 * this prototype.
 */

const PATTERNS = [
  {
    id: 'chicken-hand',
    name: 'Chicken Hand (雞胡)',
    tai: 0,
    difficulty: 1,
    example: '123m 456p 999s EEE 55m',
    description: 'A plain win with no scoring pattern and no bonus tiles — four sets plus a pair, nothing special. Many Singapore tables do not pay out a chicken hand, so aim for at least one tai!',
    detect: a => a.kind === 'standard',
  },
  {
    id: 'ping-hu',
    name: 'Ping Hu / All Chows (平和)',
    tai: 4,
    difficulty: 2,
    example: '123m 456m 567p 789s 22p',
    description: 'All four sets are chows (runs) with a non-honor pair. Fast to assemble and worth a healthy 4 tai in Singapore rules.',
    detect: a => a.kind === 'standard'
      && a.decomposition.sets.every(s => s.type === 'chow')
      && !isHonor(a.decomposition.pair),
  },
  {
    id: 'pong-pong',
    name: 'Pong Pong / All Pungs (碰碰胡)',
    tai: 2,
    difficulty: 2,
    example: '111m 555p 999s EEE 33s',
    description: 'All four sets are pungs (triplets). Slower to build since you need three of a kind each time, but a solid 2 tai.',
    detect: a => a.kind === 'standard' && a.decomposition.sets.every(s => s.type === 'pung'),
  },
  {
    id: 'half-flush',
    name: 'Half Flush (混一色)',
    tai: 2,
    difficulty: 2,
    example: '123m 555m 789m EEE CC',
    description: 'The whole hand uses only one suit plus honor tiles. A natural stepping stone toward the full flush.',
    detect: (a, counts) => {
      const suits = new Set();
      let honors = false;
      for (let i = 0; i < TILE_COUNT; i++) {
        if (!counts[i]) continue;
        if (isHonor(i)) honors = true; else suits.add(suitOf(i));
      }
      return suits.size === 1 && honors;
    },
  },
  {
    id: 'full-flush',
    name: 'Full Flush (清一色)',
    tai: 4,
    difficulty: 3,
    example: '123m 345m 567m 789m 99m',
    description: 'Every tile from a single suit, no honors. Hard to disguise — opponents will notice you discarding two whole suits.',
    detect: (a, counts) => {
      const suits = new Set();
      for (let i = 0; i < TILE_COUNT; i++) {
        if (!counts[i]) continue;
        if (isHonor(i)) return false;
        suits.add(suitOf(i));
      }
      return suits.size === 1;
    },
  },
  {
    id: 'dragon-pung',
    name: 'Dragon Pung (三元牌)',
    tai: 1,
    difficulty: 1,
    example: '123m 456p 789s CCC 55m',
    description: 'A pung of any dragon (Red 中, Green 發, or White 白) is worth 1 tai each — the most common way to escape a chicken hand.',
    detect: (a, counts) => counts[31] >= 3 || counts[32] >= 3 || counts[33] >= 3,
  },
  {
    id: 'all-honors',
    name: 'All Honors (字一色)',
    tai: 5,
    isLimit: true,
    difficulty: 4,
    example: 'EEE SSS WWW CCC FF',
    description: 'Only wind and dragon tiles. Extremely rare — there are just seven honor tile types to draw from. A limit hand (5 tai) in Singapore rules.',
    detect: (a, counts) => {
      for (let i = 0; i < 27; i++) if (counts[i]) return false;
      return true;
    },
  },
  {
    id: 'little-dragons',
    name: 'Little Three Dragons (小三元)',
    tai: 3,
    difficulty: 3,
    example: '123m 456p CCC FFF PP',
    description: 'Two pungs of dragons plus a pair of the third dragon. Upgrade the pair to a pung and it becomes the Big Three Dragons.',
    detect: (a, counts) => {
      const c = [counts[31], counts[32], counts[33]];
      return c.filter(x => x >= 3).length === 2 && c.some(x => x === 2);
    },
  },
  {
    id: 'big-dragons',
    name: 'Big Three Dragons (大三元)',
    tai: 5,
    isLimit: true,
    difficulty: 4,
    example: '123m CCC FFF PPP 55s',
    description: 'Pungs of all three dragons — Red, Green, and White. A classic limit hand (5 tai).',
    detect: (a, counts) => counts[31] >= 3 && counts[32] >= 3 && counts[33] >= 3,
  },
  {
    id: 'little-winds',
    name: 'Little Four Winds (小四喜)',
    tai: 5,
    isLimit: true,
    difficulty: 4,
    example: 'EEE SSS WWW NN 123m',
    description: 'Three pungs of winds plus a pair of the fourth wind. A limit hand — upgrade the pair to a pung for the even rarer Big Four Winds.',
    detect: (a, counts) => {
      const w = [counts[27], counts[28], counts[29], counts[30]];
      return w.filter(x => x >= 3).length === 3 && w.some(x => x === 2);
    },
  },
  {
    id: 'big-winds',
    name: 'Big Four Winds (大四喜)',
    tai: 5,
    isLimit: true,
    difficulty: 5,
    example: 'EEE SSS WWW NNN 55m',
    description: 'Pungs of all four winds — East, South, West, and North. One of the rarest hands in mahjong; an automatic limit.',
    detect: (a, counts) =>
      counts[27] >= 3 && counts[28] >= 3 && counts[29] >= 3 && counts[30] >= 3,
  },
  {
    id: 'mixed-terminals',
    name: 'Mixed Terminals (混么九)',
    tai: 4,
    difficulty: 4,
    example: '111m 999p 111s EEE 99s',
    description: 'Every set is a pung of terminals (1s and 9s) or honors, and the pair is also a terminal or honor. No middle tiles anywhere.',
    detect: (a, counts) => {
      let hasHonor = false, hasTerminal = false;
      for (let i = 0; i < TILE_COUNT; i++) {
        if (!counts[i]) continue;
        if (!isTerminalOrHonor(i)) return false;
        if (isHonor(i)) hasHonor = true; else hasTerminal = true;
      }
      // Pure-terminal and all-honor hands have their own (bigger) patterns.
      return hasHonor && hasTerminal && a.kind === 'standard';
    },
  },
  {
    id: 'pure-terminals',
    name: 'Pure Terminals (清老頭)',
    tai: 5,
    isLimit: true,
    difficulty: 5,
    example: '111m 999m 111p 999s 99p',
    description: 'Only 1s and 9s — four pungs and a pair built entirely from terminals, no honors. A limit hand.',
    detect: (a, counts) => {
      for (let i = 0; i < TILE_COUNT; i++) {
        if (!counts[i]) continue;
        if (isHonor(i) || !isTerminalOrHonor(i)) return false;
      }
      return a.kind === 'standard';
    },
  },
  {
    id: 'nine-gates',
    name: 'Nine Gates (九蓮寶燈)',
    tai: 5,
    isLimit: true,
    difficulty: 5,
    example: '1112345678999m + any tile of the suit',
    description: 'Hold 1112345678999 in one suit (concealed), then win with any tile of that suit — a nine-sided wait at its purest. A legendary limit hand.',
    detect: (a, counts) => {
      for (let suit = 0; suit < 3; suit++) {
        const base = suit * 9;
        let extra = 0, ok = true;
        for (let r = 0; r < 9; r++) {
          const need = (r === 0 || r === 8) ? 3 : 1;
          const have = counts[base + r];
          if (have < need || have > need + 1) { ok = false; break; }
          extra += have - need;
        }
        if (ok && extra === 1) {
          // All other tiles must be absent.
          let others = 0;
          for (let i = 0; i < TILE_COUNT; i++) {
            if (i < base || i >= base + 9) others += counts[i];
          }
          if (others === 0) return true;
        }
      }
      return false;
    },
  },
  {
    id: 'eighteen-arhats',
    name: 'Eighteen Arhats (十八羅漢)',
    tai: 5,
    isLimit: true,
    difficulty: 5,
    example: '4× kong + any pair (18 tiles)',
    description: 'Four kongs plus a pair — eighteen tiles in one hand. The rarest hand in Singapore mahjong; an automatic limit.',
    detect: a => Array.isArray(a.kongs) && a.kongs.length === 4,
  },
  {
    id: 'thirteen-wonders',
    name: 'Thirteen Wonders (十三幺)',
    tai: 5,
    isLimit: true,
    difficulty: 5,
    example: '19m 19p 19s ESWN CFP + any duplicate',
    description: 'One of every terminal (1 and 9 of each suit) and every honor, plus a duplicate of any of them. The most famous limit hand — the only special (non 4-sets-plus-pair) hand in Singapore mahjong.',
    detect: a => a.kind === 'thirteen-wonders',
  },
];

/** Return all named patterns matched by a winning hand. */
function matchPatterns(analysis, counts) {
  if (!analysis.win) return [];
  // Count-based detectors (flushes, dragons, terminals…) should see kong
  // tiles as if they were in-hand pungs.
  let effCounts = counts;
  if (analysis.kongs && analysis.kongs.length) {
    effCounts = counts.slice();
    for (const t of analysis.kongs) effCounts[t] += 3;
  }
  const matched = PATTERNS.filter(p => {
    try { return p.detect(analysis, effCounts); } catch { return false; }
  });
  // A chicken hand is only "chicken" if nothing else matched.
  if (matched.length > 1) return matched.filter(p => p.id !== 'chicken-hand');
  return matched;
}
