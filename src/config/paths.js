const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const uploadRoot = path.resolve(projectRoot, process.env.UPLOAD_DIR || 'storage/uploads');
const tempUploadRoot = path.join(uploadRoot, 'tmp');

module.exports = {
  projectRoot,
  uploadRoot,
  tempUploadRoot
};
