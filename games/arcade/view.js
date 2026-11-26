// Screens for the newer room games: 풍선 터뜨리기, 짝 맞추기, 빙고, 수싸움, 찰나.
export const ARCADE_GAMES = new Set(["balloon", "memory", "bingo", "duel", "flash", "ladder", "nunchi", "pirate", "chosung", "othello"]);
// Games whose "혼자" mode has no bots.
export const SOLO_ALONE = new Set(["balloon", "memory", "ladder", "chosung"]);
export const SCROLL_ARCADE = new Set(["chosung", "ladder"]);
const MIN = { balloon: 1, memory: 1, bingo: 2, duel: 2, flash: 2, ladder: 2, nunchi: 2, pirate: 2, chosung: 1, othello: 2 };

export const ARCADE_META = {
  balloon: ["풍선 터뜨리기", "1명에서 4명. 사람마다 색이 하나씩 정해집니다. 45초 동안 내 색 풍선만 터뜨리세요. 다른 색을 누르면 1점이 깎입니다."],
  memory: ["짝 맞추기", "1명에서 2명. 카드 두 장을 뒤집어 같은 그림이면 가져가고 한 번 더 합니다. 틀리면 차례가 넘어갑니다."],
  bingo: ["빙고", "2명에서 4명, 혼자면 봇과 합니다. 각자 다른 5×5 판을 받고, 돌아가며 숫자를 부릅니다. 먼저 3줄을 만들면 이깁니다."],
  duel: ["수싸움", "2명, 혼자면 봇과 합니다. 둘 다 1부터 9까지 카드를 들고 한 장씩 몰래 냅니다. 딱 1 높으면 이기고, 그 밖에는 낮은 카드가 이깁니다. 9판 뒤 많이 이긴 쪽이 승리."],
  ladder: ["사다리타기", "2명에서 8명. 결과(당첨, 꽝, 벌칙 등)를 적고 시작하면 사다리가 그려집니다. 링크로 모이거나, 한 화면에서 이름을 적어 할 수 있습니다."],
  nunchi: ["눈치게임", "2명에서 8명, 혼자면 봇 셋과 합니다. 1부터 순서대로 한 사람씩 외치기를 누릅니다. 같은 순간에 누른 사람들과 끝까지 못 외친 한 사람이 걸립니다."],
  pirate: ["해적 룰렛", "2명에서 6명, 혼자면 봇 둘과 합니다. 돌아가며 통에 칼을 꽂습니다. 숨은 한 칸에 꽂으면 해적이 튀어나오고, 그 사람이 걸립니다."],
  chosung: ["초성퀴즈", "1명에서 8명. 초성과 주제를 보고 단어를 먼저 입력하면 점수를 얻습니다. 힌트 전에 맞히면 2점, 뒤에는 1점. 8문제."],
  othello: ["오셀로", "2명, 혼자면 봇과 둡니다. 상대 돌을 내 돌 사이에 끼우면 뒤집힙니다. 둘 곳이 없으면 넘어가고, 끝났을 때 돌이 많은 쪽이 이깁니다."],
  flash: ["찰나", "2명에서 4명, 혼자면 봇과 합니다. 위에 보이는 카드가 가운데에 나오는 순간 먼저 누르세요. 너무 빨리 누르면 1점이 깎이고 그 판은 쉽니다. 5점 먼저."],
};

export const BALLOON_COLORS = [
  { name: "빨강", fill: "#e5484d" },
  { name: "파랑", fill: "#3e7bfa" },
  { name: "노랑", fill: "#f0b400" },
  { name: "초록", fill: "#30a46c" },
];

const REASON = { count: "돌 개수", quiz: "8문제 끝", time: "시간이 끝났습니다", cleared: "모든 짝을 찾았습니다", pairs: "모든 짝을 찾았습니다", bingo: "빙고!", rounds: "9판이 끝났습니다", points: "끝났습니다" };

