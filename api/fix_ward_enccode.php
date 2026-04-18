<?php
ob_start(); mysqli_report(MYSQLI_REPORT_OFF); include 'db_config.php'; ob_end_clean();
header("Content-Type: application/json");

if (!$remote_conn) { echo json_encode(["error" => "no remote"]); exit; }

$date = isset($_GET['date']) ? $conn->real_escape_string($_GET['date']) : date('Y-m-d');
$rdate = $remote_conn->real_escape_string($date);

// Get all patients for this date from local DB
$r1 = $conn->query("SELECT id, patient_no, ward, patient_type FROM patients WHERE admit_date = '$date'");
$patients = $r1 ? $r1->fetch_all(MYSQLI_ASSOC) : [];

function mapToecode($toecode) {
    $t = strtoupper(trim($toecode ?? ''));
    if ($t === 'ER' || $t === 'ERADM') return 'er';
    if ($t === 'OPD' || $t === 'OPDAD') return 'opd';
    return 'in-patient';
}

$updated = 0;
foreach ($patients as $p) {
    if (!empty($p['ward']) && strlen($p['ward']) > 20) continue; // already has enccode

    $pno = $remote_conn->real_escape_string($p['patient_no']);

    $r2 = $remote_conn->query("SELECT enccode, toecode FROM henctr WHERE (acctno = '$pno' OR hpercode = '$pno') AND DATE(encdate) = '$rdate' ORDER BY encdate DESC LIMIT 1");
    if (!$r2) continue;
    $row = $r2->fetch_assoc();
    if (!$row) continue;

    $enccode = $conn->real_escape_string($row['enccode']);
    $newType = mapToecode($row['toecode']);
    $id = (int)$p['id'];

    $conn->query("UPDATE patients SET ward = '$enccode', patient_type = '$newType' WHERE id = $id");
    if ($conn->affected_rows > 0) $updated++;
}

echo json_encode(["success" => true, "date" => $date, "checked" => count($patients), "updated" => $updated]);
?>
