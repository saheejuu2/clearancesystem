<?php
ob_start(); mysqli_report(MYSQLI_REPORT_OFF); include 'db_config.php'; ob_end_clean();
header("Content-Type: application/json");

if (!$remote_conn) { echo json_encode(["error" => "no remote"]); exit; }

$hpercode = isset($_GET['hpercode']) ? $remote_conn->real_escape_string($_GET['hpercode']) : '';
$enccode  = isset($_GET['enccode'])  ? $remote_conn->real_escape_string($_GET['enccode'])  : '';

if (!$hpercode) { echo json_encode(["error" => "hpercode required"]); exit; }

// Get person details
$r = $remote_conn->query("
    SELECT p.hpercode, p.patlast, p.patfirst, p.patmiddle, p.patsex, p.patbdate, p.pattelno,
           e.toecode, e.encdate, e.enctime, e.enccode AS enc,
           w.wardname,
           (SELECT diagtext FROM hencdiag
            WHERE enccode = e.enccode AND tdcode = 'ADMDX' AND edstat = 'A'
            ORDER BY encdate ASC LIMIT 1) AS admtxt,
           a.patstr, b.bgyname, c.ctyname,
           (SELECT pattel FROM htelep
            WHERE hpercode = p.hpercode AND ptlstat = 'A'
            ORDER BY ptdteas DESC LIMIT 1) AS contact
    FROM hperson p
    LEFT JOIN henctr e ON e.hpercode = p.hpercode
        AND (e.enccode = '$enccode' OR '$enccode' = '')
    LEFT JOIN hward w ON w.wardcode = (
        SELECT pr.wardcode FROM hpatroom pr
        WHERE pr.enccode = e.enccode
        ORDER BY pr.datemod DESC LIMIT 1
    )
    LEFT JOIN haddr a ON a.hpercode = p.hpercode AND a.addstat = 'A'
    LEFT JOIN hbrgy b ON b.bgycode = a.brg
    LEFT JOIN hcity c ON c.ctycode = a.ctycode
    WHERE p.hpercode = '$hpercode'
    ORDER BY e.encdate DESC
    LIMIT 1
");

if (!$r) { echo json_encode(["error" => $remote_conn->error]); exit; }
$row = $r->fetch_assoc();
if (!$row) { echo json_encode(["person" => null]); exit; }

echo json_encode([
    "person" => [
        "hpercode"  => $row['hpercode'],
        "patlast"   => $row['patlast'],
        "patfirst"  => $row['patfirst'],
        "patmiddle" => $row['patmiddle'],
        "patsex"    => $row['patsex'],
        "patbdate"  => $row['patbdate'],
        "pattelno"  => $row['pattelno'],
        "wardname"  => $row['wardname'],
        "toecode"   => $row['toecode'],
        "admtime"   => $row['enctime'],
        "admtxt"    => $row['admtxt'] ?? '—',
        "address"   => trim(implode(', ', array_filter([
                            $row['patstr'] ?? '',
                            $row['bgyname'] ?? '',
                            $row['ctyname'] ?? '',
                        ]))),
        "contact"   => $row['contact'] ?? ($row['pattelno'] ?? '—'),
    ]
]);
?>
