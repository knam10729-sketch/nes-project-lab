const write = document.getElementById("write");
const note = document.getElementById("write-note");
const adminForm = document.getElementById("admin");
const adminNote = document.getElementById("admin-note");
const list = document.getElementById("entries");

write.addEventListener("submit", async (event) => {
  event.preventDefault();
  note.textContent = "남기는 중";
  const response = await fetch("/guestbook/api/entries", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: document.getElementById("guest-name").value,
      text: document.getElementById("guest-text").value,
      private: document.getElementById("guest-private").checked,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    note.textContent = data.error || "남기지 못했습니다.";
    return;
  }
  document.getElementById("guest-text").value = "";
  note.textContent = data.private ? "비공개로 남겼습니다." : "남겼습니다.";
  await load();
});

adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminNote.textContent = "확인하는 중";
  const response = await fetch("/guestbook/unlock", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password: document.getElementById("admin-pass").value }),
  });
  if (!response.ok) {
    adminNote.textContent = "비밀번호가 틀렸어요";
    return;
  }
  location.reload();
});

async function load() {
  const response = await fetch("/guestbook/api/entries");
  const data = await response.json().catch(() => ({ entries: [] }));
  list.replaceChildren();
  if (data.admin) {
    const lock = document.createElement("form");
    lock.method = "post";
    lock.action = "/guestbook/lock";
    const button = document.createElement("button");
    button.type = "submit";
    button.textContent = "관리자 로그아웃";
    lock.append(button);
    list.append(lock);
  }
  for (const entry of data.entries || []) list.append(card(entry, data.admin));
}

function card(entry, admin) {
  const box = document.createElement("article");
  box.className = "panel";
  const head = document.createElement("p");
  head.className = "eyebrow";
  head.textContent = entry.name || "익명";
  const body = document.createElement("p");
  body.textContent = entry.private && entry.text == null ? "비공개 글입니다" : (entry.text || "");
  box.append(head, body);
  if (admin) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "삭제";
    button.addEventListener("click", async () => {
      const response = await fetch(`/guestbook/api/entries/${entry.id}`, { method: "DELETE" });
      if (!response.ok) return;
      await load();
    });
    box.append(button);
  }
  return box;
}

load();
