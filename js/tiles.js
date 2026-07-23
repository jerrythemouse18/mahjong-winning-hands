/**
 * tiles.js — Tile definitions and helpers.
 *
 * The 34 distinct mahjong tile types are indexed 0..33:
 *   0–8   Characters (萬 / man)  1m–9m
 *   9–17  Dots       (筒 / pin)  1p–9p
 *   18–26 Bamboo     (條 / sou)  1s–9s
 *   27–30 Winds: East 東, South 南, West 西, North 北
 *   31–33 Dragons: Red 中, Green 發, White 白
 */

const SUITS = [
  { key: 'm', name: 'Characters', symbol: '萬', cssClass: 'suit-man' },
  { key: 'p', name: 'Dots', symbol: '筒', cssClass: 'suit-pin' },
  { key: 's', name: 'Bamboo', symbol: '條', cssClass: 'suit-sou' },
];

const HONORS = [
  { key: 'E', name: 'East Wind', symbol: '東', cssClass: 'honor-wind' },
  { key: 'S', name: 'South Wind', symbol: '南', cssClass: 'honor-wind' },
  { key: 'W', name: 'West Wind', symbol: '西', cssClass: 'honor-wind' },
  { key: 'N', name: 'North Wind', symbol: '北', cssClass: 'honor-wind' },
  { key: 'C', name: 'Red Dragon', symbol: '中', cssClass: 'honor-red' },
  { key: 'F', name: 'Green Dragon', symbol: '發', cssClass: 'honor-green' },
  { key: 'P', name: 'White Dragon', symbol: '白', cssClass: 'honor-white' },
];

const TILE_COUNT = 34;

function isSuited(id) { return id < 27; }
function isHonor(id) { return id >= 27; }
function suitOf(id) { return Math.floor(id / 9); } // 0=man, 1=pin, 2=sou (suited only)
function rankOf(id) { return (id % 9) + 1; }       // 1..9 (suited only)

/** Terminal (1 or 9 of a suit) or honor tile — used by Thirteen Orphans etc. */
function isTerminalOrHonor(id) {
  return isHonor(id) || rankOf(id) === 1 || rankOf(id) === 9;
}

/** Human/short notation for a tile id, e.g. "5m", "E", "C". */
function tileNotation(id) {
  if (isSuited(id)) return rankOf(id) + SUITS[suitOf(id)].key;
  return HONORS[id - 27].key;
}

/** Display info for rendering a tile face. */
function tileFace(id) {
  if (isSuited(id)) {
    const s = SUITS[suitOf(id)];
    return { main: String(rankOf(id)), sub: s.symbol, cssClass: s.cssClass, label: `${rankOf(id)} ${s.name}` };
  }
  const h = HONORS[id - 27];
  return { main: h.symbol, sub: '', cssClass: h.cssClass, label: h.name };
}

/** Parse notation like "123m 456p 789s EEE CC" into an array of tile ids. */
function parseHand(str) {
  const ids = [];
  let digits = [];
  for (const ch of str.replace(/\s+/g, '')) {
    if (/[1-9]/.test(ch)) {
      digits.push(Number(ch));
    } else if ('mps'.includes(ch)) {
      const suit = { m: 0, p: 1, s: 2 }[ch];
      for (const d of digits) ids.push(suit * 9 + (d - 1));
      digits = [];
    } else {
      const hi = HONORS.findIndex(h => h.key === ch);
      if (hi >= 0) ids.push(27 + hi);
    }
  }
  return ids;
}

/** Convert a list of tile ids into a counts array of length 34. */
function toCounts(ids) {
  const counts = new Array(TILE_COUNT).fill(0);
  for (const id of ids) counts[id]++;
  return counts;
}
