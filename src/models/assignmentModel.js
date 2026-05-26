const db = require('../config/database');
const demoStore = require('./demoStore');
const { withDemoFallback } = require('../utils/dbFallback');

async function listForProfessor(professorId) {
  return withDemoFallback(
    async () => {
      const [rows] = await db.execute(
        `SELECT
            a.id,
            a.group_code,
            a.career,
            a.semester,
            s.name AS subject_name,
            s.subject_code,
            s.credits,
            MAX(CASE WHEN r.period = 1 THEN r.status END) AS report_1_status,
            MAX(CASE WHEN r.period = 2 THEN r.status END) AS report_2_status,
            MAX(CASE WHEN r.period = 3 THEN r.status END) AS report_3_status,
            COUNT(DISTINCT CASE WHEN r.period = 1 THEN e.id END) AS report_1_files,
            COUNT(DISTINCT CASE WHEN r.period = 2 THEN e.id END) AS report_2_files,
            COUNT(DISTINCT CASE WHEN r.period = 3 THEN e.id END) AS report_3_files
          FROM teaching_assignments a
          INNER JOIN subjects s ON s.id = a.subject_id
          LEFT JOIN reports r ON r.assignment_id = a.id
          LEFT JOIN evidence_files e ON e.report_id = r.id
          WHERE a.professor_id = :professorId AND a.active = 1
          GROUP BY a.id, a.group_code, a.career, a.semester, s.name, s.subject_code, s.credits
          ORDER BY a.semester DESC, s.name ASC, a.group_code ASC`,
        { professorId }
      );

      return rows;
    },
    () => demoStore.listAssignmentsForProfessor(professorId)
  );
}

async function findByIdForProfessor(assignmentId, professorId) {
  return withDemoFallback(
    async () => {
      const [rows] = await db.execute(
        `SELECT
            a.id,
            a.group_code,
            a.career,
            a.semester,
            p.employee_number,
            p.full_name AS professor_name,
            s.name AS subject_name,
            s.subject_code,
            s.credits
          FROM teaching_assignments a
          INNER JOIN professors p ON p.id = a.professor_id
          INNER JOIN subjects s ON s.id = a.subject_id
          WHERE a.id = :assignmentId
            AND a.professor_id = :professorId
            AND a.active = 1
          LIMIT 1`,
        { assignmentId, professorId }
      );

      return rows[0] || null;
    },
    () => demoStore.findAssignmentByIdForProfessor(assignmentId, professorId)
  );
}

module.exports = {
  listForProfessor,
  findByIdForProfessor
};
