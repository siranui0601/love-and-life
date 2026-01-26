const continueButton = document.querySelector("#continueButton");

const MAX_DEPTH = 8;
const MAX_NODES = 200;

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

async function fetchOptions(email, speechOrder) {
  const res = await fetch("/api/bungei/options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, speechOrder }),
  });

  if (!res.ok) {
    throw new Error("options_fetch_failed");
  }

  const data = await res.json();
  return Array.isArray(data.options) ? data.options : [];
}

async function buildTree(email, onProgress) {
  const root = { id: "root", line: null, parentId: null, depth: 0, order: [] };
  const nodes = [root];
  const queue = [root];
  let totalNodes = 1;

  while (queue.length) {
    const current = queue.shift();
    if (!current || current.depth >= MAX_DEPTH) continue;

    let options = [];
    try {
      options = await fetchOptions(email, current.order);
    } catch (error) {
      onProgress?.("読み込み中にエラーが発生しました。");
      break;
    }

    for (const option of options) {
      const line = String(option || "").trim();
      if (!line) continue;
      if (totalNodes >= MAX_NODES) {
        onProgress?.("表示数が多いため途中まで表示しています。");
        return nodes;
      }
      const id = `node-${nodes.length}`;
      const child = {
        id,
        line,
        parentId: current.id,
        depth: current.depth + 1,
        order: [...current.order, line],
      };
      nodes.push(child);
      queue.push(child);
      totalNodes += 1;
    }

    if (queue.length) {
      onProgress?.(`読み込み中… (${Math.min(totalNodes, MAX_NODES)}件)`);
    }
  }

  return nodes;
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
    levelsContainer.innerHTML = "<p class=\"tree-empty\">まだ続きのデータがありません。</p>";
    return;
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const childrenById = new Map();
  nodes.forEach((node) => {
    if (!childrenById.has(node.id)) {
      childrenById.set(node.id, []);
    }
    if (node.parentId) {
      if (!childrenById.has(node.parentId)) {
        childrenById.set(node.parentId, []);
      }
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
      const average =
        children.reduce((sum, child) => sum + (child.x ?? 0), 0) / children.length;
      node.x = average;
    }
  };

  const root = nodeById.get("root") || nodes[0];
  assignPositions(root);

  const maxDepth = Math.max(...visibleNodes.map((node) => node.depth));
  const maxX = Math.max(...visibleNodes.map((node) => node.x ?? 0));
  const NODE_WIDTH = 180;
  const NODE_HEIGHT = 52;
  const H_GAP = 80;
  const V_GAP = 80;
  const PADDING = 40;

  const contentWidth = Math.max(1, maxX + 1) * (NODE_WIDTH + H_GAP) - H_GAP + PADDING * 2;
  const contentHeight =
    (maxDepth + 1) * (NODE_HEIGHT + V_GAP) - V_GAP + PADDING * 2;
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
    const canvasRect = canvas.getBoundingClientRect();
    svg.setAttribute("width", `${canvasRect.width}`);
    svg.setAttribute("height", `${canvasRect.height}`);

    nodes
      .filter((node) => node.parentId && node.depth > 0)
      .forEach((node) => {
        const parent = nodeById.get(node.parentId);
        if (!parent) return;
        const parentEl = container.querySelector(`[data-node-id='${parent.id}']`);
        const childEl = container.querySelector(`[data-node-id='${node.id}']`);
        if (!parentEl || !childEl) return;

        const parentRect = parentEl.getBoundingClientRect();
        const childRect = childEl.getBoundingClientRect();
        const startX = parentRect.left + parentRect.width / 2 - canvasRect.left;
        const startY = parentRect.top - canvasRect.top;
        const endX = childRect.left + childRect.width / 2 - canvasRect.left;
        const endY = childRect.bottom - canvasRect.top;

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
  container._treeResizeHandler = drawLines;
  requestAnimationFrame(drawLines);
  window.addEventListener("resize", drawLines, { passive: true });
}

function setupTreeView() {
  if (!continueButton) return;

  const overlay = createOverlay();
  const closeButton = overlay.querySelector(".tree-close");
  const status = overlay.querySelector(".tree-status");
  const graph = overlay.querySelector(".tree-graph");
  let cachedNodes = null;
  let cachedPromise = null;
  let cachedEmail = null;

  const closeOverlay = () => {
    overlay.classList.add("is-hidden");
  };

  closeButton?.addEventListener("click", closeOverlay);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeOverlay();
    }
  });

  const startPrefetch = () => {
    const user = getStoredUser();
    if (!user?.email) return;
    if (cachedEmail === user.email && (cachedNodes || cachedPromise)) return;
    cachedEmail = user.email;
    cachedPromise = buildTree(user.email)
      .then((nodes) => {
        cachedNodes = nodes;
        return nodes;
      })
      .catch(() => {
        cachedPromise = null;
      });
  };

  const setupDragPan = () => {
    if (!graph) return;
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
  };

  setupDragPan();
  startPrefetch();

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

    if (cachedEmail !== user.email) {
      cachedNodes = null;
      cachedPromise = null;
      cachedEmail = user.email;
    }
    if (!cachedPromise) {
      cachedPromise = buildTree(user.email, (message) => {
        if (status) status.textContent = message;
      }).then((nodes) => {
        cachedNodes = nodes;
        return nodes;
      });
    }

    const nodes = cachedNodes || (await cachedPromise);

    graph?.classList.remove("is-loading");
    status.textContent = "";
    renderTree(graph, nodes);
  });
}

setupTreeView();
