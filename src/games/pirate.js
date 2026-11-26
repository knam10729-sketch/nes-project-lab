// 해적 룰렛: take turns pushing a sword into the barrel. One hidden slot pops the pirate,
// and whoever pops it takes the penalty.
import { roll, soonest } from "./arcade-util.js";

export const SLOTS = 16;

export function initial() {
  return { phase: "waiting" };
}

export function start(state, { players, seed, bots = [], now = 0, round = 1 }) {
  const count = Math.max(2, Math.min(6, players));
  const [trap, rng] = roll((seed >>> 0) || 1, SLOTS);
  const next = { phase: "playing", players: count, trap, rng, slots: Array(SLOTS).fill(null), turn: (round - 1) % count, loser: null, last: null, bots, botAt: null };
  return { ok: true, state: arm(next, now) };
}

function arm(state, now) {
  return { ...state, botAt: state.phase === "playing" && state.bots.includes(state.turn) ? now + 1100 : null };
}

export function stab(state, seat, slot, now = 0) {
  if (state.phase !== "playing") return { ok: false, error: "wait" };
  if (seat !== state.turn) return { ok: false, error: "turn" };
  const index = Number(slot);
  if (!Number.isInteger(index) || index < 0 || index >= SLOTS) return { ok: false, error: "bounds" };
  if (state.slots[index] != null) return { ok: false, error: "open" };
  const slots = state.slots.slice();
  slots[index] = seat;
  if (index === state.trap) return { ok: true, state: { ...state, slots, phase: "over", loser: seat, last: index, botAt: null } };
  return { ok: true, state: arm({ ...state, slots, last: index, turn: (state.turn + 1) % state.players }, now) };
}

export function act(state, seat, action, now) {
  if (action.type !== "stab") return { ok: false, error: "unknown" };
  return stab(state, seat, action.slot, now);
}

export function tick(state, now) {
  if (state.phase !== "playing" || state.botAt == null || now < state.botAt) return { state, changed: false };
  const open = state.slots.map((v, i) => (v == null ? i : -1)).filter((i) => i >= 0);
  const [pick, rng] = roll(state.rng, open.length);
  const done = stab({ ...state, rng }, state.turn, open[pick], now);
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
    slots: state.slots,
    turn: state.turn,
    last: state.last,
    loser: state.loser,
    left: state.slots.filter((v) => v == null).length,
    trap: state.phase === "over" ? state.trap : null,
  };
}

export function result(state) {
  return state.phase === "over" ? { winnerSeat: null, draw: false, reason: "pirate" } : null;
}

export function turn(state) {
  return state.phase === "playing" ? state.turn : null;
}
