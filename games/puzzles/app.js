// Single-player puzzles: 2048, 스도쿠, 눈도장, 붓길. Everything runs in the browser.
import * as g2048 from "./g2048.js?v=20261126-2";
import * as dice from "./dice.js?v=20261126-2";
import * as path from "./path.js?v=20261126-2";
import * as sudoku from "./sudoku.js?v=20261126-2";

const META = {
  2048: ["2048", "밀어서 같은 숫자를 합칩니다. 2048 타일을 만들어 보세요. 화면을 밀거나 방향키를 쓰세요."],
  sudoku: ["스도쿠", "가로줄, 세로줄, 3×3 칸마다 1부터 9가 한 번씩 들어가게 채웁니다."],
  dice: ["눈도장", "주사위를 굴려 옮깁니다. 칸의 숫자와 주사위 윗면이 같을 때 그 칸에 올라가면 도장이 찍힙니다. 모든 칸에 도장을 찍으세요."],
  path: ["붓길", "1에서 시작해 숫자 순서대로, 모든 칸을 한 번씩 지나는 한 줄을 그립니다. 그린 길을 되짚으면 지워집니다."],
};

const app = document.getElementById("app");
const kind = location.pathname.split("/").filter(Boolean)[1];
const meta = META[kind];
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(`nes-puzzle:${key}`)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`nes-puzzle:${key}`, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  },
};

// ---- 2048 ----
function mount2048(root) {
  let state = store.get("2048", null);
  if (!state || !Array.isArray(state.board) || state.board.length !== 16) state = fresh();
  let best = store.get("2048-best", 0);
  const grid = el("div", { className: "g2048", id: "g2048", role: "grid", "aria-label": "2048 판" });
  const score = stat("점수", "0");
  const top = stat("최고", "0");
  const again = el("button", { type: "button", text: "새 게임" });
  const msg = el("p", { className: "puzzle-win", id: "puzzle-msg" });
  root.append(el("div", { className: "puzzle-bar" }, [score.box, top.box, again]), grid, msg);
  again.addEventListener("click", () => { state = fresh(); paint(); });
  function fresh() {
    return { board: g2048.spawn(g2048.spawn(g2048.empty())), score: 0, won: false };
  }
  function go(dir) {
    const result = g2048.move(state.board, dir);
    if (!result.moved) return;
    state = { ...state, board: g2048.spawn(result.board), score: state.score + result.gained };
    paint();
  }
  function paint() {
    grid.replaceChildren(...state.board.map((value) => {
      const cell = el("div", { text: value ? String(value) : "" });
      if (value) cell.dataset.v = String(value);
      if (value >= 1024) cell.classList.add("big");
      return cell;
    }));
    best = Math.max(best, state.score);
    score.value.textContent = String(state.score);
    top.value.textContent = String(best);
    const reached = state.board.some((value) => value >= 2048);
    msg.textContent = reached ? "2048 달성! 계속 가 볼까요?" : !g2048.canMove(state.board) ? "더 움직일 수 없어요. 새 게임을 눌러 주세요." : "";
    store.set("2048", state);
    store.set("2048-best", best);
  }
  window.addEventListener("keydown", (event) => {
    const dir = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" }[event.key];
    if (!dir) return;
    event.preventDefault();
    go(dir);
  });
  swipe(grid, go);
  paint();
}

function swipe(target, onDir) {
  let start = null;
  target.addEventListener("pointerdown", (event) => {
    start = { x: event.clientX, y: event.clientY };
    target.setPointerCapture?.(event.pointerId);
  });
  target.addEventListener("pointerup", (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    onDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  });
  target.addEventListener("pointercancel", () => { start = null; });
}

