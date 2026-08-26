const FreeCell = (() => {
  const COLUMNS = 8;
  let root, state, history, selection, statusEl;

  function newState() {
    const deck = shuffle(makeDeck(SUITS));
    const tableau = Array.from({ length: COLUMNS }, () => []);
    let p = 0;
    for (let col = 0; col < COLUMNS; col++) {
      const count = col < 4 ? 7 : 6;
      for (let row = 0; row < count; row++) {
        const card = deck[p++];
        card.faceUp = true;
        tableau[col].push(card);
      }
    }
    return {
      freeCells: [null, null, null, null],
      foundations: { '♠': [], '♥': [], '♦': [], '♣': [] },
      tableau,
    };
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
    for (let i = startIdx; i < pile.length - 1; i++) {
      const a = pile[i], b = pile[i + 1];
      if (isRed(a.suit) === isRed(b.suit)) return false;
      if (a.value !== b.value + 1) return false;
    }
    return true;
  }

  function maxMovable(destCol) {
    const emptyFree = state.freeCells.filter((c) => c === null).length;
    let emptyCols = state.tableau.filter((p) => p.length === 0).length;
    if (destCol !== undefined && state.tableau[destCol].length === 0) emptyCols -= 1;
    return (emptyFree + 1) * Math.pow(2, Math.max(emptyCols, 0));
  }

  function tryFoundation(card) {
    const f = state.foundations[card.suit];
    if (f.length === 0) return card.value === 1;
    return f[f.length - 1].value === card.value - 1;
  }

  function tryTableau(run, col) {
    const dest = state.tableau[col];
    const moving = run[0];
    if (dest.length === 0) return true;
    const top = dest[dest.length - 1];
    return isRed(top.suit) !== isRed(moving.suit) && top.value === moving.value + 1;
  }

  function getSelectedRun() {
    if (!selection) return null;
    if (selection.source === 'freecell') {
      const card = state.freeCells[selection.col];
      return card ? [card] : null;
    }
    return state.tableau[selection.col].slice(selection.idx);
  }

  function removeSelected() {
    if (selection.source === 'freecell') {
      state.freeCells[selection.col] = null;
    } else {
      state.tableau[selection.col].splice(selection.idx);
    }
  }

  function checkWin() {
    const total = Object.values(state.foundations).reduce((n, f) => n + f.length, 0);
    if (total === 52) {
      setStatus('You win! 🎉');
      return true;
    }
    return false;
  }

  function moveSelectionToTableau(destCol) {
    if (!selection) return false;
    const run = getSelectedRun();
    if (!run) return false;
    if (selection.source === 'tableau' && selection.col === destCol) return false;
    if (run.length > maxMovable(destCol)) {
      setStatus('Not enough free cells/empty columns to move that many cards at once.');
      return false;
    }
    if (!tryTableau(run, destCol)) return false;
    save();
    removeSelected();
    state.tableau[destCol].push(...run);
    clearSelection();
    render();
    return true;
  }

  function moveSelectionToFreeCell(cellIdx) {
    if (!selection) return false;
    if (state.freeCells[cellIdx]) return false;
    const run = getSelectedRun();
    if (!run || run.length !== 1) return false;
    save();
    removeSelected();
    state.freeCells[cellIdx] = run[0];
    clearSelection();
    render();
    return true;
  }

  function moveSelectionToFoundation() {
    if (!selection) return false;
    const run = getSelectedRun();
    if (!run || run.length !== 1) return false;
    const card = run[0];
    if (!tryFoundation(card)) return false;
    save();
    removeSelected();
    state.foundations[card.suit].push(card);
    clearSelection();
    render();
    checkWin();
    return true;
  }

  function autoMoveToFoundation(source, col, idx) {
    const pile = source === 'freecell' ? [state.freeCells[col]] : state.tableau[col];
    if (source === 'tableau' && idx !== pile.length - 1) return false;
    const card = source === 'freecell' ? state.freeCells[col] : pile[pile.length - 1];
    if (!card || !tryFoundation(card)) return false;
    save();
    if (source === 'freecell') state.freeCells[col] = null;
    else state.tableau[col].pop();
    state.foundations[card.suit].push(card);
    clearSelection();
    render();
    checkWin();
    return true;
  }

  function onTableauCardClick(col, idx, evt) {
    setStatus('');
    if (evt.detail === 2 && idx === state.tableau[col].length - 1) {
      if (autoMoveToFoundation('tableau', col, idx)) return;
    }
    if (selection && selection.source === 'tableau' && selection.col === col && selection.idx === idx) {
      clearSelection();
      render();
      return;
    }
    if (selection) {
      if (moveSelectionToTableau(col)) return;
      clearSelection();
    }
    if (isValidRun(state.tableau[col], idx)) {
      selection = { source: 'tableau', col, idx };
    }
    render();
  }

  function onFreeCellClick(idx, evt) {
    setStatus('');
    const card = state.freeCells[idx];
    if (card && evt.detail === 2) {
      if (autoMoveToFoundation('freecell', idx, 0)) return;
    }
    if (selection && selection.source === 'freecell' && selection.col === idx) {
      clearSelection();
      render();
      return;
    }
    if (selection) {
      if (moveSelectionToFreeCell(idx)) return;
      if (!card) {
        clearSelection();
        render();
        return;
      }
      clearSelection();
    }
    if (card) selection = { source: 'freecell', col: idx };
    render();
  }

  function onEmptyColumnClick(col) {
    setStatus('');
    if (selection) moveSelectionToTableau(col);
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
    board.className = 'freecell-board';

    const top = document.createElement('div');
    top.className = 'row top-row';

    state.freeCells.forEach((card, idx) => {
      const cell = document.createElement('div');
      cell.className = 'pile freecell';
      if (card) {
        const selected = !!(selection && selection.source === 'freecell' && selection.col === idx);
        cell.appendChild(cardEl(card, selected));
      } else {
        cell.appendChild(emptySlotEl(''));
      }
      cell.addEventListener('click', (e) => onFreeCellClick(idx, e));
      top.appendChild(cell);
    });

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
      top.appendChild(f);
    }
    board.appendChild(top);

    const tableauRow = document.createElement('div');
    tableauRow.className = 'row tableau-row freecell-row';
    state.tableau.forEach((pile, col) => {
      const colEl = document.createElement('div');
      colEl.className = 'pile tableau-col';
      if (pile.length === 0) {
        colEl.appendChild(emptySlotEl(''));
        colEl.addEventListener('click', () => onEmptyColumnClick(col));
      } else {
        pile.forEach((card, idx) => {
          const selected = !!(selection && selection.source === 'tableau' && selection.col === col && idx >= selection.idx);
          const el = cardEl(card, selected);
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            onTableauCardClick(col, idx, e);
          });
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
