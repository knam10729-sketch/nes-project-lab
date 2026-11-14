const CATS = [["food", "음식"], ["animal", "동물"], ["place", "장소"], ["job", "직업"], ["thing", "물건"], ["show", "영화·드라마"]];
const YUT_COLORS = ["#171717", "#f4f1ea", "#c4554a", "#2a6f97"];
const DRAW_COLORS = ["#171717", "#f4f1ea", "#c4554a", "#d38b2c", "#2f7d4a", "#2a6f97", "#6b4c9a", "#8a5a44"];
const SPOTS = {
  a1: [5, 4], a2: [5, 3], a3: [5, 2], a4: [5, 1], a5: [5, 0],
  b1: [4, 0], b2: [3, 0], b3: [2, 0], b4: [1, 0], b5: [0, 0],
  c1: [0, 1], c2: [0, 2], c3: [0, 3], c4: [0, 4], c5: [0, 5],
  d1: [1, 5], d2: [2, 5], d3: [3, 5], d4: [4, 5],
  s1: [4, 1], s2: [3, 2], center: [2.5, 2.5], s3: [2, 3], s4: [1, 4],
  t1: [1, 1], t2: [2, 2], t3: [3, 3], t4: [4, 4],
};
const SPOT_LABEL = { a5: "첫 모", b5: "둘째 모", c5: "셋째 모", center: "가운데", home: "집", end: "완주" };

let teamChoice = false;
let selectedThrow = null;
let drawColor = DRAW_COLORS[0];
let erasing = false;
let drawBuffer = [];
let drawAnchor = null;
let drawId = 0;
let lastFlush = 0;
let drawing = false;
const localInk = new Set();

export function partyTurn(state, mySeat, secret) {
  const mine = state.turnSeat === mySeat;
  if (state.status === "over") return resultLine(state);
  if (state.game === "yut") {
    if (state.status === "waiting") return mySeat === 0 ? "인원이 모이면 시작하세요" : "방장을 기다리는 중";
    if (state.position.phase === "throw") return mine ? "윷을 던지세요" : "윷을 던지는 중";
    if (state.position.last) return mine ? `말을 고르세요 · ${state.position.last.name}` : "말이 움직이는 중";
    return mine ? "말을 고르세요" : "상대가 말을 고르는 중";
  }
  if (state.game === "liar") {
    if (state.status === "waiting") return mySeat === 0 ? "주제를 고르고 시작하세요" : "방장을 기다리는 중";
    if (state.position.phase === "hint") return mine ? "한 줄 힌트를 말하세요" : "힌트를 듣는 중";
    if (state.position.phase === "vote") return "라이어에게 투표하세요";
    if (state.position.phase === "guess") return mine ? "단어를 맞혀 보세요" : "라이어가 단어를 맞히는 중";
  }
  if (state.game === "mafia") {
    if (state.status === "waiting") return mySeat === 0 ? "4명 이상이면 시작하세요" : "방장을 기다리는 중";
    if (state.status === "over") return resultLine(state);
    if (!secret?.alive && state.position.phase !== "over") return "탈락했습니다. 결과는 볼 수 있습니다.";
    if (state.position.phase === "night") return secret?.role === "citizen" ? "밤입니다. 눈을 감고 기다리세요" : "밤 행동을 고르세요";
    if (state.position.phase === "day") return "낮입니다. 소리 내어 이야기하세요";
    if (state.position.phase === "vote") return "의심되는 사람에게 투표하세요";
  }
  if (state.game === "draw") {
    if (state.status === "waiting") return mySeat === 0 ? "인원이 모이면 시작하세요" : "방장을 기다리는 중";
    if (secret?.role === "drawer") return `그릴 단어 · ${secret.word}`;
    if (state.position.hint) return `힌트 ${state.position.hint}`;
    return "그림을 맞히세요";
  }
  return "게임 중";
}

export function renderParty({ state, secret, mySeat, send }) {
  if (state.game === "yut") renderYut(state, mySeat, send);
  if (state.game === "liar") renderLiar(state, secret, mySeat, send);
  if (state.game === "draw") renderDraw(state, secret, mySeat, send);
  if (state.game === "mafia") renderMafia(state, secret, mySeat, send);
}

export function applyInk(stroke) {
  if (!stroke || localInk.has(stroke.id)) return;
  const canvas = document.getElementById("draw-canvas");
  if (!canvas) return;
  paint(canvas.getContext("2d"), canvas, stroke);
}

