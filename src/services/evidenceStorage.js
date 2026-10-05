const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const ejs = require('ejs');
const { google } = require('googleapis');
const db = require('../config/database');
const Semester = require('../models/semesterModel');

const { uploadRoot } = require('../config/paths');
const { cleanFolderSegment, reportFolderName } = require('../utils/filename');

const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const DRIVE_PROVIDER = 'google_drive';
const LOCAL_PROVIDER = 'local';

let driveClient = null;

function storageDriver() {
  return String(process.env.STORAGE_DRIVER || LOCAL_PROVIDER).toLowerCase();
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function evidenceFolderSegments(assignment, period, { legacy = false } = {}) {
  const professorFolder = [
    cleanFolderSegment(assignment.employee_number, 'sin_numero'),
    cleanFolderSegment(assignment.professor_name, 'sin_nombre')
  ].join('_');

  return [
    professorFolder,
    reportFolderName(period),
    cleanFolderSegment(assignment.subject_name, 'materia_sin_nombre'),
    ...(legacy ? [] : [cleanFolderSegment(assignment.group_code, 'sin_grupo')]),
    'evidencias'
  ];
}

function appendCounter(fileName, counter) {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  return `${base}-${counter}${ext}`;
}

async function uniqueLocalPath(directory, fileName) {
  let counter = 1;
  let candidateName = fileName;
  let candidatePath = path.join(directory, candidateName);

  while (true) {
    try {
      await fsp.access(candidatePath);
      counter += 1;
      candidateName = appendCounter(fileName, counter);
      candidatePath = path.join(directory, candidateName);
    } catch (error) {
      return { candidateName, candidatePath };
    }
  }
}

function driveAuthOptions() {
  const scopes = ['https://www.googleapis.com/auth/drive'];

  if (process.env.GOOGLE_OAUTH_CLIENT_KEY_FILE && process.env.GOOGLE_OAUTH_TOKEN_FILE) {
    const clientFile = readJsonFile(process.env.GOOGLE_OAUTH_CLIENT_KEY_FILE);
    const clientConfig = clientFile.installed || clientFile.web;

    if (!clientConfig) {
      throw new Error('El archivo GOOGLE_OAUTH_CLIENT_KEY_FILE no parece ser un cliente OAuth válido.');
    }

    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI
      || (clientConfig.redirect_uris && clientConfig.redirect_uris[0])
      || 'http://localhost';

    const auth = new google.auth.OAuth2(
      clientConfig.client_id,
      clientConfig.client_secret,
      redirectUri
    );

    auth.setCredentials(readJsonFile(process.env.GOOGLE_OAUTH_TOKEN_FILE));
    return auth;
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return {
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes
    };
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE) {
    return {
      keyFile: path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE),
      scopes
    };
  }

  throw new Error('Faltan credenciales de Google Drive para STORAGE_DRIVER=google_drive.');
}

async function getDriveClient() {
  if (driveClient) return driveClient;

  const authOptions = driveAuthOptions();
  const auth = authOptions instanceof google.auth.OAuth2
    ? authOptions
    : new google.auth.GoogleAuth(authOptions);

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

function escapeDriveQueryValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function findDriveFolder(drive, parentId, folderName) {
  const escapedName = escapeDriveQueryValue(folderName);
  const escapedParentId = escapeDriveQueryValue(parentId);
  const response = await drive.files.list({
    q: [
      `name = '${escapedName}'`,
      `mimeType = '${DRIVE_FOLDER_MIME_TYPE}'`,
      `'${escapedParentId}' in parents`,
      'trashed = false'
    ].join(' and '),
    fields: 'files(id, name),nextPageToken',
    pageSize: 100,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });

  if (response.data.nextPageToken || response.data.files.length > 1) {
    throw new Error(`Hay varias carpetas llamadas ${folderName} dentro del destino. Revisa sus IDs.`);
  }
  return response.data.files && response.data.files[0];
}

async function ensureDriveFolder(drive, parentId, folderName) {
  const existing = await findDriveFolder(drive, parentId, folderName);
  if (existing) return existing.id;

  const response = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: DRIVE_FOLDER_MIME_TYPE,
      parents: [parentId]
    },
    fields: 'id',
    supportsAllDrives: true
  });

  return response.data.id;
}

