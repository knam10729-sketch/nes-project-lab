import { algebraic, apply as applyChess, initialState as chessInitial, legalMoves as chessLegal } from "./games/chess.js";
import { apply as applyGomoku, initialState as gomokuInitial } from "./games/gomoku.js";
import { apply as applyJanggi, initialState as janggiInitial, legalMoves as janggiLegal } from "./games/janggi.js";
import { begin as beginDraw, clearBoard, guess as guessDraw, initialState as drawInitial, nextAlarm as drawAlarm, publicView as drawView, secretFor as drawSecret, stroke, tick as tickDraw } from "./games/draw.js";
import { begin as beginLiar, guess as guessLiar, hint as hintLiar, initialState as liarInitial, publicView as liarView, secretFor as liarSecret, vote as voteLiar } from "./games/liar.js";
import { hit, initialState as moleInitial, MOLE_DURATION, nextAlarmAt, startRound, tick, winnerOf } from "./games/mole.js";
import { begin as beginYut, burn, initialState as yutInitial, options as yutOptions, play as playYut, toss } from "./games/yut.js";

export const GAMES = {
  gomoku: { max: 2, name: "오목" },
  chess: { max: 2, name: "체스" },
  janggi: { max: 2, name: "장기" },
  mole: { max: 4, min: 1, name: "두더지 잡기 대결" },
  yut: { max: 4, min: 2, name: "윷놀이" },
  liar: { max: 5, min: 3, name: "라이어 게임" },
  draw: { max: 5, min: 2, name: "그림 맞히기" },
};

const PARTY = new Set(["mole", "yut", "liar", "draw"]);

const ERRORS = {
  over: "게임이 끝났습니다.",
  bounds: "보드 밖입니다.",
  occupied: "이미 돌이 있는 자리입니다.",
  illegal: "둘 수 없는 수입니다.",
  promotion: "프로모션할 기물을 선택해 주세요.",
  check: "장군이라 빅장을 주장할 수 없습니다.",
  noface: "지금은 빅장이 아닙니다.",
};

export function cleanName(name) {
  const text = String(name ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 12);
  return text || "손님";
}

export function createRoom({ game, roomId, name, token, now = Date.now() }) {
  if (!GAMES[game]) return fail("알 수 없는 게임입니다.", 400);
  if (!/^[a-z2-9]{8}$/.test(String(roomId)) || !validToken(token)) return fail("방 정보가 올바르지 않습니다.", 400);
  return {
    ok: true,
    room: {
      game,
      roomId,
      createdAt: now,
      firstSeat: 0,
      round: 1,
      status: "waiting",
      seats: [{ name: cleanName(name), token }],
      maxSeats: GAMES[game].max,
      winnerSeat: null,
      draw: false,
      reason: null,
      data: initialData(game),
    },
  };
}

export function seatForToken(room, token) {
  return room.seats.findIndex((item) => tokensMatch(item.token, token));
}

export function joinRoom(room, { name, token, newToken }) {
  if (token) {
    const seat = seatForToken(room, token);
    if (seat >= 0) {
      const next = clone(room);
      if (name) next.seats[seat].name = cleanName(name);
      return { ok: true, room: next, seat, token };
    }
  }
  if (room.seats.length >= room.maxSeats) return fail("자리가 가득 찼습니다.", 409);
  if (PARTY.has(room.game) && (room.status !== "waiting" || room.data.phase !== "waiting")) return fail("이미 시작된 게임입니다.", 409);
  if (!validToken(newToken)) return fail("참가 정보가 올바르지 않습니다.", 400);
  const next = clone(room);
  next.seats.push({ name: cleanName(name), token: newToken });
  if (!PARTY.has(next.game) && next.status === "waiting") next.status = "playing";
  return { ok: true, room: next, seat: next.seats.length - 1, token: newToken };
}

export function applyAction(room, seat, action, now = Date.now()) {
  const next = clone(room);
  let changed = false;
  if (next.game === "mole" || next.game === "draw") {
    const ticked = next.game === "mole" ? tick(next.data, now) : tickDraw(next.data, now);
    next.data = ticked.state;
    changed = ticked.changed;
    if (next.game === "mole") syncMole(next);
    else syncDraw(next);
    changed = changed || next.status !== room.status;
  }
  if (!action || action.type === "sync" || action.type === "hello") return { ok: true, room: next, changed };
  if (!Number.isInteger(seat) || seat < 0 || seat >= next.seats.length) {
    return stopped("참가 중인 자리가 없습니다.", next, changed);
  }
  if (action.type === "rename") {
    next.seats[seat].name = cleanName(action.name);
    return { ok: true, room: next, changed: true };
  }
  if (action.type === "rematch") {
    if (next.status !== "over") return stopped("게임이 끝난 뒤에 다시 할 수 있습니다.", next, changed);
    return { ok: true, room: rematch(next), changed: true };
  }
  if (next.game === "mole") return moleAction(next, seat, action, now, changed);
  if (PARTY.has(next.game)) return partyAction(next, seat, action, now, changed);
  return boardAction(next, seat, action);
}

