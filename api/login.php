<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include 'db_config.php';

$data = json_decode(file_get_contents("php://input"), true);
$cost_center = isset($data['cost_center']) ? trim($data['cost_center']) : '';
$password    = isset($data['password'])    ? trim($data['password'])    : '';

if (empty($cost_center) || empty($password)) {
    echo json_encode(["success" => false, "message" => "Cost center and password are required."]);
    exit();
}

$stmt = $conn->prepare("SELECT id, cost_center, password_hash FROM cost_center_accounts WHERE cost_center = ?");
$stmt->bind_param("s", $cost_center);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(["success" => false, "message" => "Invalid cost center or password."]);
    exit();
}

$row = $result->fetch_assoc();

if (!password_verify($password, $row['password_hash'])) {
    echo json_encode(["success" => false, "message" => "Invalid cost center or password."]);
    exit();
}

echo json_encode([
    "success"     => true,
    "cost_center" => $row['cost_center'],
]);

$stmt->close();
$conn->close();
?>
