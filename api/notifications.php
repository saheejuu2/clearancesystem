<?php
error_reporting(0);
ini_set('display_errors', 0);
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

include 'db_config.php';

$action    = $_GET['action']    ?? 'list';
$recipient = $_GET['recipient'] ?? '';

if (!$recipient) { echo json_encode([]); exit(); }

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'list') {
    $stmt = $conn->prepare("SELECT * FROM notifications WHERE recipient = ? ORDER BY created_at DESC LIMIT 30");
    if (!$stmt) { echo json_encode([]); exit(); }
    $stmt->bind_param("s", $recipient);
    $stmt->execute();
    echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
    exit();
}

$data = json_decode(file_get_contents("php://input"), true);

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'read') {
    $id = (int)($data['id'] ?? 0);
    if ($id) {
        $stmt = $conn->prepare("UPDATE notifications SET is_read=1 WHERE id=?");
        if ($stmt) { $stmt->bind_param("i", $id); $stmt->execute(); }
    }
    echo json_encode(["success" => true]);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'read_all') {
    $stmt = $conn->prepare("UPDATE notifications SET is_read=1 WHERE recipient=?");
    if ($stmt) { $stmt->bind_param("s", $recipient); $stmt->execute(); }
    echo json_encode(["success" => true]);
    exit();
}

echo json_encode([]);
?>
