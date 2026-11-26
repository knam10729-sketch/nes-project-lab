import { mountComments } from "./comments.js";
import { ideaById, ideaProgress } from "./data.js";

const id = location.pathname.replace(/\/+$/, "").split("/").pop();
const idea = ideaById(id);
const app = document.getElementById("app");

if (!idea) {
  app.append(
    el("p", { className: "eyebrow", text: "IDEA" }),
    el("h1", { text: "아직 없는 번호입니다" }),
    el("p", {}, [el("a", { href: "/ideas", text: "보드로 돌아가기" })]),
  );
} else {
  document.title = `${idea.title} | 정한.kr`;
  render(idea);
}

function render(item) {
  const progress = ideaProgress(item);
  const hero = el("figure", { className: "hero" });
  const image = document.createElement("img");
  image.src = item.hero;
    image.alt = item.heroAlt || "흰색 머그컵 디자인 시안";
  hero.append(image, el("figcaption", { className: "caption", text: item.heroCaption }));

  const head = el("div");
  head.append(
    el("p", { className: "eyebrow", text: `NO. ${item.no} · ${item.brand}` }),
    el("h1", { text: item.title }),
    el("div", { className: "meta" }, [
      el("span", { className: "badge", text: item.stage }),
      el("span", { text: `진행률 ${progress.percent}%` }),
      el("time", { text: item.updated.replaceAll("-", ".") }),
    ]),
    el("p", { className: "copy", text: item.disclaimer || "기획 초안입니다. 판매, 주문, 확정된 공급업체와 견적은 아직 없습니다. 금액은 계획용 가정입니다." }),
  );

  app.append(head, hero);
  if (item.layout === "concept") {
    renderConcept(item, progress);
    finish(item);
    return;
  }
  if (item.layout === "shops") {
    renderShops(item, progress);
    finish(item);
    return;
  }
  if (item.layout === "coffee") {
    renderCoffee(item, progress);
    finish(item);
    return;
  }
  if (item.layout === "flexcase") {
    renderFlex(item, progress);
    finish(item);
    return;
  }
  app.append(prose("핵심 제안", item.pitch));
  app.append(tablePanel("상품 옵션 기준", "계획용 가정", item.offer));
  app.append(limits(item.limits));
  app.append(tablePanel("함께 검토한 상품 줄", "우선 출시는 반려동물 이름컵 하나", item.lineup));
  app.append(gallery(item));
  app.append(prose("한 번의 주문 예시", [item.example]));
  app.append(flow(item.flow));
  app.append(tablePanel("사진 접수 기준", item.intake.note, item.intake));
  app.append(tablePanel("가격·손익 검토", item.pnl.note, item.pnl, item.pnl.sensitivity));
  app.append(budget(item.budget));
  app.append(el("section", { className: "panel" }, [
    el("h2", { text: "선택 옵션" }),
    el("p", { text: item.options }),
  ]));
  app.append(tablePanel("2주 시험 판매안", "아직 시작하지 않은 계획입니다.", item.roadmap));
  app.append(prose("계속 판매할지 판단하는 기준", [item.decision]));
  app.append(checklist(item, progress));
  app.append(el("section", { className: "panel next" }, [
    el("p", { className: "kicker", text: "다음 할 일" }),
    el("h2", { text: item.next }),
  ]));
  if (item.sources) app.append(sources(item.sources));
  finish(item);
}

function renderFlex(item, progress) {
  app.append(prose("핵심 컨셉", item.pitch));
  app.append(prose("문제에서 출발한 아이디어", item.problem));
  app.append(parts(item.parts));
  app.append(conceptShot(item.structure));
  app.append(prose("자원 낭비를 줄이는 취지", item.waste));
  app.append(conceptShot(item.compare));
  app.append(checklist(item, progress));
  app.append(prose("범위 노트", item.scope));
  app.append(el("section", { className: "panel next" }, [
    el("p", { className: "kicker", text: "다음 할 일" }),
    el("h2", { text: item.next }),
  ]));
}

function parts(items) {
  const wrap = el("div", { className: "keyrings" });
  for (const part of items) {
    wrap.append(el("article", {}, [el("h3", { text: part.title }), el("p", { text: part.text })]));
  }
  return el("section", { className: "panel" }, [el("h2", { text: "크기는 바꾸고 그림은 유지하는 구조" }), wrap]);
}

function renderCoffee(item, progress) {
  app.append(prose("핵심 컨셉", item.pitch));
  app.append(prose("상품 모습", item.look));
  app.append(prose("커피를 담는 방식", item.coating));
  app.append(conceptShot(item.interior));
  app.append(flow(item.flow, "사용 흐름", item.flowNote));
  app.append(prose("포장·판매 모습", item.pack));
  app.append(conceptShot(item.display));
  app.append(prose("포갤 때 커피층 보호", item.stack));
  app.append(sceneChips(item));
  app.append(checklist(item, progress));
  app.append(el("section", { className: "panel next" }, [
    el("p", { className: "kicker", text: "다음 할 일" }),
    el("h2", { text: item.next }),
  ]));
}

