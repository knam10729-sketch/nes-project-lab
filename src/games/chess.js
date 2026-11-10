const FILES = "abcdefgh";

export function initialState() {
  return parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
}

export function parseFen(fen) {
  const [boardPart, turn, castling, ep] = fen.trim().split(/\s+/);
  const board = Array(64).fill(null);
  let i = 0;
  for (const char of boardPart) {
    if (char === "/") continue;
    if (char >= "1" && char <= "8") i += Number(char);
    else board[i++] = char;
  }
  return normalize({
    board,
    turn: turn === "b" ? "b" : "w",
    castling: castling && castling !== "-" ? castling : "",
    ep: ep && ep !== "-" ? ep : null,
    last: null,
  });
}

export function apply(state, move) {
  if (state.over) return { ok: false, error: "over" };
  const from = square(move?.from);
  const to = square(move?.to);
  if (from == null || to == null) return { ok: false, error: "bounds" };
  const promotion = move?.promotion ? String(move.promotion).toLowerCase() : null;
  if (promotion && !"qrbn".includes(promotion)) return { ok: false, error: "promotion" };
  const legal = legalMoves(state);
  const match = legal.find((item) => item.from === from && item.to === to && (item.promotion || null) === (promotion || null));
  if (!match) {
    const needsPromotion = legal.some((item) => item.from === from && item.to === to && item.promotion);
    return { ok: false, error: needsPromotion ? "promotion" : "illegal" };
  }
  return finish(play(state, match));
}

export function legalMoves(state) {
  if (state.over) return [];
  const moves = pseudoMoves(state);
  return moves.filter((move) => !kingAttacked(play(state, move).board, state.turn));
}

export function kingAttacked(board, color) {
  const king = color === "w" ? "K" : "k";
  const squareIndex = board.indexOf(king);
  if (squareIndex < 0) return true;
  return attacked(board, squareIndex, color === "w" ? "b" : "w");
}

function finish(state) {
  const moves = legalMoves(state);
  if (moves.length) return { ok: true, state, over: false, winner: null, reason: null };
  if (state.check) {
    const winner = state.turn === "w" ? "b" : "w";
    const done = { ...state, over: true, winner, reason: "checkmate" };
    return { ok: true, state: done, over: true, winner, reason: "checkmate" };
  }
  const done = { ...state, over: true, winner: "draw", reason: "stalemate" };
  return { ok: true, state: done, over: true, winner: "draw", reason: "stalemate" };
}

function normalize(state) {
  return {
    ...state,
    check: kingAttacked(state.board, state.turn),
    over: false,
    winner: null,
    reason: null,
  };
}

function play(state, move) {
  const board = state.board.slice();
  const piece = board[move.from];
  const color = pieceColor(piece);
  const captured = board[move.to];
  let castling = state.castling;
  let ep = null;
  board[move.to] = move.promotion ? (color === "w" ? move.promotion.toUpperCase() : move.promotion) : piece;
  board[move.from] = null;
  if (piece.toLowerCase() === "k" && Math.abs(fileOf(move.to) - fileOf(move.from)) === 2) {
    const rank = rankOf(move.from);
    if (move.to > move.from) {
      board[squareIndex(rank, 5)] = board[squareIndex(rank, 7)];
      board[squareIndex(rank, 7)] = null;
    } else {
      board[squareIndex(rank, 3)] = board[squareIndex(rank, 0)];
      board[squareIndex(rank, 0)] = null;
    }
  }
  if (piece.toLowerCase() === "p" && algebraic(move.to) === state.ep) {
    const capturedIndex = color === "w" ? move.to + 8 : move.to - 8;
    board[capturedIndex] = null;
  }
  if (piece.toLowerCase() === "p" && Math.abs(move.to - move.from) === 16) {
    ep = algebraic((move.from + move.to) / 2);
  }
  castling = updateCastling(castling, piece, move.from, move.to, captured);
  return normalize({
    board,
    turn: color === "w" ? "b" : "w",
    castling,
    ep,
    last: [algebraic(move.from), algebraic(move.to)],
  });
}

function updateCastling(castling, piece, from, to, captured) {
  let next = castling;
  const drop = (right) => {
    next = next.replace(right, "");
  };
  if (piece === "K") drop("K"), drop("Q");
  if (piece === "k") drop("k"), drop("q");
  for (const index of [from, to]) {
    if (index === 63 || (captured && to === 63)) drop("K");
    if (index === 56 || (captured && to === 56)) drop("Q");
    if (index === 7 || (captured && to === 7)) drop("k");
    if (index === 0 || (captured && to === 0)) drop("q");
  }
  if (from === 63 || to === 63) drop("K");
  if (from === 56 || to === 56) drop("Q");
  if (from === 7 || to === 7) drop("k");
  if (from === 0 || to === 0) drop("q");
  return next;
}

function pseudoMoves(state) {
  const moves = [];
  for (let index = 0; index < 64; index += 1) {
    const piece = state.board[index];
    if (!piece || pieceColor(piece) !== state.turn) continue;
    const kind = piece.toLowerCase();
    if (kind === "p") pawnMoves(state, index, moves);
    else if (kind === "n") leapMoves(state, index, KNIGHT, moves);
    else if (kind === "b") slideMoves(state, index, BISHOP, moves);
    else if (kind === "r") slideMoves(state, index, ROOK, moves);
    else if (kind === "q") slideMoves(state, index, QUEEN, moves);
    else if (kind === "k") kingMoves(state, index, moves);
  }
  return moves;
}

const KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const QUEEN = [...BISHOP, ...ROOK];
const KING = QUEEN;

function pawnMoves(state, from, moves) {
  const color = state.turn;
  const dir = color === "w" ? -1 : 1;
  const startRank = color === "w" ? 6 : 1;
  const lastRank = color === "w" ? 0 : 7;
  const f = fileOf(from);
  const r = rankOf(from);
  const one = squareIndex(r + dir, f);
  if (one != null && !state.board[one]) {
    pushPawn(moves, from, one, rankOf(one) === lastRank);
    if (rankOf(from) === startRank) {
      const two = squareIndex(r + dir * 2, f);
      if (two != null && !state.board[two]) moves.push({ from, to: two });
    }
  }
  for (const df of [-1, 1]) {
    const target = squareIndex(r + dir, f + df);
    if (target == null) continue;
    const occupant = state.board[target];
    if (occupant && pieceColor(occupant) !== color) pushPawn(moves, from, target, rankOf(target) === lastRank);
    if (algebraic(target) === state.ep) moves.push({ from, to: target });
  }
}

function pushPawn(moves, from, to, promote) {
  if (!promote) {
    moves.push({ from, to });
    return;
  }
  for (const promotion of ["q", "r", "b", "n"]) moves.push({ from, to, promotion });
}

function leapMoves(state, from, deltas, moves) {
  const color = state.turn;
  for (const [df, dr] of deltas) {
    const to = squareIndex(rankOf(from) + dr, fileOf(from) + df);
    if (to == null) continue;
    const occupant = state.board[to];
    if (!occupant || pieceColor(occupant) !== color) moves.push({ from, to });
  }
}

function slideMoves(state, from, deltas, moves) {
  const color = state.turn;
  for (const [df, dr] of deltas) {
    let r = rankOf(from) + dr;
    let f = fileOf(from) + df;
    while (true) {
      const to = squareIndex(r, f);
      if (to == null) break;
      const occupant = state.board[to];
      if (!occupant) moves.push({ from, to });
      else {
        if (pieceColor(occupant) !== color) moves.push({ from, to });
        break;
      }
      r += dr;
      f += df;
    }
  }
}

function kingMoves(state, from, moves) {
  leapMoves(state, from, KING, moves);
  const rights = state.castling;
  const home = state.turn === "w" ? 60 : 4;
  if (from !== home || state.check) return;
  const rook = state.turn === "w" ? "R" : "r";
  if ((state.turn === "w" ? rights.includes("K") : rights.includes("k")) && state.board[home + 3] === rook) {
    tryCastle(state, from, from + 2, [from + 1, from + 2], moves);
  }
  if ((state.turn === "w" ? rights.includes("Q") : rights.includes("q")) && state.board[home - 4] === rook) {
    tryCastle(state, from, from - 2, [from - 1, from - 2, from - 3], moves);
  }
}

function tryCastle(state, from, to, between, moves) {
  if (between.some((index) => state.board[index])) return;
  const enemy = state.turn === "w" ? "b" : "w";
  if (attacked(state.board, from + Math.sign(to - from), enemy) || attacked(state.board, to, enemy)) return;
  moves.push({ from, to });
}

function attacked(board, target, byColor) {
  for (let index = 0; index < 64; index += 1) {
    const piece = board[index];
    if (!piece || pieceColor(piece) !== byColor) continue;
    if (attacks(board, index, piece, target)) return true;
  }
  return false;
}

function attacks(board, from, piece, target) {
  const color = pieceColor(piece);
  const kind = piece.toLowerCase();
  const df = fileOf(target) - fileOf(from);
  const dr = rankOf(target) - rankOf(from);
  if (kind === "p") {
    const dir = color === "w" ? -1 : 1;
    return dr === dir && Math.abs(df) === 1;
  }
  if (kind === "n") return KNIGHT.some(([x, y]) => x === df && y === dr);
  if (kind === "k") return Math.max(Math.abs(df), Math.abs(dr)) === 1;
  const diagonal = Math.abs(df) === Math.abs(dr) && df !== 0;
  const straight = df === 0 || dr === 0;
  if (kind === "b" && !diagonal) return false;
  if (kind === "r" && !straight) return false;
  if (kind === "q" && !diagonal && !straight) return false;
  if (kind !== "b" && kind !== "r" && kind !== "q") return false;
  const stepF = Math.sign(df);
  const stepR = Math.sign(dr);
  let f = fileOf(from) + stepF;
  let r = rankOf(from) + stepR;
  while (!(f === fileOf(target) && r === rankOf(target))) {
    const index = squareIndex(r, f);
    if (index == null || board[index]) return false;
    f += stepF;
    r += stepR;
  }
  return true;
}

function pieceColor(piece) {
  return piece === piece.toUpperCase() ? "w" : "b";
}

function fileOf(index) {
  return index % 8;
}

function rankOf(index) {
  return Math.floor(index / 8);
}

function squareIndex(rank, file) {
  if (rank < 0 || rank > 7 || file < 0 || file > 7) return null;
  return rank * 8 + file;
}

export function square(value) {
  if (Number.isInteger(value) && value >= 0 && value < 64) return value;
  if (typeof value !== "string" || !/^[a-h][1-8]$/.test(value)) return null;
  return squareIndex(8 - Number(value[1]), FILES.indexOf(value[0]));
}

export function algebraic(index) {
  return FILES[fileOf(index)] + (8 - rankOf(index));
}
