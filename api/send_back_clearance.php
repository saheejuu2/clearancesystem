<?php
error_reporting(0);
ini_set('display_errors', 0);
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

include 'db_config.php';

$data        = json_decode(file_get_contents("php://input"), true);
$patient_id  = (int)($data['patient_id'] ?? 0);
$actor       = $data['actor']  ?? '';
$reason      = $data['reason'] ?? 'Missing requirements';

// Accept either a single cost_center string or an array of cost_centers
$raw = $data['cost_centers'] ?? ($data['cost_center'] ?? null);
if (is_string($raw)) $raw = [$raw];
$cost_centers = is_array($raw) ? array_filter($raw) : [];

if (!$patient_id || !$actor || empty($cost_centers)) {
    echo json_encode(["success" => false, "message" => "Missing required fields."]);
    exit();
}

$now = date('Y-m-d H:i:s');

// Get latest clearance request
$stmt = $conn->prepare("SELECT * FROM clearance_requests WHERE patient_id = ? ORDER BY id DESC LIMIT 1");
$stmt->bind_param("i", $patient_id);
$stmt->execute();
$req = $stmt->get_result()->fetch_assoc();

if (!$req) {
    echo json_encode(["success" => false, "message" => "No clearance request found."]);
    exit();
}

// Get patient info
$stmt2 = $conn->prepare("SELECT patient_no, full_name FROM patients WHERE id = ?");
$stmt2->bind_param("i", $patient_id);
$stmt2->execute();
$patient = $stmt2->get_result()->fetch_assoc();

foreach ($cost_centers as $cost_center) {
    // Reset the cost center clearance back to pending
    $stmt3 = $conn->prepare("
        UPDATE cost_center_clearances
        SET status = 'pending', cleared_at = NULL, cleared_by = NULL, remarks = ?
        WHERE clearance_request_id = ? AND cost_center = ?
    ");
    $stmt3->bind_param("sis", $reason, $req['id'], $cost_center);
    $stmt3->execute();

    if ($stmt3->affected_rows === 0) {
        // Not in list yet — insert it
        $stmt4 = $conn->prepare("INSERT INTO cost_center_clearances (clearance_request_id, cost_center, status, remarks) VALUES (?, ?, 'pending', ?)");
        $stmt4->bind_param("iss", $req['id'], $cost_center, $reason);
        $stmt4->execute();
    }

    // Log audit
    $stmt5 = $conn->prepare("INSERT INTO audit_logs (patient_id, patient_no, patient_name, action, performed_by, remarks) VALUES (?, ?, ?, ?, ?, ?)");
    if ($stmt5) {
        $action_label = "Billing - Sent Back to $cost_center";
        $stmt5->bind_param("isssss", $patient_id, $patient['patient_no'], $patient['full_name'], $action_label, $actor, $reason);
        $stmt5->execute();
    }

    // Notify the cost center
    $stmt6 = $conn->prepare("INSERT INTO notifications (recipient, patient_id, patient_no, patient_name, message) VALUES (?, ?, ?, ?, ?)");
    if ($stmt6) {
        $msg = "Patient " . $patient['full_name'] . " (" . $patient['patient_no'] . ") has been sent back to your department. Reason: $reason";
        $stmt6->bind_param("sisss", $cost_center, $patient_id, $patient['patient_no'], $patient['full_name'], $msg);
        $stmt6->execute();
    }
}

$cc_list = implode(', ', $cost_centers);
echo json_encode(["success" => true, "message" => "Patient sent back to: $cc_list."]);
?>
