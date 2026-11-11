import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { cleanComment, relativeTime } from "../ideas/comment-text.js";

test("comment text stays plain and time is shown in Seoul terms", () => {
  const nasty = cleanComment({ name: "  <b>네스</b>  ", text: "<script>alert(1)</script>" });
  assert.equal(nasty.ok, true);
  assert.equal(nasty.name, "<b>네스</b>");
  assert.equal(nasty.text, "<script>alert(1)</script>");
  assert.equal(cleanComment({ text: "   " }).ok, false);
  assert.equal(cleanComment({ text: "안녕" }).name, "익명");
  assert.equal(relativeTime(Date.now() - 10_000), "방금");
  assert.equal(relativeTime(Date.now() - 5 * 60_000), "5분 전");
  const seoul = relativeTime(Date.parse("2026-11-10T00:00:00Z"), Date.parse("2026-11-11T12:00:00Z"));
  assert.match(seoul, /11월/);
  assert.match(seoul, /10일/);
  const source = readFileSync(new URL("../ideas/comments.js", import.meta.url), "utf8");
  assert.match(source, /textContent/);
  assert.equal(source.includes("innerHTML"), false);
});

test("comments can be posted, listed, and refused while locked", async () => {
  const { unstable_dev } = await import("wrangler");
  const worker = await unstable_dev("src/index.js", {
    config: "wrangler.games.jsonc",
    experimental: { disableExperimentalWarning: true },
    ip: "127.0.0.1",
  });
  try {
    const origin = `http://127.0.0.1:${worker.port}`;
    const locked = await worker.fetch(`${origin}/ideas/api/comments/2`);
    assert.equal(locked.status, 401);
    const opened = await worker.fetch(`${origin}/ideas/unlock`, {
      method: "POST",
      redirect: "manual",
      headers: { origin, "content-type": "application/x-www-form-urlencoded" },
      body: "password=2002&next=/ideas/2",
    });
    const cookie = opened.headers.get("set-cookie").split(";")[0];
    const headers = { origin, cookie, "content-type": "application/json" };
    const created = await worker.fetch(`${origin}/ideas/api/comments/2`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "손님", text: "<script>alert(1)</script>" }),
    });
    assert.equal(created.status, 201);
    const saved = await created.json();
    assert.equal(saved.text, "<script>alert(1)</script>");
    const listed = await worker.fetch(`${origin}/ideas/api/comments/2`, { headers: { cookie } });
    const list = await listed.json();
    assert.equal(list.comments[0].text, "<script>alert(1)</script>");
    assert.equal(list.comments[0].name, "손님");
    const again = await worker.fetch(`${origin}/ideas/api/comments/2`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: "너무 빨라요" }),
    });
    assert.equal(again.status, 429);
    const foreign = await worker.fetch(`${origin}/ideas/api/comments/2`, {
      method: "POST",
      headers: { origin: "https://example.com", cookie, "content-type": "application/json" },
      body: JSON.stringify({ text: "다른 사이트" }),
    });
    assert.equal(foreign.status, 403);
    for (const comment of list.comments) {
      const removed = await worker.fetch(`${origin}/ideas/api/comments/2/${comment.id}`, {
        method: "DELETE",
        headers: { origin, cookie },
      });
      assert.equal(removed.status, 200);
    }
    const after = await worker.fetch(`${origin}/ideas/api/comments/2`, { headers: { cookie } });
    assert.equal((await after.json()).comments.length, 0);
  } finally {
    await worker.stop();
  }
});
