/**
 * SceneWrapper.tsx
 *
 * Top-level wrapper for every 3D scene in FitSnap.
 *
 * Responsibilities:
 * - Feature-detect WebGL support.
 * - Respect the user's `reduce3D` setting from the settings store.
 * - Respect the `prefers-reduced-motion` media query.
 * - Pause rendering when the component is scrolled off-screen or the
 *   tab is hidden (via IntersectionObserver + visibilitychange).
 * - Provide a React.Suspense boundary with a skeleton loader.
 * - Cap DPR at 2 for performance.
 *
 * @module SceneWrapper
 */

import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  ReactNode,
  Suspense,
} from 'react';
import { Canvas, RootState } from '@react-three/fiber';
import FallbackPlaceholder, { IconType } from './FallbackPlaceholder';

/* ------------------------------------------------------------------ */
/*  Skeleton loader for Suspense                                       */
/* ------------------------------------------------------------------ */

const SkeletonLoader: React.FC<{ height: string }> = ({ height }) => (
  <div
    className="animate-pulse rounded-2xl bg-gray-200/30 dark:bg-gray-800/40 backdrop-blur-md"
    style={{ height }}
  />
);

/* ------------------------------------------------------------------ */
/*  WebGL detection (runs once, cached)                                */
/* ------------------------------------------------------------------ */

let _webglSupported: boolean | null = null;

/**
 * Detect WebGL support by trying to acquire a context on an
 * off-screen canvas. The result is cached after the first call.
 */
function isWebGLSupported(): boolean {
  if (_webglSupported !== null) return _webglSupported;
  try {
    const c = document.createElement('canvas');
    _webglSupported = !!(
      c.getContext('webgl2') || c.getContext('webgl')
    );
  } catch {
    _webglSupported = false;
  }
  return _webglSupported!;
}

/* ------------------------------------------------------------------ */
/*  Reduced-motion detection                                           */
/* ------------------------------------------------------------------ */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

/* ------------------------------------------------------------------ */
/*  Settings store stub (replace with real Zustand store import)       */
/* ------------------------------------------------------------------ */

/**
 * Placeholder hook — swap with the real `useSettingsStore` once the
 * Zustand store is created.
 */
function useReduce3D(): boolean {
  return useSettingsStore((s) => s.reduce3D);
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

import { useSettingsStore } from '../../store/settingsStore';

export interface SceneWrapperProps {
  children: ReactNode;
  /** Extra CSS classes applied to the outermost container. */
  className?: string;
  /** Canvas height. @default '300px' */
  height?: string;
  /** R3F frameloop mode. @default 'demand' */
  frameloop?: 'always' | 'demand' | 'never';
  /** Fallback UI when 3D is unavailable. */
  fallback?: ReactNode;
  /** Icon type forwarded to the default FallbackPlaceholder. @default 'general' */
  fallbackIcon?: IconType;
  /** Alias for fallbackIcon */
  iconType?: IconType | string;
  /** Camera position override. @default [0, 0, 5] */
  cameraPosition?: [number, number, number];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const SceneWrapper: React.FC<SceneWrapperProps> = ({
  children,
  className = '',
  height = '300px',
  frameloop = 'demand',
  fallback,
  fallbackIcon = 'general',
  iconType,
  cameraPosition = [0, 0, 5],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const storeReduce3D = useSettingsStore((s) => s.reduce3D);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  const effectiveIcon = (iconType || fallbackIcon) as IconType;

  /* ---- WebGL support ---- */
  const hasWebGL = useMemo(() => isWebGLSupported(), []);

  /* ---- IntersectionObserver for viewport visibility ---- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* ---- Page Visibility API ---- */
  useEffect(() => {
    const handler = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  /* ---- Should we render 3D at all? ---- */
  if (!hasWebGL || storeReduce3D) {
    return (
      <>
        {fallback ?? (
          <FallbackPlaceholder iconType={effectiveIcon} height={height} className={className} />
        )}
      </>
    );
  }

  /** Determine effective frameloop: pause when not visible. */
  const effectiveFrameloop: 'always' | 'demand' | 'never' =
    !visible || !tabVisible ? 'never' : frameloop;

  const dpr = Math.min(window.devicePixelRatio, 2);

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ height }}>
      <Suspense fallback={<SkeletonLoader height={height} />}>
        <Canvas
          dpr={dpr}
          frameloop={effectiveFrameloop}
          camera={{ position: cameraPosition, fov: 50 }}
          flat
          style={{ borderRadius: '1rem' }}
        >
          {children}
        </Canvas>
      </Suspense>
    </div>
  );
};

export { SceneWrapper };
export default SceneWrapper;
