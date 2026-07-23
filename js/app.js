/**
 * app.js — UI wiring: tile palette, hand tray, live analysis panel.
 */

const state = {
  counts: new Array(TILE_COUNT).fill(0),
};

const els = {
  palette: document.getElementById('palette'),
  hand: document.getElementById('hand'),
  handCount: document.getElementById('hand-count'),
  status: document.getElementById('status'),
  waits: document.getElementById('waits'),
  suggestions: document.getElementById('suggestions'),
  clearBtn: document.getElementById('clear-btn'),
  learnList: document.getElementById('learn-list'),
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
  update();
}

/* ---------- analysis panel ---------- */

function update() {
  refreshPaletteBadges();
  renderHand();
  const n = totalTiles();

  els.waits.innerHTML = '';
  els.status.className = 'status';

  if (n === 0) {
    setStatus('Tap tiles above to build your hand. Add 13 tiles to see your waits, or 14 to check a win.', 'idle');
    els.suggestions.innerHTML = '';
    return;
  }

  if (n === 14) {
    const analysis = analyzeWin(state.counts);
    if (analysis.win) {
      const matched = matchPatterns(analysis, state.counts);
      const names = matched.map(p => `${p.name} (${p.tai} tai)`).join(', ') || 'Chicken Hand (0 tai)';
      const totalTai = matched.reduce((sum, p) => sum + p.tai, 0);
      setStatus(`🎉 Winning hand — ${totalTai} tai! Patterns: ${names}`, 'win');
    } else {
      setStatus(`Not a winning hand — ${analysis.reason}`, 'no-win');
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
buildLearn();
els.clearBtn.addEventListener('click', clearHand);
update();
