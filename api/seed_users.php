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
    ['or_dr',     'OR/DR Staff',              'Operating Room/Delivery Room', 'staff'],
    ['pulmo',     'Pulmonary Staff',           'Pulmonary Department (MSA)',   'staff'],
    ['hemo',      'Hemodialysis Staff',        'Hemodialysis Unit',            'staff'],
    ['nbs',       'Newborn Screening Staff',   'Newborn Screening',            'staff'],
    ['nht',       'Newborn Hearing Staff',     'Newborn Hearing Test',         'staff'],
    ['radiology', 'Radiology Staff',           'Radiology',                    'staff'],
    ['laboratory','Laboratory Staff',          'Laboratory',                   'staff'],
    ['bloodbank', 'Bloodbank Staff',           'Bloodbank',                    'staff'],
    ['pharmacy',  'Pharmacy Staff',            'Pharmacy',                     'staff'],
    ['benefits',  'Benefits Staff',            'Benefits',                     'staff'],
    ['billing',   'Billing Staff',             'Billing',                      'staff'],
    ['nurse',     'Nurse Staff',               'Nurse',                        'staff'],
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
