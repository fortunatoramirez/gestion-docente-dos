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
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY index_evidence_report (report_id),
  CONSTRAINT fk_evidence_report
    FOREIGN KEY (report_id) REFERENCES reports(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;
