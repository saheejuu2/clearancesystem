import { useEffect, useRef, useState } from 'react';
import websocketService from '../services/websocket';
import api from '../services/api';

/**
 * Hook for real-time patient data via WebSocket
 * Falls back to polling if WebSocket is unavailable
 * @param {string} role - User role/cost center
 * @param {string} date - Date filter (YYYY-MM-DD)
 * @param {function} onUpdate - Callback when patients update
 * @param {boolean} enabled - Whether to enable updates (default: true)
 * @param {Array} deps - Dependencies array
 */
export default function useWebSocketPatients(role, date, onUpdate, enabled = true, deps = []) {
  const unsubscribeRef = useRef(null);
  const fallbackIntervalRef = useRef(null);
  const lastUpdateRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Try WebSocket first
    if (websocketService.isConnected()) {
      console.log('Using WebSocket for patient updates');

      // Subscribe to patient updates
      websocketService.subscribeToPatients(role, date);

      // Listen for patient updates
      unsubscribeRef.current = websocketService.on('patients_updated', (data) => {
        console.log('Received patient update via WebSocket');
        if (onUpdate) {
          onUpdate(data.patients);
        }
        lastUpdateRef.current = Date.now();
      });

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
        websocketService.unsubscribeFromPatients();
      };
    } else {
      // Fallback to polling if WebSocket not available
      console.log('WebSocket not connected, falling back to polling');

      const fetchPatients = async () => {
        try {
          const res = await api.get(`/get_patients.php?role=${encodeURIComponent(role)}&date=${date}`);
          if (onUpdate) {
            onUpdate(res.data);
          }
          lastUpdateRef.current = Date.now();
        } catch (e) {
          console.error('Failed to fetch patients:', e);
        }
      };

      // Initial fetch
      fetchPatients();

      // Set up polling interval (30 seconds as fallback)
      fallbackIntervalRef.current = setInterval(fetchPatients, 30000);

      return () => {
        if (fallbackIntervalRef.current) {
          clearInterval(fallbackIntervalRef.current);
        }
      };
    }
  }, [enabled, role, date, onUpdate, ...deps]);

  return {
    isWebSocketConnected: websocketService.isConnected(),
    lastUpdate: lastUpdateRef.current
  };
}
