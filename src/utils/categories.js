const evidenceCategories = [
  {
    key: 'exam',
    label: 'Examen',
    prompt: 'Evidencia de cada examen aplicado',
    accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png,.zip'
  },
  {
    key: 'presentation',
    label: 'Presentación',
    prompt: 'Evidencia de presentaciones del alumnado',
    accept: '.pdf,.ppt,.pptx,.jpg,.jpeg,.png,.mp4,.mov,.zip'
  },
  {
    key: 'research',
    label: 'Investigación',
    prompt: 'Evidencia de investigaciones realizadas',
    accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png,.zip'
  },
  {
    key: 'exercise',
    label: 'Ejercicio',
    prompt: 'Evidencia de ejercicios o talleres',
    accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png,.zip'
  },
  {
    key: 'practice',
    label: 'Práctica',
    prompt: 'Evidencia de prácticas realizadas',
    accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.mov,.zip'
  },
  {
    key: 'other',
    label: 'Otro',
    prompt: 'Otros instrumentos de evaluación',
    accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.mov,.zip'
  }
];

module.exports = {
  evidenceCategories,
  categoryKeys: evidenceCategories.map((category) => category.key)
};
