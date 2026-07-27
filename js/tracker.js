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

const tracker = {
  players: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
  prevailingWind: 0, // 0..3 index into TRACKER_WINDS
  dealerSeat: 0,     // 0..3 whose deal it is
  handNumber: 1,     // running count of hands played
  history: [],       // [{hand, wind, dealerSeat, winner, tai, how, shooter}]
  // entry-in-progress
  draft: { winner: null, tai: null, how: null, shooter: null },
};

/* ---------- persistence ---------- */

function trackerSave() {
  try {
    const { draft, ...data } = tracker;
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
    if (Array.isArray(data.history)) tracker.history = data.history;
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

/** Undo the last recorded hand, restoring dealer/wind from the entry. */
function trackerUndo() {
  const last = tracker.history.pop();
  if (!last) return;
  tracker.handNumber = last.hand;
  tracker.dealerSeat = last.dealerSeat;
  tracker.prevailingWind = last.wind;
  trackerSave();
}

function trackerReset() {
  tracker.prevailingWind = 0;
  tracker.dealerSeat = 0;
  tracker.handNumber = 1;
  tracker.history = [];
  tracker.draft = { winner: null, tai: null, how: null, shooter: null };
  trackerSave();
}

/** Per-player totals: wins, total tai won, times they shot the winner. */
function trackerTotals() {
  const totals = tracker.players.map(() => ({ wins: 0, tai: 0, shot: 0, selfDraws: 0 }));
  for (const e of tracker.history) {
    if (e.winner === null) continue;
    totals[e.winner].wins++;
    totals[e.winner].tai += e.tai || 0;
    if (e.how === 'self-draw') totals[e.winner].selfDraws++;
    if (e.shooter !== null) totals[e.shooter].shot++;
  }
  return totals;
}

/** Is the draft complete enough to record? */
function trackerDraftReady() {
  const d = tracker.draft;
  if (d.how === 'draw') return true;
  if (d.winner === null || d.tai === null || d.how === null) return false;
  if (d.how === 'discard' && (d.shooter === null || d.shooter === d.winner)) return false;
  return true;
}
