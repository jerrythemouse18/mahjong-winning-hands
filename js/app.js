/**
 * app.js — UI wiring: tile palette, hand tray, live analysis panel.
 */

const state = {
  counts: new Array(TILE_COUNT).fill(0),
  seatWind: 0,
  roundWind: 0,
  bonusTiles: new Set(),
  winContext: new Set(),
  stake: 0.20,
  stakeTable: null, // an entry from STAKE_TABLES, or null for the doubling formula
  taiLimit: DEFAULT_TAI_LIMIT,
  payMode: 'half',
  selfDrawBonus: 0,
  targetPattern: null, // pattern id the user chose to chase, or null for auto
  oppDiscards: [[], [], []], // recent discards per opponent, oldest first
  inputTarget: -1, // -1 = taps add to my hand; 0..2 = record that opponent's discard
};

const els = {
  palette: document.getElementById('palette'),
  hand: document.getElementById('hand'),
  handCount: document.getElementById('hand-count'),
  status: document.getElementById('status'),
  waits: document.getElementById('waits'),
  scoreBreakdown: document.getElementById('score-breakdown'),
  discardAdvice: document.getElementById('discard-advice'),
  suggestions: document.getElementById('suggestions'),
  clearBtn: document.getElementById('clear-btn'),
  learnList: document.getElementById('learn-list'),
  seatWind: document.getElementById('seat-wind'),
  roundWind: document.getElementById('round-wind'),
  bonusPalette: document.getElementById('bonus-palette'),
  winContext: document.getElementById('win-context'),
  stakePresets: document.getElementById('stake-presets'),
  stakeCustom: document.getElementById('stake-custom'),
  taiLimit: document.getElementById('tai-limit'),
  selfDrawBonus: document.getElementById('selfdraw-bonus'),
  payMode: document.getElementById('pay-mode'),
  payoutTable: document.getElementById('payout-table'),
  opponentTabs: document.getElementById('opponent-tabs'),
  opponentDiscards: document.getElementById('opponent-discards'),
  safetyResults: document.getElementById('safety-results'),
};

function totalTiles() {
  return state.counts.reduce((a, b) => a + b, 0);
}

/* ---------- rendering ---------- */

function tileButton(id, { withBadge = false, onClick } = {}) {
  const face = tileFace(id);
  const btn = document.createElement('button');
  btn.className = `tile ${face.cssClass}`;
  btn.type = 'button';
  btn.setAttribute('aria-label', face.label);
  btn.innerHTML = `<span class="tile-main">${face.main}</span>` +
    (face.sub ? `<span class="tile-sub">${face.sub}</span>` : '');
  if (withBadge) {
    const badge = document.createElement('span');
    badge.className = 'tile-badge';
    btn.appendChild(badge);
  }
  if (onClick) btn.addEventListener('click', () => onClick(id));
  return btn;
}

function buildPalette() {
  const groups = [
    { title: 'Characters 萬', ids: [...Array(9)].map((_, i) => i) },
    { title: 'Dots 筒', ids: [...Array(9)].map((_, i) => 9 + i) },
    { title: 'Bamboo 條', ids: [...Array(9)].map((_, i) => 18 + i) },
    { title: 'Winds & Dragons', ids: [27, 28, 29, 30, 31, 32, 33] },
  ];
  for (const g of groups) {
    const section = document.createElement('div');
    section.className = 'palette-group';
    const h = document.createElement('h3');
    h.textContent = g.title;
    section.appendChild(h);
    const row = document.createElement('div');
    row.className = 'palette-row';
    for (const id of g.ids) {
      const btn = tileButton(id, { withBadge: true, onClick: addTile });
      btn.dataset.tileId = id;
      row.appendChild(btn);
    }
    section.appendChild(row);
    els.palette.appendChild(section);
  }
}

function refreshPaletteBadges() {
  els.palette.querySelectorAll('.tile').forEach(btn => {
    const id = Number(btn.dataset.tileId);
    const n = state.counts[id];
    const badge = btn.querySelector('.tile-badge');
    badge.textContent = n || '';
    badge.classList.toggle('visible', n > 0);
    btn.classList.toggle('maxed', n >= 4);
  });
}

