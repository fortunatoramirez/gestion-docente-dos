const MySQLStoreFactory = require('express-mysql-session');

const mysqlConfig = require('./mysql');

const DEFAULT_SESSION_TTL_HOURS = 8;

function sessionTtlMs() {
  const ttlHours = Number(process.env.SESSION_TTL_HOURS || DEFAULT_SESSION_TTL_HOURS);
  const safeTtlHours = Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : DEFAULT_SESSION_TTL_HOURS;
  return safeTtlHours * 60 * 60 * 1000;
}

function sessionStoreName() {
  return String(process.env.SESSION_STORE || (process.env.NODE_ENV === 'production' ? 'mysql' : 'memory')).toLowerCase();
}

function createSessionStore(session) {
  if (sessionStoreName() !== 'mysql') return null;

  const MySQLStore = MySQLStoreFactory(session);
  return new MySQLStore({
    ...mysqlConfig,
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: sessionTtlMs(),
    createDatabaseTable: true,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data'
      }
    }
  });
}

module.exports = {
  createSessionStore,
  sessionTtlMs
};
