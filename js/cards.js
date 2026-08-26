const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function isRed(suit) {
  return suit === '♥' || suit === '♦';
}

function makeDeck(suits) {
  const deck = [];
  let id = 0;
  for (const suit of suits) {
    for (let i = 0; i < RANKS.length; i++) {
      deck.push({ id: `${suit}${RANKS[i]}-${id++}`, suit, rank: RANKS[i], value: i + 1, faceUp: false });
    }
  }
  return deck;
}

function shuffle(deck) {
  const d = deck.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function cardEl(card, selected) {
  const el = document.createElement('div');
  el.className = 'card' + (card.faceUp ? '' : ' face-down') + (selected ? ' selected' : '');
  el.dataset.cardId = card.id;
  if (card.faceUp) {
    el.classList.add(isRed(card.suit) ? 'red' : 'black');
    const corner = `<span class="rank">${card.rank}</span><span class="suit">${card.suit}</span>`;
    el.innerHTML = `
      <div class="corner top">${corner}</div>
      <div class="pip">${card.suit}</div>
      <div class="corner bottom">${corner}</div>
    `;
  }
  return el;
}

function emptySlotEl(label) {
  const el = document.createElement('div');
  el.className = 'empty-slot';
  if (label) el.textContent = label;
  return el;
}

function cloneState(state) {
  if (typeof structuredClone === 'function') return structuredClone(state);
  return JSON.parse(JSON.stringify(state));
}

function makeHistory() {
  const stack = [];
  return {
    push(state) {
      stack.push(cloneState(state));
      if (stack.length > 200) stack.shift();
    },
    pop() {
      return stack.pop();
    },
    canUndo() {
      return stack.length > 0;
    },
    clear() {
      stack.length = 0;
    },
  };
}
