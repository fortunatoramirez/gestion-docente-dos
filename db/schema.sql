CREATE DATABASE IF NOT EXISTS gestion_docente_dos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gestion_docente_dos;

CREATE TABLE IF NOT EXISTS professors (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_number VARCHAR(30) NOT NULL,
  full_name VARCHAR(180) NOT NULL,
  email VARCHAR(180) NULL,
  department VARCHAR(160) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  password_hash VARCHAR(255) NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  password_changed_at DATETIME NULL,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_employee_number (employee_number)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subjects (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(220) NOT NULL,
  subject_code VARCHAR(40) NULL,
  credits TINYINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_subject_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS teaching_assignments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  professor_id INT UNSIGNED NOT NULL,
  subject_id INT UNSIGNED NOT NULL,
  group_code VARCHAR(40) NOT NULL,
  career VARCHAR(160) NULL,
  semester VARCHAR(80) NOT NULL,
  credits TINYINT UNSIGNED NULL,
  source_name VARCHAR(220) NULL,
  source_page SMALLINT UNSIGNED NULL,
  source_document VARCHAR(180) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_assignment (professor_id, subject_id, group_code, semester),
  CONSTRAINT fk_assignments_professor
    FOREIGN KEY (professor_id) REFERENCES professors(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_assignments_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reports (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  assignment_id INT UNSIGNED NOT NULL,
  period TINYINT UNSIGNED NOT NULL,
  enrolled_students INT UNSIGNED NOT NULL DEFAULT 0,
  approved_students INT UNSIGNED NOT NULL DEFAULT 0,
  absent_students INT UNSIGNED NOT NULL DEFAULT 0,
  approved_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  absent_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  reproval_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  observations TEXT NULL,
  additional_activities TEXT NULL,
  progress_delayed TINYINT(1) NOT NULL DEFAULT 0,
  progress_notes TEXT NULL,
  status ENUM('draft', 'submitted') NOT NULL DEFAULT 'draft',
  submitted_at DATETIME NULL,
  drive_file_id VARCHAR(180) NULL,
  drive_folder_id VARCHAR(180) NULL,
  drive_web_url VARCHAR(1024) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_assignment_period (assignment_id, period),
  CONSTRAINT fk_reports_assignment
    FOREIGN KEY (assignment_id) REFERENCES teaching_assignments(id)
    ON DELETE CASCADE,
  CONSTRAINT chk_report_period CHECK (period BETWEEN 1 AND 3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS evidence_files (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id INT UNSIGNED NOT NULL,
  category VARCHAR(40) NOT NULL,
  units VARCHAR(40) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NULL,
  size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  path VARCHAR(1024) NOT NULL,
  storage_provider VARCHAR(40) NOT NULL DEFAULT 'local',
  storage_key VARCHAR(1024) NULL,
  web_url VARCHAR(1024) NULL,
  storage_folder_id VARCHAR(180) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY index_evidence_report (report_id),
  CONSTRAINT fk_evidence_report
    FOREIGN KEY (report_id) REFERENCES reports(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS academic_semesters (
  code VARCHAR(80) NOT NULL PRIMARY KEY,
  label VARCHAR(180) NOT NULL,
  is_current TINYINT(1) NOT NULL DEFAULT 0,
  drive_folder_id VARCHAR(180) NULL,
  legacy_layout TINYINT(1) NOT NULL DEFAULT 0,
  current_key TINYINT GENERATED ALWAYS AS (CASE WHEN is_current = 1 THEN 1 ELSE NULL END) STORED,
  UNIQUE KEY unique_current_semester (current_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS drive_folders (
  semester VARCHAR(80) NOT NULL,
  professor_id INT UNSIGNED NOT NULL,
  relative_path VARCHAR(512) NOT NULL,
  folder_id VARCHAR(180) NOT NULL,
  PRIMARY KEY (semester, professor_id, relative_path),
  CONSTRAINT fk_drive_folder_semester FOREIGN KEY (semester) REFERENCES academic_semesters(code),
  CONSTRAINT fk_drive_folder_professor FOREIGN KEY (professor_id) REFERENCES professors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
