import { useEffect, useRef } from "react";

/**
 * requestAnimationFrame loop with delta-time, decoupled from the React render
 * cycle. The callback lives in a ref, so re-rendering the component never
 * re-binds the loop and the frame closure is never stale.
 *
 * @param {(dt: number) => void} callback  called once per frame, dt in seconds
 * @param {boolean} active                 pause the loop when false
 */
export function useGameLoop(callback, active = true) {
  const cbRef = useRef(callback);

  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!active) return undefined;

    let raf = 0;
    let last = performance.now();

    const frame = (now) => {
      // Clamp so a backgrounded tab can't teleport everything through walls.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      cbRef.current(dt);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}
