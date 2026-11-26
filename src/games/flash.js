// 찰나: a target card is shown, then cards flip one by one in the middle.
// The first to tap when the middle card matches the target scores. Tapping too early costs a point
// and benches you until the next round. First to five points wins.
import { leaders, mix, soonest } from "./arcade-util.js";

export const SYMBOLS = ["🍎", "🍋", "🍇", "🥝", "🫐", "🍑", "🥥", "🍒"];
export const GOAL = 5;
export const MAX_ROUNDS = 12;
const READY_MS = 1500;
const RESULT_MS = 1600;

export function initial() {
  return { phase: "waiting", scores: [], round: 0, rng: 1, bots: [], level: "easy" };
}

export function start(state, { players, seed, now, bots = [], level = "easy" }) {
  const count = Math.max(2, Math.min(4, players));
  const next = { ...initial(), players: count, scores: Array(count).fill(0), rng: (seed >>> 0) || 1, bots, level, history: [] };
  return { ok: true, state: newRound(next, now) };
}

function newRound(state, now) {
  const a = mix(state.rng);
  const b = mix(a);
  const target = (a >>> 8) % SYMBOLS.length;
  return {
    ...state,
    phase: "ready",
    round: state.round + 1,
    rng: b,
    target,
    card: null,
    cardId: 0,
    match: false,
    // The target shows up after 2 to 6 other cards.
    decoys: 2 + ((b >>> 8) % 5),
    nextAt: now + READY_MS,
    benched: [],
    winner: null,
    botAt: null,
  };
}

function flip(state, now) {
  const a = mix(state.rng);
  const b = mix(a);
  const showTarget = state.decoys <= 0;
  let card = state.target;
  if (!showTarget) {
    card = (a >>> 8) % (SYMBOLS.length - 1);
    if (card >= state.target) card += 1;
  }
  const gap = 750 + ((b >>> 8) % 650);
  const next = {
    ...state,
    phase: "flip",
    rng: b,
    card,
    cardId: state.cardId + 1,
    shownAt: now,
    match: showTarget,
    decoys: state.decoys - 1,
    nextAt: showTarget ? now + 2600 : now + gap,
  };
  if (showTarget) {
    const delays = next.bots.filter((seat) => !next.benched.includes(seat)).map((seat) => now + botDelay(next, seat));
    next.botAt = delays.length ? Math.min(...delays) : null;
    next.botSeat = delays.length ? next.bots.filter((seat) => !next.benched.includes(seat))[delays.indexOf(Math.min(...delays))] : null;
  }
  return next;
}

function botDelay(state, seat) {
  const base = state.level === "normal" ? 430 : 650;
  return base + ((mix(state.rng + seat * 97) >>> 8) % 350);
}

export function tick(state, now) {
  if (state.phase === "waiting" || state.phase === "over") return { state, changed: false };
  let next = state;
  let changed = false;
  for (let guard = 0; guard < 20; guard += 1) {
    if (next.phase === "flip" && next.match && next.botAt != null && now >= next.botAt && next.botAt <= next.nextAt) {
      next = score(next, next.botSeat, now);
      changed = true;
      continue;
    }
    if (now < next.nextAt) break;
    if (next.phase === "result") next = finishOrNext(next, now);
    else if (next.phase === "flip" && next.match) next = { ...next, phase: "result", winner: null, nextAt: now + RESULT_MS, history: [...next.history, { round: next.round, winner: null }] };
    else next = flip(next, now);
    changed = true;
    if (next.phase === "over") break;
  }
  return { state: next, changed };
}

function finishOrNext(state, now) {
  if (state.scores.some((value) => value >= GOAL) || state.round >= MAX_ROUNDS) return { ...state, phase: "over", botAt: null };
  return newRound(state, now);
}

function score(state, seat, now) {
  const scores = state.scores.slice();
  scores[seat] += 1;
  return {
    ...state,
    scores,
    phase: "result",
    winner: seat,
    botAt: null,
    nextAt: now + RESULT_MS,
    history: [...state.history, { round: state.round, winner: seat }],
  };
}

export function act(state, seat, action, now) {
  if (action.type !== "tap") return { ok: false, error: "unknown" };
  if (!Number.isInteger(seat) || seat < 0 || seat >= state.scores.length) return { ok: false, error: "seat" };
  if (state.phase !== "flip" && state.phase !== "ready") return { ok: false, error: "wait" };
  if (state.benched.includes(seat)) return { ok: false, error: "benched" };
  if (state.phase === "flip" && state.match && Number(action.cardId) === state.cardId) return { ok: true, state: score(state, seat, now) };
  const scores = state.scores.slice();
  scores[seat] -= 1;
  return { ok: true, state: { ...state, scores, benched: [...state.benched, seat] } };
}

export function alarm(state, now) {
  if (state.phase === "waiting" || state.phase === "over") return null;
  const times = [state.nextAt];
  if (state.phase === "flip" && state.match && state.botAt != null) times.push(state.botAt);
  return soonest(times, now) ?? now + 50;
}

export function view(state) {
  return {
    phase: state.phase,
    round: state.round,
    maxRounds: MAX_ROUNDS,
    goal: GOAL,
    target: state.target != null ? SYMBOLS[state.target] : null,
    card: state.card != null && state.phase !== "ready" ? SYMBOLS[state.card] : null,
    cardId: state.cardId || 0,
    benched: state.benched || [],
    winner: state.winner ?? null,
    scores: state.scores,
    history: (state.history || []).slice(-6),
  };
}

export function result(state) {
  if (state.phase !== "over") return null;
  const top = leaders(state.scores);
  return { winnerSeat: top.length === 1 ? top[0] : null, draw: top.length !== 1, reason: "points" };
}

export function turn() {
  return null;
}
