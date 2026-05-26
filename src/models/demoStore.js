const { professors, semester, careerFromGroup } = require('../../scripts/seed');

const state = {
  professors: [],
  subjects: [],
  assignments: [],
  reports: [],
  evidence: [],
  nextReportId: 1,
  nextEvidenceId: 1
};

function normalizeProfessor(source, index) {
  return {
    id: index + 1,
    employee_number: source.employeeNumber,
    full_name: source.fullName,
    email: null,
    department: 'DIEE'
  };
}

function ensureSubject(subjectMap, name, credits, subjectCode) {
  if (subjectMap.has(name)) {
    const existing = subjectMap.get(name);
    if (subjectCode && !existing.subject_code) existing.subject_code = subjectCode;
    return existing;
  }

  const subject = {
    id: state.subjects.length + 1,
    name,
    subject_code: subjectCode || null,
    credits
  };

  subjectMap.set(name, subject);
  state.subjects.push(subject);
  return subject;
}

function hydrate() {
  if (state.professors.length) return;

  const subjectMap = new Map();
  professors.forEach((professor, professorIndex) => {
    const demoProfessor = normalizeProfessor(professor, professorIndex);
    state.professors.push(demoProfessor);

    professor.assignments.forEach(([name, groupCode, credits, subjectCode]) => {
      const subject = ensureSubject(subjectMap, name, credits, subjectCode);
      state.assignments.push({
        id: state.assignments.length + 1,
        professor_id: demoProfessor.id,
        subject_id: subject.id,
        group_code: groupCode,
        career: careerFromGroup(groupCode),
        semester,
        active: 1
      });
    });
  });
}

function findProfessorByEmployeeNumber(employeeNumber) {
  hydrate();
  return state.professors.find((professor) => professor.employee_number === String(employeeNumber)) || null;
}

function reportStats(assignmentId, period) {
  const report = state.reports.find(
    (item) => item.assignment_id === assignmentId && item.period === period
  );

  if (!report) {
    return {
      status: null,
      files: 0
    };
  }

  return {
    status: report.status,
    files: state.evidence.filter((file) => file.report_id === report.id).length
  };
}

function assignmentView(assignment) {
  const subject = state.subjects.find((item) => item.id === assignment.subject_id);
  const professor = state.professors.find((item) => item.id === assignment.professor_id);
  const report1 = reportStats(assignment.id, 1);
  const report2 = reportStats(assignment.id, 2);
  const report3 = reportStats(assignment.id, 3);

  return {
    id: assignment.id,
    group_code: assignment.group_code,
    career: assignment.career,
    semester: assignment.semester,
    employee_number: professor.employee_number,
    professor_name: professor.full_name,
    subject_name: subject.name,
    subject_code: subject.subject_code,
    credits: subject.credits,
    report_1_status: report1.status,
    report_2_status: report2.status,
    report_3_status: report3.status,
    report_1_files: report1.files,
    report_2_files: report2.files,
    report_3_files: report3.files
  };
}

function listAssignmentsForProfessor(professorId) {
  hydrate();
  return state.assignments
    .filter((assignment) => assignment.professor_id === Number(professorId) && assignment.active)
    .map(assignmentView)
    .sort((a, b) => a.subject_name.localeCompare(b.subject_name) || a.group_code.localeCompare(b.group_code));
}

function findAssignmentByIdForProfessor(assignmentId, professorId) {
  hydrate();
  const assignment = state.assignments.find(
    (item) => item.id === Number(assignmentId) && item.professor_id === Number(professorId) && item.active
  );

  return assignment ? assignmentView(assignment) : null;
}

function findReportByAssignmentAndPeriod(assignmentId, period) {
  hydrate();
  return state.reports.find(
    (report) => report.assignment_id === Number(assignmentId) && report.period === Number(period)
  ) || null;
}

function upsertReport(assignmentId, period, payload) {
  hydrate();
  let report = findReportByAssignmentAndPeriod(assignmentId, period);

  if (!report) {
    report = {
      id: state.nextReportId,
      assignment_id: Number(assignmentId),
      period: Number(period),
      created_at: new Date()
    };
    state.nextReportId += 1;
    state.reports.push(report);
  }

  Object.assign(report, payload, {
    status: payload.status || 'draft',
    updated_at: new Date(),
    submitted_at: payload.status === 'submitted' ? new Date() : report.submitted_at || null
  });

  return report.id;
}

function createEvidence(payload) {
  hydrate();
  const evidence = {
    id: state.nextEvidenceId,
    ...payload,
    created_at: new Date()
  };
  state.nextEvidenceId += 1;
  state.evidence.push(evidence);
  return evidence.id;
}

function listEvidenceByReportId(reportId) {
  hydrate();
  if (!reportId) return [];
  return state.evidence.filter((file) => file.report_id === Number(reportId));
}

function findEvidenceByIdForProfessor(evidenceId, professorId) {
  hydrate();
  const evidence = state.evidence.find((file) => file.id === Number(evidenceId));
  if (!evidence) return null;

  const report = state.reports.find((item) => item.id === evidence.report_id);
  const assignment = report && state.assignments.find((item) => item.id === report.assignment_id);
  if (!assignment || assignment.professor_id !== Number(professorId)) return null;

  return {
    ...evidence,
    assignment_id: assignment.id,
    period: report.period
  };
}

function removeEvidence(evidenceId) {
  hydrate();
  const index = state.evidence.findIndex((file) => file.id === Number(evidenceId));
  if (index >= 0) state.evidence.splice(index, 1);
}

module.exports = {
  findProfessorByEmployeeNumber,
  listAssignmentsForProfessor,
  findAssignmentByIdForProfessor,
  findReportByAssignmentAndPeriod,
  upsertReport,
  createEvidence,
  listEvidenceByReportId,
  findEvidenceByIdForProfessor,
  removeEvidence
};
