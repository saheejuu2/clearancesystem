<?php
error_reporting(0);
ini_set('display_errors', 0);

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://hesed-pc';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

include 'db_config.php';

// Ensure table exists
$conn->query("CREATE TABLE IF NOT EXISTS notification_settings (
    cost_center VARCHAR(100) PRIMARY KEY,
    toast_enabled TINYINT(1) NOT NULL DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)");

// GET: return all settings or single cost center
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $cc = $_GET['cost_center'] ?? '';
    if ($cc) {
        $stmt = $conn->prepare("SELECT toast_enabled FROM notification_settings WHERE cost_center = ?");
        $stmt->bind_param("s", $cc);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        // Default to enabled if no record
        echo json_encode(["toast_enabled" => $row ? (bool)$row['toast_enabled'] : true]);
    } else {
        $result = $conn->query("SELECT cost_center, toast_enabled FROM notification_settings");
        $map = [];
        while ($row = $result->fetch_assoc()) {
            $map[$row['cost_center']] = (bool)$row['toast_enabled'];
        }
        echo json_encode($map);
    }
    exit();
}

// POST: toggle a cost center
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    $cc      = trim($data['cost_center'] ?? '');
    $enabled = isset($data['toast_enabled']) ? (int)(bool)$data['toast_enabled'] : 1;

    if (!$cc) { echo json_encode(["success" => false, "message" => "cost_center required"]); exit(); }

    $stmt = $conn->prepare("INSERT INTO notification_settings (cost_center, toast_enabled) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE toast_enabled = VALUES(toast_enabled)");
    $stmt->bind_param("si", $cc, $enabled);
    $stmt->execute();
    echo json_encode(["success" => true]);
    exit();
}

echo json_encode([]);
?>
