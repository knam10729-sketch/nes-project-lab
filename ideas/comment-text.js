export const COMMENT_COOLDOWN_MS = 1500;
export const COMMENT_LIST_CAP = 50;
export const COMMENT_STORE_CAP = 100;

export function cleanComment(input) {
  const name = String(input?.name ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 20) || "익명";
  const text = String(input?.text ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 500);
  if (!text) return { ok: false, error: "내용을 입력해 주세요." };
  return { ok: true, name, text };
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
