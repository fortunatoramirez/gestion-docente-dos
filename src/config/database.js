const mysql = require('mysql2/promise');
const mysqlConfig = require('./mysql');

const pool = mysql.createPool({
  ...mysqlConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
  decimalNumbers: true
});

module.exports = pool;
