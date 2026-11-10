export const POP_MS = 1600;
export const BONK_MS = 520;

export function whackKey(whack) {
  if (!whack || whack.at == null || whack.hole == null || whack.seat == null) return null;
  return `${whack.at}:${whack.seat}:${whack.hole}`;
}

export function pinLocalPop(pops, { hole, seat, name, moleId }, now, popMs = POP_MS) {
  const live = pops.filter((pop) => pop.until > now);
  const key = `local:${moleId}`;
  if (live.some((pop) => pop.key === key)) return live;
  return [...live, { key, hole, seat, name: name || "나", moleId, until: now + popMs, local: true }];
}

export function noteLatest(pops, whack, nameOf, now, serverNow, popMs = POP_MS) {
  const live = pops.filter((pop) => pop.until > now);
  const key = whackKey(whack);
  if (!key) return live;
  const age = serverNow - whack.at;
  if (age > popMs) return live;
  const local = live.find((pop) => pop.local && pop.hole === whack.hole && pop.seat === whack.seat);
  if (local) {
    return live.map((pop) => (pop === local ? { ...pop, key, local: false, name: nameOf(whack.seat) } : pop));
  }
  if (live.some((pop) => pop.key === key)) return live;
  return [...live, {
    key,
    hole: whack.hole,
    seat: whack.seat,
    name: nameOf(whack.seat),
    until: now + popMs,
    local: false,
  }];
}

export function dropLocalPops(pops) {
  return pops.filter((pop) => !pop.local);
}

export function labelForHole(pops, hole, now) {
  let best = null;
  for (const pop of pops) {
    if (pop.hole !== hole || pop.until <= now) continue;
    if (!best || pop.until >= best.until) best = pop;
  }
  return best ? best.name : null;
}
