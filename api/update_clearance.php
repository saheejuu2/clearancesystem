<?php
error_reporting(0);
ini_set('display_errors', 0);
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

include 'db_config.php';

$data       = json_decode(file_get_contents("php://input"), true);
$action     = $data['action']     ?? '';
$patient_id = (int)($data['patient_id'] ?? 0);
$actor      = $data['actor']      ?? '';
$remarks    = $data['remarks']    ?? '';

if (!$patient_id || !$action || !$actor) {
    echo json_encode(["success" => false, "message" => "Missing required fields."]);
    exit();
}

$now = date('Y-m-d H:i:s');

function get_request($conn, $patient_id) {
    $stmt = $conn->prepare("SELECT * FROM clearance_requests WHERE patient_id = ? ORDER BY id DESC LIMIT 1");
    $stmt->bind_param("i", $patient_id);
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc();
}

function get_patient($conn, $patient_id) {
    $stmt = $conn->prepare("SELECT patient_no, full_name FROM patients WHERE id = ?");
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

function notify($conn, $recipient, $patient_id, $patient, $message) {
    $stmt = $conn->prepare("INSERT INTO notifications (recipient, patient_id, patient_no, patient_name, message) VALUES (?, ?, ?, ?, ?)");
    if (!$stmt) return; // Table doesn't exist yet — fail silently
    $stmt->bind_param("sisss", $recipient, $patient_id, $patient['patient_no'], $patient['full_name'], $message);
    $stmt->execute();
}

$COST_CENTERS_INPATIENT = [
    'Operating Room/Delivery Room',
    'Pulmonary Department (MSA)',
    'Hemodialysis Unit',
    'Newborn Screening',
    'Newborn Hearing Test',
    'Radiology',
    'Laboratory',
    'Bloodbank',
    'Pharmacy',
    'Benefits - Window 3A',
    'Billing - Window 2',
];

$COST_CENTERS_ER = [
    'Operating Room/Delivery Room',
    'Pulmonary Department (MSA)',
    'Hemodialysis Unit',
    'Newborn Screening',
    'Newborn Hearing Test',
    'Radiology',
    'Laboratory',
    'Bloodbank',
    'Pharmacy',
    'Benefits - Window 3B',
    'Benefits - Window 6',
    'Billing - Window 1',
];

// Legacy fallback (all)
$COST_CENTERS = array_unique(array_merge($COST_CENTERS_INPATIENT, $COST_CENTERS_ER));

$patient = get_patient($conn, $patient_id);

//STEP 1: Nurse â
if ($action === 'may_go_home') {
    $req = get_request($conn, $patient_id);

    if ($req && $req['nurse_status'] === 'may_go_home') {
        echo json_encode(["success" => false, "message" => "Already marked as may go home."]);
        exit();
    }

    if (!$req) {
        $stmt = $conn->prepare("INSERT INTO clearance_requests (patient_id, nurse_status, nurse_cleared_at, nurse_cleared_by) VALUES (?, 'may_go_home', ?, ?)");
        $stmt->bind_param("iss", $patient_id, $now, $actor);
    } else {
        $stmt = $conn->prepare("UPDATE clearance_requests SET nurse_status='may_go_home', nurse_cleared_at=?, nurse_cleared_by=? WHERE id=?");
        $stmt->bind_param("ssi", $now, $actor, $req['id']);
    }
    $stmt->execute();
    log_audit($conn, $patient_id, $patient, 'Nurse May Go Home', $actor);
    notify($conn, "Billing", $patient_id, $patient, "Patient " . $patient["full_name"] . " (" . $patient["patient_no"] . ") is ready for billing review.");
    echo json_encode(["success" => true, "message" => "Patient marked as may go home."]);
    exit();
}

// STEP 2: Billing For Clearance
if ($action === 'for_clearance') {
    $req = get_request($conn, $patient_id);

    if (!$req || $req['nurse_status'] !== 'may_go_home') {
        echo json_encode(["success" => false, "message" => "Nurse must mark patient as may go home first."]);
        exit();
    }
    if ($req['billing_status'] === 'for_clearance') {
        echo json_encode(["success" => false, "message" => "Already sent for clearance."]);
        exit();
    }

    // Auto-route by patient type if no manual selection
    if (isset($data['cost_centers']) && is_array($data['cost_centers']) && count($data['cost_centers']) > 0) {
        $selected = $data['cost_centers'];
    } else {
        // Get patient type to determine correct windows
        $pt_stmt = $conn->prepare("SELECT patient_type FROM patients WHERE id = ?");
        $pt_stmt->bind_param("i", $patient_id);
        $pt_stmt->execute();
        $pt_row = $pt_stmt->get_result()->fetch_assoc();
        $patient_type = $pt_row['patient_type'] ?? 'in-patient';
        $selected = $patient_type === 'er' ? $COST_CENTERS_ER : $COST_CENTERS_INPATIENT;
    }

    $stmt = $conn->prepare("UPDATE clearance_requests SET billing_status='for_clearance', billing_sent_at=?, billing_sent_by=? WHERE id=?");
    $stmt->bind_param("ssi", $now, $actor, $req['id']);
    $stmt->execute();

    $stmt2 = $conn->prepare("INSERT IGNORE INTO cost_center_clearances (clearance_request_id, cost_center) VALUES (?, ?)");
    foreach ($selected as $cc) {
        $stmt2->bind_param("is", $req["id"], $cc);
        $stmt2->execute();
        notify($conn, $cc, $patient_id, $patient, "Patient " . $patient["full_name"] . " (" . $patient["patient_no"] . ") needs clearance from your department.");
    }

    log_audit($conn, $patient_id, $patient, 'Billing Sent for Clearance', $actor);
    echo json_encode(["success" => true, "message" => "Sent to selected cost centers for clearance."]);
    exit();
}

// STEP 3: Cost Center Cleared
if ($action === 'cost_center_clear') {
    $cost_center = $data['cost_center'] ?? '';
    if (!$cost_center) {
        echo json_encode(["success" => false, "message" => "Cost center not specified."]);
        exit();
    }

    $req = get_request($conn, $patient_id);

    if (!$req || $req['billing_status'] !== 'for_clearance') {
        echo json_encode(["success" => false, "message" => "Patient is not yet sent for clearance."]);
        exit();
    }

    $stmt = $conn->prepare("UPDATE cost_center_clearances SET status='cleared', cleared_at=?, cleared_by=?, remarks=? WHERE clearance_request_id=? AND cost_center=?");
    $stmt->bind_param("sssis", $now, $actor, $remarks, $req['id'], $cost_center);
    $stmt->execute();

    if ($stmt->affected_rows === 0) {
        echo json_encode(["success" => false, "message" => "Cost center clearance record not found."]);
        exit();
    }

    log_audit($conn, $patient_id, $patient, "$cost_center” Cleared", $actor, $remarks);

    $stmt2 = $conn->prepare("SELECT COUNT(*) as total, SUM(status='cleared') as cleared FROM cost_center_clearances WHERE clearance_request_id=?");
    $stmt2->bind_param("i", $req['id']);
    $stmt2->execute();
    $counts = $stmt2->get_result()->fetch_assoc();

    $all_cleared = ($counts['total'] == $counts['cleared']);
    echo json_encode([
        "success"     => true,
        "all_cleared" => $all_cleared,
        "cleared"     => (int)$counts['cleared'],
        "total"       => (int)$counts['total'],
        "message"     => $all_cleared ? "All cost centers cleared." : "Cleared. Waiting for other cost centers."
    ]);
    exit();
}

// STEP 4: Billing Discharge 
if ($action === 'discharge') {
    $req = get_request($conn, $patient_id);

    if (!$req || $req['billing_status'] !== 'for_clearance') {
        echo json_encode(["success" => false, "message" => "Patient has not been sent for clearance."]);
        exit();
    }

    $stmt = $conn->prepare("SELECT COUNT(*) as total, SUM(status='cleared') as cleared FROM cost_center_clearances WHERE clearance_request_id=?");
    $stmt->bind_param("i", $req['id']);
    $stmt->execute();
    $counts = $stmt->get_result()->fetch_assoc();

    if ($counts['total'] != $counts['cleared']) {
        $remaining = $counts['total'] - $counts['cleared'];
        echo json_encode(["success" => false, "message" => "$remaining cost center(s) have not cleared yet."]);
        exit();
    }

    $stmt2 = $conn->prepare("UPDATE clearance_requests SET final_status='discharged', final_remarks=?, discharged_at=?, discharged_by=? WHERE id=?");
    $stmt2->bind_param("sssi", $remarks, $now, $actor, $req['id']);
    $stmt2->execute();

    log_audit($conn, $patient_id, $patient, 'Billing Patient Discharged', $actor, $remarks);
    echo json_encode(["success" => true, "message" => "Patient successfully discharged."]);
    exit();
}

// CANCEL: Nurse Cancel Discharge Process 
if ($action === 'cancel_discharge') {
    $req = get_request($conn, $patient_id);

    if (!$req) {
        echo json_encode(["success" => false, "message" => "No active clearance request found."]);
        exit();
    }
    if ($req['final_status'] === 'discharged') {
        echo json_encode(["success" => false, "message" => "Patient is already discharged and cannot be cancelled."]);
        exit();
    }

    $request_id = $req['id'];

    // Delete cost center clearances
    $stmt = $conn->prepare("DELETE FROM cost_center_clearances WHERE clearance_request_id = ?");
    $stmt->bind_param("i", $request_id);
    $stmt->execute();

    // Delete the clearance request entirely patient resets to fresh state
    $stmt2 = $conn->prepare("DELETE FROM clearance_requests WHERE id = ?");
    $stmt2->bind_param("i", $request_id);
    $stmt2->execute();

    log_audit($conn, $patient_id, $patient, 'Nurse Discharge Cancelled', $actor, $remarks);

    echo json_encode(["success" => true, "message" => "Discharge process cancelled. Patient reset to admitted."]);
    exit();
}

echo json_encode(["success" => false, "message" => "Unknown action."]);
?>


