const getStoredToken = () => localStorage.getItem("greenstore_token");

const decodeTokenPayload = (token) => {
  if (!token) {
    return null;
  }
  const segment = token.split(".")[1];
  if (!segment) {
    return null;
  }
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const payload = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    return JSON.parse(payload);
  } catch (error) {
    return null;
  }
};

const attachLogoutHandler = () => {
  const logoutButton = document.getElementById("logout-button");
  if (!logoutButton) {
    return;
  }
  const token = getStoredToken();
  if (!token) {
    logoutButton.classList.add("d-none");
    return;
  }
  logoutButton.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      // ignore logout failures
    } finally {
      localStorage.removeItem("greenstore_token");
      window.location.replace("/");
    }
  });
};

const enforceOperatorView = () => {
  const token = getStoredToken();
  if (!token) {
    return;
  }
  const payload = decodeTokenPayload(token);
  if (!payload || payload.role !== "operator") {
    return;
  }

  const currentPath = window.location.pathname;
  if (!currentPath.endsWith("/caixa.html")) {
    window.location.replace("/caixa.html");
    return;
  }

  document.querySelectorAll(".navbar .nav-link").forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!href.includes("caixa.html")) {
      link.classList.add("d-none");
    }
  });
};

enforceOperatorView();
attachLogoutHandler();