export function syncDrawClock(state) {
  const clock = document.getElementById("clock");
  const bar = clock?.querySelector("span");
  if (!clock || !bar || state?.game !== "draw" || state.position.phase !== "draw") return false;
  clock.hidden = false;
  const left = state.position.endsAt - (Date.now() + (state.now ? state.now - Date.now() : 0));
  const ratio = Math.max(0, Math.min(1, left / (state.position.duration || 80000)));
  bar.style.width = `${ratio * 100}%`;
  const turn = document.getElementById("turn");
  if (turn && left >= 0) turn.textContent = `${turn.dataset.base || turn.textContent.split(" · ")[0]} · ${Math.max(0, Math.ceil(left / 1000))}초`;
  return true;
}

function renderYut(state, mySeat, send) {
  const wrap = document.getElementById("board-wrap");
  const board = el("div", { className: "yut-board", id: "board" });
  board.innerHTML = `<svg viewBox="0 0 5 5" aria-hidden="true"><rect x="0" y="0" width="5" height="5" fill="none"></rect><line x1="5" y1="0" x2="0" y2="5"></line><line x1="0" y1="0" x2="5" y2="5"></line></svg>`;
  const grouped = new Map();
  for (const piece of state.position.pieces) {
    if (piece.node === "home" || piece.node === "end") continue;
    const list = grouped.get(piece.node) || [];
    list.push(piece);
    grouped.set(piece.node, list);
  }
  for (const [node, at] of Object.entries(SPOTS)) {
    const button = el("button", { className: "spot", type: "button" });
    button.style.left = `${(at[0] / 5) * 86 + 7}%`;
    button.style.top = `${(at[1] / 5) * 86 + 7}%`;
    const pile = grouped.get(node) || [];
    pile.forEach((piece) => button.append(token(piece.owner)));
    if (pile.length > 1) button.append(el("b", { text: String(pile.length) }));
    button.setAttribute("aria-label", spotName(node));
    button.addEventListener("click", () => choosePiece(state, mySeat, send, pile[0]?.id));
    board.append(button);
  }
  wrap.replaceChildren(piecePicker(state, mySeat, send), board);
  const actions = document.getElementById("actions");
  actions.replaceChildren();
  const score = document.getElementById("scoreboard");
  const scores = el("div", { className: "scores" });
  const owners = state.position.teams ? 2 : state.seats.length;
  for (let owner = 0; owner < owners; owner += 1) {
    const card = el("div", {});
    const label = state.position.teams ? `${owner + 1}팀` : state.seats[owner]?.name || `${owner + 1}번`;
    card.append(el("span", { text: label }), el("strong", { text: `${state.position.finished?.[owner] || 0}/4` }));
    scores.append(card);
  }
  score.replaceChildren(scores);
  if (state.status === "waiting" && mySeat === 0) {
    if (state.seats.length === 4) {
      const toggle = el("button", { type: "button", text: teamChoice ? "두 팀으로 시작" : "각자 시작" });
      toggle.addEventListener("click", () => { teamChoice = !teamChoice; renderYut(state, mySeat, send); });
      actions.append(toggle);
    }
    actions.append(press("시작", "start", () => send({ type: "start", teams: teamChoice }), "primary"));
  }
  if (state.position.phase === "throw" && state.turnSeat === mySeat) {
    actions.append(press(state.position.pending.length ? "한 번 더 던지기" : "윷 던지기", "toss", () => send({ type: "toss" }), "primary"));
  }
  if (state.position.phase === "move" && state.turnSeat === mySeat) {
    const stuck = state.position.pending.filter((ticket) => !state.position.options.some((option) => option.throwId === ticket.id));
    for (const ticket of stuck) actions.append(press(`${ticket.name} 버리기`, "burn", () => send({ type: "burn", throwId: ticket.id })));
  }
  if (state.status === "over") actions.append(press("한 판 더", "rematch", () => send({ type: "rematch" }), "primary"));
  const note = document.getElementById("note");
  if (note && state.position.last && state.status === "playing") note.textContent = `나온 윷 · ${state.position.last.name}`;
}