function renderHand() {
  els.hand.innerHTML = '';
  for (let id = 0; id < TILE_COUNT; id++) {
    for (let k = 0; k < state.counts[id]; k++) {
      els.hand.appendChild(tileButton(id, { onClick: removeTile }));
    }
  }
  const n = totalTiles();
  els.handCount.textContent = `${n} / 14 tiles`;
  els.handCount.classList.toggle('complete', n === 13 || n === 14);
}

/* ---------- interactions ---------- */

function addTile(id) {
  // When an opponent tab is selected, palette taps record their discard.
  if (state.inputTarget >= 0) {
    const seen = state.oppDiscards.flat().filter(t => t === id).length + state.counts[id];
    if (seen >= 4) return;                 // only 4 copies exist anywhere
    const list = state.oppDiscards[state.inputTarget];
    list.push(id);
    if (list.length > MAX_DISCARD_ROUNDS) list.shift(); // oldest round drops off
    update();
    return;
  }
  if (state.counts[id] >= 4) return;       // only 4 copies exist
  if (totalTiles() >= 14) return;          // hand is full
  state.counts[id]++;
  update();
}

function removeTile(id) {
  if (state.counts[id] === 0) return;
  state.counts[id]--;
  update();
}

function clearHand() {
  state.counts.fill(0);
  state.bonusTiles.clear();
  state.winContext.clear();
  state.oppDiscards = [[], [], []];
  state.targetPattern = null;
  els.bonusPalette.querySelectorAll('.tile').forEach(b => b.classList.remove('selected'));
  els.winContext.querySelectorAll('input').forEach(cb => { cb.checked = false; });
  update();
}

/* ---------- table controls: winds, bonus tiles, win context ---------- */

