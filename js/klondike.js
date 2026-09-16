const Klondike = (() => {
  let root, state, history, selection, statusEl;
  let drawCount = 1;

  function newState() {
    const deck = shuffle(makeDeck(SUITS));
    const tableau = [[], [], [], [], [], [], []];
    let p = 0;
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck[p++];
        card.faceUp = row === col;
        tableau[col].push(card);
      }
    }
    const stock = deck.slice(p).map((c) => ({ ...c, faceUp: false }));
    return {
      stock,
      waste: [],
      foundations: { '♠': [], '♥': [], '♦': [], '♣': [] },
      tableau,
      moves: 0,
    };
  }

  function save() {
    history.push(state);
  }

  function isValidRun(pile, startIdx) {
    for (let i = startIdx; i < pile.length - 1; i++) {
      const a = pile[i], b = pile[i + 1];
      if (!a.faceUp || !b.faceUp) return false;
      if (isRed(a.suit) === isRed(b.suit)) return false;
      if (a.value !== b.value + 1) return false;
    }
    return pile[startIdx] && pile[startIdx].faceUp;
  }

  function selectable(pile, col, idx) {
    if (pile === 'waste') return idx === state.waste.length - 1;
    if (pile === 'tableau') return isValidRun(state.tableau[col], idx);
    return false;
  }

  function clearSelection() {
    selection = null;
  }

  function setStatus(msg) {
    statusEl.textContent = msg || '';
  }

  function checkWin() {
    const total = Object.values(state.foundations).reduce((n, f) => n + f.length, 0);
    if (total === 52) {
      setStatus(`You win in ${state.moves} moves! 🎉`);
      return true;
    }
    return false;
  }

  function toggleDraw() {
    drawCount = drawCount === 1 ? 3 : 1;
    render();
  }

  function drawStock() {
    if (state.stock.length === 0 && state.waste.length === 0) return;
    save();
    if (state.stock.length === 0) {
      state.stock = state.waste.reverse().map((c) => ({ ...c, faceUp: false }));
      state.waste = [];
    } else {
      const n = Math.min(drawCount, state.stock.length);
      for (let i = 0; i < n; i++) {
        const card = state.stock.pop();
        card.faceUp = true;
        state.waste.push(card);
      }
    }
    state.moves++;
    clearSelection();
    render();
  }

  function flipTopIfNeeded(col) {
    const pile = state.tableau[col];
    if (pile.length && !pile[pile.length - 1].faceUp) pile[pile.length - 1].faceUp = true;
  }

  function tryFoundation(card) {
    const f = state.foundations[card.suit];
    if (f.length === 0) return card.value === 1;
    return f[f.length - 1].value === card.value - 1;
  }

  function tryTableau(run, col) {
    const dest = state.tableau[col];
    const moving = run[0];
    if (dest.length === 0) return moving.value === 13;
    const top = dest[dest.length - 1];
    return top.faceUp && isRed(top.suit) !== isRed(moving.suit) && top.value === moving.value + 1;
  }

  function moveSelectionToFoundation() {
    if (!selection) return false;
    const { pile, col, idx } = selection;
    const source = pile === 'waste' ? state.waste : state.tableau[col];
    if (idx !== source.length - 1) return false;
    const card = source[idx];
    if (!tryFoundation(card)) return false;
    save();
    source.pop();
    state.foundations[card.suit].push(card);
    if (pile === 'tableau') flipTopIfNeeded(col);
    state.moves++;
    clearSelection();
    render();
    checkWin();
    return true;
  }

  function moveSelectionToTableau(destCol) {
    if (!selection) return false;
    const { pile, col, idx } = selection;
    const source = pile === 'waste' ? state.waste : state.tableau[col];
    const run = source.slice(idx);
    if (pile === 'tableau' && col === destCol) return false;
    if (!tryTableau(run, destCol)) return false;
    save();
    source.splice(idx);
    state.tableau[destCol].push(...run);
    if (pile === 'tableau') flipTopIfNeeded(col);
    state.moves++;
    clearSelection();
    render();
    return true;
  }

  function autoMoveToFoundation(pile, col, idx) {
    const source = pile === 'waste' ? state.waste : state.tableau[col];
    if (idx !== source.length - 1) return false;
    const card = source[idx];
    if (!tryFoundation(card)) return false;
    save();
    source.pop();
    state.foundations[card.suit].push(card);
    if (pile === 'tableau') flipTopIfNeeded(col);
    state.moves++;
    clearSelection();
    render();
    checkWin();
    return true;
  }

  function attachDrag(el, pile, col, idx) {
    el.draggable = true;
    el.addEventListener('dragstart', (e) => {
      if (!selectable(pile, col, idx)) {
        e.preventDefault();
        return;
      }
      selection = { pile, col, idx };
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', ''); } catch (err) { /* Safari */ }
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      if (selection && selection.pile === pile && selection.col === col && selection.idx === idx) {
        clearSelection();
        render();
      }
    });
  }

  function attachDropZone(el, onDrop) {
    el.addEventListener('dragover', (e) => {
      if (!selection) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag-over');
      onDrop();
    });
  }

  function onCardClick(pile, col, idx, evt) {
    setStatus('');
    if (evt.detail === 2) {
      if (autoMoveToFoundation(pile, col, idx)) return;
    }
    if (selection && selection.pile === pile && selection.col === col && selection.idx === idx) {
      clearSelection();
      render();
      return;
    }
    if (selection) {
      if (pile === 'tableau') {
        if (moveSelectionToTableau(col)) return;
      }
      clearSelection();
    }
    if (pile === 'waste') {
      if (idx !== state.waste.length - 1) return;
      selection = { pile, col: -1, idx };
    } else if (pile === 'tableau') {
      if (!isValidRun(state.tableau[col], idx)) return;
      selection = { pile, col, idx };
    }
    render();
  }

  function onEmptyTableauClick(col) {
    setStatus('');
    if (selection) {
      moveSelectionToTableau(col);
    }
  }

  function onFoundationClick() {
    setStatus('');
    if (selection) moveSelectionToFoundation();
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
    board.className = 'klondike-board';

    const toolbar = document.createElement('div');
    toolbar.className = 'klondike-toolbar';
    const drawBtn = document.createElement('button');
    drawBtn.type = 'button';
    drawBtn.className = 'toolbar-btn';
    drawBtn.textContent = `Draw: ${drawCount}`;
    drawBtn.addEventListener('click', toggleDraw);
    toolbar.appendChild(drawBtn);
    const movesEl = document.createElement('div');
    movesEl.className = 'moves-counter';
    movesEl.textContent = `Moves: ${state.moves}`;
    toolbar.appendChild(movesEl);
    board.appendChild(toolbar);

    const top = document.createElement('div');
    top.className = 'row top-row';

    const stockPile = document.createElement('div');
    stockPile.className = 'pile stock';
    if (state.stock.length) {
      stockPile.appendChild(cardEl({ faceUp: false }));
    } else {
      const slot = emptySlotEl('↺');
      stockPile.appendChild(slot);
    }
    stockPile.addEventListener('click', drawStock);
    top.appendChild(stockPile);

    const wastePile = document.createElement('div');
    wastePile.className = 'pile waste';
    if (state.waste.length) {
      const fan = document.createElement('div');
      fan.className = 'waste-fan';
      const start = Math.max(0, state.waste.length - Math.min(drawCount, 3));
      for (let idx = start; idx < state.waste.length; idx++) {
        const card = state.waste[idx];
        const isTop = idx === state.waste.length - 1;
        const el = cardEl(card, isTop && selection && selection.pile === 'waste' && selection.idx === idx);
        if (isTop) {
          el.addEventListener('click', (e) => onCardClick('waste', -1, idx, e));
          attachDrag(el, 'waste', -1, idx);
        } else {
          el.style.cursor = 'default';
        }
        fan.appendChild(el);
      }
      wastePile.appendChild(fan);
    } else {
      wastePile.appendChild(emptySlotEl(''));
    }
    top.appendChild(wastePile);

    const spacer = document.createElement('div');
    spacer.className = 'spacer';
    top.appendChild(spacer);

    for (const suit of SUITS) {
      const f = document.createElement('div');
      f.className = 'pile foundation';
      const pile = state.foundations[suit];
      if (pile.length) {
        f.appendChild(cardEl(pile[pile.length - 1]));
      } else {
        const slot = emptySlotEl(suit);
        slot.classList.add(isRed(suit) ? 'red' : 'black');
        f.appendChild(slot);
      }
      f.addEventListener('click', onFoundationClick);
      attachDropZone(f, onFoundationClick);
      top.appendChild(f);
    }
    board.appendChild(top);

    const tableauRow = document.createElement('div');
    tableauRow.className = 'row tableau-row';
    state.tableau.forEach((pile, col) => {
      const colEl = document.createElement('div');
      colEl.className = 'pile tableau-col';
      if (pile.length === 0) {
        const slot = emptySlotEl('');
        colEl.appendChild(slot);
        colEl.addEventListener('click', () => onEmptyTableauClick(col));
      } else {
        pile.forEach((card, idx) => {
          const selected = !!(selection && selection.pile === 'tableau' && selection.col === col && idx >= selection.idx);
          const el = cardEl(card, selected);
          if (card.faceUp) {
            el.addEventListener('click', (e) => {
              e.stopPropagation();
              onCardClick('tableau', col, idx, e);
            });
            attachDrag(el, 'tableau', col, idx);
          }
          colEl.appendChild(el);
        });
        colEl.addEventListener('click', () => {
          if (selection) onEmptyTableauClick(col);
        });
      }
      attachDropZone(colEl, () => onEmptyTableauClick(col));
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