function piecePicker(state, mySeat, send) {
  const box = el("div", { className: "piece-picker" });
  if (state.position.phase !== "move" || state.turnSeat !== mySeat) return box;
  if (!state.position.pending.some((ticket) => ticket.id === selectedThrow)) selectedThrow = state.position.pending[0]?.id ?? null;
  for (const ticket of state.position.pending) {
    const chip = el("button", { type: "button", className: ticket.id === selectedThrow ? "primary" : "", text: ticket.name });
    chip.addEventListener("click", () => { selectedThrow = ticket.id; renderYut(state, mySeat, send); });
    box.append(chip);
  }
  const owner = state.position.teams ? mySeat % 2 : mySeat;
  const seen = new Set();
  let homeNumber = 0;
  for (const piece of state.position.pieces) {
    if (piece.owner !== owner || piece.node === "end") continue;
    const key = piece.node === "home" ? piece.id : piece.node;
    if (seen.has(key)) continue;
    seen.add(key);
    const option = state.position.options.find((item) => item.pieceId === piece.id);
    const atHome = piece.node === "home";
    if (atHome) homeNumber += 1;
    const count = atHome ? 1 : state.position.pieces.filter((item) => item.owner === owner && item.node === piece.node).length;
    const button = el("button", { type: "button", text: atHome ? `집에서 출발 ${homeNumber}` : `${spotName(piece.node)} · ${count > 1 ? `${count}개` : "말 1"}` });
    button.disabled = !option;
    button.addEventListener("click", () => choosePiece(state, mySeat, send, piece.id));
    box.append(button);
  }
  return box;
}

function choosePiece(state, mySeat, send, pieceId) {
  if (!pieceId || state.turnSeat !== mySeat) return;
  const mine = state.position.options.filter((item) => item.pieceId === pieceId || sameStack(state, pieceId, item.pieceId));
  const option = mine.find((item) => item.throwId === selectedThrow) || mine[0] || state.position.options.find((item) => {
    const piece = state.position.pieces.find((candidate) => candidate.id === pieceId);
    const target = state.position.pieces.find((candidate) => candidate.id === item.pieceId);
    return piece && target && piece.node === target.node && piece.owner === target.owner;
  });
  if (!option) return;
  send({ type: "move", pieceId: option.pieceId, throwId: option.throwId });
}

function renderLiar(state, secret, mySeat, send) {
  const wrap = document.getElementById("board-wrap");
  const card = el("div", { className: "secret-card panel" });
  if (state.status === "waiting") card.append(el("p", { text: "3명에서 5명. 한 사람만 단어를 모릅니다." }));
  else if (secret?.role === "liar") card.append(el("p", { className: "eyebrow", text: "라이어" }), el("h2", { text: secret.category || state.position.category || "주제" }), el("p", { text: "단어는 모릅니다. 힌트만 듣고 감추세요." }));
  else card.append(el("p", { className: "eyebrow", text: state.position.category || "주제" }), el("h2", { text: secret?.word || "단어 확인 중" }));
  const log = el("ol", { className: "chat" });
  for (const hint of state.position.hints || []) {
    const item = el("li", {});
    item.append(el("b", { text: state.seats[hint.seat]?.name || "" }), document.createTextNode(` ${hint.text}`));
    log.append(item);
  }
  wrap.replaceChildren(card, log);
  const actions = document.getElementById("actions");
  actions.replaceChildren();
  document.getElementById("scoreboard").replaceChildren();
  if (state.status === "waiting" && mySeat === 0) {
    const select = document.createElement("select");
    select.id = "category";
    for (const [id, label] of CATS) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = label;
      select.append(option);
    }
    actions.append(select, press("시작", "start", () => send({ type: "start", category: select.value }), "primary"));
  }
  if (state.position.phase === "hint" && state.turnSeat === mySeat) actions.append(lineBox("힌트 보내기", "hint", (text) => send({ type: "hint", text })));
  if (state.position.phase === "vote") {
    const voted = (state.position.voted || []).includes(mySeat);
    if (!voted) {
      state.seats.forEach((seat, index) => {
        if (index === mySeat) return;
        actions.append(press(seat.name, `vote-${index}`, () => send({ type: "vote", target: index })));
      });
    }
  }
  if (state.position.phase === "guess" && state.turnSeat === mySeat) actions.append(lineBox("단어 제출", "guess", (text) => send({ type: "guess", text })));
  if (state.status === "over") {
    if (state.position.word) {
      const note = document.getElementById("note");
      if (note) note.textContent = `단어는 ${state.position.word}이었습니다.`;
    }
    actions.append(press("한 판 더", "rematch", () => send({ type: "rematch" }), "primary"));
  }
}

