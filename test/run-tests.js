/**
 * run-tests.js — Minimal Node test harness for the browser globals.
 * Usage: node test/run-tests.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
vm.createContext(ctx);
for (const f of ['tiles.js', 'engine.js', 'patterns.js', 'suggestions.js', 'safety.js', 'scoring.js', 'practice.js']) {
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

console.log('kong support:');
{
  const K = s => ctx.parseHand(s);
  // 1 kong + 3 sets + pair from 11 tiles = win.
  const c1 = counts('123m 456p 789s 55m');
  const a1 = ctx.analyzeWin(c1, K('C'));
  check('win with one kong', a1.win, true);
  check('kong folded into decomposition', a1.decomposition.sets.length, 4);
  // Same 11 tiles without the kong are not a win.
  check('11 tiles alone not a win', ctx.analyzeWin(c1).win, false);
  // Wrong tile count with kong rejected.
  check('14 tiles + kong rejected', ctx.analyzeWin(counts('123m 456p 789s 234s 55m'), K('C')).win, false);
  // Dragon kong scores dragon pung tai.
  const s1 = ctx.scoreHand(a1, c1, { seatWind: 1, roundWind: 1, bonusTiles: new Set(), winContext: new Set() });
  check('dragon kong earns dragon pung tai', s1.items.some(i => i.name.includes('Dragon pung')), true);
  // Pong pong with a kong: kong counts as a pung.
  const c2 = counts('111m 555p EEE 33s');
  const a2 = ctx.analyzeWin(c2, K('N'));
  check('pong pong with kong detected',
    ctx.matchPatterns(a2, c2).some(p => p.id === 'pong-pong'), true);
  // Full flush not broken by same-suit kong.
  const c3 = counts('123m 345m 789m 99m');
  const a3 = ctx.analyzeWin(c3, K('6m').slice(0, 1));
  check('flush with same-suit kong', ctx.matchPatterns(a3, c3).some(p => p.id === 'full-flush'), true);
  // Eighteen Arhats: 4 kongs + pair.
  const c4 = counts('55m');
  const a4 = ctx.analyzeWin(c4, K('CFPE'));
  check('eighteen arhats detected', ctx.matchPatterns(a4, c4).some(p => p.id === 'eighteen-arhats'), true);
  const s4 = ctx.scoreHand(a4, c4, { seatWind: 1, roundWind: 1, bonusTiles: new Set(), winContext: new Set(), taiLimit: 8 });
  check('eighteen arhats scores custom limit', s4.total, 8);
  // Waits with a kong: 10 tiles waiting.
  const c5 = counts('123m 456p 789s 5m');
  check('waits with kong', ctx.findWaits(c5, K('C')).map(ctx.tileNotation), ['5m']);
  // Thirteen wonders can't have kongs.
  const c6 = counts('19m 19p 19s ESWN CF');
  check('13 wonders invalid with kong', ctx.analyzeWin(c6, K('P')).win, false);
}

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
  check('payout text mentions self-draw', ctx.describePayout(s.total, true, 0.20).includes('Self-draw'), true);
}

console.log('custom tai limit:');
{
  const c = counts('111m 555p 999s EEE 33s'); // raw 5 tai with self-draw (2+1+1+1)
  const s = ctx.scoreHand(ctx.analyzeWin(c), c,
    mkCtx({ winContext: new Set(['self-draw']), taiLimit: 3 }));
  check('lower limit caps the total', s.total, 3);
  check('capped result reports raw value', s.raw, 5);
  check('score carries the configured limit', s.limit, 3);
  const s10 = ctx.scoreHand(ctx.analyzeWin(c), c,
    mkCtx({ winContext: new Set(['self-draw']), taiLimit: 10 }));
  check('higher limit uncaps the total', s10.total, 5);
}
{
  const c = counts('123m CCC FFF PPP 55s'); // big three dragons (limit hand)
  const s8 = ctx.scoreHand(ctx.analyzeWin(c), c, mkCtx({ taiLimit: 8 }));
  check('limit hand scores the full custom limit', s8.total, 8);
  const s5 = ctx.scoreHand(ctx.analyzeWin(c), c, mkCtx());
  check('limit hand still 5 at default limit', s5.total, 5);
}

console.log('money payouts:');
{
  const p1 = ctx.payoutAmounts(1, 0.20);
  check('1 tai at 20¢: non-shooter pays base', p1.nonShooter, 0.20);
  check('1 tai at 20¢: shooter pays double', p1.shooter, 0.40);
  const p3 = ctx.payoutAmounts(3, 0.20);
  check('3 tai doubles per tai (0.20 → 0.80)', p3.nonShooter, 0.80);
  const p0 = ctx.payoutAmounts(0, 0.20);
  check('0 tai (chicken) is half the base', p0.nonShooter, 0.10);
  const p5 = ctx.payoutAmounts(5, 0.50);
  check('5 tai at 50¢: non-shooter $8', p5.nonShooter, 8);
  check('5 tai at 50¢: shooter $16', p5.shooter, 16);
  check('bite: open = 1 tai', vm.runInContext('BITE.open', ctx), 1);
  check('bite: hidden = 2 tai', vm.runInContext('BITE.hidden', ctx), 2);
  check('money formatting', ctx.fmtMoney(0.8), '$0.80');
  check('discard payout text splits shooter/non-shooter',
    ctx.describePayout(2, false, 0.20).includes('shooter pays $0.80') &&
    ctx.describePayout(2, false, 0.20).includes('$0.40 each'), true);
}

console.log('shooter mode:');
{
  // User's example: 1 tai at $1 base → shooter pays the whole $4 pot.
  const p = ctx.payoutAmounts(1, 1.00, 'shooter');
  check('1 tai at $1: shooter pays $4 total', p.shooter, 4);
  check('1 tai at $1: non-shooters pay nothing', p.nonShooter, 0);
  check('winner collects the same pot in both modes',
    p.total, ctx.payoutAmounts(1, 1.00, 'half').total);
  const h = ctx.payoutAmounts(1, 1.00, 'half');
  check('half mode: shooter $2, non-shooter $1', [h.shooter, h.nonShooter], [2, 1]);
  check('self-draw identical in both modes',
    ctx.payoutAmounts(3, 0.20, 'shooter').selfDrawEach,
    ctx.payoutAmounts(3, 0.20, 'half').selfDrawEach);
  check('shooter-mode payout text says pays for everyone',
    ctx.describePayout(1, false, 1.00, 'shooter').includes('pays for everyone — $4.00 total'), true);
  check('self-draw text unaffected by shooter mode',
    ctx.describePayout(1, true, 1.00, 'shooter').includes('$2.00 each'), true);
}

console.log('new SG patterns:');
function patternIds(notation) {
  const c = counts(notation);
  return ctx.matchPatterns(ctx.analyzeWin(c), c).map(p => p.id);
}
{
  check('little four winds', patternIds('EEE SSS WWW NN 123m').includes('little-winds'), true);
  check('big four winds', patternIds('EEE SSS WWW NNN 55m').includes('big-winds'), true);
  check('big winds is not little winds', patternIds('EEE SSS WWW NNN 55m').includes('little-winds'), false);
  check('mixed terminals', patternIds('111m 999p 111s EEE 99s').includes('mixed-terminals'), true);
  check('pure terminals', patternIds('111m 999m 111p 999s 99p').includes('pure-terminals'), true);
  check('pure terminals is not mixed', patternIds('111m 999m 111p 999s 99p').includes('mixed-terminals'), false);
  check('all honors is not mixed terminals', patternIds('EEE SSS WWW CCC FF').includes('mixed-terminals'), false);
  check('nine gates (win on 5m)', patternIds('111m 2345m 5m 678m 999m').includes('nine-gates'), true);
  check('nine gates pure win on 9m', patternIds('111m 2345678m 9999m').includes('nine-gates'), true);
  check('full flush alone is not nine gates', patternIds('123m 345m 567m 789m 99m').includes('nine-gates'), false);
  check('two-suit hand is not nine gates', patternIds('111m 2345678m 999m 11p').includes('nine-gates'), false);
}
{
  // Big Four Winds must not stack seat/prevailing wind pung tai on top.
  const c = counts('EEE SSS WWW NNN 55m');
  const s = ctx.scoreHand(ctx.analyzeWin(c), c, mkCtx()); // seat+round East
  check('four winds: no wind-pung double count',
    s.items.some(i => i.name.includes('Seat wind')), false);
  check('big four winds scores the limit', s.total, 5);
  const s8 = ctx.scoreHand(ctx.analyzeWin(c), c, mkCtx({ taiLimit: 8 }));
  check('big four winds scales with custom limit', s8.total, 8);
  // Normal hand with a wind pung still gets seat tai.
  const c2 = counts('123m 456p 999s EEE 55m');
  const s2 = ctx.scoreHand(ctx.analyzeWin(c2), c2, mkCtx());
  check('normal wind pung still scores seat tai',
    s2.items.some(i => i.name.includes('Seat wind')), true);
}
{
  // Limit-valued win-context bonuses.
  const c = counts('123m 456p 999s 234s 55m');
  const s = ctx.scoreHand(ctx.analyzeWin(c), c, mkCtx({ winContext: new Set(['heavenly']) }));
  check('heavenly hand = limit', s.total, 5);
  const s8 = ctx.scoreHand(ctx.analyzeWin(c), c,
    mkCtx({ winContext: new Set(['earthly']), taiLimit: 8 }));
  check('earthly hand scales with custom limit', s8.total, 8);
  const sc = ctx.scoreHand(ctx.analyzeWin(c), c, mkCtx({ winContext: new Set(['concealed']) }));
  check('concealed hand = 1 tai', sc.total, 1);
  const sf = ctx.scoreHand(ctx.analyzeWin(c), c, mkCtx({ winContext: new Set(['flower-replacement']) }));
  check('flower replacement = 1 tai', sf.total, 1);
}

console.log('pattern-targeted discards:');
{
  // Hand leaning half-flush in man + East pungs, with one stray dot tile.
  const c = counts('123m 555m 789m EEE 5p 9s');
  const throwsHF = ctx.bestDiscardsForPattern(c, 'half-flush').map(ctx.tileNotation);
  check('half flush: throw the off-suit tiles', throwsHF.sort(), ['5p', '9s']);
  check('hand unchanged after targeting', c.reduce((a, b) => a + b, 0), 14);
  // Chasing pong pong from a mostly-pairs hand: the lone chow tiles go first.
  const c2 = counts('11m 55p 99s EE CC 123m 4s');
  const throwsPP = ctx.bestDiscardsForPattern(c2, 'pong-pong');
  check('pong pong: throws suggested', throwsPP.length > 0, true);
  check('pong pong: keeps the pairs', throwsPP.every(t => c2[t] === 1), true);
  // Thirteen wonders: throw a middle tile, never a terminal/honor you hold once.
  const c3 = counts('19m 19p 19s ESWN CF 5m 5m');
  const throws13 = ctx.bestDiscardsForPattern(c3, 'thirteen-wonders').map(ctx.tileNotation);
  check('thirteen wonders: throw the middle tile', throws13, ['5m']);
}

console.log('self-draw bonus:');
{
  // User's table: $2 extra from each player on self-draw.
  const p = ctx.payoutAmounts(1, 1.00, 'half', 2.00);
  check('self-draw each = doubled rate + bonus', p.selfDrawEach, 4); // 2 + 2
  check('self-draw total = 3 players', p.selfDrawTotal, 12);
  check('discard amounts unaffected by bonus', [p.nonShooter, p.shooter, p.total], [1, 2, 4]);
  const ps = ctx.payoutAmounts(1, 1.00, 'shooter', 2.00);
  check('bonus applies in shooter mode too', ps.selfDrawEach, 4);
  const p0 = ctx.payoutAmounts(1, 1.00, 'half');
  check('no bonus by default', p0.selfDrawEach, 2);
  check('payout text mentions the bonus',
    ctx.describePayout(1, true, 1.00, 'half', 2.00).includes('$2.00 self-draw bonus each'), true);
  check('payout text total includes bonus',
    ctx.describePayout(1, true, 1.00, 'half', 2.00).includes('$12.00 total'), true);
}

console.log('3/6 stake table:');
{
  const t36 = vm.runInContext('STAKE_TABLES[0]', ctx);
  check('table id', t36.id, 'three-six');
  // Shooter mode: discarder pays 4/7/11/20/40 alone.
  const s1 = ctx.payoutAmounts(1, 0.20, 'shooter', 0, t36);
  check('3/6 shooter 1 tai: $4 alone', [s1.shooter, s1.nonShooter, s1.total], [4, 0, 4]);
  check('3/6 shooter 3 tai: $11', ctx.payoutAmounts(3, 0.20, 'shooter', 0, t36).shooter, 11);
  check('3/6 shooter 5 tai: $40', ctx.payoutAmounts(5, 0.20, 'shooter', 0, t36).shooter, 40);
  // Everyone-pays mode: doubling formula on the table's 30¢ base.
  const h1 = ctx.payoutAmounts(1, 0.20, 'half', 0, t36);
  check('30¢ half 1 tai: 30¢ / 60¢', [h1.nonShooter, h1.shooter, h1.total], [0.30, 0.60, 1.20]);
  const h2 = ctx.payoutAmounts(2, 0.20, 'half', 0, t36);
  check('30¢ half 2 tai: 60¢ / $1.20, $2.40 total', [h2.nonShooter, h2.shooter, h2.total], [0.60, 1.20, 2.40]);
  check('30¢ half 4 tai: $2.40 each', ctx.payoutAmounts(4, 0.20, 'half', 0, t36).nonShooter, 2.40);
  check('30¢ half ignores analyzer base', ctx.payoutAmounts(1, 99, 'half', 0, t36).nonShooter, 0.30);
  check('table renamed to 30¢', t36.label, '30¢');
  // Self-draw: everyone pays the per-player schedule (both modes).
  check('3/6 self-draw 1 tai: $2 each', ctx.payoutAmounts(1, 0.20, 'shooter', 0, t36).selfDrawEach, 2);
  check('3/6 self-draw 5 tai: $20 each, $60 total',
    ctx.payoutAmounts(5, 0.20, 'half', 0, t36).selfDrawTotal, 60);
  check('3/6 self-draw bonus still adds', ctx.payoutAmounts(1, 0.20, 'half', 2, t36).selfDrawEach, 4);
  // Edge behaviour.
  check('30¢ half chicken = half base like presets', ctx.payoutAmounts(0, 0.20, 'half', 0, t36).nonShooter, 0.15);
  check('30¢ shooter chicken pays nothing', ctx.payoutAmounts(0, 0.20, 'shooter', 0, t36).total, 0);
  check('3/6 clamps beyond 5 tai', ctx.payoutAmounts(8, 0.20, 'shooter', 0, t36).shooter, 40);
  check('base stake ignored when table active',
    ctx.payoutAmounts(1, 99, 'shooter', 0, t36).shooter, 4);
  // Text.
  check('30¢ half payout text: standard shooter split',
    ctx.describePayout(2, false, 0.20, 'half', 0, t36).includes('shooter pays $1.20') &&
    ctx.describePayout(2, false, 0.20, 'half', 0, t36).includes('$0.60 each'), true);
  // No table → formula unchanged.
  check('formula path unchanged without table', ctx.payoutAmounts(1, 1.00, 'half').shooter, 2);
}

console.log('discard safety:');
{
  const hand = counts('123m 456p 789s 5s E 9p');
  const fiveS = ctx.parseHand('5s')[0], east = ctx.parseHand('E')[0];
  // 5s discarded by two opponents → strongly safe.
  const opp = [ctx.parseHand('5s 1m'), ctx.parseHand('5s 9m'), ctx.parseHand('2p')];
  const s5 = ctx.tileSafety(fiveS, hand, opp, true, [0, 0, 0]);
  check('tile discarded by 2 opponents is safe', s5.level, 'safe');
  check('reason mentions opponents', s5.reasons[0].text.includes('2 opponents'), true);
  // Fresh honor nobody has shown → risky.
  const sE = ctx.tileSafety(east, hand, opp, true, [0, 0, 0]);
  check('fresh honor is risky', sE.level, 'risky');
  check('fresh honor reason', sE.reasons.some(r => r.text.includes('fresh honor')), true);
  // Honor fully dead only at 4 visible; 3 visible leaves a tanki wait live.
  const opp2 = [ctx.parseHand('E'), ctx.parseHand('E'), ctx.parseHand('E')];
  const sDead = ctx.tileSafety(east, hand, opp2, true, [0, 0, 0]);
  check('dead honor (4 visible) is safe', sDead.level, 'safe');
  check('dead honor reason says all 4', sDead.reasons.some(r => r.text.includes('all 4')), true);
  const opp2b = [ctx.parseHand('E'), ctx.parseHand('E'), []];
  const s3vis = ctx.tileSafety(east, hand, opp2b, true, [0, 0, 0]);
  check('3-visible honor not called dead', s3vis.reasons.some(r => r.text.includes('all 4')), false);
  check('3-visible honor warns of pair wait', s3vis.reasons.some(r => r.text.includes('pair wait')), true);
  // A fully dead tile must not take tai-danger penalties.
  const sDeadTai = ctx.tileSafety(east, hand, opp2, true, [5, 5, 5]);
  check('dead tile has no tai-danger', sDeadTai.reasons.some(r => r.type === 'tai-danger'), false);
  check('dead tile gets tai-safe credit', sDeadTai.reasons.some(r => r.type === 'tai-safe'), true);
  // Nearby same-suit discards raise safety.
  const opp3 = [ctx.parseHand('4s 6s'), ctx.parseHand('3s'), []];
  const sNear = ctx.tileSafety(fiveS, hand, opp3, true, [0, 0, 0]);
  check('nearby suit discards add safety', sNear.score >= 2, true);
  // Tai weighting: tile live against high-tai opponent gets penalized.
  const oppTai = [0, 5, 0]; // opponent 1 (facing) has 5 tai outside
  const sLive = ctx.tileSafety(east, hand, opp, true, oppTai);
  check('tai penalty for live tile', sLive.reasons.some(r => r.type === 'tai-danger'), true);
  check('tai penalty lowers score', sLive.score < sE.score, true);
  // Tile genbutsu against high-tai opponent gets bonus.
  const sSafe = ctx.tileSafety(fiveS, hand, opp, true, oppTai);
  check('tai bonus for safe tile', sSafe.reasons.some(r => r.type === 'tai-safe'), true);
  check('tai bonus raises score', sSafe.score > s5.score, true);
  // Ranking covers every distinct tile in hand, safest first.
  const ranked = ctx.safetyRanking(hand, opp, true, [0, 0, 0]);
  check('ranking covers distinct hand tiles', ranked.length,
    hand.filter(c => c > 0).length);
  check('ranking sorted safest first',
    ranked.every((r, i) => i === 0 || ranked[i - 1].score >= r.score), true);
  check('safest is the double-discarded 5s', ranked[0].tile, fiveS);
}

console.log('practice mode:');
{
  // Simple LCG for deterministic generation.
  function lcg(seed) {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  }
  // Generated waits quizzes are valid tenpai hands with correct waits.
  for (let seed = 1; seed <= 20; seed++) {
    const q = ctx.generateWaitsQuiz(lcg(seed));
    const total = q.counts.reduce((a, b) => a + b, 0);
    if (total !== 13 || q.waits.length === 0 ||
        JSON.stringify(ctx.findWaits(q.counts)) !== JSON.stringify(q.waits)) {
      check(`waits quiz seed ${seed} valid`, 'invalid', 'valid');
    }
  }
  check('20 waits quizzes all valid', true, true);
  // Discard quizzes: 14 tiles, not a win, meaningful choice.
  for (let seed = 1; seed <= 20; seed++) {
    const q = ctx.generateDiscardQuiz(lcg(seed + 100));
    const total = q.counts.reduce((a, b) => a + b, 0);
    if (total !== 14 || ctx.analyzeWin(q.counts).win || q.options.length === 0) {
      check(`discard quiz seed ${seed} valid`, 'invalid', 'valid');
    }
  }
  check('20 discard quizzes all valid', true, true);
  // Waits grading.
  const w = { waits: ctx.parseHand('3m 6m') };
  check('waits: exact match correct', ctx.gradeWaits(ctx.parseHand('3m 6m'), w.waits).correct, true);
  check('waits: missing one incorrect', ctx.gradeWaits(ctx.parseHand('3m'), w.waits).correct, false);
  check('waits: extra tile incorrect', ctx.gradeWaits(ctx.parseHand('3m 6m 9m'), w.waits).correct, false);
  check('waits: empty answer incorrect', ctx.gradeWaits([], w.waits).correct, false);
  // Discard grading tiers.
  const opts = [
    { tile: 0, shanten: 0, ukeire: 8 },
    { tile: 1, shanten: 0, ukeire: 4 },
    { tile: 2, shanten: 1, ukeire: 12 },
  ];
  check('discard: best = full', ctx.gradeDiscard(0, opts).grade, 'full');
  check('discard: same shanten lower ukeire = good', ctx.gradeDiscard(1, opts).grade, 'good');
  check('discard: worse shanten = poor', ctx.gradeDiscard(2, opts).grade, 'poor');
  check('discard: not in hand = invalid', ctx.gradeDiscard(33, opts).grade, 'invalid');
}

console.log('game tracker:');
{
  const tctx = { console, localStorage: { getItem: () => null, setItem: () => {} } };
  vm.createContext(tctx);
  for (const f of ['tiles.js', 'engine.js', 'patterns.js', 'scoring.js', 'tracker.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), tctx, { filename: f });
  }
  const T = (expr) => vm.runInContext(expr, tctx);

  // Non-dealer win by discard: deal passes right.
  T("tracker.draft = { winner: 2, tai: 3, how: 'discard', shooter: 0 }");
  check('draft with shooter is ready', T('trackerDraftReady()'), true);
  T('trackerRecordHand()');
  check('deal passes after non-dealer win', T('tracker.dealerSeat'), 1);
  check('hand number advances', T('tracker.handNumber'), 2);
  check('history records shooter', T('tracker.history[0].shooter'), 0);

  // Dealer win: dealer stays.
  T("tracker.draft = { winner: 1, tai: 1, how: 'self-draw', shooter: null }");
  T('trackerRecordHand()');
  check('dealer repeats after dealer win', T('tracker.dealerSeat'), 1);

  // Draw: dealer stays.
  T("tracker.draft = { winner: null, tai: null, how: 'draw', shooter: null }");
  check('draw draft is ready', T('trackerDraftReady()'), true);
  T('trackerRecordHand()');
  check('dealer repeats after draw', T('tracker.dealerSeat'), 1);
  check('draw recorded with null winner', T('tracker.history[2].winner'), null);

  // Wind advances when the deal returns to seat 0.
  T("tracker.draft = { winner: 0, tai: 2, how: 'discard', shooter: 3 }");
  T('trackerRecordHand()'); // dealer 1 -> 2
  T("tracker.draft = { winner: 0, tai: 2, how: 'discard', shooter: 3 }");
  T('trackerRecordHand()'); // dealer 2 -> 3
  T("tracker.draft = { winner: 0, tai: 2, how: 'discard', shooter: 3 }");
  T('trackerRecordHand()'); // dealer 3 -> 0, wind advances
  check('wind advances when deal returns to seat 0', T('tracker.prevailingWind'), 1);
  check('dealer back at seat 0', T('tracker.dealerSeat'), 0);

  // Totals.
  const totals = T('trackerTotals()');
  check('winner totals accumulate', totals[0].wins, 3);
  check('tai totals accumulate', totals[0].tai, 6);
  check('shooter count accumulates', totals[3].shot, 3);
  check('self-draw counted', totals[1].selfDraws, 1);

  // Validation: shooter can't be the winner; discard needs a shooter.
  T("tracker.draft = { winner: 2, tai: 1, how: 'discard', shooter: 2 }");
  check('winner-as-shooter rejected', T('trackerDraftReady()'), false);
  T("tracker.draft = { winner: 2, tai: 1, how: 'discard', shooter: null }");
  check('discard without shooter rejected', T('trackerDraftReady()'), false);
  T("tracker.draft = { winner: 2, tai: null, how: 'self-draw', shooter: null }");
  check('missing tai rejected', T('trackerDraftReady()'), false);

  // Undo restores dealer, wind, and hand number.
  const before = T('JSON.stringify([tracker.dealerSeat, tracker.prevailingWind, tracker.handNumber])');
  T("tracker.draft = { winner: 1, tai: 5, how: 'self-draw', shooter: null }");
  T('trackerRecordHand()');
  T('trackerUndo()');
  check('undo restores state', T('JSON.stringify([tracker.dealerSeat, tracker.prevailingWind, tracker.handNumber])'), JSON.parse(JSON.stringify(before)));
  check('undo removes history entry', T('tracker.history.length'), 6);

  // Reset.
  T('trackerReset()');
  check('reset clears everything', T('tracker.history.length + tracker.dealerSeat + tracker.prevailingWind + (tracker.handNumber - 1)'), 0);

  // --- bites / kongs ---
  T("tracker.biteDraft = { player: 2, type: 'hidden-kong' }");
  T('trackerRecordBite()');
  check('bite recorded with tai', T('tracker.history[0].tai'), 2);
  check('bite tagged to current hand', T('tracker.history[0].hand'), 1);
  check('bite does not advance the deal', T('tracker.dealerSeat + (tracker.handNumber - 1)'), 0);
  check('bite draft cleared', T('tracker.biteDraft.player'), null);
  T("tracker.biteDraft = { player: 2, type: 'animal' }");
  T('trackerRecordBite()');
  T("tracker.draft = { winner: 0, tai: 2, how: 'self-draw', shooter: null }");
  T('trackerRecordHand()');
  const bt = T('trackerTotals()');
  check('bite totals accumulate', [bt[2].bites, bt[2].biteTai], [2, 3]);
  check('bites separate from win totals', bt[2].wins, 0);
  // Undo after a hand: pops the hand (restores deal), bites stay.
  T('trackerUndo()');
  check('undo pops hand not bites', T('tracker.history.length'), 2);
  check('undo restored hand number', T('tracker.handNumber'), 1);
  // Undo again: pops the latest bite without touching dealer/wind.
  T("tracker.dealerSeat = 3");
  T('trackerUndo()');
  check('bite undo leaves dealer alone', T('tracker.dealerSeat'), 3);
  check('bite undo pops the bite', T('tracker.history.length'), 1);
  // Incomplete bite drafts are ignored.
  T("tracker.biteDraft = { player: null, type: 'animal' }");
  T('trackerRecordBite()');
  check('incomplete bite ignored', T('tracker.history.length'), 1);
  // --- money settlement ---
  T('trackerReset()');
  T("tracker.stakes = { stake: 1.00, stakeTableId: null, payMode: 'half', selfDrawBonus: 0 }");
  // 1-tai discard win at $1 base: winner +$4, shooter -$2, others -$1.
  T("tracker.draft = { winner: 0, tai: 1, how: 'discard', shooter: 1 }");
  T('trackerRecordHand()');
  let m = T('trackerMoney()');
  check('discard win money split', m, [4, -2, -1, -1]);
  // Self-draw 1 tai with $2 bonus: everyone pays 2+2=4, winner +$12.
  T("tracker.stakes.selfDrawBonus = 2");
  T("tracker.draft = { winner: 2, tai: 1, how: 'self-draw', shooter: null }");
  T('trackerRecordHand()');
  m = T('trackerMoney()');
  check('self-draw money with bonus', m, [0, -6, 11, -5]);
  // Zero-sum invariant.
  check('money is zero-sum', m.reduce((a, b) => a + b, 0), 0);
  // Bite: 1-tai animal at $1 base — player 3 collects $1 from each.
  T("tracker.biteDraft = { player: 3, type: 'animal' }");
  T('trackerRecordBite()');
  m = T('trackerMoney()');
  check('bite money flows', m, [-1, -7, 10, -2]);
  // Shooter mode: discarder pays the whole pot.
  T('trackerReset()');
  T("tracker.stakes = { stake: 1.00, stakeTableId: null, payMode: 'shooter', selfDrawBonus: 0 }");
  T("tracker.draft = { winner: 0, tai: 1, how: 'discard', shooter: 2 }");
  T('trackerRecordHand()');
  m = T('trackerMoney()');
  check('shooter-pays-all money split', m, [4, 0, -4, 0]);
  // 3/6 table: shooter alone pays the schedule ($4 at 1 tai).
  T('trackerReset()');
  T("tracker.stakes = { stake: 0.20, stakeTableId: 'three-six', payMode: 'shooter', selfDrawBonus: 0 }");
  T("tracker.draft = { winner: 1, tai: 1, how: 'discard', shooter: 0 }");
  T('trackerRecordHand()');
  m = T('trackerMoney()');
  check('3/6 shooter schedule money', m, [-4, 4, 0, 0]);
  // Drawn hands move no money.
  T("tracker.draft = { winner: null, tai: null, how: 'draw', shooter: null }");
  T('trackerRecordHand()');
  check('draw moves no money', T('trackerMoney()'), [-4, 4, 0, 0]);

  // --- settlement ---
  check('settle: single debtor/creditor', T('JSON.stringify(settleDebts([4, -4, 0, 0]))'),
    JSON.stringify([{ from: 1, to: 0, amount: 4 }]));
  check('settle: all even → no transfers', T('settleDebts([0, 0, 0, 0]).length'), 0);
  {
    const transfers = T('settleDebts([6, -2, -3, -1])');
    const net = [0, 0, 0, 0];
    for (const t of transfers) { net[t.from] -= t.amount; net[t.to] += t.amount; }
    check('settle: 3-way transfers reproduce net', net, [6, -2, -3, -1]);
    check('settle: at most 3 transfers', transfers.length <= 3, true);
  }
  {
    const transfers = T('settleDebts([0.1, 0.1, 0.1, -0.3])');
    const total = transfers.reduce((a, t) => a + t.amount, 0);
    check('settle: cents handled without drift', Math.round(total * 100), 30);
  }
  // Summary over a real game.
  T('trackerReset()');
  T("tracker.stakes = { stake: 1.00, stakeTableId: null, payMode: 'half', selfDrawBonus: 0 }");
  T("tracker.draft = { winner: 0, tai: 1, how: 'discard', shooter: 1 }");
  T('trackerRecordHand()');
  T("tracker.draft = { winner: 0, tai: 3, how: 'self-draw', shooter: null }");
  T('trackerRecordHand()');
  {
    const sum = T('trackerSummary()');
    check('summary standings sorted by net', sum.standings[0].seat, 0);
    check('summary biggest hand is the self-draw', sum.biggestHand.tai, 3);
    const text = T('trackerSummaryText()');
    check('summary text has standings and transfers',
      text.includes('1. Player 1') && text.includes('pays'), true);
  }

  // Legacy entries without kind are migrated on load.
  const legacyCtx = { console, localStorage: {
    getItem: () => JSON.stringify({ players: ['A','B','C','D'], prevailingWind: 0, dealerSeat: 0, handNumber: 2,
      history: [{ hand: 1, wind: 0, dealerSeat: 0, winner: 1, tai: 3, how: 'self-draw', shooter: null }] }),
    setItem: () => {} } };
  vm.createContext(legacyCtx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'tracker.js'), 'utf8'), legacyCtx, { filename: 'tracker.js' });
  vm.runInContext('trackerLoad()', legacyCtx);
  check('legacy history migrated to kind:hand', vm.runInContext("tracker.history[0].kind", legacyCtx), 'hand');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
