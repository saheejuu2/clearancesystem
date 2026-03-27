<?php
// Run ONCE to seed one admin per department. DELETE this file after running.
include 'db_config.php';

$hash = password_hash('costcenter123', PASSWORD_DEFAULT);

$users = [
    ['or_dr_admin',   'OR/DR Admin',              'Operating Room/Delivery Room', 'admin'],
    ['pulmo_admin',   'Pulmonary Admin',           'Pulmonary Department (MSA)',   'admin'],
    ['hemo_admin',    'Hemodialysis Admin',        'Hemodialysis Unit',            'admin'],
    ['nbs_admin',     'Newborn Screening Admin',   'Newborn Screening',            'admin'],
    ['nht_admin',     'Newborn Hearing Admin',     'Newborn Hearing Test',         'admin'],
    ['rad_admin',     'Radiology Admin',           'Radiology',                    'admin'],
    ['lab_admin',     'Laboratory Admin',          'Laboratory',                   'admin'],
    ['bb_admin',      'Bloodbank Admin',           'Bloodbank',                    'admin'],
    ['pharma_admin',  'Pharmacy Admin',            'Pharmacy',                     'admin'],
    ['benefits_admin','Benefits Admin',            'Benefits',                     'admin'],
    ['billing_admin', 'Billing Admin',             'Billing',                      'admin'],
    ['nurse_admin',   'Nurse Admin',               'Nurse',                        'admin'],
];

$stmt = $conn->prepare("INSERT IGNORE INTO users (username, password_hash, full_name, cost_center, role) VALUES (?, ?, ?, ?, ?)");

foreach ($users as [$username, $full_name, $cost_center, $role]) {
    $stmt->bind_param("sssss", $username, $hash, $full_name, $cost_center, $role);
    $stmt->execute();
    echo "Inserted: $username ($cost_center)<br>";
}

$stmt->close();
$conn->close();
echo "<br>Done. Delete this file now.";
?>
