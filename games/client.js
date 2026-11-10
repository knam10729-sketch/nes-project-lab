import { applyInk, partyTurn, remember, renderParty } from "./party.js";
import { drawQr } from "./qr.js";

const PARTY = new Set(["yut", "liar", "draw"]);
const META = {
  gomoku: ["오목", "15줄 판에서 번갈아 둡니다. 가로, 세로, 대각선으로 다섯 칸 이상 이어지면 이깁니다."],
  chess: ["체스", "캐슬링, 앙파상, 프로모션, 체크, 체크메이트, 스테일메이트까지 정식 규칙으로 둡니다."],
  janggi: ["장기", "궁성 대각선과 마·상의 막힘을 지키며 둡니다. 포는 포를 넘거나 잡을 수 없고, 장군과 외통을 가립니다."],
  mole: ["두더지 잡기 대결", "60초 동안 같은 두더지가 모두에게 동시에 나옵니다. 먼저 누른 사람이 점수를 가져갑니다. 1명에서 4명까지 할 수 있습니다."],
  yut: ["윷놀이", "2명에서 4명. 윷을 던져 말을 움직이고, 업기, 잡기, 지름길을 서버가 판정합니다."],
  liar: ["라이어 게임", "3명에서 5명. 한 사람만 단어를 모릅니다. 힌트를 주고 라이어를 찾으세요."],
  draw: ["그림 맞히기", "2명에서 5명이 번갈아 그립니다. 먼저, 그리고 빠르게 맞힐수록 점수가 오릅니다."],
};

const REASONS = {
  five: "다섯 칸 이상을 이었습니다",
  full: "더 둘 곳이 없습니다",
  checkmate: "체크메이트",
  stalemate: "스테일메이트",
  wetong: "외통",
  bikjang: "빅장",
  pass: "양쪽이 한수쉼을 했습니다",
  time: "시간이 끝났습니다",
};

const CHESS_LETTER = { k: "K", q: "Q", r: "R", b: "B", n: "N", p: "P" };
const CHESS_NAME = { k: "킹", q: "퀸", r: "룩", b: "비숍", n: "나이트", p: "폰" };
const PROMOTE = { q: "퀸", r: "룩", b: "비숍", n: "나이트" };
const JANGGI_NAME = { rook: "차", horse: "마", elephant: "상", guard: "사", cannon: "포", king: "궁", soldier: "졸" };

const app = document.getElementById("app");
const parts = location.pathname.split("/").filter(Boolean);
const game = parts[1];
const roomId = parts[2] || "";
const meta = META[game];

let token = "";
let mySeat = null;
let socket = null;
let latest = null;
let selected = null;
let delay = 400;
let failures = 0;
let stopped = false;
let skew = 0;
let secret = null;
let syncedEnd = false;
let frame = 0;

if (!meta) {
  app.append(el("p", { className: "lead", text: "없는 게임입니다." }), linkHome());
} else if (!roomId) {
  document.title = `${meta[0]} | 정한.kr`;
  mountSetup();
} else {
  document.title = `${meta[0]} 방 | 정한.kr`;
  enterRoom();
}