export function present(room, now = Date.now(), connected = []) {
  return {
    game: room.game,
    roomId: room.roomId,
    round: room.round,
    status: room.status,
    maxSeats: room.maxSeats,
    seats: room.seats.map((seat, index) => ({
      name: seat.name,
      color: colorOf(room, index),
      connected: Boolean(connected[index]),
    })),
    turnSeat: turnSeat(room),
    winnerSeat: room.winnerSeat,
    draw: room.draw,
    reason: room.reason,
    check: Boolean(room.data.check),
    facing: Boolean(room.data.facing),
    canPass: room.game === "janggi" && room.status === "playing" && !room.data.check,
    canClaimDraw: room.game === "janggi" && room.status === "playing" && room.data.facing && !room.data.check,
    now,
    legalMoves: publicMoves(room),
    position: publicPosition(room),
  };
}

export function secretFor(room, seat) {
  if (room.game === "liar") return liarSecret(room.data, seat);
  if (room.game === "draw") return drawSecret(room.data, seat);
  return null;
}

export function alarmAt(room, now = Date.now()) {
  if (room.game === "mole") return nextAlarmAt(room.data, now);
  if (room.game === "draw") return drawAlarm(room.data, now);
  return null;
}

function moleAction(room, seat, action, now, changed) {
  if (action.type === "start") {
    if (seat !== 0) return stopped("방장만 시작할 수 있습니다.", room, changed);
    const started = startRound(room.data, now, room.seats.length);
    if (!started.ok) return stopped("이미 진행 중입니다.", room, changed);
    room.data = started.state;
    room.status = "playing";
    room.draw = false;
    room.winnerSeat = null;
    room.reason = null;
    return { ok: true, room, changed: true };
  }
  if (action.type === "hit") {
    const result = hit(room.data, seat, Number(action.moleId), now);
    if (!result.ok) return stopped("이미 사라졌거나 다른 사람이 잡았습니다.", room, changed);
    room.data = result.state;
    return { ok: true, room, changed: true };
  }
  return stopped("알 수 없는 요청입니다.", room, changed);
}

function boardAction(room, seat, action) {
  if (room.status === "over") return fail("게임이 끝났습니다.");
  if (room.status !== "playing") return fail("아직 상대가 들어오지 않았습니다.");
  if (seat !== currentTurn(room)) return fail("상대 차례입니다.");
  if (action.type !== "move" && action.type !== "pass" && action.type !== "claimDraw") return fail("알 수 없는 요청입니다.");
  const move = action.type === "pass" ? { pass: true } : action.type === "claimDraw" ? { claimDraw: true } : action.move;
  const result = applyBoard(room.game, room.data, move);
  if (!result.ok) return fail(ERRORS[result.error] || "둘 수 없는 수입니다.");
  room.data = result.state;
  if (result.over) finishBoard(room, result);
  return { ok: true, room, changed: true };
}

function finishBoard(room, result) {
  room.status = "over";
  room.reason = result.reason;
  if (result.winner === "draw") {
    room.draw = true;
    room.winnerSeat = null;
    return;
  }
  room.draw = false;
  room.winnerSeat = seatForSide(room, result.winner);
}

function rematch(room) {
  const next = clone(room);
  next.round += 1;
  next.winnerSeat = null;
  next.draw = false;
  next.reason = null;
  if (PARTY.has(next.game)) {
    next.status = "waiting";
    next.data = initialData(next.game);
    next.firstSeat = 0;
    return next;
  }
  next.firstSeat = next.firstSeat === 0 ? 1 : 0;
  next.data = initialData(next.game);
  next.status = next.seats.length >= 2 ? "playing" : "waiting";
  return next;
}

function syncMole(room) {
  if (room.data.phase !== "over" || room.status === "over") return;
  const outcome = winnerOf(room.data.scores);
  room.status = "over";
  room.draw = outcome.draw;
  room.winnerSeat = outcome.winner;
  room.reason = "time";
}

