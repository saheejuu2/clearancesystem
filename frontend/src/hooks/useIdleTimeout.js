import { useEffect, useRef, useCallback, useState } from 'react';

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

export default function useIdleTimeout(onIdle, timeoutMs = 2 * 60 * 1000) {
  const timer = useRef(null);
  const warnTimer = useRef(null);
  const [warning, setWarning] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const countRef = useRef(null);

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (countRef.current) clearInterval(countRef.current);
    setWarning(false);
    setCountdown(30);

    // Warn 30 seconds before idle
    warnTimer.current = setTimeout(() => {
      setWarning(true);
      setCountdown(30);
      let c = 30;
      countRef.current = setInterval(() => {
        c -= 1;
        setCountdown(c);
        if (c <= 0) clearInterval(countRef.current);
      }, 1000);
    }, timeoutMs - 30000);

    timer.current = setTimeout(() => {
      setWarning(false);
      onIdle();
    }, timeoutMs);
  }, [onIdle, timeoutMs]);

  useEffect(() => {
    reset();
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);
      if (countRef.current) clearInterval(countRef.current);
      EVENTS.forEach(e => window.removeEventListener(e, reset));
    };
  }, [reset]);

  return { warning, countdown, resetTimer: reset };
}
