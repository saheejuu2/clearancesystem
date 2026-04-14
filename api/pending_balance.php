<?php
error_reporting(0);
ini_set('display_errors', 0);

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://hesed-pc';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

include 'db_config.php';

$conn->query("ALTER TABLE cost_center_clearances MODIFY COLUMN status ENUM('pending','cleared','pending_balance') DEFAULT 'pending'");

function get_patient($conn, $patient_id) {
    $stmt = $conn->prepare("SELECT patient_no, full_name FROM patients WHERE id = ?");
    $stmt->bind_param("i", $patient_id);
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc();
}

function get_request($conn, $patient_id) {
    $stmt = $conn->prepare("SELECT * FROM clearance_requests WHERE patient_id = ? ORDER BY id DESC LIMIT 1");
    $stmt->bind_param("i", $patient_id);
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc();
}

function log_audit($conn, $patient_id, $patient, $action_label, $actor, $remarks = '') {
    $stmt = $conn->prepare("INSERT INTO audit_logs (patient_id, patient_no, patient_name, action, performed_by, remarks) VALUES (?, ?, ?, ?, ?, ?)");
    if (!$stmt) return;
    $stmt->bind_param("isssss", $patient_id, $patient['patient_no'], $patient['full_name'], $action_label, $actor, $remarks);
    $stmt->execute();
}

// ── GET ──────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $cost_center = $_GET['cost_center'] ?? '';
    if (!$cost_center) { echo json_encode([]); exit(); }

    if ($cost_center === 'all') {
        // Admin view: only rows that were actually flagged as pending_balance
        $stmt = $conn->prepare("
            SELECT p.id, p.patient_no, p.full_name, p.age, p.ward, p.admit_date, p.patient_type,
                   ccc.cost_center,
                   ccc.status,
                   ccc.remarks AS balance_remarks,
                   ccc.cleared_by AS flagged_by,
                   ccc.cleared_at AS flagged_at,
                   ccc.id AS ccc_id
            FROM cost_center_clearances ccc
            JOIN clearance_requests cr ON ccc.clearance_request_id = cr.id
            JOIN patients p ON cr.patient_id = p.id
            WHERE ccc.status = 'pending_balance'
            ORDER BY p.full_name ASC, ccc.cost_center ASC
        ");
        $stmt->execute();
    } else {
        $stmt = $conn->prepare("
            SELECT p.id, p.patient_no, p.full_name, p.age, p.ward, p.admit_date, p.patient_type,
                   ccc.cost_center, ccc.status,
                   ccc.remarks AS balance_remarks,
                   ccc.cleared_by AS flagged_by, ccc.cleared_at AS flagged_at,
                   ccc.id AS ccc_id
            FROM cost_center_clearances ccc
            JOIN clearance_requests cr ON ccc.clearance_request_id = cr.id
            JOIN patients p ON cr.patient_id = p.id
            WHERE ccc.cost_center = ? AND ccc.status = 'pending_balance'
            ORDER BY ccc.cleared_at DESC
        ");
        $stmt->bind_param("s", $cost_center);
        $stmt->execute();
    }

    echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
    exit();
}

// ── POST ─────────────────────────────────────────────────────────────────────
$data = json_decode(file_get_contents("php://input"), true);

// Admin override clear
if (isset($data['action']) && $data['action'] === 'admin_clear') {
    $patient_id  = (int)($data['patient_id']  ?? 0);
    $cost_center = trim($data['cost_center']  ?? '');
    $actor       = trim($data['actor']        ?? '');
    $remarks     = trim($data['remarks']      ?? 'Cleared by admin');

    if (!$patient_id || !$cost_center || !$actor) {
        echo json_encode(["success" => false, "message" => "Missing required fields."]);
        exit();
    }

    $req = get_request($conn, $patient_id);
    if (!$req) { echo json_encode(["success" => false, "message" => "No clearance request found."]); exit(); }

    $now = date('Y-m-d H:i:s');
    $stmt = $conn->prepare("UPDATE cost_center_clearances SET status='cleared', cleared_by=?, cleared_at=?, remarks=? WHERE clearance_request_id=? AND cost_center=? AND status='pending_balance'");
    $stmt->bind_param("ssssi", $actor, $now, $remarks, $req['id'], $cost_center);
    $stmt->execute();

    if ($stmt->affected_rows === 0) {
        echo json_encode(["success" => false, "message" => "Record not found or already cleared."]);
        exit();
    }

    $patient = get_patient($conn, $patient_id);
    log_audit($conn, $patient_id, $patient, $cost_center . " - Admin Override Clear", $actor, $remarks);

    $stmt2 = $conn->prepare("SELECT COUNT(*) as total, SUM(status='cleared') as cleared FROM cost_center_clearances WHERE clearance_request_id=?");
    $stmt2->bind_param("i", $req['id']);
    $stmt2->execute();
    $counts = $stmt2->get_result()->fetch_assoc();
    $all_cleared = ($counts['total'] == $counts['cleared']);

    if ($all_cleared) {
        $msg = "Admin cleared pending balance for " . $patient['full_name'] . " (" . $patient['patient_no'] . ") at " . $cost_center . ". All departments cleared — ready for discharge.";
        $notif = $conn->prepare("INSERT INTO notifications (recipient, patient_id, patient_no, patient_name, message) VALUES ('Billing', ?, ?, ?, ?)");
        $notif->bind_param("isss", $patient_id, $patient['patient_no'], $patient['full_name'], $msg);
        $notif->execute();
    }

    echo json_encode(["success" => true, "all_cleared" => $all_cleared]);
    exit();
}

// Flag as pending balance
$patient_id  = (int)($data['patient_id']  ?? 0);
$cost_center = trim($data['cost_center']  ?? '');
$actor       = trim($data['actor']        ?? '');
$entered_amt = $data['entered_amount']    ?? '';
$soa_amt     = $data['soa_amount']        ?? '';

if (!$patient_id || !$cost_center || !$actor) {
    echo json_encode(["success" => false, "message" => "Missing required fields."]);
    exit();
}

$req = get_request($conn, $patient_id);
if (!$req) { echo json_encode(["success" => false, "message" => "No clearance request found."]); exit(); }

$remarks = "Amount mismatch: entered ₱{$entered_amt}, SOA ₱{$soa_amt}";
$now = date('Y-m-d H:i:s');

$stmt = $conn->prepare("UPDATE cost_center_clearances SET status='pending_balance', cleared_by=?, cleared_at=?, remarks=? WHERE clearance_request_id=? AND cost_center=?");
$stmt->bind_param("sssis", $actor, $now, $remarks, $req['id'], $cost_center);
$stmt->execute();

if ($stmt->affected_rows === 0) {
    echo json_encode(["success" => false, "message" => "Record not found."]);
    exit();
}

$patient = get_patient($conn, $patient_id);
log_audit($conn, $patient_id, $patient, $cost_center . " - Pending Balance", $actor, $remarks);

$msg = $cost_center . " flagged " . $patient['full_name'] . " (" . $patient['patient_no'] . ") for pending balance. " . $remarks;
$notif = $conn->prepare("INSERT INTO notifications (recipient, patient_id, patient_no, patient_name, message) VALUES ('Admin', ?, ?, ?, ?)");
$notif->bind_param("isss", $patient_id, $patient['patient_no'], $patient['full_name'], $msg);
$notif->execute();

echo json_encode(["success" => true]);
exit();
?>
