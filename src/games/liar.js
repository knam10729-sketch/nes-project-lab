import { CATEGORIES, pickWord } from "./words.js";

export function initialState() {
  return {
    phase: "waiting",
    categoryId: null,
    category: null,
    word: null,
    liar: null,
    round: 0,
    rounds: 2,
    turn: 0,
    hints: [],
    votes: {},
    accused: null,
    guess: null,
    playerCount: 0,
  };
}

export function categories() {
  return Object.entries(CATEGORIES).map(([id, category]) => ({ id, label: category.label }));
}

export function begin(state, playerCount, categoryId, liarSeat, wordIndex) {
  const count = Number(playerCount);
  if (count < 3 || count > 5) return { ok: false, error: "players" };
  const picked = pickWord(categoryId, wordIndex);
  if (!picked) return { ok: false, error: "category" };
  if (!Number.isInteger(liarSeat) || liarSeat < 0 || liarSeat >= count) return { ok: false, error: "liar" };
  return {
    ok: true,
    state: {
      ...initialState(),
      phase: "hint",
      categoryId,
      category: picked.category,
      word: picked.word,
      liar: liarSeat,
      turn: 0,
      playerCount: count,
    },
  };
}

export function hint(state, seat, text) {
  if (state.phase !== "hint") return { ok: false, error: "phase" };
  if (seat !== state.turn) return { ok: false, error: "turn" };
  const line = cleanLine(text);
  if (!line) return { ok: false, error: "empty" };
  if (normalize(line).includes(normalize(state.word))) return { ok: false, error: "word" };
  const hints = [...state.hints, { seat, text: line, round: state.round }];
  let turn = state.turn + 1;
  let round = state.round;
  let phase = "hint";
  if (turn >= state.playerCount) {
    turn = 0;
    round += 1;
    if (round >= state.rounds) phase = "vote";
  }
  return { ok: true, state: { ...state, hints, turn, round, phase } };
}

export function vote(state, seat, target) {
  if (state.phase !== "vote") return { ok: false, error: "phase" };
  if (!Number.isInteger(seat) || seat < 0 || seat >= state.playerCount) return { ok: false, error: "seat" };
  if (state.votes[seat] != null) return { ok: false, error: "voted" };
  if (!Number.isInteger(target) || target < 0 || target >= state.playerCount || target === seat) return { ok: false, error: "target" };
  const votes = { ...state.votes, [seat]: target };
  if (Object.keys(votes).length < state.playerCount) return { ok: true, state: { ...state, votes } };
  const tally = Array(state.playerCount).fill(0);
  for (const choice of Object.values(votes)) tally[choice] += 1;
  const top = Math.max(...tally);
  const leaders = tally.map((count, index) => count === top ? index : -1).filter((index) => index >= 0);
  if (leaders.length !== 1 || leaders[0] !== state.liar) {
    return { ok: true, state: { ...state, votes, phase: "over", accused: leaders.length === 1 ? leaders[0] : null, result: "escaped" } };
  }
  return { ok: true, state: { ...state, votes, phase: "guess", accused: state.liar, result: null } };
}

export function guess(state, seat, text) {
  if (state.phase !== "guess") return { ok: false, error: "phase" };
  if (seat !== state.liar) return { ok: false, error: "turn" };
  const line = cleanLine(text);
  if (!line) return { ok: false, error: "empty" };
  const correct = normalize(line) === normalize(state.word);
  return {
    ok: true,
    state: { ...state, phase: "over", guess: line, result: correct ? "guessed" : "caught" },
  };
}

export function secretFor(state, seat) {
  if (!state.word || state.phase === "waiting") return null;
  const liar = seat === state.liar;
  return {
    role: liar ? "liar" : "citizen",
    category: state.category,
    word: liar || state.phase === "over" ? (state.phase === "over" ? state.word : null) : state.word,
  };
}

export function publicView(state) {
  const reveal = state.phase === "over" || state.phase === "guess";
  return {
    phase: state.phase,
    category: state.category,
    round: state.round,
    rounds: state.rounds,
    turn: state.phase === "hint" ? state.turn : state.phase === "guess" ? state.liar : null,
    hints: state.hints,
    voted: Object.keys(state.votes).map(Number),
    votes: state.phase === "over" ? state.votes : null,
    accused: reveal ? state.accused : null,
    liar: state.phase === "over" ? state.liar : null,
    word: state.phase === "over" ? state.word : null,
    guess: state.phase === "over" ? state.guess : null,
    result: state.phase === "over" ? state.result : null,
    playerCount: state.playerCount,
  };
}

function cleanLine(text) {
  return String(text ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 40);
}

function normalize(text) {
  return String(text).replace(/\s+/g, "").toLowerCase();
}
