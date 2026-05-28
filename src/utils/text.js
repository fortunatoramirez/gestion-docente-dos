function stripAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeCatalogName(value) {
  return stripAccents(value)
    .replace(/[^\w\s./-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

module.exports = {
  normalizeCatalogName,
  stripAccents
};
