<?php
include 'db_config.php';
header("Content-Type: application/json");

$result = $conn->query("
    SELECT ccc.id, ccc.clearance_request_id, ccc.cost_center, ccc.status, ccc.cleared_by, ccc.remarks
    FROM cost_center_clearances ccc
    WHERE ccc.status = 'pending_balance'
    ORDER BY ccc.clearance_request_id, ccc.cost_center
");

echo json_encode($result->fetch_all(MYSQLI_ASSOC), JSON_PRETTY_PRINT);
$conn->close();
?>
