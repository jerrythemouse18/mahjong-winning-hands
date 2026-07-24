/**
 * run-tests.js — Minimal Node test harness for the browser globals.
 * Usage: node test/run-tests.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
vm.createContext(ctx);
for (const f of ['tiles.js', 'engine.js', 'patterns.js', 'suggestions.js', 'scoring.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
}

let passed = 0, failed = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}\n    expected ${e}\n    got      ${a}`); }
}

function counts(notation) {
  return ctx.toCounts(ctx.parseHand(notation));
}

console.log('analyzeWin:');
check('standard win', ctx.analyzeWin(counts('123m 456p 789s 234s 55m')).win, true);
check('pong pong win', ctx.analyzeWin(counts('111m 555p 999s EEE 33s')).win, true);
check('thirteen wonders', ctx.analyzeWin(counts('19m 19p 19s ESWN CFP 9s')).kind, 'thirteen-wonders');
check('seven pairs NOT a win (SG rules)', ctx.analyzeWin(counts('11m 33m 55p 77p 99s 22s EE')).win, false);
check('random 14 tiles not a win', ctx.analyzeWin(counts('129m 345p 789s 234s 5m E')).win, false);
check('13 tiles rejected', ctx.analyzeWin(counts('123m 456p 789s 234s 5m')).win, false);

console.log('findWaits:');
check('single wait', ctx.findWaits(counts('123m 456p 789s 234s 5m')).map(ctx.tileNotation), ['5m']);
check('two-sided wait', ctx.findWaits(counts('12m 456m 789m 123p 55s')).map(ctx.tileNotation), ['3m']);
check('open wait 23m', ctx.findWaits(counts('23m 456p 789s 111s 55m')).map(ctx.tileNotation), ['1m', '4m']);
check('13 wonders wait on pair', ctx.findWaits(counts('19m 19p 19s ESWN CFP')).length, 13);
check('no waits when far', ctx.findWaits(counts('147m 258p 369s ESWC')).length, 0);

console.log('patterns:');
const ph = ctx.analyzeWin(counts('123m 456m 567p 789s 22p'));
check('ping hu detected', ctx.matchPatterns(ph, counts('123m 456m 567p 789s 22p')).some(p => p.id === 'ping-hu'), true);
const pp = ctx.analyzeWin(counts('111m 555p 999s EEE 33s'));
check('pong pong detected', ctx.matchPatterns(pp, counts('111m 555p 999s EEE 33s')).some(p => p.id === 'pong-pong'), true);
const ff = ctx.analyzeWin(counts('123m 345m 567m 789m 99m'));
const ffMatch = ctx.matchPatterns(ff, counts('123m 345m 567m 789m 99m'));
check('full flush detected', ffMatch.some(p => p.id === 'full-flush'), true);
check('chicken hand excluded when scoring pattern exists', ffMatch.some(p => p.id === 'chicken-hand'), false);
const ch = ctx.analyzeWin(counts('123m 456p 999s 234s 55m'));
check('chicken hand when nothing else', ctx.matchPatterns(ch, counts('123m 456p 999s 234s 55m')).map(p => p.id), ['chicken-hand']);
const bd = ctx.analyzeWin(counts('123m CCC FFF PPP 55s'));
check('big three dragons', ctx.matchPatterns(bd, counts('123m CCC FFF PPP 55s')).some(p => p.id === 'big-dragons'), true);

console.log('shanten / suggestions:');
check('tenpai hand shanten 0', ctx.standardShanten(counts('123m 456p 789s 234s 5m')), 0);
check('complete hand shanten -1', ctx.standardShanten(counts('123m 456p 789s 234s 55m')), -1);
check('suggestions ranked', ctx.suggestPatterns(counts('123m 555m 789m EE'))[0].distance <= 2, true);
const sugg = ctx.suggestPatterns(counts('111m 222m 333m EE'));
check('flush suggested for one-suit hand', sugg.slice(0, 3).some(s => s.pattern.id.includes('flush')), true);

console.log('discard advisor:');
{
  // 14 tiles, one obvious floater: lone E among 3 chows + 2-3s partial + 5m pair.
  const c = counts('123m 456p 789s 23s 55m E');
  const advice = ctx.adviseDiscards(c);
  check('best discard is the floater', ctx.tileNotation(advice[0].tile), 'E');
  check('best discard reaches tenpai', advice[0].shanten, 0);
  check('tenpai accepts the two-sided wait', advice[0].acceptedTiles.map(ctx.tileNotation), ['1s', '4s']);
  check('ukeire counts live copies', advice[0].ukeire, 8); // 4× 1s + 4× 4s
  check('hand unchanged after advising', c.reduce((a, b) => a + b, 0), 14);
}

console.log('scoring:');
function mkCtx(over = {}) {
  return { seatWind: 0, roundWind: 0, bonusTiles: new Set(), winContext: new Set(), ...over };
}
{
  const c = counts('123m 456p 999s EEE 55m'); // East pung, seat+round East
  const a = ctx.analyzeWin(c);
  const s = ctx.scoreHand(a, c, mkCtx());
  check('seat + prevailing wind both score', s.total, 2);
}
{
  const c = counts('123m 456p 999s SSS 55m'); // South pung, but seat/round East
  const s = ctx.scoreHand(ctx.analyzeWin(c), c, mkCtx());
  check('non-seat wind pung scores 0', s.total, 0);
}
{
  const c = counts('123m 456p 999s CCC 55m'); // one dragon pung
  const s = ctx.scoreHand(ctx.analyzeWin(c), c, mkCtx());
  check('single dragon pung = 1 tai', s.total, 1);
}
{
  const c = counts('123m CCC FFF PPP 55s'); // big three dragons
  const s = ctx.scoreHand(ctx.analyzeWin(c), c, mkCtx());
  check('big dragons hits limit, pungs not double-counted', s.total, 5);
}
{
  const c = counts('123m 456p 999s EEE 55m');
  const s = ctx.scoreHand(ctx.analyzeWin(c), c,
    mkCtx({ winContext: new Set(['self-draw', 'last-tile']) }));
  check('win-context bonuses add tai', s.total, 4); // 2 winds + 2 context
}
{
  const c = counts('123m 456p 999s 234s 55m'); // chicken shape
  const s = ctx.scoreHand(ctx.analyzeWin(c), c,
    mkCtx({ seatWind: 1, bonusTiles: new Set([1, 8]) })); // own flower (South seat) + cat
  check('own flower + animal = 2 tai', s.total, 2);
}
{
  const s = ctx.scoreBonusTiles(new Set([0, 1, 2, 3]), 0);
  const total = s.reduce((a, i) => a + i.tai, 0);
  check('complete flower set = own flower + set bonus', total, 3); // 1 own + 2 set
}
{
  const c = counts('111m 555p 999s EEE 33s'); // pong pong + seat/round East pungs
  const s = ctx.scoreHand(ctx.analyzeWin(c), c, mkCtx({ winContext: new Set(['self-draw']) }));
  check('raw beyond limit is capped', s.total, 5); // 2+1+1+1 = 5, exactly limit
  check('payout text mentions self-draw', ctx.describePayout(s.total, true).includes('Self-draw'), true);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
