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
           w.wardname,
           (
               SELECT CONCAT_WS(' / ', NULLIF(TRIM(rm.rmname),''), NULLIF(TRIM(bd.bdname),''))
               FROM hpatroom pr
               LEFT JOIN hroom rm ON rm.rmintkey = pr.rmintkey
               LEFT JOIN hbed  bd ON bd.bdintkey = pr.bdintkey
               WHERE pr.enccode = e.enccode AND pr.patrmstat = 'A'
               ORDER BY pr.datemod DESC LIMIT 1
           ) AS room_bed,
           (
               SELECT al.admtxt FROM hadmlog al
               WHERE al.enccode = e.enccode
                 AND al.admtxt IS NOT NULL AND al.admtxt != '' AND al.admtxt != '.'
               ORDER BY al.admdate DESC LIMIT 1
           ) AS admtxt,
           (
               SELECT ts.tsdesc FROM hadmlog al LEFT JOIN htypser ts ON ts.tscode = al.tscode
               WHERE al.enccode = e.enccode AND al.tscode IS NOT NULL AND al.tscode != ''
               ORDER BY al.admdate DESC LIMIT 1
           ) AS service_type,
           (
               SELECT al.tacode FROM hadmlog al
               WHERE al.enccode = e.enccode AND al.tacode IS NOT NULL AND al.tacode != ''
               ORDER BY al.admdate DESC LIMIT 1
           ) AS accom_type
    FROM henctr e
    JOIN hperson p ON p.hpercode = e.hpercode
    LEFT JOIN hward w ON w.wardcode = (
        SELECT pr2.wardcode FROM hpatroom pr2
        WHERE pr2.enccode = e.enccode
        ORDER BY pr2.datemod DESC LIMIT 1
    )
    WHERE DATE(e.encdate) = '$rdate'
      AND e.encstat IN ('A','I')
";

$result = $remote_conn->query($sql);
if (!$result) { echo json_encode(["synced" => 0, "error" => $remote_conn->error]); exit; }

$synced = 0;
while ($row = $result->fetch_assoc()) {
    $hpercode   = $conn->real_escape_string($row['hpercode']);
    $enccode    = $conn->real_escape_string($row['enccode']);
    $full_name  = $conn->real_escape_string(trim($row['patlast'] . ', ' . $row['patfirst'] . ' ' . $row['patmiddle']));
    $ward_name  = $conn->real_escape_string($row['wardname'] ?? '');
    $room_bed   = $conn->real_escape_string($row['room_bed'] ?? '');
    $admtxt     = $conn->real_escape_string($row['admtxt'] ?? '');
    $service_type = $conn->real_escape_string($row['service_type'] ?? '');
    $raw_accom  = strtoupper(trim($row['accom_type'] ?? ''));
    $accom_type = $conn->real_escape_string(
        $raw_accom === 'ADPAY' ? 'Pay' : ($raw_accom === 'SERVI' ? 'Service' : $row['accom_type'] ?? '')
    );
    $admit_date = date('Y-m-d', strtotime($row['encdate']));
    $ptype      = mapToecode($row['toecode']);

    // Calculate age from birthdate
    $age = 0;
    $patbdate_val = 'NULL';
    if (!empty($row['patbdate'])) {
        try {
            $bdate = new DateTime($row['patbdate']);
            $age = (int)$bdate->diff(new DateTime())->y;
            $patbdate_val = "'" . date('Y-m-d', strtotime($row['patbdate'])) . "'";
        } catch (Exception $e) { $age = 0; }
    }

    $conn->query("
        INSERT INTO patients (patient_no, full_name, age, patbdate, ward, ward_name, room_bed, admitting_dx, admit_date, patient_type, service_type, accom_type)
        VALUES ('$hpercode', '$full_name', $age, $patbdate_val, '$ward_name', '$ward_name', '$room_bed', '$admtxt', '$admit_date', '$ptype', '$service_type', '$accom_type')
        ON DUPLICATE KEY UPDATE
            full_name    = VALUES(full_name),
            age          = VALUES(age),
            patbdate     = IF(VALUES(patbdate) IS NOT NULL, VALUES(patbdate), patbdate),
            ward         = IF(ward IS NULL OR ward = '', VALUES(ward), ward),
            ward_name    = IF(VALUES(ward_name) != '', VALUES(ward_name), ward_name),
            room_bed     = IF(VALUES(room_bed) != '', VALUES(room_bed), room_bed),
            admitting_dx = IF(VALUES(admitting_dx) != '', VALUES(admitting_dx), admitting_dx),
            patient_type = VALUES(patient_type),
            service_type = IF(VALUES(service_type) != '', VALUES(service_type), service_type),
            accom_type   = IF(VALUES(accom_type) != '', VALUES(accom_type), accom_type)
    ");
    if ($conn->affected_rows > 0) $synced++;
}

echo json_encode(["synced" => $synced, "date" => $date]);
?>
