const SIZE = 15;

export function initialState() {
  return {
    board: Array(SIZE * SIZE).fill(0),
    turn: 1,
    winner: null,
    reason: null,
    last: null,
  };
}

export function apply(state, move) {
  if (state.winner || state.reason === "full") return { ok: false, error: "over" };
  const x = move?.x;
  const y = move?.y;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= SIZE || y >= SIZE) {
    return { ok: false, error: "bounds" };
  }
  const index = y * SIZE + x;
  if (state.board[index]) return { ok: false, error: "occupied" };
  const board = state.board.slice();
  const color = state.turn;
  board[index] = color;
  const win = hasFive(board, x, y, color);
  const full = !win && board.every(Boolean);
  const next = {
    board,
    turn: win || full ? color : color === 1 ? 2 : 1,
    winner: win ? (color === 1 ? "black" : "white") : full ? "draw" : null,
    reason: win ? "five" : full ? "full" : null,
    last: [x, y],
  };
  return { ok: true, state: next, over: Boolean(win || full), winner: next.winner, reason: next.reason };
}

function hasFive(board, x, y, color) {
  const lines = [[1, 0], [0, 1], [1, 1], [1, -1]];
  return lines.some(([dx, dy]) => count(board, x, y, dx, dy, color) + count(board, x, y, -dx, -dy, color) - 1 >= 5);
}

function count(board, x, y, dx, dy, color) {
  let n = 0;
  let cx = x;
  let cy = y;
  while (cx >= 0 && cy >= 0 && cx < SIZE && cy < SIZE && board[cy * SIZE + cx] === color) {
    n += 1;
    cx += dx;
    cy += dy;
  }
  return n;
}
