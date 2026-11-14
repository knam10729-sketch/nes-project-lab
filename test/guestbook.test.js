import assert from "node:assert/strict";
import test from "node:test";
import { cleanGuest, presentEntry } from "../src/guestbook-text.js";

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
  assert.equal(cleanGuest({ text: "비공개", private: true }).private, true);
  assert.equal(cleanGuest({ text: "공개", private: "yes" }).private, false);
});

test("the guestbook API never returns a private body without the admin cookie", async () => {
  const { unstable_dev } = await import("wrangler");
  const worker = await unstable_dev("src/index.js", {
    config: "wrangler.games.jsonc",
    experimental: { disableExperimentalWarning: true },
    ip: "127.0.0.1",
  });
  try {
    const origin = `http://127.0.0.1:${worker.port}`;
    const headers = { origin, "content-type": "application/json" };
    const created = await worker.fetch(`${origin}/guestbook/api/entries`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "손님", text: "비밀 문장 7781", private: true }),
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
      body: "password=2002",
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
