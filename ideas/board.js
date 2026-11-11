import { ideaProgress, ideas } from "./data.js";

const app = document.getElementById("app");
const intro = el("div");
intro.append(
  el("p", { className: "eyebrow", text: "PLANNING BOARD" }),
  el("h1", { text: "내 아이디어" }),
  el("p", { className: "copy", text: "사업 아이디어를 번호로 올려 두는 보드입니다. 판매나 주문이 열린 페이지가 아닙니다." }),
);
const list = el("div", { className: "board" });
for (const idea of ideas) {
  const progress = ideaProgress(idea);
  const row = el("a", { className: "idea-row", href: `/ideas/${idea.id}` });
  const image = document.createElement("img");
  image.src = idea.thumbnail;
  image.alt = "";
  image.loading = "lazy";
  const body = el("div");
  const bar = el("div", { className: "bar" });
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.setAttribute("aria-valuenow", String(progress.percent));
  bar.setAttribute("aria-label", `진행률 ${progress.percent}%`);
  const fill = el("span");
  fill.style.width = `${progress.percent}%`;
  bar.append(fill);
  body.append(
    el("span", { className: "no", text: `No. ${idea.no}` }),
    el("h2", { text: idea.title }),
    el("div", { className: "meta" }, [
      el("span", { className: "badge", text: idea.stage }),
      bar,
      el("time", { text: idea.updated.replaceAll("-", ".") }),
    ]),
  );
  row.append(image, body);
  list.append(row);
}
app.replaceChildren(intro, list);

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}
