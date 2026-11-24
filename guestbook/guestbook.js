const PAGE = 10;
const write = document.getElementById("write");
const note = document.getElementById("write-note");
const textEl = document.getElementById("guest-text");
const nameEl = document.getElementById("guest-name");
const privEl = document.getElementById("guest-private");
const lenEl = document.getElementById("gb-len");
const submitEl = document.getElementById("gb-submit");
const list = document.getElementById("entries");
const countEl = document.getElementById("gb-count");
const moreEl = document.getElementById("gb-more");
const adminBox = document.getElementById("gb-admin");
const adminToggle = document.getElementById("admin-toggle");
const adminForm = document.getElementById("admin");
const adminNote = document.getElementById("admin-note");

let entries = [];
let isAdmin = false;
let shown = PAGE;
let freshId = "";

try { nameEl.value = localStorage.getItem("nes-guest-name") || ""; } catch (_) {}
if (new URLSearchParams(location.search).get("admin") === "0") openAdmin("비밀번호가 틀렸어요");

const updateLen = () => { lenEl.textContent = `${textEl.value.length} / 300`; };
textEl.addEventListener("input", updateLen);
textEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) write.requestSubmit();
});

write.addEventListener("submit", async (event) => {
  event.preventDefault();
  // The server strips line breaks, so turn them into spaces instead of gluing words together.
  const text = textEl.value.replace(/\s*\n+\s*/g, " ").trim();
  if (!text) { note.textContent = "내용을 입력해 주세요."; textEl.focus(); return; }
  submitEl.disabled = true;
  note.textContent = "등록하는 중…";
  try {
    const response = await fetch("/guestbook/api/entries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: nameEl.value, text, private: privEl.checked }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { note.textContent = data.error || "등록하지 못했어요. 잠시 후 다시 시도해 주세요."; return; }
    try { localStorage.setItem("nes-guest-name", nameEl.value.trim()); } catch (_) {}
    textEl.value = "";
    privEl.checked = false;
    updateLen();
    note.textContent = data.private ? "비밀글로 등록했어요." : "등록했어요.";
    freshId = data.id || "";
    await load();
  } catch (_) {
    note.textContent = "연결이 불안정해요. 잠시 후 다시 시도해 주세요.";
  } finally {
    submitEl.disabled = false;
  }
});

adminToggle.addEventListener("click", () => {
  if (adminForm.hidden) openAdmin(""); else closeAdmin();
});

function openAdmin(message) {
  adminForm.hidden = false;
  adminToggle.setAttribute("aria-expanded", "true");
  adminNote.textContent = message;
  document.getElementById("admin-pass").focus();
}
function closeAdmin() {
  adminForm.hidden = true;
  adminToggle.setAttribute("aria-expanded", "false");
  adminNote.textContent = "";
}

adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminNote.textContent = "확인하는 중…";
  const response = await fetch("/guestbook/unlock", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password: document.getElementById("admin-pass").value }),
  }).catch(() => null);
  if (!response || !response.ok) { adminNote.textContent = "비밀번호가 틀렸어요"; return; }
  location.replace("/guestbook");
});

moreEl.addEventListener("click", () => { shown += PAGE; render(); });

async function load() {
  try {
    const response = await fetch("/guestbook/api/entries", { cache: "no-store" });
    const data = await response.json().catch(() => ({ entries: [] }));
    entries = (data.entries || []).slice().sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    isAdmin = Boolean(data.admin);
  } catch (_) {
    entries = [];
  }
  render();
  renderAdmin();
}

function render() {
  countEl.innerHTML = "";
  countEl.append("전체 ", Object.assign(document.createElement("b"), { textContent: String(entries.length) }), "개");
  list.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("li");
    empty.className = "gb-empty";
    empty.textContent = "아직 방명록이 없어요. 첫 글을 남겨 주세요!";
    list.append(empty);
  }
  for (const entry of entries.slice(0, shown)) list.append(item(entry));
  moreEl.hidden = entries.length <= shown;
  moreEl.textContent = `더보기 (${entries.length - Math.min(shown, entries.length)})`;
  freshId = "";
}

function item(entry) {
  const li = document.createElement("li");
  li.className = "gb-item" + (entry.id && entry.id === freshId ? " is-new" : "");
  const name = entry.name || "익명";
  const avatar = document.createElement("span");
  avatar.className = "gb-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = Array.from(name)[0] || "?";
  const main = document.createElement("div");
  main.className = "gb-main";
  const meta = document.createElement("div");
  meta.className = "gb-meta";
  const who = document.createElement("strong");
  who.className = "gb-name";
  who.textContent = name;
  const when = document.createElement("time");
  when.className = "gb-date";
  if (entry.createdAt) {
    const d = new Date(Number(entry.createdAt));
    when.dateTime = d.toISOString();
    when.textContent = formatDate(d);
  }
  meta.append(who, when);
  if (entry.private) {
    const lock = document.createElement("span");
    lock.className = "gb-lock";
    lock.textContent = "🔒 비밀글";
    meta.append(lock);
  }
  if (isAdmin && entry.id) {
    const del = document.createElement("button");
    del.type = "button";
    del.className = "gb-del";
    del.textContent = "삭제";
    del.addEventListener("click", async () => {
      if (!confirm(`'${name}'님의 글을 삭제할까요?`)) return;
      const response = await fetch(`/guestbook/api/entries/${encodeURIComponent(entry.id)}`, { method: "DELETE" });
      if (response.ok) await load();
    });
    meta.append(del);
  }
  const body = document.createElement("p");
  const secret = entry.private && entry.text == null;
  body.className = "gb-text" + (secret ? " is-secret" : "");
  body.textContent = secret ? "비밀글입니다." : (entry.text || "");
  main.append(meta, body);
  li.append(avatar, main);
  return li;
}

function formatDate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}. ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function renderAdmin() {
  if (!isAdmin) return;
  adminToggle.hidden = true;
  adminForm.hidden = true;
  adminNote.textContent = "";
  let on = document.getElementById("admin-on");
  if (on) return;
  on = document.createElement("form");
  on.id = "admin-on";
  on.className = "gb-admin-on";
  on.method = "post";
  on.action = "/guestbook/lock";
  const label = document.createElement("span");
  label.innerHTML = "<b>관리자 모드</b>";
  const out = document.createElement("button");
  out.type = "submit";
  out.className = "gb-admin-link";
  out.textContent = "로그아웃";
  on.append(label, out);
  adminBox.prepend(on);
}

updateLen();
load();
