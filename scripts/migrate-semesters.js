require('dotenv').config();
const db = require('../src/config/database');

async function migrate() {
  await db.query(`CREATE TABLE IF NOT EXISTS academic_semesters (
    code VARCHAR(80) NOT NULL PRIMARY KEY,
    label VARCHAR(180) NOT NULL,
    is_current TINYINT(1) NOT NULL DEFAULT 0,
    drive_folder_id VARCHAR(180) NULL,
    legacy_layout TINYINT(1) NOT NULL DEFAULT 0,
    current_key TINYINT GENERATED ALWAYS AS (CASE WHEN is_current = 1 THEN 1 ELSE NULL END) STORED,
    UNIQUE KEY unique_current_semester (current_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await db.query(`CREATE TABLE IF NOT EXISTS drive_folders (
    semester VARCHAR(80) NOT NULL,
    professor_id INT UNSIGNED NOT NULL,
    relative_path VARCHAR(512) NOT NULL,
    folder_id VARCHAR(180) NOT NULL,
    PRIMARY KEY (semester, professor_id, relative_path),
    CONSTRAINT fk_drive_folder_semester FOREIGN KEY (semester) REFERENCES academic_semesters(code),
    CONSTRAINT fk_drive_folder_professor FOREIGN KEY (professor_id) REFERENCES professors(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  const columns = {
    teaching_assignments: {
      credits: 'TINYINT UNSIGNED NULL',
      source_name: 'VARCHAR(220) NULL',
      source_page: 'SMALLINT UNSIGNED NULL',
      source_document: 'VARCHAR(180) NULL'
    },
    evidence_files: { storage_folder_id: 'VARCHAR(180) NULL' },
    reports: { drive_file_id: 'VARCHAR(180) NULL', drive_folder_id: 'VARCHAR(180) NULL', drive_web_url: 'VARCHAR(1024) NULL' }
  };
  for (const [table, definitions] of Object.entries(columns)) {
    const [existing] = await db.execute('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [table]);
    const names = new Set(existing.map((row) => row.COLUMN_NAME));
    for (const [column, definition] of Object.entries(definitions)) {
      if (!names.has(column)) await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    }
  }
}

if (require.main === module) migrate().then(() => console.log('Semester schema ready')).catch((error) => {
  console.error(error.message); process.exitCode = 1;
}).finally(() => db.end());

module.exports = migrate;