function renderMafia(state, secret, mySeat, send) {
  const wrap = document.getElementById("board-wrap");
  const card = el("div", { className: "secret-card panel" });
  if (state.status === "waiting") {
    card.append(el("p", { text: "4명에서 10명이 모이면 방장이 시작합니다. 역할은 각자 폰에만 보입니다." }));
  } else if (secret) {
    card.append(el("p", { className: "eyebrow", text: secret.alive ? "내 역할" : "탈락 · 내 역할" }), el("h2", { text: secret.label }));
    card.append(el("p", { text: roleHelp(secret.role) }));
    if (secret.role === "mafia") {
      const names = secret.allies.map((seat) => state.seats[seat]?.name).filter(Boolean);
      card.append(el("p", { text: names.length ? `같은 마피아 · ${names.join(", ")}` : "같은 마피아는 없습니다." }));
    }
    if (secret.investigation) {
      const name = state.seats[secret.investigation.target]?.name || "그 사람";
      card.append(el("p", { text: secret.investigation.mafia ? `${name} 님은 마피아입니다.` : `${name} 님은 마피아가 아닙니다.` }));
    }
  }
  const log = el("ol", { className: "mafia-log" });
  for (const entry of state.position.log || []) log.append(el("li", { text: logLine(state, entry) }));
  if (state.position.phase === "over" && state.position.roles) {
    const reveal = el("ul", { className: "mafia-log" });
    state.position.roles.forEach((role, index) => reveal.append(el("li", { text: `${state.seats[index]?.name || "손님"} · ${role.label}` })));
    wrap.replaceChildren(card, log, reveal);
  } else wrap.replaceChildren(card, log);
  const actions = document.getElementById("actions");
  actions.replaceChildren();
  document.getElementById("scoreboard").replaceChildren();
  if (state.status === "waiting" && mySeat === 0) actions.append(press("시작", "start", () => send({ type: "start" }), "primary"));
  if (state.status === "playing" && mySeat === 0) actions.append(press("다음 단계", "advance", () => send({ type: "advance" })));
  if (state.position.phase === "night" && secret?.alive && secret.role !== "citizen" && !secret.acted) {
    livingSeats(state).forEach((index) => {
      if (secret.role === "mafia" && (index === mySeat || secret.allies.includes(index))) return;
      actions.append(press(state.seats[index].name, `night-${index}`, () => send({ type: "night", target: index })));
    });
  }
  if (state.position.phase === "vote" && secret?.alive && !(state.position.voted || []).includes(mySeat)) {
    livingSeats(state).forEach((index) => {
      if (index === mySeat) return;
      actions.append(press(state.seats[index].name, `vote-${index}`, () => send({ type: "vote", target: index })));
    });
  }
  if (state.status === "over") actions.append(press("한 판 더", "rematch", () => send({ type: "rematch" }), "primary"));
}

function livingSeats(state) {
  return state.position.alive.map((on, index) => on ? index : -1).filter((index) => index >= 0);
}

function roleHelp(role) {
  if (role === "mafia") return "밤에는 함께 한 명을 고릅니다. 낮에는 시민인 척하세요.";
  if (role === "police") return "밤에는 한 명을 조사합니다. 결과는 이 폰에만 남습니다.";
  if (role === "doctor") return "밤에는 한 명을 지킵니다. 그 사람이 지목되면 살아남습니다.";
  return "밤에는 기다리세요. 낮 이야기와 투표로 마피아를 찾습니다.";
}

function logLine(state, entry) {
  const name = (seat) => state.seats[seat]?.name || "누군가";
  if (entry.kind === "night-start") return `${entry.round}번째 밤입니다.`;
  if (entry.kind === "night-death") return `${name(entry.seat)} 님이 밤 사이 쓰러졌습니다.`;
  if (entry.kind === "quiet") return "밤은 조용히 지나갔습니다.";
  if (entry.kind === "vote-start") return "투표를 시작합니다.";
  if (entry.kind === "execute") return `${name(entry.seat)} 님이 투표로 퇴장했습니다.`;
  if (entry.kind === "tie") return "표가 갈려 아무도 퇴장하지 않았습니다.";
  if (entry.kind === "win") return entry.winner === "town" ? "시민 팀이 이겼습니다." : "마피아 팀이 이겼습니다.";
  return "";
}

