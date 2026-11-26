import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import handler from "../src/worker.js";
import { checkVideoUrl, STORAGE_KEY } from "../ideas/player.js";

function ideaEnv() {
  const seen = [];
  return {
    seen,
    env: {
      ADMIN_PASSWORD: "test-admin-pass",
      IDEA_PASSWORD: "13579",
      COOKIE_SECRET: "test-cookie-secret",
      ASSETS: {
        async fetch(request) {
          seen.push(new URL(request.url).pathname);
          return new Response("asset:" + new URL(request.url).pathname, { headers: { "content-type": "text/plain" } });
        },
      },
    },
  };
}

async function unlock(env, next = "/ideas/player") {
  const response = await handler.fetch(new Request("https://jeonghan.kr/ideas/unlock", {
    method: "POST",
    headers: { origin: "https://jeonghan.kr", "content-type": "application/x-www-form-urlencoded" },
    body: `password=13579&next=${encodeURIComponent(next)}`,
  }), env);
  return response;
}

test("/ideas/player shows the login gate without a cookie and never the player", async () => {
  const { seen, env } = ideaEnv();
  for (const accept of ["text/html", "*/*"]) {
    const locked = await handler.fetch(new Request("https://jeonghan.kr/ideas/player", { headers: { accept } }), env);
    const body = await locked.text();
    assert.equal(locked.status, 200);
    assert.match(body, /action="\/ideas\/unlock"/);
    assert.match(body, /name="next" value="\/ideas\/player"/);
    assert.equal(body.includes("asset:"), false);
    assert.match(locked.headers.get("cache-control"), /no-store/);
  }
  const script = await handler.fetch(new Request("https://jeonghan.kr/ideas/player.js"), env);
  assert.equal(script.status, 401);
  const trailing = await handler.fetch(new Request("https://jeonghan.kr/ideas/player/", { headers: { accept: "text/html" } }), env);
  assert.match(await trailing.text(), /name="next" value="\/ideas\/player"/);
  const bad = await handler.fetch(new Request("https://jeonghan.kr/ideas/player", { headers: { accept: "text/html", cookie: "nes-ideas=123.bad" } }), env);
  assert.equal((await bad.text()).includes("asset:"), false);
  assert.deepEqual(seen, []);
});

test("unlocking from the player returns to /ideas/player and serves it privately", async () => {
  const { seen, env } = ideaEnv();
  const opened = await unlock(env);
  assert.equal(opened.status, 302);
  assert.equal(opened.headers.get("location"), "/ideas/player");
  const pair = opened.headers.get("set-cookie").split(";")[0];
  const page = await handler.fetch(new Request("https://jeonghan.kr/ideas/player", { headers: { cookie: pair } }), env);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), "asset:/ideas/player.html");
  assert.match(page.headers.get("cache-control"), /private, no-store/);
  const script = await handler.fetch(new Request("https://jeonghan.kr/ideas/player.js", { headers: { cookie: pair } }), env);
  assert.equal(script.status, 200);
  assert.equal(await script.text(), "asset:/ideas/player.js");
  assert.match(script.headers.get("cache-control"), /no-store/);
  assert.ok(seen.includes("/ideas/player.html"));
});

test("player only accepts http and https addresses", () => {
  assert.equal(checkVideoUrl("https://example.com/embed/1").ok, true);
  assert.equal(checkVideoUrl(" http://example.com/v ").url, "http://example.com/v");
  for (const bad of ["", "   ", "javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,hi", "file:///etc/passwd", "vbscript:x", "example.com", "https//nope", "about:blank"]) {
    const result = checkVideoUrl(bad);
    assert.equal(result.ok, false, bad);
    assert.match(result.message, /[가-힣]/);
  }
  assert.equal(STORAGE_KEY, "nes-ideas-player-url");
});

test("player page markup: iframe rules, buttons, note, link from the board", () => {
  const html = readFileSync(new URL("../ideas/player.html", import.meta.url), "utf8");
  const js = readFileSync(new URL("../ideas/player.js", import.meta.url), "utf8");
  const board = readFileSync(new URL("../ideas/index.html", import.meta.url), "utf8");
  const iframe = html.match(/<iframe[^>]*>/)[0];
  assert.match(iframe, /allowfullscreen/);
  assert.match(iframe, /referrerpolicy="no-referrer"/);
  assert.match(iframe, /allow="fullscreen; autoplay; picture-in-picture"/);
  assert.equal(/\ssrc=/.test(iframe), false);
  assert.match(html, /placeholder="https:\/\/\.\.\."/);
  assert.match(html, />재생</);
  assert.match(html, />지우기</);
  assert.match(html, /href="\/ideas"/);
  assert.match(html, /themeToggle/);
  assert.match(html, /localStorage\.getItem\('nes-theme'\)==='dark'\?'dark':'light'/);
  assert.match(html, /외부 임베드/);
  assert.match(js, /localStorage/);
  assert.match(js, /removeItem\(STORAGE_KEY\)/);
  assert.match(board, /href="\/ideas\/player"/);
  assert.match(board, /영상 플레이어/);
  for (const source of [html, js]) {
    assert.equal(/https?:\/\/(?!\.\.\.)[a-z0-9]/i.test(source.replace(/https:\/\/ 로/g, "")), false);
  }
});
