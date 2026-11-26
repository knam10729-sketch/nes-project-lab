// 짝 맞추기: flip two cards; a pair keeps your turn, a miss passes it after a short look.
import { leaders, shuffle, soonest } from "./arcade-util.js";

export const FACES = ["🍓", "🐳", "🌻", "🚲", "🎈", "🍩", "🦊", "⭐", "🍀", "🎲"];
export const PAIRS = 8;
export const PEEK_MS = 1000;

export function initial() {
  return { phase: "waiting", deck: [], owner: [], open: [], hideAt: null, turn: 0, players: 1, scores: [], flips: [] };
}

export function start(state, { players, seed }) {
  const count = Math.max(1, Math.min(2, players));
  const [faces] = shuffle(FACES.map((_, index) => index), seed ^ 0x9e3779b9);
  const picked = faces.slice(0, PAIRS);
  const [deck] = shuffle([...picked, ...picked], seed);
  return {
    ok: true,
    state: {
      ...initial(),
      phase: "playing",
      players: count,
      deck,
      owner: deck.map(() => null),
      scores: Array(count).fill(0),
      flips: Array(count).fill(0),
    },
  };
}

export function tick(state, now) {
  if (state.phase !== "playing" || state.hideAt == null || now < state.hideAt) return { state, changed: false };
  return { state: { ...state, open: [], hideAt: null, turn: (state.turn + 1) % state.players }, changed: true };
}

export function act(state, seat, action, now) {
  if (action.type !== "flip") return { ok: false, error: "unknown" };
  if (state.phase !== "playing") return { ok: false, error: "wait" };
  if (seat !== state.turn) return { ok: false, error: "turn" };
  if (state.hideAt != null) return { ok: false, error: "peek" };
  const index = Number(action.index);
  if (!Number.isInteger(index) || index < 0 || index >= state.deck.length) return { ok: false, error: "bounds" };
  if (state.owner[index] != null || state.open.includes(index)) return { ok: false, error: "open" };
  const open = [...state.open, index];
  const flips = state.flips.slice();
  flips[seat] += 1;
  let next = { ...state, open, flips, last: index };
  if (open.length === 2) {
    const [a, b] = open;
    if (state.deck[a] === state.deck[b]) {
      const owner = state.owner.slice();
      owner[a] = seat;
      owner[b] = seat;
      const scores = state.scores.slice();
      scores[seat] += 1;
      next = { ...next, owner, scores, open: [] };
      if (owner.every((item) => item != null)) next.phase = "over";
    } else {
      next.hideAt = now + PEEK_MS;
    }
  }
  return { ok: true, state: next };
}

export function alarm(state, now) {
  if (state.phase !== "playing" || state.hideAt == null) return null;
  return soonest([state.hideAt], now) ?? now + 50;
}

export function view(state) {
  return {
    phase: state.phase,
    cards: state.deck.map((face, index) => ({
      face: state.owner[index] != null || state.open.includes(index) ? FACES[face] : null,
      owner: state.owner[index],
    })),
    open: state.open,
    peeking: state.hideAt != null,
    scores: state.scores,
    flips: state.flips,
    players: state.players,
  };
}

export function result(state) {
  if (state.phase !== "over") return null;
  if (state.players === 1) return { winnerSeat: 0, draw: false, reason: "cleared" };
  const top = leaders(state.scores);
  return { winnerSeat: top.length === 1 ? top[0] : null, draw: top.length !== 1, reason: "pairs" };
}

export function turn(state) {
  return state.phase === "playing" ? state.turn : null;
}
