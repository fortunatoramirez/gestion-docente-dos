const fs = require('fs/promises');

const Assignment = require('../models/assignmentModel');
const Report = require('../models/reportModel');
const Evidence = require('../models/evidenceModel');
const evidenceStorage = require('../services/evidenceStorage');
const { evidenceCategories } = require('../utils/categories');
const {
  buildEvidenceFileName,
  bytesToHuman,
  hasSelectedUnits,
  romanUnits,
  selectedUnits
} = require('../utils/filename');

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

function reportLabel(period) {
  return Number(period) === 3 ? 'Reporte final' : `Reporte parcial ${period}`;
}

function listUploadedFiles(files) {
  return Object.values(files || {}).flat();
}

async function cleanupUploadedFiles(files) {
  await Promise.all(
    listUploadedFiles(files).map((file) => fs.unlink(file.path).catch(() => {}))
  );
}

function validateEvidenceUnits({ files, body }) {
  const missingCategories = evidenceCategories.filter((category) => {
    const uploadedFiles = files[`evidence_${category.key}`] || [];
    return uploadedFiles.length && !hasSelectedUnits(body[`units_${category.key}`]);
  });

  if (!missingCategories.length) return null;

  const labels = missingCategories.map((category) => category.label).join(', ');
  return `Selecciona al menos una unidad para: ${labels}.`;
}

async function persistUploadedFiles({ files, body, reportId, assignment, period }) {
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
      const storedFile = await evidenceStorage.storeEvidenceFile({
        file,
        storedName,
        assignment,
        period
      });

      await Evidence.create({
        report_id: reportId,
        category: category.key,
        units: selectedUnits(units),
        original_name: file.originalname,
        stored_name: storedFile.storedName,
        mime_type: file.mimetype,
        size_bytes: file.size,
        path: storedFile.path,
        storage_provider: storedFile.storage_provider,
        storage_key: storedFile.storage_key,
        web_url: storedFile.web_url
      });
    }
  }
}

async function renderReportForm(req, res, { assignment, period, report, saved = false, error = null }) {
  const evidence = await Evidence.listByReportId(report && report.id);

  return res.render('report-form.html', {
    title: reportLabel(period),
    assignment,
    period,
    report,
    evidenceByCategory: groupEvidence(evidence),
    categories: evidenceCategories,
    romanUnits,
    bytesToHuman,
    reportLabel: reportLabel(period),
    saved,
    error
  });
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
    return renderReportForm(req, res, {
      assignment,
      period,
      report,
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

    const unitsError = validateEvidenceUnits({ files: req.files || {}, body: req.body });
    if (unitsError) {
      await cleanupUploadedFiles(req.files || {});
      const report = await Report.findByAssignmentAndPeriod(assignment.id, period);
      return res.status(400).render('report-form.html', {
        title: reportLabel(period),
        assignment,
        period,
        report,
        evidenceByCategory: groupEvidence(await Evidence.listByReportId(report && report.id)),
        categories: evidenceCategories,
        romanUnits,
        bytesToHuman,
        reportLabel: reportLabel(period),
        saved: false,
        error: unitsError
      });
    }

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

    return evidenceStorage.downloadEvidence(evidence, res);
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

    await evidenceStorage.removeEvidence(evidence);
    await Evidence.remove(evidence.id);

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
