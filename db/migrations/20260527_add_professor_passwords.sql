ALTER TABLE professors
  ADD COLUMN password_hash VARCHAR(255) NULL AFTER active,
  ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 1 AFTER password_hash,
  ADD COLUMN password_changed_at DATETIME NULL AFTER must_change_password,
  ADD COLUMN last_login_at DATETIME NULL AFTER password_changed_at;
