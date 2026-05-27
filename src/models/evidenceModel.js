const db = require('../config/database');
const demoStore = require('./demoStore');
const { withDemoFallback } = require('../utils/dbFallback');

async function create(payload) {
  return withDemoFallback(
    async () => {
      const evidence = {
        storage_provider: 'local',
        storage_key: payload.path,
        web_url: null,
        ...payload
      };

      const [result] = await db.execute(
        `INSERT INTO evidence_files (
            report_id,
            category,
            units,
            original_name,
            stored_name,
            mime_type,
            size_bytes,
            path,
            storage_provider,
            storage_key,
            web_url
          )
          VALUES (
            :report_id,
            :category,
            :units,
            :original_name,
            :stored_name,
            :mime_type,
            :size_bytes,
            :path,
            :storage_provider,
            :storage_key,
            :web_url
          )`,
        evidence
      );

      return result.insertId;
    },
    () => demoStore.createEvidence(payload)
  );
}

async function listByReportId(reportId) {
  if (!reportId) return [];

  return withDemoFallback(
    async () => {
      const [rows] = await db.execute(
        `SELECT *
         FROM evidence_files
         WHERE report_id = :reportId
         ORDER BY category ASC, created_at DESC`,
        { reportId }
      );

      return rows;
    },
    () => demoStore.listEvidenceByReportId(reportId)
  );
}

async function findByIdForProfessor(evidenceId, professorId) {
  return withDemoFallback(
    async () => {
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
    },
    () => demoStore.findEvidenceByIdForProfessor(evidenceId, professorId)
  );
}

async function remove(evidenceId) {
  return withDemoFallback(
    async () => {
      await db.execute(
        `DELETE FROM evidence_files WHERE id = :evidenceId LIMIT 1`,
        { evidenceId }
      );
    },
    () => demoStore.removeEvidence(evidenceId)
  );
}

module.exports = {
  create,
  listByReportId,
  findByIdForProfessor,
  remove
};
