import { choseong, drawWord, DRAW_WORDS } from "./words.js";

export const ROUND_MS = 80_000;
export const HINT_MS = 40_000;
const COLORS = new Set(["#171717", "#f4f1ea", "#c4554a", "#d38b2c", "#2f7d4a", "#2a6f97", "#6b4c9a", "#8a5a44"]);

export function initialState() {
  return {
    phase: "waiting",
    drawer: 0,
    word: null,
    hint: null,
    startedAt: null,
    hintAt: null,
    endsAt: null,
    strokes: [],
    solved: [],
    scores: [],
    playerCount: 0,
    round: 0,
    totalRounds: 0,
    reveal: null,
    lastPoints: null,
  };
}

export function begin(state, playerCount, wordIndex, now, options = {}) {
  const count = Number(playerCount);
  if (count < 2 || count > 5) return { ok: false, error: "players" };
  const base = {
    ...initialState(),
    scores: Array(count).fill(0),
    playerCount: count,
    totalRounds: options.rounds || count,
    soloGuess: Boolean(options.soloGuess),
    botDrawer: options.botDrawer ?? 0,
    pack: options.pack || null,
  };
  return { ok: true, state: openRound(base, 0, wordIndex, now) };
}

export function tick(state, now) {
  if (state.phase !== "draw") return { state, changed: false };
  let next = state;
  let changed = false;
  if (!next.hint && now >= next.hintAt) {
    next = { ...next, hint: choseong(next.word) };
    changed = true;
  }
  if (now >= next.endsAt || next.solved.length >= next.playerCount - 1) {
    return { state: closeRound(next, now), changed: true };
  }
  return { state: next, changed };
}

export function stroke(state, seat, input, now) {
  if (state.phase !== "draw") return { ok: false, error: "phase" };
  if (seat !== state.drawer) return { ok: false, error: "drawer" };
  if (now - (state.lastInk || 0) < 40) return { ok: false, error: "fast" };
  const ink = sanitizeStroke(input);
  if (!ink) return { ok: false, error: "stroke" };
  const used = state.strokes.reduce((sum, item) => sum + item.points.length, 0);
  if (used + ink.points.length > 1800) return { ok: false, error: "full" };
  return {
    ok: true,
    stroke: ink,
    state: { ...state, lastInk: now, strokes: [...state.strokes, ink] },
  };
}

export function clearBoard(state, seat) {
  if (state.phase !== "draw") return { ok: false, error: "phase" };
  if (seat !== state.drawer) return { ok: false, error: "drawer" };
  return { ok: true, state: { ...state, strokes: [] } };
}

export function guess(state, seat, text, now) {
  if (state.phase !== "draw") return { ok: false, error: "phase" };
  if (seat === state.drawer) return { ok: false, error: "drawer" };
  if (state.solved.includes(seat)) return { ok: false, error: "solved" };
  const line = String(text ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 30);
  if (!line) return { ok: false, error: "empty" };
  const correct = normalize(line) === normalize(state.word);
  const log = [...(state.log || []), { seat, text: correct ? null : line, correct }].slice(-40);
  if (!correct) return { ok: true, state: { ...state, log }, correct: false, line };
  const remain = Math.max(0, state.endsAt - now);
  const guesserPoints = 40 + Math.round(remain / 1000);
  const scores = state.scores.slice();
  scores[seat] += guesserPoints;
  scores[state.drawer] += 25;
  const solved = [...state.solved, seat];
  const lastPoints = { seat, points: guesserPoints, drawer: state.drawer };
  let next = { ...state, scores, solved, lastPoints, log };
  if (solved.length >= state.playerCount - 1) next = closeRound(next, now);
  return { ok: true, state: next, correct: true, line, points: guesserPoints };
}

export function secretFor(state, seat) {
  if (state.phase === "waiting" || !state.word) return null;
  if (seat === state.drawer && state.phase === "draw") return { word: state.word, role: "drawer" };
  return { role: "guesser", hint: state.hint };
}

export function publicView(state) {
  return {
    phase: state.phase,
    drawer: state.drawer,
    hint: state.hint,
    startedAt: state.startedAt,
    hintAt: state.hintAt,
    endsAt: state.endsAt,
    duration: ROUND_MS,
    strokes: state.strokes,
    solved: state.solved,
    scores: state.scores,
    round: state.round,
    totalRounds: state.totalRounds,
    reveal: state.reveal,
    previous: state.previous || null,
    lastPoints: state.lastPoints,
    log: state.log || [],
    playerCount: state.playerCount,
  };
}

export function nextAlarm(state, now) {
  if (state.phase !== "draw") return null;
  const times = [];
  if (!state.hint) times.push(state.hintAt);
  times.push(state.endsAt);
  const future = times.filter((time) => time > now);
  return future.length ? Math.min(...future) : now + 100;
}

export function wordCount() {
  return DRAW_WORDS.length;
}

function openRound(state, round, wordIndex, now) {
  const item = state.pack ? state.pack[round % state.pack.length] : null;
  const word = item ? item.word : drawWord(wordIndex + round * 17);
  return {
    ...state,
    phase: "draw",
    drawer: state.soloGuess ? state.botDrawer : round % state.playerCount,
    word,
    script: item ? item.strokes : null,
    scriptCursor: 0,
    hint: null,
    startedAt: now,
    hintAt: now + HINT_MS,
    endsAt: now + ROUND_MS,
    strokes: [],
    solved: [],
    round: round + 1,
    reveal: null,
    lastPoints: null,
    lastInk: 0,
    log: [],
  };
}

function closeRound(state, now) {
  const previous = state.word;
  if (state.round >= state.totalRounds) {
    return { ...state, phase: "over", reveal: previous, previous, hint: choseong(previous), strokes: [] };
  }
  return { ...openRound(state, state.round, hash(previous), now), previous };
}

function sanitizeStroke(input) {
  if (!input || typeof input !== "object") return null;
  const points = Array.isArray(input.points) ? input.points.slice(0, 24) : [];
  const clean = [];
  for (const point of points) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const x = clamp(point[0]);
    const y = clamp(point[1]);
    if (x == null || y == null) continue;
    clean.push([x, y]);
  }
  if (!clean.length) return null;
  const color = COLORS.has(input.color) ? input.color : "#171717";
  const id = String(input.id || "").replace(/[^\w-]/g, "").slice(0, 24);
  if (!id) return null;
  return { id, color, erase: Boolean(input.erase), points: clean };
}

function clamp(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(1000, Math.round(number)));
}

function normalize(text) {
  return String(text).replace(/\s+/g, "").toLowerCase();
}

function hash(text) {
  return [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}