function buildTableControls() {
  els.seatWind.addEventListener('change', () => { state.seatWind = Number(els.seatWind.value); update(); });
  els.roundWind.addEventListener('change', () => { state.roundWind = Number(els.roundWind.value); update(); });

  for (const b of BONUS_TILES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tile bonus-tile bonus-${b.group}`;
    btn.setAttribute('aria-label', b.name);
    btn.setAttribute('aria-pressed', 'false');
    btn.title = b.name;
    btn.innerHTML = `<span class="tile-main">${b.symbol}</span><span class="tile-sub">${b.group}</span>`;
    btn.addEventListener('click', () => {
      if (state.bonusTiles.has(b.id)) state.bonusTiles.delete(b.id);
      else state.bonusTiles.add(b.id);
      const on = state.bonusTiles.has(b.id);
      btn.classList.toggle('selected', on);
      btn.setAttribute('aria-pressed', String(on));
      update();
    });
    els.bonusPalette.appendChild(btn);
  }

  for (const base of STAKE_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stake-btn';
    btn.dataset.stake = base;
    btn.textContent = base < 1 ? `${Math.round(base * 100)}¢` : `$${base}`;
    btn.addEventListener('click', () => setStake(base));
    els.stakePresets.appendChild(btn);
  }
  for (const table of STAKE_TABLES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stake-btn';
    btn.dataset.table = table.id;
    btn.textContent = table.label;
    btn.title = 'Fixed per-tai schedule instead of the doubling formula';
    btn.addEventListener('click', () => setStakeTable(table));
    els.stakePresets.appendChild(btn);
  }
  els.stakeCustom.addEventListener('input', () => {
    const v = parseFloat(els.stakeCustom.value);
    if (v > 0) setStake(v, true);
  });
  for (const m of PAY_MODES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stake-btn pay-mode-btn';
    btn.dataset.mode = m.id;
    btn.textContent = m.name;
    btn.addEventListener('click', () => {
      state.payMode = m.id;
      els.payMode.querySelectorAll('.pay-mode-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.mode === m.id));
      renderPayoutTable();
      update();
    });
    if (m.id === state.payMode) btn.classList.add('active');
    els.payMode.appendChild(btn);
  }
  els.taiLimit.addEventListener('input', () => {
    const v = parseInt(els.taiLimit.value, 10);
    if (v >= 1) {
      state.taiLimit = v;
      renderPayoutTable();
      update();
    }
  });
  els.selfDrawBonus.addEventListener('input', () => {
    const v = parseFloat(els.selfDrawBonus.value);
    state.selfDrawBonus = v >= 0 ? v : 0;
    renderPayoutTable();
    update();
  });
  setStake(state.stake);

  for (const wc of WIN_CONTEXT) {
    const label = document.createElement('label');
    label.className = 'context-option';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.addEventListener('change', () => {
      if (cb.checked) state.winContext.add(wc.id);
      else state.winContext.delete(wc.id);
      update();
    });
    label.appendChild(cb);
    const taiLabel = wc.tai === 'limit' ? 'limit' : `+${wc.tai} tai`;
    label.appendChild(document.createTextNode(` ${wc.name} (${taiLabel})`));
    els.winContext.appendChild(label);
  }
}

function setStake(base, fromCustom = false) {
  state.stake = base;
  state.stakeTable = null;
  els.stakePresets.querySelectorAll('.stake-btn').forEach(btn => {
    btn.classList.toggle('active', !fromCustom && Number(btn.dataset.stake) === base);
  });
  if (!fromCustom) els.stakeCustom.value = '';
  renderPayoutTable();
  update();
}

function setStakeTable(table) {
  state.stakeTable = table;
  els.stakePresets.querySelectorAll('.stake-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.table === table.id);
  });
  els.stakeCustom.value = '';
  renderPayoutTable();
  update();
}

/** Reference table: cost per tai at the current stake, shooter vs non-shooter. */
function renderPayoutTable() {
  const base = state.stake;
  const mode = state.payMode;
  const bonus = state.selfDrawBonus;
  const rows = [];
  for (let tai = 0; tai <= state.taiLimit; tai++) {
    const p = payoutAmounts(tai, base, mode, bonus, state.stakeTable);
    const label = tai === 0 ? '0 (chicken)*' : tai === state.taiLimit ? `${tai} (limit)` : String(tai);
    rows.push(`<tr><td>${label}</td><td>${fmtMoney(p.nonShooter)}</td><td>${fmtMoney(p.shooter)}</td><td>${fmtMoney(p.selfDrawEach)}</td><td>${fmtMoney(p.total)} / ${fmtMoney(p.selfDrawTotal)}</td></tr>`);
  }
  const biteUnit = t => fmtMoney(payoutAmounts(t, base, 'half', 0, state.stakeTable).nonShooter);
  const biteRows =
    `<tr><td>Bite — open (kong/animal, ${BITE.open} tai)</td><td colspan="4">${biteUnit(BITE.open)} from every player</td></tr>` +
    `<tr><td>Bite — hidden kong (${BITE.hidden} tai)</td><td colspan="4">${biteUnit(BITE.hidden)} from every player</td></tr>`;
  const modeHint = state.stakeTable
    ? (mode === 'shooter'
      ? `${state.stakeTable.label} schedule, shooter mode (全銃): the discarder pays the fixed amount alone; the other two pay nothing.`
      : `${state.stakeTable.label} schedule, everyone pays: all three players pay the fixed per-tai amount (no shooter doubling).`)
    : (mode === 'shooter'
      ? 'Shooter mode (全銃): whoever discards the winning tile pays the whole pot alone; the other two pay nothing.'
      : 'Everyone pays: the shooter (discarder) pays double, the other two pay the base rate.');
  const bonusHint = bonus > 0
    ? ` Self-draw column includes the ${fmtMoney(bonus)} bonus each player adds.`
    : '';
  els.payoutTable.innerHTML = `
    <table class="payout-ref">
      <thead><tr><th>Tai</th><th>Non-shooter pays</th><th>Shooter pays</th><th>Self-draw, each pays</th><th>Winner collects (discard / self-draw)</th></tr></thead>
      <tbody>${rows.join('')}${biteRows}</tbody>
    </table>
    <p class="hint">${modeHint} On self-draw, all three pay the doubled rate in either mode.${bonusHint} *Many tables don't pay chicken hands. Bites are collected immediately, win or not.</p>`;
}

/* ---------- analysis panel ---------- */

function update() {
  refreshPaletteBadges();
  renderHand();
  renderOpponentDiscards();
  renderSafety();
  const n = totalTiles();

  els.waits.innerHTML = '';
  els.scoreBreakdown.innerHTML = '';
  els.discardAdvice.innerHTML = '';
  els.status.className = 'status';

  if (n === 0) {
    setStatus('Tap tiles above to build your hand. Add 13 tiles to see your waits, or 14 to check a win.', 'idle');
    els.suggestions.innerHTML = '';
    return;
  }

  if (n === 14) {
    const analysis = analyzeWin(state.counts);
    if (analysis.win) {
      const score = scoreHand(analysis, state.counts, state);
      setStatus(`🎉 Winning hand — ${score.total} tai${score.limited ? ` (limit; ${score.raw} before cap)` : ''}!`, 'win');
      renderScoreBreakdown(score);
    } else {
      setStatus(`Not a winning hand — ${analysis.reason}`, 'no-win');
      renderDiscardAdvice();
    }
  } else if (n === 13) {
    const waits = findWaits(state.counts);
    if (waits.length > 0) {
      setStatus(`✅ You are ready (tenpai)! Winning tile${waits.length > 1 ? 's' : ''}:`, 'tenpai');
      for (const t of waits) {
        els.waits.appendChild(tileButton(t, {}));
      }
    } else {
      setStatus('Not ready yet — no single tile completes this hand. See the closest patterns below.', 'building');
    }
  } else {
    setStatus(`Keep going — ${13 - n > 0 ? 13 - n + ' more tile(s) to a full 13-tile hand.' : 'you have ' + n + ' tiles.'}`, 'building');
  }

  renderSuggestions();
}

function setStatus(msg, cls) {
  els.status.textContent = msg;
  els.status.className = `status ${cls}`;
}

function renderScoreBreakdown(score) {
  const box = document.createElement('div');
  box.className = 'score-box';
  const rows = score.items.map(i =>
    `<tr><td>${i.name}</td><td class="tai-cell">${i.tai > 0 ? '+' : ''}${i.tai}</td></tr>`).join('');
  const capRow = score.limited
    ? `<tr class="cap-row"><td>Limit applied (max ${score.limit} tai)</td><td class="tai-cell">${score.total}</td></tr>`
    : '';
  const selfDraw = state.winContext.has('self-draw');
  const p = payoutAmounts(score.total, state.stake, state.payMode, state.selfDrawBonus, state.stakeTable);
  const moneyRows = selfDraw
    ? `<tr class="money-row"><td>Each player pays you (self-draw)</td><td class="tai-cell">${fmtMoney(p.selfDrawEach)}</td></tr>
       <tr class="money-row"><td>You collect</td><td class="tai-cell">${fmtMoney(p.selfDrawTotal)}</td></tr>`
    : (state.payMode === 'shooter'
      ? `<tr class="money-row"><td>Shooter pays you (pays for all)</td><td class="tai-cell">${fmtMoney(p.shooter)}</td></tr>
         <tr class="money-row"><td>You collect</td><td class="tai-cell">${fmtMoney(p.total)}</td></tr>`
      : (state.stakeTable
        ? `<tr class="money-row"><td>Each player pays you</td><td class="tai-cell">${fmtMoney(p.nonShooter)}</td></tr>
           <tr class="money-row"><td>You collect</td><td class="tai-cell">${fmtMoney(p.total)}</td></tr>`
        : `<tr class="money-row"><td>Non-shooter pays you</td><td class="tai-cell">${fmtMoney(p.nonShooter)}</td></tr>
           <tr class="money-row"><td>Shooter pays you</td><td class="tai-cell">${fmtMoney(p.shooter)}</td></tr>
           <tr class="money-row"><td>You collect</td><td class="tai-cell">${fmtMoney(p.total)}</td></tr>`));
  box.innerHTML = `
    <table class="score-table">
      <tbody>${rows}${capRow}</tbody>
      <tfoot>
        <tr><td>Total</td><td class="tai-cell">${score.total} tai</td></tr>
        ${moneyRows}
      </tfoot>
    </table>
    <p class="payout">${describePayout(score.total, selfDraw, state.stake, state.payMode, state.selfDrawBonus, state.stakeTable)}</p>`;
  els.scoreBreakdown.appendChild(box);
}

function renderDiscardAdvice() {
  const options = adviseDiscards(state.counts).slice(0, 3);
  if (!options.length) return;
  const box = document.createElement('div');
  box.className = 'discard-box';
  const h = document.createElement('h3');
  h.textContent = '💡 Best discards';
  box.appendChild(h);
  for (const opt of options) {
    const row = document.createElement('div');
    row.className = 'discard-row';
    row.appendChild(tileButton(opt.tile, { onClick: removeTile }));
    const info = document.createElement('div');
    info.className = 'discard-info';
    const stage = opt.shanten === 0 ? 'ready (tenpai)' : `${opt.shanten} step${opt.shanten > 1 ? 's' : ''} from ready`;
    info.innerHTML = `<strong>Discard ${tileFace(opt.tile).label}</strong> → ${stage}, ` +
      `<span class="ukeire">${opt.ukeire} useful tile${opt.ukeire === 1 ? '' : 's'} live</span>`;
    if (opt.acceptedTiles.length) {
      const accepts = document.createElement('div');
      accepts.className = 'accepts-row';
      for (const t of opt.acceptedTiles) {
        const mini = tileButton(t, {});
        mini.classList.add('mini');
        accepts.appendChild(mini);
      }
      info.appendChild(accepts);
    }
    row.appendChild(info);
    box.appendChild(row);
  }
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'Tap a suggested tile to discard it from your hand. "Useful tiles" counts every remaining copy that moves you closer.';
  box.appendChild(hint);
  els.discardAdvice.appendChild(box);
}

function renderSuggestions() {
  els.suggestions.innerHTML = '';
  const n = totalTiles();
  if (n < 5) {
    els.suggestions.innerHTML = '<p class="hint">Add at least 5 tiles to get pattern suggestions.</p>';
    return;
  }
  let ranked = suggestPatterns(state.counts);
  // A chosen target is always shown, pinned to the top; otherwise top 5.
  if (state.targetPattern) {
    const target = ranked.find(r => r.pattern.id === state.targetPattern);
    ranked = [target, ...ranked.filter(r => r !== target).slice(0, 4)];
  } else {
    ranked = ranked.slice(0, 5);
  }
  // "What to throw" only makes sense with a full 14-tile hand.
  const showThrows = n === 14;
  for (const { pattern, distance } of ranked) {
    const isTarget = pattern.id === state.targetPattern;
    const card = document.createElement('div');
    card.className = 'suggestion-card' + (isTarget ? ' targeted' : '');
    const closeness = distance <= 0 ? 'Complete!' :
      distance === 1 ? 'Very close — about 1 tile away' :
      `About ${distance} tiles away`;
    card.innerHTML = `
      <div class="suggestion-head">
        <strong>${pattern.name}</strong>
        <span class="tai-badge">${pattern.tai} tai</span>
        <span class="distance ${distance <= 1 ? 'near' : distance <= 3 ? 'mid' : 'far'}">${closeness}</span>
        <button type="button" class="target-btn${isTarget ? ' active' : ''}">${isTarget ? '★ Chasing — tap to stop' : '☆ Chase this hand'}</button>
      </div>
      <p>${pattern.description}</p>
      <p class="example">Example: <code>${pattern.example}</code></p>`;
    card.querySelector('.target-btn').addEventListener('click', () => {
      state.targetPattern = isTarget ? null : pattern.id;
      update();
    });
    if (showThrows && distance > 0 && (isTarget || !state.targetPattern)) {
      const throwTiles = bestDiscardsForPattern(state.counts, pattern.id);
      if (throwTiles.length) {
        const row = document.createElement('div');
        row.className = 'throw-row';
        const lbl = document.createElement('span');
        lbl.className = 'throw-label';
        lbl.textContent = 'To chase this, throw:';
        row.appendChild(lbl);
        for (const t of throwTiles) {
          const btn = tileButton(t, { onClick: removeTile });
          btn.classList.add('mini');
          btn.title = `Discard ${tileFace(t).label}`;
          row.appendChild(btn);
        }
        card.appendChild(row);
      }
    }
    els.suggestions.appendChild(card);
  }
  if (!showThrows && n >= 5) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Fill your hand to 14 tiles to see which tile to throw for each pattern.';
    els.suggestions.appendChild(p);
  }
}