function renderDraw(state, secret, mySeat, send) {
  const wrap = document.getElementById("board-wrap");
  let canvas = document.getElementById("draw-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "draw-canvas";
    canvas.width = 800;
    canvas.height = 560;
    bindCanvas(canvas, send);
    wrap.replaceChildren(canvas);
  }
  const seen = canvas.dataset.signature;
  const signature = `${state.round}:${state.position.strokes.length}:${state.position.phase}`;
  if (seen !== signature) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of state.position.strokes) paint(ctx, canvas, stroke);
    canvas.dataset.signature = signature;
  }
  const actions = document.getElementById("actions");
  const draft = document.getElementById("line")?.value || "";
  actions.replaceChildren();
  if (state.status === "waiting") {
    actions.append(drawTimes(state, mySeat, send));
    if (mySeat === 0) actions.append(press("시작", "start", () => send({ type: "start" }), "primary"));
  }
  if (state.position.phase === "draw" && state.turnSeat === mySeat) {
    const colors = el("div", { className: "swatches" });
    for (const color of DRAW_COLORS) {
      const swatch = el("button", { type: "button", className: "swatch" });
      swatch.style.background = color;
      swatch.setAttribute("aria-label", "색");
      if (color === drawColor && !erasing) swatch.classList.add("on");
      swatch.addEventListener("click", () => { drawColor = color; erasing = false; });
      colors.append(swatch);
    }
    actions.append(colors, press(erasing ? "지우개 사용 중" : "지우개", "eraser", () => { erasing = !erasing; }), press("모두 지우기", "clear", () => send({ type: "clear" })));
  }
  if (state.position.phase === "draw" && state.turnSeat !== mySeat && !(state.position.solved || []).includes(mySeat)) {
    actions.append(lineBox("정답 보내기", "guess", (text) => send({ type: "guess", text }), draft));
  }
  if (state.status === "over") actions.append(press("한 판 더", "rematch", () => send({ type: "rematch" }), "primary"));
  const score = document.getElementById("scoreboard");
  const scores = el("div", { className: "scores" });
  state.seats.forEach((seat, index) => {
    const card = el("div", { className: index === mySeat ? "me" : "" });
    card.append(el("span", { text: seat.name }), el("strong", { text: String(state.position.scores?.[index] || 0) }));
    scores.append(card);
  });
  score.replaceChildren(scores);
  const clock = document.getElementById("clock");
  if (clock) clock.hidden = state.position.phase !== "draw";
  const log = document.getElementById("draw-log") || el("ol", { className: "chat", id: "draw-log" });
  log.replaceChildren();
  if (state.position.previous && state.position.phase === "draw") log.append(el("li", { text: `이전 단어 · ${state.position.previous}` }));
  if (state.position.reveal) log.append(el("li", { text: `정답 · ${state.position.reveal}` }));
  for (const item of state.position.log || []) {
    const row = el("li", {});
    row.append(el("b", { text: state.seats[item.seat]?.name || "" }), document.createTextNode(item.correct ? " 맞혔습니다" : ` ${item.text}`));
    log.append(row);
  }
  if (!log.parentElement) wrap.append(log);
}

function bindCanvas(canvas, send) {
  const point = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * 1000);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * 1000);
    return [Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(1000, y))];
  };
  const flush = (force) => {
    if (!drawBuffer.length) return;
    const now = Date.now();
    if (!force && now - lastFlush < 70 && drawBuffer.length < 16) return;
    const points = drawAnchor ? [drawAnchor, ...drawBuffer.splice(0, 23)] : drawBuffer.splice(0, 24);
    drawAnchor = points[points.length - 1];
    const id = `s${Date.now().toString(36)}${drawId += 1}`;
    const stroke = { id, color: drawColor, erase: erasing, points };
    localInk.add(id);
    lastFlush = now;
    send(strokeMessage(stroke));
    if (drawBuffer.length) flush(true);
  };
  canvas.addEventListener("pointerdown", (event) => {
    if (!drawerNow()) return;
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    drawAnchor = null;
    drawBuffer = [point(event)];
    paint(canvas.getContext("2d"), canvas, { color: drawColor, erase: erasing, points: drawBuffer });
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drawing) return;
    drawBuffer.push(point(event));
    const tail = drawBuffer.slice(-2);
    paint(canvas.getContext("2d"), canvas, { color: drawColor, erase: erasing, points: tail });
    flush(false);
  });
  const stop = () => { if (!drawing) return; drawing = false; flush(true); };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
}

