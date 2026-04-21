<?php
ob_start(); mysqli_report(MYSQLI_REPORT_OFF); include 'db_config.php'; ob_end_clean();
header("Content-Type: application/json");

if (!$remote_conn) { echo json_encode(["error" => "no remote"]); exit; }

$hpercode = isset($_GET['hpercode']) ? $remote_conn->real_escape_string($_GET['hpercode']) : '';
$enccode  = isset($_GET['enccode'])  ? $remote_conn->real_escape_string($_GET['enccode'])  : '';

if (!$hpercode) { echo json_encode(["error" => "hpercode required"]); exit; }

// Query 1: Person + address (always returns if patient exists)
$r = $remote_conn->query("
    SELECT p.hpercode, p.patlast, p.patfirst, p.patmiddle, p.patsex, p.patbdate, p.pattelno,
           a.patstr, b.bgyname, c.ctyname,
           (SELECT pattel FROM htelep
            WHERE hpercode = p.hpercode AND ptlstat = 'A'
            ORDER BY ptdteas DESC LIMIT 1) AS contact
    FROM hperson p
    LEFT JOIN haddr a ON a.hpercode = p.hpercode AND a.addstat = 'A'
    LEFT JOIN hbrgy b ON b.bgycode = a.brg
    LEFT JOIN hcity c ON c.ctycode = a.ctycode
    WHERE p.hpercode = '$hpercode'
    LIMIT 1
");

if (!$r) { echo json_encode(["error" => $remote_conn->error]); exit; }
$person = $r->fetch_assoc();
if (!$person) { echo json_encode(["person" => null]); exit; }

// Query 2: Encounter data (optional — may not exist)
$enc = null;
$encWhere = $enccode ? "e.enccode = '$enccode'" : "e.hpercode = '$hpercode'";
$r2 = $remote_conn->query("
    SELECT e.toecode, e.encdate, e.enctime, e.enccode,
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
           ) AS admtxt
    FROM henctr e
    LEFT JOIN hward w ON w.wardcode = (
        SELECT pr2.wardcode FROM hpatroom pr2
        WHERE pr2.enccode = e.enccode
        ORDER BY pr2.datemod DESC LIMIT 1
    )
    WHERE $encWhere
    ORDER BY e.encdate DESC
    LIMIT 1
");
if ($r2) $enc = $r2->fetch_assoc();

// Fallback: try hadmlog by hpercode if admtxt is empty
if (empty($enc['admtxt'])) {
    $r3 = $remote_conn->query("
        SELECT admtxt FROM hadmlog
        WHERE hpercode = '$hpercode' AND admtxt IS NOT NULL AND admtxt != '' AND admtxt != '.'
        ORDER BY admdate DESC LIMIT 1
    ");
    if ($r3) {
        $row3 = $r3->fetch_assoc();
        if ($row3 && $enc) $enc['admtxt'] = $row3['admtxt'];
        elseif ($row3) $enc = ['admtxt' => $row3['admtxt']];
    }
}

echo json_encode([
    "person" => [
        "hpercode"  => $person['hpercode'],
        "patlast"   => $person['patlast'],
        "patfirst"  => $person['patfirst'],
        "patmiddle" => $person['patmiddle'],
        "patsex"    => $person['patsex'],
        "patbdate"  => $person['patbdate'],
        "pattelno"  => $person['pattelno'],
        "wardname"  => $enc['wardname'] ?? null,
        "room_bed"  => $enc['room_bed'] ?? null,
        "toecode"   => $enc['toecode'] ?? null,
        "admtime"   => $enc['enctime'] ?? null,
        "admtxt"    => $enc['admtxt'] ?? '—',
        "address"   => trim(implode(', ', array_filter([
                            $person['patstr'] ?? '',
                            $person['bgyname'] ?? '',
                            $person['ctyname'] ?? '',
                        ]))),
        "contact"   => $person['contact'] ?? ($person['pattelno'] ?? '—'),
    ]
]);
?>
