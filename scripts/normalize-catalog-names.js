require('dotenv').config();

const db = require('../src/config/database');
const { normalizeCatalogName } = require('../src/utils/text');

async function normalizeTable(connection, tableName, columnName) {
  const [rows] = await connection.execute(`SELECT id, ${columnName} AS value FROM ${tableName}`);
  let changed = 0;

  for (const row of rows) {
    const normalized = normalizeCatalogName(row.value);
    if (normalized && normalized !== row.value) {
      await connection.execute(
        `UPDATE ${tableName} SET ${columnName} = :normalized WHERE id = :id`,
        { normalized, id: row.id }
      );
      changed += 1;
    }
  }

  return changed;
}

async function main() {
  const connection = await db.getConnection();

  try {
    const professors = await normalizeTable(connection, 'professors', 'full_name');
    const subjects = await normalizeTable(connection, 'subjects', 'name');
    console.log(`Nombres normalizados: ${professors} profesores, ${subjects} materias.`);
  } finally {
    connection.release();
    await db.end();
  }
}

main().catch(async (error) => {
  console.error(error);
  await db.end().catch(() => {});
  process.exit(1);
});
