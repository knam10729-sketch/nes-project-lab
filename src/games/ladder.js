// 사다리타기: lanes at the top, results at the bottom, random rungs in between.
// In a room each seat is a lane; on one phone ("한 화면") the host types the names.
import { mix, shuffle } from "./arcade-util.js";

export const ROWS = 10;
export const MAX_LANES = 8;

export function initial() {
  return { phase: "waiting" };
}

function cleanList(list, max) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => String(item ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, max)).filter(Boolean);
}

export function makeRungs(lanes, seed) {
  let s = seed >>> 0 || 1;
  const rungs = [];
  for (let row = 0; row < ROWS; row += 1) {
    let prev = -2;
    for (let gap = 0; gap < lanes - 1; gap += 1) {
      s = mix(s);
      if (gap !== prev + 1 && (s >>> 8) % 100 < 42) {
        rungs.push([row, gap]);
        prev = gap;
      }
    }
  }
  // Every gap gets at least one rung so no lane drops straight down untouched.
  for (let gap = 0; gap < lanes - 1; gap += 1) {
    if (rungs.some(([, g]) => g === gap)) continue;
    for (let row = 0; row < ROWS; row += 1) {
      if (!rungs.some(([r, g]) => r === row && Math.abs(g - gap) <= 1)) {
        rungs.push([row, gap]);
        break;
      }
    }
  }
  return { rungs: rungs.sort((a, b) => a[0] - b[0] || a[1] - b[1]), seed: s };
}

export function walk(lane, rungs) {
  let at = lane;
  const path = [[at, -1]];
  for (let row = 0; row < ROWS; row += 1) {
    if (rungs.some(([r, g]) => r === row && g === at - 1)) at -= 1;
    else if (rungs.some(([r, g]) => r === row && g === at)) at += 1;
    path.push([at, row]);
  }
  return { end: at, path };
}

export function start(state, { players, seed, options = {}, solo = false }) {
  const names = solo ? cleanList(options.names, 8).slice(0, MAX_LANES) : null;
  const lanes = solo ? names.length : Math.min(players, MAX_LANES);
  if (lanes < 2) return { ok: false, error: "lanes" };
  let results = cleanList(options.results, 8).slice(0, lanes);
  if (!results.length) results = ["당첨"];
  while (results.length < lanes) results.push("꽝");
  const made = makeRungs(lanes, seed);
  const [bottom] = shuffle(results, made.seed);
  const ends = Array.from({ length: lanes }, (_, lane) => walk(lane, made.rungs).end);
  return { ok: true, state: { phase: "done", lanes, names, rungs: made.rungs, bottom, ends } };
}

export function tick(state) {
  return { state, changed: false };
}

export function act() {
  return { ok: false, error: "wait" };
}

export function alarm() {
  return null;
}

export function view(state) {
  if (state.phase !== "done") return { phase: state.phase };
  return { phase: "done", lanes: state.lanes, names: state.names, rows: ROWS, rungs: state.rungs, bottom: state.bottom, ends: state.ends };
}

export function result(state) {
  return state.phase === "done" ? { winnerSeat: null, draw: false, reason: "ladder" } : null;
}

export function turn() {
  return null;
}
