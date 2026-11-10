import assert from "node:assert/strict";
import test from "node:test";
import { apply, initialState } from "../src/games/gomoku.js";

function play(moves) {
  let state = initialState();
  let last;
  for (const move of moves) {
    last = apply(state, move);
    assert.equal(last.ok, true, JSON.stringify(last));
    state = last.state;
  }
  return last;
}

test("five in a row wins and six in a row also wins", () => {
  const five = play([[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1], [3, 0], [3, 1], [4, 0]].map(([x, y]) => ({ x, y })));
  assert.equal(five.over, true);
  assert.equal(five.winner, "black");
  assert.equal(five.reason, "five");

  const six = play([[0, 0], [8, 8], [1, 0], [7, 8], [2, 0], [8, 7], [3, 0], [7, 7], [5, 0], [8, 6], [4, 0]].map(([x, y]) => ({ x, y })));
  assert.equal(six.winner, "black");
});

test("four in a row does not win and edges do not wrap", () => {
  const four = play([[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1], [3, 0], [3, 1]].map(([x, y]) => ({ x, y })));
  assert.equal(four.over, false);
  const edge = play([{ x: 14, y: 14 }, { x: 0, y: 0 }, { x: 13, y: 14 }, { x: 1, y: 0 }, { x: 12, y: 14 }, { x: 2, y: 0 }, { x: 11, y: 14 }, { x: 3, y: 0 }, { x: 10, y: 14 }]);
  assert.equal(edge.winner, "black");
  const blocked = apply(initialState(), { x: 15, y: 0 });
  assert.equal(blocked.ok, false);
  const occupied = apply(apply(initialState(), { x: 7, y: 7 }).state, { x: 7, y: 7 });
  assert.equal(occupied.error, "occupied");
});

test("diagonal five wins and a finished board rejects another move", () => {
  const moves = [];
  for (let i = 0; i < 5; i += 1) moves.push({ x: i, y: i }, { x: i, y: i + 1 });
  moves.pop();
  const result = play(moves);
  assert.equal(result.winner, "black");
  assert.equal(result.reason, "five");
  assert.equal(apply(result.state, { x: 8, y: 8 }).error, "over");
});