async function ensureDriveFolderPath(assignment, segments) {
  const drive = await getDriveClient();
  const semester = await Semester.findByCode(assignment.semester);
  if (!semester.drive_folder_id) throw new Error(`Falta la carpeta de Drive para ${assignment.semester}.`);
  let parentId = semester.drive_folder_id;
  const root = await drive.files.get({ fileId: parentId, fields: 'mimeType,trashed,capabilities(canAddChildren)', supportsAllDrives: true });
  if (root.data.trashed || root.data.mimeType !== DRIVE_FOLDER_MIME_TYPE || !root.data.capabilities.canAddChildren) {
    throw new Error(`El destino de ${assignment.semester} no es una carpeta con permiso de escritura.`);
  }
  const relative = [];

  for (const segment of segments) {
    relative.push(segment);
    const relativePath = relative.join('/');
    const connection = await db.getConnection();
    const lock = `gd-folder-${crypto.createHash('sha256').update(`${parentId}/${segment}`).digest('hex').slice(0, 40)}`;
    try {
      const [[result]] = await connection.execute('SELECT GET_LOCK(?, 30) AS acquired', [lock]);
      if (!result.acquired) throw new Error('No fue posible bloquear la creación de la carpeta. Intenta nuevamente.');
      const [stored] = await connection.execute('SELECT folder_id FROM drive_folders WHERE semester = ? AND professor_id = ? AND relative_path = ?', [assignment.semester, assignment.professor_id, relativePath]);
      let folderId = stored[0] && stored[0].folder_id;
      if (folderId) {
        const info = await drive.files.get({ fileId: folderId, fields: 'parents,mimeType,trashed', supportsAllDrives: true });
        if (info.data.trashed || info.data.mimeType !== DRIVE_FOLDER_MIME_TYPE || !info.data.parents.includes(parentId)) {
          throw new Error('Una carpeta registrada fue movida o eliminada. Revisa el destino antes de continuar.');
        }
      } else {
        folderId = await ensureDriveFolder(drive, parentId, segment);
        await connection.execute('INSERT INTO drive_folders (semester, professor_id, relative_path, folder_id) VALUES (?, ?, ?, ?)', [assignment.semester, assignment.professor_id, relativePath, folderId]);
      }
      parentId = folderId;
    } finally {
      await connection.execute('SELECT RELEASE_LOCK(?)', [lock]).catch(() => {});
      connection.release();
    }
  }

  return parentId;
}

async function ensureProfessorFolder(assignment) {
  return ensureDriveFolderPath(assignment, evidenceFolderSegments(assignment, 1).slice(0, 1));
}

async function assignmentFolderSegments(assignment, period) {
  const semester = await Semester.findByCode(assignment.semester);
  return evidenceFolderSegments(assignment, period, { legacy: Boolean(semester.legacy_layout) });
}

async function driveFileExists(drive, parentId, fileName) {
  const escapedName = escapeDriveQueryValue(fileName);
  const escapedParentId = escapeDriveQueryValue(parentId);
  const response = await drive.files.list({
    q: [
      `name = '${escapedName}'`,
      `'${escapedParentId}' in parents`,
      'trashed = false'
    ].join(' and '),
    fields: 'files(id)',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });

  return Boolean(response.data.files && response.data.files.length);
}

async function uniqueDriveFileName(drive, parentId, fileName) {
  let counter = 1;
  let candidateName = fileName;

  while (await driveFileExists(drive, parentId, candidateName)) {
    counter += 1;
    candidateName = appendCounter(fileName, counter);
  }

  return candidateName;
}

async function storeLocalFile({ file, storedName, assignment, period }) {
  const semester = await Semester.findByCode(assignment.semester);
  const segments = await assignmentFolderSegments(assignment, period);
  const targetDir = path.join(uploadRoot, ...(semester.legacy_layout ? [] : [cleanFolderSegment(assignment.semester)]), ...segments);
  await fsp.mkdir(targetDir, { recursive: true });

  const unique = await uniqueLocalPath(targetDir, storedName);
  await fsp.rename(file.path, unique.candidatePath);

  return {
    storedName: unique.candidateName,
    path: unique.candidatePath,
    storage_provider: LOCAL_PROVIDER,
    storage_key: unique.candidatePath,
    web_url: null
  };
}

