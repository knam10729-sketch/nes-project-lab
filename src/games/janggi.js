const WIDTH = 9;
const HEIGHT = 10;

const PALACE = {
  han: points(3, 5, 0, 2),
  cho: points(3, 5, 7, 9),
};

const DIAGONALS = [
  [[3, 0], [4, 1], [5, 2]],
  [[5, 0], [4, 1], [3, 2]],
  [[3, 7], [4, 8], [5, 9]],
  [[5, 7], [4, 8], [3, 9]],
];

const HORSE = [
  { leg: [0, -1], ends: [[-1, -2], [1, -2]] },
  { leg: [0, 1], ends: [[-1, 2], [1, 2]] },
  { leg: [-1, 0], ends: [[-2, -1], [-2, 1]] },
  { leg: [1, 0], ends: [[2, -1], [2, 1]] },
];

const ELEPHANT = [
  { leg: [0, -1], mid: [-1, -2], end: [-2, -3] },
  { leg: [0, -1], mid: [1, -2], end: [2, -3] },
  { leg: [0, 1], mid: [-1, 2], end: [-2, 3] },
  { leg: [0, 1], mid: [1, 2], end: [2, 3] },
  { leg: [-1, 0], mid: [-2, -1], end: [-3, -2] },
  { leg: [-1, 0], mid: [-2, 1], end: [-3, 2] },
  { leg: [1, 0], mid: [2, -1], end: [3, -2] },
  { leg: [1, 0], mid: [2, 1], end: [3, 2] },
];

export function initialState() {
  const board = Array(WIDTH * HEIGHT).fill(null);
  const back = ["rook", "horse", "elephant", "guard", null, "guard", "elephant", "horse", "rook"];
  back.forEach((type, x) => {
    if (!type) return;
    put(board, x, 0, "han", type);
    put(board, x, 9, "cho", type);
  });
  put(board, 4, 1, "han", "king");
  put(board, 4, 8, "cho", "king");
  put(board, 1, 2, "han", "cannon");
  put(board, 7, 2, "han", "cannon");
  put(board, 1, 7, "cho", "cannon");
  put(board, 7, 7, "cho", "cannon");
  for (const x of [0, 2, 4, 6, 8]) {
    put(board, x, 3, "han", "soldier");
    put(board, x, 6, "cho", "soldier");
  }
  return normalize({ board, turn: "cho", passes: 0, last: null });
}

export function positionFrom(entries, turn = "cho") {
  const board = Array(WIDTH * HEIGHT).fill(null);
  for (const [x, y, side, type] of entries) put(board, x, y, side, type);
  return normalize({ board, turn, passes: 0, last: null });
}

export function apply(state, move) {
  if (state.over) return { ok: false, error: "over" };
  if (move?.claimDraw) {
    if (state.check) return { ok: false, error: "check" };
    if (!state.facing) return { ok: false, error: "noface" };
    return overResult(state, "draw", "bikjang");
  }
  const legal = legalMoves(state);
  const match = legal.find((item) => sameMove(item, move));
  if (!match) return { ok: false, error: "illegal" };
  if (match.pass) {
    const passes = state.passes + 1;
    const next = normalize({
      board: state.board.slice(),
      turn: opposite(state.turn),
      passes,
      last: null,
    });
    if (passes >= 2) return overResult(next, "draw", "pass");
    return { ok: true, state: next, over: false, winner: null, reason: null };
  }
  const board = state.board.slice();
  board[index(match.to[0], match.to[1])] = board[index(match.from[0], match.from[1])];
  board[index(match.from[0], match.from[1])] = null;
  const next = normalize({
    board,
    turn: opposite(state.turn),
    passes: 0,
    last: [match.from, match.to],
  });
  if (next.check && pieceMoves(next).length === 0) return overResult(next, opposite(next.turn), "wetong");
  return { ok: true, state: next, over: false, winner: null, reason: null };
}

export function legalMoves(state) {
  if (state.over) return [];
  const moves = pieceMoves(state);
  if (!state.check) moves.push({ pass: true });
  return moves;
}

function pieceMoves(state) {
  const moves = [];
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const piece = at(state.board, x, y);
      if (!piece || piece.side !== state.turn) continue;
      for (const [tx, ty] of targets(state.board, x, y, piece)) {
        if (leavesCheck(state.board, state.turn, x, y, tx, ty)) continue;
        moves.push({ from: [x, y], to: [tx, ty] });
      }
    }
  }
  return moves;
}

