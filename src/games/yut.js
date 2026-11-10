// Square course. Resting on the first or second corner takes the diagonal.
// Passing a corner without stopping stays on the outside.
const NEXT = {
  a1: "a2", a2: "a3", a3: "a4", a4: "a5", a5: "b1",
  b1: "b2", b2: "b3", b3: "b4", b4: "b5", b5: "c1",
  c1: "c2", c2: "c3", c3: "c4", c4: "c5", c5: "d1",
  d1: "d2", d2: "d3", d3: "d4", d4: "end",
  s1: "s2", s2: "center", s3: "s4", s4: "c5",
  t1: "t2", t2: "center", t3: "t4", t4: "end",
};

export const SPOTS = {
  a1: [5, 4], a2: [5, 3], a3: [5, 2], a4: [5, 1], a5: [5, 0],
  b1: [4, 0], b2: [3, 0], b3: [2, 0], b4: [1, 0], b5: [0, 0],
  c1: [0, 1], c2: [0, 2], c3: [0, 3], c4: [0, 4], c5: [0, 5],
  d1: [1, 5], d2: [2, 5], d3: [3, 5], d4: [4, 5],
  s1: [4, 1], s2: [3, 2], center: [2.5, 2.5], s3: [2, 3], s4: [1, 4],
  t1: [1, 1], t2: [2, 2], t3: [3, 3], t4: [4, 4],
};

const NAMES = { do: "도", gae: "개", geol: "걸", yut: "윷", mo: "모", back: "빽도" };

export function initialState() {
  return {
    phase: "waiting",
    teams: false,
    turn: 0,
    pieces: [],
    pending: [],
    seq: 1,
    bonus: false,
    last: null,
    playerCount: 0,
    finished: [],
  };
}

export function begin(state, playerCount, teams = false) {
  const count = Number(playerCount);
  if (count < 2 || count > 4) return { ok: false, error: "players" };
  const useTeams = Boolean(teams) && count === 4;
  const groups = useTeams ? 2 : count;
  const pieces = [];
  for (let owner = 0; owner < groups; owner += 1) {
    for (let index = 0; index < 4; index += 1) {
      pieces.push({ id: `${owner}-${index}`, owner, node: "home", heading: "outer", back: null });
    }
  }
  return {
    ok: true,
    state: { ...state, phase: "throw", teams: useTeams, turn: 0, pieces, pending: [], bonus: false, last: null, playerCount: count, finished: Array(groups).fill(0) },
  };
}

export function rollFromBits(bits) {
  const flats = bits.reduce((sum, bit) => sum + (bit ? 1 : 0), 0);
  if (flats === 0) return face("mo", 5);
  if (flats === 1) return bits[0] ? face("back", -1) : face("do", 1);
  if (flats === 2) return face("gae", 2);
  if (flats === 3) return face("geol", 3);
  return face("yut", 4);
}

export function rollFromByte(value) {
  const bits = [0, 1, 2, 3].map((shift) => (value >> shift) & 1);
  return rollFromBits(bits);
}

export function toss(state, bits) {
  if (state.phase !== "throw") return { ok: false, error: "phase" };
  const faceResult = Array.isArray(bits) ? rollFromBits(bits) : rollFromByte(bits);
  const pending = [...state.pending, { ...faceResult, id: state.seq }];
  const again = faceResult.steps === 4 || faceResult.steps === 5;
  return {
    ok: true,
    state: { ...state, pending, seq: state.seq + 1, last: faceResult, phase: again ? "throw" : "move" },
    again,
  };
}

