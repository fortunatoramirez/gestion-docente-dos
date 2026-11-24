const express = require('express');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { requireAuth, requirePasswordReady, requireAdmin, isAdminProfessor } = require('../middleware/auth');
const { departmentUpload } = require('../middleware/upload');
const { MAX_UPLOAD_MB } = require('../utils/uploadLimits');
const Semester = require('../models/semesterModel');
const Professor = require('../models/professorModel');
const storage = require('../services/evidenceStorage');
const model = require('../department/model');
const { areas, conditionalAreas, criteria, levels, sources, officesFor, allowedSources,
  applicability, criterionRecords, resultLabel } = require('../department/rubric');

const router = express.Router();
const handle = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const root = '/evaluacion';
const dossierPath = (id) => root + '/expedientes/' + id;
const missing = (res) => res.status(404).render('error.html', { title: 'Expediente no disponible', message: 'Revisa el expediente y el semestre seleccionados.' });
const denied = (res) => res.status(403).render('error.html', { title: 'Acceso restringido', message: 'Tu cuenta no tiene permiso para esta operación.' });
const invalid = (res, message) => res.status(422).render('error.html', { title: 'Revisa los datos', message });

router.use(requireAuth, requirePasswordReady);
router.use(handle(async (req, res, next) => {
  req.activeSemester = (await Semester.current()).code;
  req.actor = { admin: isAdminProfessor(req.session.professor), offices: officesFor(req.session.professor) };
  res.set('Cache-Control', 'private, no-store');
  next();
}));

router.get('/', handle(async (req, res) => {
  const own = await model.findOwn(req.session.professor.id, req.activeSemester);
  if (own) return res.redirect(dossierPath(own.id));
  if (req.actor.admin || req.actor.offices.length) return res.redirect(root + '/departamento');
  return res.render('department-index.html', { title: 'Evaluación departamental', view: 'own', semester: req.activeSemester });
}));

function requireOfficeOrAdmin(req, res, next) {
  return req.actor.admin || req.actor.offices.length ? next() : denied(res);
}

async function selectSemester(req, res, next) {
  const semesters = await Semester.listAll();
  const selected = req.query.semestre ?? req.activeSemester;
  if (!semesters.some((s) => s.code === selected)) return missing(res);
  if (!req.actor.admin && selected !== req.activeSemester) return denied(res);
  req.period = selected;
  res.locals.semesters = semesters;
  return next();
}

router.get('/departamento', requireOfficeOrAdmin, handle(selectSemester), handle(async (req, res) => {
  const items = await model.list(req.period);
  const current = req.period === req.activeSemester;
  const enrolled = new Set(items.map((i) => i.professor_id));
  const candidates = req.actor.admin && current
    ? (await Professor.listAll()).filter((p) => p.active && !enrolled.has(p.id)) : [];
  return res.render('department-index.html', { title: 'Evaluación departamental', view: 'office',
    semester: req.period, current, items, candidates, offices: req.actor.offices.map((key) => sources[key]) });
}));

router.post('/departamento/alta', requireAdmin, handle(async (req, res) => {
  if (req.body.semester !== req.activeSemester) return invalid(res, 'Selecciona el semestre actual para abrir el expediente.');
  if (!/^[1-9]\d*$/.test(req.body.professor_id)) return invalid(res, 'Elige un profesor activo de tiempo completo.');
  const professor = await Professor.findById(Number(req.body.professor_id));
  if (!professor?.active) return invalid(res, 'Elige un profesor activo de tiempo completo.');
  const id = await model.enroll(professor.id, req.activeSemester);
  return res.redirect(dossierPath(id));
}));

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

router.get('/departamento/concentrado.csv', requireAdmin, handle(selectSemester), handle(async (req, res) => {
  const items = await model.list(req.period);
  const data = await model.evidenceData(req.period, { current: req.period === req.activeSemester });
  const sourceKeys = Object.keys(sources);
  const rows = [['Semestre', 'No. empleado', 'Nombre del docente', 'Rubro', 'Criterio', 'Descripción', 'Aplicabilidad',
    'Valoración', 'Nivel (0–5)', 'Evidencias de plataforma', ...sourceKeys.map((key) => 'Aportaciones · ' + sources[key]), 'Observaciones']];
  for (const item of items) {
    const records = recordsFor(item, data, { full: true, admin: true, offices: [] });
    for (const c of records) {
      rows.push([item.semester, item.employee_number, item.full_name, areas[c.area].name, c.id, c.title, c.scope,
        resultLabel(c), c.score, c.automatic.length, ...sourceKeys.map((key) => c.manual.filter((f) => f.source === key).length), c.note]);
    }
  }
  const suffix = req.period.replace(/[^a-z0-9_-]/gi, '_');
  return res.attachment('evaluacion_departamental_' + suffix + '.csv').type('text/csv; charset=utf-8')
    .send('\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n');
}));

function recordsFor(item, data, actor) {
  const inDossier = (row) => row.evaluation_id === item.id;
  return criterionRecords(item, data.manual.filter(inDossier), data.automatic.filter(inDossier), data.reviews.filter(inDossier), actor);
}

router.use('/expedientes/:id', handle(async (req, res, next) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) return missing(res);
  const item = await model.find(Number(req.params.id));
  if (!item) return missing(res);
  req.actor.owner = item.professor_id === req.session.professor.id;
  req.actor.full = req.actor.owner || req.actor.admin;
  if (!req.actor.full && !req.actor.offices.length) return missing(res);
  req.current = item.semester === req.activeSemester;
  if (!req.current && !req.actor.admin) return missing(res);
  if (req.method !== 'GET' && req.method !== 'HEAD' && !req.current) return denied(res);
  req.dossier = item;
  return next();
}));

