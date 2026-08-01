(function () {
  const MB_IN_BYTES = 1024 * 1024;

  function numberFromInput(selector) {
    const value = Number(document.querySelector(selector)?.value || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  function reportFormConfig(form) {
    return {
      maxFiles: Number(form.dataset.maxFilesPerUpload || 5),
      maxUploadMb: Number(form.dataset.maxUploadMb || 100),
      reprovalThreshold: Number(form.dataset.reprovalThreshold || 33),
      defaultObservations: form.dataset.defaultObservations || ''
    };
  }

  function isDefaultObservation(value) {
    return normalizeText(value) === 'no aplica';
  }

  function validateObservations(reprovalPercentage, showMessage) {
    const form = document.querySelector('.report-form');
    const textarea = form?.querySelector('[name="observations"]');
    if (!form || !textarea) return true;

    const { reprovalThreshold } = reportFormConfig(form);
    const required = reprovalPercentage > reprovalThreshold;
    const invalid = required && (!textarea.value.trim() || isDefaultObservation(textarea.value));
    textarea.setCustomValidity(
      invalid
        ? `Cuando la reprobación excede el ${reprovalThreshold}%, escribe las estrategias destinadas a solventar esta condición.`
        : ''
    );

    if (invalid && showMessage) {
      textarea.reportValidity();
      textarea.focus();
    }

    return !invalid;
  }

  function updateObservationRequirement(reprovalPercentage) {
    const form = document.querySelector('.report-form');
    const textarea = form?.querySelector('[name="observations"]');
    const hint = form?.querySelector('[data-observations-hint]');
    if (!form || !textarea) return true;

    const { reprovalThreshold } = reportFormConfig(form);
    const required = reprovalPercentage > reprovalThreshold;
    textarea.required = required;

    if (hint) {
      hint.textContent = required
        ? `El índice de reprobación excede el ${reprovalThreshold}%; describe las estrategias destinadas a solventar dicha condición.`
        : `Si el índice de reprobación excede el ${reprovalThreshold}%, describe las estrategias destinadas a solventar dicha condición.`;
    }

    return validateObservations(reprovalPercentage, false);
  }

  function currentMetrics() {
    const enrolled = numberFromInput('[name="enrolled_students"]');
    const approved = numberFromInput('[name="approved_students"]');
    const absent = numberFromInput('[name="absent_students"]');
    const failed = enrolled - approved - absent;

    return {
      enrolled,
      approved,
      absent,
      failed,
      approvedPercentage: enrolled ? (approved / enrolled) * 100 : 0,
      absentPercentage: enrolled ? (absent / enrolled) * 100 : 0,
      failedPercentage: enrolled ? (Math.max(failed, 0) / enrolled) * 100 : 0
    };
  }

  function countInputs() {
    return {
      enrolled: document.querySelector('[name="enrolled_students"]'),
      approved: document.querySelector('[name="approved_students"]'),
      absent: document.querySelector('[name="absent_students"]')
    };
  }

  function validateStudentCounts(metrics, showMessage) {
    const form = document.querySelector('.report-form');
    const hint = form?.querySelector('[data-counts-hint]');
    const inputs = countInputs();
    let target = null;
    let message = '';

    Object.values(inputs).forEach((input) => {
      if (input) input.setCustomValidity('');
    });

    if (metrics.approved > metrics.enrolled) {
      target = inputs.approved;
      message = 'Los alumnos aprobados no pueden ser mayores que los alumnos inscritos.';
    } else if (metrics.approved + metrics.absent > metrics.enrolled) {
      target = inputs.absent;
      message = 'La suma de alumnos aprobados y ausentes no puede ser mayor que los alumnos inscritos.';
    }

    if (target) target.setCustomValidity(message);
    if (hint) {
      hint.textContent = message || 'Aprobados + ausentes + reprobados debe coincidir con los alumnos inscritos.';
    }
    if (form) form.classList.toggle('has-count-error', Boolean(message));

    if (message && showMessage && target) {
      target.reportValidity();
      target.focus();
    }

    return !message;
  }

  function updateMetrics() {
    const metrics = currentMetrics();
    const display = {
      approved: metrics.approvedPercentage,
      absent: metrics.absentPercentage,
      failed: metrics.failedPercentage
    };

    Object.entries(display).forEach(([key, value]) => {
      const target = document.querySelector(`[data-metric="${key}"]`);
      if (target) target.textContent = `${value.toFixed(1)}%`;
    });

    validateStudentCounts(metrics, false);
    updateObservationRequirement(metrics.failedPercentage);
    return metrics;
  }

  function cleanSegment(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 _.-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function uploadEntries(block) {
    return Array.from(block.querySelectorAll('[data-upload-entry]'));
  }

  function uploadFiles(block) {
    return uploadEntries(block).flatMap((entry) => {
      const fileInput = entry.querySelector('input[type="file"]');
      return fileInput && fileInput.files && fileInput.files.length
        ? Array.from(fileInput.files).map((file) => ({ entry, file, fileInput }))
        : [];
    });
  }

  function selectedUnits(entry) {
    const values = Array.from(entry.querySelectorAll('.unit-picker input:checked')).map((input) => input.value);
    return values.length ? values.join('-') : 'SIN-UNIDAD';
  }

  function entryHasFile(entry) {
    const fileInput = entry.querySelector('input[type="file"]');
    return Boolean(fileInput && fileInput.files && fileInput.files.length);
  }

  function entryHasUnits(entry) {
    return entry.querySelectorAll('.unit-picker input:checked').length > 0;
  }

  function setUploadMessage(block, message) {
    const output = block.querySelector('[data-upload-message]');
    if (output) output.textContent = message || '';
  }

  function setFileValidity(block, message) {
    uploadEntries(block).forEach((entry) => {
      const fileInput = entry.querySelector('input[type="file"]');
      if (fileInput) fileInput.setCustomValidity('');
    });

    if (!message) return;
    const firstInput = block.querySelector('input[type="file"]');
    if (firstInput) firstInput.setCustomValidity(message);
  }

  function validateUploadLimits(block) {
    const form = block.closest('form');
    if (!form) return true;

    const { maxFiles, maxUploadMb } = reportFormConfig(form);
    const files = uploadFiles(block);
    const maxBytes = maxUploadMb * MB_IN_BYTES;
    let message = '';

    if (files.length > maxFiles) {
      message = `Cada caja permite hasta ${maxFiles} archivos.`;
    } else if (files.some(({ file }) => file.size > maxBytes)) {
      message = `Cada archivo puede pesar hasta ${maxUploadMb} MB.`;
    }

    setFileValidity(block, message);
    setUploadMessage(block, message);
    return !message;
  }

  function validateUploadUnits(block, showMessage) {
    const invalidEntry = uploadEntries(block).find((entry) => entryHasFile(entry) && !entryHasUnits(entry));
    uploadEntries(block).forEach((entry) => {
      entry.classList.toggle('needs-units', entry === invalidEntry);
    });
    block.classList.toggle('needs-units', Boolean(invalidEntry));

    if (!invalidEntry) return true;

    const message = 'Selecciona al menos una unidad para cada archivo.';
    setUploadMessage(block, message);
    const fileInput = invalidEntry.querySelector('input[type="file"]');
    if (fileInput) fileInput.setCustomValidity(message);

    if (showMessage) {
      if (fileInput) fileInput.reportValidity();
      const firstUnit = invalidEntry.querySelector('.unit-picker input');
      if (firstUnit) firstUnit.focus();
      invalidEntry.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return false;
  }

  function updateEntryIndexes(block) {
    const categoryKey = block.dataset.categoryKey;
    const entries = uploadEntries(block);

    entries.forEach((entry, index) => {
      entry.dataset.entryIndex = String(index);
      entry.querySelectorAll('.unit-picker input').forEach((input) => {
        input.name = `units_${categoryKey}_${index}`;
      });
    });

    updateRemoveButtons(block);
  }

  function updateRemoveButtons(block) {
    const entries = uploadEntries(block);
    entries.forEach((entry) => {
      const removeButton = entry.querySelector('[data-remove-upload-entry]');
      if (removeButton) removeButton.hidden = entries.length === 1 && !entryHasFile(entry);
    });
  }

  function updatePreview(block) {
    const form = block.closest('form');
    if (!form) return;

    const subjectCode = cleanSegment(form.dataset.subjectCode);
    const groupCode = cleanSegment(form.dataset.groupCode);
    const label = cleanSegment(block.dataset.categoryLabel);
    const prefix = subjectCode ? `${subjectCode} - ${groupCode}` : groupCode;

    uploadEntries(block).forEach((entry, index) => {
      const fileInput = entry.querySelector('input[type="file"]');
      const output = entry.querySelector('.filename-preview');
      const file = fileInput && fileInput.files && fileInput.files[0];
      if (!output) return;

      if (!file) {
        output.textContent = '';
        return;
      }

      const extension = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      const suffix = index > 0 ? ` ${index + 1}` : '';
      output.textContent = `${selectedUnits(entry)} ${prefix} ${label}${suffix}${extension}`;
    });

    validateUploadLimits(block);
    validateUploadUnits(block, false);
    updateRemoveButtons(block);
    updateAddButton(block);
  }

  function setSingleFile(fileInput, file) {
    if (!file) return;

    if (typeof DataTransfer === 'undefined') return;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
  }

  function createUploadEntry(block) {
    const list = block.querySelector('[data-upload-entry-list]');
    const firstEntry = block.querySelector('[data-upload-entry]');
    if (!list || !firstEntry) return null;

    const entry = firstEntry.cloneNode(true);
    entry.classList.remove('needs-units');
    entry.querySelectorAll('.unit-picker input').forEach((input) => {
      input.checked = false;
    });
    const fileInput = entry.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.value = '';
      fileInput.setCustomValidity('');
    }
    const preview = entry.querySelector('.filename-preview');
    if (preview) preview.textContent = '';

    list.appendChild(entry);
    setupUploadEntry(block, entry);
    updateEntryIndexes(block);
    updateAddButton(block);
    return entry;
  }

  function clearUploadEntry(entry) {
    entry.classList.remove('needs-units');
    entry.querySelectorAll('.unit-picker input').forEach((input) => {
      input.checked = false;
    });
    const fileInput = entry.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.value = '';
      fileInput.setCustomValidity('');
    }
    const preview = entry.querySelector('.filename-preview');
    if (preview) preview.textContent = '';
  }

  function removeUploadEntry(block, entry) {
    if (uploadEntries(block).length <= 1) {
      clearUploadEntry(entry);
      setUploadMessage(block, '');
      updatePreview(block);
      return;
    }

    entry.remove();
    updateEntryIndexes(block);
    updatePreview(block);
  }

  function updateAddButton(block) {
    const button = block.querySelector('[data-add-upload-entry]');
    if (!button) return;

    const form = block.closest('form');
    const { maxFiles } = form ? reportFormConfig(form) : { maxFiles: 5 };
    const hasFiles = uploadFiles(block).length > 0;
    button.hidden = !hasFiles || uploadEntries(block).length >= maxFiles;
  }

  function filesFromDrop(event) {
    return event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length
      ? Array.from(event.dataTransfer.files)
      : [];
  }

  function setupDropZone(block, entry) {
    const dropZone = entry.querySelector('.file-drop');
    const fileInput = entry.querySelector('input[type="file"]');
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
      if (!files.length) return;

      setSingleFile(fileInput, files[0]);
      files.slice(1).forEach((file) => {
        const newEntry = createUploadEntry(block);
        const newInput = newEntry && newEntry.querySelector('input[type="file"]');
        if (newInput) setSingleFile(newInput, file);
      });
      updatePreview(block);
    });
  }

  function setupUploadEntry(block, entry) {
    const fileInput = entry.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.addEventListener('change', () => updatePreview(block));
    }

    entry.querySelectorAll('.unit-picker input').forEach((input) => {
      input.addEventListener('change', () => updatePreview(block));
    });

    const removeButton = entry.querySelector('[data-remove-upload-entry]');
    if (removeButton) {
      removeButton.addEventListener('click', () => removeUploadEntry(block, entry));
    }

    setupDropZone(block, entry);
  }

  function setupUploadBlock(block) {
    updateEntryIndexes(block);
    uploadEntries(block).forEach((entry) => setupUploadEntry(block, entry));

    const addButton = block.querySelector('[data-add-upload-entry]');
    if (addButton) {
      addButton.addEventListener('click', () => {
        createUploadEntry(block);
        const entries = uploadEntries(block);
        const latest = entries[entries.length - 1];
        latest?.querySelector('input[type="file"]')?.click();
      });
    }

    updatePreview(block);
  }

  function setupEvidenceValidation() {
    const form = document.querySelector('.report-form');
    if (!form) return;

    form.addEventListener('submit', (event) => {
      const metrics = updateMetrics();
      const countsOk = validateStudentCounts(metrics, true);
      if (!countsOk) {
        event.preventDefault();
        return;
      }

      const observationsOk = validateObservations(metrics.failedPercentage, true);
      if (!observationsOk) {
        event.preventDefault();
        return;
      }

      const invalidUploadBlock = Array.from(form.querySelectorAll('[data-upload-block]')).find((block) => {
        return !validateUploadLimits(block);
      });

      if (invalidUploadBlock) {
        event.preventDefault();
        const fileInput = invalidUploadBlock.querySelector('input[type="file"]');
        if (fileInput) fileInput.reportValidity();
        invalidUploadBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const invalidUnitBlock = Array.from(form.querySelectorAll('[data-upload-block]')).find((block) => {
        return !validateUploadUnits(block, true);
      });

      if (invalidUnitBlock) {
        event.preventDefault();
      }
    });

    form.addEventListener('submit', (event) => {
      if (event.defaultPrevented) return;
      preserveSubmitAction(form, event.submitter);
      showSubmitOverlay(form, event.submitter);
    });
  }

  function preserveSubmitAction(form, submitter) {
    if (!submitter || submitter.name !== 'action') return;

    let actionInput = form.querySelector('input[type="hidden"][name="action"]');
    if (!actionInput) {
      actionInput = document.createElement('input');
      actionInput.type = 'hidden';
      actionInput.name = 'action';
      form.appendChild(actionInput);
    }

    actionInput.value = submitter.value || '';
  }

  function showSubmitOverlay(form, submitter) {
    const overlay = document.querySelector('[data-submit-overlay]');
    if (!overlay) return;

    const title = overlay.querySelector('[data-submit-title]');
    const message = overlay.querySelector('[data-submit-message]');
    const isFinalSubmit = submitter && submitter.value === 'submit';

    if (title) title.textContent = isFinalSubmit ? 'Enviando reporte' : 'Guardando borrador';
    if (message) {
      message.textContent = 'Estamos guardando la información y subiendo las evidencias. Por favor, mantén esta ventana abierta.';
    }

    overlay.hidden = false;
    form.classList.add('is-submitting');
    form.querySelectorAll('button').forEach((control) => {
      control.disabled = true;
      control.setAttribute('aria-disabled', 'true');
    });
  }

  document.querySelectorAll('.calc-input').forEach((input) => {
    input.addEventListener('input', updateMetrics);
  });
  updateMetrics();

  const observations = document.querySelector('[name="observations"]');
  if (observations) {
    observations.addEventListener('input', () => {
      validateObservations(updateMetrics().failedPercentage, false);
    });
  }

  document.querySelectorAll('[data-upload-block]').forEach(setupUploadBlock);

  setupEvidenceValidation();
})();
