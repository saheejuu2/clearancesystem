<?php
header("Access-Control-Allow-Origin: *"); // Allows React to access this
header("Content-Type: application/json");
include 'db_config.php';

// Dummy data for testing before you build the DB
$response = [
    "step" => 1,
    "role" => "Physician",
    "status" => "Fit for Discharge"
];

echo json_encode($response);
?>