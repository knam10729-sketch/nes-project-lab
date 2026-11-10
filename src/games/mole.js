export const MOLE_DURATION = 60_000;
export const HOLES = 9;

export function initialState(seed = 1) {
  return {
    phase: "waiting",
    startedAt: null,
    endsAt: null,
    active: [],
    scores: [],
    nextId: 1,
    rng: seed >>> 0 || 1,
    nextSpawnAt: 0,
  };
}

export function startRound(state, now, players) {
  if (state.phase === "countdown" || state.phase === "playing") return { ok: false, error: "started" };
  const count = Math.max(1, Math.min(4, players));
  const startedAt = now + 2000;
  return {
    ok: true,
    state: {
      ...initialState(state.rng || 1),
      phase: "countdown",
      startedAt,
      endsAt: startedAt + MOLE_DURATION,
      scores: Array(count).fill(0),
      nextSpawnAt: startedAt,
    },
  };
}

export function tick(state, now) {
  if (state.phase !== "countdown" && state.phase !== "playing") return { state, changed: false };
  let next = { ...state, active: state.active.filter((mole) => mole.expiresAt > now) };
  let changed = next.active.length !== state.active.length;
  if (next.phase === "countdown" && now >= next.startedAt) {
    next = { ...next, phase: "playing" };
    changed = true;
  }
  if (next.phase === "playing" && now >= next.endsAt) {
    return { state: finish(next), changed: true };
  }
  if (next.phase === "playing" && next.active.length < 2 && now >= next.nextSpawnAt && now < next.endsAt - 500) {
    const occupied = new Set(next.active.map((mole) => mole.hole));
    const free = [];
    for (let hole = 0; hole < HOLES; hole += 1) if (!occupied.has(hole)) free.push(hole);
    if (free.length) {
      const roll = mix(next.rng);
      const ttlRoll = mix(roll);
      const hole = free[roll % free.length];
      const ttl = 850 + (ttlRoll % 500);
      const gapRoll = mix(ttlRoll);
      next = {
        ...next,
        rng: gapRoll,
        nextId: next.nextId + 1,
        nextSpawnAt: now + 420 + (gapRoll % 380),
        active: [...next.active, { id: next.nextId, hole, spawnedAt: now, expiresAt: now + ttl }],
      };
      changed = true;
    }
  }
  return { state: next, changed };
}

export function hit(state, seat, moleId, now) {
  if (state.phase !== "playing") return { ok: false, error: "wait" };
  if (!Number.isInteger(seat) || seat < 0 || seat >= state.scores.length) return { ok: false, error: "seat" };
  const mole = state.active.find((item) => item.id === moleId);
  if (!mole || now > mole.expiresAt || now < mole.spawnedAt) return { ok: false, error: "gone" };
  const scores = state.scores.slice();
  scores[seat] += 1;
  return {
    ok: true,
    state: { ...state, scores, active: state.active.filter((item) => item.id !== moleId) },
  };
}

export function nextAlarmAt(state, now) {
  if (state.phase !== "countdown" && state.phase !== "playing") return null;
  const times = [];
  if (state.phase === "countdown") times.push(state.startedAt);
  if (state.phase === "playing") {
    times.push(state.endsAt, state.nextSpawnAt);
    for (const mole of state.active) times.push(mole.expiresAt);
  }
  const future = times.filter((time) => Number.isFinite(time) && time > now);
  return future.length ? Math.min(...future) : now + 200;
}

export function winnerOf(scores) {
  if (!scores.length) return { draw: true, winner: null };
  const best = Math.max(...scores);
  const leaders = scores.map((score, index) => score === best ? index : -1).filter((index) => index >= 0);
  if (leaders.length !== 1) return { draw: true, winner: null };
  return { draw: false, winner: leaders[0] };
}

function finish(state) {
  return { ...state, phase: "over", active: [] };
}

function mix(seed) {
  return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
}
