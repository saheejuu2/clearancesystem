<?php
// Run ONCE to add MAB account. DELETE this file after running.
include 'db_config.php';

$hash = password_hash('costcenter123', PASSWORD_DEFAULT);

$stmt = $conn->prepare("INSERT INTO users (username, password_hash, full_name, cost_center, role) VALUES (?, ?, ?, ?, 'staff') ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), cost_center=VALUES(cost_center), role='staff'");

$username    = 'mab';
$full_name   = 'MAB Staff';
$cost_center = 'MAB';

$stmt->bind_param("ssss", $username, $hash, $full_name, $cost_center);

if ($stmt->execute()) {
    echo "Done. MAB account created/updated.<br>";
    echo "Username: mab<br>";
    echo "Password: costcenter123<br>";
    echo "Cost Center: MAB<br><br>";
    echo "<strong>Delete this file now.</strong>";
} else {
    echo "Error: " . $conn->error;
}

$conn->close();
?>
