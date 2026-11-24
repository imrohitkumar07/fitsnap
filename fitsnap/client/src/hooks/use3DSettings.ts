import { useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';

interface ThreeDSettings {
  /** Whether 3D content should be shown */
  show3D: boolean;
  /** Whether reduced motion is preferred */
  reduceMotion: boolean;
  /** Device pixel ratio capped at 2 for performance */
  dpr: number;
}

/**
 * Checks WebGL support by attempting to create a canvas context.
 */
function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}

/**
 * Hook to determine 3D rendering settings based on device capabilities
 * and user preferences.
 *
 * @returns ThreeDSettings — whether to show 3D, reduce motion, and DPR
 */
export function use3DSettings(): ThreeDSettings {
  const reduce3D = useSettingsStore((s) => s.reduce3D);
  const hasWebGL = useSettingsStore((s) => s.hasWebGL);
  const setWebGL = useSettingsStore((s) => s.setWebGL);

  useEffect(() => {
    const supported = checkWebGLSupport();
    setWebGL(supported);
  }, [setWebGL]);

  const reduceMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  // Cap DPR at 2 to prevent GPU overload on high-DPI screens
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Show 3D only if WebGL is supported and user hasn't disabled it
  const show3D = hasWebGL && !reduce3D && !reduceMotion;

  return { show3D, reduceMotion, dpr };
}
