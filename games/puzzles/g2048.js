// 2048 rules. The board is a flat array of 16 numbers (0 = empty).
export const N = 4;

export function empty() {
  return Array(N * N).fill(0);
}

function slideLine(line) {
  const tiles = line.filter(Boolean);
  const out = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i += 1) {
    if (tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2);
      gained += tiles[i] * 2;
      i += 1;
    } else out.push(tiles[i]);
  }
  while (out.length < N) out.push(0);
  return { line: out, gained };
}

function indices(dir, k) {
  const list = [];
  for (let i = 0; i < N; i += 1) {
    if (dir === "left") list.push(k * N + i);
    if (dir === "right") list.push(k * N + (N - 1 - i));
    if (dir === "up") list.push(i * N + k);
    if (dir === "down") list.push((N - 1 - i) * N + k);
  }
  return list;
}

export function move(board, dir) {
  const next = board.slice();
  let gained = 0;
  for (let k = 0; k < N; k += 1) {
    const idx = indices(dir, k);
    const result = slideLine(idx.map((i) => board[i]));
    idx.forEach((i, j) => { next[i] = result.line[j]; });
    gained += result.gained;
  }
  const moved = next.some((value, i) => value !== board[i]);
  return { board: next, gained, moved };
}

export function spawn(board, random = Math.random) {
  const free = board.map((value, i) => (value ? -1 : i)).filter((i) => i >= 0);
  if (!free.length) return board;
  const next = board.slice();
  next[free[Math.floor(random() * free.length)]] = random() < 0.9 ? 2 : 4;
  return next;
}

export function canMove(board) {
  return ["left", "right", "up", "down"].some((dir) => move(board, dir).moved);
}
