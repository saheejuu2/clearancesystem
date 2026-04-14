<?php
/**
 * Helper functions to trigger WebSocket broadcasts
 * Call these functions after updating patient data to notify all connected clients
 */

/**
 * Broadcast patient update to all subscribed clients
 * @param string $role - User role/cost center (e.g., 'Nurse', 'Billing', 'Radiology')
 * @param string $date - Date in YYYY-MM-DD format
 * @param array $patients - Array of patient data to broadcast
 */
function broadcastPatientUpdate($role, $date, $patients) {
  $wsHost = getenv('WS_HOST') ?: 'localhost';
  $wsPort = getenv('WS_PORT') ?: 8080;
  $wsUrl = "http://{$wsHost}:{$wsPort}/broadcast";

  $payload = json_encode([
    'role' => $role,
    'date' => $date,
    'patients' => $patients
  ]);

  $ch = curl_init($wsUrl);
  curl_setopt($ch, CURLOPT_POST, 1);
  curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
  curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
  curl_setopt($ch, CURLOPT_TIMEOUT, 2);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

  $response = curl_exec($ch);
  $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  if ($httpCode !== 200) {
    error_log("WebSocket broadcast failed for {$role}:{$date} - HTTP {$httpCode}");
    return false;
  }

  return true;
}

/**
 * Broadcast to all roles for a specific date
 * Useful when a patient update affects multiple departments
 */
function broadcastToAllRoles($date, $patients) {
  $roles = [
    'Nurse',
    'Billing',
    'Operating Room/Delivery Room',
    'Pulmonary Department (MSA)',
    'Hemodialysis Unit',
    'Radiology',
    'Laboratory',
    'Bloodbank',
    'Pharmacy',
    'Benefits - Window 3A',
    'Billing - Window 2',
    'Admin'
  ];

  foreach ($roles as $role) {
    broadcastPatientUpdate($role, $date, $patients);
  }
}

/**
 * Get patients for a role and broadcast
 * Convenience function that fetches and broadcasts in one call
 */
function fetchAndBroadcastPatients($db, $role, $date) {
  $query = "SELECT p.*, 
    (SELECT COUNT(*) FROM clearance_requests cr WHERE cr.patient_id = p.id AND cr.status = 'pending') as pending_count,
    (SELECT COUNT(*) FROM clearance_requests cr WHERE cr.patient_id = p.id) as total_cc,
    (SELECT COUNT(*) FROM clearance_requests cr WHERE cr.patient_id = p.id AND cr.status = 'pending' AND cr.remarks IS NOT NULL) as has_pending,
    (SELECT MAX(cr.created_at) FROM clearance_requests cr WHERE cr.patient_id = p.id AND cr.status = 'sent_back') as was_sent_back
    FROM patients p
    WHERE DATE(p.admit_date) = ?";

  if ($role !== 'Admin') {
    $query .= " AND (p.clearance_step IN ('no_request', 'awaiting_nurse', 'awaiting_billing', 'cost_center_clearing') 
                OR (p.clearance_step = 'cost_center_clearing' AND EXISTS (
                  SELECT 1 FROM clearance_requests cr 
                  WHERE cr.patient_id = p.id AND cr.cost_center = ?
                )))";
  }

  $query .= " ORDER BY p.admit_date DESC, p.id DESC";

  $stmt = $db->prepare($query);
  if ($role !== 'Admin') {
    $stmt->bind_param('ss', $date, $role);
  } else {
    $stmt->bind_param('s', $date);
  }

  $stmt->execute();
  $result = $stmt->get_result();
  $patients = $result->fetch_all(MYSQLI_ASSOC);
  $stmt->close();

  if (!empty($patients)) {
    broadcastPatientUpdate($role, $date, $patients);
  }

  return $patients;
}
?>