// ---- 스도쿠 ----
function mountSudoku(root) {
  let level = store.get("sudoku-level", "easy");
  let game = store.get("sudoku", null);
  let selected = -1;
  if (!game || !Array.isArray(game.puzzle) || game.puzzle.length !== 81) game = fresh();
  const levels = el("div", { className: "puzzle-bar" });
  for (const [id, label] of [["easy", "쉬움"], ["normal", "보통"], ["hard", "어려움"]]) {
    const b = el("button", { type: "button", text: label, className: id === level ? "primary" : "" });
    b.dataset.level = id;
    b.addEventListener("click", () => {
      level = id;
      store.set("sudoku-level", level);
      levels.querySelectorAll("button").forEach((item) => item.classList.toggle("primary", item === b));
      game = fresh();
      selected = -1;
      paint();
    });
    levels.append(b);
  }
  const grid = el("div", { className: "sudoku", id: "sudoku" });
  const pad = el("div", { className: "numpad", id: "numpad" });
  for (let n = 1; n <= 9; n += 1) pad.append(padButton(String(n), () => put(n)));
  pad.append(padButton("지우기", () => put(0)));
  const msg = el("p", { className: "puzzle-win", id: "puzzle-msg" });
  root.append(levels, grid, pad, msg);
  function fresh() {
    const made = sudoku.makePuzzle(level);
    return { puzzle: made.puzzle, solution: made.solution, grid: made.puzzle.slice(), level };
  }
  function put(n) {
    if (selected < 0 || game.puzzle[selected]) return;
    game.grid[selected] = n;
    paint();
  }
  function paint() {
    const bad = sudoku.conflicts(game.grid);
    const value = selected >= 0 ? game.grid[selected] : 0;
    const peers = selected >= 0 ? new Set(sudoku.PEERS[selected]) : new Set();
    grid.replaceChildren(...game.grid.map((n, i) => {
      const b = el("button", { type: "button", text: n ? String(n) : "" });
      b.className = [game.puzzle[i] ? "given" : n ? "user" : "", i % 9 === 2 || i % 9 === 5 ? "c3" : "", Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5 ? "r3" : "",
        peers.has(i) ? "peer" : "", value && n === value ? "same" : "", i === selected ? "sel" : "", bad.has(i) && !game.puzzle[i] ? "bad" : ""].filter(Boolean).join(" ");
      b.setAttribute("aria-label", `${Math.floor(i / 9) + 1}행 ${i % 9 + 1}열 ${n || "빈칸"}`);
      b.addEventListener("click", () => { selected = i; paint(); });
      return b;
    }));
    const left = game.grid.filter((n) => !n).length;
    msg.textContent = sudoku.solved(game.grid) ? "완성! 잘했어요 🎉" : `남은 칸 ${left}`;
    store.set("sudoku", game);
  }
  window.addEventListener("keydown", (event) => {
    if (/^[1-9]$/.test(event.key)) put(Number(event.key));
    if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") put(0);
  });
  paint();
}

function padButton(text, onClick) {
  const b = el("button", { type: "button", text });
  b.addEventListener("click", onClick);
  return b;
}

// ---- 눈도장 ----
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function dieFace(n) {
  const face = el("span", { className: "die", "aria-label": `주사위 윗면 ${n}` });
  for (let k = 0; k < 9; k += 1) face.append(el("i", { className: PIPS[n].includes(k) ? "on" : "" }));
  return face;
}

function mountDice(root) {
  let level = store.get("dice-level", 1);
  let start = null;
  let state = null;
  const moves = stat("움직임", "0");
  const left = stat("남은 도장", "0");
  const stage = stat("단계", "1");
  const reset = el("button", { type: "button", text: "처음부터" });
  const next = el("button", { type: "button", text: "새 판" });
  const board = el("div", { className: "dice-board", id: "dice-board" });
  const pad = el("div", { className: "dice-pad", id: "dice-pad" });
  const msg = el("p", { className: "puzzle-win", id: "puzzle-msg" });
  root.append(el("div", { className: "puzzle-bar" }, [stage.box, moves.box, left.box, reset, next]), board, pad, msg);
  reset.addEventListener("click", () => { state = structuredClone(start); paint(); });
  next.addEventListener("click", () => newBoard());
  function newBoard() {
    const size = level < 3 ? 4 : 5;
    const targets = Math.min(4 + level, size * size - 4);
    start = dice.makeBoard({ size, targets });
    state = structuredClone(start);
    paint();
  }
  function go(dir) {
    if (dice.done(state)) return;
    const result = dice.step(state, dir);
    if (!result.ok) return;
    state = result.state;
    if (dice.done(state)) {
      level += 1;
      store.set("dice-level", level);
    }
    paint();
  }
  function paint() {
    board.style.gridTemplateColumns = `repeat(${state.size},1fr)`;
    board.replaceChildren(...state.cells.map((n, i) => {
      const cell = el("div", { className: n ? (state.stamped[i] ? "stamped" : "") : "blank" });
      const x = i % state.size;
      const y = Math.floor(i / state.size);
      if (x === state.x && y === state.y) cell.append(dieFace(state.die.top));
      else if (n) cell.textContent = String(n);
      cell.addEventListener("click", () => {
        const dx = x - state.x;
        const dy = y - state.y;
        if (Math.abs(dx) + Math.abs(dy) !== 1) return;
        go(dx === 1 ? "right" : dx === -1 ? "left" : dy === 1 ? "down" : "up");
      });
      return cell;
    }));
    const preview = (dir) => dice.roll(state.die, dir).top;
    const arrow = (dir, label) => {
      const b = el("button", { type: "button", "aria-label": `${label}으로 굴리기` });
      b.append(document.createTextNode(label), el("small", { text: `윗면 ${preview(dir)}` }));
      b.addEventListener("click", () => go(dir));
      return b;
    };
    pad.replaceChildren(el("span"), arrow("up", "↑ 위"), el("span"), arrow("left", "← 왼"), el("span"), arrow("right", "오른 →"), el("span"), arrow("down", "↓ 아래"), el("span"));
    moves.value.textContent = String(state.moves);
    left.value.textContent = String(state.cells.filter((n, i) => n && !state.stamped[i]).length);
    stage.value.textContent = String(dice.done(state) ? level - 1 : level);
    msg.textContent = dice.done(state) ? `도장 완성! ${state.moves}번 만에 끝냈어요. 새 판을 눌러 다음 단계로.` : "";
  }
  window.addEventListener("keydown", (event) => {
    const dir = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" }[event.key];
    if (dir) { event.preventDefault(); go(dir); }
  });
  swipe(board, go);
  newBoard();
}

