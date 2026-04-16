<?php
// ── LOCAL DB (hospital_db) — used by all system APIs ──────────
$host   = "localhost";
$user   = "root";
$pass   = "";
$dbname = "hospital_db";

$conn = new mysqli($host, $user, $pass, $dbname);
if ($conn->connect_error) {
    header("Content-Type: application/json");
    die(json_encode(["success" => false, "message" => "Database connection failed."]));
}

// ── REMOTE DB (hospital_dbo on Host PC) ────────────────────────
$remote_host = "192.168.100.5";
$remote_user = "root";
$remote_pass = "root";
$remote_db   = "hospital_dbo";

mysqli_report(MYSQLI_REPORT_OFF); // Disable exceptions for remote connection
$remote_conn = new mysqli($remote_host, $remote_user, $remote_pass, $remote_db);
if ($remote_conn->connect_error) {
    $remote_conn = null;
}
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT); // Re-enable for local
?>