/* ---------- opponents' discards & safety ---------- */

function buildOpponentTabs() {
  const mine = document.createElement('button');
  mine.type = 'button';
  mine.className = 'stake-btn opp-tab active';
  mine.textContent = 'My hand';
  mine.addEventListener('click', () => setInputTarget(-1));
  els.opponentTabs.appendChild(mine);
  OPPONENT_NAMES.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stake-btn opp-tab';
    btn.textContent = name;
    btn.addEventListener('click', () => setInputTarget(i));
    els.opponentTabs.appendChild(btn);
  });
}

function setInputTarget(i) {
  state.inputTarget = i;
  els.opponentTabs.querySelectorAll('.opp-tab').forEach((btn, idx) => {
    btn.classList.toggle('active', idx - 1 === i);
  });
  update();
}

function renderOpponentDiscards() {
  els.opponentDiscards.innerHTML = '';
  OPPONENT_NAMES.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'opp-row' + (state.inputTarget === i ? ' recording' : '');
    const label = document.createElement('span');
    label.className = 'opp-label';
    label.textContent = name + (state.inputTarget === i ? ' — recording' : '');
    row.appendChild(label);
    const tiles = document.createElement('div');
    tiles.className = 'opp-tiles';
    state.oppDiscards[i].forEach((t, idx) => {
      const btn = tileButton(t, {
        onClick: () => { state.oppDiscards[i].splice(idx, 1); update(); },
      });
      btn.classList.add('mini');
      btn.title = 'Tap to remove';
      tiles.appendChild(btn);
    });
    if (!state.oppDiscards[i].length) {
      const empty = document.createElement('span');
      empty.className = 'hint';
      empty.textContent = 'no discards recorded';
      tiles.appendChild(empty);
    }
    row.appendChild(tiles);
    els.opponentDiscards.appendChild(row);
  });
}

