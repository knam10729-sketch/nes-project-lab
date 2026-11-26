// 풍선 터뜨리기: every player owns one colour. Only your own colour counts; a wrong pop costs a point.
import { leaders, mix, soonest } from "./arcade-util.js";

export const SPOTS = 12;
export const COLORS = 4;
export const DURATION = 45_000;

export function initial() {
  return { phase: "waiting", scores: [], active: [], pops: [], nextId: 1, rng: 1, nextSpawnAt: 0, startedAt: null, endsAt: null };
}

export function start(state, { players, now, seed }) {
  const count = Math.max(1, Math.min(4, players));
  const startedAt = now + 2000;
  return {
    ok: true,
    state: {
      ...initial(),
      phase: "countdown",
      players: count,
      rng: (seed >>> 0) || 1,
      startedAt,
      endsAt: startedAt + DURATION,
      duration: DURATION,
      nextSpawnAt: startedAt,
      scores: Array(count).fill(0),
    },
  };
}

export function tick(state, now) {
  if (state.phase !== "countdown" && state.phase !== "playing") return { state, changed: false };
  let next = { ...state, active: state.active.filter((item) => item.expiresAt > now) };
  let changed = next.active.length !== state.active.length;
  if (next.phase === "countdown" && now >= next.startedAt) {
    next.phase = "playing";
    changed = true;
  }
  if (next.phase === "playing" && now >= next.endsAt) {
    return { state: { ...next, phase: "over", active: [] }, changed: true };
  }
  const cap = Math.min(6, 2 + next.players);
  while (next.phase === "playing" && next.active.length < cap && now >= next.nextSpawnAt && now < next.endsAt - 400) {
    const used = new Set(next.active.map((item) => item.spot));
    const free = [];
    for (let spot = 0; spot < SPOTS; spot += 1) if (!used.has(spot)) free.push(spot);
    if (!free.length) break;
    const a = mix(next.rng);
    const b = mix(a);
    const c = mix(b);
    // Colours of seated players come up more often than decoys.
    const pool = [];
    for (let color = 0; color < COLORS; color += 1) pool.push(color, ...(color < next.players ? [color, color] : []));
    const color = pool[(b >>> 8) % pool.length];
    const ttl = 1300 + ((c >>> 8) % 900);
    next = {
      ...next,
      rng: c,
      nextId: next.nextId + 1,
      nextSpawnAt: now + 260 + ((c >>> 4) % 300),
      active: [...next.active, { id: next.nextId, spot: free[(a >>> 8) % free.length], color, spawnedAt: now, expiresAt: now + ttl }],
    };
    changed = true;
  }
  return { state: next, changed };
}

export function act(state, seat, action, now) {
  if (action.type !== "pop") return { ok: false, error: "unknown" };
  if (state.phase !== "playing") return { ok: false, error: "wait" };
  if (!Number.isInteger(seat) || seat < 0 || seat >= state.scores.length) return { ok: false, error: "seat" };
  const id = Number(action.id);
  const balloon = state.active.find((item) => item.id === id);
  if (!balloon || now > balloon.expiresAt) return { ok: false, error: "gone" };
  const scores = state.scores.slice();
  const good = balloon.color === seat;
  scores[seat] += good ? 1 : -1;
  const pop = { id, spot: balloon.spot, color: balloon.color, seat, good, at: now };
  return {
    ok: true,
    state: {
      ...state,
      scores,
      active: good ? state.active.filter((item) => item.id !== id) : state.active,
      pops: [...state.pops, pop].slice(-8),
    },
  };
}

export function alarm(state, now) {
  if (state.phase === "countdown") return soonest([state.startedAt], now) ?? now + 100;
  if (state.phase !== "playing") return null;
  return soonest([state.endsAt, state.nextSpawnAt, ...state.active.map((item) => item.expiresAt)], now) ?? now + 150;
}

export function view(state) {
  return {
    phase: state.phase,
    startedAt: state.startedAt,
    endsAt: state.endsAt,
    duration: state.duration || DURATION,
    active: state.active,
    scores: state.scores,
    pops: state.pops,
  };
}

export function result(state) {
  if (state.phase !== "over") return null;
  const top = leaders(state.scores);
  return { winnerSeat: top.length === 1 ? top[0] : null, draw: top.length !== 1, reason: "time" };
}

export function turn() {
  return null;
}
