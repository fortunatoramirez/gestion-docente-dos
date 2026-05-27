USE gestion_docente_dos;

ALTER TABLE evidence_files
  ADD COLUMN storage_provider VARCHAR(40) NOT NULL DEFAULT 'local' AFTER path,
  ADD COLUMN storage_key VARCHAR(1024) NULL AFTER storage_provider,
  ADD COLUMN web_url VARCHAR(1024) NULL AFTER storage_key;

UPDATE evidence_files
SET storage_key = path
WHERE storage_key IS NULL;
