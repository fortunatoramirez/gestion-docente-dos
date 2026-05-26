const db = require('../config/database');

async function findByEmployeeNumber(employeeNumber) {
  const [rows] = await db.execute(
    `SELECT id, employee_number, full_name, email, department
     FROM professors
     WHERE employee_number = :employeeNumber AND active = 1
     LIMIT 1`,
    { employeeNumber }
  );

  return rows[0] || null;
}

module.exports = {
  findByEmployeeNumber
};
