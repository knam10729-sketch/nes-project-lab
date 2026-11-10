import assert from "node:assert/strict";
import test from "node:test";
import jsQR from "jsqr";
import { encodeQr } from "../games/qr.js";

test("QR codes scan back to the original link", () => {
  for (const text of ["HELLO", "https://jeonghan.kr/games/gomoku/abcdefgh", "http://127.0.0.1:8787/games/chess/sd2n3wi"]) {
    assert.equal(scan(text), text);
  }
});

function scan(text) {
  const qr = encodeQr(text);
  const quiet = 4;
  const scale = 6;
  const cells = qr.size + quiet * 2;
  const size = cells * scale;
  const data = new Uint8ClampedArray(size * size * 4);
  data.fill(255);
  for (let y = 0; y < qr.size; y += 1) {
    for (let x = 0; x < qr.size; x += 1) {
      if (!qr.modules[y][x]) continue;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const pixel = ((y + quiet) * scale + dy) * size + ((x + quiet) * scale + dx);
          data[pixel * 4] = 0;
          data[pixel * 4 + 1] = 0;
          data[pixel * 4 + 2] = 0;
          data[pixel * 4 + 3] = 255;
        }
      }
    }
  }
  return jsQR(data, size, size)?.data;
}