function leavesCheck(board, side, x, y, tx, ty) {
  const next = board.slice();
  next[index(tx, ty)] = next[index(x, y)];
  next[index(x, y)] = null;
  return inCheck(next, side);
}

function targets(board, x, y, piece) {
  switch (piece.type) {
    case "king":
    case "guard":
      return palaceSteps(board, x, y, piece.side);
    case "rook":
      return rookTargets(board, x, y, piece.side);
    case "cannon":
      return cannonTargets(board, x, y, piece.side);
    case "horse":
      return horseTargets(board, x, y, piece.side);
    case "elephant":
      return elephantTargets(board, x, y, piece.side);
    case "soldier":
      return soldierTargets(board, x, y, piece.side);
    default:
      return [];
  }
}

function palaceSteps(board, x, y, side) {
  const found = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const tx = x + dx;
    const ty = y + dy;
    if (!inPalace(side, tx, ty)) continue;
    if (dx !== 0 && dy !== 0 && !diagonalDistance(x, y, tx, ty, 1)) continue;
    if (canLand(board, tx, ty, side)) found.push([tx, ty]);
  }
  return found;
}

function rookTargets(board, x, y, side) {
  return [...slides(board, x, y, side), ...diagonalSlides(board, x, y, side, false)];
}

function cannonTargets(board, x, y, side) {
  const found = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let cx = x + dx;
    let cy = y + dy;
    let screen = null;
    while (onBoard(cx, cy)) {
      const piece = at(board, cx, cy);
      if (!screen) {
        if (piece) {
          if (piece.type === "cannon") break;
          screen = [cx, cy];
        }
      } else if (!piece) found.push([cx, cy]);
      else {
        if (piece.side !== side && piece.type !== "cannon") found.push([cx, cy]);
        break;
      }
      cx += dx;
      cy += dy;
    }
  }
  for (const line of DIAGONALS) {
    const atIndex = line.findIndex(([px, py]) => px === x && py === y);
    if (atIndex !== 0 && atIndex !== 2) continue;
    const screen = line[1];
    const destination = line[atIndex === 0 ? 2 : 0];
    const screenPiece = at(board, screen[0], screen[1]);
    if (!screenPiece || screenPiece.type === "cannon") continue;
    const target = at(board, destination[0], destination[1]);
    if (!target || (target.side !== side && target.type !== "cannon")) found.push(destination);
  }
  return found;
}

function horseTargets(board, x, y, side) {
  const found = [];
  for (const path of HORSE) {
    const lx = x + path.leg[0];
    const ly = y + path.leg[1];
    if (!onBoard(lx, ly) || at(board, lx, ly)) continue;
    for (const end of path.ends) {
      const tx = x + end[0];
      const ty = y + end[1];
      if (canLand(board, tx, ty, side)) found.push([tx, ty]);
    }
  }
  return found;
}

function elephantTargets(board, x, y, side) {
  const found = [];
  for (const path of ELEPHANT) {
    const lx = x + path.leg[0];
    const ly = y + path.leg[1];
    const mx = x + path.mid[0];
    const my = y + path.mid[1];
    const tx = x + path.end[0];
    const ty = y + path.end[1];
    if (!onBoard(lx, ly) || !onBoard(mx, my) || at(board, lx, ly) || at(board, mx, my)) continue;
    if (canLand(board, tx, ty, side)) found.push([tx, ty]);
  }
  return found;
}

function soldierTargets(board, x, y, side) {
  const forward = side === "cho" ? -1 : 1;
  const found = [];
  for (const [tx, ty] of [[x, y + forward], [x - 1, y], [x + 1, y]]) {
    if (canLand(board, tx, ty, side)) found.push([tx, ty]);
  }
  const enemyPalace = side === "cho" ? "han" : "cho";
  if (!inPalace(enemyPalace, x, y)) return found;
  for (const line of DIAGONALS) {
    const atIndex = line.findIndex(([px, py]) => px === x && py === y);
    if (atIndex < 0) continue;
    for (const step of [atIndex - 1, atIndex + 1]) {
      if (step < 0 || step >= line.length) continue;
      const [tx, ty] = line[step];
      if (Math.sign(ty - y) !== forward) continue;
      if (canLand(board, tx, ty, side)) found.push([tx, ty]);
    }
  }
  return found;
}

