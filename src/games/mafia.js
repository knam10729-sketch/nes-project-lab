export const NIGHT_MS = 45_000;
export const DAY_MS = 90_000;
export const VOTE_MS = 45_000;

const LABEL = { mafia: "마피아", police: "경찰", doctor: "의사", citizen: "시민" };

export function initialState() {
  return {
    phase: "waiting",
    roles: [],
    alive: [],
    round: 0,
    nightChoices: {},
    votes: {},
    notes: {},
    log: [],
    endsAt: 0,
    duration: 0,
    winner: null,
    playerCount: 0,
  };
}

export function roleBag(count) {
  const size = Number(count);
  if (!Number.isInteger(size) || size < 4 || size > 10) return null;
  const mafia = size >= 9 ? 3 : size >= 6 ? 2 : 1;
  const citizens = size - mafia - 2;
  return [...Array(mafia).fill("mafia"), "police", "doctor", ...Array(citizens).fill("citizen")];
}

export function assignRoles(count, randomInt) {
  const bag = roleBag(count);
  if (!bag) return null;
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    [bag[index], bag[swap]] = [bag[swap], bag[index]];
  }
  return bag;
}

export function begin(state, roles, now) {
  if (!Array.isArray(roles) || !roleBag(roles.length)) return { ok: false, error: "players" };
  const expected = roleBag(roles.length).slice().sort().join(",");
  if (roles.slice().sort().join(",") !== expected) return { ok: false, error: "roles" };
  return {
    ok: true,
    state: {
      ...initialState(),
      phase: "night",
      roles: roles.slice(),
      alive: roles.map(() => true),
      round: 1,
      playerCount: roles.length,
      endsAt: now + NIGHT_MS,
      duration: NIGHT_MS,
      log: [{ kind: "night-start", round: 1 }],
    },
  };
}

export function actNight(state, seat, target, now = state.endsAt) {
  if (state.phase !== "night") return { ok: false, error: "phase" };
  if (!living(state, seat)) return { ok: false, error: "dead" };
  const role = state.roles[seat];
  if (role === "citizen") return { ok: false, error: "role" };
  if (!living(state, target)) return { ok: false, error: "target" };
  if (role === "mafia" && (target === seat || state.roles[target] === "mafia")) return { ok: false, error: "target" };
  const nightChoices = { ...state.nightChoices, [seat]: target };
  const next = { ...state, nightChoices };
  if (!nightReady(next)) return { ok: true, state: next };
  return { ok: true, state: resolveNight(next, now) };
}

export function vote(state, seat, target, now = state.endsAt) {
  if (state.phase !== "vote") return { ok: false, error: "phase" };
  if (!living(state, seat) || !living(state, target) || seat === target) return { ok: false, error: "target" };
  if (state.votes[seat] != null) return { ok: false, error: "voted" };
  const votes = { ...state.votes, [seat]: target };
  const next = { ...state, votes };
  const livingSeats = next.alive.map((on, index) => on ? index : -1).filter((index) => index >= 0);
  if (livingSeats.some((index) => votes[index] == null)) return { ok: true, state: next };
  return { ok: true, state: resolveVote(next, now) };
}

export function advance(state, now) {
  if (state.phase === "night") return { ok: true, state: resolveNight(state, now) };
  if (state.phase === "day") return { ok: true, state: openVote(state, now) };
  if (state.phase === "vote") return { ok: true, state: resolveVote(state, now) };
  return { ok: false, error: "phase" };
}

export function tick(state, now) {
  if (state.phase === "waiting" || state.phase === "over" || !state.endsAt || now < state.endsAt) {
    return { changed: false, state };
  }
  return { changed: true, state: advance(state, now).state };
}

export function publicView(state) {
  const reveal = state.phase === "over";
  return {
    phase: state.phase,
    round: state.round,
    alive: state.alive.slice(),
    log: state.log.slice(),
    endsAt: state.phase === "over" ? 0 : state.endsAt,
    duration: state.duration,
    voted: Object.keys(state.votes).map(Number),
    winner: reveal ? state.winner : null,
    roles: reveal ? state.roles.map((role) => ({ role, label: LABEL[role] })) : null,
    playerCount: state.playerCount,
  };
}

