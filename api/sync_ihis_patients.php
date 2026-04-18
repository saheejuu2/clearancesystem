<?php
ob_start(); mysqli_report(MYSQLI_REPORT_OFF); include 'db_config.php'; ob_end_clean();
header("Content-Type: application/json");

if (!$remote_conn) { echo json_encode(["synced" => 0, "error" => "no remote"]); exit; }

$date  = isset($_GET['date']) ? $conn->real_escape_string($_GET['date']) : date('Y-m-d');
$rdate = $remote_conn->real_escape_string($date);

function mapToecode($toecode) {
    $t = strtoupper(trim($toecode ?? ''));
    if ($t === 'ER' || $t === 'ERADM') return 'er';
    if ($t === 'OPD' || $t === 'OPDAD') return 'opd';
    return 'in-patient';
}

// Pull admitted patients from host DB for the given date
$sql = "
    SELECT e.hpercode, e.enccode, e.toecode, e.encdate,
           p.patlast, p.patfirst, p.patmiddle, p.patsex, p.patbdate,
           w.wardname
    FROM henctr e
    JOIN hperson p ON p.hpercode = e.hpercode
    LEFT JOIN hward w ON w.wardcode = (
        SELECT pr.wardcode FROM hpatroom pr
        WHERE pr.enccode = e.enccode
        ORDER BY pr.datemod DESC LIMIT 1
    )
    WHERE DATE(e.encdate) = '$rdate'
      AND e.encstat IN ('A','I')
";

$result = $remote_conn->query($sql);
if (!$result) { echo json_encode(["synced" => 0, "error" => $remote_conn->error]); exit; }

$synced = 0;
while ($row = $result->fetch_assoc()) {
    $hpercode  = $conn->real_escape_string($row['hpercode']);
    $full_name = $conn->real_escape_string(trim($row['patlast'] . ', ' . $row['patfirst'] . ' ' . $row['patmiddle']));
    $ward      = $conn->real_escape_string($row['wardname'] ?? '');
    $admit_date = date('Y-m-d', strtotime($row['encdate']));
    $ptype     = mapToecode($row['toecode']);

    // Calculate age from birthdate
    $age = 0;
    if (!empty($row['patbdate'])) {
        try {
            $bdate = new DateTime($row['patbdate']);
            $age = (int)$bdate->diff(new DateTime())->y;
        } catch (Exception $e) { $age = 0; }
    }

    $conn->query("
        INSERT INTO patients (patient_no, full_name, age, ward, admit_date, patient_type)
        VALUES ('$hpercode', '$full_name', $age, '$ward', '$admit_date', '$ptype')
        ON DUPLICATE KEY UPDATE
            full_name    = VALUES(full_name),
            age          = VALUES(age),
            ward         = IF(ward IS NULL OR ward = '', VALUES(ward), ward),
            patient_type = VALUES(patient_type)
    ");
    if ($conn->affected_rows > 0) $synced++;
}

echo json_encode(["synced" => $synced, "date" => $date]);
?>
