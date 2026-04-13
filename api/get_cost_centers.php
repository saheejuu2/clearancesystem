<?php
error_reporting(0);
ini_set('display_errors', 0);

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://hesed-pc';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

include 'db_config.php';

$result = $conn->query(
    "SELECT DISTINCT cost_center FROM users 
     WHERE cost_center IS NOT NULL AND cost_center != '' AND role != 'admin'
     ORDER BY cost_center"
);

$centers = [];
while ($row = $result->fetch_assoc()) {
    $centers[] = $row['cost_center'];
}

echo json_encode($centers);
$conn->close();
?>
