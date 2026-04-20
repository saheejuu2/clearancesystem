<?php
include 'db_config.php';

// Preview first
$r = $conn->query("
    SELECT p.patient_no, p.full_name, cr.nurse_status, cr.billing_status, cr.final_status, cr.id as crid
    FROM clearance_requests cr
    JOIN patients p ON p.id = cr.patient_id
    WHERE cr.final_status != 'discharged'
");
$rows = $r->fetch_all(MYSQLI_ASSOC);
echo "Patients to reset: " . count($rows) . "\n";
foreach ($rows as $row) {
    echo "  {$row['patient_no']} - {$row['full_name']} (nurse:{$row['nurse_status']}, billing:{$row['billing_status']})\n";
}

if (true) {
    foreach ($rows as $row) {
        $crid = $row['crid'];
        $conn->query("DELETE FROM cost_center_clearances WHERE clearance_request_id = $crid");
        $conn->query("DELETE FROM clearance_requests WHERE id = $crid");
    }
    echo "\nAll reset to Admitted.\n";
}
