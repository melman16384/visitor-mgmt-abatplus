import { useEffect, useRef, useCallback } from 'react';

const EVENTS = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'scroll', 'click'];

export default function useKioskIdle(timeoutMs, onIdle) {
  const timerRef = useRef(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onIdleRef.current(), timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timerRef.current);
      EVENTS.forEach(e => window.removeEventListener(e, reset));
    };
  }, [reset]);
}
