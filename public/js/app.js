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

  function blockHasFiles(block) {
    const fileInput = block.querySelector('input[type="file"]');
    return Boolean(fileInput && fileInput.files && fileInput.files.length);
  }

  function blockHasUnits(block) {
    return block.querySelectorAll('.unit-picker input:checked').length > 0;
  }

  function updateUnitState(block) {
    const needsUnits = blockHasFiles(block) && !blockHasUnits(block);
    block.classList.toggle('needs-units', needsUnits);
    return !needsUnits;
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
    updateUnitState(block);
  }

  function filesFromDrop(event) {
    return event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length
      ? event.dataTransfer.files
      : null;
  }

  function setupDropZone(block) {
    const dropZone = block.querySelector('.file-drop');
    const fileInput = block.querySelector('input[type="file"]');
    if (!dropZone || !fileInput) return;

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.add('is-dragging');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('is-dragging');
      });
    });

    dropZone.addEventListener('drop', (event) => {
      event.preventDefault();
      const files = filesFromDrop(event);
      if (!files) return;
      fileInput.files = files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function setupEvidenceValidation() {
    const form = document.querySelector('.report-form');
    if (!form) return;

    form.addEventListener('submit', (event) => {
      const invalidBlock = Array.from(form.querySelectorAll('[data-upload-block]')).find((block) => {
        return !updateUnitState(block);
      });

      if (!invalidBlock) return;

      event.preventDefault();
      const firstUnit = invalidBlock.querySelector('.unit-picker input');
      if (firstUnit) firstUnit.focus();
      invalidBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  document.querySelectorAll('.calc-input').forEach((input) => {
    input.addEventListener('input', updateMetrics);
  });
  updateMetrics();

  document.querySelectorAll('[data-upload-block]').forEach((block) => {
    block.addEventListener('change', () => updatePreview(block));
    setupDropZone(block);
  });

  setupEvidenceValidation();
})();
