import assert from "node:assert/strict";
import test from "node:test";
import { alarmAt, applyAction, createRoom, joinRoom, present, secretFor } from "../src/room-logic.js";
import * as balloon from "../src/games/balloon.js";
import * as bingo from "../src/games/bingo.js";
import * as duel from "../src/games/duel.js";
import * as flash from "../src/games/flash.js";
import * as memory from "../src/games/memory.js";
import handler from "../src/worker.js";

const A = "a".repeat(32);
const B = "b".repeat(32);

function room(game, players = 2) {
  let r = createRoom({ game, roomId: "abc23def", name: "하나", token: A, now: 0 }).room;
  if (players > 1) r = joinRoom(r, { name: "둘", newToken: B }).room;
  return r;
}

test("balloon: own colour scores, other colours cost a point, time ends the round", () => {
  let s = balloon.start(balloon.initial(), { players: 2, now: 0, seed: 7 }).state;
  s = balloon.tick(s, 2000).state;
  assert.equal(s.phase, "playing");
  assert.ok(s.active.length > 0);
  const mine = { ...s, active: [{ id: 99, spot: 0, color: 0, spawnedAt: 2000, expiresAt: 5000 }, { id: 98, spot: 1, color: 1, spawnedAt: 2000, expiresAt: 5000 }] };
  let r = balloon.act(mine, 0, { type: "pop", id: 99 }, 2100);
  assert.equal(r.state.scores[0], 1);
  r = balloon.act(r.state, 0, { type: "pop", id: 98 }, 2200);
  assert.equal(r.state.scores[0], 0);
  assert.equal(r.state.active.some((b) => b.id === 98), true, "wrong pop leaves the balloon");
  const end = balloon.tick(r.state, s.endsAt + 1).state;
  assert.equal(end.phase, "over");
});

test("memory: matching keeps the turn, a miss passes it after the peek", () => {
  let s = memory.start(memory.initial(), { players: 2, seed: 3 }).state;
  const first = 0;
  const pair = s.deck.findIndex((face, index) => index !== first && face === s.deck[first]);
  const miss = s.deck.findIndex((face, index) => index !== first && face !== s.deck[first]);
  let r = memory.act(s, 0, { type: "flip", index: first }, 0);
  r = memory.act(r.state, 0, { type: "flip", index: pair }, 0);
  assert.equal(r.state.scores[0], 1);
  assert.equal(r.state.turn, 0);
  const other = r.state.deck.findIndex((_, i) => r.state.owner[i] == null);
  const notPair = r.state.deck.findIndex((face, i) => r.state.owner[i] == null && i !== other && face !== r.state.deck[other]);
  r = memory.act(r.state, 0, { type: "flip", index: other }, 10);
  r = memory.act(r.state, 0, { type: "flip", index: notPair }, 10);
  assert.ok(r.state.hideAt);
  assert.equal(memory.act(r.state, 1, { type: "flip", index: miss }, 20).ok, false);
  const after = memory.tick(r.state, 10 + memory.PEEK_MS).state;
  assert.equal(after.turn, 1);
  assert.deepEqual(after.open, []);
  const view = memory.view(s);
  assert.equal(view.cards.every((card) => card.face === null), true, "hidden faces never leave the server");
});

test("memory: solo game clears the board", () => {
  let s = memory.start(memory.initial(), { players: 1, seed: 11 }).state;
  const seen = new Set();
  for (let i = 0; i < s.deck.length; i += 1) {
    if (seen.has(i)) continue;
    const j = s.deck.findIndex((face, k) => k !== i && face === s.deck[i]);
    seen.add(i); seen.add(j);
    s = memory.act(s, 0, { type: "flip", index: i }, 0).state;
    s = memory.act(s, 0, { type: "flip", index: j }, 0).state;
  }
  assert.equal(s.phase, "over");
  assert.deepEqual(memory.result(s), { winnerSeat: 0, draw: false, reason: "cleared" });
});

test("bingo: three lines win, turns rotate, boards are private", () => {
  let s = bingo.start(bingo.initial(), { players: 2, seed: 5 }).state;
  const board = s.boards[0];
  // Call the first three rows of seat 0's board, alternating turns with numbers from those rows.
  const wanted = board.slice(0, 15);
  let seat = 0;
  let i = 0;
  while (s.phase === "playing") {
    const r = bingo.call(s, seat, wanted[i]);
    assert.equal(r.ok, true);
    s = r.state;
    i += 1;
    seat = 1 - seat;
  }
  assert.ok(s.lines[0] >= 3);
  assert.equal(bingo.result(s).winnerSeat !== undefined, true);
  assert.equal(bingo.call(bingo.start(bingo.initial(), { players: 2, seed: 1 }).state, 1, 3).ok, false, "not your turn");
  assert.equal(bingo.linesOn([...Array(25).keys()].map((n) => n + 1), [1, 2, 3, 4, 5]), 1);
});

test("duel: exactly one higher wins, otherwise the lower card wins", () => {
  assert.equal(duel.roundWinner(5, 4), 0);
  assert.equal(duel.roundWinner(4, 5), 1);
  assert.equal(duel.roundWinner(9, 2), 1);
  assert.equal(duel.roundWinner(2, 9), 0);
  assert.equal(duel.roundWinner(3, 3), null);
  let s = duel.start(duel.initial(), { seed: 1 }).state;
  for (let card = 1; card <= 9; card += 1) {
    s = duel.pick(s, 0, card).state;
    assert.equal(duel.pick(s, 0, card).ok, false, "one card per round");
    s = duel.pick(s, 1, card).state;
  }
  assert.equal(s.phase, "over");
  assert.equal(duel.result(s).draw, true);
  assert.deepEqual(duel.view(s).left, [0, 0]);
});

