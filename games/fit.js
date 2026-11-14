export function playLocked(status) {
  return status === "playing";
}

export function lockPlay(on) {
  document.documentElement.classList.toggle("game-lock", Boolean(on));
  if (on) {
    bindViewport();
    syncViewport();
  } else {
    document.documentElement.style.removeProperty("--play-height");
    document.documentElement.style.removeProperty("--play-top");
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
