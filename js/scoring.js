/**
 * scoring.js — Full tai (台) calculation for Singapore mahjong.
 *
 * Combines: hand patterns (patterns.js) + seat/prevailing wind pungs +
 * flower/season/animal bonus tiles + win-context bonuses (self-draw etc.).
 * Values are common Singapore conventions; house rules vary.
 */

/** Bonus tiles sit outside the 14-tile hand. Ids 0..11 in their own space. */
const BONUS_TILES = [
  { id: 0, group: 'flower', name: 'Plum 梅', symbol: '梅', matchesSeat: 0 },   // East seat = #1
  { id: 1, group: 'flower', name: 'Orchid 蘭', symbol: '蘭', matchesSeat: 1 },
  { id: 2, group: 'flower', name: 'Chrysanthemum 菊', symbol: '菊', matchesSeat: 2 },
  { id: 3, group: 'flower', name: 'Bamboo 竹', symbol: '竹', matchesSeat: 3 },
  { id: 4, group: 'season', name: 'Spring 春', symbol: '春', matchesSeat: 0 },
  { id: 5, group: 'season', name: 'Summer 夏', symbol: '夏', matchesSeat: 1 },
  { id: 6, group: 'season', name: 'Autumn 秋', symbol: '秋', matchesSeat: 2 },
  { id: 7, group: 'season', name: 'Winter 冬', symbol: '冬', matchesSeat: 3 },
  { id: 8, group: 'animal', name: 'Cat 貓', symbol: '貓' },
  { id: 9, group: 'animal', name: 'Mouse 老鼠', symbol: '鼠' },
  { id: 10, group: 'animal', name: 'Rooster 公雞', symbol: '雞' },
  { id: 11, group: 'animal', name: 'Centipede 蜈蚣', symbol: '蜈' },
];

/** Win-context bonuses the player can toggle. 1 tai each. */
const WIN_CONTEXT = [
  { id: 'self-draw', name: 'Self-draw (自摸)', tai: 1 },
  { id: 'last-tile', name: 'Last tile of the wall (海底撈月)', tai: 1 },
  { id: 'kong-replacement', name: 'Win on kong replacement (槓上開花)', tai: 1 },
  { id: 'robbing-kong', name: 'Robbing the kong (搶槓)', tai: 1 },
];

const WIND_NAMES = ['East 東', 'South 南', 'West 西', 'North 北'];

/**
 * Compute the full tai breakdown for a winning hand.
 *
 * @param analysis  result of analyzeWin (must be a win)
 * @param counts    the 14-tile counts array
 * @param ctx       { seatWind: 0-3, roundWind: 0-3, bonusTiles: Set<int>, winContext: Set<string> }
 * @returns { items: [{name, tai}], total, limited }
 */
function scoreHand(analysis, counts, ctx) {
  const items = [];

  // 1. Hand patterns (chicken hand contributes its 0 so the breakdown shows it).
  //    Dragon pungs are scored per-pung below, and Little/Big Three Dragons
  //    already include their pungs' value — so skip the generic pattern here.
  const matched = matchPatterns(analysis, counts);
  const hasDragonSet = matched.some(p => p.id === 'little-dragons' || p.id === 'big-dragons');
  for (const p of matched) {
    if (p.id === 'dragon-pung') continue;
    items.push({ name: p.name, tai: p.tai });
  }
  if (!hasDragonSet) {
    const DRAGON_NAMES = ['Red 中', 'Green 發', 'White 白'];
    for (let i = 0; i < 3; i++) {
      if (counts[31 + i] >= 3) items.push({ name: `Dragon pung (${DRAGON_NAMES[i]})`, tai: 1 });
    }
  }

  // 2. Seat / prevailing wind pungs (stack when the winds coincide).
  const seatTile = 27 + ctx.seatWind;
  const roundTile = 27 + ctx.roundWind;
  if (counts[seatTile] >= 3) {
    items.push({ name: `Seat wind pung (${WIND_NAMES[ctx.seatWind]})`, tai: 1 });
  }
  if (counts[roundTile] >= 3) {
    items.push({ name: `Prevailing wind pung (${WIND_NAMES[ctx.roundWind]})`, tai: 1 });
  }

  // 3. Bonus tiles.
  const bonus = scoreBonusTiles(ctx.bonusTiles, ctx.seatWind);
  items.push(...bonus);

  // 4. Win-context bonuses.
  for (const wc of WIN_CONTEXT) {
    if (ctx.winContext.has(wc.id)) items.push({ name: wc.name, tai: wc.tai });
  }

  const raw = items.reduce((s, i) => s + i.tai, 0);
  const LIMIT = 5;
  return { items, total: Math.min(raw, LIMIT), raw, limited: raw > LIMIT, limit: LIMIT };
}

/** Tai from flowers/seasons/animals alone (also shown pre-win). */
function scoreBonusTiles(bonusSet, seatWind) {
  const items = [];
  let flowers = 0, seasons = 0, animals = 0;
  for (const id of bonusSet) {
    const b = BONUS_TILES[id];
    if (b.group === 'flower') flowers++;
    if (b.group === 'season') seasons++;
    if (b.group === 'animal') animals++;
    if (b.group !== 'animal' && b.matchesSeat === seatWind) {
      items.push({ name: `Own ${b.group} (${b.name})`, tai: 1 });
    }
    if (b.group === 'animal') {
      items.push({ name: `Animal (${b.name})`, tai: 1 });
    }
  }
  if (flowers === 4) items.push({ name: 'Complete flower set (花糊)', tai: 2 });
  if (seasons === 4) items.push({ name: 'Complete season set', tai: 2 });
  if (animals === 4) items.push({ name: 'All four animals', tai: 2 });
  return items;
}

/**
 * Payout description under the common Singapore half/full scheme:
 * win by discard → discarder pays full, others half; self-draw → all pay full.
 * Payout unit doubles per tai: full = 2^tai base units.
 */
function describePayout(total, selfDraw) {
  const full = Math.pow(2, total);
  const half = full / 2;
  if (selfDraw) {
    return `Self-draw: all three players pay full — ${full} unit${full === 1 ? '' : 's'} each (2^${total}).`;
  }
  return `By discard: discarder pays ${full} unit${full === 1 ? '' : 's'} (full), the other two pay ${half} each (half). Base unit is whatever your table stakes.`;
}
