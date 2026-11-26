// 오셀로: 8×8, black moves first. A move must flip at least one line of the other colour.
// With no legal move you pass; when neither side can move the larger count wins.
import { soonest } from "./arcade-util.js";

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export const BLACK = 1;
export const WHITE = 2;
const WEIGHTS = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -40, -5, -5, -5, -5, -40, -20,
  10, -5, 3, 2, 2, 3, -5, 10,
  5, -5, 2, 1, 1, 2, -5, 5,
  5, -5, 2, 1, 1, 2, -5, 5,
  10, -5, 3, 2, 2, 3, -5, 10,
  -20, -40, -5, -5, -5, -5, -40, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];

export function newBoard() {
  const board = Array(64).fill(0);
  board[27] = WHITE;
  board[36] = WHITE;
  board[28] = BLACK;
  board[35] = BLACK;
  return board;
}

export function flipsFor(board, index, color) {
  if (board[index]) return [];
  const x0 = index % 8;
  const y0 = Math.floor(index / 8);
  const other = color === BLACK ? WHITE : BLACK;
  const all = [];
  for (const [dx, dy] of DIRS) {
    const line = [];
    let x = x0 + dx;
    let y = y0 + dy;
    while (x >= 0 && y >= 0 && x < 8 && y < 8 && board[y * 8 + x] === other) {
      line.push(y * 8 + x);
      x += dx;
      y += dy;
    }
    if (line.length && x >= 0 && y >= 0 && x < 8 && y < 8 && board[y * 8 + x] === color) all.push(...line);
  }
  return all;
}

export function legal(board, color) {
  const out = [];
  for (let i = 0; i < 64; i += 1) if (flipsFor(board, i, color).length) out.push(i);
  return out;
}

export function counts(board) {
  return { black: board.filter((v) => v === BLACK).length, white: board.filter((v) => v === WHITE).length };
}

export function initial() {
  return { phase: "waiting" };
}

export function start(state, { seed, bots = [], level = "easy", now = 0, round = 1 }) {
  const blackSeat = (round - 1) % 2;
  const next = { phase: "playing", board: newBoard(), color: BLACK, blackSeat, bots, level, last: null, passed: null, botAt: null, seed };
  return { ok: true, state: arm(next, now) };
}

export function seatOf(state, color) {
  return color === BLACK ? state.blackSeat : 1 - state.blackSeat;
}

function arm(state, now) {
  return { ...state, botAt: state.phase === "playing" && state.bots.includes(seatOf(state, state.color)) ? now + 650 : null };
}

export function place(state, seat, index, now = 0) {
  if (state.phase !== "playing") return { ok: false, error: "wait" };
  if (seat !== seatOf(state, state.color)) return { ok: false, error: "turn" };
  const at = Number(index);
  const flips = Number.isInteger(at) && at >= 0 && at < 64 ? flipsFor(state.board, at, state.color) : [];
  if (!flips.length) return { ok: false, error: "illegal" };
  const board = state.board.slice();
  board[at] = state.color;
  for (const i of flips) board[i] = state.color;
  const other = state.color === BLACK ? WHITE : BLACK;
  let next = { ...state, board, last: at, flipped: flips, passed: null };
  if (legal(board, other).length) next.color = other;
  else if (legal(board, state.color).length) next.passed = other;
  else next.phase = "over";
  return { ok: true, state: arm(next, now) };
}

export function act(state, seat, action, now) {
  if (action.type !== "place") return { ok: false, error: "unknown" };
  return place(state, seat, action.index, now);
}

export function botMove(state) {
  const moves = legal(state.board, state.color);
  if (!moves.length) return null;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const flips = flipsFor(state.board, move, state.color).length;
    const score = state.level === "normal" ? WEIGHTS[move] * 3 + flips : flips + ((move * 7) % 5) * 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

export function tick(state, now) {
  if (state.phase !== "playing" || state.botAt == null || now < state.botAt) return { state, changed: false };
  const done = place(state, seatOf(state, state.color), botMove(state), now);
  return { state: done.ok ? done.state : { ...state, botAt: null }, changed: true };
}

export function alarm(state, now) {
  if (state.phase !== "playing" || state.botAt == null) return null;
  return soonest([state.botAt], now) ?? now + 50;
}

export function view(state) {
  if (state.phase === "waiting") return { phase: "waiting" };
  return {
    phase: state.phase,
    board: state.board,
    color: state.color,
    blackSeat: state.blackSeat,
    legal: state.phase === "playing" ? legal(state.board, state.color) : [],
    last: state.last,
    flipped: state.flipped || [],
    passed: state.passed,
    counts: counts(state.board),
  };
}

export function result(state) {
  if (state.phase !== "over") return null;
  const { black, white } = counts(state.board);
  if (black === white) return { winnerSeat: null, draw: true, reason: "count" };
  return { winnerSeat: seatOf(state, black > white ? BLACK : WHITE), draw: false, reason: "count" };
}

export function turn(state) {
  return state.phase === "playing" ? seatOf(state, state.color) : null;
}
