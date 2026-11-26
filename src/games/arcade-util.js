// Small shared helpers for the newer room games (balloon, memory, bingo, duel, flash).
export function mix(seed) {
  return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
}

// Returns [value, nextSeed] with value in [0, max).
export function roll(seed, max) {
  const next = mix(seed);
  return [(next >>> 8) % max, next];
}

export function shuffle(list, seed) {
  const out = list.slice();
  let s = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    let j;
    [j, s] = roll(s, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return [out, s];
}

export function leaders(scores) {
  if (!scores.length) return [];
  const best = Math.max(...scores);
  return scores.map((score, index) => (score === best ? index : -1)).filter((index) => index >= 0);
}

export function soonest(times, now) {
  const future = times.filter((time) => Number.isFinite(time) && time > now);
  return future.length ? Math.min(...future) : null;
}
