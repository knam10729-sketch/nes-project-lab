import assert from "node:assert/strict";
import test from "node:test";
import { alarmAt, applyAction, createRoom, joinRoom, present, secretFor } from "../src/room-logic.js";
import * as chosung from "../src/games/chosung.js";
import * as ladder from "../src/games/ladder.js";
import * as nunchi from "../src/games/nunchi.js";
import * as othello from "../src/games/othello.js";
import * as pirate from "../src/games/pirate.js";
import handler from "../src/worker.js";

const A = "a".repeat(32);
const B = "b".repeat(32);

function room(game, players = 2) {
  let r = createRoom({ game, roomId: "abc23def", name: "하나", token: A, now: 0 }).room;
  for (let i = 1; i < players; i += 1) r = joinRoom(r, { name: `p${i}`, newToken: String(i).repeat(32).slice(0, 32).replace(/[^a-f0-9]/g, "c") }).room;
  return r;
}

test("ladder: every lane ends on a different result and rungs never touch", () => {
  for (let seed = 1; seed < 40; seed += 1) {
    const s = ladder.start(ladder.initial(), { players: 5, seed, options: { results: ["커피", "꽝"] } }).state;
    assert.equal(new Set(s.ends).size, 5);
    assert.deepEqual([...s.bottom].sort(), ["꽝", "꽝", "꽝", "꽝", "커피"]);
    for (const [row, gap] of s.rungs) assert.equal(s.rungs.some(([r, g]) => r === row && g === gap + 1), false);
    for (let gap = 0; gap < 4; gap += 1) assert.ok(s.rungs.some(([, g]) => g === gap), "every gap has a rung");
  }
  assert.equal(ladder.start(ladder.initial(), { players: 1, seed: 1, solo: true, options: { names: ["혼자"] } }).ok, false);
});

test("ladder room: one phone mode waits for typed names", () => {
  let r = createRoom({ game: "ladder", roomId: "abc23def", name: "나", token: A, now: 0, solo: true }).room;
  assert.equal(r.status, "waiting");
  assert.equal(applyAction(r, 0, { type: "start", names: ["가"] }).ok, false);
  r = applyAction(r, 0, { type: "start", names: ["가", "나", "다"], results: ["벌칙"] }, 5).room;
  assert.equal(r.status, "over");
  assert.deepEqual(present(r).position.names, ["가", "나", "다"]);
});

test("nunchi: calling alone takes the number, the last one left loses", () => {
  let s = nunchi.start(nunchi.initial(), { players: 3, now: 0, seed: 1 }).state;
  assert.equal(nunchi.act(s, 0, { type: "call" }, 100).ok, false, "countdown");
  s = nunchi.tick(s, 3000).state;
  s = nunchi.act(s, 0, { type: "call" }, 3100).state;
  s = nunchi.tick(s, 3100 + nunchi.WINDOW_MS).state;
  assert.deepEqual(s.called, [{ number: 1, seat: 0 }]);
  s = nunchi.act(s, 2, { type: "call" }, 5000).state;
  s = nunchi.tick(s, 5000 + nunchi.WINDOW_MS).state;
  assert.equal(s.phase, "over");
  assert.deepEqual(s.losers, [1]);
  assert.equal(s.why, "last");
});

test("nunchi: two calls at once both lose; silence ends the game", () => {
  let s = nunchi.tick(nunchi.start(nunchi.initial(), { players: 4, now: 0, seed: 2 }).state, 3000).state;
  s = nunchi.act(s, 1, { type: "call" }, 4000).state;
  s = nunchi.act(s, 3, { type: "call" }, 4300).state;
  s = nunchi.tick(s, 4000 + nunchi.WINDOW_MS).state;
  assert.deepEqual(s.losers, [1, 3]);
  assert.equal(s.why, "together");
  let idle = nunchi.tick(nunchi.start(nunchi.initial(), { players: 2, now: 0, seed: 2 }).state, 3000).state;
  idle = nunchi.tick(idle, 3000 + nunchi.IDLE_MS).state;
  assert.equal(idle.why, "idle");
  assert.deepEqual(idle.losers, [0, 1]);
});

test("nunchi: solo bots call on their own until the game ends", () => {
  let r = createRoom({ game: "nunchi", roomId: "abc23def", name: "나", token: A, now: 0, solo: true }).room;
  assert.equal(r.seats.length, 4);
  let now = 0;
  for (let i = 0; i < 60 && r.status === "playing"; i += 1) {
    now = alarmAt(r, now) ?? now + 500;
    r = applyAction(r, null, { type: "sync" }, now).room;
  }
  assert.equal(r.status, "over");
  assert.ok(present(r).position.losers.length >= 1);
});

