<?php
error_reporting(0);
ini_set('display_errors', 0);
include 'cors_headers.php';
include 'db_config.php';
include 'websocket_helper.php';

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
$today = date('Y-m-d');

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
    'Endoscopy',
    'Colonoscopy',
    'Physical Therapy',
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
    'Endoscopy',
    'Colonoscopy',
    'Physical Therapy',
    'Benefits - Window 3B',
    'Benefits - Window 6',
    'Billing - Window 1',
];

// Legacy fallback (all)
$COST_CENTERS = array_unique(array_merge($COST_CENTERS_INPATIENT, $COST_CENTERS_ER));

$patient = get_patient($conn, $patient_id);

//STEP 1: Nurse →
if ($action === 'may_go_home') {
    $req = get_request($conn, $patient_id);

    if ($req && $req['nurse_status'] === 'may_go_home') {
        echo json_encode(["success" => false, "message" => "Already marked as may go home."]);
        exit();
    }

    if (!$req) {
        $stmt = $conn->prepare("INSERT INTO clearance_requests (patient_id, nurse_status, nurse_cleared_at, nurse_cleared_by, coder_status) VALUES (?, 'may_go_home', ?, ?, 'pending')");
        $stmt->bind_param("iss", $patient_id, $now, $actor);
    } else {
        $stmt = $conn->prepare("UPDATE clearance_requests SET nurse_status='may_go_home', nurse_cleared_at=?, nurse_cleared_by=?, coder_status=IF(coder_status='proceeded','proceeded','pending') WHERE id=?");
        $stmt->bind_param("ssi", $now, $actor, $req['id']);
    }
    $stmt->execute();
    log_audit($conn, $patient_id, $patient, "Nurse - May Go Home", $actor);
    notify($conn, "Coder", $patient_id, $patient, "Patient " . $patient["full_name"] . " (" . $patient["patient_no"] . ") is ready for coding review.");
    
    // Broadcast update to Nurse, Coder, and Billing dashboards
    fetchAndBroadcastPatients($conn, 'Nurse', $today);
    fetchAndBroadcastPatients($conn, 'Coder', $today);
    fetchAndBroadcastPatients($conn, 'Billing', $today);
    
    echo json_encode(["success" => true, "message" => "Patient marked as may go home."]);
    exit();
}

// Coder → Return to Nurse
if ($action === 'coder_return_to_nurse') {
    $req = get_request($conn, $patient_id);

    if (!$req || $req['nurse_status'] !== 'may_go_home') {
        echo json_encode(["success" => false, "message" => "Patient is not in coding queue."]);
        exit();
    }

    // Reset nurse status back to pending, clear coder status
    $stmt = $conn->prepare("UPDATE clearance_requests SET nurse_status='pending', coder_status='pending', coder_cleared_at=NULL, coder_cleared_by=NULL WHERE id=?");
    $stmt->bind_param("i", $req['id']);
    $stmt->execute();

    log_audit($conn, $patient_id, $patient, "Coder - Returned to Nurse", $actor, $remarks);
    notify($conn, "Nurse", $patient_id, $patient, "Patient " . $patient["full_name"] . " (" . $patient["patient_no"] . ") was returned by Coder: " . ($remarks ?: 'Please review.'));

    fetchAndBroadcastPatients($conn, 'Coder', $today);
    fetchAndBroadcastPatients($conn, 'Nurse', $today);

    echo json_encode(["success" => true, "message" => "Patient returned to nurse."]);
    exit();
}

