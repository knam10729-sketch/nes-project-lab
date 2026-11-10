import assert from "node:assert/strict";
import test from "node:test";
import { algebraic, apply, initialState, legalMoves, parseFen, square } from "../src/games/chess.js";

function play(moves, start = initialState()) {
  let state = start;
  let last;
  for (const move of moves) {
    const [from, to, promotion] = move.length > 4 ? [move.slice(0, 2), move.slice(2, 4), move.slice(4)] : [move.slice(0, 2), move.slice(2, 4), null];
    last = apply(state, { from, to, promotion: promotion || null });
    assert.equal(last.ok, true, `${move} ${last.error}`);
    state = last.state;
  }
  return last;
}

test("the starting position has twenty legal moves", () => {
  const moves = legalMoves(initialState());
  assert.equal(moves.length, 20);
  assert.equal(apply(initialState(), { from: "e2", to: "e5" }).ok, false);
  assert.equal(apply(initialState(), { from: "e7", to: "e5" }).error, "illegal");
});

test("fool's mate is checkmate", () => {
  const result = play(["f2f3", "e7e5", "g2g4", "d8h4"]);
  assert.equal(result.over, true);
  assert.equal(result.winner, "b");
  assert.equal(result.reason, "checkmate");
  assert.equal(result.state.check, true);
});

test("castling, castling through check, and rook rights", () => {
  const castled = play(["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "e1g1"]);
  assert.deepEqual(castled.state.last, ["e1", "g1"]);
  assert.equal(castled.state.board[square("f1")], "R");
  assert.equal(castled.state.board[square("e1")], null);
  assert.equal(castled.state.castling.includes("K"), false);

  const through = parseFen("5r2/8/8/8/8/8/8/4K2R w K - 0 1");
  assert.equal(legalMoves(through).some((move) => algebraic(move.from) === "e1" && algebraic(move.to) === "g1"), false);

  const outOfCheck = parseFen("4r3/8/8/8/8/8/8/4K2R w K - 0 1");
  assert.equal(outOfCheck.check, true);
  assert.equal(legalMoves(outOfCheck).some((move) => Math.abs(move.to - move.from) === 2), false);
});

test("en passant is legal only immediately after a double step", () => {
  const ready = play(["e2e4", "a7a6", "e4e5", "d7d5"]);
  assert.equal(ready.state.ep, "d6");
  const captured = apply(ready.state, { from: "e5", to: "d6" });
  assert.equal(captured.ok, true);
  assert.equal(captured.state.board[square("d6")], "P");
  assert.equal(captured.state.board[square("d5")], null);
  assert.equal(captured.state.board[square("e5")], null);

  const ignored = play(["e2e4", "a7a6", "e4e5", "d7d5", "a2a3"]);
  assert.equal(ignored.state.ep, null);
  assert.equal(apply(ignored.state, { from: "e5", to: "d6" }).ok, false);
});

test("promotion requires a chosen piece and pinned pieces cannot move", () => {
  const promoted = apply(parseFen("7k/4P3/8/8/8/8/4K3/8 w - - 0 1"), { from: "e7", to: "e8" });
  assert.equal(promoted.error, "promotion");
  const queen = apply(parseFen("7k/4P3/8/8/8/8/4K3/8 w - - 0 1"), { from: "e7", to: "e8", promotion: "q" });
  assert.equal(queen.ok, true);
  assert.equal(queen.state.board[square("e8")], "Q");
  const knight = apply(parseFen("7k/4P3/8/8/8/8/4K3/8 w - - 0 1"), { from: "e7", to: "e8", promotion: "n" });
  assert.equal(knight.state.board[square("e8")], "N");

  const pinned = parseFen("4k3/8/4n3/8/8/8/8/4R2K b - - 0 1");
  assert.equal(legalMoves(pinned).some((move) => algebraic(move.from) === "e6"), false);
  const bishop = parseFen("4r3/8/8/8/8/8/4B3/4K3 w - - 0 1");
  assert.equal(legalMoves(bishop).some((move) => algebraic(move.from) === "e2"), false);
});

test("stalemate is a draw and a king cannot move into check", () => {
  const stale = parseFen("k7/2K5/1Q6/8/8/8/8/8 b - - 0 1");
  assert.equal(stale.check, false);
  assert.equal(legalMoves(stale).length, 0);
  const result = apply(parseFen("k7/2K5/8/8/8/8/1Q6/8 w - - 0 1"), { from: "b2", to: "b6" });
  assert.equal(result.reason, "stalemate");
  assert.equal(result.winner, "draw");

  const exposed = parseFen("4r3/8/8/8/8/8/8/4K3 w - - 0 1");
  assert.equal(apply(exposed, { from: "e1", to: "e2" }).ok, false);
  assert.equal(apply(exposed, { from: "e1", to: "d1" }).ok, true);
});
