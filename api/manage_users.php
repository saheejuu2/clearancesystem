<?php
error_reporting(0);
ini_set('display_errors', 0);
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

include 'db_config.php';

$action = $_GET['action'] ?? '';


if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'list_all') {
        $stmt = $conn->prepare("SELECT id, username, full_name, cost_center, role, created_at FROM users WHERE role != 'admin' ORDER BY cost_center ASC, role DESC, full_name ASC");
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        echo json_encode($rows);
        exit();
    }

    if ($action === 'list') {
        $cost_center = $_GET['cost_center'] ?? '';
        $stmt = $conn->prepare("SELECT id, username, full_name, role, created_at FROM users WHERE cost_center = ? ORDER BY role DESC, full_name ASC");
        $stmt->bind_param("s", $cost_center);
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        echo json_encode($rows);
        exit();
    }
}

$data = json_decode(file_get_contents("php://input"), true);

// â”€â”€ POST: create staff â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'create') {
    $username    = trim($data['username']    ?? '');
    $full_name   = trim($data['full_name']   ?? '');
    $password    = trim($data['password']    ?? '');
    $cost_center = trim($data['cost_center'] ?? '');

    if (!$username || !$full_name || !$password || !$cost_center) {
        echo json_encode(["success" => false, "message" => "All fields are required."]);
        exit();
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("INSERT INTO users (username, password_hash, full_name, cost_center, role) VALUES (?, ?, ?, ?, 'staff')");
    $stmt->bind_param("ssss", $username, $hash, $full_name, $cost_center);

    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Staff account created."]);
    } else {
        echo json_encode(["success" => false, "message" => "Username already exists."]);
    }
    exit();
}

// â”€â”€ POST: edit staff â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'edit') {
    $id          = (int)($data['id']          ?? 0);
    $full_name   = trim($data['full_name']    ?? '');
    $username    = trim($data['username']     ?? '');
    $password    = trim($data['password']     ?? '');
    $cost_center = trim($data['cost_center']  ?? '');

    if (!$id || !$full_name || !$username) {
        echo json_encode(["success" => false, "message" => "ID, username and full name are required."]);
        exit();
    }

    if ($password) {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        if ($cost_center) {
            $stmt = $conn->prepare("UPDATE users SET full_name=?, username=?, password_hash=?, cost_center=? WHERE id=? AND role='staff'");
            $stmt->bind_param("ssssi", $full_name, $username, $hash, $cost_center, $id);
        } else {
            $stmt = $conn->prepare("UPDATE users SET full_name=?, username=?, password_hash=? WHERE id=? AND role='staff'");
            $stmt->bind_param("sssi", $full_name, $username, $hash, $id);
        }
    } else {
        if ($cost_center) {
            $stmt = $conn->prepare("UPDATE users SET full_name=?, username=?, cost_center=? WHERE id=? AND role='staff'");
            $stmt->bind_param("sssi", $full_name, $username, $cost_center, $id);
        } else {
            $stmt = $conn->prepare("UPDATE users SET full_name=?, username=? WHERE id=? AND role='staff'");
            $stmt->bind_param("ssi", $full_name, $username, $id);
        }
    }

    $stmt->execute();
    echo json_encode(["success" => true, "message" => "Staff account updated."]);
    exit();
}

// â”€â”€ POST: delete staff â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'delete') {
    $id = (int)($data['id'] ?? 0);
    if (!$id) {
        echo json_encode(["success" => false, "message" => "ID required."]);
        exit();
    }
    $stmt = $conn->prepare("DELETE FROM users WHERE id=? AND role='staff'");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    echo json_encode(["success" => true, "message" => "Staff account deleted."]);
    exit();
}

echo json_encode(["success" => false, "message" => "Unknown action."]);
?>