export function play(state, pieceId, throwId) {
  if (state.phase !== "move") return { ok: false, error: "phase" };
  const ticket = state.pending.find((item) => item.id === throwId);
  const piece = state.pieces.find((item) => item.id === pieceId);
  if (!ticket || !piece) return { ok: false, error: "illegal" };
  if (!ownsTurn(state, piece.owner)) return { ok: false, error: "illegal" };
  const group = stackOf(state, piece);
  const moved = moveGroup(group[0], ticket.steps);
  if (!moved) return { ok: false, error: "illegal" };
  let pieces = state.pieces.map((item) => group.some((member) => member.id === item.id) ? { ...item, ...moved } : item);
  let captured = false;
  if (moved.node !== "end" && moved.node !== "home") {
    const victims = pieces.filter((item) => item.node === moved.node && item.owner !== piece.owner);
    if (victims.length) {
      captured = true;
      pieces = pieces.map((item) => victims.some((victim) => victim.id === item.id)
        ? { ...item, node: "home", heading: "outer", back: null }
        : item);
    }
  }
  const finished = countFinished(pieces, state.finished.length);
  const winner = finished.findIndex((count) => count >= 4);
  const pending = state.pending.filter((item) => item.id !== throwId);
  let phase = "move";
  let turn = state.turn;
  let bonus = state.bonus || captured;
  if (winner >= 0) phase = "over";
  else if (pending.length) phase = "move";
  else if (bonus) {
    phase = "throw";
    bonus = false;
  } else {
    phase = "throw";
    turn = (state.turn + 1) % state.playerCount;
  }
  return {
    ok: true,
    state: { ...state, pieces, pending, finished, phase, turn, bonus, last: ticket },
    captured,
    over: winner >= 0,
    winnerOwner: winner >= 0 ? winner : null,
  };
}

export function burn(state, throwId) {
  if (state.phase !== "move") return { ok: false, error: "phase" };
  const ticket = state.pending.find((item) => item.id === throwId);
  if (!ticket) return { ok: false, error: "illegal" };
  if (options(state).some((option) => option.throwId === throwId)) return { ok: false, error: "illegal" };
  const pending = state.pending.filter((item) => item.id !== throwId);
  let phase = "move";
  let turn = state.turn;
  let bonus = state.bonus;
  if (!pending.length) {
    phase = "throw";
    if (!bonus) turn = (state.turn + 1) % state.playerCount;
    bonus = false;
  }
  return { ok: true, state: { ...state, pending, phase, turn, bonus } };
}

export function options(state) {
  if (state.phase !== "move") return [];
  const owner = ownerOf(state, state.turn);
  const seen = new Set();
  const found = [];
  for (const piece of state.pieces) {
    if (piece.owner !== owner || piece.node === "end") continue;
    const key = `${piece.owner}:${piece.node}:${piece.heading}`;
    if (piece.node !== "home" && seen.has(key)) continue;
    if (piece.node !== "home") seen.add(key);
    for (const ticket of state.pending) {
      const moved = moveGroup(piece, ticket.steps);
      if (!moved) continue;
      found.push({ pieceId: piece.id, throwId: ticket.id, dest: moved.node, steps: ticket.steps, stack: stackOf(state, piece).length });
    }
  }
  return found;
}

export function ownerOf(state, seat) {
  if (state.teams) return seat % 2;
  return seat;
}

export function moveGroup(piece, steps) {
  if (piece.node === "end") return null;
  if (steps < 0) {
    if (piece.node === "home") return null;
    if (!piece.back) return piece.node === "a1" ? { node: "home", heading: "outer", back: null } : null;
    return { node: piece.back.node, heading: piece.back.heading, back: piece.back.back || null };
  }
  let node = piece.node;
  let heading = piece.heading;
  let back = piece.back;
  for (let index = 0; index < steps; index += 1) {
    const next = stepOnce(node, heading, index === 0);
    if (!next) return null;
    const previous = { node, heading, back };
    node = next.node;
    heading = next.heading;
    back = previous;
    if (node === "end" && index !== steps - 1) return null;
  }
  return { node, heading, back };
}

function stepOnce(node, heading, first) {
  if (node === "home") return { node: "a1", heading: "outer" };
  if (node === "end") return null;
  if (first && node === "a5") return { node: "s1", heading: "diagA" };
  if (first && node === "b5") return { node: "t1", heading: "diagB" };
  if (node === "center") return heading === "diagB" ? { node: "t3", heading: "diagB" } : { node: "s3", heading: "diagA" };
  const next = NEXT[node];
  if (!next) return null;
  return { node: next, heading };
}

function stackOf(state, piece) {
  if (piece.node === "home" || piece.node === "end") return [piece];
  return state.pieces.filter((item) => item.owner === piece.owner && item.node === piece.node);
}

function ownsTurn(state, owner) {
  return ownerOf(state, state.turn) === owner;
}

function countFinished(pieces, groups) {
  return Array.from({ length: groups }, (_, owner) => pieces.filter((piece) => piece.owner === owner && piece.node === "end").length);
}

function face(kind, steps) {
  return { kind, steps, name: NAMES[kind] };
}
