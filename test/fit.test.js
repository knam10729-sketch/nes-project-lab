import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { playLocked } from "../games/fit.js";

test("the play screen locks only while a game is running", () => {
  assert.equal(playLocked("playing"), true);
  assert.equal(playLocked("waiting"), false);
  assert.equal(playLocked("over"), false);
  const css = readFileSync(new URL("../games/games.css", import.meta.url), "utf8");
  assert.match(css, /html\.game-lock[\s\S]*overflow:\s*hidden/);
  assert.match(css, /overscroll-behavior:\s*none/);
  assert.match(css, /100dvh/);
  const client = readFileSync(new URL("../games/client.js", import.meta.url), "utf8");
  assert.match(client, /lockPlay\(playLocked\(state\.status\)\)/);
  const meet = readFileSync(new URL("../games/meet.js", import.meta.url), "utf8");
  assert.match(meet, /lockPlay\(true\)/);
  assert.match(meet, /lockPlay\(false\)/);
  const fortune = readFileSync(new URL("../games/fortune.js", import.meta.url), "utf8");
  assert.match(fortune, /lockPlay\(true\)/);
});
