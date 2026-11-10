(() => {
  const root = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  const frame = document.getElementById('calendarFrame');
  function syncCalendar() {
    try {
      const doc = frame?.contentDocument;
      if (!doc || !doc.body || frame.contentWindow.location.pathname === 'blank') return;
      doc.documentElement.dataset.theme = root.dataset.theme;
      let style = doc.getElementById('nes-calendar-theme');
      if (!style) {
        style = doc.createElement('style');
        style.id = 'nes-calendar-theme';
        style.textContent = ':root[data-theme="light"]{color-scheme:light;--bg:#fff;--fg:#141414;--muted:#606060;--line:#d4d4d4;--head-bg:#ededed;--panel:#f7f7f7;--accent:#111;--today:#111;--today-fg:#fff;--overlay:#0006}:root[data-theme="dark"]{color-scheme:dark;--bg:#080808;--fg:#f5f5f5;--muted:#b0b0b0;--line:#353535;--head-bg:#1e1e1e;--panel:#141414;--accent:#fff;--today:#fff;--today-fg:#080808;--overlay:#0009}';
        doc.head.append(style);
      }
    } catch (_) { /* Calendar stays usable if its origin changes. */ }
  }
  function render() {
    const dark = root.dataset.theme !== 'light';
    toggle.setAttribute('aria-pressed', String(!dark));
    toggle.setAttribute('aria-label', dark ? '화이트 테마로 전환' : '블랙 테마로 전환');
    toggle.querySelector('.theme-label').textContent = dark ? '화이트' : '블랙';
    document.querySelector('meta[name="theme-color"]').content = dark ? '#080808' : '#ffffff';
    syncCalendar();
  }
  toggle.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('nes-theme', root.dataset.theme); } catch (_) {}
    render();
  });
  addEventListener('storage', e => {
    if (e.key === 'nes-theme' && ['dark','light'].includes(e.newValue)) {
      root.dataset.theme = e.newValue; render();
    }
  });
  frame?.addEventListener('load', syncCalendar);
  render();
})();
