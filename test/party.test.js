import assert from "node:assert/strict";
import test from "node:test";
import { begin, guess, hint, initialState, secretFor, vote } from "../src/games/liar.js";
import { begin as beginDraw, clearBoard, guess as guessDraw, publicView, stroke, tick, wordCount } from "../src/games/draw.js";
import { choseong, DRAW_WORDS, CATEGORIES } from "../src/games/words.js";
import { applyAction, createRoom, joinRoom, present, secretFor as roomSecret } from "../src/room-logic.js";

const TOKENS = ["a", "b", "c", "d", "e"].map((char) => char.repeat(32));

function party(game, count) {
  let room = createRoom({ game, roomId: "abc23def", name: "방장", token: TOKENS[0], now: 1000 }).room;
  for (let index = 1; index < count; index += 1) {
    room = joinRoom(room, { name: `손님${index}`, newToken: TOKENS[index] }).room;
  }
  return room;
}

test("word lists are original and large enough", () => {
  for (const category of Object.values(CATEGORIES)) {
    assert.equal(new Set(category.words).size, 30);
    assert.equal(category.words.every((word) => word.length >= 2), true);
  }
  assert.equal(new Set(DRAW_WORDS).size >= 150, true);
  assert.equal(wordCount() >= 150, true);
  assert.equal(choseong("사과"), "ㅅㄱ");
});

test("the liar sees only the category until the vote is resolved", () => {
  const started = begin(initialState(), 4, "food", 2, 3);
  assert.equal(started.ok, true);
  const state = started.state;
  assert.equal(secretFor(state, 2).word, null);
  assert.equal(secretFor(state, 2).category, "음식");
  assert.equal(secretFor(state, 0).word, state.word);
  assert.equal(JSON.stringify({ hints: state.hints, category: state.category }).includes(state.word), false);
  const said = hint(state, 0, state.word);
  assert.equal(said.error, "word");
  let round = state;
  for (let seat = 0; seat < 4; seat += 1) {
    round = hint(round, seat, `힌트${seat}`).state;
  }
  assert.equal(round.phase, "hint");
  for (let seat = 0; seat < 4; seat += 1) round = hint(round, seat, `두번째${seat}`).state;
  assert.equal(round.phase, "vote");
  let voting = round;
  voting = vote(voting, 0, 1).state;
  voting = vote(voting, 1, 2).state;
  voting = vote(voting, 3, 2).state;
  const caught = vote(voting, 2, 0);
  assert.equal(caught.state.phase, "guess");
  const saved = guess(caught.state, 2, caught.state.word);
  assert.equal(saved.state.result, "guessed");
  const missed = guess(caught.state, 2, "전혀다른말");
  assert.equal(missed.state.result, "caught");
});

test("a tied vote lets the liar escape", () => {
  let state = begin(initialState(), 4, "animal", 1, 0).state;
  for (let round = 0; round < 2; round += 1) {
    for (let seat = 0; seat < 4; seat += 1) state = hint(state, seat, `말${round}${seat}`).state;
  }
  state = vote(state, 0, 2).state;
  state = vote(state, 1, 2).state;
  state = vote(state, 2, 0).state;
  state = vote(state, 3, 0).state;
  assert.equal(state.result, "escaped");
});

test("drawing scores a fast guess, hides the word, and rotates the drawer", () => {
  const started = beginDraw(initialState(), 3, 4, 10_000);
  let state = started.state;
  assert.equal(state.drawer, 0);
  assert.equal(publicView(state).word, undefined);
  assert.equal(stroke(state, 1, { id: "a1", color: "#171717", points: [[10, 10], [20, 30]] }, 10_100).error, "drawer");
  const ink = stroke(state, 0, { id: "a1", color: "#c4554a", points: [[10, 10], [12, 12]] }, 10_100);
  assert.equal(ink.ok, true);
  assert.equal(clearBoard(ink.state, 1).ok, false);
  const wrong = guessDraw(ink.state, 1, "다른그림", 20_000);
  assert.equal(wrong.correct, false);
  const early = guessDraw(ink.state, 1, state.word, 10_000 + 20_000);
  assert.equal(early.correct, true);
  assert.equal(early.points > 40, true);
  assert.equal(early.state.scores[1], early.points);
  assert.equal(early.state.scores[0], 25);
  const hinted = tick(ink.state, ink.state.hintAt).state;
  assert.equal(hinted.hint, choseong(state.word));
  const ended = tick(ink.state, ink.state.endsAt).state;
  assert.equal(ended.drawer, 1);
  assert.notEqual(ended.word, state.word);
  const room = party("draw", 3);
  assert.equal(room.status, "waiting");
  const playing = applyAction(room, 0, { type: "start" }, 5_000);
  assert.equal(playing.ok, true);
  assert.equal(JSON.stringify(present(playing.room)).includes(playing.room.data.word), false);
  assert.equal(roomSecret(playing.room, 0).word, playing.room.data.word);
  assert.equal(roomSecret(playing.room, 1).word, undefined);
});

test("liar rooms keep the word off the shared state", () => {
  let room = party("liar", 3);
  room = applyAction(room, 0, { type: "start", category: "place" }, 2_000).room;
  const view = JSON.stringify(present(room));
  assert.equal(view.includes(room.data.word), false);
  assert.equal(roomSecret(room, room.data.liar).role, "liar");
  assert.equal(roomSecret(room, room.data.liar).word, null);
  const citizen = [0, 1, 2].find((seat) => seat !== room.data.liar);
  assert.equal(roomSecret(room, citizen).word, room.data.word);
});
