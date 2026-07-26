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

/**
 * Win-context bonuses the player can toggle. `tai: 'limit'` resolves to the
 * table's tai limit (heavenly/earthly hands are automatic limit wins).
 */
const WIN_CONTEXT = [
  { id: 'self-draw', name: 'Self-draw (自摸)', tai: 1 },
  { id: 'concealed', name: 'Fully concealed hand (門前清)', tai: 1 },
  { id: 'last-tile', name: 'Last tile of the wall (海底撈月)', tai: 1 },
  { id: 'kong-replacement', name: 'Win on kong replacement (槓上開花)', tai: 1 },
  { id: 'flower-replacement', name: 'Win on flower replacement (花上自摸)', tai: 1 },
  { id: 'robbing-kong', name: 'Robbing the kong (搶槓)', tai: 1 },
  { id: 'heavenly', name: 'Heavenly hand — dealer wins with opening tiles (天胡)', tai: 'limit' },
  { id: 'earthly', name: 'Earthly hand — win on dealer\'s first discard (地胡)', tai: 'limit' },
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
  const limit = ctx.taiLimit || DEFAULT_TAI_LIMIT;
  const matched = matchPatterns(analysis, counts);
  const hasDragonSet = matched.some(p => p.id === 'little-dragons' || p.id === 'big-dragons');
  for (const p of matched) {
    if (p.id === 'dragon-pung') continue;
    // Limit hands are worth the table's full limit, whatever it is set to.
    items.push({ name: p.name, tai: p.isLimit ? limit : p.tai });
  }
  if (!hasDragonSet) {
    const DRAGON_NAMES = ['Red 中', 'Green 發', 'White 白'];
    for (let i = 0; i < 3; i++) {
      if (counts[31 + i] >= 3) items.push({ name: `Dragon pung (${DRAGON_NAMES[i]})`, tai: 1 });
    }
  }

  // 2. Seat / prevailing wind pungs (stack when the winds coincide).
  //    Skipped when a Four Winds hand already scores the wind pungs.
  const hasWindSet = matched.some(p => p.id === 'little-winds' || p.id === 'big-winds');
  if (!hasWindSet) {
    const seatTile = 27 + ctx.seatWind;
    const roundTile = 27 + ctx.roundWind;
    if (counts[seatTile] >= 3) {
      items.push({ name: `Seat wind pung (${WIND_NAMES[ctx.seatWind]})`, tai: 1 });
    }
    if (counts[roundTile] >= 3) {
      items.push({ name: `Prevailing wind pung (${WIND_NAMES[ctx.roundWind]})`, tai: 1 });
    }
  }

  // 3. Bonus tiles.
  const bonus = scoreBonusTiles(ctx.bonusTiles, ctx.seatWind);
  items.push(...bonus);

  // 4. Win-context bonuses ('limit' resolves to the table's tai limit).
  for (const wc of WIN_CONTEXT) {
    if (ctx.winContext.has(wc.id)) {
      items.push({ name: wc.name, tai: wc.tai === 'limit' ? limit : wc.tai });
    }
  }

  const raw = items.reduce((s, i) => s + i.tai, 0);
  return { items, total: Math.min(raw, limit), raw, limited: raw > limit, limit };
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

/* ---------- money payouts ---------- */

/** Common Singapore stake presets: dollars paid per non-shooter at 1 tai. */
const STAKE_PRESETS = [0.10, 0.20, 0.25, 0.50, 1.00, 2.00];

/**
 * Table-based stake schedules (dollars at 1..5 tai). Some tables quote fixed
 * per-tai amounts instead of the doubling formula — e.g. the common "3/6"
 * ($0.30/$0.60) game. Tai beyond the last entry clamp to it; 0-tai (chicken)
 * hands are not defined in these schedules and pay nothing.
 *
 * perPlayer: what each player pays in 'half' (everyone pays) mode, and what
 *            every player pays on self-draw.
 * shooterAll: what the discarder pays alone in 'shooter' (pays-all) mode.
 */
const STAKE_TABLES = [
  {
    id: 'three-six',
    label: '3/6',
    perPlayer: [2, 3, 5, 10, 20],
    shooterAll: [4, 7, 11, 20, 40],
  },
];

/** Look up a schedule value for a tai count (clamped to the table's range). */
function tableAmount(arr, tai) {
  if (tai <= 0) return 0;
  return arr[Math.min(tai, arr.length) - 1];
}

/** Maximum tai a hand can score. 5 is the common Singapore default; tables vary. */
const DEFAULT_TAI_LIMIT = 5;

/**
 * Bite — instant payouts collected from every player the moment they happen,
 * independent of winning the hand: open kong or animal = 1 tai, hidden
 * (concealed) kong = 2 tai.
 */
const BITE = { open: 1, hidden: 2 };

/**
 * Payment modes:
 *  - 'half'    (half-shooter, common default): everyone pays — the shooter
 *              (whoever discarded the winning tile) pays double, the other
 *              two pay the base rate.
 *  - 'shooter' (full shooter, 全銃): the discarder pays for everyone — the
 *              whole pot alone; the other two pay nothing.
 * Self-draw is the same in both modes: all three pay the doubled rate.
 */
const PAY_MODES = [
  { id: 'half', name: 'Everyone pays (half-shooter)' },
  { id: 'shooter', name: 'Shooter pays all (全銃)' },
];

/**
 * Payment doubles with each tai: the per-player unit is base × 2^(tai−1).
 * 0 tai (chicken hand) works out to half the base — where the table pays it.
 * Returns what each seat pays on a discard win under the given mode, plus
 * what each of the three players pays on self-draw. `selfDrawBonus` is a
 * house extra added on top of every player's self-draw payment.
 *
 * When `stakeTable` (an entry from STAKE_TABLES) is given it replaces the
 * doubling formula: in 'half' mode all three players pay the per-player
 * schedule (no shooter doubling); in 'shooter' mode the discarder pays the
 * shooter schedule alone. Self-draw always uses the per-player schedule.
 */
function payoutAmounts(tai, base, mode = 'half', selfDrawBonus = 0, stakeTable = null) {
  if (stakeTable) {
    const each = tableAmount(stakeTable.perPlayer, tai);
    const selfDrawEach = each + selfDrawBonus;
    if (mode === 'shooter') {
      const pot = tableAmount(stakeTable.shooterAll, tai);
      return { nonShooter: 0, shooter: pot, selfDrawEach, selfDrawTotal: selfDrawEach * 3, total: pot };
    }
    return { nonShooter: each, shooter: each, selfDrawEach, selfDrawTotal: selfDrawEach * 3, total: each * 3 };
  }
  const unit = base * Math.pow(2, tai - 1);
  const pot = unit * 4; // shooter double + two non-shooters
  const selfDrawEach = unit * 2 + selfDrawBonus;
  if (mode === 'shooter') {
    return { nonShooter: 0, shooter: pot, selfDrawEach, selfDrawTotal: selfDrawEach * 3, total: pot };
  }
  return { nonShooter: unit, shooter: unit * 2, selfDrawEach, selfDrawTotal: selfDrawEach * 3, total: pot };
}

function fmtMoney(x) {
  return '$' + (Math.round(x * 100) / 100).toFixed(2);
}

/** Payout description for the current mode and stake. */
function describePayout(total, selfDraw, base, mode = 'half', selfDrawBonus = 0, stakeTable = null) {
  const p = payoutAmounts(total, base, mode, selfDrawBonus, stakeTable);
  if (selfDraw) {
    const bonusNote = selfDrawBonus > 0 ? ` (includes ${fmtMoney(selfDrawBonus)} self-draw bonus each)` : '';
    return `Self-draw: all three players pay ${fmtMoney(p.selfDrawEach)} each — ${fmtMoney(p.selfDrawTotal)} total${bonusNote}.`;
  }
  if (mode === 'shooter') {
    return `By discard: the shooter pays for everyone — ${fmtMoney(p.shooter)} total; the other two pay nothing.`;
  }
  if (stakeTable) {
    return `By discard: all three players pay ${fmtMoney(p.nonShooter)} each — ${fmtMoney(p.total)} total.`;
  }
  return `By discard: the shooter pays ${fmtMoney(p.shooter)}, the other two pay ${fmtMoney(p.nonShooter)} each — ${fmtMoney(p.total)} total.`;
}
