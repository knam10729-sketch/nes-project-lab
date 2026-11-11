const UPSTREAM = "https://shared-calendar-4pu.pages.dev";
const PREFIX = "/calendar-app";
const COOKIE_PREFIX = "nescal_";
const GAMES = new Set(["gomoku", "chess", "janggi", "mole", "yut", "liar", "draw", "meet"]);
const ROOM = /^[a-z2-9]{8}$/;
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/ideas" || url.pathname.startsWith("/ideas/")) return handleIdeas(request, env, url);
    if (url.pathname === "/games" || url.pathname.startsWith("/games/") || url.pathname.startsWith("/play-api/")) {
      return handleGames(request, env, url);
    }
    return handleSite(request, env, url);
  },
};

const IDEA_PASSWORD = "2002";
const IDEA_COOKIE = "nes-ideas";
const IDEA_SECRET = "jeonghan.kr ideas gate v1";
const IDEA_MAX_AGE = 60 * 60 * 24 * 30;

async function handleIdeas(request, env, url) {
  const path = url.pathname.replace(/\/+$/, "") || "/ideas";
  if (request.method === "POST" && path === "/ideas/unlock") return unlockIdeas(request, url);
  if ((request.method === "POST" || request.method === "GET") && path === "/ideas/lock") return lockIdeas();
  if (!(await ideaCookieValid(request))) return ideaLocked(request, path);
  if (path === "/ideas") return privateAsset(request, env, "/ideas/index.html");
  if (/^\/ideas\/\d+$/.test(path)) return privateAsset(request, env, "/ideas/detail.html");
  if (path.startsWith("/ideas/img/") || ["/ideas/data.js", "/ideas/board.js", "/ideas/detail.js", "/ideas/ideas.css"].includes(path)) {
    return privateAsset(request, env);
  }
  return text("페이지를 찾을 수 없습니다.", 404);
}

async function unlockIdeas(request, url) {
  if (crossSite(request, url)) return text("Forbidden", 403);
  let password = "";
  let next = "/ideas";
  try {
    const body = await request.formData();
    password = String(body.get("password") || "");
    next = safeIdeaNext(body.get("next"));
  } catch {
    password = "";
  }
  if (!sameText(password, IDEA_PASSWORD)) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    return ideaGate(next, true);
  }
  const exp = Math.floor(Date.now() / 1000) + IDEA_MAX_AGE;
  const sig = await ideaSign(`ideas:${exp}`);
  const headers = new Headers({
    location: next,
    "cache-control": "private, no-store",
  });
  headers.append("set-cookie", `${IDEA_COOKIE}=${exp}.${sig}; HttpOnly; Secure; SameSite=Lax; Path=/ideas; Max-Age=${IDEA_MAX_AGE}`);
  return new Response(null, { status: 302, headers });
}

function lockIdeas() {
  const headers = new Headers({
    location: "/ideas",
    "cache-control": "private, no-store",
  });
  headers.append("set-cookie", `${IDEA_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/ideas; Max-Age=0`);
  return new Response(null, { status: 302, headers });
}

async function ideaLocked(request, path) {
  const wantsHtml = ideaPage(path) || acceptsHtml(request);
  if (!wantsHtml) {
    return new Response("잠겨 있습니다.", {
      status: 401,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store" },
    });
  }
  return ideaGate(safeIdeaNext(path), false);
}

function ideaPage(path) {
  return path === "/ideas" || /^\/ideas\/\d+$/.test(path);
}

