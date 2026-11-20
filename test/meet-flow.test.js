import assert from "node:assert/strict";
import test from "node:test";
import { attachMeet } from "../games/geo.js";
import { locate } from "../games/locate.js";
import { handleMeetAction } from "../games/meet-pins.js";
import { createRoom, joinRoom, present } from "../src/room-logic.js";

const TOKEN = "c".repeat(32);
const TOKEN_B = "d".repeat(32);

test("a shared position reaches every seat without being stored on the room", () => {
  let room = createRoom({ game: "meet", roomId: "meet2345", name: "네스", token: TOKEN }).room;
  room = joinRoom(room, { name: "친구", newToken: TOKEN_B }).room;
  let pins = new Map();
  const first = handleMeetAction(pins, room, 0, { type: "pin", lat: 37.5665, lng: 126.978, source: "gps" });
  assert.equal(first.ok, true);
  pins = first.pins;
  const second = handleMeetAction(pins, room, 1, { type: "pin", lat: 35.1796, lng: 129.0756, source: "gps" });
  assert.equal(second.ok, true);
  const view = attachMeet(present(room), second.pins);
  assert.equal(view.meet.people[0].name, "네스");
  assert.equal(view.meet.people[0].lat, 37.5665);
  assert.equal(view.meet.people[1].name, "친구");
  assert.ok(view.meet.midpoint);
  assert.ok(view.meet.people[0].meters > 100_000);
  assert.equal(JSON.stringify(room).includes("37.5665"), false);
  const stranger = handleMeetAction(second.pins, room, 4, { type: "pin", lat: 37, lng: 127 });
  assert.equal(stranger.ok, false);
  const cleared = handleMeetAction(second.pins, room, 0, { type: "clearPin" });
  assert.equal(cleared.pins.has(0), false);
  assert.equal(cleared.pins.has(1), true);
});

test("location lookup retries in low accuracy and explains a denial", async () => {
  let calls = 0;
  const flaky = {
    getCurrentPosition(success, error, options) {
      calls += 1;
      if (options.enableHighAccuracy) error({ code: 3 });
      else success({ coords: { latitude: 37.5624, longitude: 126.9253 } });
    },
  };
  const position = await locate(flaky);
  assert.equal(calls, 2);
  assert.equal(position.coords.latitude, 37.5624);

  const denied = {
    getCurrentPosition(_success, error) { error({ code: 1 }); },
  };
  await assert.rejects(locate(denied), /사이트 설정/);

  const silent = { getCurrentPosition() {} };
  await assert.rejects(
    locate(silent, { attempts: [{ enableHighAccuracy: true, timeout: 20, maximumAge: 0 }] }),
    /제때 받지 못했습니다/,
  );
});

test("websocket pins travel through the live game room", async () => {
  const { unstable_dev } = await import("wrangler");
  const worker = await unstable_dev("src/index.js", {
    config: "wrangler.games.jsonc",
    experimental: { disableExperimentalWarning: true },
    ip: "127.0.0.1",
  });
  try {
    const created = await post(worker, "/play-api/rooms", { game: "meet", name: "네스" });
    const roomId = created.roomId;
    const guest = await post(worker, `/play-api/rooms/${roomId}/join`, { name: "친구" });
    const hostSocket = await openSocket(worker.port, roomId, created.token);
    const guestSocket = await openSocket(worker.port, roomId, guest.token);
    const hostStates = collectStates(hostSocket);
    const guestStates = collectStates(guestSocket);
    hostSocket.send(JSON.stringify({ type: "pin", lat: 37.5665, lng: 126.978, source: "gps" }));
    guestSocket.send(JSON.stringify({ type: "pin", lat: 35.1796, lng: 129.0756, source: "gps" }));
    const hostView = await hostStates.waitFor((state) => state.meet?.people?.filter((person) => person.lat != null).length === 2);
    const guestView = await guestStates.waitFor((state) => state.meet?.midpoint);
    assert.equal(hostView.meet.people[0].name, "네스");
    assert.equal(guestView.meet.people[1].name, "친구");
    assert.ok(hostView.meet.midpoint.lat < 37.5665 && hostView.meet.midpoint.lat > 35.1796);
    assert.equal(JSON.stringify(hostView).includes(created.token), false);
    hostSocket.close();
    guestSocket.close();
  } finally {
    await worker.stop();
  }
});

async function post(worker, path, body) {
  const response = await worker.fetch(`http://127.0.0.1${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://127.0.0.1" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function openSocket(port, roomId, token) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/play-api/rooms/${roomId}/ws?token=${encodeURIComponent(token)}`);
    const timer = setTimeout(() => reject(new Error("소켓 연결 시간 초과")), 8000);
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("소켓 오류"));
    });
  });
}

function collectStates(socket) {
  const states = [];
  const waiters = [];
  const pump = () => {
    for (const waiter of waiters) {
      if (waiter.done) continue;
      const found = states.find(waiter.ready);
      if (!found) continue;
      waiter.done = true;
      clearTimeout(waiter.timer);
      waiter.resolve(found);
    }
  };
  socket.addEventListener("message", (event) => {
    const text = typeof event.data === "string" ? event.data : "";
    if (!text) return;
    const message = JSON.parse(text);
    if (message.type !== "state") return;
    states.push(message.state);
    pump();
  });
  return {
    waitFor(ready) {
      const found = states.find(ready);
      if (found) return Promise.resolve(found);
      return new Promise((resolve, reject) => {
        const waiter = { ready, resolve, done: false, timer: null };
        waiter.timer = setTimeout(() => reject(new Error("방 상태가 오지 않았습니다.")), 8000);
        waiters.push(waiter);
      });
    },
  };
}
