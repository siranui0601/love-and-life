const continueButton = document.querySelector("#continueButton");

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "null");
  } catch {
    return null;
  }
}

function createOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "tree-overlay is-hidden";
  overlay.innerHTML = `
    <div class="tree-panel" role="dialog" aria-modal="true" aria-label="選択肢ツリー">
      <header class="tree-header">
        <div>
          <h2 class="tree-title">これまでの選択肢</h2>
          <p class="tree-subtitle">最初の入力が下、続きが上に積み上がります。ドラッグで上下左右に移動できます。</p>
        </div>
        <button class="tree-close" type="button" aria-label="閉じる">×</button>
      </header>
      <div class="tree-body">
        <div class="tree-status" aria-live="polite"></div>
        <div class="tree-graph">
          <div class="tree-canvas">
            <svg class="tree-lines" aria-hidden="true"></svg>
            <div class="tree-levels"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

async function fetchTreeNodes(email) {
  const res = await fetch("/api/bungei/tree", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error("tree_fetch_failed");
  const data = await res.json();
  return Array.isArray(data.nodes) ? data.nodes : [];
}

function renderTree(container, nodes) {
  const levelsContainer = container.querySelector(".tree-levels");
  const svg = container.querySelector(".tree-lines");
  const canvas = container.querySelector(".tree-canvas");
  if (!levelsContainer || !svg || !canvas) return;

  levelsContainer.innerHTML = "";
  svg.innerHTML = "";

  const visibleNodes = nodes.filter((node) => node.depth > 0);
  if (!visibleNodes.length) {
    levelsContainer.innerHTML = '<p class="tree-empty">まだ続きのデータがありません。</p>';
    return;
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const childrenById = new Map();
  nodes.forEach((node) => {
    if (!childrenById.has(node.id)) childrenById.set(node.id, []);
    if (node.parentId) {
      if (!childrenById.has(node.parentId)) childrenById.set(node.parentId, []);
      childrenById.get(node.parentId).push(node);
    }
  });

  let leafIndex = 0;
  const assignPositions = (node) => {
    const children = childrenById.get(node.id) || [];
    if (!children.length) {
      node.x = leafIndex;
      leafIndex += 1;
    } else {
      children.forEach(assignPositions);
      node.x = children.reduce((s, c) => s + (c.x ?? 0), 0) / children.length;
    }
  };

  const root = nodeById.get("root") || nodes[0];
  assignPositions(root);

  const maxDepth = Math.max(...visibleNodes.map((n) => n.depth));
  const maxX = Math.max(...visibleNodes.map((n) => n.x ?? 0));

  const NODE_WIDTH = 180;
  const NODE_HEIGHT = 52;
  const H_GAP = 80;
  const V_GAP = 80;
  const PADDING = 40;

  const contentWidth =
    Math.max(1, maxX + 1) * (NODE_WIDTH + H_GAP) - H_GAP + PADDING * 2;
  const contentHeight =
    (maxDepth + 1) * (NODE_HEIGHT + V_GAP) - V_GAP + PADDING * 2;

  // ここは width/height 推奨（minWidth だと scroll が不安定になることがある）
  canvas.style.width = `${contentWidth}px`;
  canvas.style.height = `${contentHeight}px`;
  levelsContainer.style.width = `${contentWidth}px`;
  levelsContainer.style.height = `${contentHeight}px`;

  visibleNodes.forEach((node) => {
    const item = document.createElement("div");
    item.className = "tree-node";
    item.dataset.nodeId = node.id;
    item.textContent = node.line;

    const x = PADDING + (node.x ?? 0) * (NODE_WIDTH + H_GAP);
    const y = PADDING + (maxDepth - node.depth) * (NODE_HEIGHT + V_GAP);
    item.style.transform = `translate(${x}px, ${y}px)`;

    levelsContainer.appendChild(item);
  });

  const drawLines = () => {
    svg.innerHTML = "";

    // SVG は canvas の「論理サイズ」に合わせる（getBoundingClientRectだとズレやすい）
    svg.setAttribute("width", `${contentWidth}`);
    svg.setAttribute("height", `${contentHeight}`);
    svg.setAttribute("viewBox", `0 0 ${contentWidth} ${contentHeight}`);

    nodes
      .filter((node) => node.parentId && node.depth > 0)
      .forEach((node) => {
        const parent = nodeById.get(node.parentId);
        if (!parent) return;

        const parentEl = container.querySelector(`[data-node-id='${parent.id}']`);
        const childEl = container.querySelector(`[data-node-id='${node.id}']`);
        if (!parentEl || !childEl) return;

        const pr = parentEl.getBoundingClientRect();
        const cr = childEl.getBoundingClientRect();
        const base = canvas.getBoundingClientRect();

        const startX = pr.left + pr.width / 2 - base.left;
        const startY = pr.top - base.top;
        const endX = cr.left + cr.width / 2 - base.left;
        const endY = cr.bottom - base.top;

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", `${startX}`);
        line.setAttribute("y1", `${startY}`);
        line.setAttribute("x2", `${endX}`);
        line.setAttribute("y2", `${endY}`);
        line.setAttribute("stroke", "#d86b97");
        line.setAttribute("stroke-width", "2");
        line.setAttribute("stroke-linecap", "round");
        svg.appendChild(line);
      });
  };

  if (container._treeResizeHandler) {
    window.removeEventListener("resize", container._treeResizeHandler);
  }
  container._treeResizeHandler = () => drawLines();
  window.addEventListener("resize", container._treeResizeHandler, { passive: true });

  requestAnimationFrame(() => {
    drawLines();
    // 最初に下を見せる
    container.scrollTop = container.scrollHeight;
  });
}

function setupTreeView() {
  if (!continueButton) return;

  const overlay = createOverlay();
  const closeButton = overlay.querySelector(".tree-close");
  const status = overlay.querySelector(".tree-status");
  const graph = overlay.querySelector(".tree-graph");

  const closeOverlay = () => overlay.classList.add("is-hidden");

  closeButton?.addEventListener("click", closeOverlay);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeOverlay();
  });

  // ドラッグでパン（上下左右）
  if (graph) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    const stopDrag = () => {
      dragging = false;
      graph.classList.remove("is-dragging");
    };

    graph.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      dragging = true;
      graph.setPointerCapture(event.pointerId);
      graph.classList.add("is-dragging");
      startX = event.clientX;
      startY = event.clientY;
      startScrollLeft = graph.scrollLeft;
      startScrollTop = graph.scrollTop;
    });

    graph.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      graph.scrollLeft = startScrollLeft - dx;
      graph.scrollTop = startScrollTop - dy;
    });

    graph.addEventListener("pointerup", stopDrag);
    graph.addEventListener("pointercancel", stopDrag);
    graph.addEventListener("pointerleave", stopDrag);
  }

  continueButton.addEventListener("click", async () => {
    const user = getStoredUser();
    if (!user?.email) {
      status.textContent = "ログイン情報が見つかりませんでした。";
      overlay.classList.remove("is-hidden");
      return;
    }

    overlay.classList.remove("is-hidden");
    status.textContent = "読み込み中…";
    graph?.classList.add("is-loading");

    try {
      const nodes = await fetchTreeNodes(user.email);
      graph?.classList.remove("is-loading");
      status.textContent = "";
      renderTree(graph, nodes);
    } catch {
      graph?.classList.remove("is-loading");
      status.textContent = "読み込みに失敗しました。";
    }
  });
}

setupTreeView();