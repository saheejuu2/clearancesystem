<?php
error_reporting(0);
ini_set('display_errors', 0);
include 'cors_headers.php';
include 'db_config.php';

$data        = json_decode(file_get_contents("php://input"), true);
$username    = isset($data['username'])    ? trim($data['username'])    : '';
$password    = isset($data['password'])    ? trim($data['password'])    : '';
$cost_center = isset($data['cost_center']) ? trim($data['cost_center']) : '';

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

// Admins don't need to select a department
if ($row['role'] !== 'admin') {
    if (empty($cost_center)) {
        echo json_encode(["success" => false, "message" => "Please select your department."]);
        exit();
    }
    if ($row['cost_center'] !== $cost_center) {
        echo json_encode(["success" => false, "message" => "Selected department does not match this account."]);
        exit();
    }
}

echo json_encode([
    "success"     => true,
    "id"          => $row['id'],
    "cost_center" => $row['cost_center'],
    "username"    => $row['username'],
    "full_name"   => $row['full_name'],
    "role"        => $row['role'],
]);

$stmt->close();
$conn->close();
?>

