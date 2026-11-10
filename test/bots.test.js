import assert from "node:assert/strict";
import test from "node:test";
import { chooseChess, chooseGomoku, chooseJanggi, chooseLiarHint, chooseYut } from "../src/bots/choose.js";
import { DRAWINGS } from "../src/bots/drawings.js";
import { coveredWords, hintChoices } from "../src/bots/hints.js";
import { initialState as chessInitial, legalMoves as chessMoves, square } from "../src/games/chess.js";
import { initialState as gomokuInitial } from "../src/games/gomoku.js";
import { initialState as janggiInitial, legalMoves as janggiMoves } from "../src/games/janggi.js";
import { begin, initialState as yutInitial, toss } from "../src/games/yut.js";
import { CATEGORIES } from "../src/games/words.js";
import { createRoom, forceBot } from "../src/room-logic.js";

const TOKEN = "a".repeat(32);

test("every liar word has a hint that does not reveal it", () => {
  const covered = new Set(coveredWords());
  for (const category of Object.values(CATEGORIES)) {
    for (const word of category.words) {
      assert.equal(covered.has(word), true, word);
      const hints = hintChoices(word, category.label, false);
      assert.equal(hints.length >= 1, true, word);
      assert.equal(hints.every((hint) => !hint.includes(word)), true, word);
      const vague = hintChoices(word, category.label, true);
      assert.equal(vague.every((hint) => !hint.includes(word)), true);
    }
  }
});

test("bot moves stay legal", () => {
  const gomoku = chooseGomoku(gomokuInitial());
  assert.equal(gomoku.x >= 0 && gomoku.x < 15 && gomoku.y >= 0 && gomoku.y < 15, true);
  const chess = chooseChess(chessInitial(), "easy");
  assert.equal(chessMoves(chessInitial()).some((move) => move.from === square(chess.from) && move.to === square(chess.to)), true);
  const janggi = chooseJanggi(janggiInitial(), "easy");
  assert.equal(janggiMoves(janggiInitial()).some((move) => !move.pass && move.from[0] === janggi.from[0] && move.from[1] === janggi.from[1] && move.to[0] === janggi.to[0] && move.to[1] === janggi.to[1]), true);
  const yut = begin(yutInitial(), 2, false).state;
  const thrown = toss(yut, [0, 1, 0, 0]).state;
  const choice = chooseYut(thrown);
  assert.equal(thrown.pieces.some((piece) => piece.id === choice.pieceId), true);
});

test("solo gomoku bot answers with a legal stone", () => {
  const room = createRoom({ game: "gomoku", roomId: "abc23def", name: "나", token: TOKEN, solo: true, difficulty: "easy" }).room;
  assert.equal(room.seats.filter((seat) => seat.bot).length, 1);
  assert.equal(room.status, "playing");
  const human = { ...room, data: { ...room.data, board: room.data.board.slice(), turn: 2 } };
  human.data.board[7 * 15 + 7] = 1;
  const reply = forceBot(human, 10_000);
  assert.equal(reply.ok, true);
  const stones = reply.room.data.board.filter((cell) => cell === 2).length;
  assert.equal(stones, 1);
});

test("solo drawings are simple stroke data", () => {
  assert.equal(DRAWINGS.length >= 30, true);
  for (const drawing of DRAWINGS) {
    assert.equal(drawing.word.length >= 1, true);
    assert.equal(drawing.strokes.length >= 1, true);
    for (const stroke of drawing.strokes) {
      assert.equal(stroke.points.length >= 2, true);
      for (const [x, y] of stroke.points) {
        assert.equal(x >= 0 && x <= 1000 && y >= 0 && y <= 1000, true);
      }
    }
  }
  const room = createRoom({ game: "draw", roomId: "abc23def", name: "나", token: TOKEN, solo: true }).room;
  assert.equal(room.seats[1].bot, true);
  assert.equal(room.data.drawer, 1);
  assert.equal(room.data.word, DRAWINGS[0].word);
  const step = forceBot(room, 10_000);
  assert.equal(step.room.data.strokes.length, 1);
});

