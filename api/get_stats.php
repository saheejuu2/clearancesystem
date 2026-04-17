<?php
error_reporting(0);
ini_set('display_errors', 0);
include 'cors_headers.php';
include 'db_config.php';

$discharged     = (int)$conn->query("SELECT COUNT(*) as c FROM clearance_requests WHERE final_status='discharged'")->fetch_assoc()['c'];
$cleared        = (int)$conn->query("SELECT COUNT(*) as c FROM cost_center_clearances WHERE status='cleared'")->fetch_assoc()['c'];
$in_progress    = (int)$conn->query("SELECT COUNT(*) as c FROM clearance_requests WHERE final_status='pending' AND billing_status='for_clearance'")->fetch_assoc()['c'];
$total_patients = (int)$conn->query("SELECT COUNT(*) as c FROM patients")->fetch_assoc()['c'];
$awaiting_billing = (int)$conn->query("SELECT COUNT(*) as c FROM clearance_requests WHERE nurse_status='may_go_home' AND billing_status='pending'")->fetch_assoc()['c'];
$total_staff    = (int)$conn->query("SELECT COUNT(*) as c FROM users WHERE role='staff'")->fetch_assoc()['c'];
$pending_count  = (int)$conn->query("SELECT COUNT(DISTINCT cr.patient_id) as c FROM cost_center_clearances ccc JOIN clearance_requests cr ON cr.id = ccc.clearance_request_id WHERE ccc.status='pending' AND ccc.remarks IS NOT NULL AND ccc.remarks != '' AND cr.billing_status='for_clearance' AND cr.final_status != 'discharged'")->fetch_assoc()['c'];

// Recent discharges (last 5)
$recent = [];
$res = $conn->query("SELECT p.patient_no, p.full_name, p.ward, cr.discharged_at, cr.discharged_by
    FROM clearance_requests cr JOIN patients p ON p.id = cr.patient_id
    WHERE cr.final_status='discharged'
    ORDER BY cr.discharged_at DESC LIMIT 5");
while ($row = $res->fetch_assoc()) $recent[] = $row;

// Cost center clearance counts
$cc_stats = [];
$res2 = $conn->query("SELECT cost_center, COUNT(*) as total, SUM(status='cleared') as cleared
    FROM cost_center_clearances GROUP BY cost_center ORDER BY total DESC LIMIT 8");
while ($row = $res2->fetch_assoc()) $cc_stats[] = $row;

echo json_encode([
    "discharged"       => $discharged,
    "cleared"          => $cleared,
    "in_progress"      => $in_progress,
    "total_patients"   => $total_patients,
    "awaiting_billing" => $awaiting_billing,
    "total_staff"      => $total_staff,
    "pending_count"    => $pending_count,
    "recent_discharges"=> $recent,
    "cc_stats"         => $cc_stats,
]);
?>
