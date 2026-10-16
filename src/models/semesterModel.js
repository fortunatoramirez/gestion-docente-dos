const db = require('../config/database');
const { withDemoFallback } = require('../utils/dbFallback');

async function current() {
  return withDemoFallback(async () => {
    const [rows] = await db.execute('SELECT * FROM academic_semesters WHERE is_current = 1');
    if (rows.length !== 1) throw new Error('Debe existir exactamente un semestre actual.');
    return rows[0];
  }, () => ({ code: process.env.ACTIVE_SEMESTER || require('../../scripts/seed').semester }));
}

async function findByCode(code) {
  return withDemoFallback(async () => {
    const [rows] = await db.execute('SELECT * FROM academic_semesters WHERE code = ?', [code]);
    if (!rows[0]) throw new Error(`El semestre ${code} no tiene un destino configurado.`);
    return rows[0];
  }, () => ({ code, legacy_layout: 1, drive_folder_id: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID }));
}

async function listAll() {
  return withDemoFallback(async () => {
    const [rows] = await db.execute('SELECT code,is_current FROM academic_semesters ORDER BY is_current DESC,code DESC');
    return rows;
  }, async () => {
    const active = (await current()).code;
    const assignments = require('./demoStore').listAssignmentsAdmin();
    const codes = [...new Set([active, ...assignments.map((assignment) => assignment.semester)])];
    return codes.map((code) => ({ code, is_current: code === active ? 1 : 0 }));
  });
}

module.exports = { current, findByCode, listAll };
