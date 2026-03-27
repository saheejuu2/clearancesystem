<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
include 'db_config.php';

$patient_id = isset($_GET['patient_id']) ? (int)$_GET['patient_id'] : 0;
if (!$patient_id) {
    echo json_encode(["success" => false, "message" => "Patient ID required."]);
    exit();
}

// Get patient
$stmt = $conn->prepare("SELECT * FROM patients WHERE id = ?");
$stmt->bind_param("i", $patient_id);
$stmt->execute();
$patient = $stmt->get_result()->fetch_assoc();

if (!$patient) {
    echo json_encode(["success" => false, "message" => "Patient not found."]);
    exit();
}

// Get clearance request
$stmt2 = $conn->prepare("SELECT * FROM clearance_requests WHERE patient_id = ? ORDER BY id DESC LIMIT 1");
$stmt2->bind_param("i", $patient_id);
$stmt2->execute();
$request = $stmt2->get_result()->fetch_assoc();

// Get cost center clearances
$clearances = [];
if ($request) {
    $stmt3 = $conn->prepare("SELECT * FROM cost_center_clearances WHERE clearance_request_id = ? ORDER BY cost_center ASC");
    $stmt3->bind_param("i", $request['id']);
    $stmt3->execute();
    $result = $stmt3->get_result();
    while ($row = $result->fetch_assoc()) {
        $clearances[] = $row;
    }
}

echo json_encode([
    "success"    => true,
    "patient"    => $patient,
    "request"    => $request,
    "clearances" => $clearances,
]);
?>
