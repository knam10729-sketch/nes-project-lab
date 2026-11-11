import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { cleanComment, commentsToImport, hashCommentPassword, passwordMatches, relativeTime } from "../ideas/comment-text.js";

test("comment text stays plain and time is shown in Seoul terms", async () => {
  const nasty = cleanComment({ name: "  <b>네스</b>  ", text: "<script>alert(1)</script>", password: "1234" });
  assert.equal(nasty.ok, true);
  assert.equal(nasty.name, "<b>네스</b>");
  assert.equal(nasty.text, "<script>alert(1)</script>");
  assert.equal(cleanComment({ text: "   ", password: "1234" }).ok, false);
  assert.equal(cleanComment({ text: "안녕" }).ok, false);
  assert.equal(cleanComment({ text: "안녕", password: "123" }).ok, false);
  const plain = cleanComment({ text: "안녕", password: "1234" });
  assert.equal(plain.ok, true);
  assert.equal(plain.name, "익명");
  const stored = await hashCommentPassword("1234");
  assert.notEqual(stored.hash, "1234");
  assert.equal(await passwordMatches("1234", stored.salt, stored.hash), true);
  assert.equal(await passwordMatches("2002", stored.salt, stored.hash), false);
  assert.equal(await passwordMatches("2002", null, null), true);
  assert.equal(await passwordMatches("1999", null, null), false);
  const kept = { id: "new", body: "그대로" };
  const old = { id: "old", body: "이전 번호" };
  assert.deepEqual(commentsToImport([], [old]), [old]);
  assert.deepEqual(commentsToImport([kept], [old]), []);
  assert.deepEqual(commentsToImport([], [{ body: "아이디 없음" }]), []);
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
      body: JSON.stringify({ name: "손님", text: "<script>alert(1)</script>", password: "1234" }),
    });
    assert.equal(created.status, 201);
    const saved = await created.json();
    assert.equal(saved.text, "<script>alert(1)</script>");
    assert.equal(saved.pass_hash, undefined);
    const coffee = await worker.fetch(`${origin}/ideas/api/comments/1`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "커피", text: "컵 댓글", password: "1234" }),
    });
    assert.equal(coffee.status, 201);
    const coffeeSaved = await coffee.json();
    const onCoffee = await (await worker.fetch(`${origin}/ideas/api/comments/1`, { headers: { cookie } })).json();
    const onMug = await (await worker.fetch(`${origin}/ideas/api/comments/2`, { headers: { cookie } })).json();
    assert.equal(onCoffee.comments.some((comment) => comment.id === coffeeSaved.id), true);
    assert.equal(onMug.comments.some((comment) => comment.id === coffeeSaved.id), false);
    assert.equal(onMug.comments.some((comment) => comment.id === saved.id), true);
    const listed = await worker.fetch(`${origin}/ideas/api/comments/2`, { headers: { cookie } });
    const list = await listed.json();
    const ours = list.comments.find((comment) => comment.id === saved.id);
    assert.equal(ours.text, "<script>alert(1)</script>");
    assert.equal(ours.name, "손님");
    assert.equal(JSON.stringify(list).includes("pass_hash"), false);
    assert.equal(JSON.stringify(list).includes("1234"), false);
    const wrongDelete = await worker.fetch(`${origin}/ideas/api/comments/2/${saved.id}`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({ password: "9999" }),
    });
    assert.equal(wrongDelete.status, 401);
    assert.match((await wrongDelete.json()).error, /비밀번호가 틀렸어요/);
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
    const removed = await worker.fetch(`${origin}/ideas/api/comments/2/${saved.id}`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({ password: "1234" }),
    });
    assert.equal(removed.status, 200);
    const after = await worker.fetch(`${origin}/ideas/api/comments/2`, { headers: { cookie } });
    assert.equal((await after.json()).comments.some((comment) => comment.id === saved.id), false);
  } finally {
    await worker.stop();
  }
});
