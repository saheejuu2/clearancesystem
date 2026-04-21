<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
include 'db_config.php';

$cost_center = isset($_GET['cost_center']) ? trim($_GET['cost_center']) : '';
if (!$cost_center) {
    echo json_encode(["success" => false, "message" => "Cost center required."]);
    exit();
}

// Fetch all clearances for this cost center that are cleared, joined with patient info
$sql = "
    SELECT
        p.id            AS patient_id,
        p.patient_no,
        p.full_name,
        p.age,
        p.ward,
        p.ward_name,
        p.admit_date,
        ccc.cost_center,
        ccc.status,
        ccc.remarks,
        ccc.cleared_by,
        ccc.cleared_at
    FROM cost_center_clearances ccc
    JOIN clearance_requests cr ON cr.id = ccc.clearance_request_id
    JOIN patients p            ON p.id  = cr.patient_id
    WHERE ccc.cost_center = ?
      AND ccc.status      = 'cleared'
    ORDER BY ccc.cleared_at DESC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $cost_center);
$stmt->execute();
$result = $stmt->get_result();

$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}

echo json_encode(["success" => true, "cleared" => $rows]);
?>
