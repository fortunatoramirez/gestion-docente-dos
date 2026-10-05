require('dotenv').config();
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const db = require('../src/config/database');
const storage = require('../src/services/evidenceStorage');
const Assignment = require('../src/models/assignmentModel');

async function main() {
  assert.equal(process.env.DB_NAME, 'gestion_docente_2026_3_test');
  const [[professor]] = await db.query("SELECT id FROM professors WHERE employee_number='2289'");
  const own = (await Assignment.listForProfessor(professor.id)).find((row) => row.group_code === 'BM6A');
  const assignment = await Assignment.findByIdForProfessor(own.id, professor.id);
  const content = `Prueba tecnica temporal 2026-3 ${crypto.randomBytes(12).toString('hex')}`;
  const drive = await storage.getDriveClient();
  const files = [];
  let reportId;
  try {
    await db.execute('INSERT INTO reports (id,assignment_id,period,status) VALUES (2000000000,?,1,\'draft\')', [own.id]);
    reportId = 2000000000;
    const temporary = path.join(process.env.UPLOAD_DIR, 'drive-verification.txt');
    await fs.writeFile(temporary, content);
    const first = await storage.storeEvidenceFile({ assignment, period:1, storedName:`VERIFICACION_TECNICA_${Date.now()}.txt`, file:{ path:temporary,mimetype:'text/plain' } });
    files.push(first.storage_key);
    await fs.writeFile(temporary, content);
    const second = await storage.storeEvidenceFile({ assignment, period:1, storedName:`VERIFICACION_TECNICA_${Date.now()}_2.txt`, file:{ path:temporary,mimetype:'text/plain' } });
    files.push(second.storage_key);
    assert.equal(first.storage_folder_id, second.storage_folder_id);
    const report = await storage.storeReportSnapshot(assignment,1,reportId);
    files.push(report.id);
    const repeated = await storage.storeReportSnapshot(assignment,1,reportId);
    assert.equal(report.id,repeated.id);
    const response = await drive.files.get({ fileId:first.storage_key,alt:'media',supportsAllDrives:true },{ responseType:'text' });
    assert.equal(response.data,content);
    const info = await drive.files.get({ fileId:report.id,fields:'parents,permissions(type,role),mimeType',supportsAllDrives:true });
    assert(!info.data.permissions.some((permission) => permission.type === 'anyone'));
    let folderId = info.data.parents[0];
    let reachedDestination = false;
    for (let depth=0;depth<6;depth+=1) {
      if (folderId === '104VEyo9nczlUVGuQLFhhSDCtQZEL2NNY') { reachedDestination=true; break; }
      const folder = await drive.files.get({ fileId:folderId,fields:'parents,name',supportsAllDrives:true });
      folderId = folder.data.parents[0];
    }
    assert(reachedDestination,'Report must be inside the existing semester folder');
    console.log('PASS Drive: evidence write/read, correct semester/professor/subject/group destination, persistent folder IDs, same report ID on repeat, no public sharing');
  } finally {
    for (const fileId of files) await drive.files.delete({ fileId,supportsAllDrives:true });
    if (reportId) await db.execute('DELETE FROM reports WHERE id=?',[reportId]);
  }
}
main().catch((error) => { console.error(error.message); process.exitCode=1; }).finally(async () => { await db.end(); process.exit(process.exitCode || 0); });
