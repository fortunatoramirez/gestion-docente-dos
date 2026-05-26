const db = require('../config/database');

async function create(payload) {
  const [result] = await db.execute(
    `INSERT INTO evidence_files (
        report_id,
        category,
        units,
        original_name,
        stored_name,
        mime_type,
        size_bytes,
        path
      )
      VALUES (
        :report_id,
        :category,
        :units,
        :original_name,
        :stored_name,
        :mime_type,
        :size_bytes,
        :path
      )`,
    payload
  );

  return result.insertId;
}

async function listByReportId(reportId) {
  if (!reportId) return [];

  const [rows] = await db.execute(
    `SELECT *
     FROM evidence_files
     WHERE report_id = :reportId
     ORDER BY category ASC, created_at DESC`,
    { reportId }
  );

  return rows;
}

async function findByIdForProfessor(evidenceId, professorId) {
  const [rows] = await db.execute(
    `SELECT
        e.*,
        r.assignment_id,
        r.period
      FROM evidence_files e
      INNER JOIN reports r ON r.id = e.report_id
      INNER JOIN teaching_assignments a ON a.id = r.assignment_id
      WHERE e.id = :evidenceId AND a.professor_id = :professorId
      LIMIT 1`,
    { evidenceId, professorId }
  );

  return rows[0] || null;
}

async function remove(evidenceId) {
  await db.execute(
    `DELETE FROM evidence_files WHERE id = :evidenceId LIMIT 1`,
    { evidenceId }
  );
}

module.exports = {
  create,
  listByReportId,
  findByIdForProfessor,
  remove
};
