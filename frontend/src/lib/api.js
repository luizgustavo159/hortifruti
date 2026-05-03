import { clearToken, clearUser, getToken } from "./auth";

const API_BASE = "/api";
const API_TIMEOUT_MS = 15000;

export function normalizeApiError(error) {
  if (!error) return "Erro inesperado.";
  if (error.status === 401) return "Sessão expirada. Faça login novamente.";
  if (error.status === 403) return "Você não tem permissão para esta operação.";
  if (error.status === 0) return error.message || "Falha de conexão com o servidor.";
  return error.message || "Erro na requisição.";
}

const emitUnauthorizedEvent = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("greenstore:unauthorized"));
  }
};

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
  };

  const hasBody = options.body !== undefined && options.body !== null;
  const isFormDataBody = typeof FormData !== "undefined" && options.body instanceof FormData;
  const isSearchParamsBody = typeof URLSearchParams !== "undefined" && options.body instanceof URLSearchParams;
  const isBlobBody = typeof Blob !== "undefined" && options.body instanceof Blob;
  if (
    hasBody &&
    !headers["Content-Type"] &&
    !headers["content-type"] &&
    !isFormDataBody &&
    !isSearchParamsBody &&
    !isBlobBody
  ) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutHandle = controller
    ? setTimeout(() => controller.abort("request-timeout"), API_TIMEOUT_MS)
    : null;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: options.signal || controller?.signal,
    });
  } catch (requestError) {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    const isAbort = requestError?.name === "AbortError" || requestError === "request-timeout";
    const error = new Error(isAbort ? "Tempo de requisição excedido." : "Falha de conexão com o servidor.");
    error.status = 0;
    error.data = null;
    throw error;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_error) {
      data = text;
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
      clearUser();
      emitUnauthorizedEvent();
    }
    const message = data?.message || "Erro na requisição.";
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
