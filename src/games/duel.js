// 수싸움: both players hold the same cards 1-9 and play one face down each round.
// A card exactly one higher than the other wins the round; otherwise the lower card wins.
// Equal cards score nothing. After nine rounds the higher score wins.
import { leaders, roll, soonest } from "./arcade-util.js";

export const CARDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function initial() {
  return { phase: "waiting", hands: [], picks: [], history: [], scores: [], bots: [], botAt: null, level: "easy", rng: 1 };
}

export function roundWinner(a, b) {
  if (a === b) return null;
  if (a - b === 1) return 0;
  if (b - a === 1) return 1;
  return a < b ? 0 : 1;
}

export function start(state, { seed, bots = [], level = "easy", now = 0 }) {
  const next = {
    ...initial(),
    phase: "playing",
    hands: [CARDS.slice(), CARDS.slice()],
    picks: [null, null],
    scores: [0, 0],
    bots,
    level,
    rng: (seed >>> 0) || 1,
  };
  return { ok: true, state: armBot(next, now) };
}

export function pick(state, seat, card, now = 0) {
  if (state.phase !== "playing") return { ok: false, error: "wait" };
  if (seat !== 0 && seat !== 1) return { ok: false, error: "seat" };
  if (state.picks[seat] != null) return { ok: false, error: "picked" };
  const value = Number(card);
  if (!state.hands[seat].includes(value)) return { ok: false, error: "card" };
  const picks = state.picks.slice();
  picks[seat] = value;
  let next = { ...state, picks };
  if (picks[0] != null && picks[1] != null) {
    const winner = roundWinner(picks[0], picks[1]);
    const scores = state.scores.slice();
    if (winner != null) scores[winner] += 1;
    next = {
      ...next,
      hands: state.hands.map((hand, index) => hand.filter((item) => item !== picks[index])),
      picks: [null, null],
      scores,
      history: [...state.history, { cards: picks, winner }],
    };
    if (next.history.length >= CARDS.length) next.phase = "over";
  }
  return { ok: true, state: armBot(next, now) };
}

export function act(state, seat, action, now) {
  if (action.type !== "pick") return { ok: false, error: "unknown" };
  return pick(state, seat, action.card, now);
}

export function botChoice(state, seat) {
  const hand = state.hands[seat];
  const other = state.hands[1 - seat];
  let [index, rng] = roll(state.rng, hand.length);
  if (state.level !== "normal") return { card: hand[index], rng };
  // Normal: prefer the card that beats the most cards the opponent still holds.
  let best = [];
  let bestWins = -1;
  for (const card of hand) {
    const wins = other.filter((theirs) => roundWinner(seat === 0 ? card : theirs, seat === 0 ? theirs : card) === seat).length;
    if (wins > bestWins) {
      bestWins = wins;
      best = [card];
    } else if (wins === bestWins) best.push(card);
  }
  [index, rng] = roll(rng, best.length);
  return { card: best[index], rng };
}

function armBot(state, now) {
  const waiting = state.phase === "playing" && state.bots.some((seat) => state.picks[seat] == null);
  return { ...state, botAt: waiting ? now + 700 : null };
}

export function tick(state, now) {
  if (state.phase !== "playing" || state.botAt == null || now < state.botAt) return { state, changed: false };
  const seat = state.bots.find((item) => state.picks[item] == null);
  if (seat == null) return { state: { ...state, botAt: null }, changed: true };
  const choice = botChoice(state, seat);
  const done = pick({ ...state, rng: choice.rng }, seat, choice.card, now);
  return { state: done.ok ? done.state : { ...state, botAt: null }, changed: true };
}

export function alarm(state, now) {
  if (state.phase !== "playing" || state.botAt == null) return null;
  return soonest([state.botAt], now) ?? now + 50;
}

export function view(state) {
  return {
    phase: state.phase,
    ready: state.picks.map((item) => item != null),
    history: state.history,
    scores: state.scores,
    left: state.hands.map((hand) => hand.length),
    round: Math.min(state.history.length + 1, CARDS.length),
    total: CARDS.length,
  };
}

export function secret(state, seat) {
  if (seat !== 0 && seat !== 1) return null;
  return { hand: state.hands[seat] || [], pick: state.picks[seat] ?? null };
}

export function result(state) {
  if (state.phase !== "over") return null;
  const top = leaders(state.scores);
  return { winnerSeat: top.length === 1 ? top[0] : null, draw: top.length !== 1, reason: "rounds" };
}

export function turn() {
  return null;
}
