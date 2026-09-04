const STYLE_ID = "now-coding-editor-stability-style";
const WORKSPACE_SELECTOR = "#programWorkspace";
const WORKSPACE_BLOCK_SELECTOR = `${WORKSPACE_SELECTOR} [data-block-token]`;
const REVEAL_DIAGNOSTIC_KEY = "nowCodingLongEditorRevealV1";

function ensureStabilityStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = "./style-v8.css";
  document.head.appendChild(link);
}

function viewportMetrics() {
  const viewport = window.visualViewport;
  const top = Number(viewport?.offsetTop || 0);
  const height = Math.max(1, Number(viewport?.height || window.innerHeight || 1));
  return { top, height, bottom: top + height };
}

function isLongEditor(workspace) {
  if (!workspace) return false;
  const { height: viewportHeight } = viewportMetrics();
  const workspaceHeight = workspace.getBoundingClientRect().height;
  return workspaceHeight > viewportHeight * 4;
}

function rememberLongReveal(workspace) {
  try {
    sessionStorage.setItem(REVEAL_DIAGNOSTIC_KEY, JSON.stringify({
      at: Date.now(),
      blockCount: workspace.querySelectorAll(".typed-block").length,
      workspaceHeight: Math.round(workspace.getBoundingClientRect().height),
    }));
  } catch {}
}

function reportRecentReloadAfterReveal() {
  try {
    const raw = sessionStorage.getItem(REVEAL_DIAGNOSTIC_KEY);
    if (!raw) return;
    const previous = JSON.parse(raw);
    if (!previous?.at || Date.now() - Number(previous.at) > 20_000) return;
    const navigation = performance.getEntriesByType?.("navigation")?.[0];
    if (navigation?.type === "reload") {
      console.warn("[Now Coding] A reload followed a long-editor viewport reveal.", previous);
    }
  } catch {}
}

function revealWithMinimalScroll(element) {
  if (!element?.isConnected) return;
  const { top: viewportTop, height: viewportHeight } = viewportMetrics();
  const safeTop = viewportTop + 82;
  const safeBottom = viewportTop + viewportHeight - 142;
  const rect = element.getBoundingClientRect();
  let delta = 0;

  if (rect.height >= Math.max(1, safeBottom - safeTop)) {
    delta = rect.top - safeTop;
  } else if (rect.top < safeTop) {
    delta = rect.top - safeTop;
  } else if (rect.bottom > safeBottom) {
    delta = rect.bottom - safeBottom;
  }

  if (Math.abs(delta) > 1) {
    window.scrollBy({ top: delta, left: 0, behavior: "auto" });
  }
}

function installScopedScrollIntoViewGuard() {
  const nativeScrollIntoView = Element.prototype.scrollIntoView;
  if (typeof nativeScrollIntoView !== "function") return;
  if (nativeScrollIntoView.__nowCodingLongEditorGuard) return;

  function guardedScrollIntoView(options) {
    const workspace = this?.matches?.(WORKSPACE_BLOCK_SELECTOR)
      ? this.closest(WORKSPACE_SELECTOR)
      : null;
    const smoothFollow = options && typeof options === "object" && options.behavior === "smooth";

    if (workspace && smoothFollow && isLongEditor(workspace)) {
      rememberLongReveal(workspace);
      requestAnimationFrame(() => revealWithMinimalScroll(this));
      return;
    }

    return nativeScrollIntoView.call(this, options);
  }

  Object.defineProperty(guardedScrollIntoView, "__nowCodingLongEditorGuard", { value: true });
  Element.prototype.scrollIntoView = guardedScrollIntoView;
}

ensureStabilityStyle();
reportRecentReloadAfterReveal();
installScopedScrollIntoViewGuard();
