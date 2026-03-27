<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
include 'db_config.php';

$role       = isset($_GET['role'])       ? $_GET['role']       : '';
$patient_id = isset($_GET['patient_id']) ? (int)$_GET['patient_id'] : 0;

$where  = [];
$params = [];
$types  = '';

if ($patient_id) {
    $where[]  = "al.patient_id = ?";
    $params[] = $patient_id;
    $types   .= 'i';
}

if ($role && $role !== 'Billing') {
    if ($role === 'Nurse') {
        // Nurse entries are logged with the individual nurse's name as actor
        // so filter by action type instead
        $where[]  = "al.action LIKE ?";
        $params[] = 'Nurse%';
        $types   .= 's';
    } else {
        // Cost centers: filter by action starting with the cost center name
        $where[]  = "al.action LIKE ?";
        $params[] = $role . '%';
        $types   .= 's';
    }
}

$whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$sql = "SELECT al.*, p.ward FROM audit_logs al
        LEFT JOIN patients p ON p.id = al.patient_id
        $whereSQL
        ORDER BY al.created_at DESC
        LIMIT 200";

$stmt = $conn->prepare($sql);

// If table doesn't exist or query fails, return empty array safely
if (!$stmt) {
    echo json_encode([]);
    exit();
}

if ($params) {
    $stmt->bind_param($types, ...$params);
}

$stmt->execute();
$result = $stmt->get_result();

$logs = [];
while ($row = $result->fetch_assoc()) {
    $logs[] = $row;
}

echo json_encode($logs);
?>
