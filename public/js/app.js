(function () {
  function numberFromInput(selector) {
    const value = Number(document.querySelector(selector)?.value || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function updateMetrics() {
    const enrolled = numberFromInput('[name="enrolled_students"]');
    const approved = numberFromInput('[name="approved_students"]');
    const absent = numberFromInput('[name="absent_students"]');
    const failed = Math.max(enrolled - approved - absent, 0);
    const metrics = {
      approved: enrolled ? (approved / enrolled) * 100 : 0,
      absent: enrolled ? (absent / enrolled) * 100 : 0,
      failed: enrolled ? (failed / enrolled) * 100 : 0
    };

    Object.entries(metrics).forEach(([key, value]) => {
      const target = document.querySelector(`[data-metric="${key}"]`);
      if (target) target.textContent = `${value.toFixed(1)}%`;
    });
  }

  function cleanSegment(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 _.-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function selectedUnits(block) {
    const values = Array.from(block.querySelectorAll('.unit-picker input:checked')).map((input) => input.value);
    return values.length ? values.join('-') : 'SIN-UNIDAD';
  }

  function updatePreview(block) {
    const form = block.closest('form');
    const fileInput = block.querySelector('input[type="file"]');
    const output = block.querySelector('.filename-preview');
    if (!form || !fileInput || !output) return;

    const subjectCode = cleanSegment(form.dataset.subjectCode);
    const groupCode = cleanSegment(form.dataset.groupCode);
    const label = cleanSegment(block.dataset.categoryLabel);
    const prefix = subjectCode ? `${subjectCode} - ${groupCode}` : groupCode;
    const names = Array.from(fileInput.files || []).map((file, index) => {
      const extension = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      const suffix = index > 0 ? ` ${index + 1}` : '';
      return `${selectedUnits(block)} ${prefix} ${label}${suffix}${extension}`;
    });

    output.textContent = names.join(' · ');
  }

  document.querySelectorAll('.calc-input').forEach((input) => {
    input.addEventListener('input', updateMetrics);
  });
  updateMetrics();

  document.querySelectorAll('[data-upload-block]').forEach((block) => {
    block.addEventListener('change', () => updatePreview(block));
  });
})();
