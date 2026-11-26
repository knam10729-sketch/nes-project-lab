import { NEIGHBORHOODS, placeLabel } from "./neighborhoods.js";
import {
  ADVICES,
  AFTERNOONS,
  CAUTIONS,
  EVENINGS,
  HEALTH,
  LOVE,
  MISSIONS,
  MONEY,
  MORNINGS,
  OPENINGS,
  PEOPLE,
  SUMMARIES,
  TEXT_POOLS,
  WORDS,
  WORK,
} from "./fortune-text.js";

const EARTH_M = 6_371_000;
const LAT_M = 111_320;
const DISTANCES = [120, 180, 240, 300, 360, 420];

export const DIRECTIONS = [
  { id: "n", label: "북", bearing: 0 },
  { id: "ne", label: "북동", bearing: 45 },
  { id: "e", label: "동", bearing: 90 },
  { id: "se", label: "남동", bearing: 135 },
  { id: "s", label: "남", bearing: 180 },
  { id: "sw", label: "남서", bearing: 225 },
  { id: "w", label: "서", bearing: 270 },
  { id: "nw", label: "북서", bearing: 315 },
];

export const COLORS = [
  ["빨강", "#e23b3b"], ["주황", "#f08a24"], ["노랑", "#f2c14e"], ["연두", "#8fce4a"],
  ["초록", "#2f9e44"], ["청록", "#1aa6a6"], ["하늘", "#4dabf7"], ["파랑", "#3b6fe0"],
  ["남색", "#364fc7"], ["보라", "#7950f2"], ["자주", "#c2255c"], ["분홍", "#f783ac"],
  ["살구", "#ffc9a9"], ["베이지", "#e6d3b3"], ["아이보리", "#f6f1e7"], ["하얀색", "#f8f9fa"],
  ["회색", "#868e96"], ["먹색", "#212529"], ["금색", "#e0b84a"], ["은색", "#ced4da"],
  ["민트", "#63e6be"], ["라벤더", "#b197fc"], ["코랄", "#ff8787"], ["카키", "#a69b4c"],
  ["와인", "#9b2242"], ["바다색", "#1864ab"], ["잔디", "#2b8a3e"], ["귤색", "#fd7e14"],
  ["자두", "#ae3ec9"], ["모래", "#d8c3a5"], ["밤색", "#6f4e37"], ["산호", "#ff6b6b"],
];

export const TIMES = [
  { id: "dawn", label: "새벽", range: "5–7시" },
  { id: "morning", label: "아침", range: "7–9시" },
  { id: "forenoon", label: "오전", range: "9–12시" },
  { id: "noon", label: "점심", range: "12–14시" },
  { id: "afternoon", label: "오후", range: "14–17시" },
  { id: "evening", label: "저녁", range: "17–20시" },
  { id: "night", label: "밤", range: "20–23시" },
  { id: "late", label: "늦은 밤", range: "23–1시" },
];

export const POOLS = { ...TEXT_POOLS, color: COLORS };
export { NEIGHBORHOODS, placeLabel };

export function sphericalMidpoint(points) {
  if (!Array.isArray(points) || !points.length) return null;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const point of points) {
    const lat = radians(point.lat);
    const lng = radians(point.lng);
    const cosLat = Math.cos(lat);
    x += cosLat * Math.cos(lng);
    y += cosLat * Math.sin(lng);
    z += Math.sin(lat);
  }
  const count = points.length;
  x /= count;
  y /= count;
  z /= count;
  return {
    lat: degrees(Math.atan2(z, Math.hypot(x, y))),
    lng: degrees(Math.atan2(y, x)),
  };
}

