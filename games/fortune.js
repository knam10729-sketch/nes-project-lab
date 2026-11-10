import { fortuneFor, seoulDate, shareText } from "./geo.js";

const app = document.getElementById("app");
let map = null;
let marker = null;
let result = null;

mount();

function mount() {
  app.replaceChildren(
    el("p", { className: "eyebrow", text: "재미용 · 저장하지 않음" }),
    el("h1", { text: "오늘의 위치 운세" }),
    el("p", { className: "copy", text: "오늘, 이 근처에서만 나오는 재미 운세입니다. 같은 동네는 하루 동안 같은 결과가 나옵니다." }),
    el("p", { className: "notice-inline", text: "위치는 이 화면에서만 쓰고 저장하지 않습니다. 대략 100m 정도로만 맞춰 운세를 고릅니다." }),
    el("div", { className: "actions" }, [
      button("내 위치 확인", "primary", () => askGps()),
      button("다시 위치 확인", "", () => askGps()),
      button("지도에서 고르기", "", () => showMap()),
      button("아무 동네로 보기", "", () => showResult(randomKorea(), "위치를 모르는 재미 운세입니다.")),
    ]),
    el("div", { id: "fortune" }),
    el("div", { id: "map", className: "map-frame", hidden: true }),
    el("p", { className: "muted map-credit", text: "지도를 누르면 그 근처의 오늘 운세가 나옵니다. 지도 © OpenStreetMap 기여자" }),
    el("p", { className: "note", id: "note" }),
    el("p", {}, [el("a", { href: "/games", text: "게임 목록" })]),
  );
  askGps();
}

function askGps() {
  if (!window.isSecureContext || !navigator.geolocation) {
    setNote("위치를 받을 수 없습니다. 지도에서 장소를 고르거나 아무 동네로 보세요.");
    showMap();
    return;
  }
  setNote("이 근처를 확인하는 중");
  navigator.geolocation.getCurrentPosition(
    (position) => showResult({ lat: position.coords.latitude, lng: position.coords.longitude }, ""),
    () => {
      setNote("위치를 허용하지 않았습니다. 지도를 누르거나 아무 동네로 볼 수 있습니다.");
      showMap();
    },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 0 },
  );
}

function showResult(point, extra) {
  result = fortuneFor(point.lat, point.lng, seoulDate());
  const box = document.getElementById("fortune");
  const direction = result.direction;
  box.replaceChildren(
    el("p", { className: "fun-badge", text: "재미용" }),
    el("p", { className: "score-num", text: String(result.score) }),
    el("p", { className: "muted", text: `${result.date} · 이 근처 총운` }),
    el("p", { className: "fortune-line", text: result.summary }),
    line("금전", result.money),
    line("연애", result.love),
    line("건강", result.health),
    compass(direction),
    el("p", { className: "fortune-line", text: `행운의 방향은 ${direction.label}쪽입니다. 북쪽을 위로 두고 화살표를 맞추세요.` }),
    colorRow(result.color),
    el("p", { className: "fortune-line", text: `행운의 숫자 ${result.number}` }),
    el("h2", { text: "오늘의 미션" }),
    el("p", { className: "fortune-line", text: result.mission }),
    el("div", { className: "actions" }, [button("운세 공유", "primary", share)]),
  );
  setNote(extra);
}

function showMap() {
  const frame = document.getElementById("map");
  frame.hidden = false;
  if (map || !window.L) {
    map?.invalidateSize();
    return;
  }
  map = L.map(frame, { zoomControl: true }).setView([36.4, 127.8], 7);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    detectRetina: false,
  }).addTo(map);
  map.on("click", (event) => {
    if (marker) marker.remove();
    marker = L.circleMarker(event.latlng, { radius: 9, color: "#111", weight: 2, fillColor: "#fff", fillOpacity: 1 }).addTo(map);
    showResult({ lat: event.latlng.lat, lng: event.latlng.lng }, "고른 장소 근처의 오늘 운세입니다.");
  });
  requestAnimationFrame(() => map.invalidateSize());
}

async function share() {
  if (!result) return;
  const text = shareText(result, `${location.origin}/games/fortune`);
  if (navigator.share) {
    try {
      await navigator.share({ title: "오늘의 위치 운세", text });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    setNote("운세 글을 복사했습니다. 좌표는 들어 있지 않습니다.");
  } catch {
    setNote(text);
  }
}

function randomKorea() {
  return { lat: 33.4 + Math.random() * 4.8, lng: 126.1 + Math.random() * 3.2 };
}

function compass(direction) {
  const node = el("div", { className: "compass" });
  node.style.setProperty("--deg", `${direction.bearing}deg`);
  node.append(el("b", { text: "북" }), el("span", { className: "needle" }));
  node.setAttribute("aria-label", `행운의 방향 ${direction.label}쪽`);
  return node;
}

function colorRow(color) {
  const row = el("p", { className: "fortune-line color-row" });
  const swatch = el("i", { className: "swatch-dot" });
  swatch.style.background = color.hex;
  row.append(swatch, document.createTextNode(`행운의 색 ${color.name}`));
  return row;
}

function line(title, text) {
  const node = el("p", { className: "fortune-line" });
  node.append(el("strong", { text: title }), document.createTextNode(` ${text}`));
  return node;
}

function button(text, className, onClick) {
  const node = el("button", { type: "button", className, text });
  node.addEventListener("click", onClick);
  return node;
}

function setNote(text) {
  const note = document.getElementById("note");
  if (note) note.textContent = text || "";
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === "") continue;
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "hidden") node.hidden = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}
