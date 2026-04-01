<?php
// Run ONCE to clean up old/unnecessary patients. DELETE this file after running.
include 'db_config.php';

// Keep only the 10 new patients (P-0007 to P-0016)
// Delete all others that have no clearance records (safe to remove)

// First show what will be deleted
$result = $conn->query("
    SELECT p.id, p.patient_no, p.full_name
    FROM patients p
    LEFT JOIN clearance_requests cr ON cr.patient_id = p.id
    WHERE p.patient_no NOT IN ('P-0007','P-0008','P-0009','P-0010','P-0011','P-0012','P-0013','P-0014','P-0015','P-0016')
    AND cr.id IS NULL
");

echo "<b>Patients to be deleted (no clearance records):</b><br>";
$ids = [];
while ($row = $result->fetch_assoc()) {
    echo "- {$row['patient_no']} {$row['full_name']}<br>";
    $ids[] = $row['id'];
}

if (empty($ids)) {
    echo "<br>Nothing to delete.";
} else {
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $types = str_repeat('i', count($ids));

    // Delete audit logs for these patients
    $stmt = $conn->prepare("DELETE FROM audit_logs WHERE patient_id IN ($placeholders)");
    $stmt->bind_param($types, ...$ids);
    $stmt->execute();
    echo "<br>Deleted {$stmt->affected_rows} audit log(s).<br>";

    // Delete the patients
    $stmt2 = $conn->prepare("DELETE FROM patients WHERE id IN ($placeholders)");
    $stmt2->bind_param($types, ...$ids);
    $stmt2->execute();
    echo "Deleted {$stmt2->affected_rows} patient(s).<br>";
}

echo "<br><b>Done. Delete this file now.</b>";
?>
