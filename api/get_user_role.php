<?php
error_reporting(0);
ini_set('display_errors', 0);
include 'cors_headers.php';
include 'db_config.php';

$username = isset($_GET['username']) ? trim($_GET['username']) : '';
if (empty($username)) { echo json_encode(["role" => null]); exit(); }

$stmt = $conn->prepare("SELECT role FROM users WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();
$row = $result->fetch_assoc();

echo json_encode(["role" => $row ? $row['role'] : null]);
$stmt->close();
$conn->close();
?>
