<?php
error_reporting(0);
ini_set('display_errors', 0);

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://hesed-pc';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: text/event-stream");
header("Cache-Control: no-cache");
header("X-Accel-Buffering: no"); // Disable nginx buffering if applicable

include 'db_config.php';

$recipient = isset($_GET['recipient']) ? trim($_GET['recipient']) : '';
if (!$recipient) { echo "data: []\n\n"; flush(); exit(); }

// Track the last notification id we've sent so we only push new ones
$lastId = isset($_GET['lastId']) ? (int)$_GET['lastId'] : 0;

// Keep connection alive, push new notifications as they arrive
set_time_limit(0);
ignore_user_abort(false);

while (true) {
    if (connection_aborted()) break;

    if ($recipient === 'Admin') {
        $stmt = $conn->prepare(
            "SELECT * FROM notifications WHERE id > ? ORDER BY created_at DESC LIMIT 50"
        );
        $stmt->bind_param("i", $lastId);
    } else {
        $stmt = $conn->prepare(
            "SELECT * FROM notifications WHERE recipient = ? AND id > ? ORDER BY created_at DESC LIMIT 30"
        );
        $stmt->bind_param("si", $recipient, $lastId);
    }

    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    if (!empty($rows)) {
        // Update lastId to the highest id seen
        $lastId = max(array_column($rows, 'id'));
        echo "data: " . json_encode($rows) . "\n\n";
        flush();
    } else {
        // Send a heartbeat comment to keep connection alive
        echo ": heartbeat\n\n";
        flush();
    }

    sleep(1); // Check DB every second
}

$conn->close();
?>
