function normalizeBasePath(value) {
  const clean = String(value || '/gestion-docente').trim();
  if (!clean || clean === '/') return '';
  return `/${clean.replace(/^\/+|\/+$/g, '')}`;
}

const basePath = normalizeBasePath(process.env.APP_BASE_PATH);

function urlFor(target = '/') {
  const cleanTarget = String(target || '/');
  const path = cleanTarget.startsWith('/') ? cleanTarget : `/${cleanTarget}`;
  if (path === '/') return basePath || '/';
  return `${basePath}${path}` || '/';
}

function prefixRedirect(location) {
  if (!basePath || typeof location !== 'string') return location;
  if (!location.startsWith('/') || location.startsWith(`${basePath}/`) || location === basePath) return location;
  return urlFor(location);
}

module.exports = {
  basePath,
  prefixRedirect,
  urlFor
};
