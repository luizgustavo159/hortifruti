import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pages/Login", () => ({ Login: () => <div>login-page</div> }));
vi.mock("./pages/Caixa", () => ({ Caixa: () => <div>caixa-page</div> }));
vi.mock("./pages/Estoque", () => ({ Estoque: () => <div>estoque-page</div> }));
vi.mock("./pages/Descontos", () => ({ Descontos: () => <div>descontos-page</div> }));
vi.mock("./pages/AdminDashboard", () => ({ AdminDashboard: () => <div>admin-page</div> }));
vi.mock("./pages/AdminLogs", () => ({ AdminLogs: () => <div>admin-logs-page</div> }));
vi.mock("./pages/AdminPerfil", () => ({ AdminPerfil: () => <div>admin-perfil-page</div> }));
vi.mock("./pages/AdminPoliticas", () => ({ AdminPoliticas: () => <div>admin-politicas-page</div> }));
vi.mock("./pages/AdminRelatorios", () => ({ AdminRelatorios: () => <div>admin-relatorios-page</div> }));
vi.mock("./pages/AdminFuncionarios", () => ({ AdminFuncionarios: () => <div>admin-funcionarios-page</div> }));
vi.mock("./pages/AdminConfiguracao", () => ({ AdminConfiguracao: () => <div>admin-configuracao-page</div> }));

const mockApiFetch = vi.fn();
vi.mock("./lib/api", () => ({
  apiFetch: (...args) => mockApiFetch(...args),
}));

const authState = {
  isAuthenticated: false,
  user: null,
  hasRequiredRole: true,
};

const setUserMock = vi.fn();
const clearTokenMock = vi.fn();
const clearUserMock = vi.fn();

vi.mock("./lib/auth", () => ({
  isAuthenticated: () => authState.isAuthenticated,
  getUser: () => authState.user,
  setUser: (...args) => setUserMock(...args),
  clearToken: (...args) => clearTokenMock(...args),
  clearUser: (...args) => clearUserMock(...args),
  hasRequiredRole: (requiredRole) => (requiredRole ? authState.hasRequiredRole : true),
}));

import App from "./App";

describe("App session bootstrap", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.history.pushState({}, "", "/");
    authState.isAuthenticated = false;
    authState.user = null;
    authState.hasRequiredRole = true;
    mockApiFetch.mockReset();
    setUserMock.mockReset();
    clearTokenMock.mockReset();
    clearUserMock.mockReset();
  });

  it("shows login when user is not authenticated", async () => {
    render(<App />);
    expect(await screen.findByText("login-page")).toBeTruthy();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("loads profile from /auth/me when token exists but user cache is empty", async () => {
    authState.isAuthenticated = true;
    mockApiFetch.mockResolvedValue({ id: 1, role: "admin" });

    render(<App />);
    expect(screen.getByText("Carregando sessão...")).toBeTruthy();

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/auth/me"));
    expect(setUserMock).toHaveBeenCalledWith({ id: 1, role: "admin" });
  });

  it("redirects to /caixa when role is insufficient for protected route", async () => {
    window.history.pushState({}, "", "/admin");
    authState.isAuthenticated = true;
    authState.user = { id: 1, role: "operator" };
    authState.hasRequiredRole = false;

    render(<App />);
    const pages = await screen.findAllByText("caixa-page");
    expect(pages.length).toBeGreaterThan(0);
  });
  it("redirects unknown routes to login when unauthenticated", async () => {
    window.history.pushState({}, "", "/rota-inexistente");

    render(<App />);

    expect(await screen.findByText("login-page")).toBeTruthy();
  });

  it("shows admin page when user has admin role", async () => {
    window.history.pushState({}, "", "/admin");
    authState.isAuthenticated = true;
    authState.user = { id: 1, role: "admin" };
    authState.hasRequiredRole = true;

    render(<App />);

    expect(await screen.findByText("admin-page")).toBeTruthy();
  });

  it("redirects to login after unauthorized event", async () => {
    window.history.pushState({}, "", "/admin");
    authState.isAuthenticated = true;
    authState.user = { id: 1, role: "admin" };
    authState.hasRequiredRole = true;

    render(<App />);
    expect(await screen.findByText("admin-page")).toBeTruthy();

    authState.isAuthenticated = false;
    window.dispatchEvent(new CustomEvent("greenstore:unauthorized"));

    expect(await screen.findByText("login-page")).toBeTruthy();
  });

  it("redirects to login after token removal in another tab", async () => {
    window.history.pushState({}, "", "/admin");
    authState.isAuthenticated = true;
    authState.user = { id: 1, role: "admin" };
    authState.hasRequiredRole = true;

    render(<App />);
    expect(await screen.findByText("admin-page")).toBeTruthy();

    authState.isAuthenticated = false;
    window.dispatchEvent(new StorageEvent("storage", { key: "greenstore_token", newValue: null }));

    expect(await screen.findByText("login-page")).toBeTruthy();
  });

});
