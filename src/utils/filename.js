const path = require('path');
const { stripAccents } = require('./text');

const romanUnits = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

function normalizeList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanSegment(value) {
  return stripAccents(value)
    .replace(/[^a-zA-Z0-9 _.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanFolderSegment(value, fallback = 'sin_nombre') {
  return cleanSegment(value)
    .replace(/[ .]+$/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase() || fallback;
}

function selectedUnits(value) {
  const values = normalizeList(value)
    .map((unit) => String(unit).toUpperCase().trim())
    .filter((unit) => romanUnits.includes(unit));

  return values.length ? values.join('-') : 'SIN-UNIDAD';
}

function hasSelectedUnits(value) {
  return selectedUnits(value) !== 'SIN-UNIDAD';
}

function reportFolderName(period) {
  return Number(period) === 3 ? 'reporte_final' : `reporte_${period}`;
}

function buildEvidenceFileName({ assignment, categoryLabel, units, originalName, index = 0 }) {
  const ext = path.extname(originalName || '').toLowerCase();
  const subjectCode = assignment.subject_code ? `${cleanSegment(assignment.subject_code)} - ` : '';
  const groupCode = cleanSegment(assignment.group_code);
  const suffix = index > 0 ? ` ${index + 1}` : '';
  const baseName = `${selectedUnits(units)} ${subjectCode}${groupCode} ${cleanSegment(categoryLabel)}${suffix}`;

  return `${baseName}${ext || '.bin'}`;
}

function bytesToHuman(size) {
  const bytes = Number(size || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

module.exports = {
  buildEvidenceFileName,
  bytesToHuman,
  cleanFolderSegment,
  hasSelectedUnits,
  reportFolderName,
  selectedUnits,
  romanUnits
};
