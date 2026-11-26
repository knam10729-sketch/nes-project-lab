// 빙고: everyone gets their own shuffled 5x5 board of 1-25. Players take turns calling a number;
// it is marked on every board. The first to finish three lines wins.
import { shuffle, soonest } from "./arcade-util.js";

export const SIZE = 5;
export const GOAL = 3;
const LINES = (() => {
  const lines = [];
  for (let r = 0; r < SIZE; r += 1) lines.push([0, 1, 2, 3, 4].map((c) => r * SIZE + c));
  for (let c = 0; c < SIZE; c += 1) lines.push([0, 1, 2, 3, 4].map((r) => r * SIZE + c));
  lines.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return lines;
})();

export function initial() {
  return { phase: "waiting", boards: [], called: [], turn: 0, players: 1, lines: [], bots: [], botAt: null, level: "easy" };
}

export function linesOn(board, called) {
  const marked = new Set(called);
  return LINES.filter((line) => line.every((cell) => marked.has(board[cell]))).length;
}

export function start(state, { players, seed, bots = [], level = "easy", now = 0 }) {
  const count = Math.max(1, Math.min(4, players));
  const boards = [];
  let s = seed >>> 0 || 1;
  for (let seat = 0; seat < count; seat += 1) {
    let board;
    [board, s] = shuffle(Array.from({ length: 25 }, (_, index) => index + 1), s + seat * 7919);
    boards.push(board);
  }
  const next = { ...initial(), phase: "playing", players: count, boards, lines: Array(count).fill(0), bots, level };
  return { ok: true, state: armBot(next, now) };
}

export function call(state, seat, number, now = 0) {
  if (state.phase !== "playing") return { ok: false, error: "wait" };
  if (seat !== state.turn) return { ok: false, error: "turn" };
  const value = Number(number);
  if (!Number.isInteger(value) || value < 1 || value > 25) return { ok: false, error: "bounds" };
  if (state.called.includes(value)) return { ok: false, error: "called" };
  const called = [...state.called, value];
  const lines = state.boards.map((board) => linesOn(board, called));
  const done = lines.map((count, index) => (count >= GOAL ? index : -1)).filter((index) => index >= 0);
  const next = { ...state, called, lines, last: { seat, number: value }, botAt: null };
  if (done.length) {
    next.phase = "over";
    next.winners = done;
    return { ok: true, state: next };
  }
  next.turn = (state.turn + 1) % state.players;
  return { ok: true, state: armBot(next, now) };
}

export function act(state, seat, action, now) {
  if (action.type !== "call") return { ok: false, error: "unknown" };
  return call(state, seat, action.number, now);
}

// A bot on easy calls any open number; on normal it picks the number that helps its own board most.
export function botChoice(state, seat) {
  const open = [];
  for (let n = 1; n <= 25; n += 1) if (!state.called.includes(n)) open.push(n);
  if (!open.length) return null;
  if (state.level !== "normal") return open[(state.called.length * 7 + seat * 3) % open.length];
  const board = state.boards[seat];
  let best = open[0];
  let bestScore = -1;
  for (const n of open) {
    const cell = board.indexOf(n);
    const marked = new Set([...state.called, n]);
    let score = 0;
    for (const line of LINES) {
      if (!line.includes(cell)) continue;
      const have = line.filter((c) => marked.has(board[c])).length;
      score += have * have;
    }
    if (score > bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return best;
}

function armBot(state, now) {
  if (state.phase === "playing" && state.bots.includes(state.turn)) return { ...state, botAt: now + 900 };
  return { ...state, botAt: null };
}

export function tick(state, now) {
  if (state.phase !== "playing" || state.botAt == null || now < state.botAt) return { state, changed: false };
  const seat = state.turn;
  const pick = botChoice(state, seat);
  const done = call(state, seat, pick, now);
  return done.ok ? { state: done.state, changed: true } : { state: { ...state, botAt: null }, changed: true };
}

export function alarm(state, now) {
  if (state.phase !== "playing" || state.botAt == null) return null;
  return soonest([state.botAt], now) ?? now + 50;
}

export function view(state) {
  return {
    phase: state.phase,
    called: state.called,
    last: state.last || null,
    lines: state.lines,
    goal: GOAL,
    turn: state.turn,
    winners: state.winners || [],
    // Boards are revealed once the game is over.
    boards: state.phase === "over" ? state.boards : null,
  };
}

export function secret(state, seat) {
  if (!Number.isInteger(seat) || !state.boards[seat]) return null;
  return { board: state.boards[seat] };
}

export function result(state) {
  if (state.phase !== "over") return null;
  const winners = state.winners || [];
  const caller = state.last?.seat;
  if (winners.length === 1) return { winnerSeat: winners[0], draw: false, reason: "bingo" };
  if (winners.includes(caller)) return { winnerSeat: caller, draw: false, reason: "bingo" };
  return { winnerSeat: null, draw: true, reason: "bingo" };
}

export function turn(state) {
  return state.phase === "playing" ? state.turn : null;
}
