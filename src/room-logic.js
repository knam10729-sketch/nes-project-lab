import { algebraic, apply as applyChess, initialState as chessInitial, legalMoves as chessLegal } from "./games/chess.js";
import { apply as applyGomoku, initialState as gomokuInitial } from "./games/gomoku.js";
import { apply as applyJanggi, initialState as janggiInitial, legalMoves as janggiLegal } from "./games/janggi.js";
import { begin as beginDraw, clearBoard, guess as guessDraw, initialState as drawInitial, nextAlarm as drawAlarm, publicView as drawView, secretFor as drawSecret, stroke, tick as tickDraw } from "./games/draw.js";
import { begin as beginLiar, guess as guessLiar, hint as hintLiar, initialState as liarInitial, publicView as liarView, secretFor as liarSecret, vote as voteLiar } from "./games/liar.js";
import { actNight, advance as advanceMafia, assignRoles, begin as beginMafia, initialState as mafiaInitial, publicView as mafiaView, secretFor as mafiaSecret, tick as tickMafia, vote as voteMafia } from "./games/mafia.js";
import { hit, initialState as moleInitial, MOLE_DURATION, nextAlarmAt, startRound, tick, winnerOf } from "./games/mole.js";
import { begin as beginYut, burn, initialState as yutInitial, options as yutOptions, play as playYut, toss } from "./games/yut.js";
import { chooseChess, chooseGomoku, chooseJanggi, chooseLiarHint, chooseLiarVote, chooseYut, reactionDelay } from "./bots/choose.js";
import { DRAWINGS } from "./bots/drawings.js";
import { CATEGORIES } from "./games/words.js";

export const GAMES = {
  gomoku: { max: 2, name: "오목" },
  chess: { max: 2, name: "체스" },
  janggi: { max: 2, name: "장기" },
  mole: { max: 4, min: 1, name: "두더지 잡기 대결" },
  yut: { max: 4, min: 2, name: "윷놀이" },
  liar: { max: 5, min: 3, name: "라이어 게임" },
  draw: { max: 5, min: 2, name: "그림 맞히기" },
  meet: { max: 10, min: 2, name: "만남 중간지점" },
  mafia: { max: 10, min: 4, name: "마피아" },
};

const PARTY = new Set(["mole", "yut", "liar", "draw", "mafia"]);

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

export const MOLE_SECONDS = [30, 60, 90, 120];
export const DRAW_SECONDS = [40, 60, 80, 100, 120];