export function distanceMeters(from, to) {
  const lat1 = radians(from.lat);
  const lat2 = radians(to.lat);
  const dLat = lat2 - lat1;
  const dLng = radians(to.lng - from.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatMeters(meters) {
  const value = Math.max(0, Number(meters) || 0);
  if (value < 1000) return `${Math.round(value)}m`;
  const digits = value < 10_000 ? 1 : 0;
  return `${(value / 1000).toFixed(digits)}km`;
}

export function gridCell(lat, lng) {
  const latCell = Math.round((Number(lat) * LAT_M) / 100);
  const latCenter = (latCell * 100) / LAT_M;
  const lngMeters = Math.max(20_000, LAT_M * Math.cos(radians(latCenter)));
  const lngCell = Math.round((Number(lng) * lngMeters) / 100);
  return { latCell, lngCell };
}

export function nearestPlace(lat, lng) {
  let best = NEIGHBORHOODS[0];
  let bestDistance = Infinity;
  for (const place of NEIGHBORHOODS) {
    const distance = distanceMeters({ lat, lng }, place);
    if (distance < bestDistance) {
      best = place;
      bestDistance = distance;
    }
  }
  return best;
}

export function pickPlace(random = Math.random) {
  return NEIGHBORHOODS[Math.floor(random() * NEIGHBORHOODS.length)];
}

export function seoulDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function fortuneFor(lat, lng, date = seoulDate(), place = nearestPlace(lat, lng)) {
  const random = mulberry32(fnv1a(`${date}|${place.id}`));
  const direction = DIRECTIONS[Math.floor(random() * DIRECTIONS.length)];
  const colorPair = COLORS[Math.floor(random() * COLORS.length)];
  const time = TIMES[Math.floor(random() * TIMES.length)];
  const number = 1 + Math.floor(random() * 45);
  const score = 58 + Math.floor(random() * 42);
  const summary = pick(SUMMARIES, random);
  const overall = [
    pick(OPENINGS, random),
    pick(MORNINGS, random),
    pick(AFTERNOONS, random),
    pick(EVENINGS, random),
    pick(ADVICES, random),
  ];
  if (random() < 0.4) overall.pop();
  const money = take(MONEY, random() < 0.45 ? 2 : 3, random);
  const love = take(LOVE, random() < 0.45 ? 2 : 3, random);
  const health = take(HEALTH, random() < 0.45 ? 2 : 3, random);
  const work = take(WORK, random() < 0.45 ? 2 : 3, random);
  const people = take(PEOPLE, random() < 0.45 ? 2 : 3, random);
  const caution = take(CAUTIONS, 2, random);
  const word = pick(WORDS, random);
  const mission = pick(MISSIONS, random)
    .replaceAll("{dir}", direction.label)
    .replaceAll("{m}", String(DISTANCES[Math.floor(random() * DISTANCES.length)]));
  return {
    date,
    place,
    placeLabel: placeLabel(place),
    score,
    summary,
    overall,
    money,
    love,
    health,
    work,
    people,
    caution,
    word,
    direction,
    color: { name: colorPair[0], hex: colorPair[1] },
    number,
    time,
    mission,
    stars: {
      overall: clampStar(3 + Math.floor((score - 58) / 21)),
      money: 1 + Math.floor(random() * 5),
      love: 1 + Math.floor(random() * 5),
      health: 1 + Math.floor(random() * 5),
      work: 1 + Math.floor(random() * 5),
      people: 1 + Math.floor(random() * 5),
    },
  };
}

export function shareText(result, pageUrl = "") {
  const lines = [
    "오늘의 위치 운세 · 재미용",
    `오늘은 ${result.placeLabel}의 운세`,
    `총운 ${result.score}점. ${result.summary}`,
    result.overall[0],
    `금전: ${result.money[0]}`,
    `연애: ${result.love[0]}`,
    `건강: ${result.health[0]}`,
    `직장·학업: ${result.work[0]}`,
    `대인관계: ${result.people[0]}`,
    `조심할 것: ${result.caution[0]}`,
    `한마디: ${result.word}`,
    `행운: ${result.direction.label}쪽, ${result.color.name}, ${result.number}, ${result.time.label} ${result.time.range}`,
    `미션: ${result.mission}`,
  ];
  if (pageUrl) lines.push(String(pageUrl).split("?")[0].split("#")[0]);
  return lines.join("\n");
}

export function sanitizePin(input) {
  const lat = Number(input?.lat);
  const lng = Number(input?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    source: input?.source === "map" ? "map" : "gps",
  };
}

export function placeLinks(lat, lng) {
  const latitude = Number(lat).toFixed(6);
  const longitude = Number(lng).toFixed(6);
  return {
    kakao: `https://map.kakao.com/link/map/${encodeURIComponent("중간지점")},${latitude},${longitude}`,
    naver: `https://map.naver.com/p?c=${longitude},${latitude},16,0,0,0,dh`,
    search: `https://map.kakao.com/link/search/${encodeURIComponent("카페 맛집")}`,
  };
}

export function attachMeet(view, pins) {
  if (!view || view.game !== "meet") return view;
  const bySeat = pins instanceof Map
    ? pins
    : new Map(Object.entries(pins || {}).map(([seat, pin]) => [Number(seat), pin]));
  const people = view.seats.map((seat, index) => {
    const pin = sanitizePin(bySeat.get(index));
    return {
      seat: index,
      name: seat.name,
      lat: pin ? pin.lat : null,
      lng: pin ? pin.lng : null,
      source: pin ? pin.source : null,
    };
  });
  const placed = people.filter((person) => person.lat != null);
  const midpoint = placed.length >= 2 ? roundPoint(sphericalMidpoint(placed)) : null;
  return {
    ...view,
    meet: {
      people: people.map((person) => ({
        ...person,
        meters: midpoint && person.lat != null ? Math.round(distanceMeters(person, midpoint)) : null,
      })),
      midpoint,
    },
  };
}

function roundPoint(point) {
  if (!point) return null;
  return {
    lat: Math.round(point.lat * 1e6) / 1e6,
    lng: Math.round(point.lng * 1e6) / 1e6,
  };
}

function pick(list, random) {
  return list[Math.floor(random() * list.length)];
}

function take(list, count, random) {
  const copy = list.slice();
  const chosen = [];
  for (let index = 0; index < count && copy.length; index += 1) {
    chosen.push(copy.splice(Math.floor(random() * copy.length), 1)[0]);
  }
  return chosen;
}

function clampStar(value) {
  return Math.max(1, Math.min(5, value));
}

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function radians(degreesValue) {
  return (Number(degreesValue) * Math.PI) / 180;
}

function degrees(radiansValue) {
  return (radiansValue * 180) / Math.PI;
}
