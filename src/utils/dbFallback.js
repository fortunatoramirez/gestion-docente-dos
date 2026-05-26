const connectionErrorCodes = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST',
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR'
]);

let warned = false;

function fallbackEnabled() {
  return String(process.env.DB_DEMO_FALLBACK || 'true').toLowerCase() !== 'false';
}

function shouldUseDemoFallback(error) {
  return fallbackEnabled() && error && connectionErrorCodes.has(error.code);
}

function warnDemoFallback(error) {
  if (warned) return;
  warned = true;
  console.warn(`MySQL no disponible (${error.code}). Usando datos demo en memoria.`);
}

async function withDemoFallback(operation, fallback) {
  try {
    return await operation();
  } catch (error) {
    if (!shouldUseDemoFallback(error)) throw error;
    warnDemoFallback(error);
    return fallback();
  }
}

module.exports = {
  withDemoFallback
};