let ctx = null;
const pending = new Set();
const myPops = [];

export function arcadeTurn(state, mySeat, secret) {
  const p = state.position || {};
  const name = (seat) => state.seats[seat]?.name || "누군가";
  if (state.status === "waiting") {
    const min = MIN[state.game];
    if (state.game === "othello") return "상대가 링크로 들어오면 시작됩니다";
    if (state.game === "ladder" && state.solo) return "이름과 결과를 적고 시작하세요";
    if (mySeat !== 0) return "방장을 기다리는 중";
    return state.seats.length >= min ? "준비되면 시작을 누르세요" : `${min}명이 모이면 시작할 수 있어요`;
  }
  if (state.status === "over") return arcadeOutcome(state);
  const mine = state.turnSeat === mySeat;
  if (state.game === "balloon") {
    const color = BALLOON_COLORS[mySeat]?.name;
    return p.phase === "countdown" ? "곧 시작합니다" : color ? `내 색은 ${color}` : "구경하는 중";
  }
  if (state.game === "memory") {
    if (p.peeking) return "다른 그림이에요";
    if (state.seats.length === 1) return "같은 그림 두 장을 찾으세요";
    return mine ? "내 차례 · 카드 두 장을 뒤집으세요" : `${name(state.turnSeat)} 차례`;
  }
  if (state.game === "bingo") return mine ? "내 차례 · 부를 숫자를 누르세요" : `${name(state.turnSeat)}님이 고르는 중`;
  if (state.game === "duel") {
    if (secret?.pick != null) return `${secret.pick}을(를) 냈어요 · 상대를 기다리는 중`;
    return `${p.round}/${p.total}판 · 낼 카드를 고르세요`;
  }
  if (state.game === "nunchi") {
    if (p.phase === "countdown") return "곧 시작합니다";
    if ((p.called || []).some((item) => item.seat === mySeat) || p.pending?.seats.includes(mySeat)) return "외쳤어요 · 구경하는 중";
    return `지금 외칠 숫자 ${p.next}`;
  }
  if (state.game === "pirate") return mine ? "내 차례 · 칼을 꽂을 칸을 고르세요" : `${name(state.turnSeat)} 차례`;
  if (state.game === "chosung") {
    if (p.phase === "ready") return "곧 첫 문제";
    if (p.phase === "result") return p.solver == null ? `정답은 ${p.answer}` : `${name(p.solver)} 정답! · ${p.answer}`;
    return `${p.round}/${p.total}번 · ${p.category}`;
  }
  if (state.game === "othello") {
    const color = othelloColor(state, mySeat);
    if (p.passed && mine) return `상대가 둘 곳이 없어요 · 내 차례 (${color})`;
    return mine ? `내 차례 · ${color}` : `상대 차례 · ${color === "흑" ? "백" : "흑"}`;
  }
  if (state.game === "flash") {
    if (p.benched?.includes(mySeat)) return "너무 빨랐어요 · 이번 판은 쉬어요";
    if (p.phase === "ready") return "준비…";
    if (p.phase === "result") return p.winner == null ? "아무도 못 잡았어요" : `${name(p.winner)} +1`;
    return `${p.round}판 · 같은 카드가 나오면 누르세요`;
  }
  return "게임 중";
}

export function arcadeOutcome(state) {
  const why = REASON[state.reason] || "끝났습니다";
  const p = state.position || {};
  const names = (list) => list.map((seat) => state.seats[seat]?.name || "누군가").join(", ");
  if (state.game === "ladder") return "사다리 결과가 나왔어요";
  if (state.game === "nunchi") {
    const who = names(p.losers || []);
    if (p.why === "together") return `${who} 동시에 ${p.clash}! 걸렸어요`;
    if (p.why === "idle") return `시간 초과 · ${who} 걸렸어요`;
    return `${who}님이 마지막이라 걸렸어요`;
  }
  if (state.game === "pirate") return `🏴‍☠️ ${names([p.loser])}님이 해적을 튕겼어요!`;
  if (state.game === "memory" && state.seats.length === 1) return `다 찾았어요! · ${state.position.flips?.[0] ?? 0}번 뒤집음`;
  if (state.draw || state.winnerSeat == null) return `무승부 · ${why}`;
  return `${state.seats[state.winnerSeat]?.name || "승자"} 승리 · ${why}`;
}

