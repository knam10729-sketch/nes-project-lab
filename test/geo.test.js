import assert from "node:assert/strict";
import test from "node:test";
import { applyAction, createRoom, joinRoom, present } from "../src/room-logic.js";
import handler from "../src/worker.js";
import {
  attachMeet,
  DIRECTIONS,
  distanceMeters,
  fortuneFor,
  gridCell,
  NEIGHBORHOODS,
  nearestPlace,
  placeLinks,
  POOLS,
  sanitizePin,
  seoulDate,
  shareText,
  sphericalMidpoint,
} from "../games/geo.js";

const TOKEN = "a".repeat(32);
const TOKEN_B = "b".repeat(32);

test("spherical midpoint stays between places and across the date line", () => {
  const seoul = { lat: 37.5665, lng: 126.978 };
  const busan = { lat: 35.1796, lng: 129.0756 };
  const mid = sphericalMidpoint([seoul, busan]);
  assert.ok(mid.lat < seoul.lat && mid.lat > busan.lat);
  assert.ok(mid.lng > seoul.lng && mid.lng < busan.lng);
  const same = sphericalMidpoint([seoul, seoul]);
  assert.ok(Math.abs(same.lat - seoul.lat) < 1e-6);
  assert.ok(Math.abs(same.lng - seoul.lng) < 1e-6);
  const wrapped = sphericalMidpoint([{ lat: 10, lng: 179 }, { lat: 10, lng: -179 }]);
  assert.ok(Math.abs(wrapped.lat - 10) < 0.2);
  const east = wrapped.lng < 0 ? wrapped.lng + 360 : wrapped.lng;
  assert.ok(Math.abs(east - 180) < 1);
  assert.equal(sphericalMidpoint([]), null);
  assert.ok(distanceMeters(seoul, seoul) < 1);
  const oneDegree = distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
  assert.ok(oneDegree > 110_000 && oneDegree < 112_000);
});

test("the same neighborhood and Seoul date always give the same fortune", () => {
  for (const list of Object.values(POOLS)) assert.ok(list.length >= 30);
  assert.equal(DIRECTIONS.length, 8);
  const day = "2026-11-10";
  const cell = gridCell(37.51, 127.02);
  const centerLat = (cell.latCell * 100) / 111_320;
  const here = fortuneFor(centerLat, 127.02, day);
  const nearby = fortuneFor(centerLat + 10 / 111_320, 127.02, day);
  assert.deepEqual(gridCell(centerLat, 127.02), gridCell(centerLat + 10 / 111_320, 127.02));
  assert.deepEqual(here, nearby);
  assert.equal(here.date, day);
  assert.ok(here.score >= 58 && here.score <= 99);
  assert.ok(here.overall.length >= 3 && here.overall.length <= 5);
  assert.ok(here.money.length >= 2 && here.money.length <= 3);
  assert.ok(here.placeLabel.includes(here.place.name));
  assert.notDeepEqual(here, fortuneFor(centerLat, 127.02, "2026-11-11"));
  assert.notEqual(gridCell(37.5, 127).latCell, gridCell(37.503, 127).latCell);
  assert.equal(seoulDate(new Date("2026-11-10T02:00:00Z")), "2026-11-10");
  assert.equal(seoulDate(new Date("2026-11-10T15:30:00Z")), "2026-11-11");
  const shared = shareText(here, "https://jeonghan.kr/games/fortune?lat=37.510000&lng=127.020000");
  assert.match(shared, /재미용/);
  assert.equal(shared.includes("37.51"), false);
  assert.equal(shared.includes("lat="), false);
  assert.match(shared, /https:\/\/jeonghan\.kr\/games\/fortune$/);
  assert.match(shared, new RegExp(here.placeLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(NEIGHBORHOODS.length >= 100);
  const yeonnam = nearestPlace(37.5624, 126.9253);
  assert.equal(yeonnam.name, "연남동");
  assert.equal(yeonnam.city, "서울");
  const haeundae = nearestPlace(35.1632, 129.1634);
  assert.equal(haeundae.city, "부산");
  assert.equal(haeundae.name, "우동");
  const cities = new Set(NEIGHBORHOODS.map((place) => place.city));
  for (const city of ["서울", "경기", "부산", "대구", "인천", "광주", "대전", "제주"]) assert.ok(cities.has(city));
  const chosen = NEIGHBORHOODS.find((place) => place.name === "연남동");
  const fixed = fortuneFor(chosen.lat, chosen.lng, day, chosen);
  assert.equal(fixed.place.name, "연남동");
  assert.match(fixed.placeLabel, /서울 마포구 연남동/);
});

test("meeting pins stay out of the saved room and links use public map urls", () => {
  const created = createRoom({ game: "meet", roomId: "abc23def", name: "네스", token: TOKEN });
  assert.equal(created.ok, true);
  let room = created.room;
  assert.equal(room.maxSeats, 10);
  assert.deepEqual(room.data, { kind: "meet" });
  room = joinRoom(room, { name: "친구", newToken: TOKEN_B }).room;
  const rejected = applyAction(room, 0, { type: "pin", lat: 37.5, lng: 127.1 });
  assert.equal(rejected.ok, false);
  assert.equal(JSON.stringify(rejected.room).includes("37.5"), false);
  const view = attachMeet(present(room), new Map([
    [0, { lat: 37.5, lng: 127, source: "gps", note: "비밀" }],
    [1, { lat: 37.6, lng: 127.2, source: "map" }],
  ]));
  assert.equal(view.meet.people[0].source, "gps");
  assert.equal(view.meet.people[0].note, undefined);
  assert.ok(view.meet.midpoint);
  assert.ok(view.meet.people[0].meters >= 0);
  assert.equal(JSON.stringify(room).includes("37.5"), false);
  const links = placeLinks(view.meet.midpoint.lat, view.meet.midpoint.lng);
  assert.match(links.kakao, /^https:\/\/map\.kakao\.com\/link\/map\//);
  assert.ok(links.kakao.endsWith(`,${view.meet.midpoint.lat.toFixed(6)},${view.meet.midpoint.lng.toFixed(6)}`));
  assert.match(links.naver, new RegExp(`c=${view.meet.midpoint.lng.toFixed(6)},${view.meet.midpoint.lat.toFixed(6)},16`));
  assert.match(links.search, /^https:\/\/map\.kakao\.com\/link\/search\//);
  assert.equal(sanitizePin({ lat: 91, lng: 10 }), null);
  assert.equal(sanitizePin({ lat: "서울", lng: 10 }), null);
});

test("meet and fortune pages are on the games menu routes", async () => {
  const seen = [];
  const env = {
    ASSETS: {
      async fetch(request) {
        seen.push(new URL(request.url).pathname);
        return new Response("asset:" + new URL(request.url).pathname);
      },
    },
  };
  const fortune = await handler.fetch(new Request("https://jeonghan.kr/games/fortune"), env);
  const meet = await handler.fetch(new Request("https://jeonghan.kr/games/meet/abc23def"), env);
  assert.equal(await fortune.text(), "asset:/games/fortune.html");
  assert.equal(await meet.text(), "asset:/games/meet.html");
  assert.deepEqual(seen, ["/games/fortune.html", "/games/meet.html"]);
});
