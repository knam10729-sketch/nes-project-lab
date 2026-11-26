// 초성퀴즈: the server shows the initial consonants of a word; the first to type the word scores.
// Words come from the shared word list in words.js.
import { mix, soonest } from "./arcade-util.js";
import { CATEGORIES } from "./words.js";

const INITIALS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
export const ROUNDS = 8;
export const ROUND_MS = 25_000;
export const HINT_MS = 12_000;
const RESULT_MS = 2600;
const READY_MS = 2000;

export function chosungOf(word) {
  return [...String(word)].map((ch) => {
    const code = ch.charCodeAt(0) - 0xac00;
    return code >= 0 && code < 11172 ? INITIALS[Math.floor(code / 588)] : ch;
  }).join("");
}

function hangulOnly(word) {
  return /^[\uac00-\ud7a3]{2,5}$/.test(word);
}

export function pool(categoryId = "all") {
  const ids = categoryId !== "all" && CATEGORIES[categoryId] ? [categoryId] : Object.keys(CATEGORIES);
  const list = [];
  for (const id of ids) {
    for (const word of CATEGORIES[id].words) if (hangulOnly(word)) list.push({ word, cat: id });
  }
  return list;
}

function clean(text) {
  return String(text ?? "").replace(/\s+/g, "").slice(0, 20);
}

export function initial() {
  return { phase: "waiting" };
}

export function start(state, { players, seed, now, options = {} }) {
  const categoryId = options.category && CATEGORIES[options.category] ? options.category : "all";
  const next = {
    phase: "ready",
    players: Math.max(1, Math.min(8, players)),
    categoryId,
    scores: Array(Math.max(1, Math.min(8, players))).fill(0),
    round: 0,
    used: [],
    guesses: [],
    rng: (seed >>> 0) || 1,
    nextAt: now + READY_MS,
  };
  return { ok: true, state: next };
}

function nextRound(state, now) {
  const list = pool(state.categoryId).filter((item) => !state.used.includes(item.word));
  const words = list.length ? list : pool(state.categoryId);
  const rng = mix(state.rng);
  const pick = words[(rng >>> 8) % words.length];
  return {
    ...state,
    phase: "round",
    round: state.round + 1,
    rng,
    word: pick.word,
    cat: pick.cat,
    used: [...state.used, pick.word],
    startedAt: now,
    hintAt: now + HINT_MS,
    endsAt: now + ROUND_MS,
    nextAt: now + ROUND_MS,
    solver: null,
    hinted: false,
    guesses: [],
  };
}

function finishRound(state, solver, now) {
  return { ...state, phase: "result", solver, nextAt: now + RESULT_MS };
}

export function tick(state, now) {
  if (state.phase === "round" && !state.hinted && now >= state.hintAt && now < state.nextAt) return { state: { ...state, hinted: true }, changed: true };
  if (state.phase === "waiting" || state.phase === "over" || now < state.nextAt) return { state, changed: false };
  if (state.phase === "ready") return { state: nextRound(state, now), changed: true };
  if (state.phase === "round") return { state: finishRound(state, null, now), changed: true };
  if (state.round >= ROUNDS) return { state: { ...state, phase: "over" }, changed: true };
  return { state: nextRound(state, now), changed: true };
}

export function correct(state, text) {
  const guess = clean(text);
  if (!guess) return false;
  if (guess === state.word) return true;
  // Another word from the same category with the same initials also counts.
  return chosungOf(guess) === chosungOf(state.word) && CATEGORIES[state.cat].words.includes(guess);
}

export function act(state, seat, action, now) {
  if (action.type !== "answer") return { ok: false, error: "unknown" };
  if (state.phase !== "round") return { ok: false, error: "wait" };
  if (!Number.isInteger(seat) || seat < 0 || seat >= state.scores.length) return { ok: false, error: "seat" };
  const text = clean(action.text);
  if (!text) return { ok: false, error: "empty" };
  if (correct(state, text)) {
    const scores = state.scores.slice();
    scores[seat] += now < state.hintAt ? 2 : 1;
    return { ok: true, state: finishRound({ ...state, scores, guesses: [...state.guesses, { seat, ok: true }].slice(-6) }, seat, now) };
  }
  return { ok: true, state: { ...state, guesses: [...state.guesses, { seat, text, ok: false }].slice(-6) } };
}

export function alarm(state, now) {
  if (state.phase === "waiting" || state.phase === "over") return null;
  const times = [state.nextAt];
  if (state.phase === "round" && !state.hinted) times.push(state.hintAt);
  return soonest(times, now) ?? now + 50;
}

export function view(state) {
  if (state.phase === "waiting") return { phase: "waiting" };
  const reveal = state.phase === "result" || state.phase === "over";
  const hinted = state.phase === "round" && state.hinted;
  return {
    phase: state.phase,
    round: state.round,
    total: ROUNDS,
    category: state.cat ? CATEGORIES[state.cat].label : null,
    chosung: state.word ? chosungOf(state.word) : null,
    hint: hinted || reveal ? [...state.word][0] : null,
    answer: reveal ? state.word || null : null,
    solver: state.solver ?? null,
    endsAt: state.endsAt || null,
    hintAt: state.hintAt || null,
    duration: ROUND_MS,
    scores: state.scores,
    guesses: state.guesses,
    nextAt: state.nextAt,
  };
}

export function result(state) {
  if (state.phase !== "over") return null;
  const best = Math.max(...state.scores);
  const top = state.scores.map((s, i) => (s === best ? i : -1)).filter((i) => i >= 0);
  return { winnerSeat: top.length === 1 ? top[0] : null, draw: top.length !== 1, reason: "quiz" };
}

export function turn() {
  return null;
}
