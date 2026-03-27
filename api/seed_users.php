<?php
// Run ONCE to seed one admin per department. DELETE this file after running.
include 'db_config.php';

$hash = password_hash('costcenter123', PASSWORD_DEFAULT);

$users = [
    ['lab_admin',    'Lab Admin',              'Laboratory',            'admin'],
    ['ward_admin',   'Ward Admin',             'Ward',                  'admin'],
    ['rad_admin',    'Radiology Admin',        'Radiology',             'admin'],
    ['rt_admin',     'Radio Therapy Admin',    'Radio Therapy',         'admin'],
    ['proc_admin',   'Procedure Admin',        'Procedure',             'admin'],
    ['pt_admin',     'Physical Therapy Admin', 'Physical Therapy',      'admin'],
    ['pharma_admin', 'Pharmacy Admin',         'Pharmacy',              'admin'],
    ['opd_admin',    'OPD Admin',              'Out Patient Department','admin'],
    ['paren_admin',  'Parenatal Admin',        'Parenatal',             'admin'],
    ['opth_admin',   'Opthalmology Admin',     'Opthalmology',          'admin'],
    ['or_admin',     'OR Admin',               'Operating Room',        'admin'],
    ['nm_admin',     'Nuclear Med Admin',      'Nuclear Medicine',      'admin'],
    ['neuro_admin',  'Neurology Admin',        'Neurology',             'admin'],
    ['er_admin',     'ER Admin',               'Emergency Room',        'admin'],
    ['derm_admin',   'Dermatology Admin',      'Dermatology',           'admin'],
    ['dental_admin', 'Dental Admin',           'Dental',                'admin'],
    ['csr_admin',    'CSR Admin',              'Central Supply Room',   'admin'],
    ['dr_admin',     'Delivery Room Admin',    'Delivery Room',         'admin'],
    ['billing_admin','Billing Admin',          'Billing',               'admin'],
    ['nurse_admin',  'Nurse Admin',            'Nurse',                 'admin'],
];

$stmt = $conn->prepare("INSERT IGNORE INTO users (username, password_hash, full_name, cost_center, role) VALUES (?, ?, ?, ?, ?)");

foreach ($users as [$username, $full_name, $cost_center, $role]) {
    $stmt->bind_param("sssss", $username, $hash, $full_name, $cost_center, $role);
    $stmt->execute();
    echo "Inserted: $username ($cost_center) [$role]<br>";
}

$stmt->close();
$conn->close();
echo "<br>Done. Delete this file now.";
?>
