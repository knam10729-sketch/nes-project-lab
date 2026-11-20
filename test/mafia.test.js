import assert from "node:assert/strict";
import test from "node:test";
import { actNight, advance, assignRoles, begin, initialState, publicView, roleBag, secretFor, tick, vote } from "../src/games/mafia.js";
import { applyAction, createRoom, joinRoom, present, secretFor as roomSecret } from "../src/room-logic.js";

const NAMES = ["가", "나", "다", "라", "마", "바"];
const TOKENS = ["a", "b", "c", "d", "e", "f"].map((name) => name.repeat(32));

function roomOf(count) {
  let room = createRoom({ game: "mafia", roomId: "abc23def", name: NAMES[0], token: TOKENS[0], now: 1000 }).room;
  for (let index = 1; index < count; index += 1) room = joinRoom(room, { name: NAMES[index], newToken: TOKENS[index] }).room;
  return room;
}

test("role counts grow with the table and stay a minority", () => {
  assert.equal(roleBag(3), null);
  assert.equal(roleBag(11), null);
  for (const count of [4, 5, 6, 7, 8, 9, 10]) {
    const bag = roleBag(count);
    const mafia = bag.filter((role) => role === "mafia").length;
    assert.equal(bag.filter((role) => role === "police").length, 1);
    assert.equal(bag.filter((role) => role === "doctor").length, 1);
    assert.equal(mafia < count - mafia, true);
    assert.deepEqual(assignRoles(count, () => 0).slice().sort(), bag.slice().sort());
  }
  assert.equal(roleBag(4).filter((role) => role === "mafia").length, 1);
  assert.equal(roleBag(6).filter((role) => role === "mafia").length, 2);
  assert.equal(roleBag(9).filter((role) => role === "mafia").length, 3);
});

test("night judgment saves a protected player and only the police learns a role", () => {
  const started = begin(initialState(), ["mafia", "police", "doctor", "citizen"], 1_000);
  let state = started.state;
  assert.equal(publicView(state).roles, null);
  assert.equal(JSON.stringify(publicView(state)).includes("police"), false);
  assert.equal(secretFor(state, 3).role, "citizen");
  assert.deepEqual(secretFor(state, 3).allies, []);
  assert.deepEqual(secretFor(state, 0).allies, []);
  state = actNight(state, 0, 3, 2_000).state;
  state = actNight(state, 1, 0, 2_000).state;
  state = actNight(state, 2, 3, 2_000).state;
  assert.equal(state.phase, "day");
  assert.equal(state.alive.every(Boolean), true);
  assert.equal(state.log.at(-1).kind, "quiet");
  assert.equal(secretFor(state, 1).investigation.mafia, true);
  assert.equal(secretFor(state, 3).investigation, null);
  assert.equal(JSON.stringify(publicView(state)).includes("investigation"), false);
});

test("split mafia choices and a tied vote remove nobody", () => {
  let state = begin(initialState(), ["mafia", "mafia", "police", "doctor", "citizen", "citizen"], 1_000).state;
  state = actNight(state, 0, 4, 2_000).state;
  state = actNight(state, 1, 5, 2_000).state;
  state = actNight(state, 2, 0, 2_000).state;
  state = actNight(state, 3, 4, 2_000).state;
  assert.equal(state.phase, "day");
  assert.equal(state.log.at(-1).kind, "quiet");
  state = advance(state, 3_000).state;
  assert.equal(state.phase, "vote");
  state = vote(state, 0, 1, 4_000).state;
  state = vote(state, 1, 0, 4_000).state;
  state = vote(state, 2, 1, 4_000).state;
  state = vote(state, 3, 0, 4_000).state;
  state = vote(state, 4, 0, 4_000).state;
  state = vote(state, 5, 1, 4_000).state;
  assert.equal(state.phase, "night");
  assert.equal(state.log.some((entry) => entry.kind === "tie"), true);
  assert.equal(state.alive.every(Boolean), true);
});

test("the town wins by vote and the mafia wins when they match the town", () => {
  let town = begin(initialState(), ["mafia", "police", "doctor", "citizen"], 1_000).state;
  town = advance(town, 2_000).state;
  town = advance(town, 3_000).state;
  town = vote(town, 1, 0, 4_000).state;
  town = vote(town, 2, 0, 4_000).state;
  town = vote(town, 3, 0, 4_000).state;
  const mafiaVote = vote(town, 0, 1, 4_000);
  assert.equal(mafiaVote.state.phase, "over");
  assert.equal(mafiaVote.state.winner, "town");
  assert.equal(publicView(mafiaVote.state).roles[0].role, "mafia");

  let wolves = begin(initialState(), ["mafia", "police", "doctor", "citizen"], 5_000).state;
  wolves = actNight(wolves, 0, 3, 6_000).state;
  wolves = advance(wolves, 7_000).state;
  assert.equal(wolves.alive[3], false);
  wolves = advance(wolves, 8_000).state;
  assert.equal(vote(wolves, 3, 0, 8_000).error, "target");
  wolves = vote(wolves, 0, 2, 9_000).state;
  wolves = vote(wolves, 1, 2, 9_000).state;
  wolves = vote(wolves, 2, 0, 9_000).state;
  assert.equal(wolves.winner, "mafia");
  assert.equal(wolves.alive.filter(Boolean).length, 2);
});

test("the day timer opens voting and the room hides every other role", () => {
  let state = begin(initialState(), ["mafia", "police", "doctor", "citizen"], 1_000).state;
  assert.equal(tick(state, 1_000 + 44_999).changed, false);
  state = tick(state, 1_000 + 45_000).state;
  assert.equal(state.phase, "day");

  assert.equal(applyAction(roomOf(3), 0, { type: "start" }, 2_000).ok, false);
  let room = roomOf(4);
  const started = applyAction(room, 0, { type: "start" }, 2_000);
  assert.equal(started.ok, true);
  room = started.room;
  const view = present(room, 2_000);
  assert.equal(view.position.roles, null);
  assert.equal(JSON.stringify(view).includes("police"), false);
  const secrets = room.seats.map((_, seat) => roomSecret(room, seat));
  assert.equal(secrets.filter((secret) => secret.role === "mafia").length, 1);
  const citizen = secrets.find((secret) => secret.role === "citizen");
  assert.deepEqual(citizen.allies, []);
  assert.equal(JSON.stringify(citizen).includes("mafia"), false);
  const intruder = applyAction(room, 1, { type: "advance" }, 3_000);
  assert.equal(intruder.ok, false);
  const host = applyAction(room, 0, { type: "advance" }, 3_000);
  assert.equal(host.ok, true);
  assert.equal(host.room.data.phase, "day");
});
