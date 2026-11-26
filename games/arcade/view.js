// Screens for the newer room games: 풍선 터뜨리기, 짝 맞추기, 빙고, 수싸움, 찰나.
export const ARCADE_GAMES = new Set(["balloon", "memory", "bingo", "duel", "flash"]);

export const ARCADE_META = {
  balloon: ["풍선 터뜨리기", "1명에서 4명. 사람마다 색이 하나씩 정해집니다. 45초 동안 내 색 풍선만 터뜨리세요. 다른 색을 누르면 1점이 깎입니다."],
  memory: ["짝 맞추기", "1명에서 2명. 카드 두 장을 뒤집어 같은 그림이면 가져가고 한 번 더 합니다. 틀리면 차례가 넘어갑니다."],
  bingo: ["빙고", "2명에서 4명, 혼자면 봇과 합니다. 각자 다른 5×5 판을 받고, 돌아가며 숫자를 부릅니다. 먼저 3줄을 만들면 이깁니다."],
  duel: ["수싸움", "2명, 혼자면 봇과 합니다. 둘 다 1부터 9까지 카드를 들고 한 장씩 몰래 냅니다. 딱 1 높으면 이기고, 그 밖에는 낮은 카드가 이깁니다. 9판 뒤 많이 이긴 쪽이 승리."],
  flash: ["찰나", "2명에서 4명, 혼자면 봇과 합니다. 위에 보이는 카드가 가운데에 나오는 순간 먼저 누르세요. 너무 빨리 누르면 1점이 깎이고 그 판은 쉽니다. 5점 먼저."],
};

export const BALLOON_COLORS = [
  { name: "빨강", fill: "#e5484d" },
  { name: "파랑", fill: "#3e7bfa" },
  { name: "노랑", fill: "#f0b400" },
  { name: "초록", fill: "#30a46c" },
];

const REASON = { time: "시간이 끝났습니다", cleared: "모든 짝을 찾았습니다", pairs: "모든 짝을 찾았습니다", bingo: "빙고!", rounds: "9판이 끝났습니다", points: "끝났습니다" };

let ctx = null;
const pending = new Set();
const myPops = [];

export function arcadeTurn(state, mySeat, secret) {
  const p = state.position || {};
  const name = (seat) => state.seats[seat]?.name || "누군가";
  if (state.status === "waiting") {
    const min = { balloon: 1, memory: 1, bingo: 2, duel: 2, flash: 2 }[state.game];
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
  if (state.game === "memory" && state.seats.length === 1) return `다 찾았어요! · ${state.position.flips?.[0] ?? 0}번 뒤집음`;
  if (state.draw || state.winnerSeat == null) return `무승부 · ${why}`;
  return `${state.seats[state.winnerSeat]?.name || "승자"} 승리 · ${why}`;
}

export function arcadeScore(state, index) {
  const p = state.position || {};
  if (state.status === "waiting") return "";
  if (state.game === "bingo") return ` ${p.lines?.[index] ?? 0}줄`;
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
    wrap.replaceChildren(waitingCard(state));
    if (context.mySeat === 0) actions.append(button("시작", "start", () => context.send({ type: "start" }), "primary"));
    return;
  }
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
