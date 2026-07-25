const GAME_PATH = "/10を自由に";

function getCurrentUser() {
  if (window.currentUser?.username) return window.currentUser;
  try {
    const stored = JSON.parse(localStorage.getItem("currentUser") || "null");
    if (stored?.username) return stored;
  } catch {}
  return null;
}

function openGuestModal() {
  const modal = document.getElementById("tenFreelyGuestModal");
  if (!modal) {
    window.location.href = GAME_PATH;
    return;
  }
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("ten-entry-modal-open");
  requestAnimationFrame(() => modal.querySelector("[data-ten-login]")?.focus());
}

function closeGuestModal() {
  const modal = document.getElementById("tenFreelyGuestModal");
  if (!modal) return;
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("ten-entry-modal-open");
}

function launchTenFreely() {
  if (getCurrentUser()) {
    window.location.href = GAME_PATH;
    return;
  }
  openGuestModal();
}

document.addEventListener("click", (event) => {
  const card = event.target.closest('[data-game="ten-freely"]');
  if (!card) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  launchTenFreely();
}, true);

document.addEventListener("keydown", (event) => {
  const card = event.target.closest?.('[data-game="ten-freely"]');
  if (card && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    launchTenFreely();
    return;
  }
  if (event.key === "Escape") closeGuestModal();
});

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("tenFreelyGuestModal");
  if (!modal) return;

  modal.querySelector("[data-ten-login]")?.addEventListener("click", () => {
    sessionStorage.setItem("afterAuthRedirect", GAME_PATH);
    closeGuestModal();
    document.getElementById("openLoginBtn")?.click();
  });

  modal.querySelector("[data-ten-guest]")?.addEventListener("click", () => {
    window.location.href = GAME_PATH;
  });

  modal.querySelectorAll("[data-ten-close]").forEach((button) => {
    button.addEventListener("click", closeGuestModal);
  });
});