export function createRoom({ game, roomId, name, token, now = Date.now(), solo = false, difficulty = "easy", category = "food", moleSeconds, drawSeconds }) {
  if (!GAMES[game]) return fail("알 수 없는 게임입니다.", 400);
  if (!/^[a-z2-9]{8}$/.test(String(roomId)) || !validToken(token)) return fail("방 정보가 올바르지 않습니다.", 400);
  const room = {
    game,
    roomId,
    createdAt: now,
    firstSeat: 0,
    round: 1,
    status: "waiting",
    seats: [{ name: cleanName(name), token, bot: false }],
    maxSeats: GAMES[game].max,
    winnerSeat: null,
    draw: false,
    reason: null,
    data: initialData(game),
    solo: false,
    difficulty: "easy",
    botAt: null,
    settings: { moleMs: 60_000, drawMs: 80_000 },
  };
  if (MOLE_SECONDS.includes(Number(moleSeconds))) room.settings.moleMs = Number(moleSeconds) * 1000;
  if (DRAW_SECONDS.includes(Number(drawSeconds))) room.settings.drawMs = Number(drawSeconds) * 1000;
  if (solo && game === "mafia") return fail("마피아는 여러 사람이 모인 뒤에 시작합니다.", 400);
  if (solo && game !== "meet") startSolo(room, now, difficulty, category);
  return { ok: true, room };
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
  if (next.game === "mole" || next.game === "draw" || next.game === "mafia") {
    const ticked = next.game === "mole" ? tick(next.data, now) : next.game === "draw" ? tickDraw(next.data, now) : tickMafia(next.data, now);
    next.data = ticked.state;
    changed = ticked.changed;
    if (next.game === "mole") syncMole(next);
    else if (next.game === "draw") syncDraw(next);
    else syncMafia(next);
    changed = changed || next.status !== room.status;
  }
  if (!action || action.type === "sync" || action.type === "hello" || action.type === "bot") {
    if (action?.type === "sync" || action?.type === "bot") {
      if (stepIfDue(next, now)) changed = true;
    }
    armBot(next, now);
    if (next.botAt !== room.botAt) changed = true;
    return { ok: true, room: next, changed };
  }
  if (!Number.isInteger(seat) || seat < 0 || seat >= next.seats.length) {
    return stopped("참가 중인 자리가 없습니다.", next, changed);
  }
  if (action.type === "rename") {
    next.seats[seat].name = cleanName(action.name);
    return { ok: true, room: next, changed: true };
  }
  if (action.type === "settings") return applySettings(next, seat, action);
  if (action.type === "rematch") {
    if (next.status !== "over") return stopped("게임이 끝난 뒤에 다시 할 수 있습니다.", next, changed);
    const restarted = rematch(next, now);
    armBot(restarted, now);
    return { ok: true, room: restarted, changed: true };
  }
  if (next.game === "meet") return stopped("위치는 이 연결 동안에만 유지됩니다.", next, changed);
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
      connected: Boolean(connected[index]) || Boolean(seat.bot),
      bot: Boolean(seat.bot),
    })),
    solo: Boolean(room.solo),
    difficulty: room.difficulty || null,
    time: {
      moleSeconds: (room.settings?.moleMs || 60_000) / 1000,
      drawSeconds: (room.settings?.drawMs || 80_000) / 1000,
    },
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
  if (room.game === "mafia") return mafiaSecret(room.data, seat);
  return null;
}

export function alarmAt(room, now = Date.now()) {
  const times = [];
  if (room.game === "mole") {
    const at = nextAlarmAt(room.data, now);
    if (at) times.push(at);
  }
  if (room.game === "draw") {
    const at = drawAlarm(room.data, now);
    if (at) times.push(at);
  }
  if (room.game === "mafia" && room.status === "playing" && room.data.endsAt) times.push(room.data.endsAt);
  if (room.botAt != null) times.push(room.botAt);
  return times.length ? Math.min(...times) : null;
}

export function forceBot(room, now = Date.now()) {
  const next = clone(room);
  next.botAt = now;
  const acted = stepIfDue(next, now);
  armBot(next, now);
  return { ok: acted, room: next };
}

