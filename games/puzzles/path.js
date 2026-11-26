// 붓길: draw one line through every square, passing the numbers 1, 2, 3 … in order.
// Boards come from a random Hamiltonian path (backbite moves), so each board has at least one answer.
export function neighbours(i, size) {
  const x = i % size;
  const y = Math.floor(i / size);
  const out = [];
  if (x > 0) out.push(i - 1);
  if (x < size - 1) out.push(i + 1);
  if (y > 0) out.push(i - size);
  if (y < size - 1) out.push(i + size);
  return out;
}

export function randomPath(size, random = Math.random) {
  let path = [];
  for (let y = 0; y < size; y += 1) {
    for (let k = 0; k < size; k += 1) path.push(y * size + (y % 2 ? size - 1 - k : k));
  }
  const steps = size * size * 40;
  for (let s = 0; s < steps; s += 1) {
    if (random() < 0.5) path.reverse();
    const end = path[path.length - 1];
    const options = neighbours(end, size).filter((n) => n !== path[path.length - 2]);
    const pick = options[Math.floor(random() * options.length)];
    const at = path.indexOf(pick);
    // Backbite: link the end to `pick`, then reverse the tail after it.
    path = [...path.slice(0, at + 1), ...path.slice(at + 1).reverse()];
  }
  return path;
}

export function makeBoard(size = 5, marks = 6, random = Math.random) {
  const route = randomPath(size, random);
  const clues = Array(size * size).fill(0);
  const total = route.length;
  const picks = new Set([0, total - 1]);
  while (picks.size < Math.min(marks, total)) picks.add(1 + Math.floor(random() * (total - 2)));
  [...picks].sort((a, b) => a - b).forEach((index, n) => { clues[route[index]] = n + 1; });
  return { size, clues, route };
}

// Extends or rewinds the drawn line when the finger moves onto square `i`.
export function extend(line, i, board) {
  const { size, clues } = board;
  if (!line.length) return clues[i] === 1 ? [i] : line;
  const at = line.indexOf(i);
  if (at >= 0) return line.slice(0, at + 1);
  const head = line[line.length - 1];
  if (!neighbours(head, size).includes(i)) return line;
  const nextNumber = Math.max(0, ...line.map((cell) => clues[cell])) + 1;
  if (clues[i] && clues[i] !== nextNumber) return line;
  return [...line, i];
}

export function solvedBy(line, board) {
  if (line.length !== board.size * board.size) return false;
  if (new Set(line).size !== line.length) return false;
  let expect = 1;
  for (let k = 0; k < line.length; k += 1) {
    if (k && !neighbours(line[k - 1], board.size).includes(line[k])) return false;
    const clue = board.clues[line[k]];
    if (clue) {
      if (clue !== expect) return false;
      expect += 1;
    }
  }
  const last = Math.max(...board.clues);
  return expect === last + 1 && board.clues[line[line.length - 1]] === last;
}
