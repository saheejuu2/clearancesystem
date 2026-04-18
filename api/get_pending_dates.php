<?php
error_reporting(0);
ini_set('display_errors', 0);
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
include 'db_config.php';

// Return dates that have patients still not discharged
// Optional: filter by month (year-month param)
$month = isset($_GET['month']) ? $conn->real_escape_string($_GET['month']) : date('Y-m');

// Return dates that have patients in active clearance (started but not discharged)
// Only shows dot if nurse has at least triggered "May Go Home"
$result = $conn->query("
    SELECT DISTINCT DATE(p.admit_date) as d
    FROM patients p
    JOIN clearance_requests cr ON cr.patient_id = p.id
    WHERE DATE_FORMAT(p.admit_date, '%Y-%m') = '$month'
      AND cr.final_status != 'discharged'
    ORDER BY d ASC
");

$dates = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $dates[] = $row['d'];
    }
}

echo json_encode($dates);
?>
