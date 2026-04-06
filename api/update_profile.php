<?php
error_reporting(0);
ini_set('display_errors', 0);
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

include 'db_config.php';

$data      = json_decode(file_get_contents("php://input"), true);
$username  = trim($data['username']  ?? '');
$full_name = trim($data['full_name'] ?? '');
$password  = trim($data['password']  ?? '');
$id        = (int)($data['id']       ?? 0);

if (!$id || !$username || !$full_name) {
    echo json_encode(["success" => false, "message" => "Username and full name are required."]);
    exit();
}

if ($password) {
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("UPDATE users SET username=?, full_name=?, password_hash=? WHERE id=? AND role='admin'");
    $stmt->bind_param("sssi", $username, $full_name, $hash, $id);
} else {
    $stmt = $conn->prepare("UPDATE users SET username=?, full_name=? WHERE id=? AND role='admin'");
    $stmt->bind_param("ssi", $username, $full_name, $id);
}

if ($stmt->execute()) {
    echo json_encode(["success" => true, "message" => "Profile updated.", "username" => $username, "full_name" => $full_name]);
} else {
    echo json_encode(["success" => false, "message" => "Username already taken."]);
}
?>

