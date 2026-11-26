// Sudoku generator and checker. Grids are flat arrays of 81 numbers (0 = empty).
const PEERS = [];
for (let i = 0; i < 81; i += 1) {
  const r = Math.floor(i / 9);
  const c = i % 9;
  const set = new Set();
  for (let k = 0; k < 9; k += 1) {
    set.add(r * 9 + k);
    set.add(k * 9 + c);
  }
  const br = r - (r % 3);
  const bc = c - (c % 3);
  for (let y = 0; y < 3; y += 1) for (let x = 0; x < 3; x += 1) set.add((br + y) * 9 + bc + x);
  set.delete(i);
  PEERS.push([...set]);
}
export { PEERS };

function options(grid, i) {
  let mask = 0x3fe;
  for (const p of PEERS[i]) mask &= ~(1 << grid[p]);
  return mask;
}

// Counts solutions up to `limit`, filling `grid` in place with the first one found when fill is true.
export function solve(grid, limit = 2) {
  const work = grid.slice();
  let count = 0;
  let first = null;
  function step() {
    let best = -1;
    let bestMask = 0;
    let bestBits = 10;
    for (let i = 0; i < 81; i += 1) {
      if (work[i]) continue;
      const mask = options(work, i);
      const bits = popcount(mask);
      if (bits < bestBits) {
        best = i;
        bestMask = mask;
        bestBits = bits;
        if (bits <= 1) break;
      }
    }
    if (best < 0) {
      count += 1;
      if (!first) first = work.slice();
      return count >= limit;
    }
    for (let n = 1; n <= 9; n += 1) {
      if (!(bestMask & (1 << n))) continue;
      work[best] = n;
      if (step()) return true;
    }
    work[best] = 0;
    return false;
  }
  step();
  return { count, solution: first };
}

function popcount(x) {
  let n = 0;
  while (x) {
    x &= x - 1;
    n += 1;
  }
  return n;
}

function shuffled(list, random) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function fullGrid(random = Math.random) {
  const grid = Array(81).fill(0);
  function fill(i) {
    if (i === 81) return true;
    for (const n of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], random)) {
      if (!(options(grid, i) & (1 << n))) continue;
      grid[i] = n;
      if (fill(i + 1)) return true;
    }
    grid[i] = 0;
    return false;
  }
  fill(0);
  return grid;
}

export const LEVELS = { easy: 40, normal: 32, hard: 27 };

// Removes cells while the puzzle keeps exactly one solution.
export function makePuzzle(level = "easy", random = Math.random) {
  const solution = fullGrid(random);
  const puzzle = solution.slice();
  const target = LEVELS[level] || LEVELS.easy;
  let clues = 81;
  for (const i of shuffled([...Array(81).keys()], random)) {
    if (clues <= target) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (solve(puzzle, 2).count !== 1) puzzle[i] = keep;
    else clues -= 1;
  }
  return { puzzle, solution };
}

export function conflicts(grid) {
  const bad = new Set();
  for (let i = 0; i < 81; i += 1) {
    if (!grid[i]) continue;
    for (const p of PEERS[i]) if (grid[p] === grid[i]) bad.add(i);
  }
  return bad;
}

export function solved(grid) {
  return grid.every(Boolean) && conflicts(grid).size === 0;
}
