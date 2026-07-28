/**
 * tracker.js — Game tracker tab: winds, rounds, and winner recording.
 *
 * Follows a real Singapore mahjong session:
 *  - Tracks prevailing wind (東南西北 rounds) and the dealer (庄) seat.
 *  - Each hand is recorded with: winner (or draw), tai, and how they won —
 *    self-draw or by discard (with the shooter identified).
 *  - Dealer rules: the dealer repeats on a dealer win or a draw; otherwise
 *    the deal passes right. When the deal returns to seat 1, the prevailing
 *    wind advances.
 *  - Keeps per-player running totals (wins, tai, times shot).
 *  - Persists to localStorage so a session survives a page reload.
 */

const TRACKER_STORAGE_KEY = 'mahjong-tracker-v1';
const TRACKER_WINDS = ['East 東', 'South 南', 'West 西', 'North 北'];

/** Bite events: instant payouts collected from every player mid-hand. */
const TRACKER_BITE_TYPES = [
  { id: 'animal', label: 'Animal 動物', tai: 1 },
  { id: 'open-kong', label: 'Open kong 明槓', tai: 1 },
  { id: 'hidden-kong', label: 'Hidden kong 暗槓', tai: 2 },
];

const tracker = {
  players: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
  prevailingWind: 0, // 0..3 index into TRACKER_WINDS
  dealerSeat: 0,     // 0..3 whose deal it is
  handNumber: 1,     // running count of hands played
  history: [],       // hand entries {kind:'hand', hand, wind, dealerSeat, winner, tai, how, shooter}
                     // and bite entries {kind:'bite', hand, wind, player, type, tai}
  // stakes for money settlement (mirrors the analyzer's scheme)
  stakes: { stake: 0.20, stakeTableId: null, payMode: 'half', selfDrawBonus: 0 },
  // entries-in-progress
  draft: { winner: null, tai: null, how: null, shooter: null },
  biteDraft: { player: null, type: null },
};

/* ---------- persistence ---------- */

function trackerSave() {
  try {
    const { draft, biteDraft, ...data } = tracker;
    localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(data));
  } catch (e) { /* private mode etc. — tracking still works, just not persisted */ }
}

function trackerLoad() {
  try {
    const raw = localStorage.getItem(TRACKER_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.players) && data.players.length === 4) tracker.players = data.players;
    if (Number.isInteger(data.prevailingWind)) tracker.prevailingWind = data.prevailingWind;
    if (Number.isInteger(data.dealerSeat)) tracker.dealerSeat = data.dealerSeat;
    if (Number.isInteger(data.handNumber)) tracker.handNumber = data.handNumber;
    if (Array.isArray(data.history)) {
      // Migrate entries saved before bite support: hands lacked a kind field.
      tracker.history = data.history.map(e => e.kind ? e : { ...e, kind: 'hand' });
    }
    if (data.stakes && typeof data.stakes === 'object') {
      tracker.stakes = { ...tracker.stakes, ...data.stakes };
    }
  } catch (e) { /* corrupted storage — start fresh */ }
}

/* ---------- game logic ---------- */

/**
 * Record the hand described by the draft, then advance dealer/wind.
 * how: 'self-draw' | 'discard' | 'draw' (no winner).
 */
function trackerRecordHand() {
  const d = tracker.draft;
  const entry = {
    kind: 'hand',
    hand: tracker.handNumber,
    wind: tracker.prevailingWind,
    dealerSeat: tracker.dealerSeat,
    winner: d.how === 'draw' ? null : d.winner,
    tai: d.how === 'draw' ? null : d.tai,
    how: d.how,
    shooter: d.how === 'discard' ? d.shooter : null,
  };
  tracker.history.push(entry);
  tracker.handNumber++;

  // Dealer repeats on a dealer win or a drawn hand; otherwise deal passes right.
  const dealerStays = d.how === 'draw' || (entry.winner !== null && entry.winner === tracker.dealerSeat);
  if (!dealerStays) {
    tracker.dealerSeat = (tracker.dealerSeat + 1) % 4;
    // Deal returning to seat 0 completes the round: prevailing wind advances.
    if (tracker.dealerSeat === 0) {
      tracker.prevailingWind = (tracker.prevailingWind + 1) % 4;
    }
  }

  tracker.draft = { winner: null, tai: null, how: null, shooter: null };
  trackerSave();
}

