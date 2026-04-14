import { useEffect, useRef } from 'react';
import api from '../services/api';

/**
 * Polls for patient data updates.
 * WebSocket is not used — polling is the reliable transport here.
 */
export default function useWebSocketPatients(role, date, onUpdate, enabled = true, deps = []) {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const fetchPatients = async () => {
      try {
        const res = await api.get(`/get_patients.php?role=${encodeURIComponent(role)}&date=${date}`);
        if (onUpdate) onUpdate(res.data);
      } catch { /* silent */ }
    };

    // Poll every 15 seconds
    intervalRef.current = setInterval(fetchPatients, 15000);

    return () => clearInterval(intervalRef.current);
  }, [enabled, role, date, ...deps]);

  return { isWebSocketConnected: false };
}
