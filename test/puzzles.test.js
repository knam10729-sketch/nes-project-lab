import assert from "node:assert/strict";
import test from "node:test";
import * as g2048 from "../games/puzzles/g2048.js";
import * as dice from "../games/puzzles/dice.js";
import * as path from "../games/puzzles/path.js";
import * as sudoku from "../games/puzzles/sudoku.js";

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

test("2048 merges each pair once and scores the merge", () => {
  const board = [2, 2, 2, 2, 4, 4, 8, 0, 0, 0, 0, 0, 2, 0, 0, 2];
  const left = g2048.move(board, "left");
  assert.deepEqual(left.board.slice(0, 4), [4, 4, 0, 0]);
  assert.deepEqual(left.board.slice(4, 8), [8, 8, 0, 0]);
  assert.deepEqual(left.board.slice(12, 16), [4, 0, 0, 0]);
  assert.equal(left.gained, 4 + 4 + 8 + 4);
  assert.equal(g2048.move([2, 4, 8, 16, 4, 8, 16, 2, 8, 16, 2, 4, 16, 2, 4, 8], "left").moved, false);
  assert.equal(g2048.canMove([2, 4, 8, 16, 4, 8, 16, 2, 8, 16, 2, 4, 16, 2, 4, 8]), false);
  assert.equal(g2048.spawn(g2048.empty(), seeded(1)).filter(Boolean).length, 1);
});

test("sudoku puzzles have exactly one solution matching the stored answer", () => {
  for (const level of ["easy", "hard"]) {
    const { puzzle, solution } = sudoku.makePuzzle(level, seeded(level.length));
    const result = sudoku.solve(puzzle, 2);
    assert.equal(result.count, 1);
    assert.deepEqual(result.solution, solution);
    assert.equal(sudoku.solved(solution), true);
    assert.ok(puzzle.filter(Boolean).length >= sudoku.LEVELS[level]);
  }
  const bad = sudoku.fullGrid(seeded(3));
  [bad[0], bad[1]] = [bad[1], bad[1]];
  assert.equal(sudoku.solved(bad), false);
});

test("dice rolls keep opposite faces at 7 and four turns return home", () => {
  let die = { top: 1, north: 2, east: 3 };
  assert.deepEqual(dice.roll(die, "right"), { top: 4, north: 2, east: 1 });
  assert.deepEqual(dice.roll(die, "up"), { top: 5, north: 1, east: 3 });
  for (const dir of ["up", "down", "left", "right"]) {
    let d = die;
    for (let k = 0; k < 4; k += 1) d = dice.roll(d, dir);
    assert.deepEqual(d, die, dir);
  }
});

test("dice boards are solvable and stamping follows the top face", () => {
  for (let seed = 1; seed < 30; seed += 1) {
    const board = dice.makeBoard({ size: 4, targets: 6, random: seeded(seed) });
    assert.ok(board.cells.filter(Boolean).length >= 1);
    // Breadth-first search over (position, die, stamped) proves a solution exists.
    const key = (s) => `${s.x},${s.y},${s.die.top},${s.die.north},${s.die.east},${s.stamped.map(Number).join("")}`;
    let frontier = [board];
    const seen = new Set([key(board)]);
    let found = false;
    for (let depth = 0; depth < 60 && frontier.length && !found; depth += 1) {
      const next = [];
      for (const s of frontier) {
        for (const dir of ["up", "down", "left", "right"]) {
          const r = dice.step(s, dir);
          if (!r.ok) continue;
          if (dice.done(r.state)) { found = true; break; }
          const k = key(r.state);
          if (!seen.has(k)) { seen.add(k); next.push(r.state); }
        }
        if (found) break;
      }
      frontier = next;
    }
    assert.equal(found, true, `seed ${seed}`);
  }
});

test("path boards come from a full route that solves them", () => {
  for (let seed = 1; seed < 20; seed += 1) {
    const board = path.makeBoard(6, 6, seeded(seed));
    assert.equal(new Set(board.route).size, 36);
    assert.equal(path.solvedBy(board.route, board), true);
    let line = [];
    for (const cell of board.route) line = path.extend(line, cell, board);
    assert.deepEqual(line, board.route);
    assert.equal(path.solvedBy(board.route.slice(0, -1), board), false);
  }
});

test("path drawing cannot skip a number or jump", () => {
  const board = { size: 3, clues: [1, 0, 0, 0, 0, 0, 0, 0, 2] };
  let line = path.extend([], 4, board);
  assert.deepEqual(line, [], "must start on 1");
  line = path.extend(line, 0, board);
  line = path.extend(line, 2, board);
  assert.deepEqual(line, [0], "no jumping");
  line = path.extend(line, 1, board);
  line = path.extend(line, 0, board);
  assert.deepEqual(line, [0], "moving back rewinds");
});