function mountSetup() {
  const saved = localStorage.getItem("nes-play-name") || "";
  const form = el("form", { className: "setup panel" });
  form.append(
    el("p", { className: "eyebrow", text: "ROOM" }),
    el("h1", { text: meta[0] }),
    el("p", { className: "copy", text: meta[1] }),
  );
  const label = el("label", { text: "내 이름" });
  label.htmlFor = "nickname";
  const input = el("input", { id: "nickname" });
  input.maxLength = 12;
  input.value = saved;
  input.required = true;
  input.autocomplete = "nickname";
  const button = el("button", { className: "primary", id: "create", type: "submit", text: "방 만들기" });
  const note = el("p", { className: "note", id: "note" });
  const difficulty = { value: "easy" };
  const diff = el("div", { className: "diff" });
  const easy = el("button", { type: "button", id: "easy", className: "primary", text: "쉬움" });
  const normal = el("button", { type: "button", id: "normal", text: "보통" });
  easy.addEventListener("click", () => {
    difficulty.value = "easy";
    easy.className = "primary";
    normal.className = "";
  });
  normal.addEventListener("click", () => {
    difficulty.value = "normal";
    normal.className = "primary";
    easy.className = "";
  });
  diff.append(easy, normal);
  let category = null;
  if (game === "liar") {
    category = document.createElement("select");
    category.id = "setup-category";
    for (const [id, labelText] of [["food", "음식"], ["animal", "동물"], ["place", "장소"], ["job", "직업"], ["thing", "물건"], ["show", "영화·드라마"]]) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = labelText;
      category.append(option);
    }
  }
  const solo = el("button", { type: "button", id: "solo", text: "혼자서 봇과 하기" });
  solo.addEventListener("click", async () => {
    solo.disabled = true;
    note.textContent = "봇과 방을 만드는 중";
    try {
      await createAndEnter(input.value, { solo: true, difficulty: difficulty.value, category: category?.value || "food" });
    } catch (error) {
      note.textContent = error.message;
      solo.disabled = false;
    }
  });
  form.append(label, input, button, el("p", { className: "copy", text: "혼자라면 난이도를 고르고 봇과 둘 수 있습니다." }), diff, ...(category ? [category] : []), solo, note);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    button.disabled = true;
    note.textContent = "방을 만드는 중";
    try {
      await createAndEnter(input.value, {});
    } catch (error) {
      note.textContent = error.message;
      button.disabled = false;
    }
  });
  app.append(form, el("p", {}, [linkHome()]));
}

async function enterRoom() {
  const saved = readSeat();
  if (saved.token) {
    await joinAndConnect(saved.name || localStorage.getItem("nes-play-name") || "손님", saved.token);
    return;
  }
  const form = el("form", { className: "setup panel" });
  const input = el("input", { id: "nickname" });
  input.maxLength = 12;
  input.value = localStorage.getItem("nes-play-name") || "";
  input.required = true;
  input.autocomplete = "nickname";
  const button = el("button", { className: "primary", id: "join", type: "submit", text: "입장하기" });
  const note = el("p", { className: "note", id: "note" });
  form.append(
    el("p", { className: "eyebrow", text: meta[0] }),
    el("h1", { text: "방에 입장" }),
    el("p", { className: "copy", text: "이름을 입력하면 빈자리에 앉습니다. 이 브라우저에서 나가도 같은 링크로 돌아오면 그 자리를 다시 앉습니다." }),
    el("label", { text: "내 이름", id: "name-label" }),
    input,
    button,
    note,
  );
  form.querySelector("label").htmlFor = "nickname";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    button.disabled = true;
    note.textContent = "들어가는 중";
    await joinAndConnect(input.value, "");
  });
  app.append(form);
}

async function joinAndConnect(name, existingToken) {
  try {
    const data = await post(`/play-api/rooms/${roomId}/join`, { name, token: existingToken });
    token = data.token;
    mySeat = data.seat;
    localStorage.setItem("nes-play-name", name.trim() || "손님");
    localStorage.setItem(`nes-play:${roomId}`, JSON.stringify({ token, name, game }));
    mountTable();
    connect();
  } catch (error) {
    const note = document.getElementById("note");
    const button = document.getElementById("join");
    if (note && button) {
      note.textContent = error.message;
      button.disabled = false;
      return;
    }
    app.replaceChildren(el("div", { className: "panel" }, [
      el("h1", { text: meta[0] }),
      el("p", { className: "copy", text: error.message }),
      linkHome(),
    ]));
  }
}

