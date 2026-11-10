import assert from "node:assert/strict";
import test from "node:test";
import { apply, initialState, legalMoves, positionFrom } from "../src/games/janggi.js";

function hasMove(state, from, to) {
  return legalMoves(state).some((move) => !move.pass && move.from[0] === from[0] && move.from[1] === from[1] && move.to[0] === to[0] && move.to[1] === to[1]);
}

test("opening setup follows the default inner-elephant position", () => {
  const state = initialState();
  assert.equal(state.turn, "cho");
  assert.equal(state.board[8 * 9 + 4].type, "king");
  assert.equal(state.board[1 * 9 + 4].type, "king");
  assert.equal(state.board[9 * 9 + 4], null);
  assert.equal(state.board[0 * 9 + 3].type, "guard");
  assert.equal(hasMove(state, [1, 9], [0, 7]), true);
  assert.equal(hasMove(state, [1, 9], [2, 7]), true);
  assert.equal(legalMoves(state).some((move) => !move.pass && move.from[0] === 1 && move.from[1] === 7), false);
  assert.equal(hasMove(state, [2, 9], [4, 6]), false);
  assert.equal(hasMove(state, [0, 6], [0, 7]), false);
  assert.equal(hasMove(state, [0, 6], [0, 5]), true);
});

test("horses and elephants are blocked by intervening pieces", () => {
  const horse = positionFrom([
    [4, 4, "cho", "horse"],
    [4, 3, "han", "soldier"],
    [4, 9, "cho", "king"],
    [4, 0, "han", "king"],
  ]);
  assert.equal(hasMove(horse, [4, 4], [3, 2]), false);
  assert.equal(hasMove(horse, [4, 4], [5, 2]), false);
  assert.equal(hasMove(horse, [4, 4], [2, 3]), true);

  const elephant = positionFrom([
    [4, 4, "cho", "elephant"],
    [4, 3, "cho", "soldier"],
    [5, 2, "han", "soldier"],
    [4, 9, "cho", "king"],
    [4, 0, "han", "king"],
  ]);
  assert.equal(hasMove(elephant, [4, 4], [2, 1]), false);
  assert.equal(hasMove(elephant, [4, 4], [6, 1]), false);
  const open = positionFrom([
    [4, 4, "cho", "elephant"],
    [4, 9, "cho", "king"],
    [4, 0, "han", "king"],
  ]);
  assert.equal(hasMove(open, [4, 4], [2, 1]), true);
  assert.equal(hasMove(open, [4, 4], [6, 1]), true);
});

test("cannons jump exactly one screen and cannot jump or capture cannons", () => {
  const cannon = positionFrom([
    [0, 0, "cho", "cannon"],
    [0, 2, "han", "horse"],
    [0, 4, "han", "soldier"],
    [0, 6, "han", "cannon"],
    [4, 9, "cho", "king"],
    [4, 1, "han", "king"],
  ]);
  assert.equal(hasMove(cannon, [0, 0], [0, 1]), false);
  assert.equal(hasMove(cannon, [0, 0], [0, 3]), true);
  assert.equal(hasMove(cannon, [0, 0], [0, 4]), true);
  assert.equal(hasMove(cannon, [0, 0], [0, 5]), false);
  assert.equal(hasMove(cannon, [0, 0], [0, 6]), false);

  const screen = positionFrom([
    [0, 0, "cho", "cannon"],
    [0, 2, "han", "cannon"],
    [0, 4, "han", "soldier"],
    [4, 9, "cho", "king"],
    [4, 1, "han", "king"],
  ]);
  assert.equal(hasMove(screen, [0, 0], [0, 3]), false);
  assert.equal(hasMove(screen, [0, 0], [0, 4]), false);

  const palace = positionFrom([
    [3, 7, "cho", "cannon"],
    [4, 8, "han", "guard"],
    [5, 9, "han", "soldier"],
    [0, 0, "cho", "king"],
    [8, 0, "han", "king"],
  ]);
  assert.equal(hasMove(palace, [3, 7], [5, 9]), true);
  const blocked = positionFrom([
    [3, 7, "cho", "cannon"],
    [4, 8, "han", "cannon"],
    [5, 9, "han", "soldier"],
    [0, 0, "cho", "king"],
    [8, 0, "han", "king"],
  ]);
  assert.equal(hasMove(blocked, [3, 7], [5, 9]), false);
});

test("palace lines limit kings, guards, rooks, and soldiers", () => {
  const palace = positionFrom([
    [4, 8, "cho", "king"],
    [3, 9, "cho", "guard"],
    [4, 1, "han", "king"],
  ]);
  assert.equal(hasMove(palace, [4, 8], [3, 7]), true);
  assert.equal(hasMove(palace, [4, 8], [4, 6]), false);
  assert.equal(hasMove(palace, [3, 9], [4, 8]), false);
  assert.equal(hasMove(palace, [3, 9], [2, 9]), false);
  assert.equal(hasMove(palace, [3, 9], [4, 9]), true);

  const rook = positionFrom([
    [3, 0, "cho", "rook"],
    [4, 1, "han", "guard"],
    [4, 9, "cho", "king"],
    [8, 8, "han", "king"],
  ]);
  assert.equal(hasMove(rook, [3, 0], [4, 1]), true);
  assert.equal(hasMove(rook, [3, 0], [5, 2]), false);

  const soldier = positionFrom([
    [4, 1, "cho", "soldier"],
    [0, 0, "cho", "king"],
    [8, 9, "han", "king"],
  ]);
  assert.equal(hasMove(soldier, [4, 1], [4, 0]), true);
  assert.equal(hasMove(soldier, [4, 1], [3, 0]), true);
  assert.equal(hasMove(soldier, [4, 1], [5, 0]), true);
  assert.equal(hasMove(soldier, [4, 1], [4, 2]), false);
  assert.equal(hasMove(soldier, [4, 1], [3, 2]), false);
  assert.equal(hasMove(soldier, [4, 1], [3, 1]), true);
});

test("checkmate, bikjang, and consecutive passes", () => {
  const mate = positionFrom([
    [3, 0, "han", "king"],
    [8, 0, "cho", "rook"],
    [0, 1, "cho", "rook"],
    [8, 9, "cho", "king"],
  ], "han");
  assert.equal(mate.check, true);
  assert.equal(legalMoves(mate).length, 0);

  const check = positionFrom([
    [3, 0, "han", "king"],
    [8, 0, "cho", "rook"],
    [8, 9, "cho", "king"],
  ], "han");
  assert.equal(check.check, true);
  assert.equal(legalMoves(check).length > 0, true);

  const facing = positionFrom([
    [4, 8, "cho", "king"],
    [4, 1, "han", "king"],
  ]);
  assert.equal(facing.facing, true);
  assert.equal(facing.check, false);
  const drawn = apply(facing, { claimDraw: true });
  assert.equal(drawn.reason, "bikjang");
  assert.equal(drawn.winner, "draw");
  const checked = positionFrom([
    [4, 8, "cho", "king"],
    [4, 1, "han", "king"],
    [0, 8, "han", "rook"],
  ]);
  assert.equal(apply(checked, { claimDraw: true }).error, "check");

  let state = initialState();
  const first = apply(state, { pass: true });
  assert.equal(first.over, false);
  assert.equal(first.state.turn, "han");
  const second = apply(first.state, { pass: true });
  assert.equal(second.over, true);
  assert.equal(second.reason, "pass");
  assert.equal(second.winner, "draw");
});
