export const COMMENT_COOLDOWN_MS = 1500;
export const COMMENT_LIST_CAP = 50;
export const COMMENT_STORE_CAP = 100;
export const BOARD_PASSWORD = "2002";
const PASSWORD_ROUNDS = 20_000;

export function commentsToImport(current, legacy) {
  if (Array.isArray(current) && current.length) return [];
  if (!Array.isArray(legacy)) return [];
  return legacy.filter((row) => row && typeof row.id === "string" && row.id && typeof row.body === "string");
}

export function cleanComment(input) {
  const name = String(input?.name ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 20) || "익명";
  const text = String(input?.text ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 500);
  const password = String(input?.password ?? "");
  if (!text) return { ok: false, error: "내용을 입력해 주세요." };
  if (password.length < 4 || password.length > 20) return { ok: false, error: "비밀번호는 4자에서 20자로 적어 주세요." };
  return { ok: true, name, text, password };
}

export async function hashCommentPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toHex(salt), hash: toHex(await derive(password, salt)) };
}

export async function passwordMatches(password, saltHex, hashHex) {
  if (!saltHex || !hashHex) return sameText(String(password || ""), BOARD_PASSWORD);
  const next = toHex(await derive(password, fromHex(saltHex)));
  return sameText(next, hashHex);
}

async function derive(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(password)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PASSWORD_ROUNDS, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function toHex(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function sameText(left, right) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length, 1);
  for (let index = 0; index < length; index += 1) diff |= (a[index] || 0) ^ (b[index] || 0);
  return diff === 0;
}

export function relativeTime(createdAt, now = Date.now()) {
  const diff = Math.max(0, now - Number(createdAt));
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
  }).format(new Date(createdAt));
}
