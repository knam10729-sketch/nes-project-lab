import assert from "node:assert/strict";
import test from "node:test";
import { labelForHole, noteServerWhacks, POP_MS } from "../games/mole-view.js";

const names = (seat) => ["네스", "봇 하나"][seat] || "누군가";

test("a tap does not score until the server says who hit first", () => {
  const swung = new Set([9]);
  const quiet = noteServerWhacks([], [], { mySeat: 0, swung, nameOf: names, now: 1_000, serverNow: 1_000 });
  assert.equal(labelForHole(quiet, 1, 1_000), null);
  const winner = noteServerWhacks(quiet, [{ hole: 1, moleId: 9, seat: 0, at: 5_000 }], {
    mySeat: 0,
    swung,
    nameOf: names,
    now: 1_200,
    serverNow: 5_050,
  });
  assert.equal(labelForHole(winner, 1, 1_200), "+1");
  const loser = noteServerWhacks([], [{ hole: 1, moleId: 9, seat: 0, at: 5_000 }], {
    mySeat: 1,
    swung,
    nameOf: names,
    now: 1_200,
    serverNow: 5_050,
  });
  assert.equal(labelForHole(loser, 1, 1_200), "네스님이 먼저 잡았어요");
});

test("someone who did not tap still sees who scored, and old pops fade", () => {
  const watch = noteServerWhacks([], [{ hole: 7, moleId: 3, seat: 1, at: 8_000 }], {
    mySeat: 0,
    swung: new Set(),
    nameOf: names,
    now: 3_000,
    serverNow: 8_100,
  });
  assert.equal(labelForHole(watch, 7, 3_000), "+1 봇 하나");
  const stale = noteServerWhacks([], [{ hole: 7, moleId: 3, seat: 1, at: 1_000 }], {
    mySeat: 0,
    swung: new Set([3]),
    nameOf: names,
    now: 5_000,
    serverNow: 1_000 + POP_MS + 1,
  });
  assert.equal(labelForHole(stale, 7, 5_000), null);
});
