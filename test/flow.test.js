import assert from "node:assert/strict";
import test from "node:test";
import { applyAction, createRoom, joinRoom, present } from "../src/room-logic.js";
import handler from "../src/worker.js";

const WHITE = "a".repeat(32);
const BLACK = "b".repeat(32);

test("server-side chess checkmate records the black seat", () => {
  let game = createRoom({ game: "chess", roomId: "abc23def", name: "백", token: WHITE, now: 10 }).room;
  game = joinRoom(game, { name: "흑", newToken: BLACK }).room;
  const moves = [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]];
  let seat = 0;
  for (const [from, to] of moves) {
    const result = applyAction(game, seat, { type: "move", move: { from, to } });
    assert.equal(result.ok, true);
    game = result.room;
    seat = 1 - seat;
  }
  assert.equal(game.status, "over");
  assert.equal(game.winnerSeat, 1);
  assert.equal(game.reason, "checkmate");
  const view = present(game);
  assert.equal(JSON.stringify(view).includes(WHITE), false);
  assert.equal(view.seats[1].color, "흑");
});

test("existing pages stay on their original routes", async () => {
  const seen = [];
  const env = {
    ASSETS: {
      async fetch(request) {
        seen.push(new URL(request.url).pathname);
        return new Response("asset:" + new URL(request.url).pathname, { headers: { "content-type": "text/html" } });
      },
    },
  };
  const home = await handler.fetch(new Request("https://jeonghan.kr/"), env);
  assert.equal(await home.text(), "asset:/");
  const about = await handler.fetch(new Request("https://jeonghan.kr/about"), env);
  assert.equal(await about.text(), "asset:/");
  const theme = await handler.fetch(new Request("https://jeonghan.kr/theme.css"), env);
  assert.equal(await theme.text(), "asset:/theme.css");
  const play = await handler.fetch(new Request("https://jeonghan.kr/games/chess/abc23def"), env);
  assert.equal(await play.text(), "asset:/games/play.html");
  const landing = await handler.fetch(new Request("https://jeonghan.kr/games"), env);
  assert.equal(await landing.text(), "asset:/games/index.html");
  assert.deepEqual(seen, ["/", "/", "/theme.css", "/games/play.html", "/games/index.html"]);
});

test("calendar API stays proxied and game API does not use it", async () => {
  const upstream = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    upstream.push(String(url));
    return new Response("calendar", { headers: { "content-type": "text/plain" } });
  };
  try {
    const env = { ASSETS: { fetch: async () => new Response("asset") } };
    const calendar = await handler.fetch(new Request("https://jeonghan.kr/api/events"), env);
    assert.equal(await calendar.text(), "calendar");
    assert.equal(upstream.length, 1);
    assert.ok(upstream[0].startsWith("https://shared-calendar-4pu.pages.dev/api/events"));
    const game = await handler.fetch(new Request("https://jeonghan.kr/play-api/rooms", {
      method: "POST",
      headers: { origin: "https://jeonghan.kr", "content-type": "application/json" },
      body: JSON.stringify({ game: "gomoku", name: "정한" }),
    }), env);
    assert.equal(game.status, 503);
    assert.equal(upstream.length, 1);
    const cross = await handler.fetch(new Request("https://jeonghan.kr/play-api/rooms", {
      method: "POST",
      headers: { origin: "https://example.com", "sec-fetch-site": "cross-site", "content-type": "application/json" },
      body: "{}",
    }), env);
    assert.equal(cross.status, 403);
  } finally {
    globalThis.fetch = original;
  }
});