export function arcadeScore(state, index) {
  const p = state.position || {};
  if (state.status === "waiting") return "";
  if (state.game === "bingo") return ` ${p.lines?.[index] ?? 0}줄`;
  if (["ladder", "nunchi", "pirate"].includes(state.game)) return "";
  if (state.game === "othello") {
    const black = index === p.blackSeat;
    return ` ${black ? "흑" : "백"} ${black ? p.counts?.black : p.counts?.white}`;
  }
  if (state.game === "memory") return ` ${p.scores?.[index] ?? 0}쌍`;
  return ` ${p.scores?.[index] ?? 0}점`;
}

export function renderArcade(context) {
  ctx = context;
  const { state } = context;
  const wrap = document.getElementById("board-wrap");
  const actions = document.getElementById("actions");
  actions.replaceChildren();
  document.getElementById("scoreboard")?.replaceChildren();
  if (state.status === "waiting") {
    const card = waitingCard(state);
    wrap.replaceChildren(card);
    if (state.game === "othello") return;
    if (context.mySeat === 0) {
      const extra = startOptions(state, card);
      actions.append(button("시작", "start", () => context.send({ type: "start", ...extra() }), "primary"));
    }
    return;
  }
  if (state.game === "ladder") renderLadder(state, wrap);
  if (state.game === "nunchi") renderNunchi(state, wrap);
  if (state.game === "pirate") renderPirate(state, wrap);
  if (state.game === "chosung") renderChosung(state, wrap);
  if (state.game === "othello") renderOthello(state, wrap);
  if (state.game === "balloon") renderBalloon(state, wrap);
  if (state.game === "memory") renderMemory(state, wrap);
  if (state.game === "bingo") renderBingo(state, wrap);
  if (state.game === "duel") renderDuel(state, wrap);
  if (state.game === "flash") renderFlash(state, wrap);
  if (state.status === "over") actions.append(button("한 판 더", "rematch", () => context.send({ type: "rematch" }), "primary"));
}

export function arcadeError() {
  pending.clear();
  if (ctx?.state?.game === "balloon") paintBalloons();
}

function waitingCard(state) {
  const meta = ARCADE_META[state.game];
  const card = el("div", { className: "panel arcade-wait" });
  card.append(el("p", { className: "eyebrow", text: "규칙" }), el("p", { className: "copy", text: meta[1] }));
  if (state.game === "balloon") {
    const chips = el("div", { className: "chips-row" });
    state.seats.forEach((seat, index) => chips.append(el("span", { className: "color-chip", style: `--c:${BALLOON_COLORS[index].fill}`, text: `${seat.name} · ${BALLOON_COLORS[index].name}` })));
    card.append(chips);
  }
  return card;
}

// ---- 풍선 터뜨리기 ----
function renderBalloon(state, wrap) {
  let field = document.getElementById("balloon-field");
  if (!field) {
    field = el("div", { className: "balloon-field board", id: "balloon-field" });
    for (let spot = 0; spot < 12; spot += 1) {
      const cell = el("button", { className: "balloon-spot", type: "button", "aria-label": `${spot + 1}번 자리` });
      cell.dataset.spot = String(spot);
      cell.append(el("span", { className: "balloon", "aria-hidden": "true" }), el("span", { className: "pop-fx", "aria-hidden": "true" }));
      cell.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        onBalloon(spot);
      });
      field.append(cell);
    }
    const mine = BALLOON_COLORS[ctx.mySeat];
    const tag = el("p", { className: "balloon-mine", id: "balloon-mine" });
    if (mine) tag.append(el("span", { className: "color-chip", style: `--c:${mine.fill}`, text: `내 색 ${mine.name}` }));
    wrap.replaceChildren(tag, field);
  }
  for (const pop of state.position.pops || []) {
    if (pop.seat === ctx.mySeat && !myPops.some((item) => item.key === `${pop.id}:${pop.at}`)) {
      myPops.push({ key: `${pop.id}:${pop.at}`, spot: pop.spot, good: pop.good, until: Date.now() + 600 });
      pending.delete(pop.id);
    }
  }
  paintBalloons();
}