function conceptShot(shot) {
  return figure({
    src: shot.src,
    label: "콘셉 시안 · 실제 제작품·성능 검증 아님",
    caption: shot.caption,
  });
}

function sceneChips(item) {
  const row = el("div", { className: "chips" });
  for (const scene of item.scenes) row.append(el("span", { text: scene }));
  return el("section", { className: "panel" }, [
    el("h2", { text: "사용 장면" }),
    el("p", { text: item.sceneNote }),
    row,
  ]);
}

function renderShops(item, progress) {
  app.append(prose("핵심 컨셉", item.pitch));
  for (const shop of item.shops) app.append(shopSet(shop));
  app.append(mood(item));
  app.append(prose("매장 공지와 온라인 공지", item.notices));
  app.append(extensions(item.extensions));
  app.append(materials(item));
  app.append(flow(item.flow, "작업 흐름", item.flowNote));
  app.append(prose("검토 중인 것", item.review));
  app.append(checklist(item, progress));
  app.append(el("section", { className: "panel next" }, [
    el("p", { className: "kicker", text: "다음 할 일" }),
    el("h2", { text: item.next }),
  ]));
}

function shopSet(shop) {
  const list = el("ul");
  for (const line of shop.points) list.append(el("li", { text: line }));
  return el("section", { className: "panel" }, [
    el("h2", { text: shop.title }),
    figure({ src: shop.src, label: "AI 콘셉 이미지 · 가상 예시", caption: shop.caption }),
    list,
  ]);
}

function mood(item) {
  const wrap = el("div", { className: "palettes" });
  for (const palette of item.palettes) {
    const colors = el("div", { className: "swatches" });
    for (const color of palette.colors) {
      const chip = el("span", { className: "swatch" });
      const dot = el("i");
      dot.style.background = color.hex;
      chip.append(dot, document.createTextNode(color.name));
      colors.append(chip);
    }
    wrap.append(el("div", { className: "palette" }, [el("h3", { text: palette.place }), colors]));
  }
  return el("section", { className: "panel" }, [
    el("h2", { text: "가게마다 다른 분위기" }),
    ...item.mood.map((text) => el("p", { text })),
    el("p", { className: "caption", text: "예시 이미지에 쓰인 색 이름입니다. 확정된 색 코드는 없고, 달은 작은 달 모양입니다." }),
    wrap,
  ]);
}

function extensions(items) {
  const wrap = el("div", { className: "keyrings" });
  for (const kind of items) {
    wrap.append(el("article", {}, [el("h3", { text: kind.title }), el("p", { text: kind.text })]));
  }
  return el("section", { className: "panel" }, [el("h2", { text: "다른 업종으로 확장" }), wrap]);
}

function materials(item) {
  const list = el("ul", { className: "checks" });
  for (const label of item.materials) {
    const row = el("li");
    row.append(el("span", { className: "box", text: "" }), el("span", { text: label }));
    list.append(row);
  }
  return el("section", { className: "panel" }, [
    el("h2", { text: "사장님에게 받을 자료" }),
    el("p", { text: item.materialsNote }),
    list,
  ]);
}

function renderConcept(item, progress) {
  app.append(prose("핵심 컨셉", item.pitch));
  app.append(rules(item));
  app.append(phrases(item));
  app.append(prose("머그컵", item.mug));
  app.append(prose("마우스패드", item.pad));
  app.append(figure(item.images[0]));
  app.append(stickers(item));
  app.append(prose("세트 구성 아이디어", item.sets));
  app.append(prose("키링", [item.keyringNote]));
  app.append(keyrings(item.keyrings));
  app.append(figure(item.images[1]));
  app.append(prose("확장 계획", [item.later]));
  app.append(checklist(item, progress));
  app.append(el("section", { className: "panel next" }, [
    el("p", { className: "kicker", text: "다음 할 일" }),
    el("h2", { text: item.next }),
  ]));
}

function rules(item) {
  const list = el("ul");
  for (const line of item.rules) list.append(el("li", { text: line }));
  const colors = el("div", { className: "swatches" });
  for (const color of item.swatches) {
    const chip = el("span", { className: "swatch" });
    const dot = el("i");
    dot.style.background = color.hex;
    chip.append(dot, document.createTextNode(color.name));
    colors.append(chip);
  }
  return el("section", { className: "panel" }, [
    el("h2", { text: "캐릭터 규칙" }),
    el("p", { className: "caption", text: "문서에 적힌 색 이름입니다. 확정된 색 코드는 없습니다." }),
    colors,
    list,
  ]);
}

function stickers(item) {
  const list = el("ul");
  for (const sticker of item.stickers) list.append(el("li", { text: `${sticker.name} · ${sticker.prop}` }));
  return el("section", { className: "panel" }, [
    el("h2", { text: "스티커 4종" }),
    list,
    el("p", { text: item.stickerNote }),
  ]);
}

