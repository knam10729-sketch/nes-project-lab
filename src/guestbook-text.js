export const GUEST_NAME_MAX = 20;
export const GUEST_TEXT_MAX = 300;
export const GUEST_COOLDOWN_MS = 8_000;
export const GUEST_LIST_CAP = 50;
export const GUEST_STORE_CAP = 100;
export const GUEST_PASS_MIN = 4;
export const GUEST_PASS_MAX = 20;
export const GUEST_COMMENT_MAX = 200;
export const GUEST_COMMENT_CAP = 100;
export const GUEST_COMMENT_COOLDOWN_MS = 4_000;
// Wrong secret-post passwords: per visitor per entry, and per entry overall, inside one window.
export const REVEAL_MAX_FAILS = 5;
export const REVEAL_ENTRY_MAX_FAILS = 20;
export const REVEAL_WINDOW_MS = 15 * 60_000;

const clean = (value, max) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);

export function cleanGuest(input) {
  const name = clean(input?.name, GUEST_NAME_MAX) || "익명";
  const text = clean(input?.text, GUEST_TEXT_MAX);
  if (!text) return { ok: false, error: "내용을 입력해 주세요." };
  const isPrivate = input?.private === true;
  if (!isPrivate) return { ok: true, name, text, private: false, password: "" };
  const password = String(input?.password ?? "");
  if (password.length < GUEST_PASS_MIN || password.length > GUEST_PASS_MAX) {
    return { ok: false, error: `비밀글 비밀번호는 ${GUEST_PASS_MIN}자에서 ${GUEST_PASS_MAX}자로 적어 주세요.` };
  }
  return { ok: true, name, text, private: true, password };
}

export function cleanGuestComment(input) {
  const name = clean(input?.name, GUEST_NAME_MAX) || "익명";
  const text = clean(input?.text, GUEST_COMMENT_MAX);
  if (!text) return { ok: false, error: "댓글 내용을 입력해 주세요." };
  return { ok: true, name, text };
}

// visible: the reader may see this entry (admin, a public entry, or a correct password).
export function presentEntry(row, admin, revealed = false) {
  const isPrivate = Boolean(Number(row.private));
  const visible = admin || !isPrivate || revealed;
  return {
    id: row.id,
    name: row.name,
    private: isPrivate,
    text: visible ? row.body : null,
    createdAt: row.created_at,
    hasPassword: isPrivate && Boolean(row.pass_hash),
    commentCount: visible ? Number(row.comment_count || 0) : null,
  };
}

export function presentComment(row) {
  return { id: row.id, entryId: row.entry_id, name: row.name, text: row.body, createdAt: row.created_at };
}
