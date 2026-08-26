const Hearts = (() => {
  const HUMAN = 0;
  const NAMES = ['You', 'Left', 'Top', 'Right'];
  const PASS_LABELS = ['left', 'right', 'across', 'no pass'];
  const TARGET_SCORE = 100;
  const AI_DELAY_MS = 700;

  let root, statusEl, state, aiTimer;

  function trickRank(card) {
    return card.value === 1 ? 14 : card.value;
  }

  function isQueenSpades(card) {
    return card.suit === '♠' && card.rank === 'Q';
  }

  function newMatch() {
    return {
      scores: [0, 0, 0, 0],
      round: 0,
      phase: 'passing',
      hands: [],
      passSelection: [],
      passed: [false, false, false, false],
      pendingPasses: null,
      currentTrick: [],
      trickNumber: 0,
      trickLeader: 0,
      currentPlayer: 0,
      heartsBroken: false,
      handPoints: [0, 0, 0, 0],
      lastTrick: null,
      matchOver: false,
    };
  }

  function dealHand(match) {
    const deck = shuffle(makeDeck(SUITS)).map((c) => ({ ...c, faceUp: true }));
    const hands = [[], [], [], []];
    deck.forEach((card, idx) => hands[idx % 4].push(card));
    hands.forEach((h) => h.sort((a, b) => (a.suit === b.suit ? a.value - b.value : SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit))));
    match.hands = hands;
    match.passSelection = [];
    match.passed = [false, false, false, false];
    match.pendingPasses = null;
    match.currentTrick = [];
    match.trickNumber = 0;
    match.heartsBroken = false;
    match.handPoints = [0, 0, 0, 0];
    match.lastTrick = null;
    const passType = match.round % 4;
    match.phase = passType === 3 ? 'playing' : 'passing';
    if (match.phase === 'playing') {
      startPlayFromDeal(match);
    } else {
      setStatus('');
      render();
    }
  }

  function passTarget(playerIndex, round) {
    const passType = round % 4;
    if (passType === 0) return (playerIndex + 1) % 4;
    if (passType === 1) return (playerIndex + 3) % 4;
    if (passType === 2) return (playerIndex + 2) % 4;
    return playerIndex;
  }

  function aiChoosePassCards(hand) {
    const danger = (c) => {
      if (isQueenSpades(c)) return 100;
      if (c.suit === '♠' && trickRank(c) >= trickRank({ value: 12 })) return 60 + trickRank(c);
      if (c.suit === '♥') return 40 + trickRank(c);
      return trickRank(c);
    };
    return hand
      .slice()
      .sort((a, b) => danger(b) - danger(a))
      .slice(0, 3);
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

  function executePasses() {
    const outgoing = state.hands.map((hand, i) => (i === HUMAN ? state.passSelection : aiChoosePassCards(hand)));
    for (let i = 0; i < 4; i++) {
      const ids = new Set(outgoing[i].map((c) => c.id));
      state.hands[i] = state.hands[i].filter((c) => !ids.has(c.id));
    }
    for (let i = 0; i < 4; i++) {
      const target = passTarget(i, state.round);
      state.hands[target].push(...outgoing[i]);
    }
    state.hands.forEach((h) => h.sort((a, b) => (a.suit === b.suit ? a.value - b.value : SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit))));
    state.phase = 'playing';
    startPlayFromDeal(state);
  }

  function startPlayFromDeal(match) {
    let leader = 0;
    for (let i = 0; i < 4; i++) {
      if (match.hands[i].some((c) => c.suit === '♣' && c.rank === '2')) leader = i;
    }
    match.trickLeader = leader;
    match.currentPlayer = leader;
    setStatus('');
    render();
    scheduleTurn();
  }

  function legalPlays(playerIndex) {
    const hand = state.hands[playerIndex];
    const leading = state.currentTrick.length === 0;
    if (leading) {
      if (state.trickNumber === 0) {
        const twoClubs = hand.filter((c) => c.suit === '♣' && c.rank === '2');
        return twoClubs.length ? twoClubs : hand.slice();
      }
      if (!state.heartsBroken) {
        const nonHearts = hand.filter((c) => c.suit !== '♥');
        if (nonHearts.length) return nonHearts;
      }
      return hand.slice();
    }
    const ledSuit = state.currentTrick[0].card.suit;
    const followers = hand.filter((c) => c.suit === ledSuit);
    if (followers.length) return followers;
    if (state.trickNumber === 0) {
      const safe = hand.filter((c) => c.suit !== '♥' && !isQueenSpades(c));
      if (safe.length) return safe;
    }
    return hand.slice();
  }

  function aiChooseCard(playerIndex) {
    const options = legalPlays(playerIndex);
    const leading = state.currentTrick.length === 0;
    if (leading) {
      if (options.length === 1) return options[0];
      const bySuitCount = {};
      state.hands[playerIndex].forEach((c) => {
        bySuitCount[c.suit] = (bySuitCount[c.suit] || 0) + 1;
      });
      const sorted = options.slice().sort((a, b) => {
        const countDiff = bySuitCount[a.suit] - bySuitCount[b.suit];
        if (countDiff !== 0) return countDiff;
        return trickRank(a) - trickRank(b);
      });
      return sorted[0];
    }
    const ledSuit = state.currentTrick[0].card.suit;
    const followers = options.filter((c) => c.suit === ledSuit);
    if (followers.length) {
      const highestInTrick = state.currentTrick
        .filter((e) => e.card.suit === ledSuit)
        .reduce((max, e) => Math.max(max, trickRank(e.card)), 0);
      const safe = followers.filter((c) => trickRank(c) < highestInTrick);
      if (safe.length) {
        return safe.reduce((best, c) => (trickRank(c) > trickRank(best) ? c : best), safe[0]);
      }
      return followers.reduce((low, c) => (trickRank(c) < trickRank(low) ? c : low), followers[0]);
    }
    const qs = options.find(isQueenSpades);
    if (qs) return qs;
    const hearts = options.filter((c) => c.suit === '♥');
    if (hearts.length) return hearts.reduce((max, c) => (trickRank(c) > trickRank(max) ? c : max), hearts[0]);
    return options.reduce((max, c) => (trickRank(c) > trickRank(max) ? c : max), options[0]);
  }

  function playCard(playerIndex, card) {
    state.hands[playerIndex] = state.hands[playerIndex].filter((c) => c.id !== card.id);
    state.currentTrick.push({ player: playerIndex, card });
    if (card.suit === '♥') state.heartsBroken = true;
    render();

    if (state.currentTrick.length === 4) {
      aiTimer = setTimeout(finishTrick, AI_DELAY_MS);
      return;
    }
    state.currentPlayer = (playerIndex + 1) % 4;
    render();
    scheduleTurn();
  }

  function finishTrick() {
    const ledSuit = state.currentTrick[0].card.suit;
    let winnerEntry = state.currentTrick[0];
    for (const entry of state.currentTrick) {
      if (entry.card.suit === ledSuit && trickRank(entry.card) > trickRank(winnerEntry.card)) winnerEntry = entry;
    }
    const points = state.currentTrick.reduce(
      (sum, e) => sum + (e.card.suit === '♥' ? 1 : 0) + (isQueenSpades(e.card) ? 13 : 0),
      0
    );
    state.handPoints[winnerEntry.player] += points;
    state.lastTrick = { cards: state.currentTrick, winner: winnerEntry.player };
    state.currentTrick = [];
    state.trickNumber += 1;
    state.trickLeader = winnerEntry.player;
    state.currentPlayer = winnerEntry.player;

    if (state.trickNumber === 13) {
      finishHand();
      return;
    }
    render();
    scheduleTurn();
  }

  function finishHand() {
    let moonShooter = -1;
    for (let i = 0; i < 4; i++) {
      if (state.handPoints[i] === 26) moonShooter = i;
    }
    if (moonShooter >= 0) {
      for (let i = 0; i < 4; i++) {
        state.scores[i] += i === moonShooter ? 0 : 26;
      }
    } else {
      for (let i = 0; i < 4; i++) state.scores[i] += state.handPoints[i];
    }

    if (state.scores.some((s) => s >= TARGET_SCORE)) {
      state.matchOver = true;
      state.phase = 'game-over';
      const min = Math.min(...state.scores);
      const winners = NAMES.filter((_, i) => state.scores[i] === min);
      setStatus(
        moonShooter >= 0
          ? `${NAMES[moonShooter]} shot the moon! Game over — ${winners.join(', ')} win${winners.length === 1 ? 's' : ''} with the lowest score.`
          : `Game over — ${winners.join(', ')} win${winners.length === 1 ? 's' : ''} with the lowest score.`
      );
      render();
      return;
    }

    setStatus(
      moonShooter >= 0
        ? `${NAMES[moonShooter]} shot the moon! Starting next hand...`
        : 'Hand over. Starting next hand...'
    );
    render();
    aiTimer = setTimeout(() => {
      state.round += 1;
      dealHand(state);
    }, 2200);
  }

  function scheduleTurn() {
    if (state.currentPlayer === HUMAN) {
      setStatus(describeTurnHint());
      return;
    }
    aiTimer = setTimeout(() => {
      const card = aiChooseCard(state.currentPlayer);
      playCard(state.currentPlayer, card);
    }, AI_DELAY_MS);
  }

  function describeTurnHint() {
    if (state.currentTrick.length === 0) return state.trickNumber === 0 ? 'Lead the 2 of clubs.' : 'Your lead.';
    return 'Your turn to play.';
  }

  function onHandCardClick(card) {
    if (state.phase === 'passing') {
      if (state.passed[HUMAN]) return;
      const idx = state.passSelection.findIndex((c) => c.id === card.id);
      if (idx >= 0) {
        state.passSelection.splice(idx, 1);
      } else if (state.passSelection.length < 3) {
        state.passSelection.push(card);
      }
      render();
      return;
    }
    if (state.phase !== 'playing' || state.currentPlayer !== HUMAN) return;
    const legal = legalPlays(HUMAN);
    if (!legal.some((c) => c.id === card.id)) {
      setStatus(illegalReason(card, legal));
      return;
    }
    playCard(HUMAN, card);
  }

  function illegalReason(card, legal) {
    if (state.trickNumber === 0 && state.currentTrick.length === 0) return 'The first trick must be led with the 2 of clubs.';
    if (state.currentTrick.length === 0) return "You can't lead a heart until hearts have been broken.";
    const ledSuit = state.currentTrick[0].card.suit;
    if (legal.length && legal[0].suit === ledSuit) return `You must follow suit (${ledSuit}).`;
    return "You can't play that card on the first trick.";
  }

  function confirmPass() {
    if (state.passSelection.length !== 3) {
      setStatus('Select exactly 3 cards to pass.');
      return;
    }
    state.passed[HUMAN] = true;
    executePasses();
  }

  function render() {
    root.innerHTML = '';
    const board = document.createElement('div');
    board.className = 'hearts-board';

    const scorebar = document.createElement('div');
    scorebar.className = 'hearts-scorebar';
    NAMES.forEach((name, i) => {
      const chip = document.createElement('div');
      chip.className = 'score-chip' + (state.phase === 'playing' && state.currentPlayer === i ? ' active' : '');
      chip.textContent = `${name}: ${state.scores[i]}${state.phase !== 'passing' ? ` (+${state.handPoints[i]})` : ''}`;
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
    center.className = 'trick-area';
    center.appendChild(trickView());
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

    if (state.phase === 'passing' && !state.passed[HUMAN]) {
      const passBar = document.createElement('div');
      passBar.className = 'pass-bar';
      const passType = state.round % 4;
      const label = document.createElement('span');
      label.textContent = `Choose 3 cards to pass ${PASS_LABELS[passType]} (${state.passSelection.length}/3 selected)`;
      passBar.appendChild(label);
      const btn = document.createElement('button');
      btn.textContent = 'Pass Cards';
      btn.disabled = state.passSelection.length !== 3;
      btn.addEventListener('click', confirmPass);
      passBar.appendChild(btn);
      board.appendChild(passBar);
    }

    root.appendChild(board);
  }

  function opponentHand(playerIndex) {
    const wrap = document.createElement('div');
    wrap.className = 'opponent-hand';
    const row = document.createElement('div');
    row.className = 'card-row';
    const count = state.hands[playerIndex] ? state.hands[playerIndex].length : 0;
    for (let i = 0; i < count; i++) {
      row.appendChild(cardEl({ faceUp: false }));
    }
    wrap.appendChild(row);
    const label = document.createElement('div');
    label.className = 'seat-label';
    label.textContent = `${NAMES[playerIndex]} (${count})`;
    wrap.appendChild(label);
    return wrap;
  }

  function trickView() {
    const wrap = document.createElement('div');
    wrap.className = 'current-trick';
    const cardsToShow = state.currentTrick.length ? state.currentTrick : state.lastTrick ? state.lastTrick.cards : [];
    cardsToShow.forEach((entry) => {
      const slot = document.createElement('div');
      slot.className = 'trick-slot trick-' + NAMES[entry.player].toLowerCase();
      const el = cardEl(entry.card, false);
      slot.appendChild(el);
      const tag = document.createElement('div');
      tag.className = 'trick-tag';
      tag.textContent = NAMES[entry.player];
      slot.appendChild(tag);
      wrap.appendChild(slot);
    });
    if (!cardsToShow.length) {
      const empty = document.createElement('div');
      empty.className = 'trick-empty';
      empty.textContent = state.phase === 'passing' ? 'Passing phase' : '';
      wrap.appendChild(empty);
    }
    return wrap;
  }

  function humanHand() {
    const wrap = document.createElement('div');
    wrap.className = 'human-hand';
    const hand = state.hands[HUMAN] || [];
    const legal = state.phase === 'playing' && state.currentPlayer === HUMAN ? legalPlays(HUMAN) : [];
    hand.forEach((card) => {
      const selected = state.phase === 'passing' && state.passSelection.some((c) => c.id === card.id);
      const el = cardEl(card, selected);
      if (state.phase === 'passing' ? !state.passed[HUMAN] : legal.some((c) => c.id === card.id)) {
        el.classList.add('playable');
      }
      el.addEventListener('click', () => onHandCardClick(card));
      wrap.appendChild(el);
    });
    return wrap;
  }

  function undo() {
    setStatus("Hearts can't be undone once a card is played.");
  }

  function newGame() {
    clearAiTimer();
    state = newMatch();
    dealHand(state);
  }

  function start(container, statusElement) {
    root = container;
    statusEl = statusElement;
    newGame();
  }

  return { start, newGame, undo };
})();
