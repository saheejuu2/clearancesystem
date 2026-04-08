<?php
error_reporting(0);
ini_set('display_errors', 0);
include 'db_config.php';

$sql = "CREATE TABLE IF NOT EXISTS notifications (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    recipient    VARCHAR(100) NOT NULL,
    patient_id   INT NOT NULL,
    patient_no   VARCHAR(20) NOT NULL,
    patient_name VARCHAR(150) NOT NULL,
    message      TEXT NOT NULL,
    is_read      TINYINT(1) DEFAULT 0,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
)";

if ($conn->query($sql)) {
    echo "OK: notifications table created or already exists.<br>";
} else {
    echo "ERROR: " . $conn->error . "<br>";
}
echo "Done. Delete this file now.";
?>
