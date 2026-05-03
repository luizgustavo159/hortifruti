import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, normalizeApiError } from "./api";
import { clearToken, getToken, getUser, setToken, setUser } from "./auth";

describe("apiFetch", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearToken();
    vi.useRealTimers();
  });

  it("sends authorization header when token exists", async () => {
    setToken("jwt-token");
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });

    const data = await apiFetch("/health");
    expect(data).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-token",
        }),
      })
    );
  });


  it("does not force json content-type on requests without body", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });

    await apiFetch("/health");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({
        headers: expect.not.objectContaining({
          "Content-Type": expect.anything(),
        }),
      })
    );
  });


  it("does not force json content-type on FormData body", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });

    const form = new FormData();
    form.append("file", new Blob(["x"], { type: "text/plain" }), "x.txt");

    await apiFetch("/upload", { method: "POST", body: form });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/upload",
      expect.objectContaining({
        headers: expect.not.objectContaining({
          "Content-Type": expect.anything(),
        }),
      })
    );
  });

  it("throws backend message for non-2xx responses", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ message: "Credenciais inválidas." }),
    });

    await expect(apiFetch("/auth/login", { method: "POST" })).rejects.toThrow("Credenciais inválidas.");
  });


  it("exposes response status in thrown errors", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ message: "Sem permissão." }),
    });

    await expect(apiFetch("/admin")).rejects.toMatchObject({
      message: "Sem permissão.",
      status: 403,
    });
  });

  it("clears local session on 401", async () => {
    setToken("jwt-token");
    setUser({ id: 1, role: "operator" });
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: "Sessão expirada." }),
    });

    await expect(apiFetch("/auth/me")).rejects.toThrow("Sessão expirada.");
    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
  });
  it("emits unauthorized event on 401", async () => {
    setToken("jwt-token");
    const unauthorizedListener = vi.fn();
    window.addEventListener("greenstore:unauthorized", unauthorizedListener);

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: "Sessão expirada." }),
    });

    await expect(apiFetch("/auth/me")).rejects.toThrow("Sessão expirada.");
    expect(unauthorizedListener).toHaveBeenCalledTimes(1);

    window.removeEventListener("greenstore:unauthorized", unauthorizedListener);
  });

  it("throws friendly network error when fetch fails", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(apiFetch("/health")).rejects.toMatchObject({
      message: "Falha de conexão com o servidor.",
      status: 0,
    });
  });

  it("throws timeout error when request exceeds limit", async () => {
    vi.useFakeTimers();

    vi.spyOn(global, "fetch").mockImplementation((_url, options) => {
      return new Promise((_, reject) => {
        options.signal.addEventListener("abort", () => {
          const abortError = new DOMException("Aborted", "AbortError");
          reject(abortError);
        });
      });
    });

    const requestPromise = apiFetch("/health");
    const assertion = expect(requestPromise).rejects.toMatchObject({
      message: "Tempo de requisição excedido.",
      status: 0,
    });

    await vi.advanceTimersByTimeAsync(16000);
    await assertion;
  });

  it("normalizes common API errors for UI", () => {
    expect(normalizeApiError({ status: 401, message: "x" })).toBe("Sessão expirada. Faça login novamente.");
    expect(normalizeApiError({ status: 403, message: "x" })).toBe("Você não tem permissão para esta operação.");
    expect(normalizeApiError({ status: 0, message: "Falha de conexão com o servidor." })).toBe("Falha de conexão com o servidor.");
    expect(normalizeApiError({ status: 500, message: "Erro interno." })).toBe("Erro interno.");
  });

});
