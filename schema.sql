-- Graphic Era Lost & Found : MySQL schema
-- Run:  mysql -u root -p < database/schema.sql

CREATE DATABASE IF NOT EXISTS geu_lost_found
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE geu_lost_found;

-- Student records
CREATE TABLE IF NOT EXISTS students (
  student_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name      VARCHAR(100) NOT NULL,
  roll_no        VARCHAR(30)  NOT NULL UNIQUE,   -- university roll number
  email          VARCHAR(120) NOT NULL UNIQUE,
  phone          VARCHAR(15)  NOT NULL,
  course         VARCHAR(60)  NOT NULL,          -- e.g. B.Tech CSE
  year_of_study  TINYINT UNSIGNED NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,          -- bcrypt hash, never plain text
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_year CHECK (year_of_study BETWEEN 1 AND 5)
) ENGINE=InnoDB;

-- Lost and found reports (each belongs to one student)
CREATE TABLE IF NOT EXISTS items (
  item_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id   INT UNSIGNED NOT NULL,
  type         ENUM('lost','found') NOT NULL,
  name         VARCHAR(100) NOT NULL,
  description  TEXT NOT NULL,
  location     VARCHAR(150) NOT NULL,            -- place on campus
  item_date    DATE NOT NULL,                    -- date lost / found
  status       ENUM('open','resolved') NOT NULL DEFAULT 'open',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_items_student FOREIGN KEY (student_id)
    REFERENCES students(student_id) ON DELETE CASCADE,
  INDEX idx_type_status (type, status),
  INDEX idx_student (student_id)
) ENGINE=InnoDB;

-- Handy view: open items together with the reporter's details
CREATE OR REPLACE VIEW v_open_items AS
SELECT i.item_id, i.type, i.name, i.description, i.location, i.item_date,
       s.full_name AS reporter, s.roll_no, s.email, s.phone
FROM items i
JOIN students s ON s.student_id = i.student_id
WHERE i.status = 'open';
