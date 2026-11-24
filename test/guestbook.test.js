import assert from "node:assert/strict";
import test from "node:test";
import { cleanGuest, cleanGuestComment, presentEntry } from "../src/guestbook-text.js";

test("private guestbook text is omitted unless the reader is the admin", () => {
  const row = { id: "a", name: "손님", body: "비밀 문장 7781", private: 1, created_at: 10 };
  const hidden = presentEntry(row, false);
  assert.equal(hidden.text, null);
  assert.equal(hidden.private, true);
  assert.equal(JSON.stringify(hidden).includes("비밀 문장 7781"), false);
  const shown = presentEntry(row, true);
  assert.equal(shown.text, "비밀 문장 7781");
  const open = presentEntry({ ...row, private: 0 }, false);
  assert.equal(open.text, "비밀 문장 7781");
  assert.equal(cleanGuest({ text: "  안녕  " }).text, "안녕");
  assert.equal(cleanGuest({ text: "   " }).ok, false);
  assert.equal(cleanGuest({ text: "비공개", private: true }).ok, false);
  assert.equal(cleanGuest({ text: "비공개", private: true, password: "abc" }).ok, false);
  assert.equal(cleanGuest({ text: "비공개", private: true, password: "abcd" }).private, true);
  assert.equal(cleanGuest({ text: "공개", password: "abcd" }).password, "");
  assert.equal(JSON.stringify(presentEntry({ ...row, pass_salt: "aa", pass_hash: "bb" }, true)).includes("bb"), false);
  assert.equal(presentEntry({ ...row, pass_hash: "bb" }, false).hasPassword, true);
  assert.equal(presentEntry(row, false).hasPassword, false);
  assert.equal(presentEntry(row, false).commentCount, null);
  assert.equal(presentEntry({ ...row, comment_count: 2 }, false, true).commentCount, 2);
  assert.equal(cleanGuestComment({ text: "  " }).ok, false);
  assert.equal(cleanGuestComment({ text: "가".repeat(250) }).text.length, 200);
  assert.equal(cleanGuestComment({ text: "댓글" }).name, "익명");
  assert.equal(cleanGuest({ text: "공개", private: "yes" }).private, false);
});

test("the guestbook API never returns a private body without the admin cookie", async () => {
  const { unstable_dev } = await import("wrangler");
  const worker = await unstable_dev("src/index.js", {
    config: "wrangler.games.jsonc",
    vars: { ADMIN_PASSWORD: "test-admin-pass", COOKIE_SECRET: "test-cookie-secret" },
    experimental: { disableExperimentalWarning: true },
    ip: "127.0.0.1",
  });
  try {
    const origin = `http://127.0.0.1:${worker.port}`;
    const headers = { origin, "content-type": "application/json" };
    const created = await worker.fetch(`${origin}/guestbook/api/entries`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "손님", text: "비밀 문장 7781", private: true, password: "guest-pass" }),
    });
    assert.equal(created.status, 201);
    const saved = await created.json();
    assert.equal(saved.text, null);
    assert.equal(JSON.stringify(saved).includes("비밀 문장 7781"), false);
    const listed = await worker.fetch(`${origin}/guestbook/api/entries`);
    const list = await listed.json();
    assert.equal(list.admin, false);
    assert.equal(JSON.stringify(list).includes("비밀 문장 7781"), false);
    assert.equal(list.entries.find((entry) => entry.id === saved.id).text, null);
    const denied = await worker.fetch(`${origin}/guestbook/api/entries/${saved.id}`, { method: "DELETE", headers: { origin } });
    assert.equal(denied.status, 401);
    const wrong = await worker.fetch(`${origin}/guestbook/unlock`, {
      method: "POST",
      headers: { origin, "content-type": "application/x-www-form-urlencoded" },
      body: "password=1999",
    });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.headers.get("set-cookie"), null);
    const opened = await worker.fetch(`${origin}/guestbook/unlock`, {
      method: "POST",
      redirect: "manual",
      headers: { origin, "content-type": "application/x-www-form-urlencoded" },
      body: "password=test-admin-pass",
    });
    assert.equal(opened.status, 302);
    const cookie = opened.headers.get("set-cookie").split(";")[0];
    const adminList = await worker.fetch(`${origin}/guestbook/api/entries`, { headers: { cookie } });
    const admin = await adminList.json();
    assert.equal(admin.admin, true);
    assert.equal(admin.entries.find((entry) => entry.id === saved.id).text, "비밀 문장 7781");
    const removed = await worker.fetch(`${origin}/guestbook/api/entries/${saved.id}`, { method: "DELETE", headers: { origin, cookie } });
    assert.equal(removed.status, 200);
    const after = await worker.fetch(`${origin}/guestbook/api/entries`, { headers: { cookie } });
    assert.equal((await after.json()).entries.some((entry) => entry.id === saved.id), false);
  } finally {
    await worker.stop();
  }
});