function publicMoves(room) {
  if (room.status !== "playing") return [];
  if (room.game === "chess") {
    return chessLegal(room.data).map((move) => ({
      from: algebraic(move.from),
      to: algebraic(move.to),
      promotion: move.promotion || null,
    }));
  }
  if (room.game === "janggi") return janggiLegal(room.data);
  return [];
}

function publicPosition(room) {
  if (room.game === "gomoku") return { size: 15, board: room.data.board, last: room.data.last };
  if (room.game === "chess") {
    return { board: room.data.board, turn: room.data.turn, last: room.data.last, ep: room.data.ep };
  }
  if (room.game === "janggi") return { board: room.data.board, turn: room.data.turn, last: room.data.last };
  if (room.game === "yut") return yutView(room.data);
  if (room.game === "liar") return liarView(room.data);
  if (room.game === "draw") return drawView(room.data);
  return {
    phase: room.data.phase,
    startedAt: room.data.startedAt,
    endsAt: room.data.endsAt,
    active: room.data.active,
    scores: room.data.scores,
    duration: MOLE_DURATION,
  };
}

function applyBoard(game, data, move) {
  if (game === "gomoku") return applyGomoku(data, move);
  if (game === "chess") return applyChess(data, move);
  return applyJanggi(data, move);
}

function initialData(game) {
  if (game === "gomoku") return gomokuInitial();
  if (game === "chess") return chessInitial();
  if (game === "janggi") return janggiInitial();
  if (game === "yut") return yutInitial();
  if (game === "liar") return liarInitial();
  if (game === "draw") return drawInitial();
  return moleInitial(1);
}

function partyAction(room, seat, action, now, changed) {
  if (action.type === "start") return startParty(room, seat, action, now);
  if (room.status !== "playing") return stopped("방장이 시작하기 전입니다.", room, changed);
  if (room.game === "yut") return yutAction(room, seat, action);
  if (room.game === "liar") return liarAction(room, seat, action);
  return drawAction(room, seat, action, now);
}

function startParty(room, seat, action, now) {
  if (seat !== 0) return stopped("방장만 시작할 수 있습니다.", room, false);
  const count = room.seats.length;
  const min = GAMES[room.game].min || 1;
  if (count < min) return stopped(`시작하려면 ${min}명 이상이 필요합니다.`, room, false);
  const started = room.game === "yut"
    ? beginYut(room.data, count, Boolean(action.teams))
    : room.game === "liar"
      ? beginLiar(room.data, count, action.category, randomInt(count), randomInt(30))
      : beginDraw(room.data, count, randomInt(1000), now);
  if (!started.ok) return stopped("시작할 수 없습니다. 인원과 설정을 확인해 주세요.", room, false);
  room.data = started.state;
  room.status = "playing";
  room.winnerSeat = null;
  room.draw = false;
  room.reason = null;
  return { ok: true, room, changed: true };
}

function yutAction(room, seat, action) {
  if (seat !== room.data.turn) return stopped("상대 차례입니다.", room, false);
  if (action.type === "toss") {
    const bytes = new Uint8Array(1);
    crypto.getRandomValues(bytes);
    const result = toss(room.data, bytes[0]);
    if (!result.ok) return stopped("지금은 던질 수 없습니다.", room, false);
    room.data = result.state;
    return { ok: true, room, changed: true };
  }
  if (action.type === "move") {
    const result = playYut(room.data, action.pieceId, Number(action.throwId));
    if (!result.ok) return stopped("그 말은 그렇게 움직일 수 없습니다.", room, false);
    room.data = result.state;
    if (result.over) finishYut(room, result.winnerOwner);
    return { ok: true, room, changed: true };
  }
  if (action.type === "burn") {
    const result = burn(room.data, Number(action.throwId));
    if (!result.ok) return stopped("아직 둘 곳이 있습니다.", room, false);
    room.data = result.state;
    return { ok: true, room, changed: true };
  }
  return stopped("알 수 없는 요청입니다.", room, false);
}

function liarAction(room, seat, action) {
  const result = action.type === "hint"
    ? hintLiar(room.data, seat, action.text)
    : action.type === "vote"
      ? voteLiar(room.data, seat, Number(action.target))
      : action.type === "guess"
        ? guessLiar(room.data, seat, action.text)
        : { ok: false, error: "unknown" };
  if (!result.ok) return stopped(liarError(result.error), room, false);
  room.data = result.state;
  if (room.data.phase === "over") {
    const liarWins = room.data.result === "escaped" || room.data.result === "guessed";
    room.status = "over";
    room.reason = room.data.result;
    room.winnerSeat = liarWins ? room.data.liar : null;
    room.draw = false;
  }
  return { ok: true, room, changed: true };
}

