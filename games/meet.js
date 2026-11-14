import { lockPlay } from "./fit.js";
import { distanceMeters, formatMeters, nearestPlace, placeLabel, placeLinks, sphericalMidpoint } from "./geo.js";
import { locate } from "./locate.js";
import { drawMarkers, ensureMap, onMapPick } from "./map-view.js";
import { drawQr } from "./qr.js";

const COLORS = ["#e11d48", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#4d7c0f", "#c2410c", "#0f766e"];
const parts = location.pathname.split("/").filter(Boolean);
const roomId = /^[a-z2-9]{8}$/.test(parts[2] || "") ? parts[2] : "";
const app = document.getElementById("app");

let socket = null;
let mySeat = null;
let latest = null;
let map = null;
let layer = null;
let picking = false;
let soloPoints = [];
let stopped = false;
let pendingPin = null;
let roomToken = "";

const savedName = localStorage.getItem("nes-play-name") || "";
const savedSeat = readSeat();

if (!roomId) mountLobby();
else if (savedSeat.token) enterRoom(savedSeat.name || savedName || "손님", savedSeat.token);
else mountJoin();

function mountLobby() {
  lockPlay(false);
  const form = el("form", { className: "setup" });
  const input = el("input", { id: "nickname" });
  input.maxLength = 12;
  input.required = true;
  input.value = savedName;
  input.autocomplete = "nickname";
  const button = el("button", { className: "primary", type: "submit", text: "방 만들기" });
  const solo = el("button", { type: "button", id: "solo-map", text: "혼자 지도에 찍기" });
  const note = el("p", { className: "note", id: "note" });
  form.append(
    el("p", { className: "eyebrow", text: "만남 중간지점" }),
    el("h1", { text: "어디서 만날까요?" }),
    el("p", { className: "copy", text: "2명에서 10명까지 위치를 공유하면, 그 한가운데를 지도에 보여 줍니다." }),
    privacy(),
    el("label", { text: "이름" }),
    input,
    button,
    solo,
    note,
    el("p", {}, [el("a", { href: "/games", text: "게임 목록" })]),
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    button.disabled = true;
    note.textContent = "방을 만드는 중";
    try {
      const data = await post("/play-api/rooms", { game: "meet", name: input.value });
      localStorage.setItem("nes-play-name", input.value.trim() || "손님");
      localStorage.setItem(`nes-play:${data.roomId}`, JSON.stringify({ token: data.token, name: input.value, game: "meet" }));
      location.href = `/games/meet/${data.roomId}`;
    } catch (error) {
      note.textContent = error.message;
      button.disabled = false;
    }
  });
  solo.addEventListener("click", () => mountSolo());
  app.replaceChildren(form);
}

function mountJoin() {
  lockPlay(false);
  const form = el("form", { className: "setup" });
  const input = el("input", { id: "nickname" });
  input.maxLength = 12;
  input.required = true;
  input.value = savedName;
  const note = el("p", { className: "note", id: "note" });
  form.append(
    el("p", { className: "eyebrow", text: "만남 중간지점" }),
    el("h1", { text: "방에 들어가기" }),
    privacy(),
    el("label", { text: "이름" }),
    input,
    el("button", { className: "primary", type: "submit", text: "들어가기" }),
    note,
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    note.textContent = "들어가는 중";
    try {
      await enterRoom(input.value, "");
    } catch (error) {
      note.textContent = error.message;
    }
  });
  app.replaceChildren(form);
}

async function enterRoom(name, token) {
  const data = await post(`/play-api/rooms/${roomId}/join`, { name, token });
  localStorage.setItem("nes-play-name", name.trim() || "손님");
  localStorage.setItem(`nes-play:${roomId}`, JSON.stringify({ token: data.token, name, game: "meet" }));
  mySeat = data.seat;
  roomToken = data.token;
  mountRoom(data.token);
}