function moleAction(room, seat, action, now, changed) {
  if (action.type === "start") {
    if (seat !== 0) return stopped("방장만 시작할 수 있습니다.", room, changed);
    const started = startRound(room.data, now, room.seats.length, room.settings?.moleMs);
    if (!started.ok) return stopped("이미 진행 중입니다.", room, changed);
    room.data = started.state;
    room.status = "playing";
    room.draw = false;
    room.winnerSeat = null;
    room.reason = null;
    return { ok: true, room, changed: true };
  }
  if (action.type === "hit") {
    const mole = room.data.active.find((item) => item.id === Number(action.moleId));
    const result = hit(room.data, seat, Number(action.moleId), now);
    if (!result.ok) return stopped("이미 사라졌거나 다른 사람이 잡았습니다.", room, changed);
    room.data = rememberWhack(result.state, mole, seat, now);
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

function rematch(room, now = Date.now()) {
  const next = clone(room);
  next.round += 1;
  next.winnerSeat = null;
  next.draw = false;
  next.reason = null;
  next.botAt = null;
  if (next.solo) {
    next.data = initialData(next.game);
    next.status = "waiting";
    next.firstSeat = 0;
    startSolo(next, now, next.difficulty, room.data.categoryId || "food", false);
    return next;
  }
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
  if (room.game === "meet") return { kind: "meet" };
  if (room.game === "mafia") return mafiaView(room.data);
  return {
    phase: room.data.phase,
    startedAt: room.data.startedAt,
    endsAt: room.data.endsAt,
    active: room.data.active,
    scores: room.data.scores,
    duration: room.data.duration || room.settings?.moleMs || MOLE_DURATION,
    lastWhack: room.data.lastWhack || null,
    whacks: room.data.whacks || [],
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
  if (game === "meet") return { kind: "meet" };
  if (game === "mafia") return mafiaInitial();
  return moleInitial(1);
}

function partyAction(room, seat, action, now, changed) {
  if (action.type === "start") return startParty(room, seat, action, now);
  if (room.status !== "playing") return stopped("방장이 시작하기 전입니다.", room, changed);
  if (room.game === "yut") return yutAction(room, seat, action);
  if (room.game === "liar") return liarAction(room, seat, action);
  if (room.game === "mafia") return mafiaAction(room, seat, action, now);
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
      : room.game === "mafia"
        ? beginMafia(room.data, assignRoles(count, randomInt), now)
        : beginDraw(room.data, count, randomInt(1000), now, { durationMs: room.settings?.drawMs });
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

function mafiaAction(room, seat, action, now) {
  const result = action.type === "night"
    ? actNight(room.data, seat, Number(action.target), now)
    : action.type === "vote"
      ? voteMafia(room.data, seat, Number(action.target), now)
      : action.type === "advance"
        ? (seat === 0 ? advanceMafia(room.data, now) : { ok: false, error: "host" })
        : { ok: false, error: "unknown" };
  if (!result.ok) return stopped(mafiaError(result.error), room, false);
  room.data = result.state;
  syncMafia(room);
  return { ok: true, room, changed: true };
}

function syncMafia(room) {
  if (!room.data.winner || room.status === "over") return;
  room.status = "over";
  room.reason = room.data.winner;
  room.winnerSeat = null;
  room.draw = false;
}

function mafiaError(code) {
  if (code === "host") return "방장만 다음 단계로 넘길 수 있습니다.";
  if (code === "dead") return "탈락한 뒤에는 고를 수 없습니다.";
  if (code === "target") return "그 사람은 고를 수 없습니다.";
  if (code === "voted") return "이미 투표했습니다.";
  if (code === "role") return "이 밤에는 고를 역할이 없습니다.";
  return "지금은 할 수 없습니다.";
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
  if (room.game === "mole" || room.game === "liar" || room.game === "draw" || room.game === "mafia") return null;
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

const BOT_NAMES = ["봇 하나", "봇 둘", "봇 셋"];

function startSolo(room, now, difficulty, category, addPlayers = true) {
  room.solo = true;
  room.difficulty = difficulty === "normal" ? "normal" : "easy";
  if (addPlayers) {
    const count = soloBotCount(room.game, room.difficulty);
    for (let index = 0; index < count && room.seats.length < room.maxSeats; index += 1) {
      room.seats.push({ name: BOT_NAMES[index] || `봇 ${index + 1}`, token: randomToken(), bot: true });
    }
  }
  const players = room.seats.length;
  if (room.game === "gomoku" || room.game === "chess" || room.game === "janggi") {
    room.status = "playing";
    return;
  }
  if (room.game === "mole") {
    const started = startRound(room.data, now, players, room.settings?.moleMs);
    if (started.ok) room.data = started.state;
  } else if (room.game === "yut") {
    const started = beginYut(room.data, players, false);
    if (started.ok) room.data = started.state;
  } else if (room.game === "liar") {
    const picked = CATEGORIES[category] ? category : "food";
    const started = beginLiar(room.data, players, picked, randomInt(players), randomInt(30));
    if (started.ok) room.data = started.state;
  } else if (room.game === "draw") {
    const started = beginDraw(room.data, players, randomInt(1000), now, {
      rounds: 5,
      soloGuess: true,
      botDrawer: 1,
      pack: DRAWINGS,
      durationMs: room.settings?.drawMs,
    });
    if (started.ok) room.data = started.state;
  }
  room.status = "playing";
}

function soloBotCount(game, difficulty) {
  if (game === "mole" || game === "yut") return difficulty === "normal" ? 2 : 1;
  if (game === "liar") return difficulty === "normal" ? 3 : 2;
  return 1;
}

function randomToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function armBot(room, now = Date.now()) {
  if (!room?.solo || room.status !== "playing") {
    if (room) room.botAt = null;
    return;
  }
  if (room.game === "mole") {
    ensureMolePlans(room);
    const due = Object.values(room.data.botPlans || {});
    room.botAt = due.length ? Math.min(...due) : null;
    return;
  }
  if (room.game === "draw" && room.data.phase === "draw" && room.seats[room.data.drawer]?.bot) {
    const cursor = room.data.scriptCursor || 0;
    if (cursor < (room.data.script || []).length) {
      if (room.botAt == null) room.botAt = now + (room.difficulty === "normal" ? 120 : 220);
      return;
    }
  }
  if (room.game === "liar" && room.data.phase === "vote") {
    const waiting = room.seats.some((seat, index) => seat.bot && room.data.votes[index] == null);
    if (waiting) {
      if (room.botAt == null) room.botAt = now + 450;
      return;
    }
  }
  const seat = turnSeat(room);
  if (seat == null || !room.seats[seat]?.bot || room.data.phase === "over") {
    room.botAt = null;
    return;
  }
  if (room.botAt == null) room.botAt = now + (room.difficulty === "normal" ? 280 : 640);
}

function stepIfDue(room, now) {
  if (!room.solo) return false;
  if (room.game === "mole") ensureMolePlans(room);
  if (room.botAt == null || room.botAt > now) return false;
  const acted = actBot(room, now);
  room.botAt = null;
  return acted;
}

function actBot(room, now) {
  if (room.game === "mole") return actMole(room, now);
  if (room.game === "draw") return actDraw(room);
  if (room.game === "yut") return actYut(room);
  if (room.game === "liar") return actLiar(room);
  if (room.game === "gomoku" || room.game === "chess" || room.game === "janggi") return actBoard(room);
  return false;
}

function actBoard(room) {
  const move = room.game === "chess"
    ? chooseChess(room.data, room.difficulty)
    : room.game === "janggi"
      ? chooseJanggi(room.data, room.difficulty)
      : chooseGomoku(room.data);
  const result = applyBoard(room.game, room.data, move);
  if (!result.ok) return false;
  room.data = result.state;
  if (result.over) finishBoard(room, result);
  return true;
}

function actYut(room) {
  if (room.data.phase === "throw") {
    const bytes = new Uint8Array(1);
    crypto.getRandomValues(bytes);
    const result = toss(room.data, bytes[0]);
    if (!result.ok) return false;
    room.data = result.state;
    return true;
  }
  const choice = chooseYut(room.data);
  if (!choice) {
    const ticket = room.data.pending[0];
    if (!ticket) return false;
    const burned = burn(room.data, ticket.id);
    if (!burned.ok) return false;
    room.data = burned.state;
    return true;
  }
  const result = playYut(room.data, choice.pieceId, choice.throwId);
  if (!result.ok) return false;
  room.data = result.state;
  if (result.over) finishYut(room, result.winnerOwner);
  return true;
}

function actLiar(room) {
  if (room.data.phase === "hint" && room.seats[room.data.turn]?.bot) {
    const used = room.data.hints.filter((hint) => hint.seat === room.data.turn).map((hint) => hint.text);
    const text = chooseLiarHint(room.data.word, room.data.category, room.data.turn === room.data.liar, used);
    const result = hintLiar(room.data, room.data.turn, text);
    if (!result.ok) return false;
    room.data = result.state;
    if (room.data.phase === "over") finishLiarRoom(room);
    return true;
  }
  if (room.data.phase === "guess" && room.seats[room.data.liar]?.bot) {
    const words = CATEGORIES[room.data.categoryId]?.words || ["추측"];
    const result = guessLiar(room.data, room.data.liar, words[randomInt(words.length)]);
    if (!result.ok) return false;
    room.data = result.state;
    finishLiarRoom(room);
    return true;
  }
  if (room.data.phase === "vote") {
    const seat = room.seats.findIndex((player, index) => player.bot && room.data.votes[index] == null);
    if (seat < 0) return false;
    const result = voteLiar(room.data, seat, chooseLiarVote(room.data, seat));
    if (!result.ok) return false;
    room.data = result.state;
    if (room.data.phase === "over" || room.data.phase === "guess") finishLiarRoom(room);
    return true;
  }
  return false;
}

function finishLiarRoom(room) {
  if (room.data.phase !== "over") return;
  const liarWins = room.data.result === "escaped" || room.data.result === "guessed";
  room.status = "over";
  room.reason = room.data.result;
  room.winnerSeat = liarWins ? room.data.liar : null;
  room.draw = false;
}

function actDraw(room) {
  const script = room.data.script || [];
  const cursor = room.data.scriptCursor || 0;
  if (room.data.phase !== "draw" || cursor >= script.length) return false;
  const stroke = script[cursor];
  room.data.strokes = [...(room.data.strokes || []), {
    id: `bot${room.data.round}-${cursor}`,
    color: stroke.color || "#171717",
    erase: false,
    points: stroke.points,
  }];
  room.data.scriptCursor = cursor + 1;
  return true;
}

function actMole(room, now) {
  ensureMolePlans(room);
  let choice = null;
  for (const [key, at] of Object.entries(room.data.botPlans || {})) {
    if (at > now) continue;
    const [id, seat] = key.split(":").map(Number);
    if (!room.data.active.some((mole) => mole.id === id)) {
      delete room.data.botPlans[key];
      continue;
    }
    if (!choice || at < choice.at) choice = { key, id, seat, at };
  }
  if (!choice) return false;
  const mole = room.data.active.find((item) => item.id === choice.id);
  delete room.data.botPlans[choice.key];
  const plans = room.data.botPlans;
  const result = hit(room.data, choice.seat, choice.id, now);
  if (result.ok) room.data = rememberWhack({ ...result.state, botPlans: plans }, mole, choice.seat, now);
  return true;
}

function rememberWhack(state, mole, seat, now) {
  const whack = { hole: mole?.hole ?? null, seat, at: now };
  return { ...state, lastWhack: whack, whacks: [...(state.whacks || []), whack].slice(-8) };
}

function applySettings(room, seat, action) {
  if (seat !== 0) return stopped("방장만 시간을 바꿀 수 있습니다.", room, false);
  if (room.status !== "waiting") return stopped("시작 전에만 바꿀 수 있습니다.", room, false);
  const seconds = Number(action.seconds);
  if (room.game === "mole") {
    if (!MOLE_SECONDS.includes(seconds)) return stopped("선택할 수 없는 시간입니다.", room, false);
    room.settings = { ...room.settings, moleMs: seconds * 1000 };
    return { ok: true, room, changed: true };
  }
  if (room.game === "draw") {
    if (!DRAW_SECONDS.includes(seconds)) return stopped("선택할 수 없는 시간입니다.", room, false);
    room.settings = { ...room.settings, drawMs: seconds * 1000 };
    return { ok: true, room, changed: true };
  }
  return stopped("이 게임은 시간을 바꾸지 않습니다.", room, false);
}

function ensureMolePlans(room) {
  if (!room.data.botPlans) room.data.botPlans = {};
  for (const mole of room.data.active || []) {
    room.seats.forEach((seat, index) => {
      if (!seat.bot) return;
      const key = `${mole.id}:${index}`;
      if (room.data.botPlans[key] == null) {
        room.data.botPlans[key] = mole.spawnedAt + reactionDelay(room.difficulty, mole.id, index);
      }
    });
  }
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