function acceptsHtml(request) {
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function ideaGate(next, wrong) {
  const back = escapeHtml(safeIdeaNext(next));
  const error = wrong ? `<p class="gate-error">비밀번호가 틀렸어요</p>` : "";
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#080808">
<title>아이디어 | 정한.kr</title>
<script>try{document.documentElement.dataset.theme=localStorage.getItem('nes-theme')==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}</script>
<link rel="stylesheet" href="/theme.css">
<link rel="stylesheet" href="/games/games.css">
<script src="/theme.js" defer></script>
<style>
.gate{display:grid;gap:12px;max-width:420px;margin-top:18px}
.gate input{width:100%;box-sizing:border-box;min-height:64px;border-radius:16px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-size:32px;font-weight:800;letter-spacing:.28em;text-align:center}
.gate button{min-height:52px;border:0;border-radius:14px;background:var(--accent);color:var(--on-accent);font:inherit;font-weight:800;font-size:17px}
.gate-error{margin:0;color:var(--ink);font-weight:800}
.shake{animation:gate-shake .42s ease}
@keyframes gate-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(4px)}}
</style>
</head>
<body>
<header><div class="nav"><a class="logo" href="/#home">정한<span>.</span>kr</a><nav aria-label="주 메뉴"><a href="/#projects">프로젝트</a><a href="/#experience">업무 경험</a><a href="/#skills">Skills</a><a href="/#calendar">공유 캘린더</a><a href="/ideas" aria-current="page">아이디어</a><a href="/games">게임</a><a href="/about">만든이</a><button id="themeToggle" class="theme-toggle" type="button" aria-label="화이트 테마로 전환" aria-pressed="false"><span class="theme-icon" aria-hidden="true">◐</span><span class="theme-label">화이트</span></button></nav></div></header>
<main class="idea-wrap">
<p class="eyebrow">PRIVATE</p>
<h1>아이디어</h1>
<p class="copy">기획 보드는 비밀번호가 있어야 열립니다.</p>
<form class="gate${wrong ? " shake" : ""}" method="post" action="/ideas/unlock">
<input type="hidden" name="next" value="${back}">
<label for="idea-pass">비밀번호</label>
<input id="idea-pass" name="password" inputmode="numeric" autocomplete="off" autofocus enterkeyhint="go" pattern="[0-9]*" aria-label="비밀번호">
<button type="submit">들어가기</button>
${error}
</form>
</main>
</body>
</html>`;
  return new Response(html, {
    status: wrong ? 401 : 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
}

async function ideaCookieValid(request) {
  const raw = readCookie(request.headers.get("cookie"), IDEA_COOKIE);
  const match = /^(\d+)\.([a-f0-9]{64})$/.exec(raw);
  if (!match) return false;
  const exp = Number(match[1]);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const expected = await ideaSign(`ideas:${exp}`);
  return sameText(expected, match[2]);
}

async function ideaSign(payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(IDEA_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bits = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(bits)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function readCookie(header, name) {
  if (!header) return "";
  for (const part of header.split(";")) {
    const split = part.trim().split("=");
    if (split[0] === name) return split.slice(1).join("=");
  }
  return "";
}

function safeIdeaNext(value) {
  const path = String(value || "/ideas").split("?")[0].split("#")[0];
  if (!/^\/ideas(\/[A-Za-z0-9._~-]+)*$/.test(path)) return "/ideas";
  return path;
}

function sameText(left, right) {
  const a = new TextEncoder().encode(String(left));
  const b = new TextEncoder().encode(String(right));
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length, 1);
  for (let index = 0; index < length; index += 1) diff |= (a[index] || 0) ^ (b[index] || 0);
  return diff === 0;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

async function privateAsset(request, env, pathname) {
  const response = pathname ? await serve(request, env, pathname) : await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-store");
  return new Response(response.body, { status: response.status, headers });
}

async function handleGames(request, env, url) {
  const path = url.pathname;
  if (path.startsWith("/play-api/")) return handleApi(request, env, url);
  if (path === "/games" || path === "/games/" || path === "/games/index.html") return serve(request, env, "/games/index.html");
  if (path === "/games/fortune" || path === "/games/fortune/") return serve(request, env, "/games/fortune.html");
  if (path === "/games/meet" || path === "/games/meet/") return serve(request, env, "/games/meet.html");
  if (/^\/games\/meet\/[a-z2-9]{8}\/?$/.test(path)) return serve(request, env, "/games/meet.html");
  if (path.startsWith("/games/vendor/leaflet/")) return env.ASSETS.fetch(request);
  if ([
    "/games/play.html", "/games/client.js", "/games/party.js", "/games/qr.js", "/games/mole-view.js",
    "/games/geo.js", "/games/meet.js", "/games/fortune.js", "/games/locate.js", "/games/map-view.js",
    "/games/neighborhoods.js", "/games/fortune-text.js", "/games/vendor/qrcode.js", "/games/games.css",
  ].includes(path)) return env.ASSETS.fetch(request);
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
    const response = await callRoom(env, roomId, "/create", {
      game: body.game,
      roomId,
      name: body.name,
      token,
      solo: body.solo === true,
      difficulty: body.difficulty === "normal" ? "normal" : "easy",
      category: typeof body.category === "string" ? body.category : "food",
      moleSeconds: body.moleSeconds,
      drawSeconds: body.drawSeconds,
    });
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
