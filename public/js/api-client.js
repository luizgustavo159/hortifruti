const resolveApiBase = () => {
  const meta = document.querySelector('meta[name="api-base"]');
  const base = meta?.getAttribute("content")?.trim() || "";
  return base.endsWith("/") && base.length > 1 ? base.slice(0, -1) : base;
};

const API_BASE = resolveApiBase();

const buildApiUrl = (path) => {
  if (!path) {
    return API_BASE || "/";
  }
  if (path.startsWith("http")) {
    return path;
  }
  if (path.startsWith("/")) {
    return `${API_BASE}${path}`;
  }
  return `${API_BASE}/${path}`;
};

const getToken = () => localStorage.getItem("greenstore_token");
const setToken = (token) => localStorage.setItem("greenstore_token", token);
const clearToken = () => localStorage.removeItem("greenstore_token");

const parseResponse = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
};

const requestJson = async (path, options = {}) => {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers,
  });
  const data = await parseResponse(response);
  if (!response.ok) {
    const message =
      (data && typeof data === "object" && data.message) ||
      (typeof data === "string" && data) ||
      "Erro na requisição.";
    throw new Error(message);
  }
  return data;
};

const getJson = (path, options = {}) => requestJson(path, { ...options, method: "GET" });

const postJson = (path, payload, options = {}) => {
  const body = payload instanceof FormData ? payload : JSON.stringify(payload ?? {});
  return requestJson(path, { ...options, method: "POST", body });
};

const putJson = (path, payload, options = {}) => {
  const body = payload instanceof FormData ? payload : JSON.stringify(payload ?? {});
  return requestJson(path, { ...options, method: "PUT", body });
};

const deleteJson = (path, payload, options = {}) => {
  const body =
    typeof payload === "undefined"
      ? undefined
      : payload instanceof FormData
        ? payload
        : JSON.stringify(payload);
  return requestJson(path, { ...options, method: "DELETE", body });
};

window.apiClient = {
  API_BASE,
  buildApiUrl,
  getToken,
  setToken,
  clearToken,
  requestJson,
  getJson,
  postJson,
  putJson,
  deleteJson,
};
