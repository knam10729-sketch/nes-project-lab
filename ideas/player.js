// URL-input video player for the private ideas area. The address stays only in this browser.
export const STORAGE_KEY = "nes-ideas-player-url";

export function checkVideoUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return { ok: false, message: "영상 주소를 입력해 주세요." };
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, message: "올바른 주소가 아닙니다. https:// 로 시작하는 주소를 넣어 주세요." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, message: "http:// 또는 https:// 주소만 재생할 수 있습니다." };
  }
  if (!url.hostname) return { ok: false, message: "올바른 주소가 아닙니다. https:// 로 시작하는 주소를 넣어 주세요." };
  return { ok: true, url: url.href };
}

function store() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function start() {
  const form = document.getElementById("playerForm");
  const input = document.getElementById("videoUrl");
  const clear = document.getElementById("clearBtn");
  const frame = document.getElementById("playerFrame");
  const empty = document.getElementById("playerEmpty");
  const msg = document.getElementById("playerMsg");

  const say = (text, bad) => {
    msg.textContent = text;
    msg.classList.toggle("bad", Boolean(bad));
  };
  const show = (href) => {
    frame.src = href;
    frame.hidden = false;
    empty.hidden = true;
  };
  const reset = () => {
    frame.removeAttribute("src");
    frame.src = "about:blank";
    frame.hidden = true;
    empty.hidden = false;
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = checkVideoUrl(input.value);
    if (!result.ok) {
      say(result.message, true);
      input.focus();
      return;
    }
    input.value = result.url;
    store()?.setItem(STORAGE_KEY, result.url);
    show(result.url);
    say("불러오는 중입니다. 화면이 비어 있으면 그 사이트가 외부 재생을 막은 것일 수 있어요.");
  });

  clear.addEventListener("click", () => {
    input.value = "";
    store()?.removeItem(STORAGE_KEY);
    reset();
    say("지웠습니다.");
    input.focus();
  });

  const saved = store()?.getItem(STORAGE_KEY);
  if (saved) {
    const result = checkVideoUrl(saved);
    if (result.ok) input.value = result.url;
    else store()?.removeItem(STORAGE_KEY);
  }
}

if (typeof document !== "undefined") start();
