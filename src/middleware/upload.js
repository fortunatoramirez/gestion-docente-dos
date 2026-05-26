const fs = require('fs');
const multer = require('multer');
const { tempUploadRoot } = require('../config/paths');
const { evidenceCategories } = require('../utils/categories');

fs.mkdirSync(tempUploadRoot, { recursive: true });

const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 512);

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
    fileSize: maxUploadMb * 1024 * 1024,
    files: evidenceCategories.length * 5
  }
});

const reportUploadFields = evidenceCategories.map((category) => ({
  name: `evidence_${category.key}`,
  maxCount: 5
}));

module.exports = upload.fields(reportUploadFields);
