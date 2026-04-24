import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./api";
import { clearToken, setToken } from "./auth";

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

  it("throws backend message for non-2xx responses", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ message: "Credenciais inválidas." }),
    });

    await expect(apiFetch("/auth/login", { method: "POST" })).rejects.toThrow("Credenciais inválidas.");
  });
});