// ---- 붓길 ----
function mountPath(root) {
  let level = store.get("path-level", 1);
  let board = null;
  let line = [];
  const stage = stat("단계", "1");
  const covered = stat("채운 칸", "0");
  const clear = el("button", { type: "button", text: "지우기" });
  const next = el("button", { type: "button", text: "새 판" });
  const grid = el("div", { className: "path-board", id: "path-board" });
  const msg = el("p", { className: "puzzle-win", id: "puzzle-msg" });
  root.append(el("div", { className: "puzzle-bar" }, [stage.box, covered.box, clear, next]), grid, msg);
  clear.addEventListener("click", () => { line = []; paint(); });
  next.addEventListener("click", () => newBoard());
  function newBoard() {
    const size = level < 3 ? 5 : level < 6 ? 6 : 7;
    board = path.makeBoard(size, Math.max(4, 8 - Math.floor(level / 2)));
    line = [];
    paint();
  }
  function cellAt(event) {
    const rect = grid.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * board.size);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * board.size);
    if (x < 0 || y < 0 || x >= board.size || y >= board.size) return -1;
    return y * board.size + x;
  }
  let drawing = false;
  grid.addEventListener("pointerdown", (event) => {
    if (path.solvedBy(line, board)) return;
    drawing = true;
    grid.setPointerCapture?.(event.pointerId);
    const i = cellAt(event);
    if (i < 0) return;
    if (!line.length || (line[line.length - 1] !== i && !line.includes(i))) {
      if (board.clues[i] === 1) line = [i];
    }
    if (line.includes(i)) line = line.slice(0, line.indexOf(i) + 1);
    paint();
  });
  grid.addEventListener("pointermove", (event) => {
    if (!drawing) return;
    const i = cellAt(event);
    if (i < 0) return;
    const nextLine = path.extend(line, i, board);
    if (nextLine !== line) { line = nextLine; paint(); }
  });
  const stop = () => { drawing = false; };
  grid.addEventListener("pointerup", stop);
  grid.addEventListener("pointercancel", stop);
  function paint() {
    grid.style.gridTemplateColumns = `repeat(${board.size},1fr)`;
    const on = new Set(line);
    const cells = board.clues.map((n, i) => {
      const cell = el("div", { className: on.has(i) ? (line[line.length - 1] === i ? "on head" : "on") : "" });
      if (n) cell.append(el("b", { text: String(n) }));
      return cell;
    });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${board.size} ${board.size}`);
    if (line.length > 1) {
      const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      poly.setAttribute("points", line.map((i) => `${(i % board.size) + 0.5},${Math.floor(i / board.size) + 0.5}`).join(" "));
      poly.setAttribute("fill", "none");
      poly.setAttribute("stroke", "#2f7d4a");
      poly.setAttribute("stroke-width", "0.28");
      poly.setAttribute("stroke-linecap", "round");
      poly.setAttribute("stroke-linejoin", "round");
      svg.append(poly);
    }
    grid.replaceChildren(...cells, svg);
    const win = path.solvedBy(line, board);
    if (win && !board.won) {
      board.won = true;
      level += 1;
      store.set("path-level", level);
    }
    stage.value.textContent = String(win ? level - 1 : level);
    covered.value.textContent = `${line.length}/${board.size * board.size}`;
    msg.textContent = win ? "한 붓에 완성! 새 판을 눌러 다음 단계로." : line.length ? "" : "1에서 손가락을 대고 그리기 시작하세요.";
  }
  newBoard();
}

function stat(label, value) {
  const v = el("b", { text: value });
  return { box: el("span", { className: "stat" }, [v, document.createTextNode(label)]), value: v };
}

function back() {
  return el("a", { href: "/games", text: "← 게임 목록" });
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

// Mount last so every constant above is initialised first.
if (!meta) {
  app.append(el("p", { className: "lead", text: "없는 퍼즐입니다." }), back());
} else {
  document.title = `${meta[0]} | 정한.kr`;
  const head = el("section", { className: "hud" }, [el("div", {}, [
    el("p", { className: "eyebrow", text: "SOLO PUZZLE" }),
    el("h2", { className: "turn", id: "turn", text: meta[0] }),
    el("p", { className: "muted puzzle-help", text: meta[1] }),
  ])]);
  const body = el("div", { className: "puzzle", id: "puzzle" });
  app.replaceChildren(head, body, el("p", {}, [back()]));
  ({ 2048: mount2048, sudoku: mountSudoku, dice: mountDice, path: mountPath })[kind](body);
}
