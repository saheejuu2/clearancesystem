<?php
// Run ONCE. DELETE this file after running.
include 'db_config.php';

// Delete all related records first (foreign key order)
$conn->query("DELETE FROM notifications");
$conn->query("DELETE FROM audit_logs");
$conn->query("DELETE FROM cost_center_clearances");
$conn->query("DELETE FROM clearance_requests");
$conn->query("DELETE FROM patients");

// Reset auto increment
$conn->query("ALTER TABLE patients AUTO_INCREMENT = 1");

echo "All patient records deleted.<br><br>";

// Insert 10 fresh patients
$patients = [
    ['P-0001', 'Juan Dela Cruz',      45, 'Ward 3', '2026-04-06', 'in-patient'],
    ['P-0002', 'Maria Santos',        32, 'Ward 1', '2026-04-06', 'in-patient'],
    ['P-0003', 'Roberto Reyes',       60, 'Ward 5', '2026-04-06', 'in-patient'],
    ['P-0004', 'Ana Gonzales',        28, 'Ward 2', '2026-04-06', 'in-patient'],
    ['P-0005', 'Carlos Mendoza',      53, 'Ward 4', '2026-04-06', 'in-patient'],
    ['P-0006', 'Liza Fernandez',      37, 'Ward 3', '2026-04-06', 'in-patient'],
    ['P-0007', 'Jose Ramos',          41, 'Ward 1', '2026-04-06', 'in-patient'],
    ['P-0008', 'Elena Villanueva',    29, 'Ward 2', '2026-04-06', 'er'],
    ['P-0009', 'Ricardo Bautista',    55, 'Ward 4', '2026-04-06', 'in-patient'],
    ['P-0010', 'Sofia Aquino',        34, 'Ward 3', '2026-04-06', 'er'],
];

$stmt = $conn->prepare("INSERT INTO patients (patient_no, full_name, age, ward, admit_date, patient_type) VALUES (?, ?, ?, ?, ?, ?)");

foreach ($patients as [$no, $name, $age, $ward, $date, $type]) {
    $stmt->bind_param("ssisss", $no, $name, $age, $ward, $date, $type);
    $stmt->execute();
    echo "Added: $no — $name<br>";
}

$stmt->close();
$conn->close();
echo "<br><b>Done. Delete this file now.</b>";
?>
