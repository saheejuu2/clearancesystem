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

$data     = json_decode(file_get_contents("php://input"), true);
$username = isset($data['username']) ? trim($data['username']) : '';
$password = isset($data['password']) ? trim($data['password'])  : '';

if (empty($username) || empty($password)) {
    echo json_encode(["success" => false, "message" => "Username and password are required."]);
    exit();
}

$stmt = $conn->prepare("SELECT id, username, full_name, cost_center, role, password_hash FROM users WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(["success" => false, "message" => "Invalid username or password."]);
    exit();
}

$row = $result->fetch_assoc();

if (!password_verify($password, $row['password_hash'])) {
    echo json_encode(["success" => false, "message" => "Invalid username or password."]);
    exit();
}

echo json_encode([
    "success"     => true,
    "cost_center" => $row['cost_center'],
    "username"    => $row['username'],
    "full_name"   => $row['full_name'],
    "role"        => $row['role'],
]);

$stmt->close();
$conn->close();
?>
