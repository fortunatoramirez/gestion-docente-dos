const db = require('../config/database');
const demoStore = require('./demoStore');
const { withDemoFallback } = require('../utils/dbFallback');

async function findByAssignmentAndPeriod(assignmentId, period) {
  return withDemoFallback(
    async () => {
      const [rows] = await db.execute(
        `SELECT *
         FROM reports
         WHERE assignment_id = :assignmentId AND period = :period
         LIMIT 1`,
        { assignmentId, period }
      );

      return rows[0] || null;
    },
    () => demoStore.findReportByAssignmentAndPeriod(assignmentId, period)
  );
}

async function upsertReport(assignmentId, period, payload) {
  return withDemoFallback(
    async () => {
      const [result] = await db.execute(
        `INSERT INTO reports (
            assignment_id,
            period,
            enrolled_students,
            approved_students,
            absent_students,
            approved_percentage,
            absent_percentage,
            reproval_percentage,
            observations,
            additional_activities,
            progress_delayed,
            progress_notes,
            status,
            submitted_at
          )
          VALUES (
            :assignmentId,
            :period,
            :enrolled_students,
            :approved_students,
            :absent_students,
            :approved_percentage,
            :absent_percentage,
            :reproval_percentage,
            :observations,
            :additional_activities,
            :progress_delayed,
            :progress_notes,
            :status,
            IF(:status = 'submitted', NOW(), NULL)
          )
          ON DUPLICATE KEY UPDATE
            enrolled_students = VALUES(enrolled_students),
            approved_students = VALUES(approved_students),
            absent_students = VALUES(absent_students),
            approved_percentage = VALUES(approved_percentage),
            absent_percentage = VALUES(absent_percentage),
            reproval_percentage = VALUES(reproval_percentage),
            observations = VALUES(observations),
            additional_activities = VALUES(additional_activities),
            progress_delayed = VALUES(progress_delayed),
            progress_notes = VALUES(progress_notes),
            status = VALUES(status),
            submitted_at = IF(VALUES(status) = 'submitted', NOW(), submitted_at),
            id = LAST_INSERT_ID(id)`,
        {
          assignmentId,
          period,
          ...payload
        }
      );

      return result.insertId;
    },
    () => demoStore.upsertReport(assignmentId, period, payload)
  );
}

module.exports = {
  findByAssignmentAndPeriod,
  upsertReport
};
