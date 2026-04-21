<?php
ob_start(); mysqli_report(MYSQLI_REPORT_OFF); include 'db_config.php'; ob_end_clean();
header("Content-Type: application/json");

if (!$remote_conn) { echo json_encode(["error" => "no remote"]); exit; }

$date = isset($_GET['date']) ? $conn->real_escape_string($_GET['date']) : date('Y-m-d');
$rdate = $remote_conn->real_escape_string($date);

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
    if (!empty($p['ward']) && strlen($p['ward']) > 20) {
        // Already has enccode — just update ward_name if missing
        $enccode = $remote_conn->real_escape_string($p['ward']);
        $rw = $remote_conn->query("
            SELECT w.wardname FROM hpatroom pr
            JOIN hward w ON w.wardcode = pr.wardcode
            WHERE pr.enccode = '$enccode'
            ORDER BY pr.datemod DESC LIMIT 1
        ");
        if ($rw) {
            $wrow = $rw->fetch_assoc();
            if ($wrow && !empty($wrow['wardname'])) {
                $wname = $conn->real_escape_string($wrow['wardname']);
                $conn->query("UPDATE patients SET ward_name = '$wname' WHERE id = {$p['id']} AND (ward_name IS NULL OR ward_name = '')");
            }
        }
        continue;
    }

    $pno = $remote_conn->real_escape_string($p['patient_no']);
    $r2 = $remote_conn->query("
        SELECT e.enccode, e.toecode,
               w.wardname,
               al.admtxt
        FROM henctr e
        LEFT JOIN hpatroom pr ON pr.enccode = e.enccode
        LEFT JOIN hward w ON w.wardcode = pr.wardcode
        LEFT JOIN hadmlog al ON al.enccode = e.enccode
        WHERE (e.acctno = '$pno' OR e.hpercode = '$pno') AND DATE(e.encdate) = '$rdate'
        ORDER BY e.encdate DESC, pr.datemod DESC LIMIT 1
    ");
    if (!$r2) continue;
    $row = $r2->fetch_assoc();
    if (!$row) continue;

    $enccode = $conn->real_escape_string($row['enccode']);
    $newType = mapToecode($row['toecode']);
    $wname   = $conn->real_escape_string($row['wardname'] ?? '');
    $dx      = $conn->real_escape_string($row['admtxt'] ?? '');
    $id = (int)$p['id'];

    $conn->query("UPDATE patients SET ward = '$enccode', patient_type = '$newType', ward_name = '$wname', admitting_dx = IF('$dx' != '', '$dx', admitting_dx) WHERE id = $id");
    if ($conn->affected_rows > 0) $updated++;
}

echo json_encode(["success" => true, "date" => $date, "checked" => count($patients), "updated" => $updated]);
?>