function onBalloon(spot) {
  const state = ctx?.state;
  if (!state || state.status !== "playing" || state.position.phase !== "playing") return;
  const now = ctx.serverNow();
  const balloon = state.position.active.find((item) => item.spot === spot && item.expiresAt > now);
  if (!balloon || pending.has(balloon.id)) return;
  pending.add(balloon.id);
  ctx.send({ type: "pop", id: balloon.id });
}

export function paintBalloons() {
  const field = document.getElementById("balloon-field");
  const state = ctx?.state;
  if (!field || !state || state.game !== "balloon") return;
  const now = ctx.serverNow();
  const local = Date.now();
  while (myPops.length && myPops[0].until < local - 2000) myPops.shift();
  field.querySelectorAll(".balloon-spot").forEach((cell) => {
    const spot = Number(cell.dataset.spot);
    const balloon = (state.position.active || []).find((item) => item.spot === spot && item.expiresAt > now && !(pending.has(item.id) && item.color === ctx.mySeat));
    const shape = cell.querySelector(".balloon");
    cell.classList.toggle("up", Boolean(balloon));
    if (balloon) shape.style.setProperty("--c", BALLOON_COLORS[balloon.color].fill);
    cell.classList.toggle("mine", Boolean(balloon && balloon.color === ctx.mySeat));
    const fx = myPops.find((item) => item.spot === spot && item.until > local);
    const label = cell.querySelector(".pop-fx");
    label.textContent = fx ? (fx.good ? "+1" : "-1") : "";
    label.classList.toggle("bad", Boolean(fx && !fx.good));
  });
}

// ---- 짝 맞추기 ----
function renderMemory(state, wrap) {
  const grid = el("div", { className: "memory-grid board", id: "memory-grid" });
  const myTurn = state.status === "playing" && state.turnSeat === ctx.mySeat && !state.position.peeking;
  state.position.cards.forEach((card, index) => {
    const tile = el("button", { className: "memory-card", type: "button" });
    tile.dataset.index = String(index);
    if (card.face) {
      tile.classList.add("up");
      tile.textContent = card.face;
      tile.setAttribute("aria-label", `${index + 1}번 카드 ${card.face}`);
    } else tile.setAttribute("aria-label", `${index + 1}번 카드 뒤집기`);
    if (card.owner != null) {
      tile.classList.add("taken");
      tile.style.setProperty("--c", BALLOON_COLORS[card.owner].fill);
    }
    tile.disabled = !myTurn || Boolean(card.face);
    tile.addEventListener("click", () => ctx.send({ type: "flip", index }));
    grid.append(tile);
  });
  wrap.replaceChildren(grid);
}

// ---- 빙고 ----
function renderBingo(state, wrap) {
  const board = ctx.secret?.board;
  const called = new Set(state.position.called || []);
  const myTurn = state.status === "playing" && state.turnSeat === ctx.mySeat;
  const grid = el("div", { className: "bingo-grid board", id: "bingo-grid" });
  (board || []).forEach((number) => {
    const cell = el("button", { className: "bingo-cell", type: "button", text: String(number) });
    cell.dataset.number = String(number);
    if (called.has(number)) cell.classList.add("hit");
    if (state.position.last?.number === number) cell.classList.add("last");
    cell.disabled = !myTurn || called.has(number);
    cell.addEventListener("click", () => ctx.send({ type: "call", number }));
    grid.append(cell);
  });
  const last = state.position.last;
  const info = el("p", { className: "muted arcade-line", text: last ? `${state.seats[last.seat]?.name || "누군가"}님이 ${last.number}을(를) 불렀어요 · 3줄이면 빙고` : "먼저 3줄을 만들면 이깁니다" });
  wrap.replaceChildren(info, grid);
}

