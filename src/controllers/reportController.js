const fs = require('fs/promises');
const path = require('path');

const Assignment = require('../models/assignmentModel');
const Report = require('../models/reportModel');
const Evidence = require('../models/evidenceModel');
const { evidenceCategories } = require('../utils/categories');
const { buildEvidenceFileName, bytesToHuman, romanUnits, selectedUnits } = require('../utils/filename');
const { uploadRoot } = require('../config/paths');

function parsePeriod(value) {
  const period = Number(value);
  return [1, 2, 3].includes(period) ? period : null;
}

function toInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
}

function calculatePercentages({ enrolled, approved, absent }) {
  if (!enrolled) {
    return {
      approvedPercentage: 0,
      absentPercentage: 0,
      reprovalPercentage: 0
    };
  }

  const failed = Math.max(enrolled - approved - absent, 0);

  return {
    approvedPercentage: Number(((approved / enrolled) * 100).toFixed(2)),
    absentPercentage: Number(((absent / enrolled) * 100).toFixed(2)),
    reprovalPercentage: Number(((failed / enrolled) * 100).toFixed(2))
  };
}

function groupEvidence(files) {
  return evidenceCategories.reduce((groups, category) => {
    groups[category.key] = files.filter((file) => file.category === category.key);
    return groups;
  }, {});
}

function appendCounter(fileName, counter) {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  return `${base}-${counter}${ext}`;
}

async function uniquePath(directory, fileName) {
  let counter = 1;
  let candidateName = fileName;
  let candidatePath = path.join(directory, candidateName);

  while (true) {
    try {
      await fs.access(candidatePath);
      counter += 1;
      candidateName = appendCounter(fileName, counter);
      candidatePath = path.join(directory, candidateName);
    } catch (error) {
      return { candidateName, candidatePath };
    }
  }
}

async function persistUploadedFiles({ files, body, reportId, assignment, period }) {
  const targetDir = path.join(
    uploadRoot,
    String(assignment.employee_number),
    String(assignment.id),
    `reporte-${period}`
  );

  await fs.mkdir(targetDir, { recursive: true });

  for (const category of evidenceCategories) {
    const uploadedFiles = files[`evidence_${category.key}`] || [];
    const units = body[`units_${category.key}`];

    for (const [index, file] of uploadedFiles.entries()) {
      const storedName = buildEvidenceFileName({
        assignment,
        categoryLabel: category.label,
        units,
        originalName: file.originalname,
        index
      });
      const unique = await uniquePath(targetDir, storedName);
      await fs.rename(file.path, unique.candidatePath);

      await Evidence.create({
        report_id: reportId,
        category: category.key,
        units: selectedUnits(units),
        original_name: file.originalname,
        stored_name: unique.candidateName,
        mime_type: file.mimetype,
        size_bytes: file.size,
        path: unique.candidatePath
      });
    }
  }
}

async function showForm(req, res, next) {
  try {
    const period = parsePeriod(req.params.period);
    if (!period) return res.redirect('/dashboard');

    const assignment = await Assignment.findByIdForProfessor(
      req.params.assignmentId,
      req.session.professor.id
    );
    if (!assignment) return res.redirect('/dashboard');

    const report = await Report.findByAssignmentAndPeriod(assignment.id, period);
    const evidence = await Evidence.listByReportId(report && report.id);

    return res.render('report-form.html', {
      title: `Reporte ${period}`,
      assignment,
      period,
      report,
      evidenceByCategory: groupEvidence(evidence),
      categories: evidenceCategories,
      romanUnits,
      bytesToHuman,
      saved: req.query.guardado === '1'
    });
  } catch (error) {
    return next(error);
  }
}

async function save(req, res, next) {
  try {
    const period = parsePeriod(req.params.period);
    if (!period) return res.redirect('/dashboard');

    const assignment = await Assignment.findByIdForProfessor(
      req.params.assignmentId,
      req.session.professor.id
    );
    if (!assignment) return res.redirect('/dashboard');

    const enrolled = toInteger(req.body.enrolled_students);
    const approved = toInteger(req.body.approved_students);
    const absent = toInteger(req.body.absent_students);
    const percentages = calculatePercentages({ enrolled, approved, absent });
    const status = req.body.action === 'submit' ? 'submitted' : 'draft';

    const reportId = await Report.upsertReport(assignment.id, period, {
      enrolled_students: enrolled,
      approved_students: approved,
      absent_students: absent,
      approved_percentage: percentages.approvedPercentage,
      absent_percentage: percentages.absentPercentage,
      reproval_percentage: percentages.reprovalPercentage,
      observations: String(req.body.observations || '').trim(),
      additional_activities: String(req.body.additional_activities || '').trim(),
      progress_delayed: req.body.progress_delayed === '1' ? 1 : 0,
      progress_notes: String(req.body.progress_notes || '').trim(),
      status
    });

    await persistUploadedFiles({
      files: req.files || {},
      body: req.body,
      reportId,
      assignment,
      period
    });

    return res.redirect(`/reportes/materias/${assignment.id}/parcial/${period}?guardado=1`);
  } catch (error) {
    return next(error);
  }
}

async function downloadEvidence(req, res, next) {
  try {
    const evidence = await Evidence.findByIdForProfessor(
      req.params.evidenceId,
      req.session.professor.id
    );
    if (!evidence) return res.redirect('/dashboard');

    return res.download(evidence.path, evidence.stored_name);
  } catch (error) {
    return next(error);
  }
}

async function deleteEvidence(req, res, next) {
  try {
    const evidence = await Evidence.findByIdForProfessor(
      req.params.evidenceId,
      req.session.professor.id
    );
    if (!evidence) return res.redirect('/dashboard');

    await Evidence.remove(evidence.id);
    await fs.unlink(evidence.path).catch(() => {});

    return res.redirect(
      `/reportes/materias/${evidence.assignment_id}/parcial/${evidence.period}?guardado=1`
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  showForm,
  save,
  downloadEvidence,
  deleteEvidence
};