function drawAction(room, seat, action, now) {
  if (action.type === "stroke") {
    const result = stroke(room.data, seat, action.stroke, now);
    if (!result.ok) return stopped("지금은 그릴 수 없습니다.", room, false);
    room.data = result.state;
    return { ok: true, room, changed: true, ink: result.stroke, inkOnly: true };
  }
  if (action.type === "clear") {
    const result = clearBoard(room.data, seat);
    if (!result.ok) return stopped("그리는 사람만 지울 수 있습니다.", room, false);
    room.data = result.state;
    return { ok: true, room, changed: true };
  }
  if (action.type === "guess") {
    const result = guessDraw(room.data, seat, action.text, now);
    if (!result.ok) return stopped("지금은 맞힐 수 없습니다.", room, false);
    room.data = result.state;
    syncDraw(room);
    return { ok: true, room, changed: true };
  }
  return stopped("알 수 없는 요청입니다.", room, false);
}

function finishYut(room, owner) {
  room.status = "over";
  room.reason = room.data.teams ? "team" : "finish";
  room.draw = false;
  room.winnerSeat = room.data.teams ? (owner === 0 ? 0 : 1) : owner;
}

function syncDraw(room) {
  if (room.data.phase !== "over" || room.status === "over") return;
  const scores = room.data.scores || [];
  const best = scores.length ? Math.max(...scores) : 0;
  const leaders = scores.map((score, index) => score === best ? index : -1).filter((index) => index >= 0);
  room.status = "over";
  room.draw = leaders.length !== 1;
  room.winnerSeat = leaders.length === 1 ? leaders[0] : null;
  room.reason = "score";
}

function yutView(data) {
  return {
    phase: data.phase,
    teams: data.teams,
    turn: data.turn,
    pieces: data.pieces,
    pending: data.pending,
    last: data.last,
    finished: data.finished,
    options: yutOptions(data),
    playerCount: data.playerCount,
  };
}

function turnSeat(room) {
  if (room.status !== "playing") return null;
  if (room.game === "yut") return room.data.phase === "over" ? null : room.data.turn;
  if (room.game === "liar" && room.data.phase === "hint") return room.data.turn;
  if (room.game === "liar" && room.data.phase === "guess") return room.data.liar;
  if (room.game === "draw" && room.data.phase === "draw") return room.data.drawer;
  if (room.game === "mole" || room.game === "liar" || room.game === "draw") return null;
  return currentTurn(room);
}

function liarError(code) {
  if (code === "turn") return "아직 내 차례가 아닙니다.";
  if (code === "word") return "정답 단어는 말할 수 없습니다.";
  if (code === "voted") return "이미 투표했습니다.";
  if (code === "target") return "그 사람에게는 투표할 수 없습니다.";
  if (code === "empty") return "한 줄 힌트를 입력해 주세요.";
  return "지금은 할 수 없습니다.";
}

function randomInt(max) {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] % max;
}

function currentTurn(room) {
  if (room.game === "gomoku") return room.data.turn === 1 ? room.firstSeat : otherSeat(room);
  if (room.game === "chess") return room.data.turn === "w" ? room.firstSeat : otherSeat(room);
  return room.data.turn === "cho" ? room.firstSeat : otherSeat(room);
}

function seatForSide(room, side) {
  const first = side === "black" || side === "w" || side === "cho";
  return first ? room.firstSeat : otherSeat(room);
}

function colorOf(room, index) {
  const first = index === room.firstSeat;
  if (room.game === "gomoku") return first ? "흑" : "백";
  if (room.game === "chess") return first ? "백" : "흑";
  if (room.game === "janggi") return first ? "초" : "한";
  return String(index + 1);
}

function otherSeat(room) {
  return room.firstSeat === 0 ? 1 : 0;
}

function validToken(token) {
  return typeof token === "string" && /^[a-f0-9]{32}$/.test(token);
}

function tokensMatch(left, right) {
  if (!validToken(left) || !validToken(right)) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function fail(error, status = 400) {
  return { ok: false, error, status };
}

function stopped(error, room, changed) {
  return { ok: false, error, status: 400, room, changed: Boolean(changed) };
}

function clone(value) {
  return structuredClone(value);
}
