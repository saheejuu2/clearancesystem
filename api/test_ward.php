<?php
ob_start(); mysqli_report(MYSQLI_REPORT_OFF); include 'db_config.php'; ob_end_clean();
header("Content-Type: application/json");
$hp = '000000000244620';
$r1 = $remote_conn->query("SELECT tscode, admtxt, admdate FROM hadmlog WHERE hpercode = '$hp' LIMIT 3");
$admlog = $r1 ? $r1->fetch_all(MYSQLI_ASSOC) : ["err" => $remote_conn->error];
$r2 = $remote_conn->query("SELECT enccode, toecode, encdate, acctno FROM henctr WHERE hpercode = '$hp' ORDER BY encdate DESC LIMIT 3");
$enc = $r2 ? $r2->fetch_all(MYSQLI_ASSOC) : [];
echo json_encode(["hadmlog" => $admlog, "henctr" => $enc]);
?>
