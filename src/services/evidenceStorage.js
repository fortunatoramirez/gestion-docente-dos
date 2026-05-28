const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { google } = require('googleapis');

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

function evidenceFolderSegments(assignment, period) {
  const professorFolder = [
    cleanFolderSegment(assignment.employee_number, 'sin_numero'),
    cleanFolderSegment(assignment.professor_name, 'sin_nombre')
  ].join('_');

  return [
    professorFolder,
    reportFolderName(period),
    cleanFolderSegment(assignment.subject_name, 'materia_sin_nombre'),
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

function driveRootFolderId() {
  return process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || 'root';
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
    fields: 'files(id, name)',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });

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

async function ensureDriveFolderPath(segments) {
  const drive = await getDriveClient();
  let parentId = driveRootFolderId();

  for (const segment of segments) {
    parentId = await ensureDriveFolder(drive, parentId, segment);
  }

  return parentId;
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
  const targetDir = path.join(uploadRoot, ...evidenceFolderSegments(assignment, period));
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
  const drive = await getDriveClient();
  const parentId = await ensureDriveFolderPath(evidenceFolderSegments(assignment, period));
  const uniqueName = await uniqueDriveFileName(drive, parentId, storedName);

  try {
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
      web_url: response.data.webViewLink || null
    };
  } finally {
    await fsp.unlink(file.path).catch(() => {});
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
  removeEvidence,
  storeEvidenceFile
};