// ---- 수싸움 ----
function renderDuel(state, wrap) {
  const p = state.position;
  const other = ctx.mySeat === 0 ? 1 : 0;
  const box = el("div", { className: "duel" });
  const status = el("div", { className: "duel-status" });
  status.append(
    el("span", { text: `${state.seats[other]?.name || "상대"}: ${p.ready?.[other] ? "카드를 냈어요" : "고르는 중"}` }),
    el("strong", { text: `${p.scores?.[ctx.mySeat] ?? 0} : ${p.scores?.[other] ?? 0}` }),
  );
  const last = p.history?.[p.history.length - 1];
  if (last) {
    const mineCard = last.cards[ctx.mySeat];
    const theirs = last.cards[other];
    const verdict = last.winner == null ? "비김" : last.winner === ctx.mySeat ? "이김" : "짐";
    box.append(el("div", { className: `duel-last ${last.winner === ctx.mySeat ? "win" : last.winner == null ? "tie" : "lose"}` }, [
      el("span", { className: "duel-card", text: String(mineCard) }),
      el("b", { text: verdict }),
      el("span", { className: "duel-card", text: String(theirs) }),
    ]));
  }
  const hand = el("div", { className: "duel-hand", id: "duel-hand" });
  const mine = ctx.secret?.hand || [];
  for (let card = 1; card <= 9; card += 1) {
    const b = el("button", { className: "duel-card", type: "button", text: String(card) });
    const has = mine.includes(card);
    if (!has) b.classList.add("used");
    if (ctx.secret?.pick === card) b.classList.add("picked");
    b.disabled = state.status !== "playing" || !has || ctx.secret?.pick != null;
    b.addEventListener("click", () => ctx.send({ type: "pick", card }));
    hand.append(b);
  }
  const log = el("ol", { className: "duel-log" });
  (p.history || []).forEach((round, index) => {
    const win = round.winner == null ? "비김" : `${state.seats[round.winner]?.name || ""} 승`;
    log.append(el("li", { text: `${index + 1}판 ${round.cards[ctx.mySeat]} vs ${round.cards[other]} · ${win}` }));
  });
  box.prepend(status);
  box.append(hand, log);
  wrap.replaceChildren(box);
}

// ---- 찰나 ----
function renderFlash(state, wrap) {
  const p = state.position;
  const box = el("div", { className: "flash" });
  const target = el("div", { className: "flash-target" }, [el("span", { text: "이 카드가 나오면" }), el("b", { text: p.target || "?" })]);
  const center = el("button", { className: `flash-card ${p.phase}`, type: "button", id: "flash-card", "aria-label": "지금 누르기" });
  center.textContent = p.card || (p.phase === "ready" ? "…" : "");
  if (p.phase === "result") center.classList.add(p.winner === ctx.mySeat ? "win" : "done");
  if (p.benched?.includes(ctx.mySeat)) center.classList.add("benched");
  center.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const now = ctx.state;
    if (!now || now.status !== "playing" || pending.has(`f${now.position.cardId}`)) return;
    if (now.position.phase !== "flip" && now.position.phase !== "ready") return;
    pending.add(`f${now.position.cardId}`);
    ctx.send({ type: "tap", cardId: now.position.cardId });
  });
  box.append(target, center, el("p", { className: "muted arcade-line", text: `${p.round}/${p.maxRounds}판 · ${p.goal}점 먼저` }));
  wrap.replaceChildren(box);
  if (p.phase === "ready") pending.clear();
}

