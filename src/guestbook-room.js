import { DurableObject } from "cloudflare:workers";
import { cleanGuest, GUEST_COOLDOWN_MS, GUEST_LIST_CAP, GUEST_STORE_CAP, presentEntry } from "./guestbook-text.js";

export class Guestbook extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        body TEXT NOT NULL,
        private INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`);
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS cooldown (
        ip TEXT PRIMARY KEY,
        at INTEGER NOT NULL
      )`);
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const admin = url.searchParams.get("admin") === "1";
    try {
      if (request.method === "GET") return json({ entries: this.#list(admin) });
      if (request.method === "POST") return this.#add(request);
      if (request.method === "DELETE") return this.#remove(url.pathname.split("/").pop(), admin);
      return json({ error: "요청을 찾을 수 없습니다." }, 405);
    } catch {
      return json({ error: "방명록을 처리하지 못했습니다." }, 500);
    }
  }

  #list(admin) {
    return this.ctx.storage.sql.exec(
      "SELECT id, name, body, private, created_at FROM entries ORDER BY created_at DESC LIMIT ?",
      GUEST_LIST_CAP,
    ).toArray().map((row) => presentEntry(row, admin));
  }

  async #add(request) {
    const ip = request.headers.get("x-idea-ip") || "local";
    const now = Date.now();
    const recent = this.ctx.storage.sql.exec("SELECT at FROM cooldown WHERE ip = ?", ip).toArray()[0];
    if (recent && now - Number(recent.at) < GUEST_COOLDOWN_MS) {
      return json({ error: "잠시 후 다시 남겨 주세요." }, 429);
    }
    let payload = {};
    try { payload = await request.json(); } catch { payload = {}; }
    const cleaned = cleanGuest(payload);
    if (!cleaned.ok) return json({ error: cleaned.error }, 400);
    const id = crypto.randomUUID();
    this.ctx.storage.sql.exec(
      "INSERT INTO entries (id, name, body, private, created_at) VALUES (?, ?, ?, ?, ?)",
      id, cleaned.name, cleaned.text, cleaned.private ? 1 : 0, now,
    );
    this.ctx.storage.sql.exec(
      `DELETE FROM entries WHERE id NOT IN (
        SELECT id FROM entries ORDER BY created_at DESC LIMIT ?
      )`,
      GUEST_STORE_CAP,
    );
    this.ctx.storage.sql.exec(
      "INSERT INTO cooldown (ip, at) VALUES (?, ?) ON CONFLICT(ip) DO UPDATE SET at = excluded.at",
      ip, now,
    );
    return json(presentEntry({ id, name: cleaned.name, body: cleaned.text, private: cleaned.private ? 1 : 0, created_at: now }, false), 201);
  }

  #remove(id, admin) {
    if (!admin) return json({ error: "관리자만 지울 수 있습니다." }, 401);
    if (!id || id === "entries") return json({ error: "글을 찾지 못했습니다." }, 404);
    const row = this.ctx.storage.sql.exec("SELECT id FROM entries WHERE id = ?", id).toArray()[0];
    if (!row) return json({ error: "글을 찾지 못했습니다." }, 404);
    this.ctx.storage.sql.exec("DELETE FROM entries WHERE id = ?", id);
    return json({ ok: true });
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" },
  });
}
