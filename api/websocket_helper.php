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
  // WebSocket broadcast disabled — frontend uses polling instead
  return false;
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
    'Endoscopy',
    'Colonoscopy',
    'Physical Therapy',
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
  // WebSocket broadcast disabled — frontend uses polling instead
  return [];
}
?>
