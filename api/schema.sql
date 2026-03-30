-- Patients table
CREATE TABLE IF NOT EXISTS patients (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    patient_no      VARCHAR(20) NOT NULL UNIQUE,
    full_name       VARCHAR(150) NOT NULL,
    age             INT,
    ward            VARCHAR(100),
    admit_date      DATE,
    patient_type    ENUM('in-patient','er') NOT NULL DEFAULT 'in-patient',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clearance requests — one per patient discharge attempt
CREATE TABLE IF NOT EXISTS clearance_requests (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    patient_id              INT NOT NULL,

    -- Step 1: Nurse
    nurse_status            ENUM('pending','may_go_home') DEFAULT 'pending',
    nurse_cleared_at        DATETIME NULL,
    nurse_cleared_by        VARCHAR(100) NULL,

    -- Step 2: Billing (initial)
    billing_status          ENUM('pending','for_clearance') DEFAULT 'pending',
    billing_sent_at         DATETIME NULL,
    billing_sent_by         VARCHAR(100) NULL,

    -- Step 3: Cost centers (tracked in separate table)

    -- Step 4: Billing (final)
    final_status            ENUM('pending','discharged') DEFAULT 'pending',
    final_remarks           TEXT NULL,
    discharged_at           DATETIME NULL,
    discharged_by           VARCHAR(100) NULL,

    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Individual cost center clearances
CREATE TABLE IF NOT EXISTS cost_center_clearances (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    clearance_request_id INT NOT NULL,
    cost_center         VARCHAR(100) NOT NULL,
    status              ENUM('pending','cleared') DEFAULT 'pending',
    remarks             TEXT NULL,
    cleared_at          DATETIME NULL,
    cleared_by          VARCHAR(100) NULL,

    UNIQUE KEY unique_cc_per_request (clearance_request_id, cost_center),
    FOREIGN KEY (clearance_request_id) REFERENCES clearance_requests(id)
);

-- Sample patients
INSERT IGNORE INTO patients (patient_no, full_name, age, ward, admit_date) VALUES
('P-0001', 'Juan Dela Cruz',   45, 'Ward 3', '2026-03-20'),
('P-0002', 'Maria Santos',     32, 'Ward 1', '2026-03-22'),
('P-0003', 'Roberto Reyes',    60, 'Ward 5', '2026-03-18'),
('P-0004', 'Ana Gonzales',     28, 'Ward 2', '2026-03-25'),
('P-0005', 'Carlos Mendoza',   53, 'Ward 4', '2026-03-21'),
('P-0006', 'Liza Fernandez',   37, 'Ward 3', '2026-03-26');
