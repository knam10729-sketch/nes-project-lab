const SCROLL_GAMES = new Set(["draw", "liar", "chosung", "ladder"]);

export function playLocked(status, game) {
  if (status !== "playing") return false;
  return !SCROLL_GAMES.has(game);
}

export function playScrolls(game) {
  return SCROLL_GAMES.has(game);
}

export function lockPlay(on, scrolls) {
  const root = document.documentElement;
  root.classList.toggle("game-lock", Boolean(on));
  root.classList.toggle("play-scroll", Boolean(scrolls));
  if (on) {
    bindViewport();
    syncViewport();
  } else {
    root.style.removeProperty("--play-height");
    root.style.removeProperty("--play-top");
  }
}

let bound = false;

function bindViewport() {
  if (bound) return;
  bound = true;
  const sync = () => syncViewport();
  window.visualViewport?.addEventListener("resize", sync);
  window.visualViewport?.addEventListener("scroll", sync);
  window.addEventListener("resize", sync);
  document.addEventListener("touchmove", (event) => {
    if (!document.documentElement.classList.contains("game-lock")) return;
    if (event.target.closest("input, textarea, select, .play-scroll")) return;
    event.preventDefault();
  }, { passive: false });
}

function syncViewport() {
  if (!document.documentElement.classList.contains("game-lock")) return;
  const view = window.visualViewport;
  const height = view?.height || window.innerHeight;
  const top = view?.offsetTop || 0;
  document.documentElement.style.setProperty("--play-height", `${Math.round(height)}px`);
  document.documentElement.style.setProperty("--play-top", `${Math.round(top)}px`);
}
