const form = document.getElementById("login-form");
const responseBox = document.getElementById("api-response");
const loginFeedback = document.getElementById("login-feedback");

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

const { postJson, setToken } = window.apiClient || {};

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    if (responseBox) {
      responseBox.textContent = "Autenticando...";
    }

    const loginData = await postJson("/api/auth/login", payload);
    setToken(loginData.token);
    if (loginFeedback) {
      loginFeedback.className = "alert alert-success mt-3";
      loginFeedback.textContent = "Login efetuado com sucesso.";
    }
    renderResponse({ login: "ok" });
    window.setTimeout(() => {
      window.location.replace("/caixa.html");
    }, 600);
  } catch (error) {
    if (loginFeedback) {
      loginFeedback.className = "alert alert-danger mt-3";
      loginFeedback.textContent = "Não foi possível autenticar.";
    }
    return handleError("Erro de conexão com a API.");
  }
});