function drawerNow() {
  return latestSafe()?.game === "draw" && latestSafe().position.phase === "draw" && latestSafe().turnSeat === window.__mySeat;
}

function strokeMessage(stroke) {
  return { type: "stroke", stroke };
}

function paint(ctx, canvas, stroke) {
  if (!stroke.points?.length) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.erase ? 34 : 8;
  ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.color || "#171717";
  ctx.beginPath();
  stroke.points.forEach(([x, y], index) => {
    const px = (x / 1000) * canvas.width;
    const py = (y / 1000) * canvas.height;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  if (stroke.points.length === 1) ctx.lineTo(stroke.points[0][0] / 1000 * canvas.width + 0.1, stroke.points[0][1] / 1000 * canvas.height);
  ctx.stroke();
  ctx.restore();
}

function latestSafe() {
  return window.__latestGame || null;
}

function drawTimes(state, mySeat, send) {
  const box = el("div", { className: "times" });
  const current = state.time?.drawSeconds || 80;
  box.append(el("p", { className: "muted", text: `그리는 시간 ${current}초` }));
  if (mySeat === 0) {
    for (const value of [40, 60, 80, 100, 120]) {
      const button = el("button", { type: "button", className: value === current ? "primary" : "", text: `${value}초` });
      button.addEventListener("click", () => send({ type: "settings", seconds: value }));
      box.append(button);
    }
  }
  return box;
}

function lineBox(label, id, onSend, draft = "") {
  const form = el("form", { className: "share" });
  const input = el("input", { id: "line" });
  input.maxLength = 40;
  input.placeholder = label;
  input.value = draft;
  input.setAttribute("aria-label", label);
  const button = el("button", { id, type: "submit", className: "primary", text: label });
  form.append(input, button);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    onSend(text);
  });
  return form;
}

function press(text, id, onClick, className = "") {
  const button = el("button", { id, type: "button", className, text });
  if (onClick) button.addEventListener("click", onClick);
  return button;
}

function token(owner) {
  const mark = el("i", { className: "yut-piece" });
  mark.style.background = YUT_COLORS[owner % YUT_COLORS.length];
  if (owner % YUT_COLORS.length === 1) mark.style.boxShadow = "inset 0 0 0 2px #171717";
  return mark;
}

function sameStack(state, leftId, rightId) {
  const left = state.position.pieces.find((piece) => piece.id === leftId);
  const right = state.position.pieces.find((piece) => piece.id === rightId);
  return Boolean(left && right && left.owner === right.owner && left.node === right.node && left.node !== "home");
}

function spotName(node) {
  if (SPOT_LABEL[node]) return SPOT_LABEL[node];
  if (node?.startsWith("s") || node?.startsWith("t")) return "지름길";
  return "길";
}

function resultLine(state) {
  if (state.reason === "caught") return "시민 승리 · 라이어를 찾았습니다";
  if (state.reason === "escaped" || state.reason === "guessed") {
    const name = state.seats[state.winnerSeat]?.name || "라이어";
    return state.reason === "guessed" ? `${name} 승리 · 단어를 맞혔습니다` : `${name} 승리 · 라이어가 숨었습니다`;
  }
  if (state.reason === "finish" || state.reason === "team") {
    const name = state.seats[state.winnerSeat]?.name || "승자";
    return state.reason === "team" ? `${state.winnerSeat === 0 ? "1팀" : "2팀"} 승리` : `${name} 승리 · 말이 모두 들어왔습니다`;
  }
  if (state.reason === "town") return "시민 승리 · 마피아를 모두 찾았습니다";
  if (state.reason === "mafia") return "마피아 승리 · 수를 넘겼습니다";
  if (state.reason === "score") {
    if (state.draw || state.winnerSeat == null) return "무승부 · 최종 점수";
    return `${state.seats[state.winnerSeat]?.name || "승자"} 승리 · 최종 점수`;
  }
  return "게임이 끝났습니다";
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

export function remember(state, seat) {
  window.__latestGame = state;
  window.__mySeat = seat;
}