test("flash: first tap on the target scores, early taps cost a point", () => {
  let s = flash.start(flash.initial(), { players: 2, seed: 9, now: 0 }).state;
  assert.equal(s.phase, "ready");
  let r = flash.act(s, 1, { type: "tap", cardId: 0 }, 100);
  assert.equal(r.state.scores[1], -1);
  assert.equal(flash.act(r.state, 1, { type: "tap", cardId: 0 }, 120).ok, false, "benched");
  s = r.state;
  let now = 0;
  while (!(s.phase === "flip" && s.match)) {
    now = s.nextAt;
    s = flash.tick(s, now).state;
  }
  r = flash.act(s, 0, { type: "tap", cardId: s.cardId }, now + 200);
  assert.equal(r.state.scores[0], 1);
  assert.equal(r.state.phase, "result");
});

test("flash: a solo bot eventually scores and the game ends", () => {
  let s = flash.start(flash.initial(), { players: 2, seed: 4, now: 0, bots: [1] }).state;
  let now = 0;
  for (let i = 0; i < 400 && s.phase !== "over"; i += 1) {
    now = flash.alarm(s, now) ?? now + 100;
    s = flash.tick(s, now).state;
  }
  assert.equal(s.phase, "over");
  assert.equal(s.scores[1], flash.GOAL);
});

test("room flow: arcade games wait for the host, then play through the shared room system", () => {
  for (const game of ["balloon", "memory", "bingo", "duel", "flash"]) {
    let r = room(game);
    assert.equal(r.status, "waiting");
    assert.equal(applyAction(r, 1, { type: "start" }).ok, false, "only the host starts");
    const started = applyAction(r, 0, { type: "start" }, 1000);
    assert.equal(started.ok, true, game);
    r = started.room;
    assert.equal(r.status, "playing");
    assert.equal(joinRoom(r, { name: "셋", newToken: "c".repeat(32) }).ok, false, "no joining mid-game");
    const view = present(r, 1000);
    assert.equal(JSON.stringify(view).includes(A), false);
    assert.equal(view.position.phase !== undefined, true);
  }
});

test("room flow: duel hides each hand and only reveals cards after both play", () => {
  let r = applyAction(room("duel"), 0, { type: "start" }, 0).room;
  r = applyAction(r, 0, { type: "pick", card: 4 }, 10).room;
  assert.equal(JSON.stringify(present(r)).includes('"pick":4'), false);
  assert.equal(secretFor(r, 0).pick, 4);
  assert.equal(secretFor(r, 1).pick, null);
  r = applyAction(r, 1, { type: "pick", card: 3 }, 20).room;
  assert.deepEqual(present(r).position.history[0], { cards: [4, 3], winner: 0 });
});

test("room flow: solo bingo and duel bots move on their own via alarms", () => {
  for (const game of ["bingo", "duel"]) {
    let r = createRoom({ game, roomId: "abc23def", name: "나", token: A, now: 0, solo: true }).room;
    assert.equal(r.status, "playing");
    assert.equal(r.seats[1].bot, true);
    if (game === "bingo") r = applyAction(r, 0, { type: "call", number: 7 }, 10).room;
    else r = applyAction(r, 0, { type: "pick", card: 5 }, 10).room;
    const at = alarmAt(r, 10);
    assert.ok(at > 10, game);
    const after = applyAction(r, null, { type: "sync" }, at).room;
    if (game === "bingo") assert.equal(after.data.called.length, 2);
    else assert.equal(after.data.history.length, 1);
  }
});

test("room flow: rematch resets arcade rooms to waiting", () => {
  let r = applyAction(room("duel"), 0, { type: "start" }, 0).room;
  for (let card = 1; card <= 9; card += 1) {
    r = applyAction(r, 0, { type: "pick", card }, 1).room;
    r = applyAction(r, 1, { type: "pick", card: 10 - card }, 1).room;
  }
  assert.equal(r.status, "over");
  r = applyAction(r, 1, { type: "rematch" }, 2).room;
  assert.equal(r.status, "waiting");
  assert.equal(r.round, 2);
});

test("routes: new room games use play.html and puzzles use puzzle.html", async () => {
  const env = { ASSETS: { async fetch(request) { return new Response("asset:" + new URL(request.url).pathname); } } };
  for (const game of ["balloon", "memory", "bingo", "duel", "flash"]) {
    assert.equal(await (await handler.fetch(new Request(`https://jeonghan.kr/games/${game}`), env)).text(), "asset:/games/play.html");
    assert.equal(await (await handler.fetch(new Request(`https://jeonghan.kr/games/${game}/abc23def`), env)).text(), "asset:/games/play.html");
  }
  for (const puzzle of ["2048", "sudoku", "dice", "path"]) {
    assert.equal(await (await handler.fetch(new Request(`https://jeonghan.kr/games/${puzzle}`), env)).text(), "asset:/games/puzzle.html");
  }
  assert.equal(await (await handler.fetch(new Request("https://jeonghan.kr/games/arcade/view.js"), env)).text(), "asset:/games/arcade/view.js");
  assert.equal((await handler.fetch(new Request("https://jeonghan.kr/games/tetris"), env)).status, 404);
});