/**
 * Record a bite (animal / open kong / hidden kong) during the current hand.
 * Bites pay immediately from every other player and don't advance the deal.
 */
function trackerRecordBite() {
  const b = tracker.biteDraft;
  const type = TRACKER_BITE_TYPES.find(t => t.id === b.type);
  if (b.player === null || !type) return;
  tracker.history.push({
    kind: 'bite',
    hand: tracker.handNumber, // happens during this hand
    wind: tracker.prevailingWind,
    player: b.player,
    type: type.id,
    tai: type.tai,
  });
  tracker.biteDraft = { player: null, type: null };
  trackerSave();
}

/** Undo the last entry. Bites only pop; hands also restore dealer/wind. */
function trackerUndo() {
  const last = tracker.history.pop();
  if (!last) return;
  if (last.kind === 'hand') {
    tracker.handNumber = last.hand;
    tracker.dealerSeat = last.dealerSeat;
    tracker.prevailingWind = last.wind;
  }
  trackerSave();
}

function trackerReset() {
  tracker.prevailingWind = 0;
  tracker.dealerSeat = 0;
  tracker.handNumber = 1;
  tracker.history = [];
  tracker.draft = { winner: null, tai: null, how: null, shooter: null };
  tracker.biteDraft = { player: null, type: null };
  trackerSave();
}

/** Per-player totals: wins, tai won, times shot, self-draws, bites and bite tai. */
function trackerTotals() {
  const totals = tracker.players.map(() => ({ wins: 0, tai: 0, shot: 0, selfDraws: 0, bites: 0, biteTai: 0 }));
  for (const e of tracker.history) {
    if (e.kind === 'bite') {
      totals[e.player].bites++;
      totals[e.player].biteTai += e.tai;
      continue;
    }
    if (e.winner === null) continue;
    totals[e.winner].wins++;
    totals[e.winner].tai += e.tai || 0;
    if (e.how === 'self-draw') totals[e.winner].selfDraws++;
    if (e.shooter !== null) totals[e.shooter].shot++;
  }
  return totals;
}

/** Resolve the tracker's stake-table id to a STAKE_TABLES entry (or null). */
function trackerStakeTable() {
  return STAKE_TABLES.find(t => t.id === tracker.stakes.stakeTableId) || null;
}

/**
 * Per-player money flow, derived from history + current stakes.
 * Returns [{net}] in dollars (positive = winning). Uses the analyzer's
 * payoutAmounts scheme: self-draw = every other player pays the doubled
 * rate (+bonus); discard = shooter/non-shooter split by pay mode; bites =
 * every other player pays the per-player rate for the bite's tai.
 */
function trackerMoney() {
  const s = tracker.stakes;
  const table = trackerStakeTable();
  const net = tracker.players.map(() => 0);
  for (const e of tracker.history) {
    if (e.kind === 'bite') {
      const each = payoutAmounts(e.tai, s.stake, 'half', 0, table).nonShooter;
      for (let i = 0; i < 4; i++) {
        if (i === e.player) net[i] += each * 3;
        else net[i] -= each;
      }
      continue;
    }
    if (e.winner === null) continue; // drawn hand — no money moves
    const p = payoutAmounts(e.tai, s.stake, s.payMode, s.selfDrawBonus, table);
    if (e.how === 'self-draw') {
      for (let i = 0; i < 4; i++) {
        if (i === e.winner) net[i] += p.selfDrawTotal;
        else net[i] -= p.selfDrawEach;
      }
    } else {
      // Discard win: shooter pays p.shooter, the other two pay p.nonShooter.
      for (let i = 0; i < 4; i++) {
        if (i === e.winner) net[i] += p.total;
        else if (i === e.shooter) net[i] -= p.shooter;
        else net[i] -= p.nonShooter;
      }
    }
  }
  return net;
}

/** Is the draft complete enough to record? */
function trackerDraftReady() {
  const d = tracker.draft;
  if (d.how === 'draw') return true;
  if (d.winner === null || d.tai === null || d.how === null) return false;
  if (d.how === 'discard' && (d.shooter === null || d.shooter === d.winner)) return false;
  return true;
}
