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
$patient_no  = trim($data['patient_no']   ?? '');
$full_name   = trim($data['full_name']    ?? '');
$age         = (int)($data['age']         ?? 0);
$ward        = trim($data['ward']         ?? '');
$admit_date  = trim($data['admit_date']   ?? date('Y-m-d'));
$patient_type = trim($data['patient_type'] ?? 'in-patient');

if (!$patient_no || !$full_name || !$age || !$ward) {
    echo json_encode(["success" => false, "message" => "All fields are required."]);
    exit();
}

$stmt = $conn->prepare("INSERT INTO patients (patient_no, full_name, age, ward, admit_date, patient_type) VALUES (?, ?, ?, ?, ?, ?)");
$stmt->bind_param("sissss", $patient_no, $full_name, $age, $ward, $admit_date, $patient_type);

if ($stmt->execute()) {
    echo json_encode(["success" => true, "message" => "Patient admitted successfully.", "id" => $conn->insert_id]);
} else {
    echo json_encode(["success" => false, "message" => "Patient number already exists."]);
}
?>
