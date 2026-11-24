CREATE TABLE IF NOT EXISTS department_evaluations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  professor_id INT UNSIGNED NOT NULL,
  semester VARCHAR(80) NOT NULL,
  tutoria TINYINT UNSIGNED NULL,
  investigacion TINYINT UNSIGNED NULL,
  vinculacion TINYINT UNSIGNED NULL,
  UNIQUE KEY one_department_evaluation (semester, professor_id),
  FOREIGN KEY (professor_id) REFERENCES professors(id),
  FOREIGN KEY (semester) REFERENCES academic_semesters(code),
  CHECK (tutoria IN (0, 1) AND investigacion IN (0, 1) AND vinculacion IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS department_reviews (
  evaluation_id INT UNSIGNED NOT NULL,
  criterion TINYINT UNSIGNED NOT NULL,
  score TINYINT UNSIGNED NULL,
  note VARCHAR(1500) NOT NULL DEFAULT '',
  reviewer_id INT UNSIGNED NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (evaluation_id, criterion),
  FOREIGN KEY (evaluation_id) REFERENCES department_evaluations(id),
  FOREIGN KEY (reviewer_id) REFERENCES professors(id),
  CHECK (criterion BETWEEN 1 AND 15),
  CHECK (score BETWEEN 0 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS department_evidence (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  evaluation_id INT UNSIGNED NOT NULL,
  criterion TINYINT UNSIGNED NOT NULL,
  source ENUM('docente', 'docencia', 'tutorias', 'investigacion', 'vinculacion') NOT NULL,
  contributor_id INT UNSIGNED NOT NULL,
  upload_token CHAR(36) NOT NULL,
  title VARCHAR(180) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  path VARCHAR(1024) NOT NULL,
  storage_provider VARCHAR(40) NOT NULL,
  storage_key VARCHAR(1024) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY one_department_upload (evaluation_id, contributor_id, upload_token),
  KEY department_criterion (evaluation_id, criterion),
  FOREIGN KEY (evaluation_id) REFERENCES department_evaluations(id),
  FOREIGN KEY (contributor_id) REFERENCES professors(id),
  CHECK (criterion BETWEEN 1 AND 15)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
