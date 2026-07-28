/**
 * tracker-ui.js — DOM wiring for the Game Tracker tab.
 * Button-first flow: tap winner → tap tai → tap self-draw / shooter → record.
 */

const tEls = {
  tabs: document.getElementById('app-tabs'),
  views: {
    analyzer: document.getElementById('view-analyzer'),
    tracker: document.getElementById('view-tracker'),
    practice: document.getElementById('view-practice'),
  },
  state: document.getElementById('tracker-state'),
  stakes: document.getElementById('tracker-stakes'),
  payMode: document.getElementById('tracker-paymode'),
  payoutTable: document.getElementById('tracker-payout-table'),
  players: document.getElementById('tracker-players'),
  bite: document.getElementById('tracker-bite'),
  entry: document.getElementById('tracker-entry'),
  history: document.getElementById('tracker-history'),
  undo: document.getElementById('tracker-undo'),
  finish: document.getElementById('tracker-finish'),
  reset: document.getElementById('tracker-reset'),
  settlementSection: document.getElementById('tracker-settlement-section'),
  settlement: document.getElementById('tracker-settlement'),
};

/* ---------- tab switching ---------- */

tEls.tabs.querySelectorAll('.app-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    tEls.tabs.querySelectorAll('.app-tab').forEach(b =>
      b.classList.toggle('active', b === btn));
    for (const [view, el] of Object.entries(tEls.views)) {
      el.hidden = view !== btn.dataset.view;
    }
  });
});

/* ---------- round state ---------- */

function seatWindOf(seat) {
  // Seat winds rotate as the deal moves: dealer is East.
  return TRACKER_WINDS[(seat - tracker.dealerSeat + 4) % 4];
}

function renderTrackerState() {
  const roundNo = Math.floor((tracker.handNumber - 1) / 1); // display only
  tEls.state.innerHTML = `
    <div class="tracker-chips">
      <span class="tracker-chip wind-chip">Prevailing: <strong>${TRACKER_WINDS[tracker.prevailingWind]}</strong></span>
      <span class="tracker-chip">Hand #<strong>${tracker.handNumber}</strong></span>
      <span class="tracker-chip">Dealer (庄): <strong>${tracker.players[tracker.dealerSeat]}</strong></span>
    </div>`;
}

/* ---------- stakes ---------- */

function renderTrackerStakes() {
  tEls.stakes.innerHTML = '';
  const s = tracker.stakes;

  const presets = document.createElement('div');
  presets.className = 'stake-presets';
  for (const opt of stakeOptions()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const active = opt.table ? s.stakeTableId === opt.table.id
      : (s.stakeTableId === null && s.stake === opt.base);
    btn.className = 'stake-btn' + (active ? ' active' : '');
    btn.textContent = opt.label;
    if (opt.table) btn.title = 'Fixed shooter/self-draw schedules; everyone-pays doubles from the base';
    btn.addEventListener('click', () => {
      if (opt.table) s.stakeTableId = opt.table.id;
      else { s.stake = opt.base; s.stakeTableId = null; }
      trackerSave(); renderTracker();
    });
    presets.appendChild(btn);
  }
  tEls.stakes.appendChild(presets);

  const bonusLabel = document.createElement('label');
  bonusLabel.className = 'custom-stake';
  bonusLabel.textContent = 'Self-draw bonus (each): $';
  const bonusInput = document.createElement('input');
  bonusInput.type = 'number';
  bonusInput.min = '0';
  bonusInput.step = '0.10';
  bonusInput.value = s.selfDrawBonus || '';
  bonusInput.placeholder = '0';
  bonusInput.addEventListener('change', () => {
    const v = parseFloat(bonusInput.value);
    s.selfDrawBonus = v >= 0 ? v : 0;
    trackerSave(); renderTracker();
  });
  bonusLabel.appendChild(bonusInput);
  tEls.stakes.appendChild(bonusLabel);

  tEls.payMode.innerHTML = '';
  for (const m of PAY_MODES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stake-btn pay-mode-btn' + (s.payMode === m.id ? ' active' : '');
    btn.textContent = m.name;
    btn.addEventListener('click', () => {
      s.payMode = m.id;
      trackerSave(); renderTracker();
    });
    tEls.payMode.appendChild(btn);
  }

  // Payout reference table (shared builder from app.js).
  tEls.payoutTable.innerHTML = payoutTableHTML({
    base: s.stake,
    mode: s.payMode,
    bonus: s.selfDrawBonus,
    stakeTable: trackerStakeTable(),
    taiLimit: (typeof state !== 'undefined' && state.taiLimit) || 5,
  });
}