function mountTable() {
  const hud = el("section", { className: "hud", id: "hud" });
  const share = el("div", { className: "share" });
  const link = el("input", { id: "link" });
  link.readOnly = true;
  link.value = location.href;
  link.setAttribute("aria-label", "방 링크");
  const copy = el("button", { id: "copy", type: "button", text: "링크 복사" });
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setNote("링크를 복사했습니다.");
    } catch {
      link.focus();
      link.select();
      setNote("링크를 길게 눌러 복사해 주세요.");
    }
  });
  share.append(link, copy, el("button", { id: "qr-open", type: "button", text: "QR 보기" }));
  share.querySelector("#qr-open").addEventListener("click", () => openQr());
  const qrCard = el("div", { className: "qr-card", id: "qr-card" });
  const qrCanvas = document.createElement("canvas");
  qrCanvas.width = 360;
  qrCanvas.height = 360;
  qrCanvas.id = "qr-canvas";
  qrCanvas.setAttribute("role", "img");
  qrCanvas.setAttribute("aria-label", "방 입장 QR 코드. 누르면 크게 봅니다.");
  drawQr(qrCanvas, location.href);
  qrCanvas.addEventListener("click", () => openQr());
  qrCard.append(qrCanvas, el("p", { className: "muted", text: "휴대폰 카메라로 비추면 바로 들어옵니다." }));
  app.replaceChildren(
    hud,
    share,
    qrCard,
    el("div", { id: "scoreboard" }),
    el("div", { className: "clock", id: "clock", hidden: true }, [el("span")]),
    el("div", { className: "board-wrap", id: "board-wrap" }),
    el("div", { className: "actions", id: "actions" }),
    el("p", { className: "note", id: "note", role: "status" }),
  );
  frame = requestAnimationFrame(tickClock);
}

