import { lockPlay } from "./fit.js";
import { fortuneFor, pickPlace, seoulDate, shareText } from "./geo.js";
import { locate } from "./locate.js";
import { ensureMap, onMapPick, showPlace } from "./map-view.js";

const app = document.getElementById("app");
const ICONS = {
  overall: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M12 7v6l3 2"></path></svg>`,
  money: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M12 8v8M9.5 10.5c.6-1 4.4-1 5 1s-4.4 2-5 3 4.4 2 5 1"></path></svg>`,
  love: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 18s-6-3.6-6-8a3.4 3.4 0 0 1 6-2 3.4 3.4 0 0 1 6 2c0 4.4-6 8-6 8z"></path></svg>`,
  health: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"></path></svg>`,
  work: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16v8H4zM9 10V7h6v3"></path></svg>`,
  people: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="2.2"></circle><circle cx="15" cy="10" r="2"></circle><path d="M5 17c.6-2 2.4-3 4-3s3.4 1 4 3M13 17c.4-1.4 1.6-2.2 3-2.2 1.2 0 2.2.6 2.8 1.8"></path></svg>`,
};

let result = null;

mount();

function mount() {
  lockPlay(true);
  app.replaceChildren(
    el("p", { className: "eyebrow", text: "오늘 · 이 동네" }),
    el("h1", { text: "오늘의 위치 운세" }),
    el("p", { className: "fun-disclaimer", text: "재미용입니다. 위치는 이 화면에서만 쓰고 저장하지 않습니다." }),
    el("div", { className: "fortune-actions" }, [
      button("내 위치 확인", "primary", () => askGps()),
      button("다시 위치 확인", "", () => askGps()),
      button("지도에서 고르기", "", () => focusMap()),
      button("아무 동네로 보기", "", () => showRandom()),
    ]),
    el("div", { id: "fortune" }),
    el("div", { id: "map", className: "map-frame" }),
    el("p", { className: "muted map-credit", text: "지도를 누르면 그 동네의 오늘 운세가 나옵니다. 지도 © OpenStreetMap 기여자" }),
    el("p", { className: "note", id: "note" }),
    el("p", {}, [el("a", { href: "/games", text: "게임 목록" })]),
  );
  const opened = ensureMap(document.getElementById("map"));
  onMapPick(document.getElementById("map"), (lat, lng) => showResult({ lat, lng }, "map"));
  if (!opened.ok) setNote(opened.error);
  askGps();
}

function askGps() {
  if (!window.isSecureContext || !navigator.geolocation) {
    focusMap();
    setNote("위치를 받을 수 없습니다. 지도를 누르거나 아무 동네로 보세요.");
    return;
  }
  setNote("이 근처를 확인하는 중");
  locate(navigator.geolocation).then(
    (position) => showResult({ lat: position.coords.latitude, lng: position.coords.longitude }, "gps"),
    (error) => {
      focusMap();
      setNote(error.message);
    },
  );
}

function showRandom() {
  const place = pickPlace();
  showResult(place, "random");
}

function showResult(point, mode) {
  result = mode === "random"
    ? fortuneFor(point.lat, point.lng, seoulDate(), point)
    : fortuneFor(point.lat, point.lng, seoulDate());
  const headline = mode === "random"
    ? `오늘은 ${result.placeLabel}의 운세`
    : `오늘은 ${result.placeLabel} 근처의 운세`;
  const box = document.getElementById("fortune");
  const hero = el("article", { className: "fortune-hero fortune-reveal" });
  hero.append(
    el("p", { className: "fun-badge", text: "재미용" }),
    gauge(result.score),
    el("p", { className: "fortune-kicker", text: `${result.date} · 총운` }),
    el("h2", { text: headline }),
    el("p", { className: "fortune-summary", text: result.summary }),
  );
  const grid = el("div", { className: "fortune-grid" });
  [
    ["총운", "overall", result.overall, result.stars.overall],
    ["금전운", "money", result.money, result.stars.money],
    ["연애운", "love", result.love, result.stars.love],
    ["건강운", "health", result.health, result.stars.health],
    ["직장·학업운", "work", result.work, result.stars.work],
    ["대인관계", "people", result.people, result.stars.people],
  ].forEach((item, index) => grid.append(categoryCard(item, index)));
  const chips = el("div", { className: "luck-row" });
  chips.append(
    chip(compassMini(result.direction), `${result.direction.label}쪽`),
    chip(swatch(result.color.hex), result.color.name),
    chip(null, `숫자 ${result.number}`),
    chip(null, `${result.time.label} ${result.time.range}`),
  );
  const mission = el("article", { className: "mission-card fortune-reveal" });
  mission.append(el("p", { className: "eyebrow", text: "오늘의 미션" }), el("p", { text: result.mission }));
  const caution = el("article", { className: "caution-card fortune-reveal" });
  caution.append(el("h3", { text: "조심할 것" }), ...result.caution.map((line) => el("p", { text: line })));
  const word = el("blockquote", { className: "one-word fortune-reveal", text: result.word });
  box.replaceChildren(hero, grid, chips, mission, caution, word, el("div", { className: "fortune-actions" }, [
    button("운세 공유", "primary", share),
  ]));
  const mapNote = showPlace(document.getElementById("map"), result.place, result.placeLabel);
  if (!mapNote.ok) setNote(mapNote.error);
  else setNote(mode === "random" ? `${headline}입니다.` : "");
}

function focusMap() {
  const element = document.getElementById("map");
  const opened = ensureMap(element);
  onMapPick(element, (lat, lng) => showResult({ lat, lng }, "map"));
  element?.scrollIntoView({ block: "center" });
  if (!opened.ok) setNote(opened.error);
  else setNote("지도의 원하는 곳을 한 번 눌러 주세요.");
}

function categoryCard([title, key, lines, score], index) {
  const card = el("article", { className: "fortune-card fortune-reveal" });
  card.style.animationDelay = `${index * 50}ms`;
  const head = el("header", {});
  const icon = el("span", { className: "fortune-icon" });
  icon.innerHTML = ICONS[key];
  head.append(icon, el("h3", { text: title }), el("span", { className: "stars", text: starText(score) }));
  const bar = el("div", { className: "meter" });
  const fill = el("span");
  fill.style.width = `${score * 20}%`;
  bar.append(fill);
  card.append(head, bar, ...lines.map((line) => el("p", { text: line })));
  return card;
}

function gauge(score) {
  const radius = 54;
  const turn = 2 * Math.PI * radius;
  const node = el("div", { className: "gauge" });
  node.innerHTML = `<svg viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r="54" class="gauge-track"></circle><circle cx="70" cy="70" r="54" class="gauge-value" style="stroke-dasharray:${turn};stroke-dashoffset:${turn * (1 - score / 100)}"></circle></svg>`;
  node.append(el("strong", { text: String(score) }));
  return node;
}

function compassMini(direction) {
  const node = el("i", { className: "mini-compass" });
  node.style.setProperty("--deg", `${direction.bearing}deg`);
  node.append(el("b"));
  return node;
}

function swatch(hex) {
  const node = el("i", { className: "swatch-dot" });
  node.style.background = hex;
  return node;
}

function chip(mark, text) {
  const node = el("span", { className: "luck-chip" });
  if (mark) node.append(mark);
  node.append(document.createTextNode(text));
  return node;
}

function starText(count) {
  return `${"★".repeat(count)}${"☆".repeat(5 - count)}`;
}

async function share() {
  if (!result) return;
  const text = shareSafe(result);
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
    setNote("공유 창을 열지 못했습니다. 글을 길게 눌러 복사해 주세요.");
  }
}

function shareSafe(value) {
  return shareText(value, `${location.origin}/games/fortune`);
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
