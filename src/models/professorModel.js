const db = require('../config/database');
const demoStore = require('./demoStore');
const { withDemoFallback } = require('../utils/dbFallback');

async function findByEmployeeNumber(employeeNumber) {
  return withDemoFallback(
    async () => {
      const [rows] = await db.execute(
        `SELECT id, employee_number, full_name, email, department
         FROM professors
         WHERE employee_number = :employeeNumber AND active = 1
         LIMIT 1`,
        { employeeNumber }
      );

      return rows[0] || null;
    },
    () => demoStore.findProfessorByEmployeeNumber(employeeNumber)
  );
}

async function listAll() {
  return withDemoFallback(
    async () => {
      const [rows] = await db.execute(
        `SELECT id, employee_number, full_name, email, department, active
         FROM professors
         ORDER BY active DESC, full_name ASC`
      );

      return rows;
    },
    () => demoStore.listProfessors()
  );
}

async function findById(professorId) {
  return withDemoFallback(
    async () => {
      const [rows] = await db.execute(
        `SELECT id, employee_number, full_name, email, department, active
         FROM professors
         WHERE id = :professorId
         LIMIT 1`,
        { professorId }
      );

      return rows[0] || null;
    },
    () => demoStore.findProfessorById(professorId)
  );
}

async function create(payload) {
  return withDemoFallback(
    async () => {
      const [result] = await db.execute(
        `INSERT INTO professors (employee_number, full_name, email, department, active)
         VALUES (:employee_number, :full_name, :email, :department, :active)`,
        payload
      );

      return result.insertId;
    },
    () => demoStore.createProfessor(payload)
  );
}

async function update(professorId, payload) {
  return withDemoFallback(
    async () => {
      await db.execute(
        `UPDATE professors
         SET employee_number = :employee_number,
             full_name = :full_name,
             email = :email,
             department = :department,
             active = :active
         WHERE id = :professorId`,
        { professorId, ...payload }
      );
    },
    () => demoStore.updateProfessor(professorId, payload)
  );
}

module.exports = {
  create,
  findById,
  findByEmployeeNumber,
  listAll,
  update
};
