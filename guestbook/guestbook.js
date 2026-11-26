const PAGE = 10;
const API = "/guestbook/api/entries";
const write = document.getElementById("write");
const note = document.getElementById("write-note");
const textEl = document.getElementById("guest-text");
const nameEl = document.getElementById("guest-name");
const privEl = document.getElementById("guest-private");
const passEl = document.getElementById("guest-pass");
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
// Secret posts opened with their password in this tab: id -> { text, password }.
// The password stays in memory only so the writer can also read and add comments.
const revealed = new Map();
const comments = new Map(); // id -> comment list
const openThreads = new Set();
const openPrompts = new Set();

try { nameEl.value = localStorage.getItem("nes-guest-name") || ""; } catch (_) {}
if (new URLSearchParams(location.search).get("admin") === "0") openAdmin("비밀번호가 틀렸어요");

const updateLen = () => { lenEl.textContent = `${textEl.value.length} / 300`; };
textEl.addEventListener("input", updateLen);
textEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) write.requestSubmit();
});
privEl.addEventListener("change", () => {
  passEl.hidden = !privEl.checked;
  passEl.required = privEl.checked;
  if (privEl.checked) passEl.focus(); else passEl.value = "";
});

const flat = (value) => value.replace(/\s*\n+\s*/g, " ").trim();
async function send(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

write.addEventListener("submit", async (event) => {
  event.preventDefault();
  // The server strips line breaks, so turn them into spaces instead of gluing words together.
  const text = flat(textEl.value);
  if (!text) { note.textContent = "내용을 입력해 주세요."; textEl.focus(); return; }
  const isPrivate = privEl.checked;
  const password = passEl.value;
  if (isPrivate && (password.length < 4 || password.length > 20)) {
    note.textContent = "비밀글은 비밀번호(4~20자)를 정해 주세요. 나중에 내 글을 볼 때 필요해요.";
    passEl.focus();
    return;
  }
  submitEl.disabled = true;
  note.textContent = "등록하는 중…";
  try {
    const { ok, data } = await send(API, "POST", { name: nameEl.value, text, private: isPrivate, password: isPrivate ? password : undefined });
    if (!ok) { note.textContent = data.error || "등록하지 못했어요. 잠시 후 다시 시도해 주세요."; return; }
    try { localStorage.setItem("nes-guest-name", nameEl.value.trim()); } catch (_) {}
    if (isPrivate && data.id) revealed.set(data.id, { text, password });
    textEl.value = "";
    privEl.checked = false;
    passEl.value = "";
    passEl.hidden = true;
    passEl.required = false;
    updateLen();
    note.textContent = isPrivate ? "비밀글로 등록했어요. 나중에 '비밀번호로 보기'에서 같은 비밀번호로 볼 수 있어요." : "등록했어요.";
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
    const response = await fetch(API, { cache: "no-store" });
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
  countEl.replaceChildren("전체 ", Object.assign(document.createElement("b"), { textContent: String(entries.length) }), "개");
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

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

// Whether this reader can see the entry body (and therefore its comments).
const canSee = (entry) => isAdmin || !entry.private || entry.text != null || revealed.has(entry.id);
const bodyOf = (entry) => (entry.text != null ? entry.text : revealed.get(entry.id)?.text ?? null);

function item(entry) {
  const li = el("li", "gb-item" + (entry.id && entry.id === freshId ? " is-new" : ""));
  li.dataset.id = entry.id;
  const name = entry.name || "익명";
  const avatar = el("span", "gb-avatar", Array.from(name)[0] || "?");
  avatar.setAttribute("aria-hidden", "true");
  const main = el("div", "gb-main");
  const meta = el("div", "gb-meta");
  meta.append(el("strong", "gb-name", name));
  const when = el("time", "gb-date");
  if (entry.createdAt) {
    const d = new Date(Number(entry.createdAt));
    when.dateTime = d.toISOString();
    when.textContent = formatDate(d);
  }
  meta.append(when);
  if (entry.private) meta.append(el("span", "gb-lock", "🔒 비밀글"));

  const actions = el("span", "gb-actions");
  const visible = canSee(entry);
  if (entry.private && !visible && entry.hasPassword) {
    const open = el("button", "gb-del", "비밀번호로 보기");
    open.type = "button";
    open.addEventListener("click", () => { togglePrompt(entry.id); });
    actions.append(open);
  }
  if (visible || entry.hasPassword) {
    const count = entry.commentCount ?? comments.get(entry.id)?.length;
    const talk = el("button", "gb-act", "댓글");
    talk.type = "button";
    if (count != null) talk.append(el("b", "", String(count)));
    talk.setAttribute("aria-expanded", String(openThreads.has(entry.id)));
    talk.addEventListener("click", () => toggleThread(entry));
    actions.append(talk);
  }
  if (isAdmin && entry.id) {
    const del = el("button", "gb-del", "삭제");
    del.type = "button";
    del.addEventListener("click", async () => {
      if (!confirm(`'${name}'님의 글을 삭제할까요?`)) return;
      const { ok } = await send(`${API}/${encodeURIComponent(entry.id)}`, "DELETE");
      if (ok) await load();
    });
    actions.append(del);
  }
  meta.append(actions);

  const text = bodyOf(entry);
  let body;
  if (text != null && visible) {
    body = el("p", "gb-text", text);
  } else if (entry.hasPassword) {
    body = el("p", "gb-text is-secret", "비밀글입니다. 글쓴이는 비밀번호로 볼 수 있어요.");
  } else {
    body = el("p", "gb-text is-secret", "관리자만 볼 수 있는 비밀글이에요.");
  }
  main.append(meta, body);
  if (openPrompts.has(entry.id) && !visible) main.append(prompt(entry));
  if (openThreads.has(entry.id) && visible) main.append(thread(entry));
  li.append(avatar, main);
  return li;
}

function rerender(id) {
  const entry = entries.find((one) => one.id === id);
  const old = list.querySelector(`li[data-id="${CSS.escape(id)}"]`);
  if (entry && old) old.replaceWith(item(entry));
}

function togglePrompt(id) {
  if (openPrompts.has(id)) openPrompts.delete(id); else openPrompts.add(id);
  rerender(id);
  list.querySelector(`li[data-id="${CSS.escape(id)}"] .gb-reveal input`)?.focus();
}

function prompt(entry) {
  const form = el("form", "gb-reveal");
  const input = el("input");
  input.type = "password";
  input.maxLength = 20;
  input.placeholder = "글 쓸 때 정한 비밀번호";
  input.setAttribute("aria-label", "비밀글 비밀번호");
  input.autocomplete = "current-password";
  const go = el("button", "go", "확인");
  go.type = "submit";
  const cancel = el("button", "", "취소");
  cancel.type = "button";
  cancel.addEventListener("click", () => { openPrompts.delete(entry.id); openThreads.delete(entry.id); rerender(entry.id); });
  const msg = el("p", "gb-msg", "");
  msg.setAttribute("role", "status");
  form.append(input, go, cancel, msg);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!input.value) { input.focus(); return; }
    go.disabled = true;
    msg.textContent = "확인하는 중…";
    const { ok, data } = await send(`${API}/${encodeURIComponent(entry.id)}/reveal`, "POST", { password: input.value }).catch(() => ({ ok: false, data: {} }));
    go.disabled = false;
    if (!ok) { msg.textContent = data.error || "확인하지 못했어요."; input.select(); return; }
    revealed.set(entry.id, { text: data.entry?.text ?? "", password: input.value });
    comments.set(entry.id, data.comments || []);
    entry.commentCount = (data.comments || []).length;
    openPrompts.delete(entry.id);
    rerender(entry.id);
  });
  return form;
}

async function toggleThread(entry) {
  if (openThreads.has(entry.id)) { openThreads.delete(entry.id); rerender(entry.id); return; }
  if (!canSee(entry)) { openPrompts.add(entry.id); openThreads.add(entry.id); rerender(entry.id); list.querySelector(`li[data-id="${CSS.escape(entry.id)}"] .gb-reveal input`)?.focus(); return; }
  openThreads.add(entry.id);
  if (!comments.has(entry.id)) await fetchComments(entry);
  rerender(entry.id);
  list.querySelector(`li[data-id="${CSS.escape(entry.id)}"] .gb-cform .ctext`)?.focus();
}

async function fetchComments(entry) {
  const secret = revealed.get(entry.id);
  const result = secret && !isAdmin
    ? await send(`${API}/${encodeURIComponent(entry.id)}/reveal`, "POST", { password: secret.password }).catch(() => null)
    : await send(`${API}/${encodeURIComponent(entry.id)}/comments`, "GET").catch(() => null);
  const rows = result?.ok ? (result.data.comments || []) : [];
  comments.set(entry.id, rows);
  entry.commentCount = rows.length;
}

function thread(entry) {
  const box = el("div", "gb-thread");
  const rows = comments.get(entry.id) || [];
  const ul = el("ol", "gb-clist");
  ul.setAttribute("aria-label", "댓글");
  if (!rows.length) box.append(el("p", "gb-cempty", "첫 댓글을 남겨 주세요."));
  for (const row of rows) {
    const li = el("li", "gb-c");
    const main = el("div", "gb-c-main");
    const meta = el("div", "gb-meta");
    meta.append(el("strong", "gb-name", row.name || "익명"));
    const when = el("time", "gb-date", row.createdAt ? formatDate(new Date(Number(row.createdAt))) : "");
    meta.append(when);
    if (isAdmin) {
      const del = el("button", "gb-del", "삭제");
      del.type = "button";
      del.style.marginLeft = "auto";
      del.addEventListener("click", async () => {
        if (!confirm("이 댓글을 삭제할까요?")) return;
        const { ok } = await send(`${API}/${encodeURIComponent(entry.id)}/comments/${encodeURIComponent(row.id)}`, "DELETE");
        if (!ok) return;
        comments.set(entry.id, rows.filter((one) => one.id !== row.id));
        entry.commentCount = comments.get(entry.id).length;
        rerender(entry.id);
      });
      meta.append(del);
    }
    main.append(meta, el("p", "gb-text", row.text || ""));
    li.append(main);
    ul.append(li);
  }
  if (rows.length) box.append(ul);

  const form = el("form", "gb-cform");
  const cname = el("input", "cname");
  cname.type = "text";
  cname.maxLength = 20;
  cname.placeholder = "이름";
  cname.setAttribute("aria-label", "댓글 이름");
  cname.value = nameEl.value;
  const ctext = el("input", "ctext");
  ctext.type = "text";
  ctext.maxLength = 200;
  ctext.required = true;
  ctext.placeholder = "댓글을 입력하세요 (200자)";
  ctext.setAttribute("aria-label", "댓글 내용");
  const go = el("button", "go", "등록");
  go.type = "submit";
  const msg = el("p", "gb-msg", "");
  msg.setAttribute("role", "status");
  form.append(cname, ctext, go, msg);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = ctext.value.trim();
    if (!text) { ctext.focus(); return; }
    go.disabled = true;
    msg.textContent = "등록하는 중…";
    const secret = revealed.get(entry.id);
    const { ok, data } = await send(`${API}/${encodeURIComponent(entry.id)}/comments`, "POST", {
      name: cname.value, text, password: secret && !isAdmin ? secret.password : undefined,
    }).catch(() => ({ ok: false, data: {} }));
    go.disabled = false;
    if (!ok) { msg.textContent = data.error || "등록하지 못했어요."; return; }
    try { if (cname.value.trim()) localStorage.setItem("nes-guest-name", cname.value.trim()); } catch (_) {}
    comments.set(entry.id, data.comments || [...rows, data.comment]);
    entry.commentCount = comments.get(entry.id).length;
    rerender(entry.id);
    list.querySelector(`li[data-id="${CSS.escape(entry.id)}"] .gb-cform .ctext`)?.focus();
  });
  box.append(form);
  return box;
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
  if (document.getElementById("admin-on")) return;
  const on = el("form", "gb-admin-on");
  on.id = "admin-on";
  on.method = "post";
  on.action = "/guestbook/lock";
  const label = el("span");
  label.append(el("b", "", "관리자 모드"));
  const out = el("button", "gb-admin-link", "로그아웃");
  out.type = "submit";
  on.append(label, out);
  adminBox.prepend(on);
}

updateLen();
load();
