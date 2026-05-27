const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024
};

function normalizePassword(password) {
  return String(password || '');
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const derivedKey = await scrypt(normalizePassword(password), salt, KEY_LENGTH, SCRYPT_OPTIONS);

  return [
    'scrypt',
    SCRYPT_OPTIONS.N,
    SCRYPT_OPTIONS.r,
    SCRYPT_OPTIONS.p,
    salt,
    derivedKey.toString('base64url')
  ].join('$');
}

async function verifyPassword(password, passwordHash) {
  if (!passwordHash) return false;

  const [algorithm, n, r, p, salt, expectedHash] = String(passwordHash).split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHash) return false;

  const options = {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT_OPTIONS.maxmem
  };

  const derivedKey = await scrypt(normalizePassword(password), salt, KEY_LENGTH, options);
  const expected = Buffer.from(expectedHash, 'base64url');

  if (expected.length !== derivedKey.length) return false;
  return crypto.timingSafeEqual(expected, derivedKey);
}

function validateNewPassword(password, professor) {
  const clean = normalizePassword(password);
  if (clean.length < 8) return 'La nueva contrasena debe tener al menos 8 caracteres.';
  if (professor && clean === String(professor.employee_number)) {
    return 'La nueva contrasena no puede ser igual al numero de empleado.';
  }

  return null;
}

module.exports = {
  hashPassword,
  validateNewPassword,
  verifyPassword
};
