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
            <div class="tree-inner">
              <svg class="tree-lines" aria-hidden="true"></svg>
              <div class="tree-levels"></div>
            </div>
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

function renderTree(container, nodes, scale = 1) {
  const levelsContainer = container.querySelector(".tree-levels");
  const svg = container.querySelector(".tree-lines");
  const canvas = container.querySelector(".tree-canvas");
  const inner = container.querySelector(".tree-inner");

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
  const NODE_HEIGHT = 65;
  const H_GAP = 80;
  const V_GAP = 80;
  const PADDING = 40;

  const contentWidth =
    Math.max(1, maxX + 1) * (NODE_WIDTH + H_GAP) - H_GAP + PADDING * 2;
  const contentHeight =
    (maxDepth + 1) * (NODE_HEIGHT + V_GAP) - V_GAP + PADDING * 2;


  // scaleを反映（scroll領域も拡大縮小に追従させる）
  const scaledW = Math.ceil(contentWidth * scale);
  const scaledH = Math.ceil(contentHeight * scale);
  canvas.style.width = `${scaledW}px`;
  canvas.style.height = `${scaledH}px`;
  if (inner) {
    inner.style.width = `${contentWidth}px`;
    inner.style.height = `${contentHeight}px`;
    inner.style.transform = `scale(${scale})`;
  }


  /* ここは width/height 推奨（minWidth だと scroll が不安定になることがある）
  canvas.style.width = `${contentWidth}px`;
  canvas.style.height = `${contentHeight}px`;
  levelsContainer.style.width = `${contentWidth}px`;
  levelsContainer.style.height = `${contentHeight}px`;*/

  visibleNodes.forEach((node) => {
    const item = document.createElement("div");
    item.className = "tree-node";
    item.dataset.nodeId = node.id;
    item.textContent = node.line;

    const x = PADDING + (node.x ?? 0) * (NODE_WIDTH + H_GAP);
    const y = PADDING + (maxDepth - node.depth) * (NODE_HEIGHT + V_GAP);
    
    node._px = x;
    node._py = y;


    item.style.transform = `translate(${x}px, ${y}px)`;

    levelsContainer.appendChild(item);
    
    // ✅ 実寸（折り返しで高さが変わるので）
    node._w = item.offsetWidth;
    node._h = item.offsetHeight;
    
  });

  const drawLines = () => {
  svg.innerHTML = "";
  // 内部座標は「スケール前」基準でOK（innerがscaleしてくれる）
  svg.setAttribute("width", `${contentWidth}`);
  svg.setAttribute("height", `${contentHeight}`);

  nodes
    .filter((node) => node.parentId && node.depth > 0)
    .forEach((node) => {
      const parent = nodeById.get(node.parentId);
      if (!parent) return;
      if (parent.id === "root") return;

      // 固定値アンカー：親=上、子=下（高さはNODE_HEIGHTで固定）
      const startX = (parent._px ?? 0) + NODE_WIDTH / 2;
      const startY = (parent._py ?? 0);              // 親の上
      const endX = (node._px ?? 0) + NODE_WIDTH / 2;
      //const endY = (node._py ?? 0) + NODE_HEIGHT;    // 子の下
      const endY = (node._py ?? 0) + (node._h ?? NODE_HEIGHT); // ✅ 子の下（実寸）

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

  let cachedNodes = null;

  // scale state
  let treeScale = 1;
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 2.5;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const closeOverlay = () => overlay.classList.add("is-hidden");
  closeButton?.addEventListener("click", closeOverlay);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeOverlay();
  });

  const redraw = () => {
    if (!graph || !cachedNodes) return;
    renderTree(graph, cachedNodes, treeScale);
  };

  const setupDragPanAndZoom = () => {
    if (!graph) return;

    const pointers = new Map();
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    // pinch
    let pinching = false;
    let pinchStartDist = 0;
    let pinchStartScale = 1;
    let pinchCenter = { x: 0, y: 0, cx: 0, cy: 0 };

    const stopAll = () => {
      dragging = false;
      pinching = false;
      graph.classList.remove("is-dragging");
    };

    const getDist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const getCenter = (a, b) => ({
      clientX: (a.clientX + b.clientX) / 2,
      clientY: (a.clientY + b.clientY) / 2,
    });

    graph.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      pointers.set(event.pointerId, event);
      graph.setPointerCapture(event.pointerId);

      if (pointers.size === 1) {
        pinching = false;
        dragging = true;
        graph.classList.add("is-dragging");
        startX = event.clientX;
        startY = event.clientY;
        startScrollLeft = graph.scrollLeft;
        startScrollTop = graph.scrollTop;
        return;
      }

      if (pointers.size === 2) {
        dragging = false;
        graph.classList.remove("is-dragging");

        const [p1, p2] = Array.from(pointers.values());
        pinching = true;
        pinchStartDist = getDist(p1, p2);
        pinchStartScale = treeScale;

        const c = getCenter(p1, p2);
        const rect = graph.getBoundingClientRect();
        pinchCenter = {
          x: c.clientX - rect.left + graph.scrollLeft,
          y: c.clientY - rect.top + graph.scrollTop,
          cx: c.clientX - rect.left,
          cy: c.clientY - rect.top,
        };
      }
    });

    graph.addEventListener("pointermove", (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, event);

      if (pinching && pointers.size >= 2) {
        const [p1, p2] = Array.from(pointers.values());
        const dist = getDist(p1, p2);
        const raw = pinchStartScale * (dist / Math.max(1, pinchStartDist));
        const next = clamp(raw, MIN_SCALE, MAX_SCALE);
        const prev = treeScale;
        if (next === prev) return;

        treeScale = next;

        const ratio = next / prev;
        graph.scrollLeft = pinchCenter.x * ratio - pinchCenter.cx;
        graph.scrollTop = pinchCenter.y * ratio - pinchCenter.cy;

        redraw();
        return;
      }

      if (!dragging) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      graph.scrollLeft = startScrollLeft - dx;
      graph.scrollTop = startScrollTop - dy;
    });

    graph.addEventListener("pointerup", (event) => {
      pointers.delete(event.pointerId);
      if (pointers.size === 0) stopAll();
      if (pointers.size === 1) pinching = false;
    });

    graph.addEventListener("pointercancel", (event) => {
      pointers.delete(event.pointerId);
      if (pointers.size === 0) stopAll();
    });

    // wheel zoom (PC)
    graph.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();

        const rect = graph.getBoundingClientRect();
        const mx = event.clientX - rect.left + graph.scrollLeft;
        const my = event.clientY - rect.top + graph.scrollTop;

        const prev = treeScale;
        const next = clamp(prev * (event.deltaY > 0 ? 0.9 : 1.1), MIN_SCALE, MAX_SCALE);
        if (next === prev) return;

        treeScale = next;

        const ratio = next / prev;
        graph.scrollLeft = mx * ratio - (event.clientX - rect.left);
        graph.scrollTop = my * ratio - (event.clientY - rect.top);

        redraw();
      },
      { passive: false }
    );
  };

  setupDragPanAndZoom();

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
      cachedNodes = nodes;

      graph?.classList.remove("is-loading");
      status.textContent = "";
      redraw();
    } catch {
      graph?.classList.remove("is-loading");
      status.textContent = "読み込みに失敗しました。";
    }
  });
}

setupTreeView();