/* ---------- players ---------- */

function renderTrackerPlayers() {
  tEls.players.innerHTML = '';
  const totals = trackerTotals();
  const money = trackerMoney();
  tracker.players.forEach((name, i) => {
    const card = document.createElement('div');
    card.className = 'player-card' + (i === tracker.dealerSeat ? ' dealer' : '');
    const nameBtn = document.createElement('button');
    nameBtn.type = 'button';
    nameBtn.className = 'player-name';
    nameBtn.textContent = name + (i === tracker.dealerSeat ? ' 庄' : '');
    nameBtn.title = 'Tap to rename';
    nameBtn.addEventListener('click', () => {
      const next = prompt('Player name:', name);
      if (next && next.trim()) {
        tracker.players[i] = next.trim().slice(0, 20);
        trackerSave();
        renderTracker();
      }
    });
    card.appendChild(nameBtn);
    const wind = document.createElement('div');
    wind.className = 'player-wind';
    wind.textContent = seatWindOf(i);
    card.appendChild(wind);
    const net = document.createElement('div');
    const amount = money[i];
    net.className = 'player-money ' + (amount > 0.005 ? 'winning' : amount < -0.005 ? 'losing' : 'even');
    net.textContent = (amount > 0 ? '+' : '') + fmtMoney(amount).replace('$-', '-$');
    net.title = 'Net position at current stakes';
    card.appendChild(net);
    const stats = document.createElement('div');
    stats.className = 'player-stats';
    const t = totals[i];
    stats.innerHTML = `${t.wins} win${t.wins === 1 ? '' : 's'} · ${t.tai} tai` +
      `<br>${t.selfDraws} self-draw · shot ${t.shot}×` +
      `<br>${t.bites} bite${t.bites === 1 ? '' : 's'} · ${t.biteTai} bite tai`;
    card.appendChild(stats);
    tEls.players.appendChild(card);
  });
}

/* ---------- bite / kong recording ---------- */

function renderTrackerBite() {
  tEls.bite.innerHTML = '';
  const b = tracker.biteDraft;

  tEls.bite.appendChild(choiceRow('Who got it?',
    tracker.players.map((name, i) => ({ label: name, value: i })),
    v => b.player === v,
    v => { b.player = v; }));

  tEls.bite.appendChild(choiceRow('What happened?',
    TRACKER_BITE_TYPES.map(t => ({ label: `${t.label} (${t.tai} tai)`, value: t.id })),
    v => b.type === v,
    v => { b.type = v; }));

  const actions = document.createElement('div');
  actions.className = 'entry-actions';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'record-btn bite-btn';
  btn.textContent = '💰 Record bite';
  btn.disabled = b.player === null || b.type === null;
  btn.addEventListener('click', () => { trackerRecordBite(); renderTracker(); });
  actions.appendChild(btn);
  tEls.bite.appendChild(actions);
}

/* ---------- record entry (button-first) ---------- */

function choiceRow(labelText, options, selectedFn, onPick) {
  const wrap = document.createElement('div');
  wrap.className = 'entry-row';
  const label = document.createElement('div');
  label.className = 'entry-label';
  label.textContent = labelText;
  wrap.appendChild(label);
  const row = document.createElement('div');
  row.className = 'entry-options';
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'entry-btn' + (selectedFn(opt.value) ? ' selected' : '') + (opt.extraClass ? ` ${opt.extraClass}` : '');
    btn.textContent = opt.label;
    if (opt.disabled) btn.disabled = true;
    btn.addEventListener('click', () => { onPick(opt.value); renderTracker(); });
    row.appendChild(btn);
  }
  wrap.appendChild(row);
  return wrap;
}

