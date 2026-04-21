// Shared ward display logic used across tables and modals
export function formatWard(patient) {
  return patient.ward_name || (patient.ward && patient.ward.length <= 20 ? patient.ward : '—');
}
