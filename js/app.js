(() => {
  const engines = { klondike: Klondike, spider: Spider, freecell: FreeCell };
  let current = null;

  const container = document.getElementById('game-container');
  const statusEl = document.getElementById('status');
  const newGameBtn = document.getElementById('newGameBtn');
  const undoBtn = document.getElementById('undoBtn');
  const menuButtons = document.querySelectorAll('#menu button');

  function selectGame(name) {
    current = engines[name];
    menuButtons.forEach((b) => b.classList.toggle('active', b.dataset.game === name));
    current.start(container, statusEl);
  }

  menuButtons.forEach((btn) => {
    btn.addEventListener('click', () => selectGame(btn.dataset.game));
  });

  newGameBtn.addEventListener('click', () => current && current.newGame());
  undoBtn.addEventListener('click', () => current && current.undo());

  selectGame('klondike');
})();
