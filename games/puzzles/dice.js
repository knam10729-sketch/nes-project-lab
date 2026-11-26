// 눈도장: roll a die across the board. Landing on a square whose number matches the die's top face stamps it.
// Puzzles are made by walking a die at random, so every board is solvable.
export const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

// A die is { top, north, east }; opposite faces add up to 7.
export function roll(die, dir) {
  const { top, north, east } = die;
  if (dir === "up") return { top: 7 - north, north: top, east };
  if (dir === "down") return { top: north, north: 7 - top, east };
  if (dir === "left") return { top: east, north, east: 7 - top };
  if (dir === "right") return { top: 7 - east, north, east: top };
  return die;
}

export function step(state, dir) {
  const [dx, dy] = DIRS[dir] || [0, 0];
  const x = state.x + dx;
  const y = state.y + dy;
  if (!dir || x < 0 || y < 0 || x >= state.size || y >= state.size) return { ok: false, state };
  const die = roll(state.die, dir);
  const i = y * state.size + x;
  const stamped = state.stamped.slice();
  let stampedNow = false;
  if (state.cells[i] === die.top && !stamped[i]) {
    stamped[i] = true;
    stampedNow = true;
  }
  return { ok: true, stampedNow, state: { ...state, x, y, die, stamped, moves: state.moves + 1 } };
}

export function done(state) {
  return state.cells.every((value, i) => !value || state.stamped[i]);
}

export function makeBoard({ size = 4, targets = 6, random = Math.random } = {}) {
  const start = { x: Math.floor(random() * size), y: Math.floor(random() * size) };
  const startDie = { top: 1, north: 2, east: 3 };
  let pos = { ...start };
  let die = startDie;
  const firstTop = new Map();
  const order = [];
  const names = Object.keys(DIRS);
  for (let walk = 0; walk < 200 && order.length < targets; walk += 1) {
    const options = names.filter((dir) => {
      const [dx, dy] = DIRS[dir];
      const x = pos.x + dx;
      const y = pos.y + dy;
      return x >= 0 && y >= 0 && x < size && y < size;
    });
    const dir = options[Math.floor(random() * options.length)];
    const [dx, dy] = DIRS[dir];
    pos = { x: pos.x + dx, y: pos.y + dy };
    die = roll(die, dir);
    const i = pos.y * size + pos.x;
    if (i === start.y * size + start.x || firstTop.has(i)) continue;
    // Only keep a square once in a while so the route has to wander.
    if (random() < 0.45) {
      firstTop.set(i, die.top);
      order.push(i);
    }
  }
  const cells = Array(size * size).fill(0);
  for (const [i, top] of firstTop) cells[i] = top;
  return {
    size,
    cells,
    stamped: cells.map(() => false),
    x: start.x,
    y: start.y,
    die: startDie,
    moves: 0,
    par: 0,
  };
}
