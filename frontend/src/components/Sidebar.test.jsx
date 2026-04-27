import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();

vi.mock("react-router-dom", () => ({
  NavLink: ({ children, to }) => <a href={to}>{children}</a>,
  useNavigate: () => navigateMock,
}));

const apiFetchMock = vi.fn();
vi.mock("../lib/api", () => ({
  apiFetch: (...args) => apiFetchMock(...args),
}));

const clearTokenMock = vi.fn();
const clearUserMock = vi.fn();

vi.mock("../lib/auth", () => ({
  clearToken: (...args) => clearTokenMock(...args),
  clearUser: (...args) => clearUserMock(...args),
  getAuthUser: () => ({ role: "manager" }),
  hasRequiredRole: () => true,
}));

import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    apiFetchMock.mockReset();
    clearTokenMock.mockReset();
    clearUserMock.mockReset();
    navigateMock.mockReset();
  });

  it("logs out with backend call and clears local session", async () => {
    apiFetchMock.mockResolvedValue({ status: "ok" });
    render(<Sidebar />);

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/auth/logout", { method: "POST" });
      expect(clearTokenMock).toHaveBeenCalled();
      expect(clearUserMock).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  it("still clears local session when backend logout fails", async () => {
    apiFetchMock.mockRejectedValue(new Error("network"));
    render(<Sidebar />);

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    await waitFor(() => {
      expect(clearTokenMock).toHaveBeenCalled();
      expect(clearUserMock).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
    });
  });
});
