<?php
error_reporting(0);
ini_set('display_errors', 0);
include 'cors_headers.php';
include 'db_config.php';

$result = $conn->query(
    "SELECT DISTINCT cost_center FROM users 
     WHERE cost_center IS NOT NULL AND cost_center != '' AND role != 'admin'
     AND cost_center NOT LIKE '%Window%'
     ORDER BY cost_center"
);

$centers = [];
while ($row = $result->fetch_assoc()) {
    $centers[] = $row['cost_center'];
}

// Fallback: if DB returns nothing, use the known list
if (empty($centers)) {
    $centers = [
        'Billing',
        'Bloodbank',
        'Colonoscopy',
        'Endoscopy',
        'Hemodialysis Unit',
        'Laboratory',
        'Newborn Hearing Test',
        'Newborn Screening',
        'Nurse',
        'Operating Room/Delivery Room',
        'Pharmacy',
        'Physical Therapy',
        'Pulmonary Department (MSA)',
        'Radiology',
    ];
}

echo json_encode($centers);
$conn->close();
?>
