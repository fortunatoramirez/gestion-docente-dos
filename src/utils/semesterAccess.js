// All teacher reads and writes share this predicate, including direct file URLs.
const currentAssignmentCondition = `a.active = 1
  AND a.semester = (SELECT code FROM academic_semesters WHERE is_current = 1)
  AND (a.semester <> '2026-3' OR (
    UPPER(LEFT(TRIM(a.group_code), 1)) NOT IN ('M', 'D')
    AND NOT (p.employee_number = '2030' AND UPPER(TRIM(a.group_code)) = 'NT3A')
  ))`;

function admissible(assignment, employeeNumber) {
  return assignment.semester !== '2026-3' || (
    !/^[MD]/i.test(String(assignment.group_code).trim())
    && !(String(employeeNumber) === '2030' && String(assignment.group_code).trim().toUpperCase() === 'NT3A')
  );
}

module.exports = { currentAssignmentCondition, admissible };
