import { beforeEach, describe, expect, it } from "vitest";
import {
  clearToken,
  decodeTokenPayload,
  getAuthUser,
  getToken,
  getUser,
  hasRequiredRole,
  isAuthenticated,
  isTokenExpired,
  setUser,
  setToken,
  clearUser,
} from "./auth";

const toBase64Url = (obj) =>
  btoa(JSON.stringify(obj))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const createToken = (payload) => `header.${toBase64Url(payload)}.signature`;

describe("auth helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores and clears token", () => {
    setToken("abc");
    expect(getToken()).toBe("abc");
    clearToken();
    expect(getToken()).toBeNull();
  });

  it("stores and clears current user", () => {
    setUser({ id: 1, role: "admin" });
    expect(getUser()).toMatchObject({ id: 1, role: "admin" });
    clearUser();
    expect(getUser()).toBeNull();
  });


  it("clears invalid persisted user json", () => {
    localStorage.setItem("greenstore_user", "{invalid-json");

    expect(getUser()).toBeNull();
    expect(localStorage.getItem("greenstore_user")).toBeNull();
  });

  it("decodes payload and exposes user info", () => {
    const token = createToken({
      id: 9,
      name: "Marina",
      email: "marina@example.com",
      role: "manager",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    setToken(token);
    expect(decodeTokenPayload(token)?.name).toBe("Marina");
    expect(getAuthUser()).toMatchObject({
      id: 9,
      role: "manager",
    });
  });


  it("decodes payload even when base64 padding is omitted", () => {
    const token = createToken({
      id: 7,
      role: "supervisor",
      exp: Math.floor(Date.now() / 1000) + 3600,
      odd: "x",
    });

    expect(decodeTokenPayload(token)).toMatchObject({ id: 7, role: "supervisor", odd: "x" });
  });


  it("does not clear persisted user when decoding an invalid token", () => {
    setUser({ id: 5, role: "manager" });

    expect(decodeTokenPayload("invalid.token")).toBeNull();
    expect(getUser()).toMatchObject({ id: 5, role: "manager" });
  });

  it("marks expired token as unauthenticated", () => {
    const expired = createToken({
      id: 1,
      role: "operator",
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    setToken(expired);
    expect(isTokenExpired(expired)).toBe(true);
    expect(isAuthenticated()).toBe(false);
    expect(getToken()).toBeNull();
  });

  it("validates role hierarchy", () => {
    const token = createToken({
      id: 1,
      role: "manager",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    setToken(token);
    expect(hasRequiredRole("operator")).toBe(true);
    expect(hasRequiredRole("manager")).toBe(true);
    expect(hasRequiredRole("admin")).toBe(false);
  });
});
