<?php
error_reporting(0);
ini_set('display_errors', 0);
include 'cors_headers.php';
include 'db_config.php';

$action    = $_GET['action']    ?? 'list';
$recipient = $_GET['recipient'] ?? '';

// Only require recipient for GET list
if ($_SERVER['REQUEST_METHOD'] === 'GET' && !$recipient) { echo json_encode([]); exit(); }

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'list') {
    if ($recipient === 'Admin') {
        // Admin sees all notifications
        $stmt = $conn->prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50");
        if (!$stmt) { echo json_encode([]); exit(); }
        $stmt->execute();
    } else {
        $stmt = $conn->prepare("SELECT * FROM notifications WHERE recipient = ? ORDER BY created_at DESC LIMIT 30");
        if (!$stmt) { echo json_encode([]); exit(); }
        $stmt->bind_param("s", $recipient);
        $stmt->execute();
    }
    echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
    exit();
}

$data = json_decode(file_get_contents("php://input"), true);

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'send') {
    $recipient    = $data['recipient']    ?? '';
    $patient_id   = (int)($data['patient_id']   ?? 0);
    $patient_no   = $data['patient_no']   ?? '';
    $patient_name = $data['patient_name'] ?? '';
    $message      = $data['message']      ?? '';
    if (!$recipient || !$patient_id || !$message) {
        echo json_encode(["success" => false, "message" => "Missing fields."]);
        exit();
    }
    $stmt = $conn->prepare("INSERT INTO notifications (recipient, patient_id, patient_no, patient_name, message) VALUES (?, ?, ?, ?, ?)");
    if ($stmt) {
        $stmt->bind_param("sisss", $recipient, $patient_id, $patient_no, $patient_name, $message);
        $stmt->execute();
        echo json_encode(["success" => true]);
    } else {
        echo json_encode(["success" => false, "message" => "DB error."]);
    }
    exit();
}

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
    if ($recipient === 'Admin') {
        $conn->query("UPDATE notifications SET is_read=1");
    } else {
        $stmt = $conn->prepare("UPDATE notifications SET is_read=1 WHERE recipient=?");
        if ($stmt) { $stmt->bind_param("s", $recipient); $stmt->execute(); }
    }
    echo json_encode(["success" => true]);
    exit();
}

echo json_encode([]);
?>