function renderTrackerEntry() {
  tEls.entry.innerHTML = '';
  const d = tracker.draft;

  // 1. Winner (or draw)
  tEls.entry.appendChild(choiceRow('Who won?',
    [
      ...tracker.players.map((name, i) => ({
        label: name + (i === tracker.dealerSeat ? ' 庄' : ''),
        value: i,
      })),
      { label: 'Draw (no winner) 流局', value: 'draw', extraClass: 'entry-draw' },
    ],
    v => (v === 'draw' ? d.how === 'draw' : d.winner === v && d.how !== 'draw'),
    v => {
      if (v === 'draw') {
        tracker.draft = { winner: null, tai: null, how: 'draw', shooter: null };
      } else {
        d.winner = v;
        if (d.how === 'draw') d.how = null;
        if (d.shooter === v) d.shooter = null; // winner can't shoot themselves
      }
    }));

  if (d.how !== 'draw') {
    // 2. Tai — quick buttons 0..limit (uses the analyzer's tai limit setting)
    const maxTai = (typeof state !== 'undefined' && state.taiLimit) || 5;
    tEls.entry.appendChild(choiceRow('How many tai?',
      [...Array(maxTai + 1)].map((_, n) => ({ label: `${n}`, value: n })),
      v => d.tai === v,
      v => { d.tai = v; }));

    // 3. How they won
    tEls.entry.appendChild(choiceRow('How did they win?',
      [
        { label: 'Self-draw 自摸', value: 'self-draw' },
        { label: 'By discard (shooter)', value: 'discard' },
      ],
      v => d.how === v,
      v => { d.how = v; if (v !== 'discard') d.shooter = null; }));

    // 4. Shooter (only for discard wins)
    if (d.how === 'discard') {
      tEls.entry.appendChild(choiceRow('Who threw the tile?',
        tracker.players.map((name, i) => ({
          label: name,
          value: i,
          disabled: i === d.winner,
        })),
        v => d.shooter === v,
        v => { d.shooter = v; }));
    }
  }

  // Record button
  const actions = document.createElement('div');
  actions.className = 'entry-actions';
  const recordBtn = document.createElement('button');
  recordBtn.type = 'button';
  recordBtn.className = 'record-btn';
  recordBtn.textContent = d.how === 'draw' ? 'Record drawn hand' : '✔ Record hand';
  recordBtn.disabled = !trackerDraftReady();
  recordBtn.addEventListener('click', () => { trackerRecordHand(); renderTracker(); });
  actions.appendChild(recordBtn);
  tEls.entry.appendChild(actions);
}

/* ---------- history ---------- */

