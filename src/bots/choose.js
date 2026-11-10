import { algebraic, apply as applyChess, legalMoves as chessMoves } from "../games/chess.js";
import { apply as applyJanggi, legalMoves as janggiMoves } from "../games/janggi.js";
import { options as yutOptions } from "../games/yut.js";
import { hintChoices } from "./hints.js";

const CHESS_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const JANGGI_VALUE = { soldier: 200, guard: 300, elephant: 300, horse: 500, cannon: 700, rook: 1300, king: 20000 };

export function chooseGomoku(state) {
  const candidates = nearbyEmpties(state.board);
  let best = candidates[0];
  let bestScore = -Infinity;
  for (const [x, y] of candidates) {
    const attack = wouldWin(state.board, x, y, state.turn) ? 100000 : threat(state.board, x, y, state.turn);
    const defend = wouldWin(state.board, x, y, state.turn === 1 ? 2 : 1) ? 80000 : threat(state.board, x, y, state.turn === 1 ? 2 : 1) * 0.9;
    const score = attack + defend;
    if (score > bestScore) {
      bestScore = score;
      best = [x, y];
    }
  }
  return { x: best[0], y: best[1] };
}

export function chooseChess(state, difficulty = "easy") {
  const depth = difficulty === "normal" ? 2 : 1;
  const cap = difficulty === "normal" ? 900 : 40;
  let nodes = 0;
  const moves = chessMoves(state);
  let best = moves[0];
  let bestScore = state.turn === "w" ? -Infinity : Infinity;
  for (const move of moves) {
    const played = applyChess(state, toAlgebraic(move));
    if (!played.ok) continue;
    const score = searchChess(played.state, depth - 1, -Infinity, Infinity, () => { nodes += 1; return nodes > cap; });
    if (state.turn === "w" ? score > bestScore : score < bestScore) {
      bestScore = score;
      best = move;
    }
    if (nodes > cap) break;
  }
  return toAlgebraic(best);
}

export function chooseJanggi(state, difficulty = "easy") {
  const depth = difficulty === "normal" ? 2 : 1;
  const cap = difficulty === "normal" ? 120 : 30;
  let nodes = 0;
  const moves = janggiMoves(state).filter((move) => !move.pass);
  const pool = moves.length ? moves : janggiMoves(state);
  let best = pool[0];
  let bestScore = -Infinity;
  const cho = state.turn === "cho";
  for (const move of pool) {
    const played = applyJanggi(state, move.pass ? { pass: true } : { from: move.from, to: move.to });
    if (!played.ok) continue;
    const score = searchJanggi(played.state, depth - 1, -Infinity, Infinity, () => { nodes += 1; return nodes > cap; });
    const directed = cho ? score : -score;
    if (directed > bestScore) {
      bestScore = directed;
      best = move;
    }
    if (nodes > cap) break;
  }
  return best.pass ? { pass: true } : { from: best.from, to: best.to };
}

export function chooseYut(state) {
  const choices = yutOptions(state);
  if (!choices.length) return null;
  let best = choices[0];
  let bestScore = -Infinity;
  for (const choice of choices) {
    const piece = state.pieces.find((item) => item.id === choice.pieceId);
    let score = rank(choice.dest) - rank(piece.node);
    if (choice.dest === "end") score += 80;
    const foe = state.pieces.some((item) => item.node === choice.dest && item.owner !== piece.owner);
    const friend = state.pieces.some((item) => item.node === choice.dest && item.owner === piece.owner && item.id !== piece.id);
    if (foe) score += 120;
    if (friend) score += 35;
    if (score > bestScore) {
      bestScore = score;
      best = choice;
    }
  }
  return best;
}

export function chooseLiarHint(word, category, isLiar, used) {
  const choices = hintChoices(word, category, isLiar, used);
  return choices[0] || "그냥 떠오른다";
}

export function chooseLiarVote(state, seat) {
  const others = [];
  for (let index = 0; index < state.playerCount; index += 1) if (index !== seat) others.push(index);
  if (seat === state.liar) return others[0];
  let pick = others[0];
  let shortest = Infinity;
  for (const index of others) {
    const length = state.hints.filter((hint) => hint.seat === index).reduce((sum, hint) => sum + hint.text.length, 0);
    if (length < shortest) {
      shortest = length;
      pick = index;
    }
  }
  return pick;
}

export function reactionDelay(difficulty, moleId, seat) {
  const base = difficulty === "normal" ? 280 : 720;
  const span = difficulty === "normal" ? 280 : 480;
  return base + ((moleId * 17 + seat * 13) % span);
}