function slides(board, x, y, side) {
  const found = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let cx = x + dx;
    let cy = y + dy;
    while (onBoard(cx, cy)) {
      const piece = at(board, cx, cy);
      if (!piece) found.push([cx, cy]);
      else {
        if (piece.side !== side) found.push([cx, cy]);
        break;
      }
      cx += dx;
      cy += dy;
    }
  }
  return found;
}

function diagonalSlides(board, x, y, side) {
  const found = [];
  for (const line of DIAGONALS) {
    const atIndex = line.findIndex(([px, py]) => px === x && py === y);
    if (atIndex < 0) continue;
    for (const dir of [-1, 1]) {
      for (let step = atIndex + dir; step >= 0 && step < line.length; step += dir) {
        const [tx, ty] = line[step];
        const piece = at(board, tx, ty);
        if (!piece) found.push([tx, ty]);
        else {
          if (piece.side !== side) found.push([tx, ty]);
          break;
        }
      }
    }
  }
  return found;
}

function diagonalDistance(x, y, tx, ty, distance) {
  return DIAGONALS.some((line) => {
    const a = line.findIndex(([px, py]) => px === x && py === y);
    const b = line.findIndex(([px, py]) => px === tx && py === ty);
    return a >= 0 && b >= 0 && Math.abs(a - b) === distance;
  });
}

function inCheck(board, side) {
  const king = findKing(board, side);
  if (!king) return true;
  return isAttacked(board, king[0], king[1], opposite(side));
}

function isAttacked(board, x, y, bySide) {
  for (let cy = 0; cy < HEIGHT; cy += 1) {
    for (let cx = 0; cx < WIDTH; cx += 1) {
      const piece = at(board, cx, cy);
      if (!piece || piece.side !== bySide) continue;
      if (targets(board, cx, cy, piece).some(([tx, ty]) => tx === x && ty === y)) return true;
    }
  }
  return false;
}

function kingsFace(board) {
  const cho = findKing(board, "cho");
  const han = findKing(board, "han");
  if (!cho || !han || cho[0] !== han[0]) return false;
  const [y1, y2] = cho[1] < han[1] ? [cho[1], han[1]] : [han[1], cho[1]];
  for (let y = y1 + 1; y < y2; y += 1) if (at(board, cho[0], y)) return false;
  return true;
}

function normalize(state) {
  const check = inCheck(state.board, state.turn);
  return {
    board: state.board,
    turn: state.turn,
    passes: state.passes || 0,
    last: state.last || null,
    check,
    facing: kingsFace(state.board),
    over: false,
    winner: null,
    reason: null,
  };
}

function overResult(state, winner, reason) {
  const done = { ...state, over: true, winner, reason, check: winner === "draw" ? state.check : true };
  return { ok: true, state: done, over: true, winner, reason };
}

function sameMove(move, request) {
  if (move.pass || request?.pass) return Boolean(move.pass && request?.pass);
  if (!request?.from || !request?.to) return false;
  return move.from[0] === request.from[0] && move.from[1] === request.from[1]
    && move.to[0] === request.to[0] && move.to[1] === request.to[1];
}

function canLand(board, x, y, side) {
  if (!onBoard(x, y)) return false;
  const piece = at(board, x, y);
  return !piece || piece.side !== side;
}

function inPalace(side, x, y) {
  return PALACE[side].has(index(x, y));
}

function findKing(board, side) {
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const piece = at(board, x, y);
      if (piece?.side === side && piece.type === "king") return [x, y];
    }
  }
  return null;
}

function put(board, x, y, side, type) {
  board[index(x, y)] = { side, type };
}

function at(board, x, y) {
  if (!onBoard(x, y)) return null;
  return board[index(x, y)];
}

function onBoard(x, y) {
  return x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;
}

function index(x, y) {
  return y * WIDTH + x;
}

function opposite(side) {
  return side === "cho" ? "han" : "cho";
}

function points(x1, x2, y1, y2) {
  const set = new Set();
  for (let y = y1; y <= y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) set.add(index(x, y));
  }
  return set;
}
