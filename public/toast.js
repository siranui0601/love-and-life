/* ===== トースト（上部） ===== */
function ensureToastStyles() {
  if (document.getElementById("toastStyles")) return;
  const css = document.createElement("style");
  css.id = "toastStyles";
  css.textContent = `
  .toast-container{position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:10060;display:flex;flex-direction:column;gap:8px;pointer-events:none}
  .toast{
    min-width:min(92vw,520px);max-width:min(92vw,520px);
    background:#111;color:#eee;border:1px solid #333;border-radius:12px;
    padding:10px 14px;box-shadow:0 6px 16px rgba(0,0,0,.45);
    opacity:0;transform:translateY(-12px);transition:opacity .25s ease, transform .25s ease
  }
  .toast.show{opacity:1;transform:translateY(0)}
  `;
  document.head.appendChild(css);
  const box = document.createElement("div");
  box.id = "toastContainer";
  box.className = "toast-container";
  document.body.appendChild(box);
}

export function showToast(message, ms = 1800) {
  ensureToastStyles();
  const box = document.getElementById("toastContainer");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, ms);
}
