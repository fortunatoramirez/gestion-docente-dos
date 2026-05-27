const db = require('../config/database');
const demoStore = require('./demoStore');
const { withDemoFallback } = require('../utils/dbFallback');
const { hashPassword } = require('../utils/passwords');

const PUBLIC_COLUMNS = [
  'id',
  'employee_number',
  'full_name',
  'email',
  'department',
  'active',
  'password_hash',
  'must_change_password',
  'password_changed_at',
  'last_login_at'
].join(', ');

async function findByEmployeeNumber(employeeNumber) {
  return withDemoFallback(
    async () => {
      const [rows] = await db.execute(
        `SELECT ${PUBLIC_COLUMNS}
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
        `SELECT ${PUBLIC_COLUMNS}
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
        `SELECT ${PUBLIC_COLUMNS}
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
  const passwordHash = await hashPassword(payload.temporary_password || payload.employee_number);
  const professor = {
    employee_number: payload.employee_number,
    full_name: payload.full_name,
    email: payload.email,
    department: payload.department,
    active: payload.active,
    password_hash: passwordHash,
    must_change_password: 1
  };

  return withDemoFallback(
    async () => {
      const [result] = await db.execute(
        `INSERT INTO professors (
           employee_number,
           full_name,
           email,
           department,
           active,
           password_hash,
           must_change_password
         )
         VALUES (
           :employee_number,
           :full_name,
           :email,
           :department,
           :active,
           :passwordHash,
           1
         )`,
        { ...professor, passwordHash }
      );

      return result.insertId;
    },
    () => demoStore.createProfessor(professor)
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

async function setPassword(professorId, password, { mustChange = false } = {}) {
  const passwordHash = await hashPassword(password);

  return withDemoFallback(
    async () => {
      await db.execute(
        `UPDATE professors
         SET password_hash = :passwordHash,
             must_change_password = :mustChange,
             password_changed_at = NOW()
         WHERE id = :professorId`,
        {
          professorId,
          passwordHash,
          mustChange: mustChange ? 1 : 0
        }
      );
    },
    () => demoStore.setProfessorPassword(professorId, passwordHash, mustChange ? 1 : 0)
  );
}

async function recordLogin(professorId) {
  return withDemoFallback(
    async () => {
      await db.execute(
        `UPDATE professors
         SET last_login_at = NOW()
         WHERE id = :professorId`,
        { professorId }
      );
    },
    () => demoStore.recordProfessorLogin(professorId)
  );
}

module.exports = {
  create,
  findById,
  findByEmployeeNumber,
  listAll,
  recordLogin,
  setPassword,
  update
};
