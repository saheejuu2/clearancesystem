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
           e.toecode, e.encdate, e.enctime,
           w.wardname
    FROM hperson p
    LEFT JOIN henctr e ON e.hpercode = p.hpercode
        AND (e.enccode = '$enccode' OR '$enccode' = '')
    LEFT JOIN hward w ON w.wardcode = (
        SELECT pr.wardcode FROM hpatroom pr
        WHERE pr.enccode = e.enccode
        ORDER BY pr.datemod DESC LIMIT 1
    )
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
        "admtxt"    => $row['toecode'],
    ]
]);
?>
