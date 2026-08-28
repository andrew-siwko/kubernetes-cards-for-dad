const Uno = (() => {
  const HUMAN = 0;
  const NAMES = ['You', 'Left', 'Top', 'Right'];
  const COLORS = ['red', 'yellow', 'green', 'blue'];
  const COLOR_SWATCH = { red: '#d1443c', yellow: '#e0c22b', green: '#3c9a4c', blue: '#2f6fd6' };
  const TARGET_SCORE = 500;
  const AI_DELAY_MS = 700;

  let root, statusEl, state, aiTimer;

  function buildDeck() {
    const deck = [];
    let id = 0;
    for (const color of COLORS) {
      deck.push({ id: `${color}-0-${id++}`, color, type: 'number', value: 0 });
      for (let v = 1; v <= 9; v++) {
        for (let k = 0; k < 2; k++) deck.push({ id: `${color}-${v}-${id++}`, color, type: 'number', value: v });
      }
      for (const type of ['skip', 'reverse', 'draw2']) {
        for (let k = 0; k < 2; k++) deck.push({ id: `${color}-${type}-${id++}`, color, type });
      }
    }
    for (let k = 0; k < 4; k++) deck.push({ id: `wild-${id++}`, color: 'wild', type: 'wild' });
    for (let k = 0; k < 4; k++) deck.push({ id: `wild4-${id++}`, color: 'wild', type: 'wild4' });
    return deck;
  }

  function shuffleUno(deck) {
    const d = deck.slice();
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function cardLabel(card) {
    if (card.type === 'number') return String(card.value);
    if (card.type === 'skip') return '⊘';
    if (card.type === 'reverse') return '⇄';
    if (card.type === 'draw2') return '+2';
    if (card.type === 'wild') return '★';
    if (card.type === 'wild4') return '+4';
    return '';
  }

  function pointValue(card) {
    if (card.type === 'number') return card.value;
    if (card.type === 'wild' || card.type === 'wild4') return 50;
    return 20;
  }

  function unoCardEl(card, opts) {
    opts = opts || {};
    const el = document.createElement('div');
    const color = card.faceDown ? null : card.color;
    el.className = 'uno-card' + (card.faceDown ? ' face-down' : ` uno-${color}`) + (opts.playable ? ' playable' : '') + (opts.selected ? ' selected' : '');
    if (!card.faceDown) {
      el.innerHTML = `<span class="uno-corner top">${cardLabel(card)}</span><span class="uno-pip">${cardLabel(card)}</span><span class="uno-corner bottom">${cardLabel(card)}</span>`;
    }
    return el;
  }

  function setStatus(msg) {
    statusEl.textContent = msg || '';
  }

  function clearAiTimer() {
    if (aiTimer) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
  }

  function newMatch() {
    return {
      scores: [0, 0, 0, 0],
      round: 0,
      startingPlayer: 0,
      hands: [],
      drawPile: [],
      discardPile: [],
      direction: 1,
      currentPlayer: 0,
      currentColor: null,
      drawnCard: null,
      pendingWild: null,
      phase: 'playing',
      matchOver: false,
    };
  }

  function topCard(match) {
    return match.discardPile[match.discardPile.length - 1];
  }

  function reshuffleIfNeeded(match) {
    if (match.drawPile.length > 0) return;
    const top = match.discardPile.pop();
    const rest = match.discardPile.map((c) => ({ ...c, color: c.type === 'wild' || c.type === 'wild4' ? 'wild' : c.color }));
    match.discardPile = [top];
    match.drawPile = shuffleUno(rest);
  }

  function drawOne(match, playerIndex) {
    reshuffleIfNeeded(match);
    const card = match.drawPile.pop();
    if (card) match.hands[playerIndex].push(card);
    return card;
  }

  function dealRound(match) {
    let deck = shuffleUno(buildDeck());
    const hands = [[], [], [], []];
    for (let r = 0; r < 7; r++) {
      for (let p = 0; p < 4; p++) hands[p].push(deck.pop());
    }
    match.hands = hands;
    match.drawPile = deck;
    match.discardPile = [];
    match.direction = 1;
    match.drawnCard = null;
    match.pendingWild = null;
    match.phase = 'playing';

    let starter = match.drawPile.pop();
    while (starter.type === 'wild4') {
      match.drawPile.unshift(starter);
      match.drawPile = shuffleUno(match.drawPile);
      starter = match.drawPile.pop();
    }
    match.discardPile.push(starter);
    match.currentColor = starter.color === 'wild' ? null : starter.color;
    match.currentPlayer = match.startingPlayer;

    if (starter.type === 'wild') {
      if (match.currentPlayer === HUMAN) {
        match.phase = 'choosing-color';
        match.pendingWild = { forStart: true };
        setStatus('Pick a color to start the round.');
        render();
        return;
      }
      match.currentColor = aiChooseColor(match.currentPlayer);
      setStatus(`${NAMES[match.currentPlayer]} starts with ${match.currentColor}.`);
    } else if (starter.type === 'skip') {
      setStatus(`${NAMES[match.currentPlayer]} is skipped to start.`);
      match.currentPlayer = advance(match, match.currentPlayer, 1);
    } else if (starter.type === 'reverse') {
      match.direction *= -1;
      setStatus('Direction reversed to start.');
    } else if (starter.type === 'draw2') {
      const victim = match.currentPlayer;
      drawOne(match, victim);
      drawOne(match, victim);
      setStatus(`${NAMES[victim]} draws 2 to start and is skipped.`);
      match.currentPlayer = advance(match, victim, 1);
    }

    render();
    scheduleTurn();
  }

  function advance(match, from, steps) {
    let idx = from;
    for (let i = 0; i < steps; i++) idx = (idx + match.direction + 4) % 4;
    return idx;
  }

  function isPlayable(card, color, top) {
    if (card.type === 'wild' || card.type === 'wild4') return true;
    if (card.color === color) return true;
    if (card.type === 'number' && top.type === 'number' && card.value === top.value) return true;
    if (card.type !== 'number' && card.type === top.type) return true;
    return false;
  }

  function legalPlays(playerIndex) {
    const top = topCard(state);
    return state.hands[playerIndex].filter((c) => isPlayable(c, state.currentColor, top));
  }

  function aiChooseColor(playerIndex) {
    const counts = { red: 0, yellow: 0, green: 0, blue: 0 };
    state.hands[playerIndex].forEach((c) => {
      if (COLORS.includes(c.color)) counts[c.color] += 1;
    });
    let best = COLORS[0];
    COLORS.forEach((c) => {
      if (counts[c] > counts[best]) best = c;
    });
    return best;
  }

  function aiChooseCard(playerIndex) {
    const options = legalPlays(playerIndex);
    const nonWild = options.filter((c) => c.type !== 'wild' && c.type !== 'wild4');
    const pool = nonWild.length ? nonWild : options;
    const priority = { draw2: 3, skip: 2, reverse: 2, number: 1, wild4: 0, wild: 0 };
    return pool.slice().sort((a, b) => (priority[b.type] || 0) - (priority[a.type] || 0) || (b.value || 0) - (a.value || 0))[0];
  }

  function afterHandEmpty(match, winner) {
    let points = 0;
    for (let i = 0; i < 4; i++) {
      if (i === winner) continue;
      points += match.hands[i].reduce((sum, c) => sum + pointValue(c), 0);
    }
    match.scores[winner] += points;
    match.startingPlayer = winner;

    if (match.scores[winner] >= TARGET_SCORE) {
      match.matchOver = true;
      match.phase = 'game-over';
      setStatus(`${NAMES[winner]} wins the match with ${match.scores[winner]} points!`);
      render();
      return;
    }

    setStatus(`${NAMES[winner]} went out and scores ${points} points. Starting next round...`);
    render();
    aiTimer = setTimeout(() => {
      match.round += 1;
      dealRound(match);
    }, 2400);
  }

  function finalizePlay(playerIndex, card, chosenColor) {
    state.hands[playerIndex] = state.hands[playerIndex].filter((c) => c.id !== card.id);
    state.discardPile.push(card);
    state.drawnCard = null;

    if (state.hands[playerIndex].length === 0) {
      state.currentColor = chosenColor || card.color;
      render();
      afterHandEmpty(state, playerIndex);
      return;
    }

    const wentToOne = state.hands[playerIndex].length === 1;
    let next = advance(state, playerIndex, 1);
    let note = '';

    if (card.type === 'number') {
      state.currentColor = card.color;
    } else if (card.type === 'skip') {
      state.currentColor = card.color;
      note = `${NAMES[next]} is skipped.`;
      next = advance(state, next, 1);
    } else if (card.type === 'reverse') {
      state.currentColor = card.color;
      state.direction *= -1;
      next = advance(state, playerIndex, 1);
      note = 'Direction reversed.';
    } else if (card.type === 'draw2') {
      state.currentColor = card.color;
      const victim = next;
      drawOne(state, victim);
      drawOne(state, victim);
      note = `${NAMES[victim]} draws 2 and is skipped.`;
      next = advance(state, victim, 1);
    } else if (card.type === 'wild') {
      state.currentColor = chosenColor;
      note = `${NAMES[playerIndex]} chose ${chosenColor}.`;
    } else if (card.type === 'wild4') {
      state.currentColor = chosenColor;
      const victim = next;
      drawOne(state, victim);
      drawOne(state, victim);
      drawOne(state, victim);
      drawOne(state, victim);
      note = `${NAMES[playerIndex]} chose ${chosenColor}. ${NAMES[victim]} draws 4 and is skipped.`;
      next = advance(state, victim, 1);
    }

    state.currentPlayer = next;
    state.phase = 'playing';
    state.pendingWild = null;
    setStatus(wentToOne ? `${NAMES[playerIndex]} has UNO! ${note}`.trim() : note);
    render();
    scheduleTurn();
  }

  function playCard(playerIndex, card) {
    if (card.type === 'wild' || card.type === 'wild4') {
      if (playerIndex === HUMAN) {
        state.phase = 'choosing-color';
        state.pendingWild = { card };
        render();
        return;
      }
      finalizePlay(playerIndex, card, aiChooseColor(playerIndex));
      return;
    }
    finalizePlay(playerIndex, card, null);
  }

  function chooseColor(color) {
    if (state.phase !== 'choosing-color' || !state.pendingWild) return;
    if (state.pendingWild.forStart) {
      state.currentColor = color;
      state.pendingWild = null;
      state.phase = 'playing';
      setStatus(`You start with ${color}.`);
      render();
      scheduleTurn();
      return;
    }
    finalizePlay(HUMAN, state.pendingWild.card, color);
  }

  function scheduleTurn() {
    if (state.currentPlayer === HUMAN) {
      setStatus(legalPlays(HUMAN).length ? 'Your turn — play a card or draw.' : 'Your turn — no playable card, draw one.');
      return;
    }
    aiTimer = setTimeout(runAiTurn, AI_DELAY_MS);
  }

  function runAiTurn() {
    const p = state.currentPlayer;
    const options = legalPlays(p);
    if (options.length) {
      playCard(p, aiChooseCard(p));
      return;
    }
    const drawn = drawOne(state, p);
    const top = topCard(state);
    if (drawn && isPlayable(drawn, state.currentColor, top)) {
      aiTimer = setTimeout(() => playCard(p, drawn), AI_DELAY_MS);
      return;
    }
    setStatus(`${NAMES[p]} draws a card.`);
    state.currentPlayer = advance(state, p, 1);
    render();
    scheduleTurn();
  }

  function onHandCardClick(card) {
    if (state.phase !== 'playing' || state.currentPlayer !== HUMAN) return;
    if (state.drawnCard && state.drawnCard.id !== card.id) return;
    const legal = legalPlays(HUMAN);
    if (!legal.some((c) => c.id === card.id)) {
      setStatus("You can't play that card right now.");
      return;
    }
    playCard(HUMAN, card);
  }

  function onDrawPileClick() {
    if (state.phase !== 'playing' || state.currentPlayer !== HUMAN || state.drawnCard) return;
    const card = drawOne(state, HUMAN);
    if (!card) return;
    const top = topCard(state);
    if (isPlayable(card, state.currentColor, top)) {
      state.drawnCard = card;
      setStatus('You drew a playable card — play it or pass.');
      render();
    } else {
      setStatus('You drew a card that cannot be played. Turn passes.');
      state.currentPlayer = advance(state, HUMAN, 1);
      render();
      scheduleTurn();
    }
  }

  function passTurn() {
    if (state.phase !== 'playing' || state.currentPlayer !== HUMAN || !state.drawnCard) return;
    state.drawnCard = null;
    state.currentPlayer = advance(state, HUMAN, 1);
    render();
    scheduleTurn();
  }

  function render() {
    root.innerHTML = '';
    const board = document.createElement('div');
    board.className = 'uno-board';

    const scorebar = document.createElement('div');
    scorebar.className = 'hearts-scorebar';
    NAMES.forEach((name, i) => {
      const chip = document.createElement('div');
      chip.className = 'score-chip' + (state.phase !== 'game-over' && state.currentPlayer === i ? ' active' : '');
      chip.textContent = `${name}: ${state.scores[i]} (${state.hands[i] ? state.hands[i].length : 0} cards)`;
      scorebar.appendChild(chip);
    });
    board.appendChild(scorebar);

    const seats = document.createElement('div');
    seats.className = 'hearts-seats';

    const top = document.createElement('div');
    top.className = 'seat seat-top';
    top.appendChild(opponentHand(2));
    seats.appendChild(top);

    const middleRow = document.createElement('div');
    middleRow.className = 'seat-middle-row';

    const left = document.createElement('div');
    left.className = 'seat seat-left';
    left.appendChild(opponentHand(1));
    middleRow.appendChild(left);

    const center = document.createElement('div');
    center.className = 'trick-area uno-table';
    center.appendChild(pilesView());
    middleRow.appendChild(center);

    const right = document.createElement('div');
    right.className = 'seat seat-right';
    right.appendChild(opponentHand(3));
    middleRow.appendChild(right);

    seats.appendChild(middleRow);
    board.appendChild(seats);

    const bottom = document.createElement('div');
    bottom.className = 'seat seat-bottom';
    bottom.appendChild(humanHand());
    board.appendChild(bottom);

    if (state.phase === 'choosing-color') {
      board.appendChild(colorPicker());
    }

    root.appendChild(board);
  }

  function pilesView() {
    const wrap = document.createElement('div');
    wrap.className = 'uno-piles';

    const drawWrap = document.createElement('div');
    drawWrap.className = 'uno-pile-wrap';
    const drawCard = unoCardEl({ faceDown: true });
    if (state.phase === 'playing' && state.currentPlayer === HUMAN && !state.drawnCard) {
      drawCard.classList.add('playable');
      drawCard.addEventListener('click', onDrawPileClick);
    }
    drawWrap.appendChild(drawCard);
    const drawLabel = document.createElement('div');
    drawLabel.className = 'seat-label';
    drawLabel.textContent = `Draw (${state.drawPile.length})`;
    drawWrap.appendChild(drawLabel);
    wrap.appendChild(drawWrap);

    const discardWrap = document.createElement('div');
    discardWrap.className = 'uno-pile-wrap';
    const top = topCard(state);
    if (top) discardWrap.appendChild(unoCardEl(top));
    const colorLabel = document.createElement('div');
    colorLabel.className = 'seat-label';
    colorLabel.textContent = state.currentColor ? `Color: ${state.currentColor}` : '';
    if (state.currentColor) colorLabel.style.color = COLOR_SWATCH[state.currentColor];
    discardWrap.appendChild(colorLabel);
    wrap.appendChild(discardWrap);

    if (state.drawnCard) {
      const passBtn = document.createElement('button');
      passBtn.textContent = 'Pass';
      passBtn.className = 'uno-pass-btn';
      passBtn.addEventListener('click', passTurn);
      wrap.appendChild(passBtn);
    }

    return wrap;
  }

  function opponentHand(playerIndex) {
    const wrap = document.createElement('div');
    wrap.className = 'opponent-hand';
    const row = document.createElement('div');
    row.className = 'card-row';
    const count = state.hands[playerIndex] ? state.hands[playerIndex].length : 0;
    for (let i = 0; i < count; i++) {
      row.appendChild(unoCardEl({ faceDown: true }));
    }
    wrap.appendChild(row);
    const label = document.createElement('div');
    label.className = 'seat-label';
    label.textContent = `${NAMES[playerIndex]} (${count})${count === 1 ? ' UNO!' : ''}`;
    wrap.appendChild(label);
    return wrap;
  }

  function humanHand() {
    const wrap = document.createElement('div');
    wrap.className = 'human-hand';
    const hand = state.hands[HUMAN] || [];
    const canAct = state.phase === 'playing' && state.currentPlayer === HUMAN;
    const legal = canAct ? legalPlays(HUMAN) : [];
    hand.forEach((card) => {
      const playable = canAct && (state.drawnCard ? state.drawnCard.id === card.id : legal.some((c) => c.id === card.id));
      const el = unoCardEl(card, { playable, selected: state.drawnCard && state.drawnCard.id === card.id });
      el.addEventListener('click', () => onHandCardClick(card));
      wrap.appendChild(el);
    });
    return wrap;
  }

  function colorPicker() {
    const overlay = document.createElement('div');
    overlay.className = 'uno-color-picker';
    const title = document.createElement('div');
    title.className = 'uno-color-title';
    title.textContent = 'Choose a color';
    overlay.appendChild(title);
    const row = document.createElement('div');
    row.className = 'uno-color-row';
    COLORS.forEach((color) => {
      const swatch = document.createElement('button');
      swatch.className = 'uno-color-swatch';
      swatch.style.background = COLOR_SWATCH[color];
      swatch.title = color;
      swatch.addEventListener('click', () => chooseColor(color));
      row.appendChild(swatch);
    });
    overlay.appendChild(row);
    return overlay;
  }

  function undo() {
    setStatus("Uno can't be undone once a card is played.");
  }

  function newGame() {
    clearAiTimer();
    state = newMatch();
    dealRound(state);
  }

  function start(container, statusElement) {
    root = container;
    statusEl = statusElement;
    newGame();
  }

  return { start, newGame, undo };
})();
