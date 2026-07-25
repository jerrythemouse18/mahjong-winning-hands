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
  payoutTable: document.getElementById('payout-table'),
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
  els.stakeCustom.addEventListener('input', () => {
    const v = parseFloat(els.stakeCustom.value);
    if (v > 0) setStake(v, true);
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
    label.appendChild(document.createTextNode(` ${wc.name} (+${wc.tai} tai)`));
    els.winContext.appendChild(label);
  }
}

function setStake(base, fromCustom = false) {
  state.stake = base;
  els.stakePresets.querySelectorAll('.stake-btn').forEach(btn => {
    btn.classList.toggle('active', !fromCustom && Number(btn.dataset.stake) === base);
  });
  if (!fromCustom) els.stakeCustom.value = '';
  renderPayoutTable();
  update();
}

/** Reference table: cost per tai at the current stake, shooter vs non-shooter. */
function renderPayoutTable() {
  const base = state.stake;
  const rows = [];
  for (let tai = 0; tai <= 5; tai++) {
    const { nonShooter, shooter } = payoutAmounts(tai, base);
    const label = tai === 0 ? '0 (chicken)*' : tai === 5 ? '5 (limit)' : String(tai);
    rows.push(`<tr><td>${label}</td><td>${fmtMoney(nonShooter)}</td><td>${fmtMoney(shooter)}</td></tr>`);
  }
  const biteRows =
    `<tr><td>Bite — open (kong/animal, ${BITE.open} tai)</td><td colspan="2">${fmtMoney(payoutAmounts(BITE.open, base).nonShooter)} from every player</td></tr>` +
    `<tr><td>Bite — hidden kong (${BITE.hidden} tai)</td><td colspan="2">${fmtMoney(payoutAmounts(BITE.hidden, base).nonShooter)} from every player</td></tr>`;
  els.payoutTable.innerHTML = `
    <table class="payout-ref">
      <thead><tr><th>Tai</th><th>Non-shooter pays</th><th>Shooter pays</th></tr></thead>
      <tbody>${rows.join('')}${biteRows}</tbody>
    </table>
    <p class="hint">Shooter = whoever discarded the winning tile (pays double). On self-draw, all three pay the shooter price. *Many tables don't pay chicken hands. Bites are collected immediately, win or not.</p>`;
}

/* ---------- analysis panel ---------- */

function update() {
  refreshPaletteBadges();
  renderHand();
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
  const { nonShooter, shooter } = payoutAmounts(score.total, state.stake);
  box.innerHTML = `
    <table class="score-table">
      <tbody>${rows}${capRow}</tbody>
      <tfoot>
        <tr><td>Total</td><td class="tai-cell">${score.total} tai</td></tr>
        <tr class="money-row"><td>Non-shooter pays you</td><td class="tai-cell">${fmtMoney(nonShooter)}</td></tr>
        <tr class="money-row"><td>Shooter pays you</td><td class="tai-cell">${fmtMoney(shooter)}</td></tr>
      </tfoot>
    </table>
    <p class="payout">${describePayout(score.total, state.winContext.has('self-draw'), state.stake)}</p>`;
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
  const ranked = suggestPatterns(state.counts).slice(0, 5);
  for (const { pattern, distance } of ranked) {
    const card = document.createElement('div');
    card.className = 'suggestion-card';
    const closeness = distance <= 0 ? 'Complete!' :
      distance === 1 ? 'Very close — about 1 tile away' :
      `About ${distance} tiles away`;
    card.innerHTML = `
      <div class="suggestion-head">
        <strong>${pattern.name}</strong>
        <span class="tai-badge">${pattern.tai} tai</span>
        <span class="distance ${distance <= 1 ? 'near' : distance <= 3 ? 'mid' : 'far'}">${closeness}</span>
      </div>
      <p>${pattern.description}</p>
      <p class="example">Example: <code>${pattern.example}</code></p>`;
    els.suggestions.appendChild(card);
  }
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

buildPalette();
buildTableControls();
buildLearn();
els.clearBtn.addEventListener('click', clearHand);
update();
