import { useEffect, useRef } from 'react';

/**
 * Hook for auto-refreshing data at regular intervals
 * @param {Function} fetchFn - The fetch function to call
 * @param {number} interval - Interval in milliseconds (default: 10000ms)
 * @param {boolean} enabled - Whether to enable auto-refresh (default: true)
 * @param {Array} deps - Dependencies array to trigger refresh
 */
export default function useAutoRefresh(fetchFn, interval = 10000, enabled = true, deps = []) {
  const intervalRef = useRef(null);
  const lastCallRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Fetch immediately
    fetchFn();
    lastCallRef.current = Date.now();

    // Then set up interval - debounce rapid calls
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      if (now - lastCallRef.current >= interval) {
        fetchFn();
        lastCallRef.current = now;
      }
    }, interval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, interval, ...deps]);

  return () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };
}
