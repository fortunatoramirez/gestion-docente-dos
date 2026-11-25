require('dotenv').config();
const fs = require('node:fs/promises');
const path = require('node:path');
const db = require('../src/config/database');

async function migrate() {
  const file = path.join(__dirname, '../db/migrations/20261124_department_evaluations.sql');
  const sql = await fs.readFile(file, 'utf8');
  for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
    await db.query(statement);
  }
  const [columns] = await db.execute(`SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='department_evaluations' AND COLUMN_NAME='enabled'`);
  if (!columns.length) {
    await db.query('ALTER TABLE department_evaluations ADD COLUMN enabled TINYINT UNSIGNED NOT NULL DEFAULT 1');
  }
}

if (require.main === module) migrate().then(() => console.log('Evaluación departamental lista.'))
  .catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.end());

module.exports = migrate;
