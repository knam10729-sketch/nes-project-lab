import { DurableObject } from "cloudflare:workers";
import { cleanComment, COMMENT_COOLDOWN_MS, COMMENT_LIST_CAP, COMMENT_STORE_CAP } from "../ideas/comment-text.js";

export class IdeaComments extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        body TEXT NOT NULL,
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
    try {
      if (request.method === "GET") return json({ comments: this.#list() });
      if (request.method === "POST") return this.#add(request);
      if (request.method === "DELETE") return this.#remove(url.pathname.split("/").pop());
      return json({ error: "요청을 찾을 수 없습니다." }, 405);
    } catch {
      return json({ error: "댓글을 처리하지 못했습니다." }, 500);
    }
  }

  #list() {
    return this.ctx.storage.sql.exec(
      "SELECT id, name, body, created_at FROM comments ORDER BY created_at DESC LIMIT ?",
      COMMENT_LIST_CAP,
    ).toArray().map((row) => ({
      id: row.id,
      name: row.name,
      text: row.body,
      createdAt: row.created_at,
    }));
  }

  async #add(request) {
    const ip = request.headers.get("x-idea-ip") || "local";
    const now = Date.now();
    const recent = this.ctx.storage.sql.exec("SELECT at FROM cooldown WHERE ip = ?", ip).toArray()[0];
    if (recent && now - Number(recent.at) < COMMENT_COOLDOWN_MS) {
      return json({ error: "잠시 후 다시 등록해 주세요." }, 429);
    }
    let payload = {};
    try { payload = await request.json(); } catch { payload = {}; }
    const cleaned = cleanComment(payload);
    if (!cleaned.ok) return json({ error: cleaned.error }, 400);
    const id = crypto.randomUUID();
    this.ctx.storage.sql.exec(
      "INSERT INTO comments (id, name, body, created_at) VALUES (?, ?, ?, ?)",
      id, cleaned.name, cleaned.text, now,
    );
    this.ctx.storage.sql.exec(
      `DELETE FROM comments WHERE id NOT IN (
        SELECT id FROM comments ORDER BY created_at DESC LIMIT ?
      )`,
      COMMENT_STORE_CAP,
    );
    this.ctx.storage.sql.exec(
      "INSERT INTO cooldown (ip, at) VALUES (?, ?) ON CONFLICT(ip) DO UPDATE SET at = excluded.at",
      ip, now,
    );
    return json({ id, name: cleaned.name, text: cleaned.text, createdAt: now }, 201);
  }

  #remove(id) {
    if (!id) return json({ error: "댓글을 찾지 못했습니다." }, 404);
    this.ctx.storage.sql.exec("DELETE FROM comments WHERE id = ?", id);
    return json({ ok: true });
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" },
  });
}
