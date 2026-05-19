const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Blacklist em memória como fallback quando Redis não está disponível
const memoryBlacklist = new Map();

// Limpar entradas expiradas periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, expiry] of memoryBlacklist.entries()) {
    if (expiry < now) {
      memoryBlacklist.delete(key);
    }
  }
}, 60 * 1000); // Limpar a cada 1 minuto

// Cliente mock que usa memória
const client = {
  isOpen: true,
  async set(key, value, options) {
    const ttlMs = options && options.EX ? options.EX * 1000 : 3600 * 1000;
    memoryBlacklist.set(key, Date.now() + ttlMs);
    return 'OK';
  },
  async get(key) {
    const expiry = memoryBlacklist.get(key);
    if (!expiry) return null;
    if (expiry < Date.now()) {
      memoryBlacklist.delete(key);
      return null;
    }
    return '1';
  },
  on(event, handler) {
    // Ignorar eventos no modo memória
    return this;
  },
};

async function connectRedis() {
  // Usando memória, não precisa conectar
  return;
}

logger.info('Redis: usando blacklist em memória (sem Redis externo)');

module.exports = {
  client,
  connectRedis
};