// STEP 1.5: Coder → Proceed to Billing
if ($action === 'proceed_to_billing') {
    $req = get_request($conn, $patient_id);

    if (!$req || $req['nurse_status'] !== 'may_go_home') {
        echo json_encode(["success" => false, "message" => "Nurse must mark patient as may go home first."]);
        exit();
    }
    if ($req['coder_status'] === 'proceeded') {
        echo json_encode(["success" => false, "message" => "Already proceeded to billing."]);
        exit();
    }

    $icd10_code        = trim($data['icd10_code']        ?? '');
    $icd10_description = trim($data['icd10_description'] ?? '');
    $case_type         = trim($data['case_type']         ?? '');
    $procedure_done    = trim($data['procedure_done']    ?? '');

    $stmt = $conn->prepare("UPDATE clearance_requests SET coder_status='proceeded', coder_cleared_at=?, coder_cleared_by=?, icd10_code=?, icd10_description=?, case_type=?, procedure_done=? WHERE id=?");
    $stmt->bind_param("ssssssi", $now, $actor, $icd10_code, $icd10_description, $case_type, $procedure_done, $req['id']);
    $stmt->execute();

    log_audit($conn, $patient_id, $patient, "Coder - Proceeded to Billing", $actor, $remarks);
    notify($conn, "Billing", $patient_id, $patient, "Patient " . $patient["full_name"] . " (" . $patient["patient_no"] . ") has been coded and is ready for billing review.");
    notify($conn, "Nurse",   $patient_id, $patient, "Patient " . $patient["full_name"] . " (" . $patient["patient_no"] . ") has been coded and forwarded to billing.");

    fetchAndBroadcastPatients($conn, 'Coder', $today);
    fetchAndBroadcastPatients($conn, 'Billing', $today);
    fetchAndBroadcastPatients($conn, 'Nurse', $today);

    echo json_encode(["success" => true, "message" => "Patient forwarded to billing."]);
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
        // Get patient type and accom_type to determine correct windows and MAB
        $pt_stmt = $conn->prepare("SELECT patient_type, accom_type FROM patients WHERE id = ?");
        $pt_stmt->bind_param("i", $patient_id);
        $pt_stmt->execute();
        $pt_row = $pt_stmt->get_result()->fetch_assoc();
        $patient_type = $pt_row['patient_type'] ?? 'in-patient';
        $accom_type   = strtolower(trim($pt_row['accom_type'] ?? ''));
        $selected = $patient_type === 'er' ? $COST_CENTERS_ER : $COST_CENTERS_INPATIENT;
        if ($accom_type === 'pay' && !in_array('MAB', $selected)) {
            $selected[] = 'MAB';
        }
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

    // Broadcast update to all cost centers and billing
    fetchAndBroadcastPatients($conn, 'Billing', $today);
    foreach ($selected as $cc) {
      fetchAndBroadcastPatients($conn, $cc, $today);
    }

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

    // Check BEFORE clearing if this CC was previously sent back (had a pending reason)
    $stmt_pre = $conn->prepare("SELECT remarks FROM cost_center_clearances WHERE clearance_request_id=? AND cost_center=?");
    $stmt_pre->bind_param("is", $req['id'], $cost_center);
    $stmt_pre->execute();
    $pre_row = $stmt_pre->get_result()->fetch_assoc();
    $was_sent_back = !empty($pre_row['remarks']);

    $stmt = $conn->prepare("UPDATE cost_center_clearances SET status='cleared', cleared_at=?, cleared_by=?, remarks=?, amount=? WHERE clearance_request_id=? AND cost_center=?");
    $amount = isset($data['soa_amount']) ? (float)$data['soa_amount'] : null;
    $stmt->bind_param("ssdsis", $now, $actor, $remarks, $amount, $req['id'], $cost_center);
    $stmt->execute();

    if ($stmt->affected_rows === 0) {
        echo json_encode(["success" => false, "message" => "Cost center clearance record not found."]);
        exit();
    }

    log_audit($conn, $patient_id, $patient, $cost_center . " - Cleared", $actor, $remarks);

    $stmt2 = $conn->prepare("SELECT COUNT(*) as total, SUM(status='cleared') as cleared FROM cost_center_clearances WHERE clearance_request_id=?");
    $stmt2->bind_param("i", $req['id']);
    $stmt2->execute();
    $counts = $stmt2->get_result()->fetch_assoc();

    $all_cleared = ($counts['total'] == $counts['cleared']);

    // Notify billing when all CCs are cleared (patient returned to billing)
    if ($all_cleared) {
        notify($conn, "Billing", $patient_id, $patient, "All cost centers have cleared " . $patient["full_name"] . " (" . $patient["patient_no"] . "). Patient is ready for discharge.");
        notify($conn, "Nurse",   $patient_id, $patient, $cost_center . " has cleared " . $patient["full_name"] . " (" . $patient["patient_no"] . "). All departments done — ready for discharge.");
        notify($conn, "Admin",   $patient_id, $patient, "All cost centers have cleared " . $patient["full_name"] . " (" . $patient["patient_no"] . "). Patient is ready for discharge.");
    } else if ($was_sent_back) {
        // This CC was previously sent back — notify billing it's been resolved
        notify($conn, "Billing", $patient_id, $patient, $cost_center . " has resolved the pending requirement for " . $patient["full_name"] . " (" . $patient["patient_no"] . ") and cleared the patient.");
        notify($conn, "Nurse",   $patient_id, $patient, $cost_center . " has resolved and cleared " . $patient["full_name"] . " (" . $patient["patient_no"] . ").");
        notify($conn, "Admin",   $patient_id, $patient, $cost_center . " has resolved the pending requirement for " . $patient["full_name"] . " (" . $patient["patient_no"] . ") and cleared the patient.");
    } else {
        notify($conn, "Nurse",  $patient_id, $patient, $cost_center . " has cleared " . $patient["full_name"] . " (" . $patient["patient_no"] . ").");
        notify($conn, "Admin",  $patient_id, $patient, $cost_center . " has cleared " . $patient["full_name"] . " (" . $patient["patient_no"] . ").");
    }

    // Broadcast update to all affected dashboards
    fetchAndBroadcastPatients($conn, 'Billing', $today);
    fetchAndBroadcastPatients($conn, 'Nurse', $today);
    fetchAndBroadcastPatients($conn, $cost_center, $today);
    fetchAndBroadcastPatients($conn, 'Admin', $today);

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
    log_audit($conn, $patient_id, $patient, "Billing - Patient Discharged", $actor, $remarks);
    
    // Broadcast update to all dashboards
    fetchAndBroadcastPatients($conn, 'Billing', $today);
    fetchAndBroadcastPatients($conn, 'Nurse', $today);
    fetchAndBroadcastPatients($conn, 'Admin', $today);
    
    echo json_encode(["success" => true, "message" => "Patient successfully discharged."]);
    exit();
}

