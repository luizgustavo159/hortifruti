const form = document.getElementById("login-form");
const responseBox = document.getElementById("api-response");
const loginFeedback = document.getElementById("login-feedback");
const ui = window.GreenStoreUI || null;

const getToken = () => localStorage.getItem("greenstore_token");
const setToken = (token) => localStorage.setItem("greenstore_token", token);

const renderResponse = (data) => {
  if (!responseBox) {
    return;
  }
  responseBox.textContent = JSON.stringify(data, null, 2);
};

const handleError = (message) => {
  if (!responseBox) {
    return;
  }
  responseBox.textContent = message;
};

const parseResponse = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return {};
};

const postJson = async (url, payload) => {
  const token = getToken();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Erro na requisição.");
  }
  return data;
};

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  const submitButton = form?.querySelector('button[type="submit"]');
  ui?.setButtonLoading(submitButton, {
    isLoading: true,
    idleText: "Entrar",
    loadingText: "Entrando...",
  });
  ui?.setFeedback(loginFeedback, { message: "Autenticando...", type: "secondary" });

  try {
    if (responseBox) {
      responseBox.textContent = "Autenticando...";
    }

    const loginData = await postJson("/api/auth/login", payload);
    setToken(loginData.token);
    ui?.setFeedback(loginFeedback, { message: "Login efetuado com sucesso.", type: "success" });
    renderResponse({ login: "ok" });
    window.setTimeout(() => {
      window.location.replace("/caixa.html");
    }, 600);
  } catch (error) {
    ui?.setFeedback(loginFeedback, { message: "Não foi possível autenticar.", type: "danger" });
    return handleError(error.message || "Erro de conexão com a API.");
  } finally {
    ui?.setButtonLoading(submitButton, { isLoading: false, idleText: "Entrar" });
  }
});