export function secretFor(state, seat) {
  if (!state.roles.length || state.phase === "waiting") return null;
  const role = state.roles[seat];
  if (!role) return null;
  const note = state.notes[seat];
  return {
    role,
    label: LABEL[role],
    alive: Boolean(state.alive[seat]),
    acted: state.nightChoices[seat] != null,
    allies: role === "mafia" ? state.roles.map((item, index) => item === "mafia" && index !== seat ? index : -1).filter((index) => index >= 0) : [],
    investigation: note ? { target: note.target, mafia: note.mafia, round: note.round } : null,
  };
}

function resolveNight(state, now) {
  const kill = majority(mafiaChoices(state));
  const doctor = livingSeat(state, "doctor");
  const saved = doctor != null && state.nightChoices[doctor] === kill;
  const notes = { ...state.notes };
  const police = livingSeat(state, "police");
  if (police != null && state.nightChoices[police] != null) {
    const target = state.nightChoices[police];
    notes[police] = { target, mafia: state.roles[target] === "mafia", round: state.round };
  }
  const alive = state.alive.slice();
  const log = state.log.slice();
  if (kill != null && !saved) {
    alive[kill] = false;
    log.push({ kind: "night-death", seat: kill });
  } else log.push({ kind: "quiet" });
  const winner = judge(alive, state.roles);
  if (winner) return finish(state, alive, notes, log, winner);
  return {
    ...state,
    alive,
    notes,
    log,
    nightChoices: {},
    votes: {},
    phase: "day",
    endsAt: now + DAY_MS,
    duration: DAY_MS,
  };
}

function openVote(state, now) {
  return {
    ...state,
    phase: "vote",
    votes: {},
    endsAt: now + VOTE_MS,
    duration: VOTE_MS,
    log: [...state.log, { kind: "vote-start" }],
  };
}

function resolveVote(state, now) {
  const target = majority(Object.values(state.votes));
  const alive = state.alive.slice();
  const log = state.log.slice();
  if (target == null) log.push({ kind: "tie" });
  else {
    alive[target] = false;
    log.push({ kind: "execute", seat: target });
  }
  const winner = judge(alive, state.roles);
  if (winner) return finish(state, alive, state.notes, log, winner);
  return {
    ...state,
    alive,
    nightChoices: {},
    votes: {},
    phase: "night",
    round: state.round + 1,
    endsAt: now + NIGHT_MS,
    duration: NIGHT_MS,
    log: [...log, { kind: "night-start", round: state.round + 1 }],
  };
}

function finish(state, alive, notes, log, winner) {
  log.push({ kind: "win", winner });
  return { ...state, alive, notes, log, phase: "over", winner, endsAt: 0, nightChoices: {}, votes: {} };
}

function nightReady(state) {
  return nightActors(state).every((seat) => state.nightChoices[seat] != null);
}

function nightActors(state) {
  return state.roles.map((role, seat) => state.alive[seat] && role !== "citizen" ? seat : -1).filter((seat) => seat >= 0);
}

function mafiaChoices(state) {
  return state.roles.map((role, seat) => state.alive[seat] && role === "mafia" ? state.nightChoices[seat] : null).filter((target) => target != null);
}

function livingSeat(state, role) {
  const seat = state.roles.findIndex((item, index) => item === role && state.alive[index]);
  return seat >= 0 ? seat : null;
}

function living(state, seat) {
  return Number.isInteger(seat) && seat >= 0 && seat < state.playerCount && state.alive[seat];
}

function majority(choices) {
  const tally = new Map();
  for (const choice of choices) tally.set(choice, (tally.get(choice) || 0) + 1);
  if (!tally.size) return null;
  let top = 0;
  for (const count of tally.values()) top = Math.max(top, count);
  const leaders = [...tally.entries()].filter(([, count]) => count === top);
  return leaders.length === 1 ? leaders[0][0] : null;
}

function judge(alive, roles) {
  let mafia = 0;
  let town = 0;
  alive.forEach((on, seat) => {
    if (!on) return;
    if (roles[seat] === "mafia") mafia += 1;
    else town += 1;
  });
  if (mafia === 0) return "town";
  if (mafia >= town) return "mafia";
  return null;
}
