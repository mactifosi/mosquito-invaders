import { useCallback, useEffect, useRef } from "react";

const KEY_MAP = {
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
};

/**
 * Owns the input ref the game loop reads each frame, and binds the keyboard to
 * it. Touch buttons drive the same ref through the returned `press` helper, so
 * the loop has exactly one input source regardless of device.
 *
 * @param {object} handlers
 * @param {() => void} handlers.onConfirm  Space outside of play advances the CTA
 * @param {() => void} handlers.onPause    P or Escape toggles pause
 */
export function useTouchControls({ onConfirm, onPause } = {}) {
  const input = useRef({ left: false, right: false, fire: false });
  const handlers = useRef({ onConfirm, onPause });

  useEffect(() => {
    handlers.current = { onConfirm, onPause };
  }, [onConfirm, onPause]);

  useEffect(() => {
    const isFire = (e) => e.key === " " || e.code === "Space";

    const down = (e) => {
      if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        e.preventDefault();
        handlers.current.onPause?.();
        return;
      }
      if (isFire(e)) {
        e.preventDefault();
        if (!input.current.fire) handlers.current.onConfirm?.();
        input.current.fire = true;
        return;
      }
      const dir = KEY_MAP[e.key];
      if (dir) {
        e.preventDefault();
        input.current[dir] = true;
      }
    };

    const up = (e) => {
      if (isFire(e)) {
        input.current.fire = false;
        return;
      }
      const dir = KEY_MAP[e.key];
      if (dir) input.current[dir] = false;
    };

    // Releasing keys on blur stops the craft drifting when the tab loses focus.
    const blur = () => {
      input.current.left = false;
      input.current.right = false;
      input.current.fire = false;
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const press = useCallback((control, value) => {
    input.current[control] = value;
  }, []);

  return { input, press };
}
