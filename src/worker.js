const UPSTREAM = "https://shared-calendar-4pu.pages.dev";
const PREFIX = "/calendar-app";
const COOKIE_PREFIX = "nescal_";
const GAMES = new Set(["gomoku", "chess", "janggi", "mole", "yut", "liar", "draw"]);
const ROOM = /^[a-z2-9]{8}$/;
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/games" || url.pathname.startsWith("/games/") || url.pathname.startsWith("/play-api/")) {
      return handleGames(request, env, url);
    }
    return handleSite(request, env, url);
  },
};

async function handleGames(request, env, url) {
  const path = url.pathname;
  if (path.startsWith("/play-api/")) return handleApi(request, env, url);
  if (path === "/games" || path === "/games/" || path === "/games/index.html") return serve(request, env, "/games/index.html");
  if (path === "/games/play.html" || path === "/games/client.js" || path === "/games/party.js" || path === "/games/games.css") return env.ASSETS.fetch(request);
  const match = path.match(/^\/games\/(gomoku|chess|janggi|mole|yut|liar|draw)(?:\/([a-z2-9]{8}))?\/?$/);
  if (match) return serve(request, env, "/games/play.html");
  return text("페이지를 찾을 수 없습니다.", 404);
}

async function handleApi(request, env, url) {
  if (request.method !== "GET" && request.method !== "HEAD" && crossSite(request, url)) return text("Forbidden", 403);
  const path = url.pathname;
  if (request.method === "POST" && path === "/play-api/rooms") return createApi(request, env, url);
  const match = path.match(/^\/play-api\/rooms\/([a-z2-9]{8})\/(join|ws)$/);
  if (!match) return json({ error: "요청을 찾을 수 없습니다." }, 404);
  const roomId = match[1];
  if (match[2] === "ws") return socketApi(request, env, url, roomId);
  if (request.method !== "POST") return json({ error: "요청을 찾을 수 없습니다." }, 405);
  const body = await readJson(request);
  if (body.error) return json(body, 413);
  return callRoom(env, roomId, "/join", { name: body.name, token: body.token || "", newToken: randomToken() });
}

async function createApi(request, env, url) {
  const body = await readJson(request);
  if (body.error) return json(body, 413);
  if (!GAMES.has(body.game)) return json({ error: "알 수 없는 게임입니다." }, 400);
  if (!env.GAME_ROOMS) return unavailable();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const roomId = randomRoomId();
    const token = randomToken();
    const response = await callRoom(env, roomId, "/create", { game: body.game, roomId, name: body.name, token });
    if (response.status !== 409) return response;
  }
  return json({ error: "방을 만들지 못했습니다. 다시 시도해 주세요." }, 500);
}

async function socketApi(request, env, url, roomId) {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ error: "연결 방식이 올바르지 않습니다." }, 426);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return text("Forbidden", 403);
  if (!env.GAME_ROOMS) return unavailable();
  if (!ROOM.test(roomId)) return json({ error: "방 주소가 올바르지 않습니다." }, 404);
  const stub = env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(roomId));
  return stub.fetch(request);
}

async function callRoom(env, roomId, path, body) {
  if (!env.GAME_ROOMS) return unavailable();
  if (!ROOM.test(roomId)) return json({ error: "방 주소가 올바르지 않습니다." }, 404);
  const stub = env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(roomId));
  return stub.fetch(new Request(`https://room.internal${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

function unavailable() {
  return json({ error: "게임 서버가 아직 연결되지 않았습니다. 방을 만들려면 사이트 설정에서 게임 방을 연결해야 합니다." }, 503);
}

async function serve(request, env, pathname) {
  if (!env.ASSETS) return text("페이지를 찾지 못했습니다.", 500);
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = "";
  return env.ASSETS.fetch(new Request(url, { method: "GET" }));
}

async function handleSite(request, env, url) {
  if (url.pathname === "/about" || url.pathname === "/about/") {
    const home = new URL(request.url);
    home.pathname = "/";
    return env.ASSETS.fetch(new Request(home, request));
  }
  const calendar = url.pathname === PREFIX || url.pathname.startsWith(PREFIX + "/");
  const api = url.pathname.startsWith("/api/");
  if (!calendar && !api) return env.ASSETS.fetch(request);
  if (url.pathname === PREFIX) return Response.redirect(url.origin + PREFIX + "/" + url.search, 308);
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin !== url.origin || request.headers.get("sec-fetch-site") === "cross-site") {
      return new Response("Forbidden", { status: 403 });
    }
  }
  const target = new URL(UPSTREAM);
  target.pathname = calendar ? url.pathname.slice(PREFIX.length) : url.pathname;
  target.search = url.search;
  const headers = new Headers();
  for (const name of ["accept", "content-type", "if-none-match"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Only this integration's cookies are forwarded to the existing service.
  const cookies = (request.headers.get("cookie") || "").split(";").map((value) => value.trim())
    .filter((value) => value.startsWith(COOKIE_PREFIX)).map((value) => value.slice(COOKIE_PREFIX.length));
  if (cookies.length) headers.set("cookie", cookies.join("; "));
  if (request.headers.has("origin")) headers.set("origin", UPSTREAM);
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual",
  });
  const output = new Headers(upstream.headers);
  output.delete("set-cookie");
  for (const cookie of upstream.headers.getSetCookie()) {
    const scoped = COOKIE_PREFIX + cookie.replace(/;\s*Domain=[^;]+/gi, "");
    output.append("set-cookie", scoped);
  }
  output.set("cache-control", "private, no-store");
  output.set("x-content-type-options", "nosniff");
  output.set("x-frame-options", "SAMEORIGIN");
  output.delete("access-control-allow-origin");
  output.delete("access-control-allow-credentials");
  const location = output.get("location");
  if (location) {
    const dest = new URL(location, target);
    if (dest.origin !== UPSTREAM) return new Response("Unexpected redirect", { status: 502 });
    output.set("location", url.origin + (dest.pathname.startsWith("/api/") ? "" : PREFIX) + dest.pathname + dest.search + dest.hash);
  }
  if (calendar && target.pathname === "/app.js" && upstream.ok) {
    const script = (await upstream.text()).replace("location.origin + \"/?admin_view=\"", "location.origin + \"/calendar-app/?admin_view=\"");
    output.delete("content-length");
    output.delete("content-encoding");
    output.delete("etag");
    return new Response(script, { status: upstream.status, headers: output });
  }
  return new Response(upstream.body, { status: upstream.status, headers: output });
}

function crossSite(request, url) {
  const origin = request.headers.get("origin");
  return origin !== url.origin || request.headers.get("sec-fetch-site") === "cross-site";
}

async function readJson(request) {
  try {
    const text = await request.text();
    if (text.length > 4000) return { error: "요청이 너무 큽니다." };
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function randomRoomId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => ALPHABET[value % ALPHABET.length]).join("");
}

function randomToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function text(message, status) {
  return new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}
