const db = require('../config/database');
const demoStore = require('./demoStore');
const { withDemoFallback } = require('../utils/dbFallback');

async function listAll() {
  return withDemoFallback(
    async () => {
      const [rows] = await db.execute(
        `SELECT id, name, subject_code, credits
         FROM subjects
         ORDER BY name ASC`
      );

      return rows;
    },
    () => demoStore.listSubjects()
  );
}

async function findById(subjectId) {
  return withDemoFallback(
    async () => {
      const [rows] = await db.execute(
        `SELECT id, name, subject_code, credits
         FROM subjects
         WHERE id = :subjectId
         LIMIT 1`,
        { subjectId }
      );

      return rows[0] || null;
    },
    () => demoStore.findSubjectById(subjectId)
  );
}

async function create(payload) {
  return withDemoFallback(
    async () => {
      const [result] = await db.execute(
        `INSERT INTO subjects (name, subject_code, credits)
         VALUES (:name, :subject_code, :credits)`,
        payload
      );

      return result.insertId;
    },
    () => demoStore.createSubject(payload)
  );
}

async function update(subjectId, payload) {
  return withDemoFallback(
    async () => {
      await db.execute(
        `UPDATE subjects
         SET name = :name,
             subject_code = :subject_code,
             credits = :credits
         WHERE id = :subjectId`,
        { subjectId, ...payload }
      );
    },
    () => demoStore.updateSubject(subjectId, payload)
  );
}

module.exports = {
  create,
  findById,
  listAll,
  update
};
