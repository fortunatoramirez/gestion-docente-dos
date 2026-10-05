function stripAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeCatalogName(value) {
  return String(value || '').normalize('NFC').toUpperCase()
    .replace(/Ñ/g, '\uE000')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\uE000/g, 'Ñ')
    .replace(/[^\wÑ\s./-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

module.exports = {
  normalizeCatalogName,
  stripAccents
};
