const fs = require('fs');
const multer = require('multer');
const { tempUploadRoot } = require('../config/paths');
const { evidenceCategories } = require('../utils/categories');
const {
  MAX_FILES_PER_UPLOAD_FIELD,
  MAX_UPLOAD_BYTES
} = require('../utils/uploadLimits');

fs.mkdirSync(tempUploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: tempUploadRoot,
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: evidenceCategories.length * MAX_FILES_PER_UPLOAD_FIELD
  }
});

const reportUploadFields = evidenceCategories.map((category) => ({
  name: `evidence_${category.key}`,
  maxCount: MAX_FILES_PER_UPLOAD_FIELD
}));

module.exports = upload.fields(reportUploadFields);
