<?php
error_reporting(0);
ini_set('display_errors', 0);
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

include 'db_config.php';

// Create table if not exists
$conn->query("CREATE TABLE IF NOT EXISTS chat_messages (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    sender      VARCHAR(100) NOT NULL,
    recipient   VARCHAR(100) NOT NULL,
    message     TEXT NOT NULL,
    is_read     TINYINT(1) DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)");

$action = $_GET['action'] ?? 'list';

// GET: list messages in a conversation
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'list') {
    $me    = $_GET['me']    ?? '';
    $other = $_GET['other'] ?? '';
    if (!$me || !$other) { echo json_encode([]); exit(); }

    $stmt = $conn->prepare("
        SELECT * FROM chat_messages
        WHERE (sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?)
        ORDER BY created_at ASC LIMIT 100
    ");
    $stmt->bind_param("ssss", $me, $other, $other, $me);
    $stmt->execute();
    echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
    exit();
}

// GET: unread count per sender for a recipient
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'unread') {
    $me = $_GET['me'] ?? '';
    if (!$me) { echo json_encode([]); exit(); }
    $stmt = $conn->prepare("
        SELECT sender, COUNT(*) as count FROM chat_messages
        WHERE recipient = ? AND is_read = 0
        GROUP BY sender
    ");
    $stmt->bind_param("s", $me);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $result = [];
    foreach ($rows as $r) $result[$r['sender']] = (int)$r['count'];
    echo json_encode($result);
    exit();
}

$data = json_decode(file_get_contents("php://input"), true);

// POST: send message
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'send') {
    $sender    = trim($data['sender']    ?? '');
    $recipient = trim($data['recipient'] ?? '');
    $message   = trim($data['message']   ?? '');
    if (!$sender || !$recipient || !$message) {
        echo json_encode(["success" => false, "message" => "Missing fields."]);
        exit();
    }
    // Block anyone except Admin from sending TO Admin
    if ($recipient === 'Admin' && $sender !== 'Admin') {
        echo json_encode(["success" => false, "message" => "Cannot reply to Admin."]);
        exit();
    }
    $stmt = $conn->prepare("INSERT INTO chat_messages (sender, recipient, message) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $sender, $recipient, $message);
    $stmt->execute();
    echo json_encode(["success" => true, "id" => $conn->insert_id]);
    exit();
}

// POST: mark read
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'read') {
    $me    = trim($data['me']    ?? '');
    $other = trim($data['other'] ?? '');
    if (!$me || !$other) { echo json_encode(["success" => false]); exit(); }
    $stmt = $conn->prepare("UPDATE chat_messages SET is_read=1 WHERE recipient=? AND sender=?");
    $stmt->bind_param("ss", $me, $other);
    $stmt->execute();
    echo json_encode(["success" => true]);
    exit();
}

echo json_encode(["success" => false, "message" => "Unknown action."]);
?>
