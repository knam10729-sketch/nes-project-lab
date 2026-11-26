import { DurableObject } from "cloudflare:workers";
import { hashCommentPassword, passwordMatches } from "../ideas/comment-text.js";
import {
  cleanGuest, cleanGuestComment, GUEST_COMMENT_CAP, GUEST_COMMENT_COOLDOWN_MS, GUEST_COOLDOWN_MS, GUEST_LIST_CAP,
  GUEST_STORE_CAP, presentComment, presentEntry, REVEAL_ENTRY_MAX_FAILS, REVEAL_MAX_FAILS, REVEAL_WINDOW_MS,
} from "./guestbook-text.js";

const ENTRY_COLUMNS = `id, name, body, private, created_at, pass_salt, pass_hash,
  (SELECT COUNT(*) FROM comments WHERE comments.entry_id = entries.id) AS comment_count`;

export class Guestbook extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const sql = this.ctx.storage.sql;
      sql.exec(`CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        body TEXT NOT NULL,
        private INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`);
      // Older stores have no password columns; secret posts from then stay admin-only.
      const columns = sql.exec("PRAGMA table_info(entries)").toArray().map((row) => row.name);
      if (!columns.includes("pass_salt")) sql.exec("ALTER TABLE entries ADD COLUMN pass_salt TEXT");
      if (!columns.includes("pass_hash")) sql.exec("ALTER TABLE entries ADD COLUMN pass_hash TEXT");
      sql.exec(`CREATE TABLE IF NOT EXISTS cooldown (
        ip TEXT PRIMARY KEY,
        at INTEGER NOT NULL
      )`);
      sql.exec(`CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        name TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`);
      sql.exec("CREATE INDEX IF NOT EXISTS comments_entry ON comments (entry_id, created_at)");
      sql.exec(`CREATE TABLE IF NOT EXISTS reveal_tries (
        key TEXT PRIMARY KEY,
        fails INTEGER NOT NULL,
        at INTEGER NOT NULL
      )`);
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const admin = url.searchParams.get("admin") === "1";
    const [, id = "", sub = "", subId = ""] = url.pathname.split("/").filter(Boolean);
    const ip = request.headers.get("x-idea-ip") || "local";
    try {
      if (!id) {
        if (request.method === "GET") return json({ entries: this.#list(admin) });
        if (request.method === "POST") return await this.#add(request, ip);
        return json({ error: "요청을 찾을 수 없습니다." }, 405);
      }
      if (!sub) {
        if (request.method === "DELETE") return this.#remove(id, admin);
        return json({ error: "요청을 찾을 수 없습니다." }, 405);
      }
      if (sub === "reveal" && request.method === "POST") return await this.#reveal(request, id, admin, ip);
      if (sub === "comments") {
        if (subId && request.method === "DELETE") return this.#removeComment(id, subId, admin);
        if (!subId && request.method === "GET") return this.#comments(id, admin);
        if (!subId && request.method === "POST") return await this.#addComment(request, id, admin, ip);
      }
      return json({ error: "요청을 찾을 수 없습니다." }, 405);
    } catch {
      return json({ error: "방명록을 처리하지 못했습니다." }, 500);
    }
  }

  #list(admin) {
    return this.ctx.storage.sql.exec(
      `SELECT ${ENTRY_COLUMNS} FROM entries ORDER BY created_at DESC LIMIT ?`,
      GUEST_LIST_CAP,
    ).toArray().map((row) => presentEntry(row, admin));
  }

  #entry(id) {
    return this.ctx.storage.sql.exec(`SELECT ${ENTRY_COLUMNS} FROM entries WHERE id = ?`, id).toArray()[0];
  }

  #cooling(key, ms, now) {
    const recent = this.ctx.storage.sql.exec("SELECT at FROM cooldown WHERE ip = ?", key).toArray()[0];
    return Boolean(recent && now - Number(recent.at) < ms);
  }

  #cool(key, now) {
    this.ctx.storage.sql.exec(
      "INSERT INTO cooldown (ip, at) VALUES (?, ?) ON CONFLICT(ip) DO UPDATE SET at = excluded.at",
      key, now,
    );
  }

  async #add(request, ip) {
    const now = Date.now();
    if (this.#cooling(ip, GUEST_COOLDOWN_MS, now)) return json({ error: "잠시 후 다시 남겨 주세요." }, 429);
    let payload = {};
    try { payload = await request.json(); } catch { payload = {}; }
    const cleaned = cleanGuest(payload);
    if (!cleaned.ok) return json({ error: cleaned.error }, 400);
    const id = crypto.randomUUID();
    const pass = cleaned.private ? await hashCommentPassword(cleaned.password) : { salt: null, hash: null };
    const sql = this.ctx.storage.sql;
    sql.exec(
      "INSERT INTO entries (id, name, body, private, created_at, pass_salt, pass_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id, cleaned.name, cleaned.text, cleaned.private ? 1 : 0, now, pass.salt, pass.hash,
    );
    sql.exec(`DELETE FROM entries WHERE id NOT IN (SELECT id FROM entries ORDER BY created_at DESC LIMIT ?)`, GUEST_STORE_CAP);
    sql.exec("DELETE FROM comments WHERE entry_id NOT IN (SELECT id FROM entries)");
    this.#cool(ip, now);
    const row = { id, name: cleaned.name, body: cleaned.text, private: cleaned.private ? 1 : 0, created_at: now, pass_hash: pass.hash, comment_count: 0 };
    return json(presentEntry(row, false), 201);
  }

  // Checks a secret entry's password with attempt limits. Returns null when the reader may see the entry.
  async #unlock(row, password, admin, ip) {
    if (admin || !Number(row.private)) return null;
    if (!row.pass_hash) return json({ error: "관리자만 볼 수 있는 비밀글이에요.", adminOnly: true }, 403);
    const now = Date.now();
    const sql = this.ctx.storage.sql;
    const mine = `${row.id}|${ip}`;
    const all = `${row.id}|*`;
    const tries = (key) => {
      const hit = sql.exec("SELECT fails, at FROM reveal_tries WHERE key = ?", key).toArray()[0];
      return hit && now - Number(hit.at) < REVEAL_WINDOW_MS ? Number(hit.fails) : 0;
    };
    if (tries(mine) >= REVEAL_MAX_FAILS || tries(all) >= REVEAL_ENTRY_MAX_FAILS) {
      return json({ error: "비밀번호를 여러 번 틀렸어요. 잠시 후 다시 시도해 주세요." }, 429);
    }
    const ok = typeof password === "string" && password.length > 0 && password.length <= 100
      && await passwordMatches(password, row.pass_salt, row.pass_hash);
    if (ok) {
      sql.exec("DELETE FROM reveal_tries WHERE key = ?", mine);
      return null;
    }
    for (const key of [mine, all]) {
      if (tries(key) > 0) sql.exec("UPDATE reveal_tries SET fails = fails + 1 WHERE key = ?", key);
      else sql.exec("INSERT OR REPLACE INTO reveal_tries (key, fails, at) VALUES (?, 1, ?)", key, now);
    }
    sql.exec("DELETE FROM reveal_tries WHERE at < ?", now - REVEAL_WINDOW_MS * 4);
    await new Promise((resolve) => setTimeout(resolve, 400));
    return json({ error: "비밀번호가 틀렸어요" }, 401);
  }

  #commentRows(id) {
    return this.ctx.storage.sql.exec(
      "SELECT id, entry_id, name, body, created_at FROM comments WHERE entry_id = ? ORDER BY created_at ASC LIMIT ?",
      id, GUEST_COMMENT_CAP,
    ).toArray().map(presentComment);
  }

  async #reveal(request, id, admin, ip) {
    const row = this.#entry(id);
    if (!row) return json({ error: "글을 찾지 못했습니다." }, 404);
    let payload = {};
    try { payload = await request.json(); } catch { payload = {}; }
    const denied = await this.#unlock(row, payload.password, admin, ip);
    if (denied) return denied;
    return json({ entry: presentEntry(row, admin, true), comments: this.#commentRows(id) });
  }

  #comments(id, admin) {
    const row = this.#entry(id);
    if (!row) return json({ error: "글을 찾지 못했습니다." }, 404);
    if (!admin && Number(row.private)) {
      return json({ error: "비밀글의 댓글은 비밀번호를 확인한 뒤 볼 수 있어요.", locked: true }, 403);
    }
    return json({ comments: this.#commentRows(id) });
  }

  async #addComment(request, id, admin, ip) {
    const row = this.#entry(id);
    if (!row) return json({ error: "글을 찾지 못했습니다." }, 404);
    let payload = {};
    try { payload = await request.json(); } catch { payload = {}; }
    const denied = await this.#unlock(row, payload.password, admin, ip);
    if (denied) return denied;
    const now = Date.now();
    const key = `c:${ip}`;
    if (this.#cooling(key, GUEST_COMMENT_COOLDOWN_MS, now)) return json({ error: "잠시 후 다시 남겨 주세요." }, 429);
    const cleaned = cleanGuestComment(payload);
    if (!cleaned.ok) return json({ error: cleaned.error }, 400);
    if (Number(row.comment_count) >= GUEST_COMMENT_CAP) return json({ error: "이 글에는 댓글을 더 달 수 없어요." }, 400);
    const commentId = crypto.randomUUID();
    this.ctx.storage.sql.exec(
      "INSERT INTO comments (id, entry_id, name, body, created_at) VALUES (?, ?, ?, ?, ?)",
      commentId, id, cleaned.name, cleaned.text, now,
    );
    this.#cool(key, now);
    return json({ comment: presentComment({ id: commentId, entry_id: id, name: cleaned.name, body: cleaned.text, created_at: now }), comments: this.#commentRows(id) }, 201);
  }

  #remove(id, admin) {
    if (!admin) return json({ error: "관리자만 지울 수 있습니다." }, 401);
    if (!id || id === "entries") return json({ error: "글을 찾지 못했습니다." }, 404);
    const row = this.ctx.storage.sql.exec("SELECT id FROM entries WHERE id = ?", id).toArray()[0];
    if (!row) return json({ error: "글을 찾지 못했습니다." }, 404);
    this.ctx.storage.sql.exec("DELETE FROM entries WHERE id = ?", id);
    this.ctx.storage.sql.exec("DELETE FROM comments WHERE entry_id = ?", id);
    return json({ ok: true });
  }

  #removeComment(id, commentId, admin) {
    if (!admin) return json({ error: "관리자만 지울 수 있습니다." }, 401);
    const row = this.ctx.storage.sql.exec("SELECT id FROM comments WHERE id = ? AND entry_id = ?", commentId, id).toArray()[0];
    if (!row) return json({ error: "댓글을 찾지 못했습니다." }, 404);
    this.ctx.storage.sql.exec("DELETE FROM comments WHERE id = ?", commentId);
    return json({ ok: true });
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" },
  });
}
