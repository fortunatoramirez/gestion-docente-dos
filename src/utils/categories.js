const evidenceCategories = [
  {
    key: 'exam',
    label: 'Examen',
    prompt: 'Evidencia de cada examen aplicado',
    accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png,.zip'
  },
  {
    key: 'presentation',
    label: 'Presentacion',
    prompt: 'Evidencia de presentaciones del alumnado',
    accept: '.pdf,.ppt,.pptx,.jpg,.jpeg,.png,.mp4,.mov,.zip'
  },
  {
    key: 'research',
    label: 'Investigacion',
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
    label: 'Practica',
    prompt: 'Evidencia de practicas realizadas',
    accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.mov,.zip'
  },
  {
    key: 'other',
    label: 'Otro',
    prompt: 'Otros instrumentos de evaluacion',
    accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.mov,.zip'
  }
];

module.exports = {
  evidenceCategories,
  categoryKeys: evidenceCategories.map((category) => category.key)
};
