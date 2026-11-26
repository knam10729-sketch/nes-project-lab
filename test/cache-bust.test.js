import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import handler from "../src/worker.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Browsers and the Cloudflare edge keep /games/*.js for hours. Without a version in the URL,
// a phone that opened a game page before a deploy keeps the old client.js, which does not know
// the newer games and shows "없는 게임입니다." Every entry script and its imports carry one version.
test("game pages load versioned scripts so a deploy is picked up right away", () => {
  const play = read("games/play.html");
  const puzzle = read("games/puzzle.html");
  const version = play.match(/\/games\/client\.js\?v=([\w-]+)/)?.[1];
  assert.ok(version, "play.html must load client.js with ?v=");
  assert.match(puzzle, new RegExp(`/games/puzzles/app\\.js\\?v=${version}`));
  for (const page of [play, puzzle, read("games/index.html")]) assert.match(page, new RegExp(`/games/games\\.css\\?v=${version}`));
  for (const file of ["games/client.js", "games/puzzles/app.js"]) {
    const imports = [...read(file).matchAll(/from "(\.[^"]+)"/g)].map((m) => m[1]);
    assert.ok(imports.length >= 4, file);
    for (const spec of imports) assert.ok(spec.endsWith(`.js?v=${version}`), `${file} imports ${spec} without ?v=${version}`);
  }
});

test("versioned game assets are still served by the site worker", async () => {
  const seen = [];
  const env = { ASSETS: { async fetch(request) { seen.push(new URL(request.url).pathname); return new Response("ok"); } } };
  for (const path of ["/games/client.js?v=x", "/games/arcade/view.js?v=x", "/games/party.js?v=x", "/games/puzzles/app.js?v=x", "/games/puzzles/g2048.js?v=x", "/games/games.css?v=x", "/games/fit.js?v=x", "/games/mole-view.js?v=x", "/games/qr.js?v=x"]) {
    const response = await handler.fetch(new Request(`https://jeonghan.kr${path}`), env);
    assert.equal(response.status, 200, path);
  }
  assert.equal(seen.length, 9);
});
