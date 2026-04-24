import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./api";
import { clearToken, getToken, getUser, setToken, setUser } from "./auth";

describe("apiFetch", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearToken();
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
});