async function storeDriveFile({ file, storedName, assignment, period }) {
  try {
    const drive = await getDriveClient();
    const parentId = await ensureDriveFolderPath(assignment, await assignmentFolderSegments(assignment, period));
    const uniqueName = await uniqueDriveFileName(drive, parentId, storedName);
    const response = await drive.files.create({
      requestBody: {
        name: uniqueName,
        parents: [parentId]
      },
      media: {
        mimeType: file.mimetype || 'application/octet-stream',
        body: fs.createReadStream(file.path)
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true
    });

    return {
      storedName: uniqueName,
      path: `${DRIVE_PROVIDER}:${response.data.id}`,
      storage_provider: DRIVE_PROVIDER,
      storage_key: response.data.id,
      storage_folder_id: parentId,
      web_url: response.data.webViewLink || null
    };
  } finally {
    await fsp.unlink(file.path).catch(() => {});
  }
}

async function storeReportSnapshot(assignment, period, reportId) {
  if (storageDriver() !== DRIVE_PROVIDER) return null;
  const drive = await getDriveClient();
  const segments = await assignmentFolderSegments(assignment, period);
  const parentId = await ensureDriveFolderPath(assignment, segments.slice(0, -1));
  const connection = await db.getConnection();
  const lock = `gd-report-${reportId}`;
  try {
    const [[result]] = await connection.execute('SELECT GET_LOCK(?, 30) AS acquired', [lock]);
    if (!result.acquired) throw new Error('El reporte está siendo guardado. Intenta nuevamente.');
    const [[report]] = await connection.execute('SELECT * FROM reports WHERE id = ? AND assignment_id = ?', [reportId, assignment.id]);
    if (!report) throw new Error('No se encontró el reporte que se desea guardar.');
    const [evidence] = await connection.execute('SELECT * FROM evidence_files WHERE report_id = ? ORDER BY category, id', [reportId]);
    const html = await ejs.renderFile(path.join(__dirname, '../views/report-export.html'), { assignment, report, evidence });
    const media = { mimeType: 'text/html', body: Readable.from([html]) };
    let fileId = report.drive_file_id;
    if (!fileId) {
      const name = `reporte_${period === 3 ? 'final' : period}_${cleanFolderSegment(assignment.group_code)}_${reportId}.html`;
      const escapedName = escapeDriveQueryValue(name);
      const found = await drive.files.list({ q: `'${escapeDriveQueryValue(parentId)}' in parents and name = '${escapedName}' and trashed = false`, fields: 'files(id)', supportsAllDrives: true, includeItemsFromAllDrives: true });
      if (found.data.files.length > 1) throw new Error('Hay más de una copia del reporte en Drive.');
      fileId = found.data.files[0] && found.data.files[0].id;
      if (!fileId) {
        const created = await drive.files.create({ requestBody: { name, parents: [parentId] }, media, fields: 'id,webViewLink', supportsAllDrives: true });
        await connection.execute('UPDATE reports SET drive_file_id = ?, drive_folder_id = ?, drive_web_url = ? WHERE id = ?', [created.data.id, parentId, created.data.webViewLink || null, reportId]);
        return created.data;
      }
    }
    const info = await drive.files.get({ fileId, fields: 'parents,trashed', supportsAllDrives: true });
    if (info.data.trashed || !info.data.parents.includes(parentId)) throw new Error('El reporte registrado no está en su carpeta original.');
    const updated = await drive.files.update({ fileId, media, fields: 'id,webViewLink', supportsAllDrives: true });
    await connection.execute('UPDATE reports SET drive_file_id = ?, drive_folder_id = ?, drive_web_url = ? WHERE id = ?', [fileId, parentId, updated.data.webViewLink || null, reportId]);
    return updated.data;
  } finally {
    await connection.execute('SELECT RELEASE_LOCK(?)', [lock]).catch(() => {});
    connection.release();
  }
}

async function storeEvidenceFile(payload) {
  if (storageDriver() === DRIVE_PROVIDER) {
    return storeDriveFile(payload);
  }

  return storeLocalFile(payload);
}

function providerForEvidence(evidence) {
  if (evidence.storage_provider) return evidence.storage_provider;
  return String(evidence.path || '').startsWith(`${DRIVE_PROVIDER}:`) ? DRIVE_PROVIDER : LOCAL_PROVIDER;
}

function driveFileId(evidence) {
  if (evidence.storage_key) return evidence.storage_key;
  return String(evidence.path || '').replace(`${DRIVE_PROVIDER}:`, '');
}

function downloadFileName(fileName) {
  return String(fileName || 'evidencia').replace(/["\r\n]/g, '');
}

async function downloadEvidence(evidence, res) {
  if (providerForEvidence(evidence) !== DRIVE_PROVIDER) {
    return res.download(evidence.path, evidence.stored_name);
  }

  const drive = await getDriveClient();
  const response = await drive.files.get(
    {
      fileId: driveFileId(evidence),
      alt: 'media',
      supportsAllDrives: true
    },
    { responseType: 'stream' }
  );

  res.setHeader('Content-Type', evidence.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName(evidence.stored_name)}"`);
  response.data.on('error', (error) => res.destroy(error));
  return response.data.pipe(res);
}

async function removeEvidence(evidence) {
  if (providerForEvidence(evidence) !== DRIVE_PROVIDER) {
    await fsp.unlink(evidence.path).catch(() => {});
    return;
  }

  const drive = await getDriveClient();
  await drive.files.delete({
    fileId: driveFileId(evidence),
    supportsAllDrives: true
  }).catch((error) => {
    if (error.code !== 404) throw error;
  });
}

module.exports = {
  DRIVE_PROVIDER,
  LOCAL_PROVIDER,
  downloadEvidence,
  evidenceFolderSegments,
  ensureProfessorFolder,
  findDriveFolder,
  getDriveClient,
  removeEvidence,
  storeReportSnapshot,
  storeEvidenceFile
};
