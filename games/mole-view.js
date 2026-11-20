export const POP_MS = 1600;
export const BONK_MS = 520;

export function whackKey(whack) {
  if (!whack || whack.at == null || whack.hole == null || whack.seat == null) return null;
  return `${whack.at}:${whack.seat}:${whack.hole}:${whack.moleId ?? ""}`;
}

export function noteServerWhacks(pops, whacks, { mySeat, swung, nameOf, now, serverNow, popMs = POP_MS }) {
  const live = (pops || []).filter((pop) => pop.until > now);
  const next = [...live];
  for (const whack of whacks || []) {
    const key = whackKey(whack);
    if (!key || whack.moleId == null) continue;
    const age = serverNow - whack.at;
    if (age > popMs) continue;
    if (next.some((pop) => pop.key === key)) continue;
    const name = nameOf(whack.seat) || "누군가";
    const mine = whack.seat === mySeat;
    const late = !mine && Boolean(swung?.has?.(whack.moleId));
    const text = late ? `${name}님이 먼저 잡았어요` : (mine ? "+1" : `+1 ${name}`);
    next.push({
      key,
      hole: whack.hole,
      seat: whack.seat,
      moleId: whack.moleId,
      name,
      late,
      text,
      until: now + popMs,
      local: false,
    });
  }
  return next;
}

export function labelForHole(pops, hole, now) {
  let best = null;
  for (const pop of pops) {
    if (pop.hole !== hole || pop.until <= now) continue;
    if (!best || pop.until >= best.until) best = pop;
  }
  return best ? best.text : null;
}