function connect() {
  if (stopped) return;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/play-api/rooms/${roomId}/ws?token=${encodeURIComponent(token)}`);
  socket = ws;
  ws.addEventListener("open", () => {
    failures = 0;
    delay = 400;
    send({ type: "hello" });
  });
  ws.addEventListener("message", (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === "welcome") mySeat = message.seat;
    if (message.type === "ink") applyInk(message.stroke);
    if (message.type === "state") {
      secret = message.secret || null;
      render(message.state);
    }
    if (message.type === "error") {
      setNote(message.error);
      latest?.position?.active?.forEach((mole) => { delete mole.sent; });
    }
  });
  ws.addEventListener("close", () => {
    if (stopped || socket !== ws) return;
    failures += 1;
    if (failures > 6) {
      setNote("연결이 잠시 끊겼습니다. 새로고침하면 같은 자리로 돌아옵니다.");
      return;
    }
    setNote("다시 연결하는 중");
    setTimeout(connect, delay);
    delay = Math.min(delay * 2, 8000);
  });
}

function render(state) {
  latest = state;
  remember(state, mySeat);
  skew = state.now - Date.now();
  if (state.turnSeat !== mySeat) {
    selected = null;
    document.getElementById("promote")?.remove();
  }
  if (state.position?.phase !== "playing") syncedEnd = false;
  const hud = document.getElementById("hud");
  hud.replaceChildren(
    el("div", {}, [
      el("p", { className: "eyebrow", text: `${meta[0]} · ${state.round}판` }),
      el("h2", { className: "turn", id: "turn", text: turnText(state) }),
    ]),
  );
  const players = el("ol", { className: "players" });
  state.seats.forEach((seat, index) => {
    const item = el("li", { className: index === mySeat ? "me" : "" });
    if (index === state.turnSeat) item.classList.add("current");
    const dot = el("i");
    dot.className = seat.connected ? "on" : "off";
    const score = state.game === "mole" ? ` ${state.position.scores?.[index] ?? 0}점` : "";
    item.append(dot, document.createTextNode(`${seat.name} · ${labelColor(seat.color)}${score}`));
    item.title = seat.connected ? "연결됨" : "연결이 끊김";
    players.append(item);
  });
  hud.append(players);
  syncQr(state);
  if (PARTY.has(state.game)) {
    renderParty({ state, secret, mySeat, send });
  } else {
    renderScore(state);
    if (state.game === "mole") renderMole(state);
    else renderBoard(state);
    renderActions(state);
  }
  const offline = !PARTY.has(state.game) && state.game !== "mole" && state.status === "playing"
    && state.seats.some((seat, index) => index !== mySeat && !seat.connected);
  const disconnect = "상대 연결이 끊겼습니다. 같은 링크로 돌아오면 이어집니다.";
  const note = document.getElementById("note");
  if (offline) setNote(disconnect);
  else if (note?.textContent === disconnect) setNote("");
}

function renderBoard(state) {
  const wrap = document.getElementById("board-wrap");
  const flip = shouldFlip(state);
  if (state.game === "chess") {
    wrap.replaceChildren(chessBoard(state, flip));
    return;
  }
  const board = el("div", { className: `board ${state.game}${flip ? " flip" : ""}`, id: "board" });
  board.innerHTML = state.game === "gomoku" ? gomokuLines() : janggiLines();
  const points = state.game === "gomoku" ? 15 : 9;
  const rows = state.game === "gomoku" ? 15 : 10;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < points; x += 1) {
      const button = el("button", { className: "point", type: "button" });
      button.style.left = `${(x / (points - 1)) * 86 + 7}%`;
      button.style.top = `${(y / (rows - 1)) * 86 + 7}%`;
      button.dataset.x = String(x);
      button.dataset.y = String(y);
      paintPoint(button, state, x, y);
      button.addEventListener("click", () => onPoint(state, x, y));
      board.append(button);
    }
  }
  wrap.replaceChildren(board);
}

function paintPoint(button, state, x, y) {
  if (state.game === "gomoku") {
    const stone = state.position.board[y * 15 + x];
    if (stone) button.classList.add("stone", stone === 1 ? "black" : "white");
    if (samePoint(state.position.last, x, y)) button.classList.add("last");
    button.setAttribute("aria-label", stone ? `${x + 1}열 ${y + 1}줄 ${stone === 1 ? "흑" : "백"}` : `${x + 1}열 ${y + 1}줄`);
    return;
  }
  const piece = state.position.board[y * 9 + x];
  if (piece) {
    button.classList.add("piece", piece.side);
    const name = piece.type === "soldier" && piece.side === "han" ? "병" : piece.type === "king" ? (piece.side === "cho" ? "초" : "한") : JANGGI_NAME[piece.type];
    button.append(el("span", { className: "upright", text: name }));
    button.setAttribute("aria-label", `${name} ${x + 1},${y + 1}`);
  } else button.setAttribute("aria-label", `${x + 1},${y + 1}`);
  if (sameEdge(state.position.last, x, y)) button.classList.add("last");
  if (isLegalJanggi(state, x, y)) button.classList.add("mark");
}

function onPoint(state, x, y) {
  if (state.status !== "playing" || state.turnSeat !== mySeat) return;
  if (state.game === "gomoku") {
    if (!isLegalGomoku(state, x, y)) return;
    send({ type: "move", move: { x, y } });
    return;
  }
  const key = `${x},${y}`;
  if (selected) {
    const move = state.legalMoves.find((item) => !item.pass && item.from.join(",") === selected && item.to.join(",") === key);
    if (move) {
      selected = null;
      send({ type: "move", move });
      return;
    }
  }
  const own = state.position.board[y * 9 + x];
  const mine = state.seats[mySeat]?.color === "초" ? "cho" : "han";
  if (own?.side === mine && state.legalMoves.some((item) => item.from && item.from.join(",") === key)) selected = key;
  else selected = null;
  renderBoard(latest);
}

function chessBoard(state, flip) {
  const board = el("div", { className: "chess board", id: "board" });
  const files = flip ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const ranks = flip ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  for (const rank of ranks) {
    for (const file of files) {
      const index = rank * 8 + file;
      const name = "abcdefgh"[file] + (8 - rank);
      const button = el("button", { className: `sq ${(file + rank) % 2 === 1 ? "dark" : "light"}`, type: "button" });
      const piece = state.position.board[index];
      if (piece) {
        button.classList.add(piece === piece.toUpperCase() ? "w" : "b");
        button.append(el("span", { className: "upright", text: CHESS_LETTER[piece.toLowerCase()] }));
      }
      if (state.position.last?.includes(name)) button.classList.add("last");
      if (selected === name || isLegalChess(state, name)) button.classList.add("mark");
      button.dataset.square = name;
      button.setAttribute("aria-label", piece ? `${name} ${piece === piece.toUpperCase() ? "백" : "흑"} ${CHESS_NAME[piece.toLowerCase()]}` : name);
      button.addEventListener("click", () => onSquare(state, name, piece));
      board.append(button);
    }
  }
  return board;
}

function onSquare(state, name, piece) {
  if (state.status !== "playing" || state.turnSeat !== mySeat) return;
  if (selected) {
    const choices = state.legalMoves.filter((move) => move.from === selected && move.to === name);
    if (choices.length === 1) {
      selected = null;
      send({ type: "move", move: choices[0] });
      return;
    }
    if (choices.length > 1) {
      openPromotion(choices);
      return;
    }
  }
  const white = state.seats[mySeat]?.color === "백";
  const own = piece && (white ? piece === piece.toUpperCase() : piece === piece.toLowerCase());
  if (own && state.legalMoves.some((move) => move.from === name)) selected = name;
  else selected = null;
  renderBoard(latest);
}

function openPromotion(choices) {
  document.getElementById("promote")?.remove();
  const dialog = el("div", { className: "promote", id: "promote" });
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-label", "프로모션 기물");
  for (const choice of choices) {
    const button = el("button", { type: "button", text: PROMOTE[choice.promotion] });
    button.addEventListener("click", () => {
      dialog.remove();
      selected = null;
      send({ type: "move", move: choice });
    });
    dialog.append(button);
  }
  document.body.append(dialog);
}

function renderMole(state) {
  const wrap = document.getElementById("board-wrap");
  let board = document.getElementById("board");
  if (!board || !board.classList.contains("moles")) {
    board = el("div", { className: "moles board", id: "board" });
    for (let hole = 0; hole < 9; hole += 1) {
      const button = el("button", { className: "hole", type: "button" });
      button.dataset.hole = String(hole);
      button.setAttribute("aria-label", `${hole + 1}번 구멍`);
      button.append(el("span", { className: "mole", "aria-hidden": "true" }, [el("i"), el("i")]));
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        const active = latest?.position.active?.find((mole) => mole.hole === hole && serverNow() <= mole.expiresAt);
        if (!active || active.sent) return;
        active.sent = true;
        send({ type: "hit", moleId: active.id });
      });
      board.append(button);
    }
    wrap.replaceChildren(board);
  }
  const holes = new Set((state.position.active || []).filter((mole) => mole.expiresAt > serverNow()).map((mole) => mole.hole));
  board.querySelectorAll(".hole").forEach((hole) => hole.classList.toggle("up", holes.has(Number(hole.dataset.hole))));
}

function renderScore(state) {
  const box = document.getElementById("scoreboard");
  const clock = document.getElementById("clock");
  if (state.game !== "mole") {
    box.replaceChildren();
    clock.hidden = true;
    return;
  }
  clock.hidden = state.position.phase === "waiting";
  const list = el("div", { className: "scores" });
  state.seats.forEach((seat, index) => {
    const card = el("div", { className: index === mySeat ? "me" : "" });
    card.append(el("span", { text: seat.name }), el("strong", { text: String(state.position.scores?.[index] ?? 0) }));
    list.append(card);
  });
  box.replaceChildren(list);
}

function renderActions(state) {
  const box = document.getElementById("actions");
  box.replaceChildren();
  if (state.game === "mole" && state.position.phase === "waiting" && mySeat === 0) {
    box.append(action("시작", "start", () => send({ type: "start" })));
  }
  if (state.canPass && state.turnSeat === mySeat) box.append(action("한수쉼", "pass", () => send({ type: "pass" })));
  if (state.canClaimDraw && state.turnSeat === mySeat) box.append(action("빅장 무승부", "claim", () => send({ type: "claimDraw" })));
  if (state.status === "over") box.append(action("한 판 더", "rematch", () => send({ type: "rematch" }), "primary"));
}

function tickClock() {
  const state = latest;
  const bar = document.querySelector("#clock span");
  if (state?.game === "mole" && bar && state.position.startedAt) {
    const now = serverNow();
    const total = state.position.duration || 60000;
    const left = state.position.phase === "countdown"
      ? state.position.startedAt - now
      : state.position.endsAt - now;
    const ratio = state.position.phase === "countdown" ? 1 : Math.max(0, Math.min(1, left / total));
    bar.style.width = `${ratio * 100}%`;
    const turn = document.getElementById("turn");
    if (turn && state.position.phase === "countdown") turn.textContent = `${Math.max(1, Math.ceil(left / 1000))}초 뒤 시작`;
    if (turn && state.position.phase === "playing") turn.textContent = `남은 시간 ${Math.max(0, Math.ceil(left / 1000))}초`;
    if (state.position.phase === "playing") {
      document.querySelectorAll(".hole").forEach((hole) => {
        const active = state.position.active.some((mole) => mole.hole === Number(hole.dataset.hole) && mole.expiresAt > now);
        hole.classList.toggle("up", active);
      });
    }
    if (state.position.phase === "playing" && left < -200 && !syncedEnd) {
      syncedEnd = true;
      send({ type: "sync" });
    }
  }
  if (state?.game === "draw" && state.position.phase === "draw" && bar) {
    const left = state.position.endsAt - serverNow();
    bar.style.width = `${Math.max(0, Math.min(1, left / (state.position.duration || 80000))) * 100}%`;
    const turn = document.getElementById("turn");
    if (turn) turn.textContent = `${partyTurn(state, mySeat, secret)} · ${Math.max(0, Math.ceil(left / 1000))}초`;
    if (left < -200 && !syncedEnd) {
      syncedEnd = true;
      send({ type: "sync" });
    }
  }
  frame = requestAnimationFrame(tickClock);
}

function turnText(state) {
  if (PARTY.has(state.game)) return partyTurn(state, mySeat, secret);
  if (state.game === "mole") {
    if (state.position.phase === "waiting") return mySeat === 0 ? "준비되면 시작을 누르세요" : "방장을 기다리는 중";
    if (state.status === "over") return outcome(state);
    return "같은 두더지를 먼저 누릅니다";
  }
  if (state.status === "waiting") return "상대가 링크로 들어오면 시작됩니다";
  if (state.status === "over") return outcome(state);
  const color = state.seats[state.turnSeat]?.color || "";
  const mine = state.turnSeat === mySeat;
  let text = mine ? `내 차례 · ${color}` : `상대 차례 · ${color}`;
  if (state.check) text += state.game === "janggi" ? " · 장군" : " · 체크";
  if (state.facing) text += " · 빅장";
  return text;
}

function outcome(state) {
  const why = REASONS[state.reason] || "끝났습니다";
  if (state.draw || state.winnerSeat == null) return `무승부 · ${why}`;
  const name = state.seats[state.winnerSeat]?.name || "승자";
  return `${name} 승리 · ${why}`;
}

function shouldFlip(state) {
  const color = state.seats[mySeat]?.color;
  if (state.game === "gomoku") return color === "백";
  if (state.game === "chess") return color === "흑";
  if (state.game === "janggi") return color === "한";
  return false;
}

function isLegalGomoku(state, x, y) {
  return state.status === "playing" && state.turnSeat === mySeat && !state.position.board[y * 15 + x];
}

function isLegalChess(state, name) {
  return selected && state.legalMoves.some((move) => move.from === selected && move.to === name);
}

function isLegalJanggi(state, x, y) {
  return selected && state.legalMoves.some((move) => move.from && move.from.join(",") === selected && move.to.join(",") === `${x},${y}`);
}

function samePoint(last, x, y) {
  return Array.isArray(last) && last[0] === x && last[1] === y;
}

function sameEdge(last, x, y) {
  if (!Array.isArray(last)) return false;
  return last.some((point) => Array.isArray(point) && point[0] === x && point[1] === y);
}

function gomokuLines() {
  let lines = "";
  for (let i = 0; i < 15; i += 1) lines += `<line x1="0" y1="${i}" x2="14" y2="${i}"></line><line x1="${i}" y1="0" x2="${i}" y2="14"></line>`;
  for (const x of [3, 7, 11]) for (const y of [3, 7, 11]) lines += `<circle cx="${x}" cy="${y}" r="0.16"></circle>`;
  return `<svg viewBox="0 0 14 14" aria-hidden="true">${lines}</svg>`;
}

function janggiLines() {
  let lines = "";
  for (let i = 0; i < 9; i += 1) lines += `<line x1="${i}" y1="0" x2="${i}" y2="9"></line>`;
  for (let i = 0; i < 10; i += 1) lines += `<line x1="0" y1="${i}" x2="8" y2="${i}"></line>`;
  lines += `<line x1="3" y1="0" x2="5" y2="2"></line><line x1="5" y1="0" x2="3" y2="2"></line>`;
  lines += `<line x1="3" y1="7" x2="5" y2="9"></line><line x1="5" y1="7" x2="3" y2="9"></line>`;
  return `<svg viewBox="0 0 8 9" aria-hidden="true">${lines}</svg>`;
}

function labelColor(color) {
  return /^\d+$/.test(color) ? `${color}번` : color;
}

function action(text, id, onClick, className = "") {
  const button = el("button", { id, type: "button", className, text });
  button.addEventListener("click", onClick);
  return button;
}

function send(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function setNote(text) {
  const note = document.getElementById("note");
  if (note) note.textContent = text;
}

function serverNow() {
  return Date.now() + skew;
}

function readSeat() {
  try {
    const saved = JSON.parse(localStorage.getItem(`nes-play:${roomId}`) || "null");
    if (saved?.game === game && typeof saved.token === "string") return saved;
  } catch { /* Ignore a broken saved seat. */ }
  return {};
}

async function createAndEnter(name, extra) {
  const data = await post("/play-api/rooms", { game, name, ...extra });
  localStorage.setItem("nes-play-name", name.trim() || "손님");
  localStorage.setItem(`nes-play:${data.roomId}`, JSON.stringify({ token: data.token, name, game }));
  location.href = `/games/${game}/${data.roomId}`;
}

function openQr() {
  let overlay = document.getElementById("qr-overlay");
  if (!overlay) {
    overlay = el("div", { id: "qr-overlay", className: "qr-overlay" });
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "크게 본 QR 코드");
    overlay.addEventListener("click", () => overlay.classList.remove("open"));
    document.body.append(overlay);
  }
  const canvas = document.createElement("canvas");
  const size = Math.max(280, Math.min(window.innerWidth, window.innerHeight, 900) - 28);
  canvas.width = size;
  canvas.height = size;
  drawQr(canvas, location.href);
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "방 입장 QR 코드");
  overlay.replaceChildren(canvas);
  overlay.classList.add("open");
}

function syncQr(state) {
  const card = document.getElementById("qr-card");
  if (!card) return;
  card.hidden = state?.status === "playing" || state?.status === "over";
}

async function post(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
  return data;
}

function linkHome() {
  return el("a", { href: "/games", text: "← 게임 목록" });
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "hidden") node.hidden = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

window.addEventListener("pagehide", () => {
  stopped = true;
  if (frame) cancelAnimationFrame(frame);
});
