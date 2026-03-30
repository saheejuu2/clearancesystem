<?php
// Run ONCE to seed users. DELETE this file after running.
include 'db_config.php';

$staffHash = password_hash('costcenter123', PASSWORD_DEFAULT);
$adminHash = password_hash('admin123', PASSWORD_DEFAULT);

// Seed admin account
$stmt = $conn->prepare("INSERT IGNORE INTO users (username, password_hash, full_name, cost_center, role) VALUES (?, ?, ?, ?, ?)");
$adminUser = ['admin', $adminHash, 'System Administrator', 'Admin', 'admin'];
$stmt->bind_param("sssss", $adminUser[0], $adminUser[1], $adminUser[2], $adminUser[3], $adminUser[4]);
$stmt->execute();
echo "Inserted: admin (System Administrator)<br>";

// Seed / reset cost center accounts as staff
$users = [
    ['or_dr',       'OR/DR Staff',              'Operating Room/Delivery Room', 'staff'],
    ['pulmo',       'Pulmonary Staff',           'Pulmonary Department (MSA)',   'staff'],
    ['hemo',        'Hemodialysis Staff',        'Hemodialysis Unit',            'staff'],
    ['nbs',         'Newborn Screening Staff',   'Newborn Screening',            'staff'],
    ['nht',         'Newborn Hearing Staff',     'Newborn Hearing Test',         'staff'],
    ['radiology',   'Radiology Staff',           'Radiology',                    'staff'],
    ['laboratory',  'Laboratory Staff',          'Laboratory',                   'staff'],
    ['bloodbank',   'Bloodbank Staff',           'Bloodbank',                    'staff'],
    ['pharmacy',    'Pharmacy Staff',            'Pharmacy',                     'staff'],
    // Billing windows
    ['billing_w1',  'Billing Window 1 Staff',    'Billing - Window 1',           'staff'],
    ['billing_w2',  'Billing Window 2 Staff',    'Billing - Window 2',           'staff'],
    // Benefits windows
    ['benefits_3a', 'Benefits Window 3A Staff',  'Benefits - Window 3A',         'staff'],
    ['benefits_3b', 'Benefits Window 3B Staff',  'Benefits - Window 3B',         'staff'],
    ['benefits_6',  'Benefits Window 6 Staff',   'Benefits - Window 6',          'staff'],
    // Keep legacy accounts
    ['billing',     'Billing Staff',             'Billing',                      'staff'],
    ['nurse',       'Nurse Staff',               'Nurse',                        'staff'],
];

foreach ($users as [$username, $full_name, $cost_center, $role]) {
    $stmt->bind_param("sssss", $username, $staffHash, $full_name, $cost_center, $role);
    $stmt->execute();
    // Also update role if already exists
    $upd = $conn->prepare("UPDATE users SET role=? WHERE username=?");
    $upd->bind_param("ss", $role, $username);
    $upd->execute();
    echo "Inserted/Updated: $username ($cost_center) as $role<br>";
}

$stmt->close();
$conn->close();
echo "<br>Done. Delete this file now.";
?>
