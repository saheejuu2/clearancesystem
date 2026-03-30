<?php
// Run ONCE to seed one admin per department. DELETE this file after running.
include 'db_config.php';

$hash = password_hash('costcenter123', PASSWORD_DEFAULT);

$users = [
    ['or_dr',     'OR/DR Staff',              'Operating Room/Delivery Room', 'admin'],
    ['pulmo',     'Pulmonary Staff',           'Pulmonary Department (MSA)',   'admin'],
    ['hemo',      'Hemodialysis Staff',        'Hemodialysis Unit',            'admin'],
    ['nbs',       'Newborn Screening Staff',   'Newborn Screening',            'admin'],
    ['nht',       'Newborn Hearing Staff',     'Newborn Hearing Test',         'admin'],
    ['radiology', 'Radiology Staff',           'Radiology',                    'admin'],
    ['laboratory','Laboratory Staff',          'Laboratory',                   'admin'],
    ['bloodbank', 'Bloodbank Staff',           'Bloodbank',                    'admin'],
    ['pharmacy',  'Pharmacy Staff',            'Pharmacy',                     'admin'],
    ['benefits',  'Benefits Staff',            'Benefits',                     'admin'],
    ['billing',   'Billing Staff',             'Billing',                      'admin'],
    ['nurse',     'Nurse Staff',               'Nurse',                        'admin'],
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