function keyrings(items) {
  const wrap = el("div", { className: "keyrings" });
  for (const kind of items) {
    wrap.append(el("article", {}, [el("h3", { text: kind.title }), el("p", { text: kind.text })]));
  }
  return el("section", { className: "panel" }, [el("h2", { text: "키링 유형" }), wrap]);
}

function figure(shot) {
  const box = document.createElement("figure");
  box.className = "shot";
  const image = document.createElement("img");
  image.src = shot.src;
  image.alt = shot.label;
  image.loading = "lazy";
  box.append(image, el("figcaption", { className: "caption", text: `${shot.label}. ${shot.caption}` }));
  return box;
}

function phrases(item) {
  const row = el("div", { className: "chips" });
  for (const phrase of item.phrases) row.append(el("span", { text: phrase }));
  return el("section", { className: "panel" }, [el("h2", { text: "문구 목록" }), row]);
}

function finish(item) {
  mountComments(app, item.id);
  const lock = document.createElement("form");
  lock.method = "post";
  lock.action = "/ideas/lock";
  lock.className = "lock-form";
  lock.append(el("button", { type: "submit", text: "잠그기" }));
  app.append(lock, el("p", {}, [el("a", { href: "/ideas", text: "← 아이디어 보드" })]));
}

function prose(title, paragraphs) {
  return el("section", { className: "panel" }, [
    el("h2", { text: title }),
    ...paragraphs.map((text) => el("p", { text })),
  ]);
}

function limits(lines) {
  const list = el("ul");
  for (const line of lines) list.append(el("li", { text: line }));
  return el("section", { className: "panel" }, [el("h2", { text: "선택지를 줄이는 기준" }), list]);
}

function tablePanel(title, note, table, extra = []) {
  const wrap = el("div", { className: "table-wrap" });
  const node = document.createElement("table");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of table.headers) headRow.append(el("th", { text: label }));
  head.append(headRow);
  const body = document.createElement("tbody");
  for (const row of table.rows) {
    const tr = document.createElement("tr");
    for (const cell of row) tr.append(el("td", { text: cell }));
    body.append(tr);
  }
  node.append(head, body);
  wrap.append(node);
  return el("section", { className: "panel" }, [
    el("h2", { text: title }),
    el("p", { className: "caption", text: note }),
    wrap,
    ...extra.map((text) => el("p", { text })),
  ]);
}

function gallery(item) {
  const grid = el("div", { className: "gallery" });
  for (const shot of item.gallery) {
    const figure = document.createElement("figure");
    const image = document.createElement("img");
    image.src = shot.src;
    image.alt = `${shot.label} 디자인 시안`;
    image.loading = "lazy";
    const caption = document.createElement("figcaption");
    caption.append(el("strong", { text: shot.label }), el("span", { text: shot.caption }));
    figure.append(image, caption);
    grid.append(figure);
  }
  return el("section", { className: "panel" }, [
    el("h2", { text: "디자인 틀 A / B / C" }),
    el("p", { className: "caption", text: "디자인 시안 (AI 목업). 공급업체 템플릿이 정해지기 전의 배치 안입니다." }),
    grid,
  ]);
}

function flow(steps, title = "주문에서 배송까지", note = "결제를 확인한 뒤 사진을 받고, 시안을 승인받은 뒤에만 제작한다. 답이 없으면 승인으로 보지 않는다.") {
  const list = el("ol", { className: steps.length === 3 ? "flow three" : "flow" });
  steps.forEach((label, index) => {
    const item = el("li");
    item.append(el("small", { text: String(index + 1).padStart(2, "0") }), document.createTextNode(label));
    list.append(item);
  });
  return el("section", { className: "panel" }, [
    el("h2", { text: title }),
    el("p", { text: note }),
    list,
  ]);
}

function budget(block) {
  const rows = block.rows.map((row) => el("p", { text: `${row[0]} ${row[1]}` }));
  return el("section", { className: "panel" }, [
    el("h2", { text: "초기 예산" }),
    el("p", { className: "caption", text: block.note }),
    ...rows,
    el("p", { text: block.payback }),
  ]);
}

function checklist(item, progress) {
  const list = el("ul", { className: "checks" });
  for (const entry of item.checklist) {
    const row = el("li", { className: entry.done ? "on" : "" });
    const box = el("span", { className: "box", text: entry.done ? "✓" : "" });
    row.append(box, el("span", { text: entry.label }));
    list.append(row);
  }
  return el("section", { className: "panel" }, [
    el("h2", { text: item.checklistTitle || "출시 전 체크리스트" }),
    el("p", { className: "caption", text: `${progress.done}/${progress.total} · ${progress.percent}%` }),
    list,
  ]);
}

function sources(items) {
  const list = el("ol", { className: "sources" });
  for (const source of items) {
    const row = el("li");
    const link = el("a", { href: encodeURI(source.href), text: source.title });
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    row.append(el("span", { text: `[${source.id}] ` }), link, el("p", { text: source.note }));
    list.append(row);
  }
  return el("section", { className: "panel" }, [el("h2", { text: "출처" }), list]);
}

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
