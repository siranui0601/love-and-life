const continueButton = document.querySelector("#continueButton");

const MAX_DEPTH = 8;
const MAX_NODES = 200;

let cachedTreePromise = null;

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
          <p class="tree-subtitle">最初の入力が下、続きが上に積み上がります。</p>
        </div>
        <button class="tree-close" type="button" aria-label="閉じる">×</button>
      </header>
      <div class="tree-body">
        <div class="tree-status" aria-live="polite"></div>
        <div class="tree-graph" role="region" aria-label="選択肢ツリー">
          <div class="tree-forest"></div>
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
  const forest = container.querySelector(".tree-forest");
  if (!forest) return;

  forest.innerHTML = "";

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const depthOneNodes = nodes.filter((node) => node.depth === 1);
  const rootIds = depthOneNodes.map((node) => node.id);

  if (!rootIds.length) {
    forest.innerHTML = "<p class=\"tree-empty\">まだ続きのデータがありません。</p>";
    return;
  }

  const findRootId = (node) => {
    let current = node;
    while (current && current.parentId && current.depth > 1) {
      current = nodeById.get(current.parentId);
    }
    return current?.id ?? node.id;
  };

  const groups = new Map();
  nodes
    .filter((node) => node.depth > 0)
    .forEach((node) => {
      const rootId = findRootId(node);
      if (!groups.has(rootId)) {
        groups.set(rootId, []);
      }
      groups.get(rootId).push(node);
    });

  const drawFns = [];

  rootIds.forEach((rootId) => {
    const treeNodes = groups.get(rootId) || [];
    const treeContainer = document.createElement("div");
    treeContainer.className = "tree-tree";
    treeContainer.innerHTML = `
      <svg class="tree-lines" aria-hidden="true"></svg>
      <div class="tree-levels"></div>
    `;
    forest.appendChild(treeContainer);

    const levelsContainer = treeContainer.querySelector(".tree-levels");
    const svg = treeContainer.querySelector(".tree-lines");
    if (!levelsContainer || !svg) return;

    const levels = new Map();
    treeNodes.forEach((node) => {
      if (!levels.has(node.depth)) {
        levels.set(node.depth, []);
      }
      levels.get(node.depth).push(node);
    });

    Array.from(levels.keys())
      .sort((a, b) => a - b)
      .forEach((depth) => {
        const levelRow = document.createElement("div");
        levelRow.className = "tree-level";
        levelRow.dataset.depth = String(depth);

        levels.get(depth).forEach((node) => {
          const item = document.createElement("div");
          item.className = "tree-node";
          item.dataset.nodeId = node.id;
          item.textContent = node.line;
          levelRow.appendChild(item);
        });

        levelsContainer.appendChild(levelRow);
      });

    const drawLines = () => {
      svg.innerHTML = "";
      const containerRect = treeContainer.getBoundingClientRect();
      svg.setAttribute("width", `${containerRect.width}`);
      svg.setAttribute("height", `${containerRect.height}`);

      treeNodes
        .filter((node) => node.parentId && node.depth > 0)
        .forEach((node) => {
          const parent = nodeById.get(node.parentId);
          if (!parent) return;
          const parentEl = treeContainer.querySelector(`[data-node-id='${parent.id}']`);
          const childEl = treeContainer.querySelector(`[data-node-id='${node.id}']`);
          if (!parentEl || !childEl) return;

          const parentRect = parentEl.getBoundingClientRect();
          const childRect = childEl.getBoundingClientRect();
          const startX = parentRect.left + parentRect.width / 2 - containerRect.left;
          const startY = parentRect.top - containerRect.top;
          const endX = childRect.left + childRect.width / 2 - containerRect.left;
          const endY = childRect.bottom - containerRect.top;

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

    drawFns.push(drawLines);
  });

  if (container._treeResizeHandler) {
    window.removeEventListener("resize", container._treeResizeHandler);
  }
  const handleResize = () => {
    drawFns.forEach((fn) => fn());
  };
  container._treeResizeHandler = handleResize;
  requestAnimationFrame(handleResize);
  window.addEventListener("resize", handleResize, { passive: true });
}

function enablePan(graph) {
  if (!graph) return;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startScrollLeft = 0;
  let startScrollTop = 0;

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    isDragging = true;
    graph.classList.add("is-dragging");
    startX = event.clientX;
    startY = event.clientY;
    startScrollLeft = graph.scrollLeft;
    startScrollTop = graph.scrollTop;
  };

  const onPointerMove = (event) => {
    if (!isDragging) return;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    graph.scrollLeft = startScrollLeft - deltaX;
    graph.scrollTop = startScrollTop - deltaY;
  };

  const onPointerUp = () => {
    isDragging = false;
    graph.classList.remove("is-dragging");
  };

  graph.addEventListener("pointerdown", onPointerDown);
  graph.addEventListener("pointermove", onPointerMove);
  graph.addEventListener("pointerup", onPointerUp);
  graph.addEventListener("pointerleave", onPointerUp);
}

function preloadTree(email, status) {
  if (!email) return;
  if (!cachedTreePromise) {
    cachedTreePromise = buildTree(email, (message) => {
      if (status) status.textContent = message;
    });
  }
  return cachedTreePromise;
}

function setupTreeView() {
  if (!continueButton) return;

  const overlay = createOverlay();
  const closeButton = overlay.querySelector(".tree-close");
  const status = overlay.querySelector(".tree-status");
  const graph = overlay.querySelector(".tree-graph");
  enablePan(graph);

  const closeOverlay = () => {
    overlay.classList.add("is-hidden");
  };

  closeButton?.addEventListener("click", closeOverlay);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeOverlay();
    }
  });

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

    const nodes = await preloadTree(user.email, status);

    graph?.classList.remove("is-loading");
    status.textContent = "";
    renderTree(graph, nodes);
  });
}

setupTreeView();

const preloadUser = getStoredUser();
if (preloadUser?.email) {
  preloadTree(preloadUser.email);
}
