-- DermaScan AI Database Schema
-- MySQL Database

CREATE DATABASE IF NOT EXISTS dermascan_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dermascan_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    terms_accepted_at DATETIME NULL,
    verification_status VARCHAR(20) DEFAULT 'not_required',  -- doctors: pending | approved | rejected
    hpcsa_number VARCHAR(20) NULL UNIQUE,
    practice_number VARCHAR(20) NULL,
    verified_at DATETIME NULL,
    verified_by INT NULL,
    verification_notes VARCHAR(255) NULL,
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- Scan records table
CREATE TABLE IF NOT EXISTS scans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scan_id VARCHAR(20) UNIQUE NOT NULL,
    user_id INT NOT NULL,
    image_path VARCHAR(255) NOT NULL,
    disease_name VARCHAR(100),
    confidence_score FLOAT,
    severity VARCHAR(20),
    symptoms TEXT,
    recommendations TEXT,
    status VARCHAR(20) DEFAULT 'completed',
    model_version VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_scan_id (scan_id),
    INDEX idx_user_id (user_id),
    INDEX idx_disease (disease_name),
    INDEX idx_created_at (created_at)
);

-- Doctors table
CREATE TABLE IF NOT EXISTS doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    email VARCHAR(120) UNIQUE,
    phone VARCHAR(20),
    hospital VARCHAR(200),
    experience VARCHAR(50),
    rating FLOAT DEFAULT 0.0,
    available BOOLEAN DEFAULT TRUE,
    bio VARCHAR(600) NULL,
    user_id INT NULL UNIQUE,  -- linked login (role='doctor') = can receive referrals
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_specialty (specialty),
    INDEX idx_available (available)
);

-- Consultations table
CREATE TABLE IF NOT EXISTS consultations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    scan_id INT,
    type VARCHAR(20) DEFAULT 'video',
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    appointment_date DATETIME,
    doctor_note VARCHAR(255) NULL,
    responded_at DATETIME NULL,
    reminder_sent_at DATETIME NULL,
    reschedule_count INT DEFAULT 0,
    -- report attached to the booking (encrypted by the application; replaces the old referral)
    report_snapshot LONGTEXT NULL,
    report_include_image BOOLEAN DEFAULT FALSE,
    report_consent_at DATETIME NULL,
    report_consent_version VARCHAR(20) NULL,
    report_opened_at DATETIME NULL,
    report_withdrawn_at DATETIME NULL,
    idempotency_key VARCHAR(64) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE SET NULL,
    INDEX idx_patient_id (patient_id),
    INDEX idx_doctor_id (doctor_id),
    INDEX idx_status (status)
);


CREATE TABLE IF NOT EXISTS referrals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reference VARCHAR(20) UNIQUE NOT NULL,
    idempotency_key VARCHAR(64) UNIQUE,
    patient_id INT NOT NULL,
    scan_id INT NOT NULL,
    doctor_id INT NULL,
    doctor_name VARCHAR(100) NOT NULL,
    doctor_email VARCHAR(120),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    status_message VARCHAR(255),
    include_image BOOLEAN DEFAULT FALSE,
    snapshot LONGTEXT,
    patient_notes LONGTEXT,
    doctor_review_note LONGTEXT,
    consent_given BOOLEAN NOT NULL DEFAULT FALSE,
    consent_at DATETIME,
    consent_text_version VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    submitted_at DATETIME, received_at DATETIME, reviewed_at DATETIME, withdrawn_at DATETIME,
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
    INDEX idx_ref_patient (patient_id), INDEX idx_ref_doctor (doctor_id),
    INDEX idx_ref_scan (scan_id), INDEX idx_ref_status (status)
);

CREATE TABLE IF NOT EXISTS referral_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    referral_id INT NOT NULL,
    event VARCHAR(40) NOT NULL,
    actor_id INT,
    actor_role VARCHAR(20),
    detail VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referral_id) REFERENCES referrals(id) ON DELETE CASCADE,
    INDEX idx_event_referral (referral_id)
);

CREATE TABLE IF NOT EXISTS appointment_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    consultation_id INT NOT NULL,
    event VARCHAR(40) NOT NULL,
    actor_role VARCHAR(20),
    detail VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE CASCADE,
    INDEX idx_appt_event (consultation_id)
);

CREATE TABLE IF NOT EXISTS email_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    to_email VARCHAR(120) NOT NULL,
    template VARCHAR(40) NOT NULL,
    subject VARCHAR(200),
    related_reference VARCHAR(20),
    status VARCHAR(20) NOT NULL,   
    error VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email_to (to_email)
);


INSERT INTO doctors (name, specialty, email, phone, hospital, experience, rating, available) VALUES
('Dr. Sarah Wilson', 'Dermatologist', 'sarah.wilson@dermascan.ai', '+1-555-0101', 'City Medical Center', '15 years', 4.9, TRUE),
('Dr. Michael Chen', 'Clinical Dermatologist', 'michael.chen@dermascan.ai', '+1-555-0102', 'University Health Hospital', '12 years', 4.8, TRUE),
