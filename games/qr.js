import qrcode from "./vendor/qrcode.js";

export function encodeQr(text) {
  const qr = qrcode(0, "M");
  qr.addData(String(text));
  qr.make();
  const size = qr.getModuleCount();
  const modules = [];
  for (let y = 0; y < size; y += 1) {
    const row = [];
    for (let x = 0; x < size; x += 1) row.push(qr.isDark(y, x));
    modules.push(row);
  }
  return { size, modules };
}

export function drawQr(canvas, text) {
  const qr = encodeQr(text);
  const quiet = 4;
  const cells = qr.size + quiet * 2;
  const scale = Math.max(3, Math.floor(Math.min(canvas.width, canvas.height) / cells));
  const drawn = cells * scale;
  const origin = Math.floor((Math.min(canvas.width, canvas.height) - drawn) / 2);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111111";
  for (let y = 0; y < qr.size; y += 1) {
    for (let x = 0; x < qr.size; x += 1) {
      if (!qr.modules[y][x]) continue;
      ctx.fillRect(origin + (x + quiet) * scale, origin + (y + quiet) * scale, scale, scale);
    }
  }
  return qr;
}