function searchChess(state, depth, alpha, beta, stop) {
  if (stop()) return evaluateChess(state);
  if (depth <= 0 || state.over) return evaluateChess(state);
  const moves = chessMoves(state);
  if (!moves.length) return evaluateChess(state);
  const white = state.turn === "w";
  let best = white ? -Infinity : Infinity;
  for (const move of moves) {
    const played = applyChess(state, toAlgebraic(move));
    if (!played.ok) continue;
    const score = searchChess(played.state, depth - 1, alpha, beta, stop);
    if (white) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, score);
    }
    if (beta <= alpha || stop()) break;
  }
  return best;
}

function searchJanggi(state, depth, alpha, beta, stop) {
  if (stop() || depth <= 0 || state.over) return evaluateJanggi(state);
  const moves = janggiMoves(state).filter((move) => !move.pass);
  const pool = moves.length ? moves : [{ pass: true }];
  const cho = state.turn === "cho";
  let best = cho ? -Infinity : Infinity;
  for (const move of pool) {
    const played = applyJanggi(state, move.pass ? { pass: true } : { from: move.from, to: move.to });
    if (!played.ok) continue;
    const score = searchJanggi(played.state, depth - 1, alpha, beta, stop);
    if (cho) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, score);
    }
    if (beta <= alpha || stop()) break;
  }
  return best;
}

function evaluateChess(state) {
  if (state.over && state.winner === "w") return 100000;
  if (state.over && state.winner === "b") return -100000;
  if (state.over) return 0;
  let score = 0;
  for (let index = 0; index < 64; index += 1) {
    const piece = state.board[index];
    if (!piece) continue;
    const sign = piece === piece.toUpperCase() ? 1 : -1;
    score += sign * (CHESS_VALUE[piece.toLowerCase()] + centerBias(index));
  }
  return score;
}

function evaluateJanggi(state) {
  if (state.over && state.winner === "cho") return 100000;
  if (state.over && state.winner === "han") return -100000;
  if (state.over) return 0;
  let score = 0;
  for (const piece of state.board) {
    if (!piece) continue;
    const sign = piece.side === "cho" ? 1 : -1;
    score += sign * (JANGGI_VALUE[piece.type] || 0);
  }
  return score;
}

function centerBias(index) {
  const file = index % 8;
  const rank = Math.floor(index / 8);
  return Math.round(4 - Math.max(Math.abs(file - 3.5), Math.abs(rank - 3.5)));
}

function toAlgebraic(move) {
  return { from: algebraic(move.from), to: algebraic(move.to), promotion: move.promotion || null };
}

function nearbyEmpties(board) {
  const found = [];
  let stones = 0;
  for (let index = 0; index < 225; index += 1) if (board[index]) stones += 1;
  for (let y = 0; y < 15; y += 1) {
    for (let x = 0; x < 15; x += 1) {
      if (board[y * 15 + x]) continue;
      if (stones && !hasNeighbor(board, x, y)) continue;
      found.push([x, y]);
    }
  }
  return found.length ? found : [[7, 7]];
}

function hasNeighbor(board, x, y) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx > 14 || yy > 14) continue;
      if (board[yy * 15 + xx]) return true;
    }
  }
  return false;
}

function wouldWin(board, x, y, color) {
  const copy = board.slice();
  copy[y * 15 + x] = color;
  return countLine(copy, x, y, color) >= 5;
}

function threat(board, x, y, color) {
  const copy = board.slice();
  copy[y * 15 + x] = color;
  return countLine(copy, x, y, color);
}

function countLine(board, x, y, color) {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  let best = 0;
  for (const [dx, dy] of dirs) {
    let count = 1;
    for (const sign of [1, -1]) {
      let cx = x + dx * sign;
      let cy = y + dy * sign;
      while (cx >= 0 && cy >= 0 && cx < 15 && cy < 15 && board[cy * 15 + cx] === color) {
        count += 1;
        cx += dx * sign;
        cy += dy * sign;
      }
    }
    best = Math.max(best, count);
  }
  return best;
}

function rank(node) {
  const order = ["home", "a1", "a2", "a3", "a4", "a5", "s1", "s2", "center", "s3", "s4", "b1", "b2", "b3", "b4", "b5", "t1", "t2", "t3", "t4", "c1", "c2", "c3", "c4", "c5", "d1", "d2", "d3", "d4", "end"];
  const index = order.indexOf(node);
  return index < 0 ? 10 : index;
}
