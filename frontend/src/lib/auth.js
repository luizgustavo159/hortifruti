const TOKEN_KEY = "greenstore_token";
const roleLevels = {
  operator: 1,
  supervisor: 2,
  manager: 3,
  admin: 4,
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

export const decodeTokenPayload = (token) => {
  if (!token) {
    return null;
  }
  try {
    const [, payloadBase64] = token.split(".");
    if (!payloadBase64) {
      return null;
    }
    const normalized = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized));
    return payload;
  } catch (_error) {
    return null;
  }
};

export const isTokenExpired = (token) => {
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) {
    return false;
  }
  return payload.exp * 1000 <= Date.now();
};

export const getAuthUser = () => {
  const token = getToken();
  const payload = decodeTokenPayload(token);
  if (!payload) {
    return null;
  }
  return {
    id: payload.id,
    name: payload.name,
    email: payload.email,
    role: payload.role || "operator",
  };
};

export const hasRequiredRole = (requiredRole) => {
  if (!requiredRole) {
    return true;
  }
  const user = getAuthUser();
  const currentLevel = roleLevels[user?.role] || 0;
  const requiredLevel = roleLevels[requiredRole] || Number.MAX_SAFE_INTEGER;
  return currentLevel >= requiredLevel;
};

export const isAuthenticated = () => {
  const token = getToken();
  if (!token) {
    return false;
  }
  if (isTokenExpired(token)) {
    clearToken();
    return false;
  }
  return true;
};
