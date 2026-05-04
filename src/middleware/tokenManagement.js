import jwt from 'jsonwebtoken';

// Blacklist simples em memória (em produção, usar Redis)
const tokenBlacklist = new Set();

/**
 * Adicionar token à blacklist (logout)
 */
export const addToBlacklist = (token) => {
  tokenBlacklist.add(token);
  
  // Limpar token expirado da blacklist após 24h
  const decoded = jwt.decode(token);
  if (decoded && decoded.exp) {
    const expiryTime = (decoded.exp * 1000) - Date.now();
    if (expiryTime > 0) {
      setTimeout(() => {
        tokenBlacklist.delete(token);
      }, expiryTime);
    }
  }
};

/**
 * Verificar se token está na blacklist
 */
export const isTokenBlacklisted = (token) => {
  return tokenBlacklist.has(token);
};

/**
 * Middleware para verificar blacklist
 */
export const checkBlacklist = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (token && isTokenBlacklisted(token)) {
    return res.status(401).json({
      error: 'Token has been revoked. Please login again.',
    });
  }
  
  next();
};

/**
 * Gerar refresh token
 */
export const generateRefreshToken = (userId, email, role) => {
  return jwt.sign(
    { id: userId, email, role, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || 'refresh-secret',
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
};

/**
 * Gerar access token
 */
export const generateAccessToken = (userId, email, role) => {
  return jwt.sign(
    { id: userId, email, role, type: 'access' },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: process.env.JWT_EXPIRY || '1h' }
  );
};

/**
 * Verificar e renovar refresh token
 */
export const verifyRefreshToken = (refreshToken) => {
  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'refresh-secret'
    );
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

/**
 * Middleware para renovar token automaticamente
 */
export const refreshTokenMiddleware = (req, res, next) => {
  const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }
  
  try {
    const decoded = verifyRefreshToken(refreshToken);
    
    // Gerar novo access token
    const newAccessToken = generateAccessToken(decoded.id, decoded.email, decoded.role);
    
    // Opcionalmente, gerar novo refresh token também
    const newRefreshToken = generateRefreshToken(decoded.id, decoded.email, decoded.role);
    
    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: process.env.JWT_EXPIRY || '1h',
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

/**
 * Logout - adicionar token à blacklist
 */
export const logoutMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (token) {
    addToBlacklist(token);
  }
  
  res.json({ message: 'Logged out successfully' });
};