function renderSafety() {
  els.safetyResults.innerHTML = '';
  const anyDiscards = state.oppDiscards.some(l => l.length > 0);
  const n = totalTiles();
  if (!anyDiscards || n === 0) {
    if (n > 0) {
      els.safetyResults.innerHTML = '<p class="hint">Record some opponent discards to see which of your tiles are safer to throw.</p>';
    }
    return;
  }
  const ranked = safetyRanking(state.counts, state.oppDiscards);
  const box = document.createElement('div');
  box.className = 'safety-box';
  const h = document.createElement('h3');
  h.textContent = '🛡️ Safer discards from your hand';
  box.appendChild(h);
  for (const r of ranked) {
    const row = document.createElement('div');
    row.className = `safety-row ${r.level}`;
    const btn = tileButton(r.tile, { onClick: removeTile });
    btn.classList.add('mini');
    btn.title = `Discard ${tileFace(r.tile).label}`;
    row.appendChild(btn);
    const info = document.createElement('div');
    info.className = 'safety-info';
    const levelText = { safe: 'Safe', caution: 'Caution', risky: 'Risky' }[r.level];
    info.innerHTML = `<span class="safety-level">${levelText}</span> ${r.reasons.join('; ')}`;
    row.appendChild(info);
    box.appendChild(row);
  }
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'Heuristic only — tiles an opponent already discarded are the safest; fresh honors are the most dangerous. Tap a tile to discard it.';
  box.appendChild(hint);
  els.safetyResults.appendChild(box);
}

/* ---------- learn section ---------- */

function buildLearn() {
  for (const p of [...PATTERNS].sort((a, b) => a.difficulty - b.difficulty)) {
    const card = document.createElement('div');
    card.className = 'learn-card';
    const stars = '★'.repeat(p.difficulty) + '☆'.repeat(5 - p.difficulty);
    card.innerHTML = `
      <div class="learn-head"><strong>${p.name}</strong><span class="tai-badge">${p.tai} tai</span><span class="stars" title="Difficulty">${stars}</span></div>
      <p>${p.description}</p>
      <div class="learn-example"></div>`;
    const exampleRow = card.querySelector('.learn-example');
    const ids = parseHand(p.example.replace(/\+.*$/, ''));
    for (const id of ids) exampleRow.appendChild(tileButton(id, {}));
    els.learnList.appendChild(card);
  }
}

/* ---------- init ---------- */

document.getElementById('version-badge').textContent = APP_VERSION;
buildPalette();
buildTableControls();
buildOpponentTabs();
buildLearn();
els.clearBtn.addEventListener('click', clearHand);
update();
