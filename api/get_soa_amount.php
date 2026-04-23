<?php
error_reporting(0);
ini_set('display_errors', 0);
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
include 'db_config.php';
include '_cc_map.php';

$patient_no  = isset($_GET['patient_no'])  ? trim($_GET['patient_no'])  : '';
$cost_center = isset($_GET['cost_center']) ? trim($_GET['cost_center']) : '';

if (!$patient_no || !$cost_center) {
    echo json_encode(["success" => false, "amount" => null, "message" => "Missing params"]);
    exit;
}

if (!$remote_conn) {
    echo json_encode(["success" => false, "amount" => null, "message" => "No remote DB"]);
    exit;
}

$codes = $CC_CHRGCODE_MAP[$cost_center] ?? [];

if (empty($codes)) {
    echo json_encode(["success" => true, "amount" => null, "message" => "No charge code mapping for this cost center"]);
    exit;
}

$hpercode = $remote_conn->real_escape_string($patient_no);
$r = $remote_conn->query("
    SELECT enccode FROM hpatacct
    WHERE hpercode = '$hpercode' AND pastat = 'A'
    ORDER BY padteas DESC LIMIT 1
");

if (!$r || $r->num_rows === 0) {
    echo json_encode(["success" => true, "amount" => 0, "message" => "No account found"]);
    exit;
}

$row = $r->fetch_assoc();
$enccode = $remote_conn->real_escape_string($row['enccode']);
$placeholders = implode(',', array_map(fn($c) => "'".$remote_conn->real_escape_string($c)."'", $codes));

$r2 = $remote_conn->query("
    SELECT hc.chrgdesc, COALESCE(SUM(pc.pcchrgamt), 0) as subtotal
    FROM hpatchrg pc
    INNER JOIN hcharge hc ON hc.chrgcode = pc.chargcode
    WHERE pc.enccode = '$enccode'
      AND pc.pcstat = 'A'
      AND hc.chrgcode IN ($placeholders)
    GROUP BY hc.chrgdesc
    ORDER BY subtotal DESC
");

if (!$r2) {
    echo json_encode(["success" => false, "amount" => null, "message" => $remote_conn->error]);
    exit;
}

$total = 0;
$breakdown = [];
while ($row = $r2->fetch_assoc()) {
    $subtotal = (float)$row['subtotal'];
    if ($subtotal > 0) {
        $breakdown[] = ["desc" => $row['chrgdesc'], "amount" => $subtotal];
        $total += $subtotal;
    }
}

echo json_encode(["success" => true, "amount" => $total, "breakdown" => $breakdown]);
?>
