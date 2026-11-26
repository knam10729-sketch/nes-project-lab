// 눈치게임: call the numbers 1, 2, 3 … one at a time. Two people calling within the same
// moment both lose; the one person left who never called also loses.
import { mix, soonest } from "./arcade-util.js";

export const WINDOW_MS = 700;
export const IDLE_MS = 12_000;
const COUNTDOWN_MS = 3000;

export function initial() {
  return { phase: "waiting" };
}

export function start(state, { players, now, seed, bots = [], level = "easy" }) {
  const next = {
    phase: "countdown",
    players: Math.max(2, Math.min(8, players)),
    startAt: now + COUNTDOWN_MS,
    deadline: now + COUNTDOWN_MS + IDLE_MS,
    called: [],
    pending: null,
    losers: [],
    why: null,
    bots,
    level,
    plans: {},
    rng: (seed >>> 0) || 1,
  };
  return { ok: true, state: planBots(next, next.startAt) };
}

function free(state) {
  const done = new Set(state.called.map((item) => item.seat));
  const busy = new Set(state.pending?.seats || []);
  return Array.from({ length: state.players }, (_, seat) => seat).filter((seat) => !done.has(seat) && !busy.has(seat));
}

function planBots(state, from) {
  const plans = { ...state.plans };
  let rng = state.rng;
  for (const seat of state.bots) {
    if (plans[seat] != null || !free(state).includes(seat)) continue;
    rng = mix(rng);
    const spread = state.level === "normal" ? 5000 : 3500;
    plans[seat] = from + 600 + ((rng >>> 8) % spread);
  }
  return { ...state, plans, rng };
}

function press(state, seat, now) {
  if (state.pending && now - state.pending.at <= WINDOW_MS) {
    return { ...state, pending: { ...state.pending, seats: [...state.pending.seats, seat] } };
  }
  return { ...state, pending: { number: state.called.length + 1, seats: [seat], at: now } };
}

function settle(state, now) {
  let next = state;
  if (next.phase === "countdown" && now >= next.startAt) next = { ...next, phase: "playing" };
  if (next.phase !== "playing") return next;
  if (next.pending && now >= next.pending.at + WINDOW_MS) {
    const { seats, number } = next.pending;
    if (seats.length > 1) return { ...next, phase: "over", pending: null, losers: seats, why: "together", clash: number, plans: {} };
    next = { ...next, called: [...next.called, { number, seat: seats[0] }], pending: null, deadline: now + IDLE_MS };
    const left = free(next);
    if (left.length === 1) return { ...next, phase: "over", losers: left, why: "last", plans: {} };
    next = planBots(next, now);
  }
  if (!next.pending && now >= next.deadline) return { ...next, phase: "over", losers: free(next), why: "idle", plans: {} };
  return next;
}

export function tick(state, now) {
  if (state.phase !== "countdown" && state.phase !== "playing") return { state, changed: false };
  let next = settle(state, now);
  for (let guard = 0; guard < 20 && next.phase === "playing"; guard += 1) {
    const due = Object.entries(next.plans).filter(([, at]) => at <= now).sort((a, b) => a[1] - b[1])[0];
    if (!due) break;
    const seat = Number(due[0]);
    const plans = { ...next.plans };
    delete plans[seat];
    next = { ...next, plans };
    if (free(next).includes(seat)) next = press(next, seat, Number(due[1]));
    next = settle(next, now);
  }
  return { state: next, changed: JSON.stringify(next) !== JSON.stringify(state) };
}

export function act(state, seat, action, now) {
  if (action.type !== "call") return { ok: false, error: "unknown" };
  const ready = settle(state, now);
  if (ready.phase === "countdown") return { ok: false, error: "wait" };
  if (ready.phase !== "playing") return { ok: true, state: ready };
  if (!free(ready).includes(seat)) return { ok: false, error: "done" };
  return { ok: true, state: press(ready, seat, now) };
}

export function alarm(state, now) {
  if (state.phase === "countdown") return soonest([state.startAt, ...Object.values(state.plans)], now) ?? now + 50;
  if (state.phase !== "playing") return null;
  const times = [state.deadline, ...Object.values(state.plans)];
  if (state.pending) times.push(state.pending.at + WINDOW_MS);
  return soonest(times, now) ?? now + 50;
}

export function view(state) {
  if (state.phase === "waiting") return { phase: "waiting" };
  return {
    phase: state.phase,
    startAt: state.startAt,
    deadline: state.deadline,
    next: state.called.length + 1 + (state.pending ? 1 : 0),
    called: state.called,
    pending: state.pending,
    losers: state.losers,
    why: state.why,
    clash: state.clash ?? null,
    players: state.players,
  };
}

export function result(state) {
  return state.phase === "over" ? { winnerSeat: null, draw: false, reason: "nunchi" } : null;
}

export function turn() {
  return null;
}
