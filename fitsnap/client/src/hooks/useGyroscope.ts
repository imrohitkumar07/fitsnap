import { useState, useEffect, useCallback, useRef } from 'react';

interface GyroscopeValues {
  /** Normalized X tilt (-1 to 1), positive = right */
  x: number;
  /** Normalized Y tilt (-1 to 1), positive = down */
  y: number;
}

/**
 * Hook that provides normalized gyroscope/tilt values for parallax effects.
 *
 * On mobile devices: uses DeviceOrientationEvent (beta/gamma).
 * On desktop: falls back to mouse position tracking.
 *
 * @returns Normalized { x, y } values in range [-1, 1]
 */
export function useGyroscope(): GyroscopeValues {
  const [values, setValues] = useState<GyroscopeValues>({ x: 0, y: 0 });
  const frameRef = useRef<number>(0);

  // ── Mobile: Device Orientation ──────────────────────────────────
  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const beta = event.beta ?? 0;   // -180 to 180 (front/back tilt)
    const gamma = event.gamma ?? 0; // -90 to 90 (left/right tilt)

    // Normalize to -1..1 range
    // Beta: typically -90 to 90 when holding phone upright
    // Gamma: -45 to 45 is comfortable range
    const normalizedX = Math.max(-1, Math.min(1, gamma / 45));
    const normalizedY = Math.max(-1, Math.min(1, (beta - 45) / 45));

    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      setValues({ x: normalizedX, y: normalizedY });
    });
  }, []);

  // ── Desktop: Mouse Position ─────────────────────────────────────
  const handleMouseMove = useCallback((event: MouseEvent) => {
    const { innerWidth, innerHeight } = window;
    // Map mouse position to -1..1
    const x = (event.clientX / innerWidth) * 2 - 1;
    const y = (event.clientY / innerHeight) * 2 - 1;

    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      setValues({ x, y });
    });
  }, []);

  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile && 'DeviceOrientationEvent' in window) {
      // Some browsers (iOS 13+) require permission
      const requestPermission = (
        DeviceOrientationEvent as unknown as {
          requestPermission?: () => Promise<string>;
        }
      ).requestPermission;

      if (typeof requestPermission === 'function') {
        requestPermission()
          .then((permission) => {
            if (permission === 'granted') {
              window.addEventListener('deviceorientation', handleOrientation);
            }
          })
          .catch(console.error);
      } else {
        window.addEventListener('deviceorientation', handleOrientation);
      }
    } else {
      // Desktop fallback
      window.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(frameRef.current);
    };
  }, [handleOrientation, handleMouseMove]);

  return values;
}
