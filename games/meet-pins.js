import { sanitizePin } from "./geo.js";

export function handleMeetAction(pins, room, seat, action) {
  const current = pins instanceof Map ? pins : new Map();
  if (!room || room.game !== "meet") return { ok: false, error: "이 방이 아닙니다.", pins: current };
  if (!Number.isInteger(seat) || seat < 0 || seat >= (room.seats?.length || 0)) {
    return { ok: false, error: "참가 중인 자리가 없습니다.", pins: current };
  }
  if (action?.type === "clearPin") {
    const next = new Map(current);
    next.delete(seat);
    return { ok: true, pins: next };
  }
  const pin = sanitizePin(action);
  if (!pin) return { ok: false, error: "지도에서 다시 골라 주세요.", pins: current };
  const next = new Map(current);
  next.set(seat, pin);
  return { ok: true, pins: next };
}
