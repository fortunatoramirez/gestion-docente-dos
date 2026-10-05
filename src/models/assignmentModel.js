const db = require('../config/database');
const demoStore = require('./demoStore');
const { withDemoFallback } = require('../utils/dbFallback');
const { currentAssignmentCondition } = require('../utils/semesterAccess');
const Semester = require('./semesterModel');

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
            COALESCE(a.credits, s.credits) AS credits,
            MAX(CASE WHEN r.period = 1 THEN r.status END) AS report_1_status,
            MAX(CASE WHEN r.period = 2 THEN r.status END) AS report_2_status,
            MAX(CASE WHEN r.period = 3 THEN r.status END) AS report_3_status,
            COUNT(DISTINCT CASE WHEN r.period = 1 THEN e.id END) AS report_1_files,
            COUNT(DISTINCT CASE WHEN r.period = 2 THEN e.id END) AS report_2_files,
            COUNT(DISTINCT CASE WHEN r.period = 3 THEN e.id END) AS report_3_files
          FROM teaching_assignments a
          INNER JOIN subjects s ON s.id = a.subject_id
          INNER JOIN professors p ON p.id = a.professor_id
          LEFT JOIN reports r ON r.assignment_id = a.id
          LEFT JOIN evidence_files e ON e.report_id = r.id
          WHERE a.professor_id = :professorId AND ${currentAssignmentCondition}
          GROUP BY a.id, a.group_code, a.career, a.semester, a.credits, s.name, s.subject_code, s.credits
          ORDER BY a.semester DESC, s.name ASC, a.group_code ASC`,
        { professorId }
      );

      return rows;
    },
    async () => demoStore.listAssignmentsForProfessor(professorId, (await Semester.current()).code)
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
            a.professor_id,
            p.employee_number,
            p.full_name AS professor_name,
            s.name AS subject_name,
            s.subject_code,
            COALESCE(a.credits, s.credits) AS credits
          FROM teaching_assignments a
          INNER JOIN professors p ON p.id = a.professor_id
          INNER JOIN subjects s ON s.id = a.subject_id
          WHERE a.id = :assignmentId
            AND a.professor_id = :professorId
            AND ${currentAssignmentCondition}
          LIMIT 1`,
        { assignmentId, professorId }
      );

      return rows[0] || null;
    },
    async () => demoStore.findAssignmentByIdForProfessor(assignmentId, professorId, (await Semester.current()).code)
  );
}

async function listAllAdmin() {
  return withDemoFallback(
    async () => {
      const [rows] = await db.execute(
        `SELECT
            a.id,
            a.group_code,
            a.career,
            a.semester,
            a.active,
            p.id AS professor_id,
            p.employee_number,
            p.full_name AS professor_name,
            s.id AS subject_id,
            s.name AS subject_name,
            s.subject_code,
            MAX(CASE WHEN r.period = 1 THEN r.status END) AS report_1_status,
            MAX(CASE WHEN r.period = 2 THEN r.status END) AS report_2_status,
            MAX(CASE WHEN r.period = 3 THEN r.status END) AS report_3_status,
            COUNT(DISTINCT CASE WHEN r.period = 1 THEN e.id END) AS report_1_files,
            COUNT(DISTINCT CASE WHEN r.period = 2 THEN e.id END) AS report_2_files,
            COUNT(DISTINCT CASE WHEN r.period = 3 THEN e.id END) AS report_3_files
          FROM teaching_assignments a
          INNER JOIN professors p ON p.id = a.professor_id
          INNER JOIN subjects s ON s.id = a.subject_id
          LEFT JOIN reports r ON r.assignment_id = a.id
          LEFT JOIN evidence_files e ON e.report_id = r.id
          GROUP BY a.id, a.group_code, a.career, a.semester, a.active,
            p.id, p.employee_number, p.full_name,
            s.id, s.name, s.subject_code
          ORDER BY a.active DESC, p.full_name ASC, s.name ASC, a.group_code ASC`
      );

      return rows;
    },
    () => demoStore.listAssignmentsAdmin()
  );
}

async function findByIdAdmin(assignmentId) {
  return withDemoFallback(
    async () => {
      const [rows] = await db.execute(
        `SELECT
            id,
            professor_id,
            subject_id,
            group_code,
            career,
            semester,
            active
          FROM teaching_assignments
          WHERE id = :assignmentId
          LIMIT 1`,
        { assignmentId }
      );

      return rows[0] || null;
    },
    () => demoStore.findAssignmentByIdAdmin(assignmentId)
  );
}

async function create(payload) {
  return withDemoFallback(
    async () => {
      const [result] = await db.execute(
        `INSERT INTO teaching_assignments (
            professor_id,
            subject_id,
            group_code,
            career,
            semester,
            active
          )
          VALUES (
            :professor_id,
            :subject_id,
            :group_code,
            :career,
            :semester,
            :active
          )`,
        payload
      );

      return result.insertId;
    },
    () => demoStore.createAssignment(payload)
  );
}

async function update(assignmentId, payload) {
  return withDemoFallback(
    async () => {
      const existing = await findByIdAdmin(assignmentId);
      const identityChanged = existing && ['professor_id', 'subject_id', 'group_code', 'semester']
        .some((key) => String(existing[key]) !== String(payload[key]));
      if (identityChanged) {
        const [reports] = await db.execute('SELECT id FROM reports WHERE assignment_id = ? LIMIT 1', [assignmentId]);
        if (reports.length) {
          const error = new Error('Esta asignación tiene reportes. Desactívala y crea otra para conservar el historial.');
          error.status = 409;
          throw error;
        }
      }
      await db.execute(
        `UPDATE teaching_assignments
         SET professor_id = :professor_id,
             subject_id = :subject_id,
             group_code = :group_code,
             career = :career,
             semester = :semester,
             active = :active
         WHERE id = :assignmentId`,
        { assignmentId, ...payload }
      );
    },
    () => demoStore.updateAssignment(assignmentId, payload)
  );
}

async function findDetailAdmin(assignmentId) {
  return withDemoFallback(async () => {
    const [rows] = await db.execute(`SELECT a.*, p.employee_number, p.full_name AS professor_name,
      s.name AS subject_name, s.subject_code, COALESCE(a.credits, s.credits) AS credits
      FROM teaching_assignments a JOIN professors p ON p.id = a.professor_id
      JOIN subjects s ON s.id = a.subject_id WHERE a.id = ?`, [assignmentId]);
    return rows[0] || null;
  }, () => demoStore.listAssignmentsAdmin().find((item) => item.id === Number(assignmentId)) || null);
}

module.exports = {
  create,
  findByIdAdmin,
  findDetailAdmin,
  listForProfessor,
  findByIdForProfessor,
  listAllAdmin,
  update
};
