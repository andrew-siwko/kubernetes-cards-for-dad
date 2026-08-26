const Spider = (() => {
  const COLUMNS = 10;
  let root, state, history, selection, statusEl;

  function buildDeck() {
    const deck = [];
    let id = 0;
    for (let set = 0; set < 8; set++) {
      for (let i = 0; i < RANKS.length; i++) {
        deck.push({ id: `sp${id++}`, suit: '♠', rank: RANKS[i], value: i + 1, faceUp: false });
      }
    }
    return deck;
  }

  function newState() {
    const deck = shuffle(buildDeck());
    const tableau = Array.from({ length: COLUMNS }, () => []);
    let p = 0;
    for (let col = 0; col < COLUMNS; col++) {
      const count = col < 4 ? 6 : 5;
      for (let row = 0; row < count; row++) {
        const card = deck[p++];
        card.faceUp = row === count - 1;
        tableau[col].push(card);
      }
    }
    return { tableau, stock: deck.slice(p), completed: 0 };
  }

  function save() {
    history.push(state);
  }

  function clearSelection() {
    selection = null;
  }

  function setStatus(msg) {
    statusEl.textContent = msg || '';
  }

  function isValidRun(pile, startIdx) {
    if (!pile[startIdx] || !pile[startIdx].faceUp) return false;
    for (let i = startIdx; i < pile.length - 1; i++) {
      if (pile[i].value !== pile[i + 1].value + 1) return false;
    }
    return true;
  }

  function flipTopIfNeeded(col) {
    const pile = state.tableau[col];
    if (pile.length && !pile[pile.length - 1].faceUp) pile[pile.length - 1].faceUp = true;
  }

  function tryTarget(run, col) {
    const dest = state.tableau[col];
    if (dest.length === 0) return true;
    const top = dest[dest.length - 1];
    return top.faceUp && top.value === run[0].value + 1;
  }

  function removeCompletedRun(col) {
    const pile = state.tableau[col];
    if (pile.length < 13) return;
    const tail = pile.slice(pile.length - 13);
    for (let i = 0; i < 13; i++) {
      if (!tail[i].faceUp || tail[i].value !== 13 - i) return;
    }
    pile.splice(pile.length - 13, 13);
    state.completed += 1;
    flipTopIfNeeded(col);
  }

  function checkWin() {
    if (state.completed === 8) {
      setStatus('You win! 🎉');
      return true;
    }
    return false;
  }

  function dealStock() {
    setStatus('');
    if (state.stock.length === 0) return;
    if (state.tableau.some((p) => p.length === 0)) {
      setStatus('Fill every empty column before dealing more cards.');
      return;
    }
    save();
    for (let col = 0; col < COLUMNS; col++) {
      const card = state.stock.pop();
      card.faceUp = true;
      state.tableau[col].push(card);
    }
    for (let col = 0; col < COLUMNS; col++) removeCompletedRun(col);
    clearSelection();
    render();
    checkWin();
  }

  function moveSelectionTo(destCol) {
    if (!selection) return false;
    const { col, idx } = selection;
    if (col === destCol) return false;
    const source = state.tableau[col];
    const run = source.slice(idx);
    if (!tryTarget(run, destCol)) return false;
    save();
    source.splice(idx);
    state.tableau[destCol].push(...run);
    flipTopIfNeeded(col);
    removeCompletedRun(destCol);
    clearSelection();
    render();
    checkWin();
    return true;
  }

  function onCardClick(col, idx) {
    setStatus('');
    if (selection && selection.col === col && selection.idx === idx) {
      clearSelection();
      render();
      return;
    }
    if (selection) {
      if (moveSelectionTo(col)) return;
      clearSelection();
    }
    if (isValidRun(state.tableau[col], idx)) {
      selection = { col, idx };
    }
    render();
  }

  function onEmptyColumnClick(col) {
    setStatus('');
    if (selection) moveSelectionTo(col);
  }

  function undo() {
    if (!history.canUndo()) return;
    state = history.pop();
    clearSelection();
    setStatus('');
    render();
  }

  function newGame() {
    state = newState();
    history.clear();
    clearSelection();
    setStatus('');
    render();
  }

  function render() {
    root.innerHTML = '';
    const board = document.createElement('div');
    board.className = 'spider-board';

    const top = document.createElement('div');
    top.className = 'row top-row';

    const stockPile = document.createElement('div');
    stockPile.className = 'pile stock';
    if (state.stock.length) {
      stockPile.appendChild(cardEl({ faceUp: false }));
      const count = document.createElement('div');
      count.className = 'stock-count';
      count.textContent = `${state.stock.length / COLUMNS | 0} deals left`;
      stockPile.appendChild(count);
    } else {
      stockPile.appendChild(emptySlotEl(''));
    }
    stockPile.addEventListener('click', dealStock);
    top.appendChild(stockPile);

    const spacer = document.createElement('div');
    spacer.className = 'spacer';
    top.appendChild(spacer);

    const completedEl = document.createElement('div');
    completedEl.className = 'pile foundation completed-count';
    completedEl.textContent = `Completed: ${state.completed} / 8`;
    top.appendChild(completedEl);
    board.appendChild(top);

    const tableauRow = document.createElement('div');
    tableauRow.className = 'row tableau-row spider-row';
    state.tableau.forEach((pile, col) => {
      const colEl = document.createElement('div');
      colEl.className = 'pile tableau-col';
      if (pile.length === 0) {
        colEl.appendChild(emptySlotEl(''));
        colEl.addEventListener('click', () => onEmptyColumnClick(col));
      } else {
        pile.forEach((card, idx) => {
          const selected = !!(selection && selection.col === col && idx >= selection.idx);
          const el = cardEl(card, selected);
          if (card.faceUp) {
            el.addEventListener('click', (e) => {
              e.stopPropagation();
              onCardClick(col, idx);
            });
          }
          colEl.appendChild(el);
        });
        colEl.addEventListener('click', () => {
          if (selection) onEmptyColumnClick(col);
        });
      }
      tableauRow.appendChild(colEl);
    });
    board.appendChild(tableauRow);

    root.appendChild(board);
  }

  function start(container, statusElement) {
    root = container;
    statusEl = statusElement;
    history = makeHistory();
    newGame();
  }

  return { start, newGame, undo };
})();