test("secret posts open with their own password and comments follow the entry's visibility", async () => {
  const { unstable_dev } = await import("wrangler");
  const worker = await unstable_dev("src/index.js", {
    config: "wrangler.games.jsonc",
    vars: { ADMIN_PASSWORD: "test-admin-pass", COOKIE_SECRET: "test-cookie-secret" },
    experimental: { disableExperimentalWarning: true },
    ip: "127.0.0.1",
  });
  try {
    const origin = `http://127.0.0.1:${worker.port}`;
    // Each call gets its own visitor address so the per-visitor cooldowns do not slow the test.
    const run = Math.floor(Math.random() * 200) + 20;
    let visitor = 0;
    const post = (path, body, extra = {}) => worker.fetch(`${origin}${path}`, {
      method: "POST",
      headers: { origin, "content-type": "application/json", "cf-connecting-ip": `10.${run}.1.${(visitor += 1)}`, ...extra },
      body: JSON.stringify(body),
    });
    const api = "/guestbook/api/entries";
    const noPass = await post(api, { text: "비밀", private: true });
    assert.equal(noPass.status, 400);
    const secret = await (await post(api, { name: "주인", text: "숨은 문장 5512", private: true, password: "open-sesame" })).json();
    assert.equal(secret.text, null);
    assert.equal(secret.hasPassword, true);
    assert.equal(JSON.stringify(secret).includes("open-sesame"), false);

    const listed = (await (await worker.fetch(`${origin}${api}`)).json()).entries.find((entry) => entry.id === secret.id);
    assert.equal(listed.text, null);
    assert.equal(listed.hasPassword, true);
    assert.equal(listed.commentCount, null);

    const wrong = await post(`${api}/${secret.id}/reveal`, { password: "nope-nope" });
    assert.equal(wrong.status, 401);
    const right = await post(`${api}/${secret.id}/reveal`, { password: "open-sesame" });
    assert.equal(right.status, 200);
    const opened = await right.json();
    assert.equal(opened.entry.text, "숨은 문장 5512");
    assert.deepEqual(opened.comments, []);

    const hiddenComments = await worker.fetch(`${origin}${api}/${secret.id}/comments`);
    assert.equal(hiddenComments.status, 403);
    assert.equal(JSON.stringify(await hiddenComments.json()).includes("숨은"), false);
    const blindComment = await post(`${api}/${secret.id}/comments`, { name: "남", text: "몰래 댓글" });
    assert.equal(blindComment.status, 401);
    const ownComment = await post(`${api}/${secret.id}/comments`, { name: "주인", text: "제 댓글 3391", password: "open-sesame" });
    assert.equal(ownComment.status, 201);
    const again = await (await post(`${api}/${secret.id}/reveal`, { password: "open-sesame" })).json();
    assert.deepEqual(again.comments.map((comment) => comment.text), ["제 댓글 3391"]);

    const publicEntry = await (await post(api, { name: "손님", text: "공개 글" }, { "cf-connecting-ip": `10.${run}.0.9` })).json();
    const c1 = await post(`${api}/${publicEntry.id}/comments`, { name: "가", text: "첫 댓글" }, { "cf-connecting-ip": `10.${run}.0.10` });
    assert.equal(c1.status, 201);
    const tooFast = await post(`${api}/${publicEntry.id}/comments`, { name: "가", text: "바로 또" }, { "cf-connecting-ip": `10.${run}.0.10` });
    assert.equal(tooFast.status, 429);
    const c2 = await post(`${api}/${publicEntry.id}/comments`, { name: "나", text: "둘째 <b>댓글</b>" }, { "cf-connecting-ip": `10.${run}.0.11` });
    assert.equal(c2.status, 201);
    const publicComments = await (await worker.fetch(`${origin}${api}/${publicEntry.id}/comments`)).json();
    assert.deepEqual(publicComments.comments.map((comment) => comment.text), ["첫 댓글", "둘째 <b>댓글</b>"]);
    const countNow = (await (await worker.fetch(`${origin}${api}`)).json()).entries.find((entry) => entry.id === publicEntry.id);
    assert.equal(countNow.commentCount, 2);

    const commentId = publicComments.comments[0].id;
    const deniedDelete = await worker.fetch(`${origin}${api}/${publicEntry.id}/comments/${commentId}`, { method: "DELETE", headers: { origin } });
    assert.equal(deniedDelete.status, 401);
    const unlocked = await worker.fetch(`${origin}/guestbook/unlock`, {
      method: "POST",
      redirect: "manual",
      headers: { origin, "content-type": "application/x-www-form-urlencoded" },
      body: "password=test-admin-pass",
    });
    const cookie = unlocked.headers.get("set-cookie").split(";")[0];
    const adminView = (await (await worker.fetch(`${origin}${api}`, { headers: { cookie } })).json()).entries.find((entry) => entry.id === secret.id);
    assert.equal(adminView.text, "숨은 문장 5512");
    assert.equal(adminView.commentCount, 1);
    const adminComments = await worker.fetch(`${origin}${api}/${secret.id}/comments`, { headers: { cookie } });
    assert.equal(adminComments.status, 200);
    const removed = await worker.fetch(`${origin}${api}/${publicEntry.id}/comments/${commentId}`, { method: "DELETE", headers: { origin, cookie } });
    assert.equal(removed.status, 200);
    const left = await (await worker.fetch(`${origin}${api}/${publicEntry.id}/comments`)).json();
    assert.equal(left.comments.length, 1);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const miss = await post(`${api}/${secret.id}/reveal`, { password: `wrong-${attempt}` }, { "cf-connecting-ip": `10.${run}.0.66` });
      assert.equal(miss.status, 401);
    }
    const blocked = await post(`${api}/${secret.id}/reveal`, { password: "open-sesame" }, { "cf-connecting-ip": `10.${run}.0.66` });
    assert.equal(blocked.status, 429);
    const otherVisitor = await post(`${api}/${secret.id}/reveal`, { password: "open-sesame" }, { "cf-connecting-ip": `10.${run}.0.67` });
    assert.equal(otherVisitor.status, 200);

    const cleanup = await worker.fetch(`${origin}${api}/${secret.id}`, { method: "DELETE", headers: { origin, cookie } });
    assert.equal(cleanup.status, 200);
    const gone = await worker.fetch(`${origin}${api}/${secret.id}/comments`, { headers: { cookie } });
    assert.equal(gone.status, 404);
  } finally {
    await worker.stop();
  }
});
