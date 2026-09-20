export function mount(root, html) {
  root.innerHTML = html;
  return root;
}

export function on(root, event, selector, handler, signal) {
  const listener = (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  };
  root.addEventListener(event, listener, signal ? { signal } : undefined);
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function layout({ title, body, footer = "" }) {
  return `
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="#/">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#0c0f14"/>
            <path d="M7 8h8.5v16H7z" fill="#3ecfb2"/>
            <path d="M16.5 8H25v16h-8.5z" fill="#f0b429"/>
            <path d="M15.2 6v20" stroke="#e8edf4" stroke-width="1.6"/>
          </svg>
          <span>Split Lab<span><small>${escapeHtml(title)}</small></span></span>
        </a>
        <div class="top-actions">
          <a class="btn btn-ghost" href="#/">All games</a>
          <button class="btn" type="button" data-action="signout">Sign out</button>
        </div>
      </header>
      <main id="main" class="wrap" tabindex="-1">${body}</main>
      <footer class="site-footer">${footer || "Progress is stored locally in this browser."}</footer>
    </div>
  `;
}
