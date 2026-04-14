<?php
error_reporting(0);
ini_set('display_errors', 0);

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://hesed-pc';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

include 'db_config.php';

$data = json_decode(file_get_contents("php://input"), true);
$ids  = array_filter(array_map('intval', $data['ids'] ?? []));

if (empty($ids)) {
    echo json_encode(["success" => false, "message" => "No patient IDs provided."]);
    exit();
}

$placeholders = implode(',', array_fill(0, count($ids), '?'));
$types = str_repeat('i', count($ids));

// Delete related records first (FK constraints)
foreach (['cost_center_clearances', 'clearance_requests', 'audit_logs', 'notifications'] as $table) {
    if ($table === 'cost_center_clearances') {
        // Need to go through clearance_requests
        $stmt = $conn->prepare("DELETE ccc FROM cost_center_clearances ccc JOIN clearance_requests cr ON ccc.clearance_request_id = cr.id WHERE cr.patient_id IN ($placeholders)");
    } elseif ($table === 'clearance_requests') {
        $stmt = $conn->prepare("DELETE FROM clearance_requests WHERE patient_id IN ($placeholders)");
    } elseif ($table === 'audit_logs') {
        $stmt = $conn->prepare("DELETE FROM audit_logs WHERE patient_id IN ($placeholders)");
    } else {
        $stmt = $conn->prepare("DELETE FROM notifications WHERE patient_id IN ($placeholders)");
    }
    if ($stmt) {
        $stmt->bind_param($types, ...$ids);
        $stmt->execute();
    }
}

// Delete patients
$stmt = $conn->prepare("DELETE FROM patients WHERE id IN ($placeholders)");
$stmt->bind_param($types, ...$ids);
$stmt->execute();
$deleted = $stmt->affected_rows;

echo json_encode(["success" => true, "deleted" => $deleted]);
$conn->close();
?>
