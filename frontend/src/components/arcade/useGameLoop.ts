import { useEffect, useRef } from 'react';

/**
 * requestAnimationFrame game loop. Calls the callback with the elapsed time
 * in seconds, clamped to 50ms so a backgrounded tab doesn't cause a huge
 * physics step on return.
 */
export function useGameLoop(callback: (dt: number) => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let rafId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      callbackRef.current(dt);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);
}
