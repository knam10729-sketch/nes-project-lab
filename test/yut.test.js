import assert from "node:assert/strict";
import test from "node:test";
import { begin, burn, initialState, moveGroup, options, play, rollFromBits, toss } from "../src/games/yut.js";

function started() {
  return begin(initialState(), 2, false).state;
}

function place(state, id, node, heading = "outer", back = null) {
  return { ...state, pieces: state.pieces.map((piece) => piece.id === id ? { ...piece, node, heading, back } : piece) };
}

test("stick faces include back-do and yut or mo grant another throw", () => {
  assert.equal(rollFromBits([0, 0, 0, 0]).name, "모");
  assert.equal(rollFromBits([1, 0, 0, 0]).name, "빽도");
  assert.equal(rollFromBits([0, 1, 0, 0]).steps, 1);
  assert.equal(rollFromBits([1, 1, 0, 0]).steps, 2);
  assert.equal(rollFromBits([1, 1, 1, 0]).steps, 3);
  assert.equal(rollFromBits([1, 1, 1, 1]).name, "윷");
  const yut = toss(started(), [1, 1, 1, 1]);
  assert.equal(yut.again, true);
  assert.equal(yut.state.phase, "throw");
  const moved = toss(yut.state, [0, 1, 0, 0]);
  assert.equal(moved.state.phase, "move");
  assert.equal(moved.state.pending.length, 2);
});

test("corner shortcuts, passing a corner, exact finish, and back-do", () => {
  let state = place(started(), "0-0", "a5");
  assert.equal(moveGroup(state.pieces[0], 1).node, "s1");
  state = place(state, "0-0", "a4");
  assert.equal(moveGroup(state.pieces[0], 2).node, "b1");
  state = place(state, "0-0", "s2", "diagA");
  assert.equal(moveGroup(state.pieces[0], 3).node, "s4");
  state = place(state, "0-0", "b5");
  assert.equal(moveGroup(state.pieces[0], 1).node, "t1");
  state = place(state, "0-0", "d4");
  assert.equal(moveGroup(state.pieces[0], 1).node, "end");
  assert.equal(moveGroup(state.pieces[0], 2), null);
  const entered = play(toss(started(), [0, 1, 0, 0]).state, "0-0", 1);
  assert.equal(entered.state.pieces.find((piece) => piece.id === "0-0").node, "a1");
  const back = play({ ...entered.state, phase: "move", pending: [{ id: 9, kind: "back", steps: -1, name: "빽도" }], turn: 0 }, "0-0", 9);
  assert.equal(back.state.pieces.find((piece) => piece.id === "0-0").node, "home");
});

test("stacking moves together and capture sends the stack home", () => {
  let state = toss(started(), [0, 1, 0, 0]).state;
  state = play(state, "0-0", 1).state;
  state = { ...state, phase: "move", turn: 0, pending: [{ id: 3, steps: 1, kind: "do", name: "도" }] };
  state = play(state, "0-1", 3).state;
  assert.equal(state.pieces.filter((piece) => piece.node === "a1" && piece.owner === 0).length, 2);
  state = { ...state, phase: "move", turn: 0, pending: [{ id: 4, steps: 2, kind: "gae", name: "개" }] };
  const stacked = play(state, "0-0", 4);
  assert.equal(stacked.ok, true);
  assert.equal(stacked.state.pieces.filter((piece) => piece.owner === 0 && piece.node === "a3").length, 2);

  let enemy = place(started(), "1-0", "a3");
  enemy = place(enemy, "1-1", "a3");
  enemy = { ...enemy, phase: "move", turn: 0, pending: [{ id: 5, steps: 3, kind: "geol", name: "걸" }] };
  const captured = play(enemy, "0-0", 5);
  assert.equal(captured.captured, true);
  assert.equal(captured.state.pieces.filter((piece) => piece.owner === 1 && piece.node === "home").length, 4);
  assert.equal(captured.state.phase, "throw");
  assert.equal(captured.state.turn, 0);
});

test("a throw with nowhere to go can be discarded", () => {
  let state = place(started(), "0-0", "d3");
  state = { ...state, pieces: state.pieces.map((piece) => piece.id === "0-0" ? piece : { ...piece, node: "end" }), phase: "move", pending: [{ id: 8, steps: 3, kind: "geol", name: "걸" }] };
  assert.equal(options(state).length, 0);
  const burned = burn(state, 8);
  assert.equal(burned.ok, true);
  assert.equal(burned.state.phase, "throw");
  assert.equal(burned.state.turn, 1);
});
