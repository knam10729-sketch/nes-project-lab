import assert from "node:assert/strict";
import test from "node:test";
import { hit, initialState, startRound, tick, winnerOf } from "../src/games/mole.js";
import { applyAction, createRoom, joinRoom, present } from "../src/room-logic.js";

const TOKEN = "a".repeat(32);
const TOKEN_B = "b".repeat(32);
const TOKEN_C = "c".repeat(32);

function room(game = "gomoku") {
  return createRoom({ game, roomId: "abc23def", name: "하나", token: TOKEN, now: 1_000 }).room;
}

test("only the first tap scores and expired moles do not", () => {
  let state = startRound(initialState(7), 5_000, 2).state;
  state = { ...state, phase: "playing", active: [{ id: 3, hole: 4, spawnedAt: 8_000, expiresAt: 9_000 }] };
  const first = hit(state, 0, 3, 8_100);
  assert.equal(first.ok, true);
  assert.deepEqual(first.state.scores, [1, 0]);
  assert.equal(hit(first.state, 1, 3, 8_120).ok, false);
  assert.equal(hit(state, 1, 3, 9_001).ok, false);
  assert.equal(hit(state, 1, 9, 8_100).ok, false);
  assert.equal(hit({ ...state, phase: "countdown" }, 0, 3, 8_100).error, "wait");
});

test("the clock ends the round and ties stay tied", () => {
  let state = startRound(initialState(3), 0, 2).state;
  state = { ...state, phase: "playing", scores: [2, 2], active: [{ id: 1, hole: 0, spawnedAt: 0, expiresAt: 50_000 }] };
  const ended = tick(state, state.endsAt);
  assert.equal(ended.state.phase, "over");
  assert.equal(ended.state.active.length, 0);
  assert.deepEqual(winnerOf(ended.state.scores), { draw: true, winner: null });
  assert.deepEqual(winnerOf([1, 3, 2]), { draw: false, winner: 1 });
  assert.equal(hit(ended.state, 0, 1, state.endsAt + 10).ok, false);
});

test("room rules keep seats, turns, wins, and rematches authoritative", () => {
  let game = room("gomoku");
  assert.equal(applyAction(game, 0, { type: "move", move: { x: 7, y: 7 } }).error, "아직 상대가 들어오지 않았습니다.");
  const joined = joinRoom(game, { name: "둘", newToken: TOKEN_B });
  game = joined.room;
  assert.equal(joined.seat, 1);
  const again = joinRoom(game, { token: TOKEN_B, name: "둘둘" });
  assert.equal(again.seat, 1);
  assert.equal(again.room.seats[1].name, "둘둘");
  assert.equal(joinRoom(game, { name: "셋", newToken: TOKEN_C }).status, 409);

  game = again.room;
  const wrong = applyAction(game, 1, { type: "move", move: { x: 1, y: 1 } });
  assert.equal(wrong.error, "상대 차례입니다.");
  const moves = [[7, 7], [0, 0], [7, 8], [1, 0], [7, 9], [2, 0], [7, 10], [3, 0], [7, 11]];
  let seat = 0;
  for (const [x, y] of moves) {
    const result = applyAction(game, seat, { type: "move", move: { x, y } });
    assert.equal(result.ok, true);
    game = result.room;
    seat = 1 - seat;
  }
  assert.equal(game.status, "over");
  assert.equal(game.winnerSeat, 0);
  assert.equal(game.reason, "five");
  const next = applyAction(game, 1, { type: "rematch" }).room;
  assert.equal(next.status, "playing");
  assert.equal(next.firstSeat, 1);
  assert.equal(next.data.board.every((cell) => cell === 0), true);
  assert.equal(present(next).turnSeat, 1);
  assert.equal(present(next).seats[1].color, "흑");
});

test("mole hits stay unique across the room and only the host starts", () => {
  let game = room("mole");
  game = joinRoom(game, { name: "둘", newToken: TOKEN_B }).room;
  assert.equal(applyAction(game, 1, { type: "start" }, 10_000).error, "방장만 시작할 수 있습니다.");
  game = applyAction(game, 0, { type: "start" }, 10_000).room;
  assert.equal(game.status, "playing");
  assert.equal(game.data.phase, "countdown");
  const playing = tick(game.data, game.data.startedAt).state;
  game = { ...game, data: { ...playing, active: [{ id: 4, hole: 1, spawnedAt: playing.startedAt, expiresAt: playing.startedAt + 1000 }] } };
  const scored = applyAction(game, 1, { type: "hit", moleId: 4 }, playing.startedAt + 20);
  assert.equal(scored.ok, true);
  assert.equal(scored.room.data.scores[1], 1);
  const late = applyAction(scored.room, 0, { type: "hit", moleId: 4 }, playing.startedAt + 30);
  assert.equal(late.ok, false);
  const finished = applyAction(scored.room, 0, { type: "sync" }, scored.room.data.endsAt + 5);
  assert.equal(finished.room.status, "over");
  assert.equal(finished.room.winnerSeat, 1);
  assert.equal(joinRoom(finished.room, { name: "셋", newToken: TOKEN_C }).ok, false);
});
