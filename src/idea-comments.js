import { DurableObject } from "cloudflare:workers";
import { cleanComment, COMMENT_COOLDOWN_MS, COMMENT_LIST_CAP, COMMENT_STORE_CAP, hashCommentPassword, passwordMatches } from "../ideas/comment-text.js";

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
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS delete_tries (
        ip TEXT PRIMARY KEY,
        fails INTEGER NOT NULL,
        at INTEGER NOT NULL
      )`);
      const columns = this.ctx.storage.sql.exec("PRAGMA table_info(comments)").toArray();
      const names = new Set(columns.map((column) => column.name));
      if (!names.has("pass_salt")) this.ctx.storage.sql.exec("ALTER TABLE comments ADD COLUMN pass_salt TEXT");
      if (!names.has("pass_hash")) this.ctx.storage.sql.exec("ALTER TABLE comments ADD COLUMN pass_hash TEXT");
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (request.method === "GET") return json({ comments: this.#list() });
      if (request.method === "POST") return this.#add(request);
      if (request.method === "DELETE") return await this.#remove(request, url.pathname.split("/").pop());
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
    const secret = await hashCommentPassword(cleaned.password);
    const id = crypto.randomUUID();
    this.ctx.storage.sql.exec(
      "INSERT INTO comments (id, name, body, created_at, pass_salt, pass_hash) VALUES (?, ?, ?, ?, ?, ?)",
      id, cleaned.name, cleaned.text, now, secret.salt, secret.hash,
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

  async #remove(request, id) {
    if (!id || id === "comments") return json({ error: "댓글을 찾지 못했습니다." }, 404);
    const ip = request.headers.get("x-idea-ip") || "local";
    const now = Date.now();
    const tries = this.ctx.storage.sql.exec("SELECT fails, at FROM delete_tries WHERE ip = ?", ip).toArray()[0];
    const fresh = !tries || now - Number(tries.at) > 60_000;
    const fails = fresh ? 0 : Number(tries.fails);
    if (fails >= 5) return json({ error: "잠시 후 다시 시도해 주세요." }, 429);
    let payload = {};
    try { payload = await request.json(); } catch { payload = {}; }
    const row = this.ctx.storage.sql.exec(
      "SELECT pass_salt, pass_hash FROM comments WHERE id = ?",
      id,
    ).toArray()[0];
    if (!row) return json({ error: "댓글을 찾지 못했습니다." }, 404);
    const allowed = await passwordMatches(payload.password, row.pass_salt, row.pass_hash);
    if (!allowed) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      this.ctx.storage.sql.exec(
        "INSERT INTO delete_tries (ip, fails, at) VALUES (?, ?, ?) ON CONFLICT(ip) DO UPDATE SET fails = excluded.fails, at = excluded.at",
        ip, fails + 1, now,
      );
      return json({ error: "비밀번호가 틀렸어요" }, 401);
    }
    this.ctx.storage.sql.exec("DELETE FROM comments WHERE id = ?", id);
    this.ctx.storage.sql.exec("DELETE FROM delete_tries WHERE ip = ?", ip);
    return json({ ok: true });
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" },
  });
}
