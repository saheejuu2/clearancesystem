<?php
error_reporting(0);
ini_set('display_errors', 0);
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
include 'db_config.php';

$role = isset($_GET['role']) ? $_GET['role'] : '';

$sql = "
    SELECT 
        p.id, p.patient_no, p.full_name, p.age, p.ward, p.admit_date, p.patient_type,
        cr.id AS request_id,
        cr.nurse_status,
        cr.billing_status,
        cr.final_status,
        cr.discharged_at
    FROM patients p
    LEFT JOIN clearance_requests cr ON cr.patient_id = p.id
    ORDER BY p.admit_date DESC
";

$result = $conn->query($sql);
$all = [];
while ($row = $result->fetch_assoc()) {
    $row['clearance_step'] = get_step($row);
    $all[] = $row;
}

// For cost centers, get the list of patient IDs already cleared by this cost center
$already_cleared = [];
if ($role && !in_array($role, ['Nurse', 'Billing'])) {
    $stmt = $conn->prepare("
        SELECT cr.patient_id
        FROM cost_center_clearances ccc
        JOIN clearance_requests cr ON cr.id = ccc.clearance_request_id
        WHERE ccc.cost_center = ? AND ccc.status = 'cleared'
    ");
    $stmt->bind_param("s", $role);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        $already_cleared[] = (int)$row['patient_id'];
    }
}

// Window-to-patient-type mapping
$window_map = [
    'Billing - Window 1' => 'er',
    'Billing - Window 2' => 'in-patient',
    'Benefits - Window 3A' => 'in-patient',
    'Benefits - Window 3B' => 'er',
    'Benefits - Window 6'  => 'er',
];

$filtered = array_filter($all, function($p) use ($role, $already_cleared, $window_map) {
    $step = $p['clearance_step'];

    switch ($role) {
        case 'Nurse':
            return in_array($step, ['no_request', 'awaiting_nurse']);

        case 'Billing':
            return in_array($step, ['awaiting_billing', 'cost_center_clearing', 'discharged']);

        default:
            if ($step !== 'cost_center_clearing') return false;
            if (in_array((int)$p['id'], $already_cleared)) return false;
            // Window accounts only see their patient type
            if (isset($window_map[$role])) {
                return $p['patient_type'] === $window_map[$role];
            }
            return true;
    }
});

echo json_encode(array_values($filtered));

function get_step($row) {
    if (!$row['request_id'])                        return 'no_request';
    if ($row['final_status'] === 'discharged')      return 'discharged';
    if ($row['billing_status'] === 'for_clearance') return 'cost_center_clearing';
    if ($row['nurse_status'] === 'may_go_home')     return 'awaiting_billing';
    return 'awaiting_nurse';
}
?>

