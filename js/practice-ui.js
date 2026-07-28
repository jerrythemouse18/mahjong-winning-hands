/**
 * practice-ui.js — DOM wiring for the Practice tab.
 */

const PRACTICE_STORAGE_KEY = 'mahjong-practice-v1';

const practice = {
  mode: 'waits', // 'waits' | 'discard'
  quiz: null,
  answer: new Set(), // waits: selected tile ids; discard: single id
  revealed: false,
  streak: 0,
  best: 0,
};

const pEls = {
  modes: document.getElementById('practice-modes'),
  streak: document.getElementById('practice-streak'),
  title: document.getElementById('practice-title'),
  hand: document.getElementById('practice-hand'),
  prompt: document.getElementById('practice-prompt'),
  answer: document.getElementById('practice-answer'),
  result: document.getElementById('practice-result'),
  check: document.getElementById('practice-check'),
  next: document.getElementById('practice-next'),
};

/* ---------- persistence ---------- */

function practiceLoad() {
  try {
    const raw = localStorage.getItem(PRACTICE_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Number.isInteger(data.streak)) practice.streak = data.streak;
    if (Number.isInteger(data.best)) practice.best = data.best;
  } catch (e) { /* fresh start */ }
}

function practiceSave() {
  try {
    localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify({ streak: practice.streak, best: practice.best }));
  } catch (e) { /* private mode */ }
}

/* ---------- quiz lifecycle ---------- */

function newQuiz() {
  practice.answer = new Set();
  practice.revealed = false;
  if (practice.mode === 'waits') {
    practice.quiz = generateWaitsQuiz(Math.random);
  } else {
    practice.quiz = generateDiscardQuiz(Math.random);
  }
  renderPractice();
}

function scoreResult(correct) {
  if (correct) {
    practice.streak++;
    practice.best = Math.max(practice.best, practice.streak);
  } else {
    practice.streak = 0;
  }
  practiceSave();
}

/* ---------- rendering ---------- */

function renderPracticeModes() {
  pEls.modes.innerHTML = '';
  const modes = [
    { id: 'waits', label: '🎯 What are you waiting on?' },
    { id: 'discard', label: '🗑 Best discard' },
  ];
  for (const m of modes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stake-btn' + (practice.mode === m.id ? ' active' : '');
    btn.textContent = m.label;
    btn.addEventListener('click', () => { practice.mode = m.id; newQuiz(); });
    pEls.modes.appendChild(btn);
  }
  pEls.streak.innerHTML =
    `<span class="tracker-chip">Streak: <strong>${practice.streak}</strong></span>` +
    `<span class="tracker-chip">Best: <strong>${practice.best}</strong></span>`;
}

function renderPractice() {
  renderPracticeModes();
  pEls.hand.innerHTML = '';
  pEls.answer.innerHTML = '';
  pEls.result.innerHTML = '';
  pEls.check.disabled = practice.revealed;

  const q = practice.quiz;
  if (!q) return;

  // Render the dealt hand.
  for (let t = 0; t < TILE_COUNT; t++) {
    for (let k = 0; k < q.counts[t]; k++) {
      const btn = tileButton(t, practice.mode === 'discard' && !practice.revealed
        ? { onClick: id => { practice.answer = new Set([id]); renderPractice(); } }
        : {});
      if (practice.mode === 'discard' && practice.answer.has(t)) btn.classList.add('selected-tile');
      pEls.hand.appendChild(btn);
    }
  }

  if (practice.mode === 'waits') {
    pEls.title.textContent = '🎯 What are you waiting on?';
    pEls.prompt.textContent = 'This 13-tile hand is ready. Tap every tile that would complete it, then Check.';
    // 34-tile answer palette.
    const groups = [[...Array(9)].map((_, i) => i), [...Array(9)].map((_, i) => 9 + i),
      [...Array(9)].map((_, i) => 18 + i), [27, 28, 29, 30, 31, 32, 33]];
    for (const ids of groups) {
      const row = document.createElement('div');
      row.className = 'palette-row practice-palette-row';
      for (const id of ids) {
        const btn = tileButton(id, {
          onClick: practice.revealed ? undefined : tid => {
            if (practice.answer.has(tid)) practice.answer.delete(tid);
            else practice.answer.add(tid);
            renderPractice();
          },
        });
        btn.classList.add('mini');
        if (practice.answer.has(id)) btn.classList.add('selected-tile');
        if (practice.revealed) {
          if (q.waits.includes(id)) btn.classList.add('reveal-hit');
          else if (practice.answer.has(id)) btn.classList.add('reveal-extra');
        }
        row.appendChild(btn);
      }
      pEls.answer.appendChild(row);
    }
  } else {
    pEls.title.textContent = '🗑 Best discard';
    pEls.prompt.textContent = 'This 14-tile hand is not a win. Tap the tile you would throw, then Check.';
  }
}

function checkAnswer() {
  if (practice.revealed || !practice.quiz) return;
  const q = practice.quiz;
  let html = '';
  if (practice.mode === 'waits') {
    const g = gradeWaits([...practice.answer], q.waits);
    scoreResult(g.correct);
    const waitNames = q.waits.map(tileNotation).join(', ');
    html = g.correct
      ? `<p class="status win">✅ Correct — waiting on ${waitNames}.</p>`
      : `<p class="status no-win">❌ Not quite. The waits are: ${waitNames}.` +
        (g.misses.length ? ` You missed ${g.misses.map(tileNotation).join(', ')}.` : '') +
        (g.extras.length ? ` ${g.extras.map(tileNotation).join(', ')} do${g.extras.length === 1 ? 'es' : ''} not win.` : '') + '</p>';
  } else {
    if (!practice.answer.size) return;
    const tile = [...practice.answer][0];
    const g = gradeDiscard(tile, q.options);
    scoreResult(g.grade === 'full');
    const bestNames = q.options
      .filter(o => o.shanten === q.options[0].shanten && o.ukeire === q.options[0].ukeire)
      .map(o => tileNotation(o.tile)).join(' or ');
    if (g.grade === 'full') {
      html = `<p class="status win">✅ Best choice! ${tileNotation(tile)} keeps you closest to ready with the most live tiles.</p>`;
    } else if (g.grade === 'good') {
      html = `<p class="status building">🟡 Decent — same distance to ready, but ${bestNames} keeps more winning chances (${q.options[0].ukeire} vs ${g.pick.ukeire} live tiles).</p>`;
    } else {
      html = `<p class="status no-win">❌ ${tileNotation(tile)} sets you back. Better: ${bestNames} (${q.options[0].shanten === 0 ? 'ready' : q.options[0].shanten + ' from ready'}, ${q.options[0].ukeire} live tiles).</p>`;
    }
  }
  practice.revealed = true;
  renderPractice();
  pEls.result.innerHTML = html;
}

/* ---------- init ---------- */

pEls.check.addEventListener('click', checkAnswer);
pEls.next.addEventListener('click', newQuiz);
practiceLoad();
newQuiz();
