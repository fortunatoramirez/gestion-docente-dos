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

module.exports = {
  findByEmployeeNumber
};
