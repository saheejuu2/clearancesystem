<?php
error_reporting(0);
ini_set('display_errors', 0);
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
include 'db_config.php';

$role = isset($_GET['role']) ? $_GET['role'] : '';
$date = isset($_GET['date']) ? $_GET['date'] : date('Y-m-d'); // default: today

// Date filter = admit date only
$date_condition = "AND DATE(p.admit_date) = '$date'";

$sql = "
    SELECT 
        p.id, p.patient_no, p.full_name, p.age, p.ward, p.ward_name, p.room_bed, p.admitting_dx, p.admitting_dx AS admtxt, p.admit_date, p.patient_type,
        cr.id AS request_id,
        cr.nurse_status,
        cr.billing_status,
        cr.final_status,
        cr.discharged_at,
        (SELECT COUNT(*) FROM cost_center_clearances ccc2
         WHERE ccc2.clearance_request_id = cr.id AND ccc2.status = 'pending') AS pending_count,
        (SELECT COUNT(*) FROM cost_center_clearances ccc3
         WHERE ccc3.clearance_request_id = cr.id) AS total_cc,
        (SELECT COUNT(*) FROM cost_center_clearances ccc4
         WHERE ccc4.clearance_request_id = cr.id AND ccc4.remarks IS NOT NULL AND ccc4.remarks != '') AS sent_back_count
    FROM patients p
    LEFT JOIN clearance_requests cr ON cr.patient_id = p.id
    WHERE 1=1 $date_condition
    ORDER BY p.admit_date DESC, p.id DESC
";

$result = $conn->query($sql);
$all = [];
while ($row = $result->fetch_assoc()) {
    $row['clearance_step'] = get_step($row);
    $row['has_pending'] = ($row['request_id'] && (int)$row['sent_back_count'] > 0);
    $row['was_sent_back'] = ($row['request_id'] && (int)$row['sent_back_count'] > 0);
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

$pending_only = isset($_GET['pending_only']) && $_GET['pending_only'] === '1';

// For pending_only mode: return patients where this CC has status=pending AND remarks set (sent back by billing)
if ($pending_only && $role && !in_array($role, ['Nurse', 'Billing'])) {
    $stmt_p = $conn->prepare("
        SELECT p.id, p.patient_no, p.full_name, p.age, p.ward, p.ward_name, p.admitting_dx, p.admit_date, p.patient_type,
               ccc.remarks AS cc_remarks
        FROM patients p
        JOIN clearance_requests cr ON cr.patient_id = p.id
        JOIN cost_center_clearances ccc ON ccc.clearance_request_id = cr.id
        WHERE ccc.cost_center = ?
          AND ccc.status = 'pending'
          AND ccc.remarks IS NOT NULL
          AND ccc.remarks != ''
          AND cr.billing_status = 'for_clearance'
          AND cr.final_status != 'discharged'
        ORDER BY p.admit_date DESC, p.id DESC
    ");
    $stmt_p->bind_param("s", $role);
    $stmt_p->execute();
    $rows = $stmt_p->get_result()->fetch_all(MYSQLI_ASSOC);
    echo json_encode($rows);
    exit();
}

$filtered = array_filter($all, function($p) use ($role, $already_cleared, $window_map) {
    $step = $p['clearance_step'];

    switch ($role) {
        case 'Nurse':
            return in_array($step, ['no_request', 'awaiting_nurse', 'awaiting_billing', 'cost_center_clearing']);

        case 'Billing':
            return in_array($step, ['awaiting_billing', 'cost_center_clearing', 'discharged']);

        case 'Admin':
            return true; // Admin sees all patients

        default:
            if ($step !== 'cost_center_clearing') return false;
            if (in_array((int)$p['id'], $already_cleared)) return false;
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