function renderTrackerHistory() {
  tEls.history.innerHTML = '';
  if (!tracker.history.length) {
    tEls.history.innerHTML = '<p class="hint">No hands recorded yet. Fill in the details above and tap Record.</p>';
    return;
  }
  const s = tracker.stakes;
  const stakeTable = trackerStakeTable();
  const table = document.createElement('table');
  table.className = 'history-table';
  table.innerHTML = '<thead><tr><th>#</th><th>Wind</th><th>Winner</th><th>Tai</th><th>$</th><th>How</th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const e of [...tracker.history].reverse()) {
    const tr = document.createElement('tr');
    const windChar = TRACKER_WINDS[e.wind].split(' ')[1];
    if (e.kind === 'bite') {
      const type = TRACKER_BITE_TYPES.find(t => t.id === e.type);
      const collect = payoutAmounts(e.tai, s.stake, 'half', 0, stakeTable).nonShooter * 3;
      tr.className = 'history-bite';
      tr.innerHTML = `<td>${e.hand}</td><td>${windChar}</td>` +
        `<td>${tracker.players[e.player]}</td><td>${e.tai}</td>` +
        `<td class="history-money">${fmtMoney(collect)}</td><td>💰 ${type ? type.label : e.type}</td>`;
      tbody.appendChild(tr);
      continue;
    }
    if (e.winner === null) {
      tr.innerHTML = `<td>${e.hand}</td><td>${windChar}</td><td colspan="4" class="history-draw">Draw 流局</td>`;
    } else {
      const p = payoutAmounts(e.tai, s.stake, s.payMode, s.selfDrawBonus, stakeTable);
      const collect = e.how === 'self-draw' ? p.selfDrawTotal : p.total;
      const how = e.how === 'self-draw'
        ? 'Self-draw 自摸'
        : `off ${tracker.players[e.shooter]}`;
      tr.innerHTML = `<td>${e.hand}</td><td>${windChar}</td>` +
        `<td>${tracker.players[e.winner]}</td><td>${e.tai}</td>` +
        `<td class="history-money">${fmtMoney(collect)}</td><td>${how}</td>`;
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  tEls.history.appendChild(table);
}

/* ---------- settlement ---------- */

let settlementVisible = false;

function renderSettlement() {
  tEls.settlementSection.hidden = !settlementVisible;
  if (!settlementVisible) return;
  tEls.settlement.innerHTML = '';
  const { standings, transfers, biggestHand } = trackerSummary();

  const table = document.createElement('table');
  table.className = 'history-table';
  table.innerHTML = '<thead><tr><th>#</th><th>Player</th><th>Net</th><th>Wins</th><th>Tai</th><th>Shot</th></tr></thead>';
  const tbody = document.createElement('tbody');
  standings.forEach((p, rank) => {
    const tr = document.createElement('tr');
    const cls = p.net > 0.005 ? 'winning' : p.net < -0.005 ? 'losing' : 'even';
    const sign = p.net > 0 ? '+' : '';
    tr.innerHTML = `<td>${rank + 1}</td><td>${p.name}</td>` +
      `<td class="settle-net ${cls}">${sign}${fmtMoney(p.net).replace('$-', '-$')}</td>` +
      `<td>${p.wins}</td><td>${p.tai}</td><td>${p.shot}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tEls.settlement.appendChild(table);

  const pay = document.createElement('div');
  pay.className = 'settle-transfers';
  if (transfers.length) {
    pay.innerHTML = '<h3>To settle up:</h3>' + transfers.map(t =>
      `<p class="settle-line">💸 <strong>${tracker.players[t.from]}</strong> pays <strong>${tracker.players[t.to]}</strong> ${fmtMoney(t.amount)}</p>`).join('');
  } else {
    pay.innerHTML = '<p class="hint">All even — nothing to settle!</p>';
  }
  tEls.settlement.appendChild(pay);

  if (biggestHand) {
    const stat = document.createElement('p');
    stat.className = 'settle-stat';
    stat.textContent = `🏆 Biggest hand: ${tracker.players[biggestHand.winner]} — ${biggestHand.tai} tai (${fmtMoney(biggestHand.collect)}) on hand #${biggestHand.hand}`;
    tEls.settlement.appendChild(stat);
  }

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'record-btn settle-copy';
  copyBtn.textContent = '📋 Copy summary';
  copyBtn.addEventListener('click', () => {
    const text = trackerSummaryText();
    const done = () => { copyBtn.textContent = '✅ Copied!'; setTimeout(() => { copyBtn.textContent = '📋 Copy summary'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  });
  tEls.settlement.appendChild(copyBtn);
}

function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* best effort */ }
  document.body.removeChild(ta);
  done();
}

/* ---------- init ---------- */

function renderTracker() {
  renderTrackerState();
  renderTrackerStakes();
  renderTrackerPlayers();
  renderTrackerBite();
  renderTrackerEntry();
  renderSettlement();
  renderTrackerHistory();
}

tEls.undo.addEventListener('click', () => { trackerUndo(); renderTracker(); });
tEls.finish.addEventListener('click', () => {
  settlementVisible = !settlementVisible;
  tEls.finish.textContent = settlementVisible ? '🏁 Hide settlement' : '🏁 Finish game';
  renderTracker();
});
tEls.reset.addEventListener('click', () => {
  if (confirm('Reset the whole game? History will be cleared.')) {
    trackerReset();
    renderTracker();
  }
});

trackerLoad();
renderTracker();
