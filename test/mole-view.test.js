import assert from "node:assert/strict";
import test from "node:test";
import { dropLocalPops, labelForHole, noteLatest, pinLocalPop, POP_MS } from "../games/mole-view.js";

const names = (seat) => ["네스", "봇 하나"][seat] || "누군가";

test("the player who hits sees their own +1 before the server echo", () => {
  const pops = pinLocalPop([], { hole: 4, seat: 0, name: "네스", moleId: 3 }, 1_000);
  assert.equal(labelForHole(pops, 4, 1_000), "네스");
  const echoed = noteLatest(pops, { hole: 4, seat: 0, at: 5_000 }, names, 1_200, 5_050);
  assert.equal(labelForHole(echoed, 4, 1_200), "네스");
  assert.equal(echoed.find((pop) => pop.hole === 4).local, false);
  assert.equal(echoed.find((pop) => pop.hole === 4).until, 1_000 + POP_MS);
});

test("other players and bots get a label when the hit arrives, and a failed tap is cleared", () => {
  const mine = pinLocalPop([], { hole: 1, seat: 0, name: "네스", moleId: 9 }, 2_000);
  const missed = dropLocalPops(mine);
  assert.equal(labelForHole(missed, 1, 2_000), null);
  const bot = noteLatest([], { hole: 7, seat: 1, at: 8_000 }, names, 3_000, 8_100);
  assert.equal(labelForHole(bot, 7, 3_000), "봇 하나");
  const stale = noteLatest([], { hole: 7, seat: 1, at: 1_000 }, names, 5_000, 1_000 + POP_MS + 1);
  assert.equal(labelForHole(stale, 7, 5_000), null);
});