async function showDossier(req, res, print) {
  if (print && !req.actor.full) return denied(res);
  const item = req.dossier;
  const data = await model.evidenceData(item.semester, { id: item.id, current: req.current, full: req.actor.full });
  const records = recordsFor(item, data, req.actor);
  const base = dossierPath(item.id);
  const autoUrl = (entry) => {
    if (entry.file) return (req.actor.admin ? '/admin' : '/reportes') + '/evidencias/' + entry.file + '/descargar';
    return req.actor.admin ? '/admin/asignaciones/' + entry.assignment + '/reportes/' + entry.period
      : '/reportes/materias/' + entry.assignment + '/parcial/' + entry.period;
  };
  return res.render('department-dossier.html', { title: print ? 'Reporte individual' : 'Expediente departamental', item,
    actor: req.actor, records, base, autoUrl, areas, conditionalAreas, levels, sources, resultLabel, applicability,
    current: req.current, print, randomToken: crypto.randomUUID, maxUpload: MAX_UPLOAD_MB,
    saved: req.query.guardado === '1', opened: Number(req.query.criterio) });
}

router.get('/expedientes/:id', handle((req, res) => showDossier(req, res, false)));
router.get('/expedientes/:id/reporte', handle((req, res) => showDossier(req, res, true)));

router.post('/expedientes/:id/rubros', requireAdmin, handle(async (req, res) => {
  const scope = {};
  for (const key of conditionalAreas) {
    if (!['', '0', '1'].includes(req.body[key])) return invalid(res, 'Selecciona la aplicabilidad de cada rubro.');
    scope[key] = req.body[key] === '' ? null : Number(req.body[key]);
  }
  await model.setScope(req.dossier.id, scope);
  return res.redirect(dossierPath(req.dossier.id) + '?guardado=1');
}));

function loadCriterion(req, res, next) {
  req.criterion = criteria.find((c) => String(c.id) === req.params.criterion);
  return req.criterion ? next() : missing(res);
}

function backToCriterion(res, item, id) {
  return res.redirect(dossierPath(item.id) + '?guardado=1&criterio=' + id + '#criterio-' + id);
}

router.post('/expedientes/:id/criterios/:criterion/valorar', requireAdmin, loadCriterion, handle(async (req, res) => {
  if (applicability(req.dossier, req.criterion.area) !== 'Aplica') return invalid(res, 'Confirma que el rubro aplica antes de valorarlo.');
  const { score, note = '' } = req.body;
  if (typeof score !== 'string' || !/^[0-5]?$/.test(score) || typeof note !== 'string' || note.length > 1500) {
    return invalid(res, 'Elige un nivel de 0 a 5 o déjalo por valorar. La observación admite hasta 1500 caracteres.');
  }
  await model.saveReview({ evaluation_id: req.dossier.id, criterion: req.criterion.id, score: score === '' ? null : Number(score),
    note: note.trim(), reviewer_id: req.session.professor.id });
  return backToCriterion(res, req.dossier, req.criterion.id);
}));

router.post('/expedientes/:id/criterios/:criterion/evidencias', loadCriterion,
  (req, res, next) => allowedSources(req.actor, req.criterion).length ? next() : denied(res),
  departmentUpload, handle(async (req, res) => {
    const file = req.file;
    try {
      const { title, source, token } = req.body;
      if (!allowedSources(req.actor, req.criterion).includes(source)) return denied(res);
      if (!file || !file.size || typeof title !== 'string' || !title.trim() || title.trim().length > 180 ||
        file.originalname.length > 255 || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(token)) {
        return invalid(res, 'Escribe un título de hasta 180 caracteres y selecciona un archivo con contenido. Si el formulario expiró, abre de nuevo el criterio.');
      }
      const stored = await storage.storeDepartmentFile(req.dossier, req.criterion.id, file);
      try {
        await model.saveFile({ evaluation_id: req.dossier.id, criterion: req.criterion.id,
          contributor_id: req.session.professor.id, upload_token: token, source, title: title.trim(),
          original_name: file.originalname, stored_name: stored.storedName, mime_type: file.mimetype || 'application/octet-stream',
          size_bytes: file.size, path: stored.path, storage_provider: stored.storage_provider, storage_key: stored.storage_key });
      } catch (error) {
        await storage.removeEvidence(stored);
        if (error.code !== 'ER_DUP_ENTRY') throw error;
      }
      return backToCriterion(res, req.dossier, req.criterion.id);
    } finally {
      if (file) await fs.rm(file.path, { force: true });
    }
  }));

router.get('/expedientes/:id/evidencias/:file/descargar', handle(async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.file)) return missing(res);
  const file = await model.findFile(req.dossier.id, Number(req.params.file));
  if (!file) return missing(res);
  const criterion = criteria.find((c) => c.id === file.criterion);
  if (!req.actor.full && !(criterion?.offices.includes(file.source) && req.actor.offices.includes(file.source))) return missing(res);
  return storage.downloadEvidence({ ...file, stored_name: file.original_name }, res);
}));

router.use((error, req, res, next) => {
  if (error.code === 'DEPARTMENT_CHANGED') {
    return res.status(409).render('error.html', { title: 'El expediente cambió', message: error.message });
  }
  return next(error);
});

module.exports = router;