// ADMIN: Return cleared patient back to clearance (reset all CC statuses to pending)
if ($action === 'return_to_clearance') {
    $req = get_request($conn, $patient_id);

    if (!$req || $req['billing_status'] !== 'for_clearance') {
        echo json_encode(["success" => false, "message" => "Patient is not in clearance."]);
        exit();
    }

    // Reset all cost center clearances back to pending
    $stmt = $conn->prepare("UPDATE cost_center_clearances SET status='pending', cleared_at=NULL, cleared_by=NULL, remarks=NULL WHERE clearance_request_id=?");
    $stmt->bind_param("i", $req['id']);
    $stmt->execute();

    log_audit($conn, $patient_id, $patient, "Admin - Returned to Clearance", $actor, $remarks);

    fetchAndBroadcastPatients($conn, 'Billing', $today);
    fetchAndBroadcastPatients($conn, 'Nurse', $today);
    fetchAndBroadcastPatients($conn, 'Admin', $today);

    echo json_encode(["success" => true, "message" => "Patient returned to clearance processing."]);
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

    log_audit($conn, $patient_id, $patient, "Nurse - Discharge Cancelled", $actor, $remarks);
    
    // Broadcast update to all dashboards
    fetchAndBroadcastPatients($conn, 'Billing', $today);
    fetchAndBroadcastPatients($conn, 'Nurse', $today);
    fetchAndBroadcastPatients($conn, 'Admin', $today);
    
    echo json_encode(["success" => true, "message" => "Discharge process cancelled. Patient reset to admitted."]);
    exit();
}

// RECLEARANCE: Nurse Re-initiate Clearance for Discharged Patient
if ($action === 'reclearance') {
    $req = get_request($conn, $patient_id);

    if (!$req) {
        echo json_encode(["success" => false, "message" => "No clearance record found for this patient."]);
        exit();
    }
    if ($req['final_status'] !== 'discharged') {
        echo json_encode(["success" => false, "message" => "Patient is not discharged. Only discharged patients can be re-cleared."]);
        exit();
    }

    $request_id = $req['id'];

    // Delete old cost center clearances
    $stmt = $conn->prepare("DELETE FROM cost_center_clearances WHERE clearance_request_id = ?");
    $stmt->bind_param("i", $request_id);
    $stmt->execute();

    // Delete the old clearance request
    $stmt2 = $conn->prepare("DELETE FROM clearance_requests WHERE id = ?");
    $stmt2->bind_param("i", $request_id);
    $stmt2->execute();

    // Create new clearance request starting from "may_go_home"
    $stmt3 = $conn->prepare("INSERT INTO clearance_requests (patient_id, nurse_status, nurse_cleared_at, nurse_cleared_by) VALUES (?, 'may_go_home', ?, ?)");
    $stmt3->bind_param("iss", $patient_id, $now, $actor);
    $stmt3->execute();

    log_audit($conn, $patient_id, $patient, "Nurse - Reclearance Initiated", $actor, $remarks);
    notify($conn, "Billing", $patient_id, $patient, "Patient " . $patient["full_name"] . " (" . $patient["patient_no"] . ") needs reclearance (readmitted).");
    
    // Broadcast update to all dashboards
    fetchAndBroadcastPatients($conn, 'Billing', $today);
    fetchAndBroadcastPatients($conn, 'Nurse', $today);
    fetchAndBroadcastPatients($conn, 'Admin', $today);
    
    echo json_encode(["success" => true, "message" => "Patient reclearance initiated. Ready for billing review."]);
    exit();
}

echo json_encode(["success" => false, "message" => "Unknown action."]);
?>

