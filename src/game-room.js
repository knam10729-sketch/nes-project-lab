import { DurableObject } from "cloudflare:workers";
import { attachMeet } from "../games/geo.js";
import { handleMeetAction } from "../games/meet-pins.js";
import { alarmAt, applyAction, armBot, createRoom, joinRoom, present, seatForToken, secretFor } from "./room-logic.js";

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.pins = new Map();
    try {
      this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    } catch {
      /* Older local runtimes still accept hibernating sockets. */
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") return await this.#connect(url);
      const body = await readBody(request);
      if (url.pathname.endsWith("/create")) return await this.#create(body);
      if (url.pathname.endsWith("/join")) return await this.#join(body);
      return json({ error: "요청을 찾을 수 없습니다." }, 404);
    } catch {
      return json({ error: "게임 방을 처리하지 못했습니다." }, 500);
    }
  }

  async webSocketMessage(ws, message) {
    const room = await this.#load();
    if (!room) return;
    let action;
    try {
      const text = typeof message === "string" ? message : new TextDecoder().decode(message);
      if (text.length > 4000) return;
      action = JSON.parse(text);
    } catch {
      return;
    }
    if (!action || typeof action !== "object") return;
    if (room.game === "meet" && (action.type === "pin" || action.type === "clearPin")) {
      this.#pin(ws, room, action);
      return;
    }
    const now = Date.now();
    const result = settle(applyAction(room, seatOf(ws), action, now), now);
    const current = result.room || room;
    if (result.room && result.changed) await this.#save(result.room);
    await this.#schedule(current);
    if (result.inkOnly && result.ink) await this.#broadcastInk(result.ink);
    else if (result.changed || action.type === "sync" || action.type === "hello") await this.#broadcast(current);
    if (!result.ok) send(ws, { type: "error", error: result.error });
  }

  async webSocketClose() {
    const room = await this.#load();
    if (room) await this.#broadcast(room);
  }

  async alarm() {
    const room = await this.#load();
    if (!room) return;
    const now = Date.now();
    const result = settle(applyAction(room, null, { type: "sync" }, now), now);
    const current = result.room || room;
    if (result.changed) await this.#save(current);
    await this.#schedule(current);
    if (result.changed) await this.#broadcast(current);
  }

  async #create(body) {
    if (await this.#load()) return json({ error: "이미 있는 방입니다." }, 409);
    const created = createRoom({
      game: body.game,
      roomId: body.roomId,
      name: body.name,
      token: body.token,
      now: Date.now(),
      solo: body.solo === true,
      difficulty: body.difficulty,
      category: body.category,
      moleSeconds: body.moleSeconds,
      drawSeconds: body.drawSeconds,
    });
    if (!created.ok) return json({ error: created.error }, created.status || 400);
    const now = Date.now();
    armBot(created.room, now);
    await this.#save(created.room);
    await this.#schedule(created.room);
    return json({ roomId: created.room.roomId, game: created.room.game, seat: 0, token: body.token });
  }

  async #join(body) {
    const room = await this.#load();
    if (!room) return json({ error: "방을 찾을 수 없습니다." }, 404);
    const joined = joinRoom(room, { name: body.name, token: body.token, newToken: body.newToken });
    if (!joined.ok) return json({ error: joined.error }, joined.status || 400);
    await this.#save(joined.room);
    await this.#broadcast(joined.room);
    return json({ roomId: joined.room.roomId, game: joined.room.game, seat: joined.seat, token: joined.token });
  }

  async #connect(url) {
    const room = await this.#load();
    if (!room) return json({ error: "방을 찾을 수 없습니다." }, 404);
    const seat = seatForToken(room, url.searchParams.get("token") || "");
    if (seat < 0) return json({ error: "참가 정보가 없습니다. 링크에서 다시 입장해 주세요." }, 401);
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ seat });
    send(pair[1], { type: "welcome", seat });
    await this.#broadcast(room);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async #broadcast(room) {
    const sockets = this.ctx.getWebSockets();
    const connected = room.seats.map(() => false);
    for (const ws of sockets) {
      const seat = seatOf(ws);
      if (seat >= 0 && seat < connected.length) connected[seat] = true;
    }
    for (const ws of sockets) {
      const seat = seatOf(ws);
      send(ws, { type: "state", state: attachMeet(present(room, Date.now(), connected), this.pins), secret: secretFor(room, seat) });
    }
  }

  async #broadcastInk(stroke) {
    const payload = JSON.stringify({ type: "ink", stroke });
    for (const ws of this.ctx.getWebSockets()) send(ws, null, payload);
  }

  async #schedule(room) {
    const at = alarmAt(room, Date.now());
    if (at) await this.ctx.storage.setAlarm(at);
    else {
      try { await this.ctx.storage.deleteAlarm(); } catch { /* No alarm was set. */ }
    }
  }

  async #load() {
    return this.ctx.storage.get("room");
  }

  async #save(room) {
    const stored = { ...room, data: room.data ? { ...room.data } : room.data };
    delete stored.pins;
    if (stored.data && typeof stored.data === "object") {
      delete stored.data.pins;
      delete stored.data.people;
      delete stored.data.midpoint;
      delete stored.data.lat;
      delete stored.data.lng;
    }
    await this.ctx.storage.put("room", stored);
  }

  async #pin(ws, room, action) {
    const seat = seatOf(ws);
    if (!Number.isInteger(seat) || seat < 0 || seat >= room.seats.length) {
      send(ws, { type: "error", error: "참가 중인 자리가 없습니다." });
      return;
    }
    if (!this.pins) this.pins = new Map();
    const result = handleMeetAction(this.pins, room, seat, action);
    this.pins = result.pins;
    if (!result.ok) {
      send(ws, { type: "error", error: result.error });
      return;
    }
    await this.#broadcast(room);
  }
}

function settle(result, now) {
  if (result?.room) armBot(result.room, now);
  return result;
}

function seatOf(ws) {
  const attachment = ws.deserializeAttachment?.() || {};
  return Number.isInteger(attachment.seat) ? attachment.seat : -1;
}

function send(ws, message, raw) {
  try { ws.send(raw || JSON.stringify(message)); } catch { /* The socket already closed. */ }
}

async function readBody(request) {
  if (request.method === "GET" || request.method === "HEAD") return {};
  try {
    const text = await request.text();
    if (!text || text.length > 4000) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