test("pirate: turns rotate and the trap slot ends the game", () => {
  let s = pirate.start(pirate.initial(), { players: 2, seed: 3 }).state;
  assert.equal(pirate.view(s).trap, null, "the trap stays secret");
  assert.equal(pirate.stab(s, 1, 0).ok, false, "not your turn");
  let seat = 0;
  for (let slot = 0; slot < pirate.SLOTS && s.phase === "playing"; slot += 1) {
    s = pirate.stab(s, seat, slot).state;
    seat = 1 - seat;
  }
  assert.equal(s.phase, "over");
  assert.equal(s.slots[s.trap], s.loser);
  assert.equal(pirate.view(s).trap, s.trap);
});

test("chosung: initials, correct answers score and the word stays hidden", () => {
  assert.equal(chosung.chosungOf("떡볶이"), "ㄸㅂㅇ");
  assert.ok(chosung.pool().length > 100);
  let s = chosung.start(chosung.initial(), { players: 2, seed: 4, now: 0, options: { category: "food" } }).state;
  s = chosung.tick(s, 2000).state;
  assert.equal(s.phase, "round");
  const v = chosung.view(s);
  assert.equal(JSON.stringify(v).includes(s.word), false);
  assert.equal(v.chosung, chosung.chosungOf(s.word));
  s = chosung.act(s, 1, { type: "answer", text: "아무말" }, 2100).state;
  assert.equal(s.phase, "round");
  s = chosung.act(s, 0, { type: "answer", text: ` ${s.word} ` }, 2200).state;
  assert.equal(s.phase, "result");
  assert.equal(s.scores[0], 2);
  const hinted = chosung.tick(chosung.tick(chosung.tick(s, 2200 + 3000).state, 5200 + chosung.HINT_MS).state, 0).state;
  assert.equal(chosung.view(hinted).hint, [...hinted.word][0]);
});

test("chosung: eight rounds then a winner", () => {
  let s = chosung.start(chosung.initial(), { players: 1, seed: 9, now: 0 }).state;
  let now = 0;
  for (let i = 0; i < 100 && s.phase !== "over"; i += 1) {
    now = chosung.alarm(s, now);
    s = chosung.tick(s, now).state;
    if (s.phase === "round") s = chosung.act(s, 0, { type: "answer", text: s.word }, now).state;
  }
  assert.equal(s.phase, "over");
  assert.equal(s.scores[0], chosung.ROUNDS * 2);
});

test("othello: opening moves, flips, and a bot plays to the end", () => {
  const board = othello.newBoard();
  assert.deepEqual(othello.legal(board, othello.BLACK).sort((a, b) => a - b), [19, 26, 37, 44]);
  let s = othello.start(othello.initial(), { seed: 1 }).state;
  s = othello.place(s, 0, 19).state;
  assert.equal(s.board[27], othello.BLACK);
  assert.equal(othello.place(s, 0, 18).ok, false, "white to move");
  let bot = othello.start(othello.initial(), { seed: 1, bots: [0, 1], level: "normal" }).state;
  let now = 0;
  for (let i = 0; i < 200 && bot.phase === "playing"; i += 1) {
    now = othello.alarm(bot, now);
    bot = othello.tick(bot, now).state;
  }
  assert.equal(bot.phase, "over");
  const { black, white } = othello.counts(bot.board);
  assert.ok(black + white > 10);
});

test("othello room: starts when the second player joins and swaps colours on rematch", () => {
  let r = createRoom({ game: "othello", roomId: "abc23def", name: "흑", token: A, now: 0 }).room;
  assert.equal(r.status, "waiting");
  r = joinRoom(r, { name: "백", newToken: B }).room;
  assert.equal(r.status, "playing");
  assert.equal(present(r).turnSeat, 0);
  r = applyAction(r, 0, { type: "place", index: 19 }, 1).room;
  assert.equal(present(r).turnSeat, 1);
  r.status = "over";
  r = applyAction(r, 1, { type: "rematch" }, 2).room;
  assert.equal(r.status, "playing");
  assert.equal(present(r).turnSeat, 1, "the other seat plays black next");
});

test("room flow: new party games need the host and hide secrets", () => {
  for (const game of ["nunchi", "pirate", "chosung", "ladder"]) {
    let r = room(game, 3);
    assert.equal(applyAction(r, 1, { type: "start" }).ok, false);
    const started = applyAction(r, 0, { type: "start" }, 10);
    assert.equal(started.ok, true, game);
    r = started.room;
    if (game === "pirate") assert.equal(JSON.stringify(present(r)).includes('"trap":' + r.data.trap), false);
    assert.equal(secretFor(r, 0), null);
  }
});

test("routes: the five newest games use play.html", async () => {
  const env = { ASSETS: { async fetch(request) { return new Response("asset:" + new URL(request.url).pathname); } } };
  for (const game of ["ladder", "nunchi", "pirate", "chosung", "othello"]) {
    assert.equal(await (await handler.fetch(new Request(`https://jeonghan.kr/games/${game}/abc23def`), env)).text(), "asset:/games/play.html");
  }
});