function mountRoom(token) {
  lockPlay(true);
  app.replaceChildren(
    el("p", { className: "eyebrow", text: "만남 중간지점 · 2–10명" }),
    el("h1", { text: "중간에서 만나요" }),
    privacy(),
    el("div", { className: "share" }, [
      Object.assign(el("input", { id: "room-link" }), { readOnly: true, value: location.href }),
      el("button", { type: "button", id: "copy-link", text: "링크 복사" }),
    ]),
    el("div", { className: "actions", id: "pin-actions" }),
    el("div", { id: "map", className: "map-frame" }),
    el("p", { className: "muted map-credit", text: "지도를 누르면 그 자리가 선택됩니다. 지도 © OpenStreetMap 기여자" }),
    el("div", { id: "people" }),
    el("div", { className: "actions", id: "place-links" }),
    qrCard(),
    el("p", { className: "note", id: "note" }),
  );
  document.getElementById("copy-link").addEventListener("click", copyLink);
  const actions = document.getElementById("pin-actions");
  actions.append(
    button("내 위치 공유", "primary", () => shareGps()),
    button("지도에서 고르기", "", () => beginPick()),
    button("내 위치 지우기", "", () => { pendingPin = null; send({ type: "clearPin" }); }),
  );
  const opened = openMap((lat, lng) => {
    if (!picking) {
      setNote("지도에서 고르기를 누른 뒤 장소를 찍으세요.");
      return;
    }
    picking = false;
    sendPin(lat, lng, "map");
  });
  if (!opened.ok) setNote(opened.error);
  connect(token);
}

function mountSolo() {
  lockPlay(true);
  soloPoints = [];
  app.replaceChildren(
    el("p", { className: "eyebrow", text: "만남 중간지점 · 혼자 계산" }),
    el("h1", { text: "장소를 두 곳 이상 찍으세요" }),
    privacy(),
    el("p", { className: "copy", text: "방은 만들지 않습니다. 새로고침하면 찍어 둔 장소는 사라집니다." }),
    el("div", { className: "actions" }, [
      button("내 위치 하나 넣기", "primary", () => shareGps(addSolo)),
      button("마지막 장소 빼기", "", () => { soloPoints.pop(); drawSolo(); }),
      button("방 만들기로", "", () => { destroyMap(); mountLobby(); }),
    ]),
    el("div", { id: "map", className: "map-frame" }),
    el("p", { className: "muted map-credit", text: "지도를 누르면 장소가 추가됩니다. 지도 © OpenStreetMap 기여자" }),
    el("div", { id: "people" }),
    el("div", { className: "actions", id: "place-links" }),
    el("p", { className: "note", id: "note" }),
  );
  const opened = openMap((lat, lng) => addSolo(lat, lng));
  if (!opened.ok) setNote(opened.error);
  drawSolo();
}

function addSolo(lat, lng) {
  if (soloPoints.length >= 10) {
    setNote("장소는 10곳까지 찍을 수 있습니다.");
    return;
  }
  soloPoints.push({ lat, lng, name: `장소 ${soloPoints.length + 1}` });
  drawSolo();
}

function drawSolo() {
  const midpoint = soloPoints.length >= 2 ? sphericalMidpoint(soloPoints) : null;
  const people = soloPoints.map((point, index) => ({
    ...point,
    seat: index,
    meters: midpoint ? Math.round(distanceMeters(point, midpoint)) : null,
    source: "map",
  }));
  paintMap(people, midpoint);
  paintPeople(people, midpoint, true);
  paintLinks(midpoint);
  if (soloPoints.length < 2) setNote("중간지점을 보려면 장소를 두 곳 이상 찍으세요.");
  else setNote("");
}

