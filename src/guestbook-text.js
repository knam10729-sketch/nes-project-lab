export const GUEST_NAME_MAX = 20;
export const GUEST_TEXT_MAX = 300;
export const GUEST_COOLDOWN_MS = 8_000;
export const GUEST_LIST_CAP = 50;
export const GUEST_STORE_CAP = 100;

export function cleanGuest(input) {
  const name = String(input?.name ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, GUEST_NAME_MAX) || "익명";
  const text = String(input?.text ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, GUEST_TEXT_MAX);
  if (!text) return { ok: false, error: "내용을 입력해 주세요." };
  return { ok: true, name, text, private: input?.private === true };
}

export function presentEntry(row, admin) {
  const isPrivate = Boolean(Number(row.private));
  return {
    id: row.id,
    name: row.name,
    private: isPrivate,
    text: admin || !isPrivate ? row.body : null,
    createdAt: row.created_at,
  };
}