function button(text, id, onClick, className = "") {
  const b = el("button", { id, type: "button", className, text });
  b.addEventListener("click", onClick);
  return b;
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

// ---- shared start options (사다리타기, 초성퀴즈) ----
const DRAFT = {};
const CHOSUNG_CATS = [["all", "전체"], ["food", "음식"], ["animal", "동물"], ["place", "장소"], ["job", "직업"], ["thing", "물건"], ["sport", "운동"], ["snack", "간식"], ["ride", "탈것"]];

function startOptions(state, card) {
  if (state.game === "ladder") {
    const box = el("div", { className: "ladder-setup" });
    let names = null;
    if (state.solo) {
      names = el("textarea", { id: "ladder-names", rows: "3", placeholder: "이름을 쉼표나 줄바꿈으로 (2~8명)" });
      names.value = DRAFT.names ?? "";
      names.addEventListener("input", () => { DRAFT.names = names.value; });
      box.append(el("label", { text: "참가자 이름", for: "ladder-names" }), names);
    }
    const results = el("input", { id: "ladder-results", placeholder: "예: 커피, 꽝  (비우면 당첨 1개 + 꽝)" });
    results.value = DRAFT.results ?? "";
    results.addEventListener("input", () => { DRAFT.results = results.value; });
    box.append(el("label", { text: "결과", for: "ladder-results" }), results);
    card.append(box);
    const split = (text) => String(text || "").split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
    return () => ({ results: split(results.value), names: names ? split(names.value) : undefined });
  }
  if (state.game === "chosung") {
    const select = el("select", { id: "chosung-cat", "aria-label": "주제" });
    for (const [id, label] of CHOSUNG_CATS) {
      const option = el("option", { value: id, text: label });
      select.append(option);
    }
    select.value = DRAFT.cat || "all";
    select.addEventListener("change", () => { DRAFT.cat = select.value; });
    card.append(el("label", { text: "주제", for: "chosung-cat" }), select);
    return () => ({ category: select.value });
  }
  return () => ({});
}

// ---- 사다리타기 ----
let ladderPick = null;
function renderLadder(state, wrap) {
  const p = state.position;
  const lanes = p.lanes;
  const labels = p.names || state.seats.map((seat) => seat.name);
  const W = 100;
  const x = (lane) => (W / lanes) * (lane + 0.5);
  const top = 8;
  const rowH = 8;
  const y = (row) => top + rowH * (row + 1);
  const height = top + rowH * (p.rows + 1) + 4;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${height}`);
  svg.setAttribute("class", "ladder-svg");
  const line = (x1, y1, x2, y2, cls) => {
    const l = document.createElementNS(ns, "line");
    l.setAttribute("x1", x1); l.setAttribute("y1", y1); l.setAttribute("x2", x2); l.setAttribute("y2", y2);
    l.setAttribute("class", cls);
    svg.append(l);
  };
  for (let lane = 0; lane < lanes; lane += 1) line(x(lane), top, x(lane), height - 4, "rail");
  for (const [row, gap] of p.rungs) line(x(gap), y(row), x(gap + 1), y(row), "rung");
  if (ladderPick != null && ladderPick < lanes) {
    let at = ladderPick;
    const points = [[x(at), top]];
    for (let row = 0; row < p.rows; row += 1) {
      points.push([x(at), y(row)]);
      if (p.rungs.some(([r, g]) => r === row && g === at - 1)) at -= 1;
      else if (p.rungs.some(([r, g]) => r === row && g === at)) at += 1;
      points.push([x(at), y(row)]);
    }
    points.push([x(at), height - 4]);
    const poly = document.createElementNS(ns, "polyline");
    poly.setAttribute("points", points.map((pt) => pt.join(",")).join(" "));
    poly.setAttribute("class", "trail");
    svg.append(poly);
  }
  const heads = el("div", { className: "ladder-row", style: `--n:${lanes}` });
  labels.slice(0, lanes).forEach((label, lane) => {
    const b = el("button", { type: "button", className: lane === ladderPick ? "on" : "", text: label });
    b.addEventListener("click", () => { ladderPick = lane; renderLadder(ctx.state, wrap); });
    heads.append(b);
  });
  const feet = el("div", { className: "ladder-row feet", style: `--n:${lanes}` });
  p.bottom.forEach((result, end) => {
    const hit = ladderPick != null && p.ends[ladderPick] === end;
    feet.append(el("span", { className: hit ? "on" : "", text: result }));
  });
  const list = el("ul", { className: "ladder-list" });
  labels.slice(0, lanes).forEach((label, lane) => list.append(el("li", { text: `${label} → ${p.bottom[p.ends[lane]]}` })));
  const help = el("p", { className: "muted arcade-line", text: "위 이름을 누르면 길을 따라갑니다" });
  const reveal = button("모두 공개", "ladder-all", () => { list.hidden = !list.hidden; }, "");
  list.hidden = true;
  wrap.replaceChildren(el("div", { className: "ladder" }, [help, heads, svg, feet, reveal, list]));
}

// ---- 눈치게임 ----
function renderNunchi(state, wrap) {
  const p = state.position;
  const name = (seat) => state.seats[seat]?.name || "누군가";
  const done = (p.called || []).some((item) => item.seat === ctx.mySeat) || p.pending?.seats.includes(ctx.mySeat);
  const big = el("button", { className: "nunchi-button", type: "button", id: "nunchi-call" });
  big.append(el("b", { text: p.phase === "countdown" ? "준비" : String(p.next) }), el("span", { text: p.phase === "countdown" ? "곧 시작" : done ? "외쳤어요" : "외치기!" }));
  big.disabled = state.status !== "playing" || p.phase !== "playing" || done;
  big.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (big.disabled) return;
    big.disabled = true;
    ctx.send({ type: "call" });
  });
  const chips = el("div", { className: "nunchi-called" });
  for (const item of p.called || []) chips.append(el("span", { className: "color-chip", style: `--c:${BALLOON_COLORS[item.seat % 4].fill}`, text: `${item.number} · ${name(item.seat)}` }));
  if (p.pending) chips.append(el("span", { className: "color-chip pending", style: "--c:#999", text: `${p.pending.number}! · ${p.pending.seats.map(name).join(", ")}` }));
  const losers = (p.losers || []).length ? el("p", { className: "nunchi-out", text: `걸린 사람: ${p.losers.map(name).join(", ")}` }) : el("span");
  wrap.replaceChildren(el("div", { className: "nunchi" }, [big, chips, losers, el("p", { className: "muted arcade-line", text: "가만히 있으면 12초 뒤 남은 사람이 모두 걸려요" })]));
}

// ---- 해적 룰렛 ----
function renderPirate(state, wrap) {
  const p = state.position;
  const myTurn = state.status === "playing" && state.turnSeat === ctx.mySeat;
  const barrel = el("div", { className: `pirate-barrel ${p.phase === "over" ? "popped" : ""}`, id: "pirate-barrel" });
  barrel.append(el("div", { className: "pirate-head", text: p.phase === "over" ? "🏴‍☠️💥" : "🏴‍☠️" }));
  const total = p.slots.length;
  p.slots.forEach((owner, slot) => {
    const angle = (slot / total) * Math.PI * 2 - Math.PI / 2;
    const b = el("button", { className: "pirate-slot", type: "button", "aria-label": `${slot + 1}번 칸`, style: `left:${50 + Math.cos(angle) * 40}%;top:${50 + Math.sin(angle) * 40}%` });
    if (owner != null) {
      b.classList.add("used");
      b.style.setProperty("--c", BALLOON_COLORS[owner % 4].fill);
      b.textContent = "🗡";
    }
    if (p.trap === slot) b.classList.add("trap");
    b.disabled = !myTurn || owner != null;
    b.addEventListener("click", () => ctx.send({ type: "stab", slot }));
    barrel.append(b);
  });
  wrap.replaceChildren(el("div", { className: "pirate" }, [barrel, el("p", { className: "muted arcade-line", text: `남은 칸 ${p.left} · 걸리는 칸은 하나` })]));
}

// ---- 초성퀴즈 ----
function renderChosung(state, wrap) {
  const p = state.position;
  const name = (seat) => state.seats[seat]?.name || "누군가";
  const card = el("div", { className: "chosung-card" });
  card.append(
    el("p", { className: "eyebrow", text: p.category ? `주제 · ${p.category}` : "준비" }),
    el("div", { className: "chosung-letters", text: p.answer && p.phase !== "round" ? p.answer : p.chosung || "…" }),
    el("p", { className: "muted", text: p.phase === "round" ? (p.hint ? `힌트: 첫 글자는 '${p.hint}'` : "힌트는 잠시 뒤에") : p.phase === "result" ? (p.solver == null ? "아무도 못 맞혔어요" : `${name(p.solver)} 정답!`) : "" }),
  );
  let form = document.getElementById("chosung-form");
  const keep = form && document.activeElement === form.querySelector("input");
  if (!form) {
    form = el("form", { className: "line-form", id: "chosung-form" });
    const input = el("input", { id: "chosung-input", placeholder: "정답 입력", autocomplete: "off", enterkeyhint: "send", maxlength: "20" });
    form.append(input, el("button", { type: "submit", className: "primary", text: "보내기" }));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      ctx.send({ type: "answer", text });
      input.value = "";
    });
  }
  form.querySelector("input").disabled = state.status !== "playing" || p.phase !== "round";
  const log = el("ul", { className: "chosung-log" });
  for (const guess of p.guesses || []) log.append(el("li", { className: guess.ok ? "ok" : "", text: guess.ok ? `${name(guess.seat)} 정답!` : `${name(guess.seat)}: ${guess.text}` }));
  wrap.replaceChildren(el("div", { className: "chosung" }, [card, form, log]));
  if (keep) form.querySelector("input").focus();
}

export function tickArcade(state, serverNow) {
  if (state?.game !== "chosung" || state.status !== "playing") return;
  const bar = document.querySelector("#clock span");
  const clock = document.getElementById("clock");
  const p = state.position;
  if (!bar || !clock) return;
  clock.hidden = p.phase !== "round";
  if (p.phase === "round") bar.style.width = `${Math.max(0, Math.min(1, (p.endsAt - serverNow) / p.duration)) * 100}%`;
}

// ---- 오셀로 ----
function othelloColor(state, seat) {
  return seat === state.position?.blackSeat ? "흑" : "백";
}

function renderOthello(state, wrap) {
  const p = state.position;
  const mine = state.status === "playing" && state.turnSeat === ctx.mySeat;
  const legal = new Set(mine ? p.legal : []);
  const flipped = new Set(p.flipped || []);
  const board = el("div", { className: "othello board", id: "othello" });
  p.board.forEach((value, index) => {
    const cell = el("button", { className: "oth-cell", type: "button", "aria-label": `${(index % 8) + 1}열 ${Math.floor(index / 8) + 1}줄` });
    cell.dataset.index = String(index);
    if (value) cell.append(el("i", { className: `disc ${value === 1 ? "black" : "white"}${flipped.has(index) ? " flip" : ""}` }));
    if (legal.has(index)) cell.classList.add("hint");
    if (p.last === index) cell.classList.add("last");
    cell.disabled = !legal.has(index);
    cell.addEventListener("click", () => ctx.send({ type: "place", index }));
    board.append(cell);
  });
  const score = el("p", { className: "muted arcade-line", text: `흑 ${p.counts.black} : 백 ${p.counts.white} · 나는 ${othelloColor(state, ctx.mySeat)}` });
  wrap.replaceChildren(score, board);
}