function connect(token) {
  if (stopped) return;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/play-api/rooms/${roomId}/ws?token=${encodeURIComponent(token)}`);
  socket = ws;
  ws.addEventListener("open", () => {
    send({ type: "hello" });
    flushPin();
  });
  ws.addEventListener("message", (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === "welcome") mySeat = message.seat;
    if (message.type === "state") renderRoom(message.state);
    if (message.type === "error") setNote(message.error);
  });
  ws.addEventListener("close", () => {
    if (stopped || socket !== ws) return;
    setNote("다시 연결하는 중");
    setTimeout(() => connect(token), 800);
  });
}

function renderRoom(state) {
  latest = state;
  const meet = overlayPending(state.meet || { people: [], midpoint: null });
  paintMap(meet.people, meet.midpoint);
  paintPeople(meet.people, meet.midpoint, false);
  paintLinks(meet.midpoint);
  const mine = meet.people.find((person) => person.seat === mySeat);
  if (pendingPin && mine?.lat != null) return;
  if (!mine?.lat) setNote("내 위치 공유를 누르거나, 지도에서 장소를 고르세요.");
  else if (!meet.midpoint) setNote(`${whereName(mine)} 위치로 공유했습니다. 한 명 더 오면 중간이 나옵니다.`);
  else setNote("");
}

function overlayPending(meet) {
  if (!pendingPin || mySeat == null) return meet;
  const serverMine = (meet.people || []).find((person) => person.seat === mySeat);
  if (serverMine?.lat != null && distanceMeters(serverMine, pendingPin) < 40) {
    pendingPin = null;
    return meet;
  }
  const people = (meet.people || []).map((person) => person.seat === mySeat
    ? { ...person, lat: pendingPin.lat, lng: pendingPin.lng, source: pendingPin.source }
    : person);
  const placed = people.filter((person) => person.lat != null);
  const midpoint = placed.length >= 2 ? sphericalMidpoint(placed) : null;
  return {
    people: people.map((person) => ({
      ...person,
      meters: midpoint && person.lat != null ? Math.round(distanceMeters(person, midpoint)) : null,
    })),
    midpoint,
  };
}

function openMap(onPick) {
  const element = document.getElementById("map");
  const opened = ensureMap(element);
  if (!opened.ok) return opened;
  onMapPick(element, onPick);
  map = opened.map;
  return opened;
}

function paintMap(people, midpoint) {
  drawMarkers(document.getElementById("map"), people, midpoint);
}

function paintPeople(people, midpoint, solo) {
  const box = document.getElementById("people");
  if (!box) return;
  box.replaceChildren();
  if (!people.length) {
    box.append(el("p", { className: "muted", text: solo ? "아직 찍은 장소가 없습니다." : "참가자를 기다리는 중" }));
    return;
  }
  const list = el("ul", { className: "meet-list" });
  for (const person of people) {
    const where = person.lat == null
      ? "위치 기다리는 중"
      : `${whereName(person)}${person.meters == null ? "" : ` · 중간까지 ${formatMeters(person.meters)}`}`;
    const item = el("li", {});
    item.append(el("i", { className: "dot" }));
    item.style.setProperty("--dot", COLORS[person.seat % COLORS.length]);
    item.append(el("strong", { text: person.name }), el("span", { text: where }));
    if (person.seat === mySeat) item.classList.add("me");
    list.append(item);
  }
  box.append(list);
  if (midpoint) box.append(el("p", { className: "mid-label", text: "흰 점이 모두의 중간지점입니다." }));
}

function paintLinks(midpoint) {
  const box = document.getElementById("place-links");
  if (!box) return;
  box.replaceChildren();
  if (!midpoint) return;
  const links = placeLinks(midpoint.lat, midpoint.lng);
  box.append(
    linkButton("카카오맵에서 열기", links.kakao),
    linkButton("네이버지도에서 열기", links.naver),
    linkButton("주변 카페/맛집 검색", links.search),
  );
}

function whereName(person) {
  if (person.lat == null) return "위치 기다리는 중";
  const place = nearestPlace(person.lat, person.lng);
  const how = person.source === "gps" ? "현재 위치" : "직접 고른 곳";
  return `${placeLabel(place)} 근처 · ${how}`;
}

async function shareGps(onPoint) {
  if (!window.isSecureContext || !navigator.geolocation) {
    beginPick();
    setNote("이 브라우저에서는 위치를 받을 수 없습니다. 지도를 눌러 장소를 고르세요.");
    return;
  }
  setNote("위치를 확인하는 중");
  try {
    const position = await locate(navigator.geolocation);
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    if (onPoint) onPoint(lat, lng);
    else sendPin(lat, lng, "gps");
  } catch (error) {
    beginPick();
    setNote(error.message || "위치를 받지 못했습니다. 지도에서 장소를 고르세요.");
  }
}

function beginPick() {
  picking = true;
  const opened = openMap((lat, lng) => {
    if (!picking && roomId) {
      setNote("지도에서 고르기를 누른 뒤 장소를 찍으세요.");
      return;
    }
    picking = false;
    if (roomId) sendPin(lat, lng, "map");
    else addSolo(lat, lng);
  });
  document.getElementById("map")?.scrollIntoView({ block: "center" });
  if (!opened.ok) setNote(opened.error);
  else setNote("지도의 원하는 곳을 한 번 눌러 주세요.");
}

function sendPin(lat, lng, source) {
  pendingPin = { lat, lng, source };
  if (latest) renderRoom(latest);
  else {
    const place = nearestPlace(lat, lng);
    setNote(`${placeLabel(place)} 근처로 공유하는 중`);
  }
  flushPin();
}

function flushPin() {
  if (!pendingPin) return;
  const sent = send({ type: "pin", lat: pendingPin.lat, lng: pendingPin.lng, source: pendingPin.source });
  if (sent) {
    const place = nearestPlace(pendingPin.lat, pendingPin.lng);
    setNote(`${placeLabel(place)} 근처로 공유했습니다.`);
  }
}

function send(message) {
  if (socket?.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(message));
  return true;
}

function copyLink() {
  const input = document.getElementById("room-link");
  const text = input?.value || location.href;
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => setNote("링크를 복사했습니다."));
  else { input?.select(); document.execCommand("copy"); setNote("링크를 복사했습니다."); }
}

function qrCard() {
  const card = el("div", { className: "qr-card", id: "qr-card" });
  const canvas = document.createElement("canvas");
  canvas.width = 280;
  canvas.height = 280;
  drawQr(canvas, location.href);
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "방 입장 QR 코드. 누르면 크게 봅니다.");
  canvas.addEventListener("click", () => openQr());
  card.append(canvas, el("p", { className: "muted", text: "휴대폰 카메라로 비추면 바로 들어옵니다." }));
  return card;
}

function openQr() {
  let overlay = document.getElementById("qr-overlay");
  if (!overlay) {
    overlay = el("div", { id: "qr-overlay", className: "qr-overlay" });
    overlay.addEventListener("click", () => overlay.classList.remove("open"));
    document.body.append(overlay);
  }
  const canvas = document.createElement("canvas");
  const size = Math.max(280, Math.min(window.innerWidth, window.innerHeight, 900) - 28);
  canvas.width = size;
  canvas.height = size;
  drawQr(canvas, location.href);
  overlay.replaceChildren(canvas);
  overlay.classList.add("open");
}

function privacy() {
  return el("p", { className: "notice-inline", text: "위치는 이 방을 쓰는 동안만 메모리에 두고, 저장하지 않습니다." });
}

function destroyMap() {
  if (map) map.remove();
  map = null;
  layer = null;
}

function button(text, className, onClick) {
  const node = el("button", { type: "button", className, text });
  node.addEventListener("click", onClick);
  return node;
}

function linkButton(text, href) {
  const node = el("a", { className: "primary", href, text });
  node.target = "_blank";
  node.rel = "noopener noreferrer";
  return node;
}

function setNote(text) {
  const note = document.getElementById("note");
  if (note) note.textContent = text;
}

function readSeat() {
  if (!roomId) return {};
  try {
    const saved = JSON.parse(localStorage.getItem(`nes-play:${roomId}`) || "null");
    if (saved?.game === "meet" && typeof saved.token === "string") return saved;
  } catch { /* Ignore a broken saved seat. */ }
  return {};
}

async function post(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "요청에 실패했습니다.");
  return data;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === "") continue;
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

window.addEventListener("pagehide", () => {
  stopped = true;
  if (socket) socket.close();
});
