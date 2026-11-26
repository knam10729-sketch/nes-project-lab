import assert from "node:assert/strict";
import test from "node:test";
import { reactionDelay } from "../src/bots/choose.js";
import { applyAction, createRoom, forceBot, joinRoom } from "../src/room-logic.js";

const TOKEN = "a".repeat(32);
const TOKEN_B = "b".repeat(32);

function moleRoom() {
  let room = createRoom({ game: "mole", roomId: "abc23def", name: "네스", token: TOKEN, now: 1_000 }).room;
  room = joinRoom(room, { name: "둘", newToken: TOKEN_B }).room;
  return room;
}

test("host can set only the allowed mole and drawing times", () => {
  let room = moleRoom();
  assert.equal(applyAction(room, 1, { type: "settings", seconds: 90 }).error, "방장만 시간을 바꿀 수 있습니다.");
  assert.equal(applyAction(room, 0, { type: "settings", seconds: 45 }).error, "선택할 수 없는 시간입니다.");
  room = applyAction(room, 0, { type: "settings", seconds: 90 }).room;
  assert.equal(room.settings.moleMs, 90_000);
  const started = applyAction(room, 0, { type: "start" }, 5_000).room;
  assert.equal(started.data.endsAt - started.data.startedAt, 90_000);
  started.status = "over";
  started.data.phase = "over";
  const again = applyAction(started, 0, { type: "rematch" }, 9_000).room;
  assert.equal(again.settings.moleMs, 90_000);

  let draw = createRoom({ game: "draw", roomId: "abc23def", name: "그림", token: TOKEN, drawSeconds: 40 }).room;
  draw = joinRoom(draw, { name: "친구", newToken: TOKEN_B }).room;
  assert.equal(draw.settings.drawMs, 40_000);
  draw = applyAction(draw, 0, { type: "start" }, 2_000).room;
  assert.equal(draw.data.endsAt - draw.data.startedAt, 40_000);
  assert.equal(draw.data.hintAt - draw.data.startedAt, 20_000);
  const soloDraw = createRoom({
    game: "draw",
    roomId: "abc23def",
    name: "그림",
    token: TOKEN,
    solo: true,
    drawSeconds: 100,
    now: 3_000,
  }).room;
  assert.equal(soloDraw.data.endsAt - soloDraw.data.startedAt, 100_000);
  assert.equal(soloDraw.data.hintAt - soloDraw.data.startedAt, 50_000);
});

test("a whack records who scored for every player including bots", () => {
  let room = moleRoom();
  room = applyAction(room, 0, { type: "start" }, 1_000).room;
  room = applyAction(room, null, { type: "sync" }, room.data.startedAt).room;
  const mole = room.data.active[0];
  assert.ok(mole);
  const scored = applyAction(room, 1, { type: "hit", moleId: mole.id }, room.data.startedAt + 30);
  assert.equal(scored.ok, true);
  assert.equal(scored.room.data.lastWhack.seat, 1);
  assert.equal(scored.room.data.lastWhack.hole, mole.hole);
  assert.equal(scored.room.data.scores[1], 1);
  const view = scored.room.data.whacks.at(-1);
  assert.equal(view.seat, 1);
});

test("solo mole time is kept and a bot whack names the bot", () => {
  const created = createRoom({
    game: "mole",
    roomId: "abc23def",
    name: "네스",
    token: TOKEN,
    solo: true,
    moleSeconds: 45,
    now: 1_000,
  });
  assert.equal(created.room.settings.moleMs, 60_000);
  let room = createRoom({
    game: "mole",
    roomId: "abc23def",
    name: "네스",
    token: TOKEN,
    solo: true,
    moleSeconds: 30,
    now: 1_000,
  }).room;
  assert.equal(room.data.endsAt - room.data.startedAt, 30_000);
  room = applyAction(room, null, { type: "sync" }, room.data.startedAt).room;
  const mole = room.data.active[0];
  assert.ok(mole);
  const due = mole.spawnedAt + Math.min(40, reactionDelay("easy", mole.id, 1));
  room.data.botPlans[`${mole.id}:1`] = due;
  const acted = forceBot(room, due);
  assert.equal(acted.ok, true);
  assert.equal(acted.room.data.lastWhack.seat, 1);
  assert.equal(acted.room.data.lastWhack.hole, mole.hole);
  assert.equal(acted.room.seats[1].name, "봇 하나");
});
