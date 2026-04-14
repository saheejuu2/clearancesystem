import { useEffect, useRef } from 'react';

/**
 * Hook for auto-refreshing data at regular intervals with smooth updates
 * @param {Function} fetchFn - The fetch function to call
 * @param {number} interval - Interval in milliseconds (default: 15000ms)
 * @param {boolean} enabled - Whether to enable auto-refresh (default: true)
 * @param {Array} deps - Dependencies array to trigger refresh
 */
export default function useAutoRefresh(fetchFn, interval = 15000, enabled = true, deps = []) {
  const intervalRef = useRef(null);
  const lastCallRef = useRef(0);
  const isUserInteractingRef = useRef(false);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Fetch immediately on mount or dependency change
    if (!isFetchingRef.current) {
      isFetchingRef.current = true;
      Promise.resolve(fetchFn()).finally(() => {
        isFetchingRef.current = false;
      });
    }
    lastCallRef.current = Date.now();

    // Track user interaction to avoid refreshing during active use
    const handleMouseMove = () => {
      isUserInteractingRef.current = true;
      setTimeout(() => {
        isUserInteractingRef.current = false;
      }, 3000);
    };

    const handleKeyDown = () => {
      isUserInteractingRef.current = true;
      setTimeout(() => {
        isUserInteractingRef.current = false;
      }, 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);

    // Set up interval - skip if already fetching or user is interacting
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      if (now - lastCallRef.current >= interval && !isUserInteractingRef.current && !isFetchingRef.current) {
        isFetchingRef.current = true;
        Promise.resolve(fetchFn()).finally(() => {
          isFetchingRef.current = false;
          lastCallRef.current = Date.now();
        });
      }
    }, interval);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, interval, ...deps]);

  return () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };
}
