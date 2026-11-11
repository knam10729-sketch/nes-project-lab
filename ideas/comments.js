import { relativeTime } from "./comment-text.js";

export function mountComments(parent, ideaId) {
  const section = document.createElement("section");
  section.className = "panel comments";
  section.append(el("h2", { text: "댓글" }));
  const form = document.createElement("form");
  const name = document.createElement("input");
  name.maxLength = 20;
  name.placeholder = "이름 (비우면 익명)";
  name.setAttribute("aria-label", "이름");
  const text = document.createElement("textarea");
  text.maxLength = 500;
  text.required = true;
  text.placeholder = "의견을 남겨 주세요";
  text.setAttribute("aria-label", "댓글");
  const button = el("button", { type: "submit", text: "등록" });
  const note = el("p", { className: "caption", id: "comment-note" });
  form.append(name, text, button, note);
  const list = document.createElement("div");
  list.id = "comment-list";
  section.append(form, list);
  parent.append(section);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    note.textContent = "등록하는 중";
    const response = await fetch(`/ideas/api/comments/${ideaId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.value, text: text.value }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      note.textContent = data.error || "등록하지 못했습니다.";
      return;
    }
    text.value = "";
    note.textContent = "";
    await load();
  });

  async function load() {
    const response = await fetch(`/ideas/api/comments/${ideaId}`);
    const data = await response.json().catch(() => ({ comments: [] }));
    list.replaceChildren();
    if (!data.comments?.length) {
      list.append(el("p", { className: "caption", text: "아직 댓글이 없습니다." }));
      return;
    }
    for (const comment of data.comments) list.append(commentCard(comment));
  }

  function commentCard(comment) {
    const card = document.createElement("article");
    card.className = "comment";
    const head = document.createElement("header");
    head.append(el("strong", { text: comment.name }), el("time", { text: relativeTime(comment.createdAt) }));
    const body = document.createElement("p");
    body.textContent = comment.text;
    const remove = el("button", { type: "button", text: "삭제" });
    remove.addEventListener("click", async () => {
      if (!confirm("이 댓글을 지울까요?")) return;
      const response = await fetch(`/ideas/api/comments/${ideaId}/${comment.id}`, { method: "DELETE" });
      if (!response.ok) {
        note.textContent = "지우지 못했습니다.";
        return;
      }
      await load();
    });
    head.append(remove);
    card.append(head, body);
    return card;
  }

  load();
}

function el(tag, attrs = {}) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  return node;
}
