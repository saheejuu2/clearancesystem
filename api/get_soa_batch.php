<?php
error_reporting(0);
ini_set('display_errors', 0);
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

include 'db_config.php';
include '_cc_map.php';

$data        = json_decode(file_get_contents("php://input"), true);
$patient_nos = $data['patient_nos'] ?? [];
$cost_center = trim($data['cost_center'] ?? '');

if (empty($patient_nos) || !$cost_center) {
    echo json_encode(["success" => false, "message" => "Missing params"]);
    exit;
}

if (!$remote_conn) {
    echo json_encode(["success" => false, "message" => "No remote DB"]);
    exit;
}

$codes = $CC_CHRGCODE_MAP[$cost_center] ?? [];
if (empty($codes)) {
    echo json_encode(["success" => true, "amounts" => []]);
    exit;
}

$placeholders = implode(',', array_map(fn($c) => "'".$remote_conn->real_escape_string($c)."'", $codes));
$escaped  = array_map(fn($p) => "'".$remote_conn->real_escape_string(trim($p))."'", $patient_nos);
$in_list  = implode(',', $escaped);

// Get latest active enccode per patient
$r = $remote_conn->query("
    SELECT hpercode, enccode
    FROM hpatacct
    WHERE hpercode IN ($in_list) AND pastat = 'A'
    ORDER BY padteas DESC
");

if (!$r) {
    echo json_encode(["success" => false, "message" => $remote_conn->error]);
    exit;
}

$enc_map = [];
while ($row = $r->fetch_assoc()) {
    if (!isset($enc_map[$row['hpercode']])) {
        $enc_map[$row['hpercode']] = $row['enccode'];
    }
}

if (empty($enc_map)) {
    echo json_encode(["success" => true, "amounts" => []]);
    exit;
}

$enc_escaped = array_map(fn($e) => "'".$remote_conn->real_escape_string($e)."'", array_values($enc_map));
$enc_in = implode(',', $enc_escaped);

$r2 = $remote_conn->query("
    SELECT pa.hpercode, hc.chrgdesc, COALESCE(SUM(pc.pcchrgamt), 0) as subtotal
    FROM hpatacct pa
    INNER JOIN hpatchrg pc ON pc.enccode = pa.enccode
    INNER JOIN hcharge hc ON hc.chrgcode = pc.chargcode
    WHERE pa.enccode IN ($enc_in)
      AND pa.pastat = 'A'
      AND pc.pcstat = 'A'
      AND hc.chrgcode IN ($placeholders)
    GROUP BY pa.hpercode, hc.chrgdesc
    ORDER BY pa.hpercode, subtotal DESC
");

if (!$r2) {
    echo json_encode(["success" => false, "message" => $remote_conn->error]);
    exit;
}

$amounts = [];
$breakdowns = [];
while ($row = $r2->fetch_assoc()) {
    $hper = $row['hpercode'];
    $sub  = (float)$row['subtotal'];
    $amounts[$hper]    = ($amounts[$hper] ?? 0) + $sub;
    $breakdowns[$hper][] = ["desc" => $row['chrgdesc'], "amount" => $sub];
}

echo json_encode(["success" => true, "amounts" => $amounts, "breakdowns" => $breakdowns]);
?>
