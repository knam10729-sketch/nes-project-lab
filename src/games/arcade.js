// Registry for the room games added in 2026-11 (풍선 터뜨리기, 짝 맞추기, 빙고, 수싸움, 찰나).
// Each module exposes the same small interface so room-logic.js can route them in one place
// without touching the older games.
import * as balloon from "./balloon.js";
import * as bingo from "./bingo.js";
import * as duel from "./duel.js";
import * as flash from "./flash.js";
import * as memory from "./memory.js";

export const ARCADE = {
  balloon: { mod: balloon, name: "풍선 터뜨리기", max: 4, min: 1, soloBots: 0 },
  memory: { mod: memory, name: "짝 맞추기", max: 2, min: 1, soloBots: 0 },
  bingo: { mod: bingo, name: "빙고", max: 4, min: 2, soloBots: 1 },
  duel: { mod: duel, name: "수싸움", max: 2, min: 2, soloBots: 1 },
  flash: { mod: flash, name: "찰나", max: 4, min: 2, soloBots: 1 },
};

export function isArcade(game) {
  return Object.prototype.hasOwnProperty.call(ARCADE, game);
}

const ERRORS = {
  wait: "지금은 할 수 없습니다.",
  turn: "아직 내 차례가 아닙니다.",
  peek: "카드를 확인하는 중입니다.",
  open: "이미 뒤집힌 카드입니다.",
  called: "이미 부른 숫자입니다.",
  picked: "이번 판 카드는 이미 냈습니다.",
  card: "가지고 있지 않은 카드입니다.",
  gone: "이미 날아갔습니다.",
  benched: "이번 판은 쉬어야 합니다.",
  bounds: "고를 수 없는 칸입니다.",
  seat: "참가 중인 자리가 없습니다.",
};

export function arcadeError(code) {
  return ERRORS[code] || "알 수 없는 요청입니다.";
}
